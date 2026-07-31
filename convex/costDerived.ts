/**
 * convex/costDerived.ts — Phase 104 (Cost Intelligence), Plan 05.
 *
 * The single place tokens become money (D-01). Every other cost surface in
 * this phase — the Analytics over-time chart, the breakdown table, the
 * unpriced-models nudge, the goal-scoped HivePage breakdown
 * (convex/aggregates.ts's costByGoalPeriod/llmByGoal), and the budget
 * evaluator (plan 104-06) — routes through `deriveBucketDollars` or one of
 * the queries/helper below. Nothing else in this codebase is allowed to
 * multiply tokens by a rate.
 *
 * Load-bearing rules, all enforced here so no consumer has to remember them:
 *   - D-03: an unpriced bucket returns `null` for BOTH dollar fields, never
 *     `0` and never a default-rate guess. A caller that sums with `?? 0` is
 *     a bug this function refuses to hide.
 *   - D-05: `billedUsd` and `coveredUsd` are never summed into one figure —
 *     every response below keeps them as separate, independently-summed
 *     totals.
 *   - D-18/D-03: a bucket whose token counts are both zero is unpriced
 *     regardless of whether a rate resolves — pricing imputed/unreported
 *     tokens at $0.0000 is the same dishonesty as a default-rate guess.
 *   - Bounded reads only (T-104-18/T-104-19): every read here is
 *     index-range-bounded on `aggregates.by_type_period_bucket` with a
 *     `metric_type` equality; this file never touches `llmMetrics`.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import type { DatabaseReader } from "./_generated/server";
import {
  buildRateIndex,
  resolveRate,
  priceTokens,
  type RateIndex,
} from "./modelPricing";

// ============================================================
// Types (exported — plans 104-06, 104-09, 104-10 consume these exact names)
// ============================================================

export type DerivedRow = {
  provider: string;
  model: string;
  billingType: "api" | "subscription";
  promptTokens: number;
  completionTokens: number;
  /** null when unpriced OR when billingType is subscription. Never 0 as a stand-in for unpriced. */
  billedUsd: number | null;
  /** null when unpriced OR when billingType is api. */
  coveredUsd: number | null;
  priced: boolean;
  pricedVia: "model" | "shadow" | null;
};

type AggregateRow = { bucket_start: number; value: number; dimensions: unknown };

// ============================================================
// The one function that turns tokens into money — pure, no ctx.
// ============================================================

/**
 * D-03's two honesty guards live here, in this order:
 *   1. Both token counts are zero -> unpriced (D-18: never price imputed/
 *      unreported tokens at $0.0000, even if a rate resolves).
 *   2. No rate resolves (resolveRate returns null) -> unpriced.
 * Otherwise: api turns get `billedUsd`, subscription turns get a true $0
 * `billedUsd` (D-05 — billed always means money actually owed) plus a
 * separate `coveredUsd` shadow figure priced at the same resolved rate.
 */
export function deriveBucketDollars(
  dims: { provider: string; model: string; billingType: string },
  promptTokens: number,
  completionTokens: number,
  index: RateIndex
): DerivedRow {
  const isSubscription = dims.billingType === "subscription";
  const billingType: "api" | "subscription" = isSubscription ? "subscription" : "api";
  const base = {
    provider: dims.provider,
    model: dims.model,
    billingType,
    promptTokens,
    completionTokens,
  };

  // SECOND HONESTY GUARD (D-18/D-03): both-zero token counts mean the
  // gateway never reported usage for this bucket — pricing it at $0.0000 of
  // covered/billed spend would assert money that was never measured.
  if (promptTokens === 0 && completionTokens === 0) {
    return { ...base, billedUsd: null, coveredUsd: null, priced: false, pricedVia: null };
  }

  const hit = resolveRate(dims, index);
  if (hit === null) {
    // D-03: no default-rate fallback, no $0 inside a total — both dollar
    // fields are null so an unpriced bucket can never be silently summed.
    return { ...base, billedUsd: null, coveredUsd: null, priced: false, pricedVia: null };
  }

  if (isSubscription) {
    // D-05: a subscription turn genuinely costs $0 billed (money actually
    // owed is always $0 here); the shadow figure prices the SAME tokens at
    // the resolved rate so a brain-swap spend drop explains itself, but the
    // two numbers are never summed into one headline.
    const coveredUsd = priceTokens(promptTokens, completionTokens, hit.rate);
    return { ...base, billedUsd: 0, coveredUsd, priced: true, pricedVia: hit.via };
  }

  const billedUsd = priceTokens(promptTokens, completionTokens, hit.rate);
  return { ...base, billedUsd, coveredUsd: null, priced: true, pricedVia: hit.via };
}

