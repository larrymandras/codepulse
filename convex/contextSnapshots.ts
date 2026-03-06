import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sessionId: v.string(),
    agentId: v.optional(v.string()),
    contextTokens: v.optional(v.float64()),
    summaryTokens: v.optional(v.float64()),
    statusLine: v.optional(v.string()),
    snapshot: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("contextSnapshots", {
      sessionId: args.sessionId,
      agentId: args.agentId,
      contextTokens: args.contextTokens,
      summaryTokens: args.summaryTokens,
      statusLine: args.statusLine,
      snapshot: args.snapshot,
      timestamp: args.timestamp,
    });
  },
});

export const historyBySession = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("contextSnapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

export const latestBySession = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("contextSnapshots")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();
  },
});
