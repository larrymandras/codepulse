---
phase: 07-intelligence-layer
plan: "04"
subsystem: intelligence
tags:
  - anomaly-detection
  - z-score
  - alerts
  - convex
  - react
dependency_graph:
  requires:
    - 07-01  # schema (anomalyEvents table)
    - 06     # alert infrastructure (alerts table, webhookDelivery)
  provides:
    - anomaly detection backend (evaluateInternal, getActiveAnomalies)
    - AnomalyBadge UI component
  affects:
    - src/pages/Analytics.tsx
    - convex/crons.ts (pre-wired)
tech_stack:
  added: []
  patterns:
    - z-score computation with zero-division protection
    - internalMutation cron target for anomaly evaluation
    - deduplication via activeSourceSet before alert insert
    - inline badge with Radix Tooltip for contextual metric info
key_files:
  created:
    - convex/anomalyDetection.ts
    - convex/anomalyDetection.test.ts
    - src/components/AnomalyBadge.tsx
  modified:
    - src/pages/Analytics.tsx
    - convex/_generated/api.d.ts
decisions:
  - Used JS-side filter for getActiveAnomalies cross-metric query (by_metric_detected index requires metric prefix — full collect + filter is acceptable given anomalyEvents table is small)
  - Updated generated api.d.ts manually to include anomalyDetection (Convex dev not run in worktree; generated file is a build artifact)
  - alert source string uses anomaly_detection-{metric} pattern (matching dedup key across evaluations)
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_changed: 5
---

# Phase 7 Plan 04: Anomaly Detection Summary

Z-score anomaly detection backend with automatic alert creation and inline AnomalyBadge UI component on Analytics MetricCards.

## What Was Built

**Task 1: Anomaly detection backend**

`convex/anomalyDetection.ts` provides:
- `computeZScore(value, historicalValues)` — population z-score with zero-division protection (returns 0 when stdDev=0 or history empty)
- `classifySeverity(absZScore)` — returns `"warning"` (2sigma+), `"critical"` (3sigma+), or `null`
- `evaluateInternal` — `internalMutation` cron target (every 6 hours per crons.ts). For each metric in `["cost", "errors", "latency"]`: queries last 14 daily aggregate rows, sums per day bucket, computes z-score on today vs historical, inserts `anomalyEvents` row and creates alert with webhook delivery for 2sigma+ anomalies. Deduplication via `activeSourceSet` prevents duplicate alerts per metric cycle (T-07-09 mitigation).
- `getActiveAnomalies` — public `query` returning highest-severity anomaly per metric from last 24 hours as `Record<string, {...}>`.

`convex/anomalyDetection.test.ts` — 11 passing unit tests for `computeZScore` and `classifySeverity` pure functions. 2 mutation-level tests deferred as `test.todo` (require Convex test harness).

**Task 2: AnomalyBadge component and Analytics integration**

`src/components/AnomalyBadge.tsx` — inline severity badge:
- `WARN` (yellow, `--status-warn`) for 2sigma, `ANOMALY` (red, `--status-error`) for 3sigma
- Radix `TooltipProvider` showing metric name, current value, expected mean, z-score
- No `rounded` class per UI-SPEC constraint (`--radius: 0`)

`src/pages/Analytics.tsx` updated:
- Imports `AnomalyBadge` and queries `api.anomalyDetection.getActiveAnomalies`
- Total Events MetricCard shows badge when `anomalies.errors` is active
- Total Cost MetricCard shows badge when `anomalies.cost` is active
- Each badge wrapped in `flex items-start gap-2` container alongside MetricCard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid withIndex query on cross-metric range**
- **Found during:** Task 1 TypeScript check
- **Issue:** `by_metric_detected` index is on `["metric", "detectedAt"]` — cannot use `gte("detectedAt", ...)` without first providing the `metric` equality prefix. TypeScript caught this.
- **Fix:** Changed `getActiveAnomalies` to full `.collect()` + JS filter on `detectedAt >= cutoff`. Acceptable: `anomalyEvents` table is small (max ~3 rows per 6-hour cron cycle).
- **Files modified:** `convex/anomalyDetection.ts`
- **Commit:** 2727ad7

**2. [Rule 3 - Blocking] Updated generated api.d.ts to include anomalyDetection**
- **Found during:** Task 2 TypeScript check
- **Issue:** `convex/_generated/api.d.ts` is a build artifact from before this plan ran. `api.anomalyDetection` not in type declarations, causing TS2339 in Analytics.tsx.
- **Fix:** Manually added `import type * as anomalyDetection` and `anomalyDetection: typeof anomalyDetection` to `api.d.ts`. This is the correct worktree approach — `npx convex dev` would regenerate it automatically in production.
- **Files modified:** `convex/_generated/api.d.ts`
- **Commit:** 2727ad7

## Known Stubs

None. `getActiveAnomalies` returns live data from the `anomalyEvents` table. `AnomalyBadge` only renders when anomalies are present.

## Threat Flags

None. `evaluateInternal` is an `internalMutation` (server-side only, T-07-10 accepted). Alert creation deduplication enforces T-07-09 (at most 3 new alerts per 6-hour cycle).

## Self-Check: PASSED

- `convex/anomalyDetection.ts` — EXISTS, contains `computeZScore`, `classifySeverity`, `evaluateInternal`, `getActiveAnomalies`, `anomaly_detection`, `anomalyEvents`, `webhookDelivery`, `webhookStatus`
- `src/components/AnomalyBadge.tsx` — EXISTS, contains `ANOMALY`, `WARN`, `--status-error`, `--status-warn`, `TooltipProvider`, `zScore`, no `rounded`
- `src/pages/Analytics.tsx` — contains `AnomalyBadge`, `api.anomalyDetection.getActiveAnomalies`
- Tests: `npx vitest run convex/anomalyDetection.test.ts` — 11 passed, 2 todo
- TypeScript: `npx tsc --noEmit` — 0 errors in plan-modified files (pre-existing: crons.ts memoryQuality, runtimeIngest.ts duplicate now)
- Commits: `11ef965` (task 1), `2727ad7` (task 2)
