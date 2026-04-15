import { query } from "./_generated/server";
import { v } from "convex/values";

export const recent = query({
  args: {
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memoryPreflight")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("memoryPreflight")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    if (records.length === 0) {
      return { hitRate: 0, avgLatencyMs: 0, totalRecords: 0 };
    }

    let totalHits = 0;
    let totalMisses = 0;
    let totalLatency = 0;

    for (const r of records) {
      totalHits += r.hitCount;
      totalMisses += r.missCount;
      totalLatency += r.latencyMs;
    }

    const totalRequests = totalHits + totalMisses;
    const hitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    const avgLatencyMs = totalLatency / records.length;

    return {
      hitRate,
      avgLatencyMs,
      totalRecords: records.length,
    };
  },
});
