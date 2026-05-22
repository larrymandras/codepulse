import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";

// ---- Pure helper functions (exported for testing) ----

/**
 * Filters aggregate rows to only API-billed entries.
 * Legacy rows (no billingType in dimensions) are treated as "api" (conservative default).
 * Phase 67 D-02: subscription rows excluded from cost forecasting.
 */
export function filterAPIBilledRows(
  rows: Array<{ dimensions?: unknown; value: number; bucket_start: number }>
): Array<{ dimensions?: unknown; value: number; bucket_start: number }> {
  return rows.filter((r) => {
    const bt = (r.dimensions as { billingType?: string } | null)?.billingType ?? "api";
    return bt === "api";
  });
}

export function computeMovingAverage(
  dailyValues: number[],
  totalDaysAvailable: number
): number {
  const windowSize = totalDaysAvailable >= 30 ? 14 : 7;
  const window = dailyValues.slice(-windowSize);
  if (window.length === 0) return 0;
  return window.reduce((s, v) => s + v, 0) / window.length;
}

export function projectSpend(avgDaily: number): {
  daily: number;
  weekly: number;
  monthly: number;
} {
  return { daily: avgDaily, weekly: avgDaily * 7, monthly: avgDaily * 30 };
}

export function classifyBudgetStatus(
  projectedMonthly: number,
  budgetCap: number | null
): "ok" | "warning" | "exceeded" {
  if (budgetCap == null || budgetCap <= 0) return "ok";
  const ratio = projectedMonthly / budgetCap;
  if (ratio >= 1.0) return "exceeded";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

// ---- Convex query: costForecast ----

export const costForecast = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const lookbackSeconds = 30 * 86400;
    const cutoff = now - lookbackSeconds;

    // Read last 30 days of daily cost aggregates
    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", "daily").gte("bucket_start", cutoff)
      )
      .collect();

    // Phase 67 D-02: Only project API-billed spend. Subscription usage tracked but not forecasted.
    const apiRows = filterAPIBilledRows(rows);

    // Group by bucket_start (sum values across providers per day)
    const byDay: Record<number, number> = {};
    for (const row of apiRows) {
      byDay[row.bucket_start] = (byDay[row.bucket_start] ?? 0) + row.value;
    }

    // Build sorted list of days
    const sortedBuckets = Object.keys(byDay)
      .map(Number)
      .sort((a, b) => a - b);

    const totalDaysAvailable = sortedBuckets.length;
    const dailyValues = sortedBuckets.map((b) => byDay[b]);

    // Compute moving average
    const avgDaily = computeMovingAverage(dailyValues, totalDaysAvailable);
    const projections = projectSpend(avgDaily);

    // Read budget cap from agentConfigs
    const budgetConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "intelligence.budget_cap"))
      .first();
    const budgetCap = budgetConfig != null ? (budgetConfig.value as number) : null;

    // Current month spend: sum all daily rows in current calendar month
    const now30DayAgo = now - 30 * 86400;
    const currentMonthSpend = sortedBuckets
      .filter((b) => b >= now30DayAgo)
      .reduce((s, b) => s + (byDay[b] ?? 0), 0);

    // Daily history: last 7 days for sparkline
    const last7Buckets = sortedBuckets.slice(-7);
    const dailyHistory = last7Buckets.map((bucket) => {
      const date = new Date(bucket * 1000).toISOString().slice(0, 10);
      return { date, value: byDay[bucket] ?? 0 };
    });

    const insufficientData = totalDaysAvailable < 3;

    const budgetStatus = classifyBudgetStatus(projections.monthly, budgetCap);

    return {
      projectedDaily: projections.daily,
      projectedWeekly: projections.weekly,
      projectedMonthly: projections.monthly,
      budgetCap,
      budgetStatus,
      currentMonthSpend,
      dailyHistory,
      insufficientData,
    };
  },
});

// ---- Convex query: getBudgetConfig ----

export const getBudgetConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "intelligence.budget_cap"))
      .first();
    const budgetCap = config != null ? (config.value as number) : null;
    return { budgetCap };
  },
});

// ---- Convex mutation: setBudgetCap ----

export const setBudgetCap = mutation({
  args: { cap: v.float64() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthenticated");

    if (!(args.cap > 0 && args.cap < 1_000_000)) {
      throw new Error("Budget cap must be greater than 0 and less than 1,000,000");
    }

    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "intelligence.budget_cap"))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.cap,
        source: "dashboard",
        updatedAt: Date.now() / 1000,
      });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "intelligence.budget_cap",
        value: args.cap,
        source: "dashboard",
        updatedAt: Date.now() / 1000,
      });
    }

    return { budgetCap: args.cap };
  },
});
