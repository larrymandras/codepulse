import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const insertMetric = mutation({
  args: {
    agentId: v.string(),
    timestamp: v.float64(),
    responseTimeMs: v.optional(v.float64()),
    taskOutcome: v.string(),
    inputTokens: v.float64(),
    outputTokens: v.float64(),
    modelUsed: v.optional(v.string()),
    complexityTier: v.optional(v.string()),
    fromOverride: v.optional(v.boolean()),
    sessionId: v.optional(v.string()),
    turnNumber: v.optional(v.float64()),
    projectTag: v.optional(v.string()),
    costUsd: v.optional(v.float64()),
    toolCallCount: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("agentMetrics", {
      agentId: args.agentId,
      timestamp: args.timestamp,
      responseTimeMs: args.responseTimeMs,
      taskOutcome: args.taskOutcome,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      modelUsed: args.modelUsed,
      complexityTier: args.complexityTier,
      fromOverride: args.fromOverride,
      sessionId: args.sessionId,
      turnNumber: args.turnNumber,
      projectTag: args.projectTag,
      costUsd: args.costUsd,
      toolCallCount: args.toolCallCount,
    });
  },
});

export const costByProject = query({
  args: {
    windowStart: v.float64(),
    windowEnd: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const end = args.windowEnd ?? Date.now() / 1000;
    const rows = await ctx.db
      .query("agentMetrics")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", args.windowStart).lte("timestamp", end)
      )
      .collect();

    const byProjectDay: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const tag = (row as any).projectTag ?? "personal";
      const dayBucket = new Date(row.timestamp * 1000).toISOString().slice(0, 10);
      byProjectDay[tag] = byProjectDay[tag] ?? {};
      byProjectDay[tag][dayBucket] = (byProjectDay[tag][dayBucket] ?? 0) +
        ((row as any).costUsd ?? 0);
    }
    return byProjectDay;
  },
});

export const turnMetrics = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMetrics")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const forAgent = query({
  args: {
    agentId: v.string(),
    windowStart: v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentMetrics")
      .withIndex("by_agent_timestamp", (q) =>
        q.eq("agentId", args.agentId).gte("timestamp", args.windowStart)
      )
      .order("asc")
      .collect();
  },
});

export const leaderboard = query({
  args: {
    windowStart: v.float64(),
    agentIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const allMetrics = await ctx.db
      .query("agentMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", args.windowStart))
      .collect();

    const filtered = args.agentIds
      ? allMetrics.filter((m) => args.agentIds!.includes(m.agentId))
      : allMetrics;

    const byAgent = new Map<
      string,
      {
        agentId: string;
        count: number;
        successCount: number;
        totalResponseTimeMs: number;
        responseTimeCount: number;
        inputTokens: number;
        outputTokens: number;
        dominantModel: string;
      }
    >();

    for (const m of filtered) {
      const existing = byAgent.get(m.agentId) ?? {
        agentId: m.agentId,
        count: 0,
        successCount: 0,
        totalResponseTimeMs: 0,
        responseTimeCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        dominantModel: "default",
      };
      existing.count++;
      if (m.taskOutcome === "success") existing.successCount++;
      if (m.responseTimeMs != null) {
        existing.totalResponseTimeMs += m.responseTimeMs;
        existing.responseTimeCount++;
      }
      existing.inputTokens += m.inputTokens;
      existing.outputTokens += m.outputTokens;
      if (m.modelUsed) existing.dominantModel = m.modelUsed;
      byAgent.set(m.agentId, existing);
    }

    return Array.from(byAgent.values()).map((a) => ({
      agentId: a.agentId,
      taskCount: a.count,
      completionRate: a.count > 0 ? a.successCount / a.count : 0,
      avgResponseTimeMs:
        a.responseTimeCount > 0
          ? a.totalResponseTimeMs / a.responseTimeCount
          : null,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      dominantModel: a.dominantModel,
    }));
  },
});
