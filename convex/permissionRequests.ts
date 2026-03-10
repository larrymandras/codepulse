import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    toolName: v.string(),
    decision: v.string(),
    decisionSource: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("permissionRequests", args);
  },
});

export const recent = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("permissionRequests")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});
