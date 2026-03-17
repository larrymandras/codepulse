import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordStats = mutation({
  args: {
    agentId: v.string(),
    contentLength: v.float64(),
    l0Length: v.float64(),
    l1Length: v.float64(),
    tokenSavingsPercent: v.float64(),
    hadLlmSummarizer: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("memoryTierStats", args);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("memoryTierStats")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    if (all.length === 0) {
      return {
        totalMemories: 0,
        avgTokenSavings: 0,
        llmSummarized: 0,
        heuristicSummarized: 0,
        byAgent: {} as Record<string, number>,
      };
    }

    let totalSavings = 0;
    let llmCount = 0;
    const byAgent: Record<string, number> = {};

    for (const stat of all) {
      totalSavings += stat.tokenSavingsPercent;
      if (stat.hadLlmSummarizer) llmCount++;
      byAgent[stat.agentId] = (byAgent[stat.agentId] ?? 0) + 1;
    }

    return {
      totalMemories: all.length,
      avgTokenSavings: Math.round((totalSavings / all.length) * 10) / 10,
      llmSummarized: llmCount,
      heuristicSummarized: all.length - llmCount,
      byAgent,
    };
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memoryTierStats")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
