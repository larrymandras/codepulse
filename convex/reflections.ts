import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordResult = mutation({
  args: {
    agentId: v.string(),
    eventsAnalyzed: v.float64(),
    memoriesExtracted: v.float64(),
    categories: v.any(),
    avgConfidence: v.float64(),
    reflectionDurationMs: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("reflectionResults", args);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("reflectionResults")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    if (all.length === 0) {
      return {
        totalReflections: 0,
        totalMemoriesExtracted: 0,
        avgConfidence: 0,
        lastReflectionAt: null,
        categoryBreakdown: {} as Record<string, number>,
      };
    }

    let totalExtracted = 0;
    let totalConfidence = 0;
    const categoryBreakdown: Record<string, number> = {};

    for (const r of all) {
      totalExtracted += r.memoriesExtracted;
      totalConfidence += r.avgConfidence;
      if (r.categories && typeof r.categories === "object") {
        for (const [cat, count] of Object.entries(r.categories)) {
          categoryBreakdown[cat] = (categoryBreakdown[cat] ?? 0) + (count as number);
        }
      }
    }

    return {
      totalReflections: all.length,
      totalMemoriesExtracted: totalExtracted,
      avgConfidence: Math.round((totalConfidence / all.length) * 1000) / 1000,
      lastReflectionAt: all[0]?.timestamp ?? null,
      categoryBreakdown,
    };
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reflectionResults")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const byAgent = query({
  args: { agentId: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reflectionResults")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});
