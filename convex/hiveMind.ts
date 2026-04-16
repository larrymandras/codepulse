import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Hive Mind — cross-agent activity log (Phase 67).
 * Records tool executions and delegations from all agents.
 */

export const recordEntry = mutation({
  args: {
    agentType: v.string(),
    instanceId: v.string(),
    profileId: v.string(),
    actionType: v.string(),
    toolName: v.optional(v.string()),
    target: v.optional(v.string()),
    resultSummary: v.optional(v.string()),
    success: v.boolean(),
    durationMs: v.optional(v.float64()),
    correlationId: v.optional(v.string()),
    sourceAgent: v.optional(v.string()),
    targetAgent: v.optional(v.string()),
    taskDescription: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("hiveMindEntries", args);
  },
});

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("hiveMindEntries")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const byAgent = query({
  args: {
    agentType: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("hiveMindEntries")
      .withIndex("by_agentType", (q) => q.eq("agentType", args.agentType))
      .order("desc")
      .take(limit);
  },
});

export const byCorrelationId = query({
  args: {
    correlationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hiveMindEntries")
      .withIndex("by_correlationId", (q) => q.eq("correlationId", args.correlationId))
      .order("desc")
      .take(100);
  },
});
