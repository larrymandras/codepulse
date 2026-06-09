import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// GRAPH SNAPSHOTS — graphify-out + Obsidian vault graphs (Phase 76, HUB-01)
// ============================================================
//
// Fed by the `graph_snapshot` runtime telemetry event emitted by Ástríðr's
// Phase 137 cron (`graph:snapshot`). Idempotent by `snapshotId`: the nodes/links
// arrays are REPLACED wholesale on each event, so a snapshot row always reflects
// its latest state and we never accumulate stale duplicates.
//
// Each node carries a `source` namespace ("graphify:<repo>:" or "vault:") so the
// Graph Hub can filter/toggle between code-repo graphs and the vault wikilink
// graph from a single stored snapshot.

const nodeValidator = v.object({
  id: v.string(),
  label: v.string(),
  type: v.string(),
  community: v.optional(v.float64()),
  source: v.string(),
});

const linkValidator = v.object({
  source: v.string(),
  target: v.string(),
  relation: v.string(),
});

export const upsertSnapshot = mutation({
  args: {
    snapshotId: v.string(),
    nodes: v.array(nodeValidator),
    links: v.array(linkValidator),
    snapshotTimestamp: v.float64(),
    updatedAt: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .first();

    const doc = {
      snapshotId: args.snapshotId,
      nodes: args.nodes,
      links: args.links,
      snapshotTimestamp: args.snapshotTimestamp,
      updatedAt: args.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("graphSnapshots", doc);
    }
  },
});

/** All stored graph snapshots, newest-updated first. */
export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("graphSnapshots").collect();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** A single snapshot by id, or null. */
export const getSnapshot = query({
  args: { snapshotId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("graphSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", args.snapshotId))
      .first();
  },
});
