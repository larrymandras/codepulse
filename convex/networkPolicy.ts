import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertRule = mutation({
  args: {
    host: v.optional(v.string()),
    cidr: v.optional(v.string()),
    port: v.optional(v.float64()),
    provider: v.optional(v.string()),
    source: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = args.host
      ? await ctx.db
          .query("networkPolicyRules")
          .withIndex("by_host", (q) => q.eq("host", args.host!))
          .first()
      : null;

    if (existing) {
      await ctx.db.patch(existing._id, {
        cidr: args.cidr,
        port: args.port,
        provider: args.provider,
        source: args.source,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("networkPolicyRules", {
        host: args.host,
        cidr: args.cidr,
        port: args.port,
        provider: args.provider,
        source: args.source,
        timestamp: args.timestamp,
      });
    }
  },
});

export const recordEgressSummary = mutation({
  args: {
    hosts: v.any(),
    blockedCount: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("networkEgressSummary", args);
  },
});

export const listRules = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("networkPolicyRules")
      .withIndex("by_host")
      .order("asc")
      .collect();
  },
});

export const recentSummaries = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("networkEgressSummary")
      .withIndex("by_timestamp")
      .order("desc")
      .take(30);
  },
});
