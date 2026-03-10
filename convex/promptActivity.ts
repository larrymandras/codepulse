import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    promptLength: v.float64(),
    promptId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("promptSubmissions", args);
  },
});

export const recentPrompts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("promptSubmissions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const promptVolume = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 86400;
    const prompts = await ctx.db
      .query("promptSubmissions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recent = prompts.filter((p) => p.timestamp >= cutoff);

    // Group by hour
    const byHour: Record<string, number> = {};
    for (const p of recent) {
      const hour = Math.floor(p.timestamp / 3600) * 3600;
      const key = new Date(hour * 1000).toISOString().slice(0, 13);
      byHour[key] = (byHour[key] ?? 0) + 1;
    }

    return Object.entries(byHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  },
});
