import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    agentId: v.string(),
    state: v.string(),
    currentTask: v.optional(v.string()),
    errorCount: v.optional(v.float64()),
    profileId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentStatusEvents", args);
  },
});

export const recentByAgent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentStatusEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

export const latestForAgent = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentStatusEvents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .first();
  },
});
