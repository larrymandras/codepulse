import { query } from "./_generated/server";
import {
  heatmapFromAggregates,
  errorRateTrendFromAggregates,
  sankeyFromAggregates,
  sunburstFromAggregates,
} from "./analyticsRollupQueries";

// Phase 88 Plan 04: the four heavy analytics queries now read the slim,
// index-bounded `aggregates` rollup buckets (authoritative as of Plan 02/03)
// instead of scanning the fat `events`/`llmMetrics` tables. Reads are O(buckets)
// — permanently under the 16 MiB/exec limit — so the quick-unblock .take() caps
// are gone (AR-03). The JS folding lives in ./analyticsRollupQueries so it stays
// auditable and unit-testable. tokenWaterfall stays raw-but-bounded (not a rollup
// candidate). Return shapes are unchanged (consumed by the existing UI).

export const activityHeatmap = query({
  args: {},
  handler: async (ctx) => {
    // 90-day window of "events" hourly buckets (one slim row per {event_type, hour}).
    const cutoff = Date.now() / 1000 - 90 * 86400;
    const buckets = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "events").eq("period", "hourly").gte("bucket_start", cutoff)
      )
      .collect();

    return heatmapFromAggregates(
      buckets.map((b) => ({ bucket_start: b.bucket_start, value: b.value, dimensions: b.dimensions }))
    );
  },
});

export const toolFlowSankey = query({
  args: {},
  handler: async (ctx) => {
    // 90-day window of "sankey_edge" hourly buckets (one slim row per
    // {source, target} edge). Edges were written at ingest time with the SAME
    // categoryOf/outcomeOf classifier the read path reconstructs through
    // (./analyticsRollupQueries → ./lib/sankeyClassify) — no drift possible
    // (Pitfall 2 / T-88-09). Node set is the unique edge endpoints.
    const cutoff = Date.now() / 1000 - 90 * 86400;
    const buckets = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "sankey_edge").eq("period", "hourly").gte("bucket_start", cutoff)
      )
      .collect();

    return sankeyFromAggregates(
      buckets.map((b) => ({ bucket_start: b.bucket_start, value: b.value, dimensions: b.dimensions }))
    );
  },
});

export const tokenSunburst = query({
  args: {},
  handler: async (ctx) => {
    // 30-day window of HOURLY buckets (dimensions { provider, model, billingType,
    // goalId }). Read hourly only — daily is a rollup OF hourly, so mixing both
    // would double-count (costByPeriod takes a single period for the same reason).
    // Two streams:
    //   - "cost" buckets (value = summed cost) → totalCost header.
    //   - "tokens" buckets (Phase 88 token-fidelity follow-up; value = summed
    //     totalTokens) → the real per-provider/model token counts the UI renders.
    const cutoff = Date.now() / 1000 - 30 * 86400;
    const costBuckets = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", "hourly").gte("bucket_start", cutoff)
      )
      .collect();
    const tokenBuckets = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "tokens").eq("period", "hourly").gte("bucket_start", cutoff)
      )
      .collect();

    return sunburstFromAggregates(
      costBuckets.map((b) => ({ bucket_start: b.bucket_start, value: b.value, dimensions: b.dimensions })),
      tokenBuckets.map((b) => ({ bucket_start: b.bucket_start, value: b.value, dimensions: b.dimensions }))
    );
  },
});

export const errorRateTrend = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const dayAgo = now - 86400;

    // Read the same slim "events" hourly buckets and filter to the error
    // event_types in JS. All 24 hour slots are initialised to 0 in the pure
    // derivation (Pitfall 7) so empty hours render errors: 0, never absent.
    const buckets = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "events").eq("period", "hourly").gte("bucket_start", dayAgo)
      )
      .collect();

    return errorRateTrendFromAggregates(
      dayAgo,
      buckets.map((b) => ({ bucket_start: b.bucket_start, value: b.value, dimensions: b.dimensions }))
    );
  },
});

export const sessionDurations = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(200);

    const completed = sessions.filter(
      (s) => s.lastEventAt && s.startedAt
    );

    // Bucket durations: <1m, 1-5m, 5-15m, 15-30m, 30-60m, 1-2h, 2h+
    const buckets = [
      { label: "<1m", min: 0, max: 60, count: 0 },
      { label: "1-5m", min: 60, max: 300, count: 0 },
      { label: "5-15m", min: 300, max: 900, count: 0 },
      { label: "15-30m", min: 900, max: 1800, count: 0 },
      { label: "30-60m", min: 1800, max: 3600, count: 0 },
      { label: "1-2h", min: 3600, max: 7200, count: 0 },
      { label: "2h+", min: 7200, max: Infinity, count: 0 },
    ];

    for (const s of completed) {
      const dur = s.lastEventAt - s.startedAt;
      const bucket = buckets.find((b) => dur >= b.min && dur < b.max);
      if (bucket) bucket.count++;
    }

    return buckets.map(({ label, count }) => ({ label, count }));
  },
});

export const tokenWaterfall = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() / 1000 - 30 * 60; // last 30 minutes
    const all = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .order("asc")
      .filter((q) => q.neq(q.field("archived"), true))
      // Phase 88 (Pitfall 5): tokenWaterfall is INTENTIONALLY raw, not a rollup
      // candidate — it's a live 30-min llmMetrics time-series. The 30-min window
      // over slim llmMetrics rows (no v.any() payload) keeps this read well under
      // the 16 MiB/exec limit, so the .take(30000) defensive cap stays.
      .take(30000);

    return all.map((r) => ({
      timestamp: r.timestamp,
      model: r.model,
      provider: r.provider,  // Phase 67 — required for D-08 provider grouping
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
    }));
  },
});
