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
