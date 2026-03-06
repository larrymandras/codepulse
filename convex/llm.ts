import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      latencyMs: args.latencyMs,
      cost: args.cost,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
    });
  },
});

export const recentCalls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const costByProvider = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("llmMetrics").collect();
    const grouped: Record<string, number> = {};
    for (const record of all) {
      grouped[record.provider] =
        (grouped[record.provider] ?? 0) + (record.cost ?? 0);
    }
    return grouped;
  },
});
