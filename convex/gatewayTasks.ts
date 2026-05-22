import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

// ============================================================
// GATEWAY TASKS — Phase 68 observability data layer
// ============================================================

/**
 * computeProviderStats — Pure helper for providerStats query.
 * Exported for unit testing in gatewayTasks.test.ts.
 */
export function computeProviderStats(
  rows: Array<{
    provider: string;
    status: string;
    durationSeconds?: number;
  }>
): Array<{
  provider: string;
  taskCount: number;
  successRate: number;
  avgDurationSeconds: number;
}> {
  const byProvider = new Map<
    string,
    { taskCount: number; completedCount: number; totalDuration: number }
  >();

  for (const row of rows) {
    const current = byProvider.get(row.provider) ?? {
      taskCount: 0,
      completedCount: 0,
      totalDuration: 0,
    };
    current.taskCount += 1;
    if (row.status === "completed") {
      current.completedCount += 1;
      current.totalDuration += row.durationSeconds ?? 0;
    }
    byProvider.set(row.provider, current);
  }

  const result: Array<{
    provider: string;
    taskCount: number;
    successRate: number;
    avgDurationSeconds: number;
  }> = [];

  for (const [provider, stats] of byProvider.entries()) {
    if (stats.taskCount === 0) continue;
    result.push({
      provider,
      taskCount: stats.taskCount,
      successRate:
        stats.taskCount > 0
          ? (stats.completedCount / stats.taskCount) * 100
          : 0,
      avgDurationSeconds:
        stats.completedCount > 0
          ? stats.totalDuration / stats.completedCount
          : 0,
    });
  }

  return result;
}

/**
 * upsert — Insert a new task row or merge status/duration/error for an
 * existing row with the same taskId (started → completed lifecycle).
 */
export const upsert = mutation({
  args: {
    taskId: v.string(),
    sessionId: v.optional(v.string()),
    provider: v.string(),
    billingType: v.optional(v.string()),
    status: v.string(),
    durationSeconds: v.optional(v.float64()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gatewayTasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        durationSeconds: args.durationSeconds,
        error: args.error,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("gatewayTasks", {
        taskId: args.taskId,
        sessionId: args.sessionId,
        provider: args.provider,
        billingType: args.billingType,
        status: args.status,
        durationSeconds: args.durationSeconds,
        error: args.error,
        timestamp: args.timestamp,
      });
    }
  },
});

/**
 * listPaginated — Paginated list of gateway tasks ordered by most recent first.
 * Optional provider/status filters narrow results.
 */
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    provider: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gatewayTasks")
      .withIndex("by_timestamp")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * providerStats — Aggregate success rate and average duration per provider
 * over the given lookback window (default: last 24 hours).
 */
export const providerStats = query({
  args: {
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - (args.lookbackHours ?? 24) * 3600;

    const rows = await ctx.db
      .query("gatewayTasks")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .collect();

    return computeProviderStats(rows);
  },
});
