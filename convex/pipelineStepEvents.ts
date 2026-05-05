import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordEvent = mutation({
  args: {
    executionId: v.string(),
    pipelineName: v.string(),
    stepName: v.string(),
    stepIndex: v.float64(),
    status: v.string(),
    durationMs: v.optional(v.float64()),
    inputSize: v.optional(v.float64()),
    outputSize: v.optional(v.float64()),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("pipelineStepEvents", args);
  },
});

export const byExecution = query({
  args: { executionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pipelineStepEvents")
      .withIndex("by_execution", (q) => q.eq("executionId", args.executionId))
      .order("asc")
      .take(50);
  },
});

export const recentExecutionIds = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("pipelineStepEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const e of events) {
      if (!seen.has(e.executionId)) {
        seen.add(e.executionId);
        ids.push(e.executionId);
      }
    }
    return ids;
  },
});
