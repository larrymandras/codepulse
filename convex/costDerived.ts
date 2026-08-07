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
import { assertAggregatePeriod } from "./lib/aggregatePeriod";
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
  /**
   * WHY a row is unpriced — null when it IS priced.
   *
   * `priced: false` alone is ambiguous: it means both "no rate exists for this
   * model" AND "no tokens were reported for this bucket", which are completely
   * different facts. Conflating them made the D-03 nudge claim that
   * `claude-cli` "needs pricing rates" while `costBreakdown` simultaneously
   * reported the same model as `priced: true, coveredUsd: 0.180785` against its
   * seeded D-06 shadow row — the model has a perfectly good rate and simply had
   * a zero-token bucket in the window.
   *
   *   "no-rate"   -> genuinely missing from modelPricing; an operator must act.
   *   "no-tokens" -> rate may well exist; usage was never reported for this
   *                  bucket, so there is no cost to be missing.
   *
   * Only "no-rate" belongs in any "N models need rates" count.
   * Found 2026-08-02 on the rendered nudge at Phase 104's validation gate.
   */
  unpricedReason: "no-rate" | "no-tokens" | null;
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
    // Dollar fields stay null (correct — never assert money that was not
    // measured), but this is NOT "needs a rate": see unpricedReason.
    return { ...base, billedUsd: null, coveredUsd: null, priced: false, pricedVia: null, unpricedReason: "no-tokens" as const };
  }

  const hit = resolveRate(dims, index);
  if (hit === null) {
    // D-03: no default-rate fallback, no $0 inside a total — both dollar
    // fields are null so an unpriced bucket can never be silently summed.
    return { ...base, billedUsd: null, coveredUsd: null, priced: false, pricedVia: null, unpricedReason: "no-rate" as const };
  }

  if (isSubscription) {
    // D-05: a subscription turn genuinely costs $0 billed (money actually
    // owed is always $0 here); the shadow figure prices the SAME tokens at
    // the resolved rate so a brain-swap spend drop explains itself, but the
    // two numbers are never summed into one headline.
    const coveredUsd = priceTokens(promptTokens, completionTokens, hit.rate);
    return { ...base, billedUsd: 0, coveredUsd, priced: true, pricedVia: hit.via, unpricedReason: null };
  }

  const billedUsd = priceTokens(promptTokens, completionTokens, hit.rate);
  return { ...base, billedUsd, coveredUsd: null, priced: true, pricedVia: hit.via, unpricedReason: null };
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
    assertAggregatePeriod(args.period, "costOverTime"); // COST-01
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
    // Only "no-rate" counts as a model NEEDING a rate. A "no-tokens" row has
    // no reported usage, so there is no missing cost to report and the model
    // may well already be priced (Phase 104 gate, 2026-08-02).
    if (r.unpricedReason === "no-rate") {
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
  handler: async (ctx, args) => {
    assertAggregatePeriod(args.period, "costBreakdown"); // COST-01
    return deriveBreakdown(ctx, args.period, args.lookbackHours ?? 24);
  },
});

// ============================================================
// unpricedModels — the SINGLE source for "how many models need rates".
// Thin wrapper over the same costBreakdown derivation, restricted to
// priced: false rows, so the nudge (104-09) and the pricing-admin
// suggestion list (104-07) can never disagree.
// ============================================================

export const unpricedModels = query({
  args: {
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const { rows } = await deriveBreakdown(ctx, "hourly", args.lookbackHours ?? 24);

    // Count/report distinct (provider, model) PAIRS, not rows — a model can
    // in principle appear unpriced under more than one billingType.
    const byPair = new Map<
      string,
      { provider: string; model: string; billingType: string; promptTokens: number; completionTokens: number }
    >();
    for (const r of rows) {
      // NOT `if (r.priced) continue` — that also swept in zero-token buckets
      // for models that ARE priced (e.g. claude-cli's D-06 shadow row), which
      // made the nudge demand rates for models that already had them.
      if (r.unpricedReason !== "no-rate") continue;
      const key = `${r.provider}::${r.model}`;
      const existing = byPair.get(key);
      if (existing) {
        existing.promptTokens += r.promptTokens;
        existing.completionTokens += r.completionTokens;
      } else {
        byPair.set(key, {
          provider: r.provider,
          model: r.model,
          billingType: r.billingType,
          promptTokens: r.promptTokens,
          completionTokens: r.completionTokens,
        });
      }
    }

    const models = Array.from(byPair.values());
    return { count: models.length, models };
  },
});

// ============================================================
// computePeriodSpend — the bounded "spend so far this period" helper the
// budget evaluator (plan 104-06) calls directly from computeHourly's
// mutation ctx. A plain exported async function, NOT a Convex query.
// ============================================================

/**
 * Bounded read strategy (RESEARCH.md Pitfall 4 — a monthly budget must
 * never read 744 hours of hourly buckets): whole days strictly BEFORE today
 * read from `period: "daily"` buckets; today itself reads from
 * `period: "hourly"` buckets. These two windows are DISJOINT BY
 * CONSTRUCTION — the daily read is upper-bounded at `todayStart` and the
 * hourly read is lower-bounded at `max(periodStart, todayStart)` — so they
 * can never both cover the same hour and double-count today. A monthly
 * budget therefore reads at most ~31 daily bucket-sets plus ~24 hourly
 * bucket-sets, never a raw `llmMetrics` re-scan.
 *
 * Scope filtering (D-07): only `billingType: "api"` buckets ever contribute
 * to `billedUsd` under every scope — a dollar budget guards billed money
 * only; subscription/quota traffic is guarded on its own axis
 * (`gatewayQuotaSnapshots`, plan 104-06's `"quota"` scope, not handled
 * here).
 */
