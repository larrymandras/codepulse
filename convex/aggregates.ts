import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getBillingType } from "./lib/providers";
import { assertAggregatePeriod } from "./lib/aggregatePeriod";
import { buildRateIndex } from "./modelPricing";
import { deriveBucketDollars } from "./costDerived";
import { evaluateBudgets } from "./costBudgetEval";
import { evaluateToolPolicyAlerts } from "./toolPolicyAlertEval";

// ---- Bounded llmMetrics window read --------------------------------------
//
// Convex allows exactly ONE paginated query per function invocation. Both
// readers here previously ran `.paginate()` inside a `while (true)` cursor
// loop, which violates that:
//   - `backfillTokenSplit` (104-03) called such a loop once PER HOUR, so at the
//     documented `maxHours: 6` it always issued 6 paginated queries and failed
//     on its very first live invocation, 0 rows or not:
//     "This query or mutation function ran multiple paginated queries."
//   - `computeHourly` (pre-existing, Phase 88 `4e8c2be9`) HAD the same loop and
//     survived only because a page of 500 had always covered one hour, so
//     `isDone` was true on the first call and the loop exited after one
//     paginate. The first hour to exceed 500 rows would have killed the LIVE
//     CRON -- and the budget evaluator appended to its tail (D-14) with it.
//     PAST TENSE as of 2026-08-28: no `.paginate()` remains in this file. Both
//     readers are index-range + a hard `.take()` cap (LLM_WINDOW_READ_CAP /
//     TOOL_WINDOW_READ_CAP, 4000 each) and report truncation rather than
//     silently undercounting. Kept as the reason the shape below is what it is.
// Neither was catchable by the unit suite: the fake ctx in aggregates.test.ts
// implemented `paginate()` more permissively than Convex and allowed repeated
// calls. That mock now enforces the real single-call rule.
//
// A single index-range-bounded `.take()` is bounded by construction and needs no
// pagination at all. Truncation is REPORTED rather than silently undercounting
// token buckets (the honesty rule this whole phase is built on).
// Found 2026-07-31 at Phase 104's live-deploy gate.
const LLM_WINDOW_READ_CAP = 4000;

async function fetchLlmRowsForWindow(
  ctx: { db: any },
  windowStart: number,
  windowEnd: number
): Promise<{ rows: Array<Doc<"llmMetrics">>; truncated: boolean }> {
  const rows: Array<Doc<"llmMetrics">> = await ctx.db
    .query("llmMetrics")
    .withIndex("by_timestamp", (q: any) =>
      q.gte("timestamp", windowStart).lt("timestamp", windowEnd)
    )
    .filter((q: any) => q.neq(q.field("archived"), true))
    .take(LLM_WINDOW_READ_CAP);
  return { rows, truncated: rows.length >= LLM_WINDOW_READ_CAP };
}

// ---- D-04 (Phase 104) shared helpers -------------------------------------
// Factored out of computeHourly's Task 1 edit so computeHourly (the live
// cron) and backfillTokenSplit (the manual historical backfill, below) share
// the exact same accumulate+guard+insert logic and cannot drift from each
// other (104-03-PLAN.md Task 2).

type SplitDims = { provider?: string; model?: string; billingType?: string; goalId?: string };

