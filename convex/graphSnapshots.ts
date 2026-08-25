/**
 * Graph Snapshot Receiver — Phase 83, GH-01.
 *
 * Persists Ástríðr's nightly graphify + Obsidian vault code/dependency graph
 * snapshots instead of dropping them. Stores graph data in four tables:
 *   - graphSnapshots          — meta doc (1 row per snapshotId, activeVersion
 *                                pointer, blobChunkCount)
 *   - graphSnapshotBlobChunks — Phase 126, SWEEP-02, D-06-REVISED: the ACTIVE
 *                                read/write path — {nodes,links} serialized
 *                                once and split across seq-ordered rows
 *   - graphSnapshotNodes      — LEGACY entity rows keyed by (snapshotId,
 *                                version). No longer written (see
 *                                upsertGraphSnapshot); kept so the retention
 *                                sweep can drain rows from versions written
 *                                before this table existed.
 *   - graphSnapshotLinks      — LEGACY, same status as graphSnapshotNodes.
 *
 * Writers are internalMutation — called from the /runtime-ingest httpAction
 * which has no Clerk identity (same rule as forge.appendLogChunk).
 * Readers are public graceful-skip queries — consistent with kg.latestSummary
 * and forge.listJobs (intentionally public, operational telemetry, non-secret).
 */

import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Module-level constants and pure-logic helpers
// ---------------------------------------------------------------------------

export const GRAPH_SNAPSHOT_KEEP_VERSIONS = 7;

/**
 * Given all known versions for a snapshotId (any order), returns those to
 * delete to bring the total down to `keepN` versions. Returns [] when no
 * deletion is needed. Mirrors the `selectCapDeletes` structure in forge.ts.
 */
export function selectVersionDeletes(versions: number[], keepN: number): number[] {
  if (versions.length <= keepN) return [];
  const sorted = [...versions].sort((a, b) => a - b); // ascending = oldest first
  return sorted.slice(0, sorted.length - keepN);       // drop oldest
}

// ---------------------------------------------------------------------------
// Chunked blob helpers — Phase 126, SWEEP-02, D-06-REVISED.
//
// D-05 measured getProjectGraph's two .collect()s at 6,591 rows against
// Convex's 4,096-read ceiling. D-06-REVISED rejected a single-document blob
// (measured 99-101% of the 1 MiB document limit) and Convex file storage
// (unreadable from a `query`). The remedy: serialize {nodes, links} ONCE and
// split the JSON string across N rows carrying a monotonic `seq`
// (graphSnapshotBlobChunks, schema.ts), read back through
// by_snapshot_version_seq and rejoined in `seq` order.
// ---------------------------------------------------------------------------

/**
 * Per-row chunk size, in characters. Convex's per-document limit is ~1 MiB.
 * 128,000 characters is 512 KB even at UTF-8's 4-bytes-per-character worst
 * case — at least 2x headroom under the per-row ceiling. Against
 * D-06-REVISED's measured ~1.03 MB total blob this yields roughly 9 chunk
 * rows, i.e. a read of ~10 rows where the old path read 6,591.
 */
export const GRAPH_BLOB_CHUNK_CHARS = 128_000;

/**
 * Per-invocation cap on how many STALE (older-version) chunk rows
 * upsertGraphSnapshot deletes after flipping the pointer. ~9 chunk rows per
 * version at the size above, so 200 is ~20 versions' worth of backlog per
 * ingest — deliberately NOT "delete everything older in one pass", which is
 * the mass-delete pattern CLAUDE.md forbids on this self-hosted instance (it
 * took the dashboard down for days in 2026-07-21/22). ctx.db.delete() counts
 * as a read against the 4,096-per-invocation ceiling, same as every read this
 * cap is meant to bound.
 */
export const STALE_CHUNK_DELETE_CAP = 200;

