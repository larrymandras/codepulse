import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ALL_PROVIDERS } from "./lib/providers";

export const upsert = mutation({
  args: {
    providerName: v.string(),
    state: v.string(),
    latencyEmaMs: v.float64(),
    successRate: v.float64(),
    consecutiveFailures: v.float64(),
    lastSuccessAt: v.float64(),
    timestamp: v.float64(),
    authenticated: v.optional(v.boolean()),
    billingType: v.optional(v.string()),
    quotaRemaining: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("providerName", args.providerName))
      .order("desc")
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        state: args.state,
        latencyEmaMs: args.latencyEmaMs,
        successRate: args.successRate,
        consecutiveFailures: args.consecutiveFailures,
        lastSuccessAt: args.lastSuccessAt,
        timestamp: args.timestamp,
        authenticated: args.authenticated,
        billingType: args.billingType,
        quotaRemaining: args.quotaRemaining,
      });
    } else {
      await ctx.db.insert("providerHealth", args);
    }
  },
});

export const recordStateChange = mutation({
  args: {
    providerName: v.string(),
    state: v.string(),
    latencyEmaMs: v.float64(),
    successRate: v.float64(),
    consecutiveFailures: v.float64(),
    lastSuccessAt: v.float64(),
    timestamp: v.float64(),
    authenticated: v.optional(v.boolean()),
    billingType: v.optional(v.string()),
    quotaRemaining: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("providerHealth", args);
  },
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const providers = ALL_PROVIDERS;
    const results: Record<string, any> = {};

    for (const p of providers) {
      const record = await ctx.db
        .query("providerHealth")
        .withIndex("by_provider", (q) => q.eq("providerName", p))
        .order("desc")
        .first();
      if (record) {
        results[p] = record;
      }
    }

    return results;
  },
});

export const recentByProvider = query({
  args: {
    providerName: v.string(),
    minutes: v.float64(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - args.minutes * 60;
    const records = await ctx.db
      .query("providerHealth")
      .withIndex("by_provider", (q) => q.eq("providerName", args.providerName))
      .order("desc")
      .take(100);
    return records.filter((r) => r.timestamp >= cutoff);
  },
});
