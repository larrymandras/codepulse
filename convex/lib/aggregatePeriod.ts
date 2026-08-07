/**
 * COST-01 (2026-08-07): the ONE place that decides what `period` values the
 * `aggregates` table accepts.
 *
 * Why this exists: every reader of `aggregates` took `period: v.string()` and
 * fed it straight into `.withIndex(q => q.eq("period", period))`. An
 * unrecognized value matches no rows, so the query returns a well-formed
 * EMPTY result — and on a cost surface an empty result renders as "$0 spent",
 * which is indistinguishable from a real zero. Found the hard way: a
 * `costBreakdown({period: "day"})` call (the plausible-looking typo for
 * "daily") reported $0 across 24h, 168h AND 720h lookbacks, which read as a
 * broken rollup until the same call with "hourly" returned $26.28.
 *
 * A silent $0 is the worst possible failure mode here, so these queries now
 * refuse rather than under-report.
 *
 * NOTE: this is specifically the `aggregates`-table period namespace. It is
 * NOT the budget-period namespace in convex/costBudgets.ts, which is
 * "daily" | "weekly" | "monthly" (schema.ts:1648) and legitimately accepts
 * values rejected here. Do not unify them.
 */

export const AGGREGATE_PERIODS = ["hourly", "daily"] as const;

export type AggregatePeriod = (typeof AGGREGATE_PERIODS)[number];

/**
 * Throw unless `period` is a valid `aggregates.period` value.
 *
 * Returns the narrowed value so call sites can use it directly.
 */
export function assertAggregatePeriod(period: string, caller: string): AggregatePeriod {
  if (!(AGGREGATE_PERIODS as readonly string[]).includes(period)) {
    throw new Error(
      `[${caller}] invalid period ${JSON.stringify(period)} — ` +
        `expected one of ${AGGREGATE_PERIODS.map((p) => JSON.stringify(p)).join(" | ")}. ` +
        `Refusing rather than returning an empty result, which a cost surface renders as $0.`
    );
  }
  return period as AggregatePeriod;
}