/**
 * Splits a JSON string into chunks of at most `maxChars` characters each,
 * never cutting a UTF-16 surrogate pair in two.
 *
 * `JSON.stringify` does not escape non-ASCII, so an emoji or other astral
 * character in a node `label` survives into the string as a UTF-16 surrogate
 * pair (a high surrogate 0xD800-0xDBFF followed by a low surrogate
 * 0xDC00-0xDFFF). Slicing at an arbitrary index can split that pair across
 * two chunks — two lone surrogates, which are not valid UTF-8 and which a
 * store may reject or silently replace with U+FFFD, corrupting the JSON on
 * rejoin. Before cutting, if the character immediately before the boundary is
 * a high surrogate, the boundary is pulled back by one so the pair stays
 * together in the later chunk.
 *
 * `splitGraphBlob("")` returns `[]` — an empty blob has zero chunks to write,
 * and `joinGraphBlobChunks([])` (below) returns `""` to round-trip it.
 */
export function splitGraphBlob(json: string, maxChars: number = GRAPH_BLOB_CHUNK_CHARS): string[] {
  if (json.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < json.length) {
    let end = Math.min(start + maxChars, json.length);
    // Don't split a surrogate pair: if the char just before `end` is a high
    // surrogate, its partner (the low surrogate) is at `end` — pull the
    // boundary back so the pair stays intact in the NEXT chunk.
    if (end < json.length) {
      const code = json.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) {
        end -= 1;
      }
    }
    chunks.push(json.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * Rejoins chunk rows into the original JSON string, in `seq` order.
 *
 * Sorts a COPY of `rows` ascending by `seq` before concatenating — this is
 * the whole point of the function, not an optimization. `convex/forge.ts`'s
 * `listJobLogs` (the table-shape precedent for this chunking pattern) sorts
 * its chunks by `_creationTime` via `.order("asc")`, not by `seq`, which is
 * harmless for append-only log lines but would be silent corruption here:
 * a race, retry, or future batched insert could reorder `_creationTime`
 * while `seq` stays correct, and reassembling by the wrong order produces
 * corrupt JSON (a `JSON.parse` throw at best, a plausible truncated graph at
 * worst) rather than a visible error. Do not "simplify" this sort away.
 */
export function joinGraphBlobChunks(chunks: Array<{ seq: number; chunk: string }>): string {
  return [...chunks]
    .sort((a, b) => a.seq - b.seq)
    .map((c) => c.chunk)
    .join("");
}

// ---------------------------------------------------------------------------
// Write mutations (internalMutation — httpAction + cron callers only)
// ---------------------------------------------------------------------------

/**
 * Versioned-swap upsert for a graph snapshot (D-02).
 *
 * Algorithm (rewritten Phase 126, SWEEP-02, D-06-REVISED — steps 5-7 replaced,
 * step 8 added; this comment is kept in sync with the code because a stale
 * algorithm comment on this exact function is what hid the read-vs-write
 * confusion D-05 diagnosed for a month):
 *   1. Read existing meta doc to determine currentVersion (0 if first ingest).
 *   2. newVersion = currentVersion + 1.
 *   3. Build Set<string> of incoming node ids (dangling-link guard, D-05).
 *   4. Filter links to those with both endpoints in the node set.
 *   5. Serialize {nodes, links} ONCE into a JSON string — the same field
 *      shapes getProjectGraph returns (community null/undefined coerced
 *      first). ENTITY-ROW WRITES ARE RETIRED: this function no longer
 *      inserts graphSnapshotNodes/graphSnapshotLinks rows (see the retire-
 *      writes-keep-tables note at the deletion site below).
 *   6. Split the blob into chunks (splitGraphBlob) and insert one
 *      graphSnapshotBlobChunks row per chunk, keyed (snapshotId, newVersion, seq).
 *   7. LAST of the write-then-flip steps: patch-or-insert graphSnapshots meta
 *      doc with activeVersion = newVersion and blobChunkCount = chunk count.
 *   8. AFTER the pointer flip: delete this snapshotId's chunk rows for every
 *      version OLDER than newVersion, bounded by STALE_CHUNK_DELETE_CAP so a
 *      backlog drains over several ingests rather than in one mass delete.
 *
 * Step 7 is last of the CREATE steps: readers continue to see the complete
 * previous version until the pointer flips (Pitfall 2 guard). Step 8 runs
 * only AFTER that flip — deleting the previous version's chunks before the
 * flip would let a mid-crash leave activeVersion pointing at a version whose
 * chunks are already gone.
 */
export const upsertGraphSnapshot = internalMutation({
  args: {
    snapshotId:  v.string(),
    nodes: v.array(v.object({
      id:        v.string(),
      label:     v.string(),
      type:      v.string(),
      community: v.optional(v.union(v.float64(), v.null())),
      source:    v.string(),
    })),
    links: v.array(v.object({
      source:   v.string(),
      target:   v.string(),
      relation: v.string(),
    })),
    sources: v.array(v.object({
      source:           v.string(),
      kind:             v.string(),
      nodeCount:        v.float64(),
      linkCount:        v.float64(),
      emittedNodeCount: v.float64(),
      emittedLinkCount: v.float64(),
      truncated:        v.boolean(),
    })),
    nodeCount:   v.float64(),
    linkCount:   v.float64(),
    generatedAt: v.float64(),
    receivedAt:  v.float64(),
  },
  handler: async (ctx, args) => {
    // 1. Read existing meta doc.
    const existing = await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .unique();

    // 2. Compute new monotonic version.
    const newVersion = (existing?.activeVersion ?? 0) + 1;

    // 3. Build Set of incoming node ids for dangling-link guard (D-05).
    const nodeIdSet = new Set<string>(args.nodes.map((n) => n.id));

    // 4. Filter links: drop those whose source or target is not in the node set.
    const filteredLinks = args.links.filter(
      (l) => nodeIdSet.has(l.source) && nodeIdSet.has(l.target)
    );

    // RETIRED (Phase 126, SWEEP-02, D-06-REVISED, 2026-08-25): this function
    // used to insert graphSnapshotNodes/graphSnapshotLinks rows here, in
    // chunks of 1,000, as steps 5-6. Grepped across convex/**/*.ts,
    // getProjectGraph (plan 126-05) and sweepGraphSnapshotVersions were those
    // tables' only consumers — once the reader points at
    // graphSnapshotBlobChunks below, continuing to write ~6,591 entity rows
    // per ingest would cost real writes with no reader. The table
    // definitions, their indexes, and the sweep's handling of them are
    // DELIBERATELY KEPT (see schema.ts) so the sweep can drain legacy
    // versions' rows at its existing bounded rate; this function simply stops
    // adding to the pile. NOTE for reviewers: getProjectGraph still reads the
    // now-empty-for-new-versions entity tables until plan 126-05 lands, so
    // /tool-galaxy remains broken in the interim — that is expected, not a
    // regression introduced here.

    // 5. Serialize {nodes, links} ONCE. Same field shapes getProjectGraph
    // currently returns, so plan 126-05's reader can return the parsed blob
    // directly with no re-mapping: nodes as {id, label, type, community,
    // source} (community null/undefined coerced first, same rule the retired
    // insert loop applied), links as {source, target, relation} (filteredLinks
    // already has exactly that shape).
    const projectedNodes = args.nodes.map((node) => ({
      id:        node.id,
      label:     node.label,
      type:      node.type,
      community: node.community === null || node.community === undefined
        ? undefined
        : node.community,
      source:    node.source,
    }));
    const blob = JSON.stringify({ nodes: projectedNodes, links: filteredLinks });

    // 6. Split the blob and insert one graphSnapshotBlobChunks row per chunk.
    const blobChunks = splitGraphBlob(blob);
    for (let seq = 0; seq < blobChunks.length; seq++) {
      await ctx.db.insert("graphSnapshotBlobChunks", {
        snapshotId: args.snapshotId,
        version:    newVersion,
        seq,
        chunk:      blobChunks[seq],
      });
    }

    // 7. LAST of the create steps: patch-or-insert meta doc with new
    // activeVersion pointer AND blobChunkCount.
    //
    // storedVersions is appended here, at the ONLY place a version's rows are
    // created, so the list cannot drift from the rows it describes. Appending
    // LAST — after every chunk insert above — matters: a crash midway leaves
    // rows with no list entry, which the sweep ignores (it deletes only what
    // the list names), whereas the reverse order would leave the list naming
    // a version whose rows were never written and invite a delete pass
    // against nothing.
    //
    // `?? []` is safe here and NOT the "absent means empty" trap the sweep
    // refuses on: this path is writing a version it just created, so the list is
    // correct from this point forward whether or not the doc predates the field.
    const storedVersionsAfter = [...(existing?.storedVersions ?? []), newVersion];
    const metaDoc = {
      snapshotId:      args.snapshotId,
      activeVersion:   newVersion,
      sources:         args.sources,
      nodeCount:       args.nodeCount,
      linkCount:       args.linkCount,
      storedNodeCount: args.nodes.length,
      storedLinkCount: filteredLinks.length,
      generatedAt:     args.generatedAt,
      updatedAt:       args.receivedAt,
      storedVersions:  storedVersionsAfter,
      blobChunkCount:  blobChunks.length,
    };
    if (existing) {
      await ctx.db.patch(existing._id, metaDoc);
    } else {
      await ctx.db.insert("graphSnapshots", metaDoc);
    }

    // 8. AFTER the pointer flip: delete chunk rows for versions OLDER than the
    // one just written, bounded so this never becomes the mass delete
    // CLAUDE.md forbids on this self-hosted instance (it took the dashboard
    // down for days in 2026-07-21/22). ctx.db.delete() counts as a READ
    // against the 4,096-per-invocation ceiling — same as the sweep's own
    // node/link deletes — which is why STALE_CHUNK_DELETE_CAP exists at all
    // rather than deleting "everything older" in one pass.
    const staleChunks = await ctx.db
      .query("graphSnapshotBlobChunks")
      .withIndex("by_snapshot_version_seq", (q) =>
        q.eq("snapshotId", args.snapshotId).lt("version", newVersion)
      )
      .take(STALE_CHUNK_DELETE_CAP + 1);

    const toDelete = staleChunks.slice(0, STALE_CHUNK_DELETE_CAP);
    for (const row of toDelete) {
      await ctx.db.delete(row._id);
    }
    if (staleChunks.length > STALE_CHUNK_DELETE_CAP) {
      // More stale chunks remain than this invocation's cap allows. Leave them
      // for the next ingest to continue draining — NEVER raise the cap to
      // finish in one pass; that is the mass-delete pattern this cap exists
      // to prevent.
      console.warn(
        `[upsertGraphSnapshot] stale chunk delete hit STALE_CHUNK_DELETE_CAP ` +
          `(${STALE_CHUNK_DELETE_CAP}) for snapshotId "${args.snapshotId}"; ` +
          `more stale chunks remain and will be drained on a later ingest.`
      );
    }
  },
});

/**
 * Retention sweep — keeps the last GRAPH_SNAPSHOT_KEEP_VERSIONS versions per
 * snapshotId and deletes at most MAX_DELETES_PER_INVOCATION rows of ONE stale
 * version per invocation.
 *
 * THE BINDING LIMIT IS READS (4,096 per function execution), NOT WRITES.
 * Everything above this line used to be reasoned about against the 16,000-doc
 * WRITE ceiling — "one old version ≈ 13,500 rows, within the limit" — and that
 * framing is what hid the real defect for a month. `ctx.db.delete()` counts as a
 * read, and so does every row a query returns, so a pass that reads 13,500 rows
 * to delete them blows the read ceiling long before the write one. Convex's own
 * published limits table lists the write number and says nothing about this,
 * which is why the empirical error message beat both the docs and this file's
 * own comments.
 *
 * Per invocation: 1 meta-table collect (few rows) + (CAP+1) node take + up to
 * CAP deletes + (remaining+1) link take + deletes ≈ 3*CAP+2 = 3,002. Bounded by
 * construction, independent of how many rows a version actually holds.
 *
 * Candidate versions come from `meta.storedVersions` — ONE field on a row
 * already in hand. The previous implementation derived them by collecting every
 * node row across every stored version (~70,000 reads), which is precisely why
 * `crons.ts` disabled this from 2026-07-14. Same fix, same shape, as Phase 115
 * applied to convex/workspace.ts.
 *
 * A meta doc with NO storedVersions is SKIPPED WITH A WARNING, never treated as
 * an empty list — see the note at the skip. Run
 * `internal.graphSnapshots.backfillGraphStoredVersions` once after deploying.
 */
export const sweepGraphSnapshotVersions = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Read all meta docs (few rows — at most one per distinct snapshotId).
    const allMeta = await ctx.db.query("graphSnapshots").collect();

    for (const meta of allMeta) {
      // CANDIDATE SELECTION IS NOW ONE FIELD READ ON A ROW WE ALREADY HAVE.
      //
      // This used to .collect() EVERY graphSnapshotNodes row across EVERY stored
      // version purely to derive the distinct version set — ~10,000 rows per
      // version, up to 7 kept, so ~70,000 reads against a 4,096-read ceiling.
      // That is the mechanism behind "times out on self-hosted Convex", and it
      // is why this cron sat disabled from 2026-07-14. Fixed the way Phase 115
      // fixed the identical shape in convex/workspace.ts.
      //
      // ABSENT IS NOT EMPTY. A meta doc written before `storedVersions` existed
      // has no list, and treating that as [] would make selectVersionDeletes
      // return nothing — a sweep that deletes forever-nothing while reporting
      // success, which is strictly worse than the timeout it replaced because it
      // is silent. Skip and say so; `backfillGraphStoredVersions` fills it in.
      if (meta.storedVersions === undefined) {
        console.warn(
          `[sweepGraphSnapshotVersions] skipping "${meta.snapshotId}": storedVersions is absent ` +
            `(meta doc predates the field). Run internal.graphSnapshots.backfillGraphStoredVersions ` +
            `first — treating absent as an empty list would silently prune nothing forever.`
        );
        continue;
      }

      const toDelete = selectVersionDeletes(meta.storedVersions, GRAPH_SNAPSHOT_KEEP_VERSIONS);
      if (toDelete.length === 0) {
        if (meta.pruneIncomplete) await ctx.db.patch(meta._id, { pruneIncomplete: false });
        continue;
      }

      // Process AT MOST ONE stale version per invocation (mutation write limit).
      const versionToDelete = toDelete[0];
      let deleteCount = 0;
      // CORRECTED 2026-08-13 (Phase 115 defect-class sweep). This was 15,000,
      // described as a "safety guard under 16,000 limit" — the 16,000-doc WRITE
      // ceiling. But the rows were fetched with .collect(), so the cap bounded
      // the DELETES and never the READS, and the binding limit here is READS:
      // 4,096 per function execution. Phase 115 hit exactly this in
      // convex/workspace.ts and the error is unambiguous:
      //   "Too many reads in a single function execution (limit: 4096)"
      // Reads per invocation are now (MAX+1) node take + node deletes +
      // (remaining+1) link take + link deletes, i.e. at most ~3*MAX+2 = 3,002.
      // A ctx.db.delete() counts toward reads too, which is why MAX cannot
      // simply be 4,000.
      const MAX_DELETES_PER_INVOCATION = 1000;

      // BOUNDED READ, never .collect(): take CAP+1 so "more remain" is visible
      // from the extra row without reading the whole version.
      const staleNodes = await ctx.db
        .query("graphSnapshotNodes")
        .withIndex("by_snapshot_version", (q) =>
          q.eq("snapshotId", meta.snapshotId).eq("version", versionToDelete)
        )
        .take(MAX_DELETES_PER_INVOCATION + 1);

      // The extra row is the signal, not a row to delete: more nodes remain.
      let moreRemain = staleNodes.length > MAX_DELETES_PER_INVOCATION;

      for (const node of staleNodes) {
        if (deleteCount >= MAX_DELETES_PER_INVOCATION) break;
        await ctx.db.delete(node._id);
        deleteCount++;
      }

      // Links share the SAME per-invocation budget, so only take what is left.
      const linkBudget = MAX_DELETES_PER_INVOCATION - deleteCount;
      if (linkBudget > 0) {
        const staleLinks = await ctx.db
          .query("graphSnapshotLinks")
          .withIndex("by_snapshot_version", (q) =>
            q.eq("snapshotId", meta.snapshotId).eq("version", versionToDelete)
          )
          .take(linkBudget + 1);

        if (staleLinks.length > linkBudget) moreRemain = true;

        for (const link of staleLinks) {
          if (deleteCount >= MAX_DELETES_PER_INVOCATION) break;
          await ctx.db.delete(link._id);
          deleteCount++;
        }
      } else {
        // The node deletes consumed the whole budget, so this version's links
        // were not even LOOKED at. That is unambiguously "more remains" — and
        // getting this wrong is how a version gets dropped from storedVersions
        // while its link rows survive forever as unreachable orphans that no
        // later pass will ever select, because selection is by version.
        moreRemain = true;
      }

      if (moreRemain) {
        // Cap hit — leave versionToDelete IN storedVersions so the next call
        // re-selects it and finishes. NEVER raise the cap to "finish it this
        // time": that is the mass delete CLAUDE.md forbids on this self-hosted
        // instance, and it is what put the dashboard down for days in
        // 2026-07-21/22.
        if (!meta.pruneIncomplete) await ctx.db.patch(meta._id, { pruneIncomplete: true });
        continue;
      }

      // Fully removed — and ONLY now does the version leave the list. Ordering
      // is the crash-safety property: a crash between the deletes above and this
      // patch leaves a stale entry naming an already-emptied version, which the
      // next call re-selects, finds nothing for, and completes. The reverse
      // order would drop the entry first and strand any surviving rows.
      await ctx.db.patch(meta._id, {
        storedVersions: meta.storedVersions.filter((ver) => ver !== versionToDelete),
        pruneIncomplete: false,
      });
    }
  },
});

