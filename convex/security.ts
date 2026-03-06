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
