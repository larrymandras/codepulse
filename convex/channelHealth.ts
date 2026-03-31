import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    channelId: v.string(),
    status: v.string(),
    messagesLastHour: v.float64(),
    avgResponseMs: v.float64(),
    errorCount: v.float64(),
    lastMessageAt: v.float64(),
    details: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channelHealth")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        messagesLastHour: args.messagesLastHour,
        avgResponseMs: args.avgResponseMs,
        errorCount: args.errorCount,
        lastMessageAt: args.lastMessageAt,
        details: args.details,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("channelHealth", args);
    }
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const channels = ["telegram", "slack", "web", "email", "voice"];
    const results: Record<string, any> = {};

    for (const ch of channels) {
      const record = await ctx.db
        .query("channelHealth")
        .withIndex("by_channel", (q) => q.eq("channelId", ch))
        .order("desc")
        .first();
      if (record) {
        results[ch] = record;
      }
    }

    return results;
  },
});
