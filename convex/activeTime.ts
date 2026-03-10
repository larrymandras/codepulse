import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    type: v.string(),
    durationSeconds: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activeTime", args);
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("activeTime")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});
