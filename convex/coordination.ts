import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    fromAgent: v.string(),
    toAgent: v.string(),
    eventType: v.string(),
    payload: v.optional(v.any()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentCoordination", {
      fromAgent: args.fromAgent,
      toAgent: args.toAgent,
      eventType: args.eventType,
      payload: args.payload,
      status: args.status,
      timestamp: Date.now() / 1000,
    });
  },
});

export const activeHandoffs = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentCoordination")
      .withIndex("by_type", (q) => q.eq("eventType", "handoff"))
      .order("desc")
      .take(20);
  },
});

export const recentAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentCoordination")
      .order("desc")
      .take(100);
  },
});
