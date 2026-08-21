import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const recordStatus = mutation({
  args: {
    containerId: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
    status: v.string(),
    health: v.optional(v.string()),
    cpuPercent: v.optional(v.float64()),
    memoryMb: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("dockerContainers")
      .withIndex("by_containerId", (q) =>
        q.eq("containerId", args.containerId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        image: args.image,
        status: args.status,
        health: args.health,
        cpuPercent: args.cpuPercent,
        memoryMb: args.memoryMb,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("dockerContainers", {
        containerId: args.containerId,
        name: args.name,
        image: args.image,
        status: args.status,
        health: args.health,
        cpuPercent: args.cpuPercent,
        memoryMb: args.memoryMb,
        updatedAt: now,
      });
    }
  },
});

export const removeByContainerId = mutation({
  args: { containerId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("dockerContainers")
      .withIndex("by_containerId", (q) => q.eq("containerId", args.containerId))
      .first();
    if (doc) await ctx.db.delete(doc._id);
  },
});

export const currentStatus = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("dockerContainers")
      .order("desc")
      .take(20);
  },
});

export const reconcile = mutation({
  args: {
    activeContainerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("dockerContainers")
      .order("desc")
      .take(50);

    const activeSet = new Set(args.activeContainerIds);
    let removed = 0;

    for (const c of all) {
      if (!activeSet.has(c.containerId)) {
        await ctx.db.delete(c._id);
        removed++;
      }
    }

    return { removed };
  },
});

/**
 * Ceiling on rows pollHealth pulls in one transaction.
 *
 * This bounds the write set, not the read set — the by_updatedAt range already
 * keeps the read set to genuinely-stale rows (normally zero). It exists so a
 * large backlog of long-dead containers can never build a single oversized
 * transaction. Truncation is reported in the return value rather than silently
 * swallowed; a persistently `truncated: true` result means the backlog is
 * growing faster than one run can drain it.
 */
export const POLL_HEALTH_MAX_ROWS = 200;

export const pollHealth = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const staleThreshold = now - 300; // 5 minutes
    const removeThreshold = now - 86400; // 24 hours

    // Read ONLY rows already past the stale threshold, via the by_updatedAt
    // index range.
    //
    // This previously did `.order("desc").take(50)`, an unindexed scan that
    // pulled the ENTIRE table into this mutation's OCC read set — including
    // every freshly-reporting container, i.e. exactly the rows `recordStatus`
    // rewrites on each poll cycle. A single concurrent status write therefore
    // invalidated the whole scan, the mutation failed "on every subsequent
    // retry", and the failed cron then retried on its own backoff — the
    // ingest-starving retry storm documented in convex/crons.ts (2026-07-14).
    // Measured live 2026-08-21: 37 cron System errors + 85 OCC conflicts in 90
    // minutes against a 19-row table.
    //
    // removeThreshold (24h ago) is strictly earlier than staleThreshold (5min
    // ago), so this single range covers both branches below.
    const containers = await ctx.db
      .query("dockerContainers")
      .withIndex("by_updatedAt", (q) => q.lt("updatedAt", staleThreshold))
      .take(POLL_HEALTH_MAX_ROWS);

    let staleCount = 0;
    let removedCount = 0;

    for (const c of containers) {
      if (c.updatedAt < staleThreshold && c.status === "running") {
        await ctx.db.patch(c._id, {
          status: "unknown",
          health: "stale",
          updatedAt: now,
        });
        staleCount++;
      } else if (
        c.updatedAt < removeThreshold &&
        (c.status === "unknown" || c.health === "stale")
      ) {
        await ctx.db.delete(c._id);
        removedCount++;
      }
    }

    return {
      status: "ok",
      checked: containers.length,
      markedStale: staleCount,
      removed: removedCount,
      truncated: containers.length === POLL_HEALTH_MAX_ROWS,
    };
  },
});
