/**
 * Graph Snapshot Receiver — Phase 83, GH-01.
 *
 * Persists Ástríðr's nightly graphify + Obsidian vault code/dependency graph
 * snapshots instead of dropping them. Stores graph data in three tables:
 *   - graphSnapshots     — meta doc (1 row per snapshotId, activeVersion pointer)
 *   - graphSnapshotNodes — entity rows keyed by (snapshotId, version)
 *   - graphSnapshotLinks — entity rows keyed by (snapshotId, version)
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
// Write mutations (internalMutation — httpAction + cron callers only)
// ---------------------------------------------------------------------------

/**
 * Versioned-swap upsert for a graph snapshot (D-02).
 *
 * Algorithm:
 *   1. Read existing meta doc to determine currentVersion (0 if first ingest).
 *   2. newVersion = currentVersion + 1.
 *   3. Build Set<string> of incoming node ids (dangling-link guard, D-05).
 *   4. Filter links to those with both endpoints in the node set.
 *   5. Insert graphSnapshotNodes rows for newVersion (chunked, defensive).
 *   6. Insert graphSnapshotLinks rows for newVersion (chunked, defensive).
 *   7. LAST: patch-or-insert graphSnapshots meta doc with activeVersion = newVersion.
 *
 * Step 7 is last: readers continue to see the complete previous version
 * until the pointer flips (Pitfall 2 guard).
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

    // 5. Insert graphSnapshotNodes rows in chunks of 1,000 (defensive headroom).
    const CHUNK = 1000;
    for (let i = 0; i < args.nodes.length; i += CHUNK) {
      const batch = args.nodes.slice(i, i + CHUNK);
      for (const node of batch) {
        // Coerce community null/undefined → undefined for the optional field.
        const community = node.community === null || node.community === undefined
          ? undefined
          : node.community;
        await ctx.db.insert("graphSnapshotNodes", {
          snapshotId: args.snapshotId,
          version:    newVersion,
          nodeId:     node.id,
          label:      node.label,
          type:       node.type,
          community,
          source:     node.source,
        });
      }
    }

    // 6. Insert graphSnapshotLinks rows in chunks of 1,000.
    for (let i = 0; i < filteredLinks.length; i += CHUNK) {
      const batch = filteredLinks.slice(i, i + CHUNK);
      for (const link of batch) {
        await ctx.db.insert("graphSnapshotLinks", {
          snapshotId: args.snapshotId,
          version:    newVersion,
          source:     link.source,
          target:     link.target,
          relation:   link.relation,
        });
      }
    }

    // 7. LAST: patch-or-insert meta doc with new activeVersion pointer.
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
    };
    if (existing) {
      await ctx.db.patch(existing._id, metaDoc);
    } else {
      await ctx.db.insert("graphSnapshots", metaDoc);
    }
  },
});

/**
 * Retention sweep — keeps the last GRAPH_SNAPSHOT_KEEP_VERSIONS versions per
 * snapshotId and deletes at most one stale version's rows per invocation.
 *
 * One old version ≈ 13,500 rows — within the 16,000-doc write limit.
 * Two old versions ≈ 27,000 rows — over the limit (Pitfall 5 / Anti-pattern).
 * Rely on subsequent nightly runs to clear any remaining backlog (Research A2).
 *
 * Scope index collects to identified candidate versions (never full-table
 * collect) to stay under the 32,000-doc query scan limit (Pitfall 5).
 */
export const sweepGraphSnapshotVersions = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Read all meta docs (few rows — at most one per distinct snapshotId).
    const allMeta = await ctx.db.query("graphSnapshots").collect();

    for (const meta of allMeta) {
      // Derive distinct stored versions from the graphSnapshotNodes index.
      // We collect only for this snapshotId so the scan is bounded.
      const nodeRows = await ctx.db
        .query("graphSnapshotNodes")
        .withIndex("by_snapshot_version", (q) =>
          q.eq("snapshotId", meta.snapshotId)
        )
        .collect();

      const versionSet = new Set<number>(nodeRows.map((r) => r.version));
      const allVersions = Array.from(versionSet);

      const toDelete = selectVersionDeletes(allVersions, GRAPH_SNAPSHOT_KEEP_VERSIONS);
      if (toDelete.length === 0) continue;

      // Process AT MOST ONE stale version per invocation (mutation write limit).
      const versionToDelete = toDelete[0];
      let deleteCount = 0;
      const MAX_DELETES_PER_INVOCATION = 15000; // safety guard under 16,000 limit

      // Delete graphSnapshotNodes for this version.
      const staleNodes = await ctx.db
        .query("graphSnapshotNodes")
        .withIndex("by_snapshot_version", (q) =>
          q.eq("snapshotId", meta.snapshotId).eq("version", versionToDelete)
        )
        .collect();

      for (const node of staleNodes) {
        if (deleteCount >= MAX_DELETES_PER_INVOCATION) break;
        await ctx.db.delete(node._id);
        deleteCount++;
      }

      // Delete graphSnapshotLinks for this version (if doc-count guard allows).
      const staleLinks = await ctx.db
        .query("graphSnapshotLinks")
        .withIndex("by_snapshot_version", (q) =>
          q.eq("snapshotId", meta.snapshotId).eq("version", versionToDelete)
        )
        .collect();

      for (const link of staleLinks) {
        if (deleteCount >= MAX_DELETES_PER_INVOCATION) break;
        await ctx.db.delete(link._id);
        deleteCount++;
      }
    }
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
 * Lists all snapshot metadata rows (one per snapshotId).
 * Today at most one row; keyed for future multi-snapshotId support.
 */
export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("graphSnapshots").collect();
    return rows.map((r) => ({
      snapshotId:  r.snapshotId,
      nodeCount:   r.nodeCount,
      linkCount:   r.linkCount,
      generatedAt: r.generatedAt,
      updatedAt:   r.updatedAt,
    }));
  },
});
