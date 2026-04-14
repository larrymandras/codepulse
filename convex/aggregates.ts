import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---- Hourly aggregation (called by cron every hour) ----
export const computeHourly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const hourStart = Math.floor(now / 3600) * 3600 - 3600; // last completed hour
    const hourEnd = hourStart + 3600;

    // --- Cost aggregation: group by provider+model ---
    const llmRows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", hourStart).lt("timestamp", hourEnd)
      )
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const costByDim: Record<string, number> = {};
    for (const r of llmRows) {
      const key = `${r.provider}::${r.model}`;
      costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
    }
    for (const [dim, value] of Object.entries(costByDim)) {
      const [provider, model] = dim.split("::");
      await ctx.db.insert("aggregates", {
        metric_type: "cost",
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { provider, model },
      });
    }

    // --- Event count aggregation: group by eventType ---
    const eventRows = await ctx.db
      .query("events")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", hourStart).lt("timestamp", hourEnd)
      )
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    const countByType: Record<string, number> = {};
    for (const e of eventRows) {
      countByType[e.eventType] = (countByType[e.eventType] ?? 0) + 1;
    }
    for (const [eventType, value] of Object.entries(countByType)) {
      await ctx.db.insert("aggregates", {
        metric_type: "events",
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { event_type: eventType },
      });
    }

    // --- Error rate aggregation: count errors by category ---
    const errorRows = eventRows.filter(
      (e) => e.eventType === "Error" || e.eventType === "ToolError"
    );
    const errorByCategory: Record<string, number> = {};
    for (const e of errorRows) {
      errorByCategory[e.eventType] = (errorByCategory[e.eventType] ?? 0) + 1;
    }
    // Also count total errors as a single aggregate for trend charts
    const totalErrors = errorRows.length;
    if (totalErrors > 0) {
      await ctx.db.insert("aggregates", {
        metric_type: "errors",
        period: "hourly",
        bucket_start: hourStart,
        value: totalErrors,
        dimensions: { error_category: "all" },
      });
    }
    for (const [category, value] of Object.entries(errorByCategory)) {
      await ctx.db.insert("aggregates", {
        metric_type: "errors",
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { error_category: category },
      });
    }
  },
});

// ---- Daily rollup (called by cron at 01:00 UTC) ----
// Rolls up 24 hourly rows into daily summaries. Does NOT re-scan raw tables.
export const rollupDaily = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const dayStart = Math.floor(now / 86400) * 86400 - 86400; // yesterday UTC midnight

    const hourlyRows = await ctx.db
      .query("aggregates")
      .withIndex("by_period_bucket", (q) =>
        q.eq("period", "hourly").gte("bucket_start", dayStart).lt("bucket_start", dayStart + 86400)
      )
      .collect();

    // Group by metric_type + dimensions key
    const rollup: Record<string, { metric_type: string; value: number; dimensions: unknown }> = {};
    for (const row of hourlyRows) {
      const dimKey = JSON.stringify(row.dimensions ?? {});
      const key = `${row.metric_type}::${dimKey}`;
      if (!rollup[key]) {
        rollup[key] = { metric_type: row.metric_type, value: 0, dimensions: row.dimensions };
      }
      rollup[key].value += row.value;
    }

    for (const entry of Object.values(rollup)) {
      await ctx.db.insert("aggregates", {
        metric_type: entry.metric_type,
        period: "daily",
        bucket_start: dayStart,
        value: entry.value,
        dimensions: entry.dimensions,
      });
    }
  },
});

// ---- Read queries for Analytics page (consumed by Plan 02) ----

export const costByPeriod = query({
  args: {
    period: v.string(),
    lookbackDays: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackDays ?? 30) * 86400;
    const cutoff = Date.now() / 1000 - lookback;

    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();

    // Group by provider
    const grouped: Record<string, number> = {};
    for (const r of rows) {
      const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
      grouped[provider] = (grouped[provider] ?? 0) + r.value;
    }
    return grouped;
  },
});

export const errorTrendByPeriod = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackHours ?? 24) * 3600;
    const cutoff = Date.now() / 1000 - lookback;

    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "errors").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();

    return rows.map((r) => ({
      bucket_start: r.bucket_start,
      errors: r.value,
      category: (r.dimensions as { error_category?: string } | null)?.error_category ?? "unknown",
    }));
  },
});

export const eventCountsByPeriod = query({
  args: {
    period: v.string(),
    lookbackDays: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackDays ?? 30) * 86400;
    const cutoff = Date.now() / 1000 - lookback;

    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "events").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();

    // Group by event_type
    const grouped: Record<string, number> = {};
    for (const r of rows) {
      const eventType = (r.dimensions as { event_type?: string } | null)?.event_type ?? "unknown";
      grouped[eventType] = (grouped[eventType] ?? 0) + r.value;
    }
    return grouped;
  },
});
