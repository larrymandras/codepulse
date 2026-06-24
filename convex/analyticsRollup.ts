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

// ---- Ingest-time increment helpers (called inside events.ingest) ----

// Increment the "events" rollup bucket for {eventType, hour}: read-patch-or-insert.
export async function incrementEventBucket(
  ctx: MutationCtx,
  eventType: string,
  timestamp: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;

  const bucketRows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) =>
      q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
    )
    .collect();
  // JS-side dimension match (Pitfall 3) — never an object-equality filter on the
  // dimensions field; collect the bucket rows and match in JS instead.
  const existing = bucketRows.find((r) => {
    const dims = r.dimensions as { event_type?: string } | null;
    return dims?.event_type === eventType;
  });

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "events",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { event_type: eventType },
    });
  }
}

// Increment the TWO "sankey_edge" buckets for an event:
//   Edge A: categoryOf(eventType) → (toolName ?? eventType)
//   Edge B: (toolName ?? eventType) → outcomeOf(eventType)
export async function incrementSankeyBuckets(
  ctx: MutationCtx,
  eventType: string,
  toolName: string | undefined,
  timestamp: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;
  const category = categoryOf(eventType);
  const tool = toolName ?? eventType;
  const outcome = outcomeOf(eventType);

  await incrementSankeyEdge(ctx, hourStart, category, tool);
  await incrementSankeyEdge(ctx, hourStart, tool, outcome);
}

// Private: read-patch-or-insert one "sankey_edge" {source, target} bucket.
async function incrementSankeyEdge(
  ctx: MutationCtx,
  hourStart: number,
  source: string,
  target: string
): Promise<void> {
  const bucketRows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) =>
      q.eq("metric_type", "sankey_edge").eq("period", "hourly").eq("bucket_start", hourStart)
    )
    .collect();
  // JS-side dimension match (Pitfall 3).
  const existing = bucketRows.find((r) => {
    const dims = r.dimensions as { source?: string; target?: string } | null;
    return dims?.source === source && dims?.target === target;
  });

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "sankey_edge",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { source, target },
    });
  }
}

// ---- Backfill: re-derive ingest-time buckets from existing events ----

// internalMutation (NEVER a public mutation): callable only via
// internal.analyticsRollup.incrementBatch from the backfillHistorical action.
// A public increment endpoint would be an unauthenticated tampering surface
// (T-88-03). Loops the two ingest-time helpers per event.
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
      await incrementEventBucket(ctx, e.eventType, e.timestamp);
      await incrementSankeyBuckets(ctx, e.eventType, e.toolName, e.timestamp);
    }
  },
});

// One-shot backfill action: cursor-loop over every event and (re)build the
// ingest-time "events" + "sankey_edge" buckets. Run is Plan 03 (operator-gated).
// Actions cannot touch ctx.db directly — read via ctx.runQuery, write via
// ctx.runMutation(internal.analyticsRollup.incrementBatch).
export const backfillHistorical = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let processed = 0;

    while (true) {
      // Explicit annotation breaks the type-inference cycle: events.ingest imports
      // these rollup helpers, and listRecentPaginated lives in the same events
      // module, so leaving `result` inferred makes tsc fail with TS7022.
      const result: PaginationResult<Doc<"events">> = await ctx.runQuery(
        api.events.listRecentPaginated,
        { paginationOpts: { numItems: 200, cursor } }
      );

      if (result.page.length > 0) {
        await ctx.runMutation(internal.analyticsRollup.incrementBatch, {
          events: result.page.map((e) => ({
            eventType: e.eventType,
            toolName: e.toolName,
            timestamp: e.timestamp,
          })),
        });
        processed += result.page.length;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    return { processed };
  },
});
