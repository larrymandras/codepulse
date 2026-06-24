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

import type { MutationCtx } from "./_generated/server";
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
