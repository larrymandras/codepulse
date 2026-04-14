---
phase: 07-intelligence-layer
plan: 01
subsystem: backend
tags:
  - schema
  - crons
  - intelligence-layer
  - test-stubs
dependency_graph:
  requires:
    - convex/schema.ts (existing tables: aggregates, alerts)
  provides:
    - briefings table
    - anomalyEvents table
    - memoryQuality table
    - Phase 7 cron schedule
    - Wave 0 test stubs for all Phase 7 modules
  affects:
    - convex/schema.ts
    - convex/crons.ts
tech_stack:
  added: []
  patterns:
    - Convex defineTable with multi-field indexes
    - test.todo stubs for Nyquist-compliant Wave 0 test infrastructure
key_files:
  created:
    - convex/forecasts.test.ts
    - convex/briefings.test.ts
    - convex/anomalyDetection.test.ts
    - convex/memoryQuality.test.ts
  modified:
    - convex/schema.ts
    - convex/crons.ts
decisions:
  - No forecasts table needed — forecasts computed on-the-fly from aggregates via reactive Convex query (D-01/D-02/D-03)
  - crons.ts module references (briefings, anomalyDetection, memoryQuality) are forward references — expected TS errors until Plans 02-05 create those modules
metrics:
  duration: ~8 minutes
  completed: 2026-04-14
  tasks_completed: 2
  files_modified: 6
---

# Phase 7 Plan 01: Schema + Cron Foundation Summary

Intelligence layer data foundation established. Three new Convex tables (briefings, anomalyEvents, memoryQuality) added to schema with correct indexes. Three Phase 7 cron jobs registered in crons.ts. Four Wave 0 test files created with 28 test.todo stubs covering all INT requirements — suite exits green immediately.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add intelligence layer schema tables | 198e4e0 | convex/schema.ts |
| 2 | Register Phase 7 cron jobs and create Wave 0 test stubs | 00a9ed8 | convex/crons.ts, convex/forecasts.test.ts, convex/briefings.test.ts, convex/anomalyDetection.test.ts, convex/memoryQuality.test.ts |

## What Was Built

### Schema Tables (convex/schema.ts)

Three new tables added after the Alert Routing section under an `// INTELLIGENCE LAYER (Phase 7)` comment block:

- **briefings** — Stores LLM-generated session and daily digest briefings. Indexed by `(type, generatedAt)`, `sessionId`, and `date`.
- **anomalyEvents** — Records anomaly detections with z-score, mean, stdDev, severity. Indexed by `(metric, detectedAt)` and `(severity, detectedAt)`. Links to `alerts` table via optional `alertId`.
- **memoryQuality** — Captures deduplication rate, stale count, contradiction count per evaluation run. Indexed by `evaluatedAt`. Stores full staleMemoryIds array and contradictionPairs with reason strings.

### Cron Registrations (convex/crons.ts)

Three Phase 7 cron jobs added before `export default crons;`:
- `generate-daily-digest` — daily at 06:00 UTC → `internal.briefings.triggerDailyDigest`
- `detect-anomalies` — every 6 hours → `internal.anomalyDetection.evaluateInternal`
- `evaluate-memory-quality` — daily at 03:00 UTC → `internal.memoryQuality.evaluateInternal`

### Test Stubs (4 files, 28 total stubs)

| File | Stubs |
|------|-------|
| convex/forecasts.test.ts | 8 |
| convex/briefings.test.ts | 8 |
| convex/anomalyDetection.test.ts | 7 |
| convex/memoryQuality.test.ts | 5 |

All stubs use `test.todo` — suite exits green (28 todos, 0 failures).

## Deviations from Plan

None - plan executed exactly as written.

The pre-existing TypeScript errors in `convex/runtimeIngest.ts` (duplicate `const now` declarations at lines 26 and 544) are out of scope for this plan and pre-date Phase 7. These are noted for deferred resolution.

## Known Stubs

The cron registrations in `convex/crons.ts` reference three modules that do not yet exist:
- `internal.briefings.triggerDailyDigest` → created in Plan 02
- `internal.anomalyDetection.evaluateInternal` → created in Plan 03
- `internal.memoryQuality.evaluateInternal` → created in Plan 04

This is intentional per the plan design. TypeScript errors for these references will resolve when those modules are created. The crons.ts content is correct — verification was done by reading the file, not running tsc, as documented in the plan.

## Self-Check: PASSED

- convex/schema.ts contains `briefings: defineTable(` — FOUND
- convex/schema.ts contains `anomalyEvents: defineTable(` — FOUND
- convex/schema.ts contains `memoryQuality: defineTable(` — FOUND
- convex/schema.ts contains `// INTELLIGENCE LAYER (Phase 7)` — FOUND
- convex/crons.ts contains `"generate-daily-digest"` — FOUND
- convex/crons.ts contains `internal.briefings.triggerDailyDigest` — FOUND
- convex/crons.ts contains `"detect-anomalies"` — FOUND
- convex/crons.ts contains `internal.anomalyDetection.evaluateInternal` — FOUND
- convex/crons.ts contains `"evaluate-memory-quality"` — FOUND
- convex/crons.ts contains `internal.memoryQuality.evaluateInternal` — FOUND
- convex/forecasts.test.ts exists with 8 test.todo stubs — FOUND
- convex/briefings.test.ts exists with 8 test.todo stubs — FOUND
- convex/anomalyDetection.test.ts exists with 7 test.todo stubs — FOUND
- convex/memoryQuality.test.ts exists with 5 test.todo stubs — FOUND
- Commit 198e4e0 exists — FOUND
- Commit 00a9ed8 exists — FOUND
- vitest run exits 0 (28 todos, 0 failures) — PASSED
