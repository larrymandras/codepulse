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

import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import type { PaginationResult } from "convex/server";

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
 * Per-invocation cap on how many chunk rows getProjectGraph will read for one
 * version's blob. DERIVED from Convex's 16 MiB per-transaction scan ceiling,
 * not chosen as a round number (REVIEW FIX, cross-AI review 2026-08-24,
 * HIGH — an earlier draft said 200, which sits ABOVE the ceiling below and
 * would make the over-cap ConvexError in getProjectGraph UNREACHABLE: the
 * database aborts the scan before the handler ever sees row 201, the same
 * failure shape as D-05 itself).
 *
 * Arithmetic: GRAPH_BLOB_CHUNK_CHARS (128,000 chars) x 4 bytes (UTF-8 worst
 * case per character) = 512 KB worst-case per chunk row. A safety factor of
 * 2 against the 16 MiB scan ceiling gives an 8 MiB budget, so
 * 8 MiB / 512 KB = 16 chunks. Today's graph (~1.03 MB serialized, per
 * D-06-REVISED's measurement) is ~9 chunks, so 16 leaves real headroom while
 * staying provably under the ceiling even if every chunk is full and every
 * character is 4 bytes.
 *
 * If a future graph genuinely needs more than 16 chunks, the fix is NOT to
 * raise this constant — 512 KB x N must stay under the 8 MiB budget. Raising
 * it past the scan ceiling reintroduces D-05's failure at a larger size.
 */