// ============================================================
// Shared bounded-read helpers (non-exported)
// ============================================================

/** Reconstructs the {provider, model, billingType, goalId} tuple with the SAME defaults convex/aggregates.ts uses. */
function dimsOf(dimensions: unknown): { provider: string; model: string; billingType: string; goalId: string } {
  const d = dimensions as { provider?: string; model?: string; billingType?: string; goalId?: string } | null;
  return {
    provider: d?.provider ?? "unknown",
    model: d?.model ?? "unknown",
    billingType: d?.billingType ?? "api",
    goalId: d?.goalId ?? "",
  };
}

/**
 * Index-bounded read of one metric_type's aggregate buckets. Always a
 * `metric_type` equality plus a `bucket_start` lower bound
 * (`by_type_period_bucket`); an optional upper bound narrows further
 * (used by computePeriodSpend's disjoint daily/hourly windows, plan
 * 104-05 Task 2). Never a bare `.collect()` and never `llmMetrics`.
 */
async function fetchAggregateRows(
  ctx: { db: DatabaseReader },
  metricType: "tokens_prompt" | "tokens_completion",
  period: string,
  gteBucketStart: number,
  ltBucketStart?: number
): Promise<AggregateRow[]> {
  const rows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) => {
      const bounded = q.eq("metric_type", metricType).eq("period", period).gte("bucket_start", gteBucketStart);
      return ltBucketStart !== undefined ? bounded.lt("bucket_start", ltBucketStart) : bounded;
    })
    .collect();
  return rows as unknown as AggregateRow[];
}

/** `modelPricing` is a small operator-authored table — one full-scan read per query, never inside a loop. */
async function loadRateIndex(ctx: { db: DatabaseReader }): Promise<RateIndex> {
  const rates = await ctx.db.query("modelPricing").collect();
  return buildRateIndex(rates as any);
}

// ============================================================
// costOverTime — billed / covered / unpriced-tokens time series
// ============================================================

export const costOverTime = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() / 1000 - (args.lookbackHours ?? 24) * 3600;

    const promptRows = await fetchAggregateRows(ctx, "tokens_prompt", args.period, cutoff);
    const completionRows = await fetchAggregateRows(ctx, "tokens_completion", args.period, cutoff);
    const index = await loadRateIndex(ctx);

    type Cell = {
      bucket_start: number;
      provider: string;
      model: string;
      billingType: string;
      promptTokens: number;
      completionTokens: number;
    };
    const cells = new Map<string, Cell>();

    function accumulate(rows: AggregateRow[], field: "promptTokens" | "completionTokens") {
      for (const row of rows) {
        const d = dimsOf(row.dimensions);
        const key = `${row.bucket_start}::${d.provider}::${d.model}::${d.billingType}::${d.goalId}`;
        let cell = cells.get(key);
        if (!cell) {
          cell = {
            bucket_start: row.bucket_start,
            provider: d.provider,
            model: d.model,
            billingType: d.billingType,
            promptTokens: 0,
            completionTokens: 0,
          };
          cells.set(key, cell);
        }
        cell[field] += row.value;
      }
    }
    accumulate(promptRows, "promptTokens");
    accumulate(completionRows, "completionTokens");

    type BucketAgg = {
      billedByProvider: Record<string, number>;
      coveredByProvider: Record<string, number>;
      unpricedTokensByProvider: Record<string, number>;
    };
    const byBucket = new Map<number, BucketAgg>();

    for (const cell of cells.values()) {
      const derived = deriveBucketDollars(
        { provider: cell.provider, model: cell.model, billingType: cell.billingType },
        cell.promptTokens,
        cell.completionTokens,
        index
      );
      let bucket = byBucket.get(cell.bucket_start);
      if (!bucket) {
        bucket = { billedByProvider: {}, coveredByProvider: {}, unpricedTokensByProvider: {} };
        byBucket.set(cell.bucket_start, bucket);
      }
      if (derived.priced) {
        // billed and covered are summed into SEPARATE maps — never merged
        // (D-05); the default over-time view (plan 104-10) renders billed
        // alone.
        if (derived.billedUsd !== null) {
          bucket.billedByProvider[cell.provider] = (bucket.billedByProvider[cell.provider] ?? 0) + derived.billedUsd;
        }
        if (derived.coveredUsd !== null) {
          bucket.coveredByProvider[cell.provider] =
            (bucket.coveredByProvider[cell.provider] ?? 0) + derived.coveredUsd;
        }
      } else {
        bucket.unpricedTokensByProvider[cell.provider] =
          (bucket.unpricedTokensByProvider[cell.provider] ?? 0) + cell.promptTokens + cell.completionTokens;
      }
    }

    return Array.from(byBucket.entries())
      .sort(([a], [b]) => a - b)
      .map(([bucket_start, agg]) => ({ bucket_start, ...agg }));
  },
});

