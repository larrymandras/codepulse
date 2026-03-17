import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    executionId: v.string(),
    pipelineName: v.string(),
    stepIndex: v.float64(),
    stepName: v.string(),
    completedSteps: v.any(),
    status: v.string(),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pipelineCheckpoints", args);
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineCheckpoints")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const byExecution = query({
  args: { executionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineCheckpoints")
      .withIndex("by_execution", (q) => q.eq("executionId", args.executionId))
      .order("desc")
      .take(50);
  },
});

export const activeExecutions = query({
  args: {},
  handler: async (ctx) => {
    const saved = await ctx.db
      .query("pipelineCheckpoints")
      .withIndex("by_status", (q) => q.eq("status", "saved"))
      .order("desc")
      .take(50);

    const resumed = await ctx.db
      .query("pipelineCheckpoints")
      .withIndex("by_status", (q) => q.eq("status", "resumed"))
      .order("desc")
      .take(50);

    return [...saved, ...resumed];
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("pipelineCheckpoints")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    if (all.length === 0) {
      return {
        totalCheckpoints: 0,
        activeExecutions: 0,
        completedExecutions: 0,
        byPipeline: {} as Record<string, number>,
        lastCheckpoint: null,
      };
    }

    const executions = new Set(all.map((e) => e.executionId));
    const completed = all.filter((e) => e.status === "completed");
    const completedExecs = new Set(completed.map((e) => e.executionId));
    const byPipeline: Record<string, number> = {};
    for (const e of all) {
      byPipeline[e.pipelineName] = (byPipeline[e.pipelineName] ?? 0) + 1;
    }

    return {
      totalCheckpoints: all.length,
      activeExecutions: executions.size - completedExecs.size,
      completedExecutions: completedExecs.size,
      byPipeline,
      lastCheckpoint: all[0]?.timestamp ?? null,
    };
  },
});
