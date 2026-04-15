import { query } from "./_generated/server";
import { v } from "convex/values";

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("advisorEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const savingsSummary = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("advisorEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    let totalSavings = 0;
    let totalStandardCost = 0;
    let totalActualCost = 0;

    for (const evt of events) {
      totalStandardCost += evt.standardCostUsd;
      totalActualCost += evt.costUsd;
      totalSavings += evt.standardCostUsd - evt.costUsd;
    }

    return {
      totalSavings,
      totalStandardCost,
      totalActualCost,
      eventCount: events.length,
    };
  },
});

export const providerMetrics = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("advisorEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    const providerMap: Record<
      string,
      { count: number; totalCost: number; totalLatency: number; latencyCount: number }
    > = {};

    for (const evt of events) {
      if (!providerMap[evt.provider]) {
        providerMap[evt.provider] = {
          count: 0,
          totalCost: 0,
          totalLatency: 0,
          latencyCount: 0,
        };
      }
      const p = providerMap[evt.provider];
      p.count++;
      p.totalCost += evt.costUsd;
      if (evt.latencyMs !== undefined) {
        p.totalLatency += evt.latencyMs;
        p.latencyCount++;
      }
    }

    return Object.entries(providerMap).map(([provider, metrics]) => ({
      provider,
      count: metrics.count,
      avgCostUsd: metrics.count > 0 ? metrics.totalCost / metrics.count : 0,
      avgLatencyMs:
        metrics.latencyCount > 0
          ? metrics.totalLatency / metrics.latencyCount
          : null,
    }));
  },
});

export const executionDepthHistogram = query({
  args: {},
  handler: async (ctx) => {
    const modes = await ctx.db
      .query("executionModes")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    const buckets: Record<string, number> = {
      "1-3": 0,
      "4-6": 0,
      "7-10": 0,
      "11-15": 0,
      "16-20": 0,
    };

    for (const m of modes) {
      const d = m.roundsDepth;
      if (d <= 3) buckets["1-3"]++;
      else if (d <= 6) buckets["4-6"]++;
      else if (d <= 10) buckets["7-10"]++;
      else if (d <= 15) buckets["11-15"]++;
      else buckets["16-20"]++;
    }

    return Object.entries(buckets).map(([label, count]) => ({ label, count }));
  },
});
