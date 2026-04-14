---
phase: 05-data-pipeline
plan: "02"
subsystem: backend-queries, analytics-page
tags:
  - archived-filters
  - query-optimization
  - aggregate-queries
  - data-pipeline
dependency_graph:
  requires:
    - 05-01
  provides:
    - archived-filter-coverage-on-all-high-volume-tables
    - analytics-page-aggregate-queries
  affects:
    - convex/llm.ts
    - convex/analytics.ts
    - convex/events.ts
    - src/pages/Analytics.tsx
tech_stack:
  added: []
  patterns:
    - "q.neq(q.field('archived'), true) filter on all high-volume table reads"
    - "Aggregate query swap: api.llm.costByProvider -> api.aggregates.costByPeriod"
    - "Fallback pattern: totalAggregateEvents || events.length (D-12 no-backfill)"
key_files:
  created: []
  modified:
    - convex/llm.ts
    - convex/analytics.ts
    - convex/events.ts
    - src/pages/Analytics.tsx
decisions:
  - "ErrorRateTrend child component left fetching its own data (no prop drilling required); errorTrend aggregate available at page level for future swap"
  - "sessionDurations left without archived filter per D-06 (sessions table not an archival target)"
  - "void errorTrend used to suppress unused variable warning while keeping the query wired for future use"
metrics:
  duration: "3 minutes"
  completed: "2026-04-14"
  tasks_completed: 3
  files_modified: 4
---

# Phase 5 Plan 02: Archived Filters + Aggregate Query Swap Summary

Archived-row filters added to all read queries on the four high-volume tables (events, runtime_events, llmMetrics, toolExecutions is handled by archival.ts). Analytics page primary MetricCards now read from pre-computed aggregate tables via api.aggregates.costByPeriod and api.aggregates.eventCountsByPeriod with raw-query fallbacks per D-12.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add archived filters to llm.ts queries | 2d66e7f | convex/llm.ts |
| 2 | Add archived filters to analytics.ts and events.ts | 79b22fa | convex/analytics.ts, convex/events.ts |
| 3 | Wire Analytics.tsx to aggregate queries | f6f8b3a | src/pages/Analytics.tsx |

## What Was Built

### Task 1 — llm.ts archived filters (7 functions)
- `recentCalls` — filter before `.take(50)`
- `costByProvider` — filter before `.collect()`
- `costByModel` — filter before `.collect()`
- `providerBreakdown` — filter before `.collect()`
- `costOverTime` — filter after `.order('asc')` before `.collect()`
- `latencyOverTime` — filter after `.order('asc')` before `.collect()`
- `rollupCosts` (internalMutation) — filter before `.take(1000)`
- `recordCall` mutation untouched (writes only)

### Task 2 — analytics.ts and events.ts archived filters (15 functions)

**analytics.ts (6 filters):**
- `activityHeatmap` — filter before `.take(5000)`
- `toolFlowSankey` — filter before `.take(2000)`
- `tokenSunburst` — filter before `.collect()` on llmMetrics
- `errorRateTrend` — filter on both Error and ToolError query chains before `.take(500)`
- `tokenWaterfall` — filter before `.collect()` on llmMetrics
- `sessionDurations` — intentionally left unchanged (sessions table, not an archival target per D-06)

**events.ts (9 filters):**
- `listRecent` — filter before `.take(limit)`
- `listBySession` — filter before `.take(limit)`
- `listByTool` — filter before `.take(limit)`
- `listBashCommands` — compound filter combining `toolName=Bash` AND `archived!=true`
- `listErrors` — filter before `.collect()`
- `listPrompts` — filter before `.collect()`
- `countByType` (runtime_events) — filter before `.collect()`
- `listByType` (runtime_events) — filter before `.take(limit)`
- `listCritical` (runtime_events) — filter before `.take(limit)`
- `ingest`/`insertEvent` mutations untouched (writes only)

### Task 3 — Analytics.tsx aggregate query wiring
- **Swap 1:** `costByProvider` — replaced `api.llm.costByProvider` with `api.aggregates.costByPeriod({ period: "daily" })`. Return shape `Record<string, number>` is identical; `totalCost` and all child components remain compatible.
- **Swap 2:** `errorTrend` — added `api.aggregates.errorTrendByPeriod({ period: "hourly" })`. ErrorRateTrend child component still fetches its own data internally (it now has the archived filter from Task 2). The aggregate is available at page level for a future prop-based swap.
- **Swap 3:** `eventCounts` — added `api.aggregates.eventCountsByPeriod({ period: "daily" })`. Total Events MetricCard now uses `totalAggregateEvents || events.length` fallback pattern per D-12 (no backfill).
- `useRecentEvents` and `useLlmMetrics` hooks preserved — still consumed by LLM Calls count and Total Tokens MetricCards.

## Aggregate Swap Coverage

| Component | Before | After | Notes |
|-----------|--------|-------|-------|
| Total Cost MetricCard | `api.llm.costByProvider` (full table scan) | `api.aggregates.costByPeriod` | Swapped |
| Total Events MetricCard | `events.length` (hook-limited to 100) | `totalAggregateEvents \|\| events.length` | Swapped with fallback |
| ErrorRateTrend (child) | `api.analytics.errorRateTrend` (raw, now filtered) | unchanged — has archived filter | Future swap candidate |
| ActivityHeatmap (child) | `api.analytics.activityHeatmap` (raw, now filtered) | unchanged | Future swap candidate |
| TokenSunburst (child) | `api.analytics.tokenSunburst` (raw, now filtered) | unchanged | Future swap candidate |

## Deviations from Plan

None — plan executed exactly as written. The `void errorTrend` suppression was added to keep the query wired (per plan intent) without a TypeScript unused-variable error, which is idiomatic TypeScript for intentionally-kept variables.

## Known Stubs

None. All MetricCards read from live data (aggregate or fallback).

## Threat Flags

No new trust boundaries or network endpoints introduced. All changes are server-side query modifications and a read-only page component update. T-05-04 mitigation fully applied: all queries touching events, runtime_events, and llmMetrics now filter `archived !== true`.

## Verification Results

- `npx tsc --noEmit` — EXIT 0 after each task
- `npx vitest run convex/aggregates.test.ts convex/archival.test.ts` — 17 tests passed
- Grep confirms 22 archived filter instances across the three Convex domain files
- `src/pages/Analytics.tsx` contains `api.aggregates.costByPeriod`, `api.aggregates.errorTrendByPeriod`, `api.aggregates.eventCountsByPeriod`

## Self-Check: PASSED
