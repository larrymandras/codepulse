import { query } from "./_generated/server";
import { v } from "convex/values";

export const listActiveCalls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("voiceCalls")
      .withIndex("by_status", (q) => q.eq("status", "live"))
      .order("desc")
      .collect();
  },
});

export const listRecentCalls = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db.query("voiceCalls")
      .withIndex("by_status", (q) => q.eq("status", "ended"))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const getCallTranscripts = query({
  args: { callId: v.string() },
  handler: async (ctx, { callId }) => {
    return await ctx.db.query("callTranscripts")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .order("asc")
      .take(1000);  // T-72-03: DoS protection limit on unbounded transcript queries
  },
});
