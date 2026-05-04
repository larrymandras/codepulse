import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    provider: v.string(),
    eventType: v.string(),
    httpStatus: v.optional(v.float64()),
    retryAfter: v.optional(v.float64()),
    remainingQuota: v.optional(v.float64()),
    currentRpm: v.optional(v.float64()),
    limitRpm: v.optional(v.float64()),
    percentUsed: v.optional(v.float64()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("rateLimitEvents", args);
  },
});

/**
 * Fetch recent rate limit events by provider within a time window.
 * Used by RateLimitBadge to determine OK/warning/hit state (5-min decay per D-16).
 */
export const recentByProvider = query({
  args: {
    providerName: v.string(),
    windowSeconds: v.float64(),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - args.windowSeconds;
    const rows = await ctx.db
      .query("rateLimitEvents")
      .withIndex("by_provider", (q) =>
        q.eq("provider", args.providerName).gte("timestamp", cutoff)
      )
      .order("desc")
      .collect();
    return rows;
  },
});
