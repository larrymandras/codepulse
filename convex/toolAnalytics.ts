/**
 * convex/toolAnalytics.ts — Phase 105 (Tool & Trace Observability), Plan 06.
 *
 * OBS-01's read path: per-tool call frequency and success/failure rates over
 * time, defaulting to the Ástríðr source class (D-02). Every query here reads
 * only the hourly `tool_calls` / `tool_failures` / `tool_duration_ms` /
 * `tool_duration_samples` aggregate buckets plan 105-04 writes (D-04 — these
 * survive the 14-day `toolExecutions` prune; the raw table is never read for
 * "over time" data), plus one index-bounded raw drill-down for the Ástríðr
 * recent-calls list.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { ASTRIDR_TOOL_PROVIDER } from "./runtimeIngest";

// ---- D-02 source classification -------------------------------------------

export type ToolSource = typeof ASTRIDR_TOOL_PROVIDER | "claude-code" | "gateway" | "all";

/**
 * D-02: a chart ranking Claude Code's own editor-session tool calls above
 * Ástríðr's real autonomy would conflate the operator's own session with the
 * agent's — so every read below classifies each row/dimension into exactly
 * one of the three real source classes before rendering anything ("all" is a
 * caller-supplied filter value, never a classification result).
 *
 * The `provider` field alone cannot partition the four filter options
 * (verified live 2026-08-03): gateway rows carry the gateway's own provider
 * id (including `claude-cli`, which COLLIDES with the Claude Code hook
 * rows' own `provider: "claude-cli"`), and several legacy row shapes
 * (Claude Code hook failures, otel tool_result rows) carry no `provider` at
 * all. The tool-name test therefore wins over a colliding provider value —
 * a `gateway:{provider}`-named tool always classifies as "gateway" even when
 * its `provider` string happens to equal "claude-cli" — and a provider-less
 * row is never dropped or mis-sorted into the Ástríðr class.
 */
export function classifyToolSource(dim: {
  toolName?: string;
  tool?: string;
  provider?: string;
}): Exclude<ToolSource, "all"> {
  if (dim.provider === ASTRIDR_TOOL_PROVIDER) return ASTRIDR_TOOL_PROVIDER;
  const name = dim.toolName ?? dim.tool ?? "";
  if (name.startsWith("gateway:")) return "gateway";
  return "claude-code";
}

/** True when a classified source passes the caller's filter (absent/"all" passes everything). */
function matchesSourceFilter(source: Exclude<ToolSource, "all">, filter: string | undefined): boolean {
  return !filter || filter === "all" || filter === source;
}

// ---- Bounded aggregate reads (T-105-26/T-105-27) ---------------------------

/** DoS mitigation: every read below is index-range bounded at this cap, never an unbounded full-table read. */
export const AGG_READ_CAP = 5000;

/**
 * A caller-supplied `windowHours` cannot widen the index range without
 * bound (T-105-27) — clamp to 30 days regardless of what is requested, and
 * fall back to the 7-day default for a non-finite or non-positive value.
 */
const DEFAULT_WINDOW_HOURS = 168;
export const MAX_WINDOW_HOURS = 720;

function clampWindowHours(windowHours: number | undefined): number {
  const raw = windowHours ?? DEFAULT_WINDOW_HOURS;
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_WINDOW_HOURS;
  return Math.min(raw, MAX_WINDOW_HOURS);
}

type AggregateBucketRow = { bucket_start: number; value: number; dimensions: unknown };

/**
 * One bounded index-range read of a single metric type's hourly buckets,
 * from `bucketStart` forward. Never more than one read per metric type per
 * query — the DoS bound this whole module is built on.
 */
async function readToolBuckets(
  ctx: { db: any },
  metricType: string,
  bucketStart: number
): Promise<{ rows: AggregateBucketRow[]; truncated: boolean }> {
  const rows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q: any) =>
      q.eq("metric_type", metricType).eq("period", "hourly").gte("bucket_start", bucketStart)
    )
    .take(AGG_READ_CAP);
  return { rows, truncated: rows.length >= AGG_READ_CAP };
}

