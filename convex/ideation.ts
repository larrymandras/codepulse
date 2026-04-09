import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordFinding = mutation({
  args: {
    scanType: v.string(),
    severity: v.string(),
    category: v.string(),
    location: v.string(),
    description: v.string(),
    suggestedFix: v.optional(v.string()),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ideationFindings")
      .withIndex("by_content_hash", (q) => q.eq("contentHash", args.contentHash))
      .filter((q) => q.eq(q.field("dismissed"), false))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("ideationFindings", {
      ...args,
      dismissed: false,
      createdAt: Date.now() / 1000,
    });
  },
});

export const dismissFinding = mutation({
  args: { id: v.id("ideationFindings") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      dismissed: true,
      dismissedAt: Date.now() / 1000,
    });
  },
});

export const listFindings = query({
  args: {
    dismissed: v.optional(v.boolean()),
  },
  handler: async (ctx, { dismissed }) => {
    if (dismissed !== undefined) {
      return await ctx.db
        .query("ideationFindings")
        .withIndex("by_dismissed", (q) => q.eq("dismissed", dismissed))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("ideationFindings").order("desc").collect();
  },
});

export const findingStats = query({
  handler: async (ctx) => {
    const active = await ctx.db
      .query("ideationFindings")
      .withIndex("by_dismissed", (q) => q.eq("dismissed", false))
      .collect();
    const stats = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of active) {
      if (f.severity in stats) {
        stats[f.severity as keyof typeof stats]++;
      }
    }
    return stats;
  },
});