/**
 * One-shot backfill for `graphSnapshots.storedVersions` (added 2026-08-16).
 *
 * WHY IT CANNOT JUST DERIVE THE LIST THE OLD WAY: the whole point of the field
 * is that scanning entity rows to find versions is what blew the read ceiling.
 * A backfill that did that would fail for exactly the same reason, on exactly
 * the data it exists to repair.
 *
 * So it PROBES instead: for each candidate version in a bounded window ending at
 * `activeVersion`, take ONE row. Present ⇒ that version has rows. That is at
 * most `windowSize + 1` reads per snapshot regardless of how many rows a version
 * holds — 10,000 rows or 10, the probe costs the same.
 *
 * The window does NOT early-stop on a miss. Versions can be non-contiguous (an
 * earlier partial sweep leaves gaps), and stopping at the first gap would
 * silently truncate the list, which reads as "those versions are already gone"
 * and makes them permanently unreachable by the sweep.
 *
 * TRUNCATION IS REPORTED, NEVER SILENT. If the OLDEST probed version still has
 * rows, versions older than the window may exist and the result says so with
 * `windowTruncated: true`. Re-run with a larger `window` to reach them.
 *
 * Idempotent: re-running recomputes and re-patches the same list. Deletes
 * nothing, ever — it is a pure read-and-patch-one-field.
 */