/** Reconstructs the identical 4-segment dimension key an existing aggregates row used. */
function reconstructTokenSplitKey(dims: SplitDims | null | undefined): string {
  return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}`;
}

/**
 * Sums prompt/completion tokens per {provider, model, billingType, goalId} dimension
 * key across `llmRows`, then inserts any missing `tokens_prompt`/`tokens_completion`
 * hourly buckets for `hourStart` — each metric type behind its OWN idempotency guard
 * (a shared guard would let a partially-completed run double-count one split half
 * while correctly skipping the other). Never patches or deletes an existing row —
 * insert-only, per CLAUDE.md's self-hosted Convex rules.
 *
 * Phase 121 (D-05): also accumulates a `calls` bucket — one per {provider, model,
 * billingType, goalId} dimension key, valued at that key's row COUNT (not a token
 * or cost sum) — behind its own separate per-dimension-key guard call below, for
 * the same reason the token halves each get their own: a shared guard across
 * metric types would let a partially-completed run double-count one metric while
 * correctly skipping another. This is the call-count rollup PC-3 found missing;
 * `costByModel`/`providerBreakdown` (Plan 121-02) read it instead of scanning
 * raw `llmMetrics` for a count.
 */
async function insertTokenSplitBuckets(
  ctx: { db: any },
  hourStart: number,
  llmRows: Array<Doc<"llmMetrics">>
): Promise<{ promptInserted: number; completionInserted: number; callsInserted: number }> {
  const promptByDim: Record<string, number> = {};
  const completionByDim: Record<string, number> = {};
  const callsByDim: Record<string, number> = {};
  for (const r of llmRows) {
    const billingType = (r as any).billingType ?? getBillingType(r.provider);
    const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
    promptByDim[key] = (promptByDim[key] ?? 0) + ((r as any).promptTokens ?? 0);
    completionByDim[key] = (completionByDim[key] ?? 0) + ((r as any).completionTokens ?? 0);
    callsByDim[key] = (callsByDim[key] ?? 0) + 1;
  }

  async function insertMissing(metricType: string, byDim: Record<string, number>): Promise<number> {
    const existingRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q: any) =>
        q.eq("metric_type", metricType).eq("period", "hourly").eq("bucket_start", hourStart)
      )
      .collect();
    const existingKeys = new Set(existingRows.map((r: any) => reconstructTokenSplitKey(r.dimensions)));
    let count = 0;
    for (const [dim, value] of Object.entries(byDim)) {
      if (existingKeys.has(dim)) continue; // idempotency: skip already-aggregated dimension
      const [provider, model, billingType, goalId] = dim.split("::");
      await ctx.db.insert("aggregates", {
        metric_type: metricType,
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { provider, model, billingType, goalId },
      });
      count++;
    }
    return count;
  }

  const promptInserted = await insertMissing("tokens_prompt", promptByDim);
  const completionInserted = await insertMissing("tokens_completion", completionByDim);
  const callsInserted = await insertMissing("calls", callsByDim);
  return { promptInserted, completionInserted, callsInserted };
}

// ---- D-04 (Phase 105) tool usage bucket helpers -------------------------
//
// convex/retention.ts prunes toolExecutions at 14 days and this phase
// deliberately does NOT raise that (the 2026-07-21/22 tombstone-GC incident
// on this self-hosted instance) — so OBS-01's "over time" tool-usage charts
// must read these durable hourly buckets past 14 days, never the raw table.

/**
 * Bounded toolExecutions window read for the hourly tool usage buckets
 * below. Mirrors fetchLlmRowsForWindow's shape exactly — an index-range +
 * a hard row cap via .take(), never a paginate cursor loop (Convex permits
 * exactly one paginated query per invocation). Exported so tests bind to the
 * real cap value.
 */
export const TOOL_WINDOW_READ_CAP = 4000;

export async function fetchToolRowsForWindow(
  ctx: { db: any },
  windowStart: number,
  windowEnd: number
): Promise<{ rows: Array<Doc<"toolExecutions">>; truncated: boolean }> {
  const rows: Array<Doc<"toolExecutions">> = await ctx.db
    .query("toolExecutions")
    .withIndex("by_timestamp", (q: any) =>
      q.gte("timestamp", windowStart).lt("timestamp", windowEnd)
    )
    .filter((q: any) => q.neq(q.field("archived"), true))
    .take(TOOL_WINDOW_READ_CAP);
  return { rows, truncated: rows.length >= TOOL_WINDOW_READ_CAP };
}

/**
 * The 2-segment dimension key analog of reconstructTokenSplitKey — only
 * {tool, provider} (not the 4-segment provider/model/billingType/goalId
 * shape, which is meaningless for a per-tool-call row). The forward key
 * built from a toolExecutions row (in insertToolUsageBuckets below) and this
 * reconstruction from a stored aggregates row's `dimensions` MUST produce
 * identical strings for the same logical dimension, or the idempotency
 * guard silently re-inserts every hour.
 */
function reconstructToolUsageKey(dims: { tool?: string; provider?: string } | null | undefined): string {
  return `${dims?.tool ?? "unknown"}::${dims?.provider ?? "unknown"}`;
}

/**
 * D-04: four hourly tool-usage metric types per {tool, provider} dimension —
 * tool_calls, tool_failures, tool_duration_ms, tool_duration_samples — each
 * behind its OWN idempotency guard (a shared guard would let a partially-
 * completed run double-count one metric type while correctly skipping
 * another). Never patches or deletes an existing row — insert-only, per
 * CLAUDE.md's self-hosted Convex rules.
 *
 * A dimension with zero failures still gets a tool_failures bucket (value 0)
 * so the read path never has to guess whether an absent bucket means zero
 * failures or means unknown. A dimension where no row reported a numeric
 * durationMs gets NEITHER duration bucket — absent is not zero, and an
 * average over zero samples must render "n/a", never "0ms".
 */
async function insertToolUsageBuckets(
  ctx: { db: any },
  hourStart: number,
  toolRows: Array<Doc<"toolExecutions">>
): Promise<{
  callsInserted: number;
  failuresInserted: number;
  durationMsInserted: number;
  durationSamplesInserted: number;
}> {
  const callsByDim: Record<string, number> = {};
  const failuresByDim: Record<string, number> = {};
  const durationSumByDim: Record<string, number> = {};
  const durationCountByDim: Record<string, number> = {};

  for (const r of toolRows) {
    const key = `${r.toolName}::${(r as any).provider ?? "unknown"}`;
    callsByDim[key] = (callsByDim[key] ?? 0) + 1;
    if (!(key in failuresByDim)) failuresByDim[key] = 0;
    if (!r.success) failuresByDim[key] += 1;

    const durationMs = (r as any).durationMs;
    if (typeof durationMs === "number") {
      durationSumByDim[key] = (durationSumByDim[key] ?? 0) + durationMs;
      durationCountByDim[key] = (durationCountByDim[key] ?? 0) + 1;
    }
  }

  async function insertMissing(metricType: string, byDim: Record<string, number>): Promise<number> {
    const existingRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q: any) =>
        q.eq("metric_type", metricType).eq("period", "hourly").eq("bucket_start", hourStart)
      )
      .collect();
    const existingKeys = new Set(existingRows.map((r: any) => reconstructToolUsageKey(r.dimensions)));
    let count = 0;
    for (const [dim, value] of Object.entries(byDim)) {
      if (existingKeys.has(dim)) continue; // idempotency: skip already-aggregated dimension
      const [tool, provider] = dim.split("::");
      await ctx.db.insert("aggregates", {
        metric_type: metricType,
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { tool, provider },
      });
      count++;
    }
    return count;
  }

  const callsInserted = await insertMissing("tool_calls", callsByDim);
  const failuresInserted = await insertMissing("tool_failures", failuresByDim);
  const durationMsInserted = await insertMissing("tool_duration_ms", durationSumByDim);
  const durationSamplesInserted = await insertMissing("tool_duration_samples", durationCountByDim);

  return { callsInserted, failuresInserted, durationMsInserted, durationSamplesInserted };
}

// ---- Hourly aggregation (called by cron every hour) ----
export const computeHourly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const hourStart = Math.floor(now / 3600) * 3600 - 3600; // last completed hour
    const hourEnd = hourStart + 3600;

    // --- Cost aggregation: group by provider+model ---
    // Bounded by an index range + a hard row cap, NOT by a paginate cursor loop
    // (Convex permits one paginated query per function -- see
    // fetchLlmRowsForWindow's note). Keeps each read well inside the 16 MiB/exec
    // limit that the original pagination was reaching for.
    const { rows: llmRows, truncated: llmTruncated } = await fetchLlmRowsForWindow(
      ctx,
      hourStart,
      hourEnd
    );
    if (llmTruncated) {
      // Loud on purpose: past the cap this hour's cost/token buckets UNDERCOUNT,
      // and a silent undercount is exactly what D-03's honesty rule forbids.
      console.warn(
        `[computeHourly] hour ${hourStart} hit the ${LLM_WINDOW_READ_CAP}-row read cap — ` +
          `its cost/token buckets undercount. Raise LLM_WINDOW_READ_CAP or shorten the bucket.`
      );
    }

    const costByDim: Record<string, number> = {};
    // Phase 88 token-fidelity follow-up: sum totalTokens per IDENTICAL dimension
    // key alongside cost so the sunburst can render real per-provider/model token
    // counts (the "cost" buckets carry no token data). Written as its own
    // metric_type "tokens" hourly bucket below, behind its own idempotency guard.
    const tokensByDim: Record<string, number> = {};
    for (const r of llmRows) {
      const billingType = (r as any).billingType ?? getBillingType(r.provider);
      // PULSE-02: extend key with goalId (4th segment) so hourly aggregates are goal-scoped.
      // goalId is "" for non-swarm rows — that is a valid bucket, not a missing value.
      const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
      costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
      tokensByDim[key] = (tokensByDim[key] ?? 0) + ((r as any).totalTokens ?? 0);
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

    // Phase 88 token-fidelity follow-up: parallel "tokens" hourly buckets.
    // Same {provider, model, billingType, goalId} dimensions and the same
    // 4-segment key/defaults as the cost block, behind their OWN per-dimension-key
    // idempotency guard so a re-run of the cron does not double-count tokens.
    const existingTokenRows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "tokens").eq("period", "hourly").eq("bucket_start", hourStart)
      )
      .collect();
    const existingTokenKeys = new Set(
      existingTokenRows.map((r) => {
        const dims = r.dimensions as { provider?: string; model?: string; billingType?: string; goalId?: string } | null;
        // Reconstruct the identical 4-segment key — same defaults as the cost guard.
        return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::${dims?.billingType ?? "api"}::${dims?.goalId ?? ""}`;
      })
    );

    for (const [dim, value] of Object.entries(tokensByDim)) {
      if (existingTokenKeys.has(dim)) continue; // idempotency: skip already-aggregated dimension
      const [provider, model, billingType, goalId] = dim.split("::");
      await ctx.db.insert("aggregates", {
        metric_type: "tokens",
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { provider, model, billingType, goalId },
      });
    }

    // D-04 (Phase 104): tokens_prompt / tokens_completion hourly buckets.
    // These exist so the read path can do `tokens × modelPricing rate` at QUERY
    // time instead of here — correcting or adding a rate then re-prices every
    // chart back to the start of retention without re-running this mutation, and
    // an unpriced bucket heals the moment its rate is entered. Same
    // {provider, model, billingType, goalId} dimension key as the cost/tokens
    // blocks above, filled from the SAME llmRows already fetched (no second
    // scan). Shared with backfillTokenSplit below via insertTokenSplitBuckets
    // so the two paths cannot drift (Task 2).
    await insertTokenSplitBuckets(ctx, hourStart, llmRows);

    // D-04 (Phase 105): tool_calls / tool_failures / tool_duration_ms /
    // tool_duration_samples hourly buckets — a SECOND bounded read (this
    // table is separate from llmMetrics), same cap-and-warn shape as the
    // llmTruncated handling above.
    const { rows: toolRows, truncated: toolTruncated } = await fetchToolRowsForWindow(
      ctx,
      hourStart,
      hourEnd
    );
    if (toolTruncated) {
      console.warn(
        `[computeHourly] hour ${hourStart} hit the ${TOOL_WINDOW_READ_CAP}-row tool read cap — ` +
          `its tool_* buckets undercount. Raise TOOL_WINDOW_READ_CAP or shorten the bucket.`
      );
    }
    await insertToolUsageBuckets(ctx, hourStart, toolRows);

    // Phase 88 (D-02): the event-count ("events") and error-count ("errors")
    // aggregation branches were REMOVED here. Those metrics are now maintained
    // authoritatively at ingest time in events.ingest → incrementEventBucket /
    // incrementSankeyBuckets (convex/analyticsRollup.ts). Re-deriving them from a
    // raw events scan in the cron would double-count every event already counted
    // at ingest time (Pitfall 1). The cron now only aggregates cost.

    // D-14 (Phase 104, hard constraint — not a preference): budget alert
    // evaluation runs HERE, at the tail of the cron that already ran, rather
    // than on its own schedule. This mutation has already read the hour's
    // llmMetrics and already written this hour's token buckets, so
    // evaluating budgets here adds a small, bounded amount of read work
    // (see costBudgetEval.ts's evaluateBudgets doc comment for the exact
    // bound) instead of a new independent scan.
    //
    // A dedicated cron for this is forbidden: convex/crons.ts:27-32 records
    // that the Phase 6 general alert-rule cron
    // (internal.alerts.evaluateInternal) was DISABLED on 2026-07-14 after
    // its fan-out read pattern hit the 15s syscall cap on self-hosted
    // Convex — and a failing cron execution retries on its own backoff
    // regardless of schedule, so the retry storms starved ingest mutations
    // no matter how the schedule was throttled. Routing budget evaluation
    // through this already-running mutation sidesteps that failure mode
    // entirely. Accepted cost: alert latency up to one hour.
    //
    // The try/catch below is MANDATORY, not defensive boilerplate: a throw
    // here would fail computeHourly's whole execution, which would then
    // enter exactly the retry-backoff loop D-14 exists to avoid, and would
    // also lose this hour's rollup buckets (which have already been
    // inserted above, but a thrown mutation still surfaces as a failed run
    // to the scheduler). `now` — not a second `Date.now()` call — is passed
    // through so the budget evaluator's elapsed-hours math cannot disagree
    // with this run's own bucket-boundary math by a few milliseconds.
    try {
      const result = await evaluateBudgets(ctx, now);
      console.log("[computeHourly] budget eval", result);
    } catch (err) {
      console.warn("[computeHourly] budget eval failed:", (err as Error).message);
    }

    // D-06 (Phase 105): tool-policy fail-open alert evaluation runs HERE
    // too, at the tail of the same already-running cron, for the identical
    // reason the budget evaluator above does — see this file's D-14 comment
    // block for the full incident history (internal.alerts.evaluateInternal
    // disabled 2026-07-14). A SEPARATE try/catch, not merged into the block
    // above: one evaluator's failure must never suppress the other, and
    // neither may fail computeHourly's whole execution.
    try {
      const policyResult = await evaluateToolPolicyAlerts(ctx, now);
      console.log("[computeHourly] tool policy alert eval", policyResult);
    } catch (err) {
      console.warn("[computeHourly] tool policy alert eval failed:", (err as Error).message);
    }
  },
});

