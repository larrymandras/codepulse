import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    executionId: v.string(),
    mode: v.string(),
    roundsDepth: v.float64(),
    fillerCount: v.optional(v.float64()),
    stalledAt: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("executionModes", args);
  },
});

export const byExecutionId = query({
  args: {
    executionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("executionModes")
      .withIndex("by_executionId", (q) => q.eq("executionId", args.executionId))
      .order("desc")
      .take(1);
  },
});

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("executionModes")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