export const backfillGraphStoredVersions = internalMutation({
  args: {
    window: v.optional(v.number()),
    /** Recompute even where storedVersions is already populated. Default false:
     * the maintained field is authoritative once it exists, and clobbering it
     * from a probe would discard a correct in-flight `pruneIncomplete` state. */
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const window = Math.max(1, Math.min(args.window ?? 60, 500));
    const force = args.force ?? false;
    const allMeta = await ctx.db.query("graphSnapshots").collect();

    const results: Array<{
      snapshotId: string;
      activeVersion: number;
      found: number[];
      windowTruncated: boolean;
      skipped: boolean;
    }> = [];

    for (const meta of allMeta) {
      if (meta.storedVersions !== undefined && !force) {
        results.push({
          snapshotId: meta.snapshotId,
          activeVersion: meta.activeVersion,
          found: meta.storedVersions,
          windowTruncated: false,
          skipped: true,
        });
        continue;
      }

      const oldest = Math.max(1, meta.activeVersion - window + 1);
      const found: number[] = [];
      for (let ver = oldest; ver <= meta.activeVersion; ver++) {
        const probe = await ctx.db
          .query("graphSnapshotNodes")
          .withIndex("by_snapshot_version", (q) =>
            q.eq("snapshotId", meta.snapshotId).eq("version", ver)
          )
          .take(1);
        if (probe.length > 0) found.push(ver);
      }

      // If the oldest version in the window still has rows, older ones may too.
      const windowTruncated = found.length > 0 && found[0] === oldest && oldest > 1;

      await ctx.db.patch(meta._id, { storedVersions: found });
      results.push({
        snapshotId: meta.snapshotId,
        activeVersion: meta.activeVersion,
        found,
        windowTruncated,
        skipped: false,
      });
    }

    return { window, snapshots: results };
  },
});

