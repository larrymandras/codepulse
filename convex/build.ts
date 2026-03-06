import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const updateComponent = mutation({
  args: {
    component: v.string(),
    phase: v.string(),
    status: v.string(),
    progress: v.optional(v.float64()),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const existing = await ctx.db
      .query("buildProgress")
      .withIndex("by_component", (q) => q.eq("component", args.component))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        phase: args.phase,
        status: args.status,
        progress: args.progress,
        message: args.message,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("buildProgress", {
        component: args.component,
        phase: args.phase,
        status: args.status,
        progress: args.progress,
        message: args.message,
        updatedAt: now,
      });
    }
  },
});

export const phaseProgress = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("buildProgress")
      .order("desc")
      .take(50);
  },
});
