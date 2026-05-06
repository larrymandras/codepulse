import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    wakeupId: v.string(),
    profileId: v.string(),
    channelId: v.string(),
    reason: v.string(),
    status: v.string(),
    fireAt: v.float64(),
    firedAt: v.optional(v.float64()),
    error: v.optional(v.string()),
    chainDepth: v.float64(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scheduledWakeups")
      .withIndex("by_wakeupId", (q) => q.eq("wakeupId", args.wakeupId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        firedAt: args.firedAt,
        error: args.error,
        timestamp: args.timestamp,
      });
    } else {
      await ctx.db.insert("scheduledWakeups", args);
    }
  },
});

export const listPending = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scheduledWakeups")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit ?? 50);
  },
});

export const recentFired = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("scheduledWakeups")
      .withIndex("by_timestamp")
      .order("desc")
      .take((args.limit ?? 50) * 3);
    return all.filter((w) => w.status !== "pending").slice(0, args.limit ?? 50);
  },
});
