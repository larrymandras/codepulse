import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const insertSnapshot = mutation({
  args: {
    metricName: v.string(),
    value: v.float64(),
    tags: v.optional(v.any()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("metricSnapshots", args);
  },
});

export const dashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const tools = await ctx.db.query("discoveredTools").collect();

    const uniqueToolNames = new Set(tools.map((t) => t.name));

    return {
      totalEvents: events.length,
      activeSessions: sessions.length,
      uniqueTools: uniqueToolNames.size,
    };
  },
});
