/**
 * useToolUsage — Convex live-query hooks for convex/toolAnalytics.ts.
 *
 * Phase 105 Plan 06 (OBS-01). Mirrors useCostDerived.ts's
 * `useQuery(...) ?? DEFAULT` wrapper convention — loading and "no data" both
 * collapse to the same honest-empty default shape so `ToolUsagePanel` can
 * render unconditionally.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type UsageOverTimeBucket = { bucketStart: number; calls: number; failures: number };

export type UsageOverTimeResult = {
  buckets: UsageOverTimeBucket[];
  truncated: boolean;
  windowHours: number;
};

export type ToolUsageRow = {
  toolName: string;
  source: "astridr" | "claude-code" | "gateway";
  calls: number;
  failures: number;
  successRate: number | null;
  avgDurationMs: number | null;
};

export type UsageByToolResult = {
  rows: ToolUsageRow[];
  totals: { calls: number; failures: number; successRate: number | null };
  sources: string[];
  truncated: boolean;
  windowHours: number;
};

export type ToolExecutionRow = {
  _id: string;
  sessionId: string;
  toolName: string;
  durationMs?: number;
  success: boolean;
  provider?: string;
  timestamp: number;
};

export type RecentExecutionsResult = {
  rows: ToolExecutionRow[];
  truncated: boolean;
};

const DEFAULT_OVER_TIME: UsageOverTimeResult = { buckets: [], truncated: false, windowHours: 0 };

const DEFAULT_BY_TOOL: UsageByToolResult = {
  rows: [],
  totals: { calls: 0, failures: 0, successRate: null },
  sources: [],
  truncated: false,
  windowHours: 0,
};

const DEFAULT_RECENT: RecentExecutionsResult = { rows: [], truncated: false };

/** Per-hour call/failure series for the source + window, zero-seeded across every hour. */
export function useToolUsageOverTime(source: string, windowHours?: number): UsageOverTimeResult {
  return (
    (useQuery(api.toolAnalytics.usageOverTime, {
      source,
      windowHours,
    }) as UsageOverTimeResult | undefined) ?? DEFAULT_OVER_TIME
  );
}

/** Per-tool call/failure/duration rollup for the source + window. */
export function useToolUsageByTool(source: string, windowHours?: number): UsageByToolResult {
  return (
    (useQuery(api.toolAnalytics.usageByTool, {
      source,
      windowHours,
    }) as UsageByToolResult | undefined) ?? DEFAULT_BY_TOOL
  );
}

/** Raw recent tool-execution rows for the source, bounded per convex/toolAnalytics.ts. */
export function useToolExecutionsBySource(source: string, limit?: number): RecentExecutionsResult {
  return (
    (useQuery(api.toolAnalytics.recentExecutionsBySource, {
      source,
      limit,
    }) as RecentExecutionsResult | undefined) ?? DEFAULT_RECENT
  );
}
