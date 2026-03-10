import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    type: v.string(),
    linesAdded: v.optional(v.float64()),
    linesRemoved: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("gitActivity", args);
  },
});

export const recentActivity = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("gitActivity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const summary = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 7 * 86400;
    const events = await ctx.db
      .query("gitActivity")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recent = events.filter((e) => e.timestamp >= cutoff);

    let commits = 0;
    let pullRequests = 0;
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const e of recent) {
      if (e.type === "commit") commits++;
      if (e.type === "pull_request") pullRequests++;
      linesAdded += e.linesAdded ?? 0;
      linesRemoved += e.linesRemoved ?? 0;
    }

    return { commits, pullRequests, linesAdded, linesRemoved };
  },
});
