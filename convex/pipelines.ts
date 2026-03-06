import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordExecution = mutation({
  args: {
    pipelineId: v.string(),
    name: v.string(),
    status: v.string(),
    stages: v.optional(v.any()),
    startedAt: v.float64(),
    completedAt: v.optional(v.float64()),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pipelineExecutions")
      .withIndex("by_pipelineId", (q) => q.eq("pipelineId", args.pipelineId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        status: args.status,
        stages: args.stages,
        completedAt: args.completedAt,
        triggeredBy: args.triggeredBy,
      });
    } else {
      await ctx.db.insert("pipelineExecutions", {
        pipelineId: args.pipelineId,
        name: args.name,
        status: args.status,
        stages: args.stages,
        startedAt: args.startedAt,
        completedAt: args.completedAt,
        triggeredBy: args.triggeredBy,
      });
    }
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const running = await ctx.db
      .query("pipelineExecutions")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(20);
    const queued = await ctx.db
      .query("pipelineExecutions")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .take(20);
    return [...running, ...queued].slice(0, 20);
  },
});

export const listAll = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("pipelineExecutions")
      .withIndex("by_startedAt")
      .order("desc")
      .take(limit);
  },
});

export const listCompleted = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("pipelineExecutions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(limit);
  },
});
