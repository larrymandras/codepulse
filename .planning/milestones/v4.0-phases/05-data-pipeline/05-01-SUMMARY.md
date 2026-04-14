---
phase: 05-data-pipeline
plan: "01"
subsystem: backend-data-pipeline
tags:
  - convex
  - aggregation
  - archival
  - crons
  - schema
dependency_graph:
  requires:
    - convex/schema.ts (agentConfigs table for retention config)
    - convex/alerts.ts (existing cron pattern reference)
  provides:
    - aggregates table with two indexes
    - archived field on events, runtime_events, llmMetrics, toolExecutions
    - computeHourly internalMutation
    - rollupDaily internalMutation
    - costByPeriod, errorTrendByPeriod, eventCountsByPeriod queries
    - markStaleArchived internalMutation
    - setRetentionDays mutation (1-365 clamped)
    - getRetentionDays query
    - Three new cron registrations
  affects:
    - convex/crons.ts (three new crons added)
    - convex/_generated/api.d.ts (new module type imports)
tech_stack:
  added: []
  patterns:
    - Convex internalMutation for cron-called aggregation
    - Convex .take(500) batch limit for archival safety
    - Dimension JSON key grouping for metric rollup
key_files:
  created:
    - convex/aggregates.ts
    - convex/archival.ts
  modified:
    - convex/schema.ts
    - convex/crons.ts
    - convex/aggregates.test.ts
    - convex/archival.test.ts
    - convex/_generated/api.d.ts
decisions:
  - Single aggregates table with metric_type discriminator (D-02) over separate tables per metric type
  - Dimensions stored as optional JSON any field (D-04) for flexible drill-down without schema churn
  - rollupDaily reads from aggregates hourly rows, not raw tables — avoids double-scanning
  - markStaleArchived uses .take(500) per table per run to prevent mutation timeout
  - setRetentionDays clamps to 1-365 to prevent zeroing retention or effectively disabling archival
metrics:
  duration_minutes: 12
  completed_date: "2026-04-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 5
---

# Phase 05 Plan 01: Data Pipeline Foundation Summary

One-liner: Convex aggregates table + hourly/daily cron pipeline + configurable archival with 1-365 day retention clamping.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add aggregates table and archived field to schema | 587b72f | convex/schema.ts |
| 2 | Create aggregation mutations, archival, crons, and fill test stubs | 9fb89fc | convex/aggregates.ts, convex/archival.ts, convex/crons.ts, convex/aggregates.test.ts, convex/archival.test.ts, convex/_generated/api.d.ts |

## What Was Built

**Schema changes (Task 1):**
- Added `archived: v.optional(v.boolean())` to `events`, `runtime_events`, `llmMetrics`, and `toolExecutions` tables — enables archival filtering without index changes
- Added `aggregates` table with `metric_type`, `period`, `bucket_start`, `value`, `dimensions` fields and two indexes (`by_type_period_bucket`, `by_period_bucket`)

**Aggregation pipeline (Task 2):**
- `convex/aggregates.ts`: `computeHourly` internalMutation aggregates the last completed hour of LLM costs (by provider+model), event counts (by eventType), and error counts (by category) into the aggregates table. `rollupDaily` sums 24 hourly rows into daily summaries without re-scanning raw tables.
- Three read queries (`costByPeriod`, `errorTrendByPeriod`, `eventCountsByPeriod`) provide the Analytics page data layer for Plan 02.

**Archival pipeline (Task 2):**
- `convex/archival.ts`: `markStaleArchived` reads retention threshold from `agentConfigs`, defaults to 30 days, processes all four high-volume tables with `.take(500)` batch limit per run
- `setRetentionDays` mutation clamps input to 1-365 (T-05-01, T-05-02 mitigations), upserts into agentConfigs
- `getRetentionDays` query exposes current setting

**Crons (Task 2):**
- `aggregate-hourly`: every 1 hour → `internal.aggregates.computeHourly`
- `aggregate-daily`: 01:00 UTC daily → `internal.aggregates.rollupDaily`
- `archive-stale-events`: 02:00 UTC daily → `internal.archival.markStaleArchived`

**Tests (Task 2):**
- `convex/aggregates.test.ts`: 8 real assertions covering hour bucket alignment, provider+model cost grouping, error category counting, daily rollup summing, and query return shapes
- `convex/archival.test.ts`: 9 real assertions covering cutoff calculation, null config default, numeric config reading, batch limit constant, and all 5 clamping cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated _generated/api.d.ts to include new modules**
- **Found during:** Task 2 verification
- **Issue:** `convex/_generated/api.d.ts` did not include type imports for `aggregates` or `archival` modules, causing `internal.aggregates.*` and `internal.archival.*` references in crons.ts to fail TypeScript compilation with TS2339 errors
- **Fix:** Added `import type * as aggregates from "../aggregates.js"` and `import type * as archival from "../archival.js"` to the imports section, and added both to the `ApiFromModules` declaration. Note: `api.js` uses `anyApi` (dynamic proxy) so no runtime change was needed.
- **Files modified:** `convex/_generated/api.d.ts`
- **Commit:** 9fb89fc

## Known Stubs

None — all test stubs replaced with real assertions.

## Threat Surface Scan

All mitigations from the plan's threat model were applied:

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-05-01 | `Math.max(1, ...)` clamp in setRetentionDays | Applied in convex/archival.ts:33 |
| T-05-02 | `Math.min(365, ...)` clamp in setRetentionDays | Applied in convex/archival.ts:33 |
| T-05-03 | `.take(500)` batch limit in markStaleArchived | Applied in convex/archival.ts:21 |

No new threat surface introduced beyond what was planned.

## Self-Check: PASSED

- [x] convex/schema.ts — aggregates table present, archived fields on 4 tables
- [x] convex/aggregates.ts — created, exports computeHourly, rollupDaily, costByPeriod, errorTrendByPeriod, eventCountsByPeriod
- [x] convex/archival.ts — created, exports markStaleArchived, setRetentionDays, getRetentionDays
- [x] convex/crons.ts — 3 new crons registered (aggregate-hourly, aggregate-daily, archive-stale-events)
- [x] convex/aggregates.test.ts — 8 passing tests (real assertions, no todos)
- [x] convex/archival.test.ts — 9 passing tests (real assertions, no todos)
- [x] convex/_generated/api.d.ts — aggregates and archival modules registered
- [x] TypeScript: npx tsc --noEmit exits 0
- [x] Tests: 17/17 pass for aggregates.test.ts + archival.test.ts
- [x] Commit 587b72f exists (Task 1)
- [x] Commit 9fb89fc exists (Task 2)
