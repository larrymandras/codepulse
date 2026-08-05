// Phase 88 — Analytics Rollup write path.
//
// Ingest-time bucket maintenance for the `aggregates` table. These helpers are
// called from inside the events.ingest mutation (one OCC transaction) so the
// "events" event-count and "sankey_edge" flow metrics are authoritatively
// maintained at write time — the hourly cron no longer scans raw events for
// these counts (D-02, Pitfall 1).
//
// All bucket lookups COLLECT the slim aggregates rows for the (metric_type,
// period, bucket_start) tuple and match the dimension key in JS — never a
// v.any() object-equality filter on `dimensions` (Pitfall 3). aggregates rows
// carry no payload: v.any(), so the per-bucket collect stays small.

import { action, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import type { PaginationResult } from "convex/server";
import { categoryOf, outcomeOf } from "./lib/sankeyClassify";
import { getBillingType } from "./lib/providers";
import { pickShard } from "./lib/aggregateShard";
import { dimensionKeyFor, sankeyDimensionKey } from "./lib/aggregateDimensionKey";

// ---- Ingest-time increment helpers (called inside events.ingest) ----

// Increment the "events" rollup bucket for {eventType, hour, shard}:
// read-patch-or-insert. Phase 107 (D-01): shard is an explicit required
// parameter, drawn ONCE by the caller (never inside this helper) and matched
// with STRICT equality below — a stored shard of undefined does NOT match a
// caller-supplied shard, unlike a nullish-coalescing default would. This means
// a pre-deploy legacy row with no shard field is never patched again, so the
// hot document that caused the OCC incident stops absorbing writes entirely
// instead of continuing to take 1/8 of them. The read side stays correct
// because every reader sums all matching rows and never branches on shard.
export async function incrementEventBucket(
  ctx: MutationCtx,
  eventType: string,
  timestamp: number,
  shard: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;

  // Phase 107 plan 07: point lookup, not a bucket scan. Every field is pinned
  // with eq(), so this transaction's READ SET is one row. The previous version
  // .collect()ed the whole (metric_type, period, bucket_start) bucket and matched
  // the dimension in JS, which put every row in the hour into the read set —
  // and Convex OCC conflicts on documents read from OR written to, so every
  // concurrent ingest in the same hour retried no matter which row it wrote.
  // That is the half of OCC-01 that 107-03 left open and 107-06 measured as a
  // +70.5% regression.
  const existing = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket_key_shard", (q) =>
      q
        .eq("metric_type", "events")
        .eq("period", "hourly")
        .eq("bucket_start", hourStart)
        .eq("dimension_key", eventType)
        .eq("shard", shard)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "events",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { event_type: eventType },
      dimension_key: eventType,
      shard,
    });
  }
}

// Increment the TWO "sankey_edge" buckets for an event:
//   Edge A: categoryOf(eventType) → (toolName ?? eventType)
//   Edge B: (toolName ?? eventType) → outcomeOf(eventType)
// Phase 107 (D-01): shard is an explicit required parameter forwarded to
// BOTH edges unchanged — one draw covers the whole ingest call, so this
// function draws no shard of its own.
export async function incrementSankeyBuckets(
  ctx: MutationCtx,
  eventType: string,
  toolName: string | undefined,
  timestamp: number,
  shard: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;
  const category = categoryOf(eventType);
  const tool = toolName ?? eventType;
  const outcome = outcomeOf(eventType);

  await incrementSankeyEdge(ctx, hourStart, category, tool, shard);
  await incrementSankeyEdge(ctx, hourStart, tool, outcome, shard);
}

// Private: read-patch-or-insert one "sankey_edge" {source, target} bucket.
// Strict shard equality — see incrementEventBucket's header comment for why.
async function incrementSankeyEdge(
  ctx: MutationCtx,
  hourStart: number,
  source: string,
  target: string,
  shard: number
): Promise<void> {
  // Phase 107 plan 07: point lookup — see incrementEventBucket's header for why
  // the whole-bucket .collect() this replaces was the unfixed half of OCC-01.
  const dimensionKey = sankeyDimensionKey(source, target);
  const existing = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket_key_shard", (q) =>
      q
        .eq("metric_type", "sankey_edge")
        .eq("period", "hourly")
        .eq("bucket_start", hourStart)
        .eq("dimension_key", dimensionKey)
        .eq("shard", shard)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "sankey_edge",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { source, target },
      dimension_key: dimensionKey,
      shard,
    });
  }
}