export const GRAPH_BLOB_MAX_CHUNKS = 16;

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
    // TOCTOU guard for the one-shot backfill (SWEEP-02). When present, this
    // mutation re-reads the meta row INSIDE ITS OWN TRANSACTION and refuses to
    // write if `activeVersion` has moved. An action cannot do this: its
    // `runQuery` check and its `runMutation` write are two separate
    // transactions, so a producer ingest can land between them, and the
    // mutation would then read the NEWER version, increment it, and publish
    // the backfill's stale legacy data as the newest snapshot — precisely the
    // backwards-roll the check exists to prevent. Optional, so the normal
    // producer path is unaffected.
    expectedVersion: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    // 1. Read existing meta doc.
    const existing = await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .unique();

    // 2. Compute new monotonic version.
    // TOCTOU guard, enforced INSIDE this transaction (see the arg's comment).
    // `existing` was read by this mutation, so comparing against it here is
    // atomic with the writes below in a way an action-side pre-check is not.
    if (
      args.expectedVersion !== undefined &&
      (existing?.activeVersion ?? 0) !== args.expectedVersion
    ) {
      throw new ConvexError(
        `graphSnapshots: refusing to publish ${args.snapshotId} — expected ` +
          `activeVersion ${args.expectedVersion} but found ` +
          `${existing?.activeVersion ?? 0}. A producer ingest advanced the ` +
          `version while the backfill was paging; publishing now would roll ` +
          `the graph backwards to stale legacy data.`
      );
    }

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

    // WRITER-SIDE CAP (SWEEP-02 correctness guard). Before this existed,
    // GRAPH_BLOB_MAX_CHUNKS was enforced ONLY by the reader (`getProjectGraph`
    // takes CAP + 1 and throws above CAP), so the writer would happily store
    // 17+ chunks, flip `activeVersion` to them, and then delete the PRIOR
    // version's chunks. Every subsequent read would throw, with the only
    // rollback data already gone — turning an oversized ingest into a
    // user-visible /tool-galaxy outage, the exact failure this phase exists to
    // remove.
    //
    // Throwing HERE, before any insert, leaves the existing activeVersion and
    // its chunks untouched: the ingest fails and the previous graph keeps
    // serving. A failed ingest is strictly better than an unreadable one.
    //
    // If this ever trips legitimately, the fix is NOT to raise the constant —
    // it is derived from Convex's 16 MiB per-transaction scan ceiling
    // (512 KB worst-case per chunk x safety factor 2 = 8 MiB = 16 chunks), and
    // raising it past that reintroduces D-05's read-ceiling breach in a new
    // form. A larger graph needs a staged storage/read protocol instead.
    if (blobChunks.length > GRAPH_BLOB_MAX_CHUNKS) {
      throw new ConvexError(
        `graphSnapshots: refusing to publish ${args.snapshotId} — the ` +
          `serialized blob needs ${blobChunks.length} chunks, above ` +
          `GRAPH_BLOB_MAX_CHUNKS (${GRAPH_BLOB_MAX_CHUNKS}). The reader would ` +
          `reject it, so publishing would break /tool-galaxy. The previous ` +
          `version is untouched and still serving.`
      );
    }

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

    // ONE bounded, seq-ordered indexed read replaces the two unbounded
    // collect-all reads D-05 measured at 6,591 rows against the 4,096-read ceiling.
    // by_snapshot_version_seq's trailing key IS seq, so .order("asc") here is
    // seq-ascending — unlike convex/forge.ts's listJobLogs (by_host_job +
    // .order("asc")), which sorts by _creationTime and is a COUNTER-EXAMPLE
    // for this read, not a copy target: harmless for append-only log lines,
    // silent corruption for a JSON blob whose reassembly order must be exact.
    const rows = await ctx.db
      .query("graphSnapshotBlobChunks")
      .withIndex("by_snapshot_version_seq", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion)
      )
      .order("asc")
      .take(GRAPH_BLOB_MAX_CHUNKS + 1);

    // FIRST, before any zero-row handling (REVIEW FIX, cross-AI review
    // 2026-08-24, HIGH): a meta doc that CLAIMS chunks exist
    // (blobChunkCount > 0) but returns zero rows is corruption, not absence —
    // total chunk loss, the worst case. Throwing here instead of returning
    // null keeps that distinguishable from the genuinely-no-data case below.
    // The absence of the FIELD is what licenses the null path, not the
    // absence of rows.
    if (meta.blobChunkCount !== undefined && meta.blobChunkCount > 0 && rows.length === 0) {
      throw new ConvexError(
        `getProjectGraph: snapshotId "${snapshotId}" version ${meta.activeVersion} claims ` +
          `blobChunkCount ${meta.blobChunkCount} but zero chunk rows were found — total chunk loss.`
      );
    }

    // A version written before Phase 126's chunked writer, or one not yet
    // backfilled, has no blobChunkCount field at all — that is genuinely "no
    // data in this shape yet" and takes the SAME graceful-skip path a missing
    // meta doc takes. CodeVaultGraph already has a state for that; throwing
    // here would blank the page for a condition expected during rollout.
    if (rows.length === 0 && meta.blobChunkCount === undefined) {
      return null;
    }

    // The chunk read is bounded too (take(CAP + 1)) — replacing one unbounded
    // read with another would just move the cliff to a larger graph size.
    if (rows.length > GRAPH_BLOB_MAX_CHUNKS) {
      throw new ConvexError(
        `getProjectGraph: snapshotId "${snapshotId}" version ${meta.activeVersion} returned ` +
          `more than GRAPH_BLOB_MAX_CHUNKS (${GRAPH_BLOB_MAX_CHUNKS}) chunk rows.`
      );
    }

    // Missing-chunk detector: the meta doc's count is the independent source
    // of truth for how many chunks THIS version should have.
    if (meta.blobChunkCount !== undefined && rows.length !== meta.blobChunkCount) {
      throw new ConvexError(
        `getProjectGraph: snapshotId "${snapshotId}" version ${meta.activeVersion} expected ` +
          `${meta.blobChunkCount} chunk rows but found ${rows.length}.`
      );
    }

    // Belt AND braces on ordering: dense-from-0 check here, plus
    // joinGraphBlobChunks sorts on seq again below. A gap must name its
    // cause rather than surface as a JSON.parse throw or a plausible-looking
    // short graph.
    const sortedSeqs = rows.map((r) => r.seq).sort((a, b) => a - b);
    for (let i = 0; i < sortedSeqs.length; i++) {
      if (sortedSeqs[i] !== i) {
        throw new ConvexError(
          `getProjectGraph: snapshotId "${snapshotId}" version ${meta.activeVersion} is missing ` +
            `chunk seq ${i} (chunk sequence has a gap).`
        );
      }
    }

    // Typed explicitly, not left as `unknown[]` — ProjectGraphData
    // (src/hooks/useProjectGraph.ts) derives its type from getProjectGraph's
    // OWN inferred return type, so an untyped parsed blob here would widen
    // `nodes`/`links` to `unknown[]` for every downstream consumer
    // (CodeVaultGraph.tsx, ToolGalaxy.tsx — both out of scope to edit) even
    // though the runtime shape is unchanged from what the old two collect-all
    // reads returned.
    let parsed: {
      nodes: Array<{ id: string; label: string; type: string; community?: number; source: string }>;
      links: Array<{ source: string; target: string; relation: string }>;
    };
    try {
      parsed = JSON.parse(joinGraphBlobChunks(rows));
    } catch (err) {
      // Unwrapped, a JSON.parse throw is a plain Error and reaches the
      // client as redacted "Server Error" (CLAUDE.md), telling the operator
      // nothing. Re-throw as ConvexError so .data survives redaction.
      throw new ConvexError(
        `getProjectGraph: snapshotId "${snapshotId}" version ${meta.activeVersion} — failed to ` +
          `parse rejoined blob from ${rows.length} chunk(s): ` +
          `${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Passthrough — plan 126-02's writer serialized {nodes, links} in exactly
    // this return shape, so no re-mapping is needed here.
    return {
      snapshotId:      meta.snapshotId,
      sources:         meta.sources,
      nodeCount:       meta.nodeCount,
      linkCount:       meta.linkCount,
      storedNodeCount: meta.storedNodeCount,
      storedLinkCount: meta.storedLinkCount,
      generatedAt:     meta.generatedAt,
      nodes: parsed.nodes,
      links: parsed.links,
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

// ---------------------------------------------------------------------------
// One-shot backfill (Phase 126, SWEEP-02, D-06-REVISED) — internal-only.
//
// upsertGraphSnapshot retired the graphSnapshotNodes/graphSnapshotLinks
// writes as of this same phase, so the version active on the live
// deployment at deploy time was written by the OLD writer: it has entity
// rows but ZERO graphSnapshotBlobChunks rows, so getProjectGraph's new
// chunk-based read would return null for it (or throw, if a stale
// blobChunkCount ever claimed otherwise) until Ástríðr's nightly
// graph:snapshot cron next runs. This backfill rebuilds the active version
// through the REAL production writer (upsertGraphSnapshot) instead of
// re-implementing chunking, so it cannot drift from the writer and it
// exercises the exact code path plan 126-02 built.
// ---------------------------------------------------------------------------

/**
 * Page size for backfillGraphBlob's paginated reads of the legacy entity
 * tables. Clamped INSIDE getGraphEntityPage's handler, never trusted from the
 * caller — this is an internalQuery, but an internal function's argument can
 * still be widened by a future caller, and the 4,096-read ceiling does not
 * care who called it.
 */
const BACKFILL_PAGE_SIZE = 1000;

/**
 * Returns the meta doc for a snapshotId (default astridr-project-graph), or
 * null. One row read. internalQuery — used only by backfillGraphBlob, not a
 * public surface.
 */
export const getGraphMetaForBackfill = internalQuery({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = "astridr-project-graph" }): Promise<Doc<"graphSnapshots"> | null> => {
    return await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .unique();
  },
});

/**
 * One bounded page of legacy entity rows (graphSnapshotNodes or
 * graphSnapshotLinks) for a given (snapshotId, version), via
 * by_snapshot_version + .paginate(). Used only by backfillGraphBlob, which
 * pages through an entire version's rows a bounded slice at a time rather
 * than in one transaction — the same reason sweepGraphSnapshotVersions above
 * bounds its reads instead of .collect()-ing a whole version.
 */
export const getGraphEntityPage = internalQuery({
  args: {
    snapshotId: v.string(),
    version:    v.number(),
    kind:       v.union(v.literal("nodes"), v.literal("links")),
    cursor:     v.union(v.string(), v.null()),
    numItems:   v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<PaginationResult<Doc<"graphSnapshotNodes">> | PaginationResult<Doc<"graphSnapshotLinks">>> => {
    // Clamp here — never trust the caller's number, even our own action's.
    const numItems = Math.max(1, Math.min(args.numItems, BACKFILL_PAGE_SIZE));
    if (args.kind === "nodes") {
      return await ctx.db
        .query("graphSnapshotNodes")
        .withIndex("by_snapshot_version", (q) =>
          q.eq("snapshotId", args.snapshotId).eq("version", args.version)
        )
        .paginate({ numItems, cursor: args.cursor });
    }
    return await ctx.db
      .query("graphSnapshotLinks")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", args.snapshotId).eq("version", args.version)
      )
      .paginate({ numItems, cursor: args.cursor });
  },
});

/**
 * One-shot backfill: rebuilds the active version's chunked blob for a
 * snapshotId whose meta doc predates Phase 126's chunked writer.
 *
 * IDEMPOTENCE AND VERSION SAFETY — three mandatory guards (REVIEW FIX,
 * cross-AI review 2026-08-24, HIGH). An earlier draft's only no-op condition
 * was "zero entity rows AND zero chunk rows", which is unsafe now that
 * upsertGraphSnapshot has stopped writing entity rows: a re-run after a
 * successful backfill (or after the producer's next nightly ingest) would
 * find zero entity rows but non-zero chunks, the AND would be false, and the
 * action would proceed with EMPTY accumulators — publishing an EMPTY version
 * over the live graph with no error. Re-running a backfill after an
 * apparently-successful run is a likely operator action, not an exotic one.
 *
 *   1. alreadyChunked no-op — if the active meta already has blobChunkCount
 *      > 0, return without writing anything. This is what makes a re-run safe.
 *   2. noEntityRows no-op — never publish a graph with zero accumulated
 *      nodes, regardless of how that state was reached.
 *   3. versionAdvanced no-op — captures activeVersion as sourceVersion before
 *      paging, then re-reads the meta doc immediately before publishing and
 *      requires activeVersion === sourceVersion. If a producer advanced the
 *      pointer while this action was paging, publishing the stale entity
 *      data as a NEWER version would silently roll the graph backwards.
 *
 * Every path — success or no-op — returns a NAMED status, never a bare
 * success, so the operator running this from the CLI has a result to read
 * rather than inferring one from silence.
 *
 * Run once, after deploying:
 *   npx convex run graphSnapshots:backfillGraphBlob '{}' --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile
 *
 * FLAG, NOT A REDESIGN: the reconstructed upsertGraphSnapshot call carries
 * roughly 1 MB of node/link data in one mutation argument. If Convex's
 * argument-size limit rejects it on the live run, that is plan 126-09's
 * finding to make, not a reason to redesign this backfill here.
 *
 * Do NOT "fix" an argument-size failure by splitting the call per source.
 * upsertGraphSnapshot does not merge into an existing version — it computes
 * newVersion = activeVersion + 1, replaces `sources` wholesale with the
 * call's own argument, and flips activeVersion to the new version on every
 * call. N per-source calls would therefore create N versions, each holding
 * exactly ONE source, with the final active version containing only the
 * LAST source — the others silently gone, with no error and no truncation
 * flag. If the argument limit is genuinely hit, the only safe shape is a
 * staged protocol that writes every source under one target version and
 * flips activeVersion only after all of them land — that is a new plan, not
 * an improvisation here.
 */
// Explicit return type on backfillGraphBlob's handler (below), NOT tidiness:
// this internalAction calls other exports of THIS SAME FILE via
// internal.graphSnapshots.*, and TypeScript's generated `internal` namespace
// type is built from every export in the module, including this one. Without
// a declared return type, inferring backfillGraphBlob's type requires fully
// resolving `internal.graphSnapshots`, which requires backfillGraphBlob's own
// (not-yet-inferred) type — a circular inference (TS7022/TS7023). Declaring
// the type breaks the cycle; gatewayQuota.ts's pollAndStore avoids this only
// because it has no branch returning a value, so its inferred type is void.
type BackfillGraphBlobResult = {
  status: "noMetaDoc" | "alreadyChunked" | "noEntityRows" | "versionAdvanced" | "backfilled";
  snapshotId: string;
  sourceVersion: number | undefined;
  nodeCount: number;
  linkCount: number;
  pages: number;
  blobChunkCount: number;
};

export const backfillGraphBlob = internalAction({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = "astridr-project-graph" }): Promise<BackfillGraphBlobResult> => {
    const meta = await ctx.runQuery(internal.graphSnapshots.getGraphMetaForBackfill, { snapshotId });
    if (!meta) {
      return { status: "noMetaDoc", snapshotId, sourceVersion: undefined, nodeCount: 0, linkCount: 0, pages: 0, blobChunkCount: 0 };
    }

    // Guard 1: already chunked — no-op. Makes a re-run safe.
    if (meta.blobChunkCount !== undefined && meta.blobChunkCount > 0) {
      return {
        status: "alreadyChunked",
        snapshotId,
        sourceVersion: meta.activeVersion,
        nodeCount: meta.storedNodeCount,
        linkCount: meta.storedLinkCount,
        pages: 0,
        blobChunkCount: meta.blobChunkCount,
      };
    }

    const sourceVersion = meta.activeVersion;
    let pages = 0;

    // Page nodes to completion.
    const nodes: Array<{ id: string; label: string; type: string; community?: number; source: string }> = [];
    {
      let cursor: string | null = null;
      for (;;) {
        // Cast, not a narrowing bug worked around: getGraphEntityPage's
        // declared return type is the UNION of both tables' PaginationResult
        // (it must be, to break the circular-inference issue explained at
        // its declaration), but this call site's own kind: "nodes" literal
        // is what the handler branches on, so the actual runtime shape here
        // IS the nodes variant.
        const page = (await ctx.runQuery(
          internal.graphSnapshots.getGraphEntityPage,
          { snapshotId, version: sourceVersion, kind: "nodes", cursor, numItems: BACKFILL_PAGE_SIZE }
        )) as PaginationResult<Doc<"graphSnapshotNodes">>;
        pages++;
        for (const row of page.page) {
          nodes.push({
            id:        row.nodeId,
            label:     row.label,
            type:      row.type,
            community: row.community,
            source:    row.source,
          });
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
    }

    // Guard 2: never publish an empty graph.
    if (nodes.length === 0) {
      return { status: "noEntityRows", snapshotId, sourceVersion, nodeCount: 0, linkCount: 0, pages, blobChunkCount: 0 };
    }

    // Page links to completion.
    const links: Array<{ source: string; target: string; relation: string }> = [];
    {
      let cursor: string | null = null;
      for (;;) {
        // Same cast rationale as the nodes loop above — kind: "links" here
        // is what makes the runtime shape the links variant.
        const page = (await ctx.runQuery(internal.graphSnapshots.getGraphEntityPage, {
          snapshotId,
          version: sourceVersion,
          kind: "links",
          cursor,
          numItems: BACKFILL_PAGE_SIZE,
        })) as PaginationResult<Doc<"graphSnapshotLinks">>;
        pages++;
        for (const row of page.page) {
          links.push({ source: row.source, target: row.target, relation: row.relation });
        }
        if (page.isDone) break;
        cursor = page.continueCursor;
      }
    }

    // Guard 3: expected-version check, re-read immediately before publishing.
    const currentMeta = await ctx.runQuery(internal.graphSnapshots.getGraphMetaForBackfill, { snapshotId });
    if (!currentMeta || currentMeta.activeVersion !== sourceVersion) {
      return {
        status: "versionAdvanced",
        snapshotId,
        sourceVersion,
        nodeCount: nodes.length,
        linkCount: links.length,
        pages,
        blobChunkCount: 0,
      };
    }

    await ctx.runMutation(internal.graphSnapshots.upsertGraphSnapshot, {
      snapshotId,
      nodes,
      links,
      sources:     meta.sources,
      nodeCount:   meta.nodeCount,
      linkCount:   meta.linkCount,
      generatedAt: meta.generatedAt,
      receivedAt:  Date.now() / 1000, // epoch SECONDS — this repo's telemetry convention
      // The REAL version guard. The `runQuery` check above is a cheap early-out
      // only — it and this `runMutation` are separate transactions, so a
      // producer ingest can land between them. Passing the expected version
      // makes the mutation re-check it inside its own transaction and refuse
      // to publish if it moved.
      expectedVersion: sourceVersion,
    });

    // Re-read once more to report the blobChunkCount actually written.
    const finalMeta = await ctx.runQuery(internal.graphSnapshots.getGraphMetaForBackfill, { snapshotId });

    return {
      status: "backfilled",
      snapshotId,
      sourceVersion,
      nodeCount: nodes.length,
      linkCount: links.length,
      pages,
      blobChunkCount: finalMeta?.blobChunkCount ?? 0,
    };
  },
});
