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

export const phaseOverview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("buildProgress").collect();
    const phases: Record<
      string,
      {
        phase: string;
        total: number;
        completed: number;
        in_progress: number;
        failed: number;
        avgProgress: number;
      }
    > = {};

    for (const row of all) {
      if (!phases[row.phase]) {
        phases[row.phase] = {
          phase: row.phase,
          total: 0,
          completed: 0,
          in_progress: 0,
          failed: 0,
          avgProgress: 0,
        };
      }
      const p = phases[row.phase];
      p.total++;
      if (row.status === "completed") p.completed++;
      if (row.status === "in_progress") p.in_progress++;
      if (row.status === "failed") p.failed++;
      p.avgProgress += row.progress ?? 0;
    }

    return Object.values(phases).map((p) => ({
      ...p,
      avgProgress: p.total > 0 ? Math.round(p.avgProgress / p.total) : 0,
    }));
  },
});

export const recentActivity = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("buildProgress")
      .order("desc")
      .take(limit);
  },
});

export const componentsByPhase = query({
  args: { phase: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("buildProgress")
      .withIndex("by_phase", (q) => q.eq("phase", args.phase))
      .collect();
  },
});