// ============================================================
// costBreakdown — one DerivedRow per (provider, model, billingType), across
// the whole lookback window (bucket_start and goalId collapsed).
// ============================================================

/** Shared by costBreakdown and (Task 2) unpricedModels — one derivation, one owner. */
async function deriveBreakdown(
  ctx: { db: DatabaseReader },
  period: string,
  lookbackHours: number
): Promise<{
  rows: DerivedRow[];
  billedTotal: number;
  coveredTotal: number;
  unpricedModelCount: number;
  unpricedTokenTotal: number;
}> {
  const cutoff = Date.now() / 1000 - lookbackHours * 3600;

  const promptRows = await fetchAggregateRows(ctx, "tokens_prompt", period, cutoff);
  const completionRows = await fetchAggregateRows(ctx, "tokens_completion", period, cutoff);
  const index = await loadRateIndex(ctx);

  type Group = { provider: string; model: string; billingType: string; promptTokens: number; completionTokens: number };
  const groups = new Map<string, Group>();

  function accumulate(rows: AggregateRow[], field: "promptTokens" | "completionTokens") {
    for (const row of rows) {
      const d = dimsOf(row.dimensions);
      const key = `${d.provider}::${d.model}::${d.billingType}`;
      let g = groups.get(key);
      if (!g) {
        g = { provider: d.provider, model: d.model, billingType: d.billingType, promptTokens: 0, completionTokens: 0 };
        groups.set(key, g);
      }
      g[field] += row.value;
    }
  }
  accumulate(promptRows, "promptTokens");
  accumulate(completionRows, "completionTokens");

  const rows: DerivedRow[] = Array.from(groups.values()).map((g) =>
    deriveBucketDollars(
      { provider: g.provider, model: g.model, billingType: g.billingType },
      g.promptTokens,
      g.completionTokens,
      index
    )
  );

  // billedTotal and coveredTotal are summed SEPARATELY (D-05) — no field on
  // this shape ever adds them together, and unpriced rows contribute to
  // neither.
  let billedTotal = 0;
  let coveredTotal = 0;
  let unpricedTokenTotal = 0;
  const unpricedPairs = new Set<string>();
  for (const r of rows) {
    if (r.billedUsd !== null) billedTotal += r.billedUsd;
    if (r.coveredUsd !== null) coveredTotal += r.coveredUsd;
    if (!r.priced) {
      unpricedTokenTotal += r.promptTokens + r.completionTokens;
      unpricedPairs.add(`${r.provider}::${r.model}`);
    }
  }

  // Stable order for plan 104-09's table: billedUsd descending, unpriced last.
  rows.sort((a, b) => {
    if (a.priced !== b.priced) return a.priced ? -1 : 1;
    return (b.billedUsd ?? 0) - (a.billedUsd ?? 0);
  });

  return { rows, billedTotal, coveredTotal, unpricedModelCount: unpricedPairs.size, unpricedTokenTotal };
}

export const costBreakdown = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => deriveBreakdown(ctx, args.period, args.lookbackHours ?? 24),
});
