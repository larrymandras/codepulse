import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Upsert a command execution lifecycle record.
 *
 * If a record with the given executionId exists, patch it with the
 * provided non-undefined fields. Otherwise, insert a new record.
 */
export const upsertLifecycle = mutation({
  args: {
    executionId: v.string(),
    toolName: v.optional(v.string()),
    origin: v.optional(v.string()),
    profileId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    status: v.string(),
    queuedAt: v.optional(v.float64()),
    startedAt: v.optional(v.float64()),
    completedAt: v.optional(v.float64()),
    durationMs: v.optional(v.float64()),
    errorMessage: v.optional(v.string()),
    contextSnapshot: v.optional(v.any()),
    parentExecutionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("commandExecutions")
      .withIndex("by_executionId", (q) => q.eq("executionId", args.executionId))
      .first();

    if (existing) {
      // Patch with provided fields — always update status
      const patch: Record<string, any> = { status: args.status };
      if (args.startedAt !== undefined) patch.startedAt = args.startedAt;
      if (args.completedAt !== undefined) patch.completedAt = args.completedAt;
      if (args.durationMs !== undefined) patch.durationMs = args.durationMs;
      if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
      if (args.contextSnapshot !== undefined) patch.contextSnapshot = args.contextSnapshot;
      await ctx.db.patch(existing._id, patch);
    } else {
      // Insert new record with defaults for required fields
      await ctx.db.insert("commandExecutions", {
        executionId: args.executionId,
        toolName: args.toolName ?? "unknown",
        origin: args.origin ?? "internal",
        profileId: args.profileId ?? "unknown",
        channelId: args.channelId,
        status: args.status,
        queuedAt: args.queuedAt ?? Date.now() / 1000,
        startedAt: args.startedAt,
        completedAt: args.completedAt,
        durationMs: args.durationMs,
        errorMessage: args.errorMessage,
        contextSnapshot: args.contextSnapshot,
        parentExecutionId: args.parentExecutionId,
      });
    }
  },
});

/**
 * List command executions with optional filtering.
 *
 * Filters applied client-side after fetching the most recent `limit` records
 * ordered by queuedAt descending.
 */
export const listExecutions = query({
  args: {
    status: v.optional(v.string()),
    profileId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    origin: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 200;
    const rows = await ctx.db
      .query("commandExecutions")
      .withIndex("by_queuedAt")
      .order("desc")
      .take(limit);

    return rows.filter((r) => {
      if (args.status !== undefined && r.status !== args.status) return false;
      if (args.profileId !== undefined && r.profileId !== args.profileId) return false;
      if (args.channelId !== undefined && r.channelId !== args.channelId) return false;
      if (args.origin !== undefined && r.origin !== args.origin) return false;
      return true;
    });
  },
});

/**
 * Aggregate summary stats across the most recent 500 executions.
 *
 * Returns: total count, running count, failed count, average duration (ms).
 */
export const summaryStats = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("commandExecutions")
      .withIndex("by_queuedAt")
      .order("desc")
      .take(500);

    const total = rows.length;
    const running = rows.filter((r) => r.status === "running").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const durationsWithValues = rows
      .map((r) => r.durationMs)
      .filter((d): d is number => d !== undefined && d !== null);
    const avgDuration =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((sum, d) => sum + d, 0) / durationsWithValues.length
        : null;

    return { total, running, failed, avgDuration };
  },
});
