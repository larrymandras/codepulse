import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.optional(v.string()),
    profileId: v.optional(v.string()),
    totalTokens: v.float64(),
    tiersIncluded: v.array(v.string()),
    soul: v.float64(),
    behavior: v.float64(),
    userProfile: v.float64(),
    briefingPrefs: v.float64(),
    memoryContext: v.float64(),
    profileContext: v.float64(),
    googleWorkspace: v.float64(),
    toolNames: v.float64(),
    agentRoster: v.float64(),
    skillInstructions: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("promptAssembly", args);
  },
});

export const getRecent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("promptAssembly")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

export const getTrend = query({
  args: {
    days: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const cutoff = Date.now() / 1000 - days * 86400;
    return await ctx.db
      .query("promptAssembly")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .order("asc")
      .collect();
  },
});
