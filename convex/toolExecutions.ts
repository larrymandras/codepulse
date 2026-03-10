import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insert = mutation({
  args: {
    sessionId: v.string(),
    toolName: v.string(),
    durationMs: v.optional(v.float64()),
    success: v.boolean(),
    decision: v.optional(v.string()),
    decisionSource: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("toolExecutions", args);
  },
});

export const recentExecutions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);
  },
});

export const successRate = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 86400;
    const executions = await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recent = executions.filter((e) => e.timestamp >= cutoff);

    const byTool: Record<string, { success: number; failure: number }> = {};
    for (const exec of recent) {
      if (!byTool[exec.toolName]) {
        byTool[exec.toolName] = { success: 0, failure: 0 };
      }
      if (exec.success) {
        byTool[exec.toolName].success++;
      } else {
        byTool[exec.toolName].failure++;
      }
    }

    return Object.entries(byTool).map(([toolName, counts]) => ({
      toolName,
      ...counts,
      total: counts.success + counts.failure,
      rate: counts.success / (counts.success + counts.failure),
    }));
  },
});

export const avgDuration = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 86400;
    const executions = await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const recent = executions.filter(
      (e) => e.timestamp >= cutoff && e.durationMs != null
    );

    const byTool: Record<string, { total: number; count: number }> = {};
    for (const exec of recent) {
      if (!byTool[exec.toolName]) {
        byTool[exec.toolName] = { total: 0, count: 0 };
      }
      byTool[exec.toolName].total += exec.durationMs!;
      byTool[exec.toolName].count++;
    }

    return Object.entries(byTool).map(([toolName, data]) => ({
      toolName,
      avgDurationMs: data.total / data.count,
      count: data.count,
    }));
  },
});
