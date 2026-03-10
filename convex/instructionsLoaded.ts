import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    filePath: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("instructionsLoaded", args);
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("instructionsLoaded")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});
