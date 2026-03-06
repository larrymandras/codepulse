import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordCall = mutation({
  args: {
    provider: v.string(),
    model: v.string(),
    promptTokens: v.float64(),
    completionTokens: v.float64(),
    totalTokens: v.float64(),
    latencyMs: v.float64(),
    cost: v.optional(v.float64()),
    sessionId: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("llmMetrics", {
      provider: args.provider,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      latencyMs: args.latencyMs,
      cost: args.cost,
      sessionId: args.sessionId,
      timestamp: args.timestamp,
    });
  },
});

export const recentCalls = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(50);
  },
});

export const costByProvider = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("llmMetrics").collect();
    const grouped: Record<string, number> = {};
    for (const record of all) {
      grouped[record.provider] =
        (grouped[record.provider] ?? 0) + (record.cost ?? 0);
    }
    return grouped;
  },
});

export const costByModel = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("llmMetrics").collect();
    const grouped: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const r of all) {
      const key = r.model;
      if (!grouped[key]) grouped[key] = { calls: 0, tokens: 0, cost: 0 };
      grouped[key].calls++;
      grouped[key].tokens += r.totalTokens;
      grouped[key].cost += r.cost ?? 0;
    }
    return grouped;
  },
});

export const providerBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("llmMetrics").collect();
    const grouped: Record<string, { calls: number; totalLatency: number; cost: number }> = {};
    for (const r of all) {
      if (!grouped[r.provider]) grouped[r.provider] = { calls: 0, totalLatency: 0, cost: 0 };
      grouped[r.provider].calls++;
      grouped[r.provider].totalLatency += r.latencyMs;
      grouped[r.provider].cost += r.cost ?? 0;
    }
    return Object.entries(grouped).map(([provider, data]) => ({
      provider,
      calls: data.calls,
      avgLatency: Math.round(data.totalLatency / data.calls),
      cost: data.cost,
    }));
  },
});

export const costOverTime = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("asc")
      .collect();
    return all.map((r) => ({
      timestamp: r.timestamp,
      provider: r.provider,
      cost: r.cost ?? 0,
      tokens: r.totalTokens,
    }));
  },
});

export const latencyOverTime = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp")
      .order("asc")
      .collect();
    return all.map((r) => ({
      timestamp: r.timestamp,
      provider: r.provider,
      latencyMs: r.latencyMs,
    }));
  },
});
