import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordCall = mutation({
  args: {
    integrationName: v.string(),
    endpointName: v.string(),
    method: v.string(),
    statusCode: v.float64(),
    durationMs: v.float64(),
    success: v.boolean(),
    error: v.optional(v.string()),
    timestamp: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("integrationCalls", args);
  },
});

export const recent = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationCalls")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const byIntegration = query({
  args: { integrationName: v.string(), limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationCalls")
      .withIndex("by_integration", (q) =>
        q.eq("integrationName", args.integrationName)
      )
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const failures = query({
  args: { limit: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrationCalls")
      .withIndex("by_success", (q) => q.eq("success", false))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db
      .query("integrationCalls")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    if (all.length === 0) {
      return {
        totalCalls: 0,
        failures: 0,
        avgDurationMs: 0,
        byIntegration: {} as Record<string, { total: number; failures: number; avgMs: number }>,
        lastCall: null,
      };
    }

    const failures = all.filter((e) => !e.success).length;
    const avgDurationMs = Math.round(
      all.reduce((sum, e) => sum + e.durationMs, 0) / all.length
    );

    const byIntegration: Record<string, { total: number; failures: number; avgMs: number }> = {};
    for (const e of all) {
      const entry = byIntegration[e.integrationName] ?? { total: 0, failures: 0, avgMs: 0 };
      entry.total++;
      if (!e.success) entry.failures++;
      entry.avgMs += e.durationMs;
      byIntegration[e.integrationName] = entry;
    }
    for (const key of Object.keys(byIntegration)) {
      byIntegration[key].avgMs = Math.round(
        byIntegration[key].avgMs / byIntegration[key].total
      );
    }

    return {
      totalCalls: all.length,
      failures,
      avgDurationMs,
      byIntegration,
      lastCall: all[0]?.timestamp ?? null,
    };
  },
});