// ---------------------------------------------------------------------------
// Read queries (public, graceful-skip — no Clerk gating)
// ---------------------------------------------------------------------------

/**
 * Returns the active version's graph data for a given snapshotId, or null
 * before any snapshot has been ingested (graceful-skip, T-83-07 accepted).
 *
 * Default snapshotId: "astridr-project-graph" (the stable id Ástríðr emits).
 */
export const getProjectGraph = query({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = "astridr-project-graph" }) => {
    const meta = await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .unique();

    if (!meta) return null;  // graceful-skip: no data yet

    const nodes = await ctx.db
      .query("graphSnapshotNodes")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .collect();

    const links = await ctx.db
      .query("graphSnapshotLinks")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .collect();

    return {
      snapshotId:      meta.snapshotId,
      sources:         meta.sources,
      nodeCount:       meta.nodeCount,
      linkCount:       meta.linkCount,
      storedNodeCount: meta.storedNodeCount,
      storedLinkCount: meta.storedLinkCount,
      generatedAt:     meta.generatedAt,
      nodes: nodes.map((n) => ({
        id:        n.nodeId,
        label:     n.label,
        type:      n.type,
        community: n.community,
        source:    n.source,
      })),
      links: links.map((l) => ({
        source:   l.source,
        target:   l.target,
        relation: l.relation,
      })),
    };
  },
});