// ---- Backfill: re-derive ingest-time buckets from existing events ----
//
// Phase 88 hardening (gap-closure — the original per-event read-patch-or-insert
// backfill amplified reads: each event re-`.collect()`d every bucket row for its
// hour, so a single mutation page read 12k+ docs and the action blew its time
// budget at ~272k events, leaving partially-committed buckets). The rewrite:
//   1. Aggregates counts IN MEMORY across the scan — ZERO per-event DB reads.
//   2. Clears the stale historical bucket range once (idempotent).
//   3. Writes each bucket exactly once with pure inserts.
// It is amplification-free and safely RE-RUNNABLE (re-running clears + rebuilds).
//
// Coexistence with live ingest: ingest-time increments own the CURRENT hour and
// forward. The backfill only rebuilds COMPLETED past hours (bucket_start <
// cutoffHour) and clears only that range, so it never races the live current-hour
// bucket — eliminating the post-deploy double-count window of the old design.

// internalMutation (NEVER a public mutation): callable only via
// internal.analyticsRollup.incrementBatch. Kept for API/test stability; the
// ingest path uses the increment helpers directly. A public increment endpoint
// would be an unauthenticated tampering surface (T-88-03).
export const incrementBatch = internalMutation({
  args: {
    events: v.array(
      v.object({
        eventType: v.string(),
        toolName: v.optional(v.string()),
        timestamp: v.float64(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const e of args.events) {
      // Mirrors events.ingest's one-draw-per-event rule: each event in the
      // batch spreads independently, drawn once and shared by both helper
      // calls for that event.
      const shard = pickShard();
      await incrementEventBucket(ctx, e.eventType, e.timestamp, shard);
      await incrementSankeyBuckets(ctx, e.eventType, e.toolName, e.timestamp, shard);
    }
  },
});

// ---- Pure in-memory aggregation (testable without Convex) ----

export interface EventBucketAcc {
  bucket_start: number;
  dimensions: { event_type: string };
  value: number;
}
export interface SankeyBucketAcc {
  bucket_start: number;
  dimensions: { source: string; target: string };
  value: number;
}
// Phase 88 token-fidelity follow-up: one accumulator entry per
// {hour, provider, model, billingType, goalId}; value = summed totalTokens.
export interface TokenBucketAcc {
  bucket_start: number;
  dimensions: { provider: string; model: string; billingType: string; goalId: string };
  value: number;
}

// Fold one event into the in-memory accumulators (mutates the maps). Events in
// the current/future hour (>= cutoffHour) are SKIPPED — live ingest owns those,
// so the backfill never double-counts them. Exported for unit tests.
export function accumulateEvent(
  eventsAcc: Map<string, EventBucketAcc>,
  sankeyAcc: Map<string, SankeyBucketAcc>,
  e: { eventType: string; toolName?: string; timestamp: number },
  cutoffHour: number
): void {
  const hour = Math.floor(e.timestamp / 3600) * 3600;
  if (hour >= cutoffHour) return;

  const ek = `${hour} ${e.eventType}`;
  const ev = eventsAcc.get(ek);
  if (ev) ev.value += 1;
  else eventsAcc.set(ek, { bucket_start: hour, dimensions: { event_type: e.eventType }, value: 1 });

  const category = categoryOf(e.eventType);
  const tool = e.toolName ?? e.eventType;
  const outcome = outcomeOf(e.eventType);
  const edges: ReadonlyArray<readonly [string, string]> = [
    [category, tool],
    [tool, outcome],
  ];
  for (const [source, target] of edges) {
    const sk = `${hour} ${source} ${target}`;
    const sv = sankeyAcc.get(sk);
    if (sv) sv.value += 1;
    else sankeyAcc.set(sk, { bucket_start: hour, dimensions: { source, target }, value: 1 });
  }
}

// Phase 88 token-fidelity follow-up: fold one llmMetrics row into the in-memory
// token accumulator (mutates the map). Rows in the current/future hour
// (>= cutoffHour) are SKIPPED — the hourly cron owns those, so the backfill never
// double-counts them. Mirrors accumulateEvent. Exported for unit tests.
export function accumulateLlmTokens(
  acc: Map<string, TokenBucketAcc>,
  r: {
    provider: string;
    model: string;
    billingType: string;
    goalId: string;
    totalTokens: number;
    timestamp: number;
  },
  cutoffHour: number
): void {
  const hour = Math.floor(r.timestamp / 3600) * 3600;
  if (hour >= cutoffHour) return;

  const key = `${hour} ${r.provider} ${r.model} ${r.billingType} ${r.goalId}`;
  const existing = acc.get(key);
  if (existing) {
    existing.value += r.totalTokens;
  } else {
    acc.set(key, {
      bucket_start: hour,
      dimensions: {
        provider: r.provider,
        model: r.model,
        billingType: r.billingType,
        goalId: r.goalId,
      },
      value: r.totalTokens,
    });
  }
}

// internalMutation: delete one bounded page of historical event/sankey buckets
// (bucket_start < cutoffHour). Looped from the action until it returns 0.
export const clearHistoricalBucketsPage = internalMutation({
  args: { cutoffHour: v.float64(), limit: v.float64() },
  handler: async (ctx, args) => {
    let deleted = 0;
    for (const metric_type of ["events", "sankey_edge"] as const) {
      const rows = await ctx.db
        .query("aggregates")
        .withIndex("by_type_period_bucket", (q) =>
          q.eq("metric_type", metric_type).eq("period", "hourly").lt("bucket_start", args.cutoffHour)
        )
        .take(args.limit);
      for (const r of rows) {
        await ctx.db.delete(r._id);
        deleted++;
      }
      if (deleted >= args.limit) break; // respect the per-mutation write budget
    }
    return { deleted };
  },
});

// internalMutation: insert a batch of pre-aggregated buckets. Pure inserts — the
// historical range was cleared first, so no read/dedup is needed (each (hour,
// dimensions) was aggregated to exactly one row in memory).
export const insertBucketsBatch = internalMutation({
  args: {
    metric_type: v.string(),
    buckets: v.array(
      v.object({
        bucket_start: v.float64(),
        dimensions: v.any(),
        value: v.float64(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const b of args.buckets) {
      await ctx.db.insert("aggregates", {
        metric_type: args.metric_type,
        period: "hourly",
        bucket_start: b.bucket_start,
        value: b.value,
        dimensions: b.dimensions,
        // Phase 107 plan 07: derived through the SAME function the live write
        // path uses, so the two can never disagree about a key's spelling. This
        // is uniformity, not a bug fix — the backfill only rebuilds hours before
        // cutoffHour while live ingest owns the current hour forward, so the two
        // writers are already disjoint and never look up each other's rows.
        dimension_key: dimensionKeyFor(args.metric_type, b.dimensions),
      });
    }
    return { inserted: args.buckets.length };
  },
});

// One-shot backfill action (operator-gated). Three phases:
//   1. Clear the stale historical bucket range (< current hour).
//   2. Scan every event via paginated queries, aggregating counts in memory.
//   3. Write each aggregated bucket once via batched pure inserts.
// Actions cannot touch ctx.db directly — read via ctx.runQuery, write via
// ctx.runMutation. Safe to re-run: each run re-clears then rebuilds.
export const backfillHistorical = action({
  args: {},
  handler: async (ctx) => {
    const CLEAR_PAGE = 500;
    const WRITE_CHUNK = 500;
    const SCAN_PAGE = 300;
    // cutoffHour = start of the current hour. Past hours are rebuilt; the current
    // hour and forward stay with live ingest. Date.now() is permitted in actions.
    const cutoffHour = Math.floor(Date.now() / 1000 / 3600) * 3600;

    // Phase 1 — clear stale historical buckets (idempotent).
    let cleared = 0;
    while (true) {
      const { deleted } = await ctx.runMutation(
        internal.analyticsRollup.clearHistoricalBucketsPage,
        { cutoffHour, limit: CLEAR_PAGE }
      );
      cleared += deleted;
      if (deleted === 0) break;
    }

    // Phase 2 — scan all events, aggregate in memory (no per-event DB reads).
    const eventsAcc = new Map<string, EventBucketAcc>();
    const sankeyAcc = new Map<string, SankeyBucketAcc>();
    let cursor: string | null = null;
    let processed = 0;
    while (true) {
      // Explicit annotation breaks the events↔rollup type-inference cycle (TS7022).
      const result: PaginationResult<Doc<"events">> = await ctx.runQuery(
        api.events.listRecentPaginated,
        { paginationOpts: { numItems: SCAN_PAGE, cursor } }
      );
      for (const e of result.page) {
        accumulateEvent(
          eventsAcc,
          sankeyAcc,
          { eventType: e.eventType, toolName: e.toolName, timestamp: e.timestamp },
          cutoffHour
        );
        processed++;
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    // Phase 3 — write each bucket exactly once (batched pure inserts).
    const eventBuckets = [...eventsAcc.values()];
    const sankeyBuckets = [...sankeyAcc.values()];
    for (let i = 0; i < eventBuckets.length; i += WRITE_CHUNK) {
      await ctx.runMutation(internal.analyticsRollup.insertBucketsBatch, {
        metric_type: "events",
        buckets: eventBuckets.slice(i, i + WRITE_CHUNK),
      });
    }
    for (let i = 0; i < sankeyBuckets.length; i += WRITE_CHUNK) {
      await ctx.runMutation(internal.analyticsRollup.insertBucketsBatch, {
        metric_type: "sankey_edge",
        buckets: sankeyBuckets.slice(i, i + WRITE_CHUNK),
      });
    }

    return {
      processed,
      cleared,
      eventBuckets: eventBuckets.length,
      sankeyBuckets: sankeyBuckets.length,
      cutoffHour,
    };
  },
});

// ---- Phase 88 token-fidelity follow-up: "tokens" rollup historical backfill ----
//
// Mirrors backfillHistorical exactly, but for metric_type "tokens": clears the
// stale historical "tokens" hourly range (< current hour), scans every llmMetrics
// row via api.llm.recentCallsPaginated aggregating token sums in memory, then
// writes each bucket once via pure inserts. Amplification-free and RE-RUNNABLE.
// The current hour and forward stay owned by computeHourly's "tokens" block, so
// the backfill never races the live current-hour bucket.

// internalMutation: delete one bounded page of historical "tokens" hourly buckets
// (bucket_start < cutoffHour). Looped from the action until it returns 0.
export const clearTokenBucketsPage = internalMutation({
  args: { cutoffHour: v.float64(), limit: v.float64() },
  handler: async (ctx, args) => {
    let deleted = 0;
    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "tokens").eq("period", "hourly").lt("bucket_start", args.cutoffHour)
      )
      .take(args.limit);
    for (const r of rows) {
      await ctx.db.delete(r._id);
      deleted++;
    }
    return { deleted };
  },
});

// One-shot "tokens" backfill action (operator-gated). Three phases, same shape as
// backfillHistorical. Safe to re-run: each run re-clears then rebuilds.
export const backfillTokenRollup = action({
  args: {},
  handler: async (ctx) => {
    const CLEAR_PAGE = 500;
    const WRITE_CHUNK = 500;
    const SCAN_PAGE = 500;
    const cutoffHour = Math.floor(Date.now() / 1000 / 3600) * 3600;

    // Phase 1 — clear stale historical "tokens" buckets (idempotent).
    let cleared = 0;
    while (true) {
      const { deleted } = await ctx.runMutation(
        internal.analyticsRollup.clearTokenBucketsPage,
        { cutoffHour, limit: CLEAR_PAGE }
      );
      cleared += deleted;
      if (deleted === 0) break;
    }

    // Phase 2 — scan all llmMetrics rows, aggregate token sums in memory.
    const acc = new Map<string, TokenBucketAcc>();
    let cursor: string | null = null;
    let processed = 0;
    while (true) {
      const result: PaginationResult<Doc<"llmMetrics">> = await ctx.runQuery(
        api.llm.recentCallsPaginated,
        { paginationOpts: { numItems: SCAN_PAGE, cursor } }
      );
      for (const r of result.page) {
        const billingType = r.billingType ?? getBillingType(r.provider);
        accumulateLlmTokens(
          acc,
          {
            provider: r.provider,
            model: r.model,
            billingType,
            goalId: r.goalId ?? "",
            totalTokens: r.totalTokens ?? 0,
            timestamp: r.timestamp,
          },
          cutoffHour
        );
        processed++;
      }
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    // Phase 3 — write each bucket exactly once (batched pure inserts).
    const tokenBuckets = [...acc.values()];
    for (let i = 0; i < tokenBuckets.length; i += WRITE_CHUNK) {
      await ctx.runMutation(internal.analyticsRollup.insertBucketsBatch, {
        metric_type: "tokens",
        buckets: tokenBuckets.slice(i, i + WRITE_CHUNK),
      });
    }

    return {
      processed,
      cleared,
      tokenBuckets: tokenBuckets.length,
      cutoffHour,
    };
  },
});
