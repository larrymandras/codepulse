import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getBillingType } from "./lib/providers";

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
      const billingType = (r as any).billingType ?? getBillingType(r.provider);
      // PULSE-02: extend key with goalId (4th segment) so hourly aggregates are goal-scoped.
      // goalId is "" for non-swarm rows — that is a valid bucket, not a missing value.
      const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
      costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
    }

    // PULSE-02 / Phase 67: Per-dimension-key idempotency guard.
    // With billingType + goalId, multiple rows per hour bucket can exist.
    // Collect all existing cost rows for this hour and skip already-aggregated dimension keys.
    const existingCostRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", "hourly").eq("bucket_start", hourStart)
      )
      .collect();
    const existingKeys = new Set(
      existingCostRows.map((r) => {
        const dims = r.dimensions as { provider?: string; model?: string; billingType?: string; goalId?: string } | null;
        // Must reconstruct the identical 4-segment key — goalId defaults to "" (Pitfall 3)
        return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}`;
      })
    );

    for (const [dim, value] of Object.entries(costByDim)) {
      if (existingKeys.has(dim)) continue; // idempotency: skip already-aggregated dimension
      const [provider, model, billingType, goalId] = dim.split("::");
      await ctx.db.insert("aggregates", {
        metric_type: "cost",
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { provider, model, billingType, goalId },
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

    // Idempotency guard: check existing event rows for this hour
    const existingEventRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
      )
      .collect();
    const existingEventKeys = new Set(
      existingEventRows.map((r) => {
        const dims = r.dimensions as { event_type?: string } | null;
        return dims?.event_type ?? "unknown";
      })
    );

    for (const [eventType, value] of Object.entries(countByType)) {
      if (existingEventKeys.has(eventType)) continue;
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
      (e) => e.eventType === "Error" || e.eventType === "ToolError" || e.eventType === "PostToolUseFailure"
    );
    const errorByCategory: Record<string, number> = {};
    for (const e of errorRows) {
      errorByCategory[e.eventType] = (errorByCategory[e.eventType] ?? 0) + 1;
    }

    // Idempotency guard: check existing error rows for this hour
    const existingErrorRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "errors").eq("period", "hourly").eq("bucket_start", hourStart)
      )
      .collect();
    const existingErrorKeys = new Set(
      existingErrorRows.map((r) => {
        const dims = r.dimensions as { error_category?: string } | null;
        return dims?.error_category ?? "unknown";
      })
    );

    // Also count total errors as a single aggregate for trend charts
    const totalErrors = errorRows.length;
    if (totalErrors > 0 && !existingErrorKeys.has("all")) {
      await ctx.db.insert("aggregates", {
        metric_type: "errors",
        period: "hourly",
        bucket_start: hourStart,
        value: totalErrors,
        dimensions: { error_category: "all" },
      });
    }
    for (const [category, value] of Object.entries(errorByCategory)) {
      if (existingErrorKeys.has(category)) continue;
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

    // Idempotency guard: check existing daily rows for this day
    const existingDailyRows = await ctx.db
      .query("aggregates")
      .withIndex("by_period_bucket", (q) =>
        q.eq("period", "daily").gte("bucket_start", dayStart).lt("bucket_start", dayStart + 86400)
      )
      .collect();
    const existingDailyKeys = new Set(
      existingDailyRows.map((r) => {
        const dimKey = JSON.stringify(r.dimensions ?? {});
        return `${r.metric_type}::${dimKey}`;
      })
    );

    for (const [key, entry] of Object.entries(rollup)) {
      if (existingDailyKeys.has(key)) continue;
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
    billingType: v.optional(v.string()),
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

    // Phase 67: Post-collect filter by billingType if provided.
    // Legacy rows (no billingType in dimensions) default to "api" (conservative).
    const filtered = args.billingType
      ? rows.filter((r) => {
          const bt = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";
          return bt === args.billingType;
        })
      : rows;

    // Group by provider
    const grouped: Record<string, number> = {};
    for (const r of filtered) {
      const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
      grouped[provider] = (grouped[provider] ?? 0) + r.value;
    }
    return grouped;
  },
});

export const costByPeriodByProvider = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
    billingType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackHours ?? 24) * 3600;
    const cutoff = Date.now() / 1000 - lookback;
    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();

    const filtered = args.billingType
      ? rows.filter((r) => {
          const bt = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";
          return bt === args.billingType;
        })
      : rows;

    // Group by bucket_start, then by provider
    const byBucket: Record<number, Record<string, number>> = {};
    for (const r of filtered) {
      const provider = (r.dimensions as { provider?: string } | null)?.provider ?? "unknown";
      if (!byBucket[r.bucket_start]) byBucket[r.bucket_start] = {};
      byBucket[r.bucket_start][provider] =
        (byBucket[r.bucket_start][provider] ?? 0) + r.value;
    }

    return Object.entries(byBucket)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([bucket_start, byProvider]) => ({
        bucket_start: Number(bucket_start),
        byProvider,
      }));
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

// ---- PULSE-02: Per-goal cost query (OQ-1: direct llmMetrics by_goal scan) ----
// Reads llmMetrics directly via the by_goal index (added in Plan 149-01).
// This single query covers both live goals (cost before next cron tick) and
// completed goals — no aggregates-vs-llmMetrics branching needed (~100 rows/run max).
export const costByGoalPeriod = query({
  args: {
    goalId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_goal", (q) => q.eq("goalId", args.goalId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    // Group by provider::model, summing cost
    const grouped: Record<string, { provider: string; model: string; cost: number }> = {};
    for (const r of rows) {
      const key = `${r.provider}::${r.model}`;
      if (!grouped[key]) {
        grouped[key] = { provider: r.provider, model: r.model, cost: 0 };
      }
      grouped[key].cost += r.cost ?? 0;
    }

    const resultRows = Object.values(grouped);
    const totalCost = resultRows.reduce((sum, r) => sum + r.cost, 0);

    return { rows: resultRows, totalCost };
  },
});

// ---- PULSE-02: Per-goal raw LLM rows for tier-flag join (Plan 04 CostBreakdown) ----
// Returns {agentId, model, cost} rows for a goalId so Plan 04 can join agentId → model tier.
// Separate from costByGoalPeriod to avoid overloading the grouped shape with raw row data.
export const llmByGoal = query({
  args: {
    goalId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_goal", (q) => q.eq("goalId", args.goalId))
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    return rows.map((r) => ({
      agentId: (r as any).agentId as string | undefined,
      model: r.model,
      provider: r.provider,
      cost: r.cost ?? 0,
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
