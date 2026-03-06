import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordMetrics = mutation({
  args: {
    profileId: v.string(),
    metric: v.string(),
    value: v.float64(),
    tags: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("profileMetrics", {
      profileId: args.profileId,
      metric: args.metric,
      value: args.value,
      tags: args.tags,
      timestamp: Date.now() / 1000,
    });
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const recent = await ctx.db
      .query("profileMetrics")
      .withIndex("by_profile")
      .order("desc")
      .take(100);

    const grouped: Record<string, (typeof recent)> = {};
    for (const record of recent) {
      if (!grouped[record.profileId]) {
        grouped[record.profileId] = [];
      }
      grouped[record.profileId].push(record);
    }
    return grouped;
  },
});
