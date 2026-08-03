import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { deriveBilledByBucket } from "./costDerived";

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

/**
 * D-19 / D-11: `warnFraction` defaults to 0.8 so every pre-existing call
 * site (and every test written before this generalization) keeps behaving
 * identically. Once `costForecast` migrates to reading the global monthly
 * `costBudgets` row, it passes that row's own `warnFraction` here instead
 * of relying on the default.
 */
export function classifyBudgetStatus(
  projectedMonthly: number,
  budgetCap: number | null,
  warnFraction: number = 0.8
): "ok" | "warning" | "exceeded" {
  if (budgetCap == null || budgetCap <= 0) return "ok";
  const ratio = projectedMonthly / budgetCap;
  if (ratio >= 1.0) return "exceeded";
  if (ratio >= warnFraction) return "warning";
  return "ok";
}

// ---- Convex query: costForecast ----

export const costForecast = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const lookbackSeconds = 30 * 86400;
    const cutoff = now - lookbackSeconds;

    // CR-01 (2026-08-03): derive dollars from tokens x live rates, exactly like
    // every other cost surface, instead of reading the legacy pre-baked
    // `metric_type: "cost"` bucket (populated from the raw ingested
    // `llmMetrics.cost`). D-01: `cost` is still stored but is no longer the
    // displayed truth. Before this, THIS panel and SDKSpendGuard were the last
    // two surfaces on the old source, so Analytics could show two different
    // dollar figures for the same spend.
    //
    // Phase 67 D-02 still holds — only API-billed spend is projected — and now
    // falls out for free: subscription buckets derive to `billedUsd: 0`, so no
    // billingType filter is needed (which is why `filterAPIBilledRows` is no
    // longer called here). Unpriced buckets are excluded rather than counted $0.
    const { byBucket: byDay, unpricedTokens } = await deriveBilledByBucket(ctx, "daily", cutoff);

    // Build sorted list of days
    const sortedBuckets = Object.keys(byDay)
      .map(Number)
      .sort((a, b) => a - b);

    const totalDaysAvailable = sortedBuckets.length;
    const dailyValues = sortedBuckets.map((b) => byDay[b]);

    // Compute moving average
    const avgDaily = computeMovingAverage(dailyValues, totalDaysAvailable);
    const projections = projectSpend(avgDaily);

    // D-19: budget cap and warn fraction come from the global/monthly
    // costBudgets row (convex/costBudgets.ts), not agentConfigs. The legacy
    // agentConfigs monthly-cap key is read only by the two DEPRECATED
    // functions below, never here.
    const budgetRow = await ctx.db
      .query("costBudgets")
      .withIndex("by_scope_key_period", (q) =>
        q.eq("scope", "global").eq("scopeKey", "").eq("period", "monthly")
      )
      .first();
    // Same rule as costBudgets.getByScope: a disabled row is not a configured
    // cap, so the panel falls to its honest "No monthly budget set." state
    // rather than projecting against a threshold the evaluator ignores.
    const activeBudget = budgetRow && budgetRow.enabled ? budgetRow : null;
    const budgetCap = activeBudget?.limit ?? null;
    const warnFraction = activeBudget?.warnFraction ?? 0.8;

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

    const budgetStatus = classifyBudgetStatus(projections.monthly, budgetCap, warnFraction);

    return {
      projectedDaily: projections.daily,
      projectedWeekly: projections.weekly,
      projectedMonthly: projections.monthly,
      budgetCap,
      warnFraction,
      budgetStatus,
      currentMonthSpend,
      dailyHistory,
      insufficientData,
      // D-03 honesty: tokens in this window that have no rate are NOT folded
      // into the projection as $0. Surfaced so the panel can say so.
      unpricedTokens,
    };
  },
});

// ---- Convex query: getBudgetConfig ----
//
// DEPRECATED (D-19, Phase 104 Plan 08): superseded by
// `api.costBudgets.getByScope({ scope: "global", scopeKey: "", period:
// "monthly" })`. `costForecast` above no longer calls this — nothing in the
// app reads its result. Left deployed (not deleted) because deleting an
// exported Convex function while a deployed client bundle may still
// reference it is a deploy-order hazard; the legacy Settings form that used
// to call this was removed in the same plan. Still reads the legacy
// agentConfigs monthly-cap row unchanged.

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
//
// DEPRECATED (D-19, Phase 104 Plan 08): superseded by `api.costBudgets.create`
// / `api.costBudgets.update` on the global/monthly scope. Still authenticated
// and still writable, but nothing reads what it writes anymore (T-104-36:
// accepted risk — an inert write, not deleted for the same deploy-order
// reason as getBudgetConfig above).

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
