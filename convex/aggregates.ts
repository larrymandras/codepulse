import { internalMutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { getBillingType } from "./lib/providers";
import { buildRateIndex } from "./modelPricing";
import { deriveBucketDollars } from "./costDerived";

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
 */
async function insertTokenSplitBuckets(
  ctx: { db: any },
  hourStart: number,
  llmRows: Array<Doc<"llmMetrics">>
): Promise<{ promptInserted: number; completionInserted: number }> {
  const promptByDim: Record<string, number> = {};
  const completionByDim: Record<string, number> = {};
  for (const r of llmRows) {
    const billingType = (r as any).billingType ?? getBillingType(r.provider);
    const key = `${r.provider}::${r.model}::${billingType}::${(r as any).goalId ?? ""}`;
    promptByDim[key] = (promptByDim[key] ?? 0) + ((r as any).promptTokens ?? 0);
    completionByDim[key] = (completionByDim[key] ?? 0) + ((r as any).completionTokens ?? 0);
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
  return { promptInserted, completionInserted };
}

// ---- Hourly aggregation (called by cron every hour) ----
export const computeHourly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const hourStart = Math.floor(now / 3600) * 3600 - 3600; // last completed hour
    const hourEnd = hourStart + 3600;

    // --- Cost aggregation: group by provider+model ---
    // D-03 / Pitfall: paginate the llmMetrics read instead of an unbounded
    // .collect(). A high-volume hour can exceed the 16 MiB/exec read limit and
    // silently fail the cron; cursor pages keep each read bounded.
    const LLM_PAGE_SIZE = 500; // tunable batch size for the cost-read pagination
    const llmRows: Array<Doc<"llmMetrics">> = [];
    let llmCursor: string | null = null;
    while (true) {
      const page = await ctx.db
        .query("llmMetrics")
        .withIndex("by_timestamp", (q) =>
          q.gte("timestamp", hourStart).lt("timestamp", hourEnd)
        )
        .filter((q) => q.neq(q.field("archived"), true))
        .paginate({ numItems: LLM_PAGE_SIZE, cursor: llmCursor });
      llmRows.push(...page.page);
      if (page.isDone) break;
      llmCursor = page.continueCursor;
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

    // Phase 88 (D-02): the event-count ("events") and error-count ("errors")
    // aggregation branches were REMOVED here. Those metrics are now maintained
    // authoritatively at ingest time in events.ingest → incrementEventBucket /
    // incrementSankeyBuckets (convex/analyticsRollup.ts). Re-deriving them from a
    // raw events scan in the cron would double-count every event already counted
    // at ingest time (Pitfall 1). The cron now only aggregates cost.
  },
});

// ---- Daily rollup (called by cron at 01:00 UTC) ----
// Rolls up 24 hourly rows into daily summaries. Does NOT re-scan raw tables.
// D-04 (Phase 104): the "tokens_prompt" / "tokens_completion" metric types added
// to computeHourly above need NO change here — this mutation groups generically
// by metric_type + JSON.stringify(dimensions), so any metric_type (including the
// two new ones) rolls into daily buckets automatically. Do not "fix" this by
// adding a tokens_prompt/tokens_completion-specific branch.
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

// ---- D-04 (Phase 104): resumable, batch-capped backfill of historical
// tokens_prompt/tokens_completion buckets ----------------------------------

const TOKEN_SPLIT_BACKFILL_CURSOR_KEY = "phase104.tokenSplitBackfill.cursor";
const BACKFILL_LLM_PAGE_SIZE = 500;

/** Same bounded, paginated llmMetrics read shape as computeHourly's — never a bare .collect(). */
async function fetchLlmRowsForHour(
  ctx: { db: any },
  hourStart: number,
  hourEnd: number
): Promise<Array<Doc<"llmMetrics">>> {
  const rows: Array<Doc<"llmMetrics">> = [];
  let cursor: string | null = null;
  while (true) {
    const result: { page: Array<Doc<"llmMetrics">>; isDone: boolean; continueCursor: string } =
      await ctx.db
        .query("llmMetrics")
        .withIndex("by_timestamp", (q: any) => q.gte("timestamp", hourStart).lt("timestamp", hourEnd))
        .filter((q: any) => q.neq(q.field("archived"), true))
        .paginate({ numItems: BACKFILL_LLM_PAGE_SIZE, cursor });
    rows.push(...result.page);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  return rows;
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
 * the runtime-firehose/build-history tables are physically deleted there). The
 * retention window that DOES apply to llmMetrics specifically is
 * `agentConfigs["retention_days"]` (convex/archival.ts's markStaleArchived,
 * default 30, clamped 1-365 — the sibling retention module for this exact
 * table). Reusing that existing, already-configurable value here — rather than
 * inventing a third, independent retention number — is what "do not hardcode a
 * second retention number" means in practice, since retention.ts itself defines
 * none for this table.
 *
 * Resume position: agentConfigs["phase104.tokenSplitBackfill.cursor"], whose
 * value is the bucket_start (epoch seconds) of the NEXT hour to process, or the
 * string "done" once the retention floor is reached. Written via ctx.db.insert
 * ONLY (never patch) — the newest row for that configKey (by insertion/
 * _creationTime order, Convex's default collect() order) is the current cursor.
 * This keeps the whole mutation insert-only end to end, matching the aggregates
 * writes above.
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

    if (cursorRow?.value === "done") {
      return { hoursProcessed: 0, rowsInserted: 0, nextCursor: "done" as const, done: true };
    }

    let cursor: number =
      cursorRow?.value != null
        ? Number(cursorRow.value)
        : Math.floor(Date.now() / 1000 / 3600) * 3600 - 3600;

    let hoursProcessed = 0;
    let rowsInserted = 0;
    let done = false;

    while (hoursProcessed < maxHours) {
      if (cursor < retentionFloorHour) {
        done = true;
        break;
      }
      const hourStart = cursor;
      const hourEnd = hourStart + 3600;
      const llmRows = await fetchLlmRowsForHour(ctx, hourStart, hourEnd);
      const { promptInserted, completionInserted } = await insertTokenSplitBuckets(ctx, hourStart, llmRows);
      rowsInserted += promptInserted + completionInserted;
      hoursProcessed++;
      cursor = hourStart - 3600;
    }

    if (!done && cursor < retentionFloorHour) {
      done = true;
    }

    const nextCursorValue: number | "done" = done ? "done" : cursor;
    await ctx.db.insert("agentConfigs", {
      configKey: TOKEN_SPLIT_BACKFILL_CURSOR_KEY,
      value: nextCursorValue,
      source: "runtime",
      updatedAt: Date.now() / 1000,
    });

    return { hoursProcessed, rowsInserted, nextCursor: nextCursorValue, done };
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