export async function computePeriodSpend(
  ctx: { db: DatabaseReader },
  args: {
    scope: "global" | "model" | "provider";
    scopeKey: string;
    periodStart: number;
    nowSec: number;
  }
): Promise<{ billedUsd: number; unpricedTokens: number }> {
  const todayStart = Math.floor(args.nowSec / 86400) * 86400;
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

  // Whole-day window: [periodStart, todayStart). Skipped entirely for a
  // daily budget (periodStart === todayStart) — issues NO "daily"-period
  // read at all in that case.
  if (args.periodStart < todayStart) {
    const dailyPrompt = await fetchAggregateRows(ctx, "tokens_prompt", "daily", args.periodStart, todayStart);
    const dailyCompletion = await fetchAggregateRows(ctx, "tokens_completion", "daily", args.periodStart, todayStart);
    accumulate(dailyPrompt, "promptTokens");
    accumulate(dailyCompletion, "completionTokens");
  }

  // Today window: [max(periodStart, todayStart), now) via the lower-bound
  // only (no upper bound needed — "up to now" is the read's natural end).
  const hourlyLowerBound = Math.max(args.periodStart, todayStart);
  const hourlyPrompt = await fetchAggregateRows(ctx, "tokens_prompt", "hourly", hourlyLowerBound);
  const hourlyCompletion = await fetchAggregateRows(ctx, "tokens_completion", "hourly", hourlyLowerBound);
  accumulate(hourlyPrompt, "promptTokens");
  accumulate(hourlyCompletion, "completionTokens");

  let billedUsd = 0;
  let unpricedTokens = 0;
  for (const g of groups.values()) {
    // D-07: a dollar budget guards billed (api) money only, on every scope —
    // subscription buckets never contribute to billedUsd here.
    if (g.billingType !== "api") continue;
    if (args.scope === "model" && g.model !== args.scopeKey) continue;
    if (args.scope === "provider" && g.provider !== args.scopeKey) continue;

    const derived = deriveBucketDollars(
      { provider: g.provider, model: g.model, billingType: g.billingType },
      g.promptTokens,
      g.completionTokens,
      index
    );
    if (derived.billedUsd !== null) {
      billedUsd += derived.billedUsd;
    } else {
      unpricedTokens += g.promptTokens + g.completionTokens;
    }
  }

  return { billedUsd, unpricedTokens };
}

// ============================================================
// deriveBilledByBucket — billed (api) dollars per time bucket, derived.
//
// CR-01 (2026-08-03). `SDKSpendGuard` and `CostForecastPanel` were the last two
// cost surfaces still reading the LEGACY pre-baked `metric_type: "cost"`
// aggregate, which is populated from the raw ingested `llmMetrics.cost` field
// (convex/aggregates.ts sums `r.cost ?? 0`). Every other surface — the trend
// chart, the breakdown table, the goal-scoped Hive queries and the budget
// evaluator — derives dollars from tokens x live rates through this module.
//
// That split meant two different dollar figures could render on one Analytics
// page, and it directly contradicted D-01: "the displayed dollar figure is
// derived by CodePulse, not taken from the ingest payload... `cost` continues to
// be stored but stops being the displayed truth." The premise of the whole phase
// is that the ingested value is WRONG (CONTEXT.md: sonnet-5/opus-5/fable-5 had
// no rate at all and fell to a default that under-priced Opus-class calls ~5x).
//
// Subscription buckets price to `billedUsd: 0` (money actually owed is $0), so
// summing billedUsd naturally excludes them without a billingType filter —
// which is what D-07 wants from a dollar budget. Unpriced buckets return null
// and are reported as `unpricedTokens` instead of being silently counted as $0.
// ============================================================

export async function deriveBilledByBucket(
  ctx: { db: DatabaseReader },
  period: string,
  gteBucketStart: number
): Promise<{ byBucket: Record<number, number>; unpricedTokens: number }> {
  const promptRows = await fetchAggregateRows(ctx, "tokens_prompt", period, gteBucketStart);
  const completionRows = await fetchAggregateRows(ctx, "tokens_completion", period, gteBucketStart);
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
      const key = `${row.bucket_start}::${d.provider}::${d.model}::${d.billingType}`;
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

  const byBucket: Record<number, number> = {};
  let unpricedTokens = 0;
  for (const c of cells.values()) {
    const derived = deriveBucketDollars(
      { provider: c.provider, model: c.model, billingType: c.billingType },
      c.promptTokens,
      c.completionTokens,
      index
    );
    if (derived.billedUsd !== null) {
      byBucket[c.bucket_start] = (byBucket[c.bucket_start] ?? 0) + derived.billedUsd;
    } else {
      unpricedTokens += c.promptTokens + c.completionTokens;
    }
  }

  return { byBucket, unpricedTokens };
}

/**
 * Query form of the above, for the SDK spend gauge (CR-01). Returns buckets in
 * ascending order with the SAME `bucket_start` field name the legacy
 * `aggregates.costByPeriodByProvider` used, so the consumer swap is a field
 * rename rather than a rewrite.
 */
export const billedOverTime = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    assertAggregatePeriod(args.period, "billedOverTime"); // COST-01
    const cutoff = Date.now() / 1000 - (args.lookbackHours ?? 24) * 3600;
    const { byBucket, unpricedTokens } = await deriveBilledByBucket(ctx, args.period, cutoff);
    const buckets = Object.keys(byBucket)
      .map(Number)
      .sort((a, b) => a - b)
      .map((bucket_start) => ({ bucket_start, billedUsd: byBucket[bucket_start] }));
    return { buckets, unpricedTokens };
  },
});
