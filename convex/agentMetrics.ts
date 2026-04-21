import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insertMetric = mutation({
  args: {
    agentId: v.string(),
    timestamp: v.float64(),
    responseTimeMs: v.optional(v.float64()),
    taskOutcome: v.string(),
    inputTokens: v.float64(),
    outputTokens: v.float64(),
    modelUsed: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentMetrics", {
      agentId: args.agentId,
      timestamp: args.timestamp,
      responseTimeMs: args.responseTimeMs,
      taskOutcome: args.taskOutcome,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      modelUsed: args.modelUsed,
    });
  },
});

export const forAgent = query({
  args: {
    agentId: v.string(),
    windowStart: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent_timestamp", (q) =>
        q.eq("agentId", args.agentId).gte("timestamp", args.windowStart)
      )
      .order("asc")
      .collect();
  },
});
