import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    severity: v.string(),
    source: v.string(),
    message: v.string(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("alerts", {
      severity: args.severity,
      source: args.source,
      message: args.message,
      details: args.details,
      acknowledged: false,
      createdAt: Date.now() / 1000,
    });
  },
});

export const acknowledge = mutation({
  args: {
    id: v.id("alerts"),
    acknowledgedBy: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      acknowledged: true,
      acknowledgedBy: args.acknowledgedBy,
      acknowledgedAt: Date.now() / 1000,
    });
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_acknowledged", (q) => q.eq("acknowledged", false))
      .order("desc")
      .take(50);
  },
});
