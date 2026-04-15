import { query } from "./_generated/server";
import { v } from "convex/values";

export const recentCycles = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("dreamingCycles")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const recentFacts = query({
  args: {
    limit: v.optional(v.float64()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;

    if (args.category) {
      return await ctx.db
        .query("dreamingFacts")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("dreamingFacts")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const costSummary = query({
  args: {},
  handler: async (ctx) => {
    const cycles = await ctx.db
      .query("dreamingCycles")
      .withIndex("by_timestamp")
      .order("desc")
      .take(30);

    let totalCostUsd = 0;
    let cyclesWithCost = 0;

    for (const cycle of cycles) {
      if (cycle.costUsd !== undefined) {
        totalCostUsd += cycle.costUsd;
        cyclesWithCost++;
      }
    }

    return {
      totalCostUsd,
      cyclesWithCost,
      totalCycles: cycles.length,
    };
  },
});