function dimTool(dimensions: unknown): { tool: string; source: Exclude<ToolSource, "all"> } {
  const d = (dimensions as { tool?: string; provider?: string }) ?? {};
  return { tool: d.tool ?? "unknown", source: classifyToolSource(d) };
}

// ---- usageOverTime ----------------------------------------------------------

/**
 * D-04: per-hour call/failure counts over the window, defaulting to 7 days.
 * Every hour boundary in the window is pre-seeded at zero (behaviour bullet
 * 8) so a genuine gap in tool activity renders as a real zero bar, never a
 * point the chart silently closes over — the T-105-30 repudiation mitigation.
 */
export const usageOverTime = query({
  args: {
    windowHours: v.optional(v.float64()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const windowHours = clampWindowHours(args.windowHours);
    const now = Date.now() / 1000;
    const currentHourStart = Math.floor(now / 3600) * 3600;
    const windowStart = currentHourStart - windowHours * 3600;

    const [callsResult, failuresResult] = await Promise.all([
      readToolBuckets(ctx, "tool_calls", windowStart),
      readToolBuckets(ctx, "tool_failures", windowStart),
    ]);

    const buckets = new Map<number, { bucketStart: number; calls: number; failures: number }>();
    for (let b = windowStart; b <= currentHourStart; b += 3600) {
      buckets.set(b, { bucketStart: b, calls: 0, failures: 0 });
    }

    for (const row of callsResult.rows) {
      const { source } = dimTool(row.dimensions);
      if (!matchesSourceFilter(source, args.source)) continue;
      const bucket = buckets.get(row.bucket_start);
      if (bucket) bucket.calls += row.value;
    }
    for (const row of failuresResult.rows) {
      const { source } = dimTool(row.dimensions);
      if (!matchesSourceFilter(source, args.source)) continue;
      const bucket = buckets.get(row.bucket_start);
      if (bucket) bucket.failures += row.value;
    }

    return {
      buckets: Array.from(buckets.values()).sort((a, b) => a.bucketStart - b.bucketStart),
      truncated: callsResult.truncated || failuresResult.truncated,
      windowHours,
    };
  },
});

// ---- usageByTool -------------------------------------------------------------

const DEFAULT_USAGE_BY_TOOL_LIMIT = 15;

type ToolAgg = {
  toolName: string;
  source: Exclude<ToolSource, "all">;
  calls: number;
  failures: number;
  durationSum: number;
  durationSamples: number;
};

/**
 * D-04: one row per tool over the window, with an honest success rate and
 * average duration. `avgDurationMs` is `null` (never `0` or `NaN`) for a
 * tool whose `tool_duration_*` buckets are absent — plan 105-04 deliberately
 * never writes those buckets for a dimension where no row reported a
 * duration, so an unmeasured average must render "n/a", not a fabricated
 * "0ms" (finding F3).
 */
export const usageByTool = query({
  args: {
    windowHours: v.optional(v.float64()),
    source: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const windowHours = clampWindowHours(args.windowHours);
    const limit = args.limit ?? DEFAULT_USAGE_BY_TOOL_LIMIT;
    const now = Date.now() / 1000;
    const windowStart = Math.floor((now - windowHours * 3600) / 3600) * 3600;

    const [callsResult, failuresResult, durationMsResult, durationSamplesResult] = await Promise.all([
      readToolBuckets(ctx, "tool_calls", windowStart),
      readToolBuckets(ctx, "tool_failures", windowStart),
      readToolBuckets(ctx, "tool_duration_ms", windowStart),
      readToolBuckets(ctx, "tool_duration_samples", windowStart),
    ]);

    const byTool = new Map<string, ToolAgg>();
    // Tracks which source classes have ANY data in the window regardless of
    // the active `args.source` filter, so the caller can disable a filter
    // option that would yield an empty chart rather than a dead end.
    const sourcesPresent = new Set<Exclude<ToolSource, "all">>();

    function ensure(tool: string, source: Exclude<ToolSource, "all">): ToolAgg {
      let agg = byTool.get(tool);
      if (!agg) {
        agg = { toolName: tool, source, calls: 0, failures: 0, durationSum: 0, durationSamples: 0 };
        byTool.set(tool, agg);
      }
      return agg;
    }

    const matchesFilter = (source: Exclude<ToolSource, "all">) => matchesSourceFilter(source, args.source);

    for (const row of callsResult.rows) {
      const { tool, source } = dimTool(row.dimensions);
      sourcesPresent.add(source);
      if (!matchesFilter(source)) continue;
      ensure(tool, source).calls += row.value;
    }
    for (const row of failuresResult.rows) {
      const { tool, source } = dimTool(row.dimensions);
      sourcesPresent.add(source);
      if (!matchesFilter(source)) continue;
      ensure(tool, source).failures += row.value;
    }
    for (const row of durationMsResult.rows) {
      const { tool, source } = dimTool(row.dimensions);
      if (!matchesFilter(source)) continue;
      ensure(tool, source).durationSum += row.value;
    }
    for (const row of durationSamplesResult.rows) {
      const { tool, source } = dimTool(row.dimensions);
      if (!matchesFilter(source)) continue;
      ensure(tool, source).durationSamples += row.value;
    }

    const allRows = Array.from(byTool.values());

    let totalCalls = 0;
    let totalFailures = 0;
    for (const agg of allRows) {
      totalCalls += agg.calls;
      totalFailures += agg.failures;
    }

    const rows = allRows
      .map((agg) => ({
        toolName: agg.toolName,
        source: agg.source,
        calls: agg.calls,
        failures: agg.failures,
        successRate: agg.calls > 0 ? (agg.calls - agg.failures) / agg.calls : null,
        avgDurationMs: agg.durationSamples > 0 ? agg.durationSum / agg.durationSamples : null,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, limit);

    return {
      rows,
      totals: {
        calls: totalCalls,
        failures: totalFailures,
        successRate: totalCalls > 0 ? (totalCalls - totalFailures) / totalCalls : null,
      },
      sources: Array.from(sourcesPresent),
      truncated:
        callsResult.truncated ||
        failuresResult.truncated ||
        durationMsResult.truncated ||
        durationSamplesResult.truncated,
      windowHours,
    };
  },
});

// ---- recentExecutionsBySource ------------------------------------------------

/**
 * D-04: raw per-call rows stay the 14-day detail view — plan 105-01's caps
 * apply here, not a fresh unbounded scan.
 */
export const RAW_SCAN_CAP = 500;
const DEFAULT_RECENT_LIMIT = 50;

export const recentExecutionsBySource = query({
  args: {
    source: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const requestedLimit = args.limit ?? DEFAULT_RECENT_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), RAW_SCAN_CAP);
    const source = args.source ?? ASTRIDR_TOOL_PROVIDER;

    if (source === ASTRIDR_TOOL_PROVIDER) {
      // The dedicated provider+time index added in plan 105-03 makes this an
      // index-bounded read, never a filtered full scan.
      const rows = await ctx.db
        .query("toolExecutions")
        .withIndex("by_provider_time", (q: any) => q.eq("provider", ASTRIDR_TOOL_PROVIDER))
        .order("desc")
        .take(limit);
      return { rows, truncated: rows.length >= limit };
    }

    // Any other source class has no dedicated index — bounded by
    // construction via RAW_SCAN_CAP, then classified in JS and sliced. A
    // sparse class may legitimately return fewer than `limit` rows; that is
    // intended bounded-by-construction behaviour, not a defect.
    const scanned = await ctx.db
      .query("toolExecutions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(RAW_SCAN_CAP);
    const filtered = scanned.filter(
      (row: { toolName?: string; provider?: string }) =>
        source === "all" || classifyToolSource(row) === source
    );
    return { rows: filtered.slice(0, limit), truncated: scanned.length >= RAW_SCAN_CAP };
  },
});