/**
 * Pure projection of a stored graphSnapshots row to listSnapshots' public
 * return shape. Exported (precedent: selectVersionDeletes above) so tests
 * can assert against the real production function rather than a hand-copied
 * mirror. Phase 114 D-13: adds `sources` so useArmsProbe (src/hooks) can
 * derive arms-presence from `sources[].kind` without a new public query
 * (CLAUDE.md § SEED-008 — every public Convex function here is callable
 * with no credential, so a new public function is not free).
 */
export function projectSnapshotRow(r: {
  snapshotId: string;
  nodeCount: number;
  linkCount: number;
  generatedAt: number;
  updatedAt: number;
  sources: Array<{
    source: string;
    kind: string;
    nodeCount: number;
    linkCount: number;
    emittedNodeCount: number;
    emittedLinkCount: number;
    truncated: boolean;
  }>;
}) {
  return {
    snapshotId:  r.snapshotId,
    nodeCount:   r.nodeCount,
    linkCount:   r.linkCount,
    generatedAt: r.generatedAt,
    updatedAt:   r.updatedAt,
    sources:     r.sources,
  };
}

/**
 * Lists all snapshot metadata rows (one per snapshotId).
 * Today at most one row; keyed for future multi-snapshotId support.
 */
export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("graphSnapshots").collect();
    return rows.map(projectSnapshotRow);
  },
});