// ---- Daily rollup (called by cron at 01:00 UTC) ----
// Rolls up 24 hourly rows into daily summaries. Does NOT re-scan raw tables.
// D-04 (Phase 104): the "tokens_prompt" / "tokens_completion" metric types added
// to computeHourly above need NO change here — this mutation groups generically
// by metric_type + JSON.stringify(dimensions), so any metric_type (including the
// two new ones) rolls into daily buckets automatically. Do not "fix" this by
// adding a tokens_prompt/tokens_completion-specific branch.
/** Yesterday's UTC midnight in epoch seconds — the cron's default target day. */
function yesterdayUtcMidnight(): number {
  return Math.floor(Date.now() / 1000 / 86400) * 86400 - 86400;
}

/**
 * Roll one UTC day's hourly rows into daily rows. Returns how many daily rows
 * were inserted, so the COST-01 backfill can report progress.
 *
 * INSERT-ONLY and idempotent per (metric_type, dimensions): a key that already
 * has a daily row for this day is skipped, never re-summed. That guard is load
 * bearing for the backfill below, which walks days the cron may have already
 * covered.
 */
async function rollupOneDay(
  ctx: { db: any },
  dayStart: number
): Promise<number> {
  const hourlyRows = await ctx.db
    .query("aggregates")
    .withIndex("by_period_bucket", (q: any) =>
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
    .withIndex("by_period_bucket", (q: any) =>
      q.eq("period", "daily").gte("bucket_start", dayStart).lt("bucket_start", dayStart + 86400)
    )
    .collect();
  const existingDailyKeys = new Set(
    existingDailyRows.map((r: any) => {
      const dimKey = JSON.stringify(r.dimensions ?? {});
      return `${r.metric_type}::${dimKey}`;
    })
  );

  let inserted = 0;
  for (const [key, entry] of Object.entries(rollup)) {
    if (existingDailyKeys.has(key)) continue;
    await ctx.db.insert("aggregates", {
      metric_type: entry.metric_type,
      period: "daily",
      bucket_start: dayStart,
      value: entry.value,
      dimensions: entry.dimensions,
    });
    inserted++;
  }
  return inserted;
}

/**
 * Retention window in days, from the SAME `agentConfigs["retention_days"]`
 * source backfillTokenSplit uses. Extracted so the nightly repair sweep and the
 * operator backfill cannot drift to two different floors.
 */
async function readRetentionDays(ctx: { db: any }): Promise<number> {
  const retentionConfig = await ctx.db
    .query("agentConfigs")
    .withIndex("by_key", (q: any) => q.eq("configKey", "retention_days"))
    .first();
  return retentionConfig?.value != null ? Number(retentionConfig.value) : 30;
}

/**
 * COST-01 root-cause fix (2026-08-07): which OLDER days tonight's rollup should
 * re-check, in addition to yesterday.
 *
 * Why a rotation and not "just yesterday": rollupDaily only ever processed
 * yesterday and never revisited a day, so any hourly row written for a day that
 * had already passed never got a daily row — silently, and permanently. That is
 * not hypothetical: Phase 104's backfillTokenSplit did exactly this, and the
 * daily cost series read 3.3x low (measured $25.42 vs a true $83.90 over 30d)
 * until it was repaired by hand. Re-checking a slice of the window every night
 * means any future late write self-heals within one full sweep instead of
 * needing a human to notice a number that looks plausible.
 *
 * `offset` walks CONTIGUOUS blocks of `count` days that advance by `count` each
 * run, so consecutive runs tile the whole window regardless of whether `count`
 * divides it evenly. (A stride-based rotation would silently cover only every
 * gcd(count, span)-th day — e.g. count=2 over a 30-day span would revisit only
 * even offsets, forever. The test asserts full coverage for exactly this
 * reason.)
 *
 * Pure and exported so that coverage property is tested against explicit
 * inputs, with no clock involved.
 */
export function repairDayTargets(
  yesterday: number,
  dayIndex: number,
  retentionDays: number,
  count: number
): number[] {
  // Offsets run 1..span days back from yesterday; yesterday itself (offset 0)
  // is always rolled up separately, so it is excluded here.
  const span = Math.max(1, Math.floor(retentionDays) - 1);
  const n = Math.max(0, Math.floor(count));
  const targets: number[] = [];
  for (let i = 0; i < n && i < span; i++) {
    const offset = ((dayIndex * n + i) % span) + 1;
    targets.push(yesterday - offset * 86400);
  }
  return targets;
}

/** How many older days each nightly run re-checks. See the try/catch note below. */
const DAILY_REPAIR_DAYS_PER_RUN = 2;

export const rollupDaily = internalMutation({
  // COST-01: `dayStart` is optional and defaults to yesterday, so the 01:00 UTC
  // cron entry in convex/crons.ts keeps calling this with no args and behaves
  // exactly as before. The arg exists so a specific historical day can be
  // rolled up on demand — see backfillDailyRollup below.
  args: {
    dayStart: v.optional(v.float64()),
    repairDays: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    // `args?.` not `args.`: Convex always passes an args object in production,
    // but the fake-ctx tests invoke this raw handler as _handler(ctx) with none
    // — which is exactly how the cron's zero-arg call reads. Tolerating both
    // keeps those tests exercising the real cron path instead of a rewritten one.
    const explicitDay = args?.dayStart;
    const dayStart = explicitDay ?? yesterdayUtcMidnight();
    await rollupOneDay(ctx, dayStart);

    // An explicit dayStart means "roll up exactly this day" (that is how
    // backfillDailyRollup and the operator both drive it), so the sweep is
    // scoped to the default cron path only — otherwise the backfill would
    // recursively re-sweep on every one of its own day steps.
    if (explicitDay != null) return;

    // The try/catch is MANDATORY, not defensive boilerplate — same reasoning as
    // the budget-eval tail in computeHourly above (D-14): a throw here would
    // fail the whole cron execution, which then retries on its own backoff and
    // produces exactly the retry-storm that got three other crons disabled on
    // 2026-07-14 (see convex/crons.ts). Yesterday's rollup has already been
    // written by this point, so a failed repair sweep degrades to the old
    // behaviour rather than losing the night's real work.
    try {
      const retentionDays = await readRetentionDays(ctx);
      const targets = repairDayTargets(
        dayStart,
        Math.floor(Date.now() / 1000 / 86400),
        retentionDays,
        args?.repairDays ?? DAILY_REPAIR_DAYS_PER_RUN
      );
      let repaired = 0;
      for (const day of targets) {
        repaired += await rollupOneDay(ctx, day);
      }
      // Only log when the sweep actually FOUND something. A silent repair would
      // hide the very condition this exists to catch, and a line every night
      // saying "0" trains you to ignore it.
      if (repaired > 0) {
        console.warn(
          `[rollupDaily] repair sweep inserted ${repaired} missing daily row(s) for ` +
            `${targets.join(", ")} — a late hourly write had left these days short.`
        );
      }
    } catch (err) {
      console.warn("[rollupDaily] repair sweep failed:", (err as Error).message);
    }
  },
});

// ---- COST-01 (2026-08-07): resumable backfill of MISSING daily rows ---------
//
// Why this exists: rollupDaily only ever processed yesterday and never revisited
// a day. Phase 104's backfillTokenSplit wrote historical HOURLY token buckets
// long after those days had passed, so those hours never got daily rows. Live
// measurement on 2026-08-07 (self-hosted, 127.0.0.1:3210):
//
//   lookbackHours   costBreakdown(hourly)   costBreakdown(daily)
//   168                          $26.28                  $21.99
//   336                          $44.76                  $25.42
//   720                          $88.86                  $25.42   <- flatlined
//
// The daily series simply stops ~14 days back while hourly runs the full 30.
//
// Same operator-driven shape as backfillTokenSplit above (NOT a cron — see the
// disabled-cron incident note in convex/crons.ts): small hard-capped work per
// invocation, resumable via a cursor, insert-only.
//
//   npx convex run aggregates:backfillDailyRollup '{"maxDays": 7}'
//
// Repeat until the returned `done` is true.
const DAILY_ROLLUP_BACKFILL_CURSOR_KEY = "cost01.dailyRollupBackfill.cursor";

export const backfillDailyRollup = internalMutation({
  args: { maxDays: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const maxDays = args.maxDays ?? 7;

    // Same retention floor source as backfillTokenSplit — deliberately reusing
    // agentConfigs["retention_days"] rather than inventing a second number.
    const retentionConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();
    const retentionDays = retentionConfig?.value != null ? Number(retentionConfig.value) : 30;
    const retentionFloorDay =
      Math.floor((Date.now() / 1000 - retentionDays * 86400) / 86400) * 86400;

    const cursorRows = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", DAILY_ROLLUP_BACKFILL_CURSOR_KEY))
      .collect();
    // Insert-only cursor: last row (ascending _creationTime) is current.
    const cursorRow = cursorRows.length > 0 ? cursorRows[cursorRows.length - 1] : null;

    // COST-01 follow-up (2026-08-07): this cursor used to LATCH. A completed
    // sweep persisted the string "done", and the handler's first act was to
    // return early on it — so the repair tool was single-use. Once it had run,
    // it reported `done: true` and `rowsInserted: 0` forever while doing
    // nothing, which is the same silent-under-report failure this whole fix
    // exists to eliminate, one level up: the tool you reach for to check
    // whether daily rows are missing would answer "all good" without looking.
    //
    // A finished sweep now RESETS to yesterday instead of latching, so the next
    // invocation starts a fresh pass. `done: true` is still returned, so an
    // operator loop that repeats "until done" still terminates after one pass.
    //
    // Reading a legacy "done" (or any non-finite value) as "start fresh" is
    // deliberate: it un-sticks the row already sitting in the live DB from the
    // first run, with no hand-editing of agentConfigs.
    const yesterday = yesterdayUtcMidnight();
    const rawCursor = cursorRow?.value;
    let cursor: number =
      rawCursor == null || rawCursor === "done" || !Number.isFinite(Number(rawCursor))
        ? yesterday
        : Number(rawCursor);

    // A cursor outside the window is meaningless — restart the sweep rather
    // than walking days that can never be rolled up. (Retention shrinking, or a
    // resumed cursor going stale across days, both land here.)
    if (cursor > yesterday || cursor < retentionFloorDay) {
      cursor = yesterday;
    }

    let daysProcessed = 0;
    let rowsInserted = 0;
    let done = false;

    while (daysProcessed < maxDays) {
      if (cursor < retentionFloorDay) {
        done = true;
        break;
      }
      rowsInserted += await rollupOneDay(ctx, cursor);
      daysProcessed++;
      cursor = cursor - 86400;
    }

    if (!done && cursor < retentionFloorDay) {
      done = true;
    }

    // Reset-on-completion, never latch — see the cursor note above. `done` is
    // still reported so a "repeat until done" operator loop terminates.
    const nextCursorValue: number = done ? yesterday : cursor;
    await ctx.db.insert("agentConfigs", {
      configKey: DAILY_ROLLUP_BACKFILL_CURSOR_KEY,
      value: nextCursorValue,
      source: "runtime",
      updatedAt: Date.now() / 1000,
    });

    return { daysProcessed, rowsInserted, nextCursor: nextCursorValue, done };
  },
});

// ---- D-04 (Phase 104): resumable, batch-capped backfill of historical
// tokens_prompt/tokens_completion buckets ----------------------------------

const TOKEN_SPLIT_BACKFILL_CURSOR_KEY = "phase104.tokenSplitBackfill.cursor";

/**
 * Same bounded llmMetrics read shape as computeHourly's — never a bare
 * .collect(), and never a paginate cursor loop (this function is called once per
 * hour inside a maxHours loop, so any paginate here means N paginated queries in
 * one mutation, which Convex rejects outright).
 */
async function fetchLlmRowsForHour(
  ctx: { db: any },
  hourStart: number,
  hourEnd: number
): Promise<{ rows: Array<Doc<"llmMetrics">>; truncated: boolean }> {
  return fetchLlmRowsForWindow(ctx, hourStart, hourEnd);
}

/**
 * Manual, resumable, INSERT-ONLY backfill of tokens_prompt/tokens_completion hourly
 * buckets for hours BEFORE this deploy, so D-04's "a rate correction re-prices every
 * chart back to the start of retention" holds for history, not only new hours.
 *
 * Invocation (repeat until the return value's `done` is true — NOT a cron):
 *   npx convex run aggregates:backfillTokenSplit '{"maxHours": 6}'
 *
 * Not registered in convex/crons.ts on purpose. See the disabled-cron incident
 * note there (2026-07-14): an unattended long-running/self-retriggering mutation
 * on self-hosted Convex starves ingest via retry storms regardless of schedule.
 * This mutation instead does a small, hard-capped amount of work per invocation
 * and lets an operator decide whether/when to call it again.
 *
 * Retention floor: llmMetrics is one of the tables convex/retention.ts's own
 * comment marks "kept forever" (it is not in that module's PRUNED_TABLES — only
 * the runtime-firehose/build-history tables are physically deleted there; since
 * Phase 110 D-01 that now also includes `aggregates` `period:"hourly"` rows
 * specifically — `period:"daily"` rows stay exempt via
 * PRUNE_PREDICATES.aggregates). The
 * retention window that DOES apply to llmMetrics specifically is
 * `agentConfigs["retention_days"]` (convex/archival.ts's markStaleArchived,
 * default 30, clamped 1-365 — the sibling retention module for this exact
 * table). Reusing that existing, already-configurable value here — rather than
 * inventing a third, independent retention number — is what "do not hardcode a
 * second retention number" means in practice, since retention.ts itself defines
 * none for this table.
 *
 * Resume position: agentConfigs["phase104.tokenSplitBackfill.cursor"], whose
 * value is the bucket_start (epoch seconds) of the NEXT hour to process.
 * Written via ctx.db.insert ONLY (never patch) — the newest row for that
 * configKey (by insertion/_creationTime order, Convex's default collect()
 * order) is the current cursor. This keeps the whole mutation insert-only
 * end to end, matching the aggregates writes above.
 *
 * Phase 121 follow-up (D-08, mirroring the COST-01 fix already shipped on
 * backfillDailyRollup below): this cursor used to LATCH. A completed sweep
 * persisted the string "done", and the handler's first act was to return
 * early on it — so the tool was single-use, and once `calls` (Task 2) started
 * riding this same backfill, that latch made 30 days of `calls` history
 * permanently unreachable without hand-editing agentConfigs.
 *
 * A finished sweep now RESETS to the most recently completed hour instead of
 * latching, exactly like backfillDailyRollup's day cursor, so the next
 * invocation starts a fresh pass. `done: true` is still returned, so an
 * operator loop that repeats "until done" still terminates after one pass.
 * A reset re-run is safe (never a double-count) because every insert this
 * mutation makes is already per-dimension-key idempotent via
 * insertTokenSplitBuckets's own guards — a second pass over an
 * already-covered hour inserts nothing for any of the three metric types.
 * The cost of a re-run is re-READING those hours (a bounded llmMetrics window
 * read per hour), never re-WRITING them.
 *
 * Reading a legacy "done" (or any non-finite value) as "start fresh" is
 * deliberate: it un-sticks the row already sitting in the live DB from an
 * earlier run, with no hand-editing of agentConfigs.
 */
export const backfillTokenSplit = internalMutation({
  args: { maxHours: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    const maxHours = args.maxHours ?? 6;

    const retentionConfig = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();
    const retentionDays = retentionConfig?.value != null ? Number(retentionConfig.value) : 30;
    const retentionFloorHour =
      Math.floor((Date.now() / 1000 - retentionDays * 86400) / 3600) * 3600;

    const cursorRows = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", TOKEN_SPLIT_BACKFILL_CURSOR_KEY))
      .collect();
    // Insert-only cursor: the last row (ascending _creationTime, Convex's default
    // collect() order) is the most recently written cursor value.
    const cursorRow = cursorRows.length > 0 ? cursorRows[cursorRows.length - 1] : null;

    // Freshest hour a brand-new pass would start from — the same expression a
    // first-ever run has always used, and the value a completed pass now
    // resets to instead of latching (see the doc comment above).
    const startingHour = Math.floor(Date.now() / 1000 / 3600) * 3600 - 3600;

    const rawCursor = cursorRow?.value;
    let cursor: number =
      rawCursor == null || rawCursor === "done" || !Number.isFinite(Number(rawCursor))
        ? startingHour
        : Number(rawCursor);

    // A cursor outside the window is meaningless — restart the sweep rather
    // than walking hours that can never be filled. Mirrors
    // backfillDailyRollup's identical clamp below.
    if (cursor > startingHour || cursor < retentionFloorHour) {
      cursor = startingHour;
    }

    let hoursProcessed = 0;
    let rowsInserted = 0;
    let done = false;
    const truncatedHours: number[] = [];

    while (hoursProcessed < maxHours) {
      if (cursor < retentionFloorHour) {
        done = true;
        break;
      }
      const hourStart = cursor;
      const hourEnd = hourStart + 3600;
      const { rows: llmRows, truncated } = await fetchLlmRowsForHour(ctx, hourStart, hourEnd);
      if (truncated) {
        // Record rather than swallow: this hour's token buckets undercount, and
        // the operator needs to know WHICH hour so it can be re-run at a larger
        // cap instead of silently trusting a short total.
        truncatedHours.push(hourStart);
        console.warn(
          `[backfillTokenSplit] hour ${hourStart} hit the ${LLM_WINDOW_READ_CAP}-row read cap — its token buckets undercount.`
        );
      }
      const { promptInserted, completionInserted, callsInserted } = await insertTokenSplitBuckets(ctx, hourStart, llmRows);
      rowsInserted += promptInserted + completionInserted + callsInserted;
      hoursProcessed++;
      cursor = hourStart - 3600;
    }

    if (!done && cursor < retentionFloorHour) {
      done = true;
    }

    // Reset-on-completion, never latch — see the cursor note in the doc
    // comment above. `done` is still reported so a "repeat until done"
    // operator loop terminates.
    const nextCursorValue: number = done ? startingHour : cursor;
    await ctx.db.insert("agentConfigs", {
      configKey: TOKEN_SPLIT_BACKFILL_CURSOR_KEY,
      value: nextCursorValue,
      source: "runtime",
      updatedAt: Date.now() / 1000,
    });

    return { hoursProcessed, rowsInserted, nextCursor: nextCursorValue, done, truncatedHours };
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
    assertAggregatePeriod(args.period, "costByPeriod"); // COST-01
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
    assertAggregatePeriod(args.period, "costByPeriodByProvider"); // COST-01
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
    assertAggregatePeriod(args.period, "errorTrendByPeriod"); // COST-01
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

// ---- PULSE-02 / Phase 104 D-01 (RESEARCH.md Open Question 1, resolved YES —
// see 104-05-PLAN.md): Per-goal cost query, direct llmMetrics by_goal scan.
// Reads llmMetrics directly via the by_goal index (added in Plan 149-01).
// This single query covers both live goals (cost before next cron tick) and
// completed goals — no aggregates-vs-llmMetrics branching needed (~100 rows/run max).
//
// Phase 104 D-01: dollars are now RECOMPUTED from tokens x modelPricing rate
// via the same deriveBucketDollars() every other cost surface in the phase
// uses — this query no longer trusts the ingested `cost` field as the
// rendered truth. The ingested figure survives as `reportedTotal`
// (evidence, not truth) so a discrepancy stays observable (D-01/T-104-21).
// Do not rename any field on this shape back to a bare `cost` or a combined
// total-`cost` name — that
// silently reintroduces a consumer reading the old, no-longer-true number.
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

    const index = buildRateIndex(await ctx.db.query("modelPricing").collect());

    // Group by provider::model, accumulating TOKENS (not cost) plus the
    // ingested cost as evidence — dollars are derived below.
    const grouped: Record<
      string,
      { provider: string; model: string; billingType: string; promptTokens: number; completionTokens: number }
    > = {};
    let reportedTotal = 0;
    for (const r of rows) {
      const billingType = (r as any).billingType ?? getBillingType(r.provider);
      const key = `${r.provider}::${r.model}`;
      if (!grouped[key]) {
        grouped[key] = { provider: r.provider, model: r.model, billingType, promptTokens: 0, completionTokens: 0 };
      }
      grouped[key].promptTokens += (r as any).promptTokens ?? 0;
      grouped[key].completionTokens += (r as any).completionTokens ?? 0;
      reportedTotal += r.cost ?? 0;
    }

    const derivedRows = Object.values(grouped).map((g) =>
      deriveBucketDollars(
        { provider: g.provider, model: g.model, billingType: g.billingType },
        g.promptTokens,
        g.completionTokens,
        index
      )
    );

    // billedTotal and coveredTotal are summed SEPARATELY (D-05) — never one
    // combined figure.
    let billedTotal = 0;
    let coveredTotal = 0;
    const unpricedPairs = new Set<string>();
    for (const r of derivedRows) {
      if (r.billedUsd !== null) billedTotal += r.billedUsd;
      if (r.coveredUsd !== null) coveredTotal += r.coveredUsd;
      if (!r.priced) unpricedPairs.add(`${r.provider}::${r.model}`);
    }

    return {
      rows: derivedRows,
      billedTotal,
      coveredTotal,
      unpricedModelCount: unpricedPairs.size,
      reportedTotal,
    };
  },
});

// ---- PULSE-02 / Phase 104 D-01: Per-goal raw LLM rows for tier-flag join
// (Plan 04 CostBreakdown). Returns per-row {agentId, model, provider,
// promptTokens, completionTokens, billingType, billedUsd, reportedCost} for
// a goalId so CostBreakdown can join agentId -> model tier AND render the
// same recomputed dollar figure costByGoalPeriod uses. Separate from
// costByGoalPeriod to avoid overloading the grouped shape with raw row data.
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

    const index = buildRateIndex(await ctx.db.query("modelPricing").collect());

    return rows.map((r) => {
      const billingType = (r as any).billingType ?? getBillingType(r.provider);
      const promptTokens = (r as any).promptTokens ?? 0;
      const completionTokens = (r as any).completionTokens ?? 0;
      const derived = deriveBucketDollars(
        { provider: r.provider, model: r.model, billingType },
        promptTokens,
        completionTokens,
        index
      );
      return {
        agentId: (r as any).agentId as string | undefined,
        model: r.model,
        provider: r.provider,
        promptTokens,
        completionTokens,
        billingType,
        billedUsd: derived.billedUsd,
        reportedCost: r.cost ?? 0,
      };
    });
  },
});

export const eventCountsByPeriod = query({
  args: {
    period: v.string(),
    lookbackDays: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    assertAggregatePeriod(args.period, "eventCountsByPeriod"); // COST-01
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
