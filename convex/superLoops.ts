import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordIteration = mutation({
  args: {
    loopId: v.string(),
    profileId: v.string(),
    cycleNum: v.float64(),
    goalComplete: v.boolean(),
    confidence: v.float64(),
    outcome: v.optional(v.string()),
    status: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("superLoopIterations", args);
  },
});

export const recordComplete = mutation({
  args: {
    loopId: v.string(),
    profileId: v.string(),
    totalCycles: v.float64(),
    goalAchieved: v.boolean(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query("superLoopIterations")
      .withIndex("by_loopId", (q) => q.eq("loopId", args.loopId))
      .order("desc")
      .first();
    if (latest) {
      await ctx.db.patch(latest._id, {
        status: args.goalAchieved ? "completed" : "max_reached",
        totalCycles: args.totalCycles,
      });
    }
  },
});

export const recentByProfile = query({
  args: {
    profileId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("superLoopIterations")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const recentAll = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("superLoopIterations")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
