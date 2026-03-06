import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    eventType: v.string(),
    severity: v.string(),
    source: v.string(),
    description: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("securityEvents", {
      eventType: args.eventType,
      severity: args.severity,
      source: args.source,
      description: args.description,
      details: args.details,
      mitigated: false,
      timestamp: Date.now() / 1000,
    });
  },
});

export const recentEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const severityCounts = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("securityEvents").collect();
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const e of all) {
      counts[e.severity] = (counts[e.severity] ?? 0) + 1;
    }
    return counts;
  },
});

export const recentByType = query({
  args: { eventType: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_type", (q) => q.eq("eventType", args.eventType))
      .order("desc")
      .take(args.limit ?? 20);
  },
});
