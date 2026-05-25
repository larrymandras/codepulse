---
phase: 68-gateway-observability
plan: 02
subsystem: api, ui
tags: [otel, convex, gateway, flex-bar-chart, stacked-segments, cost-aggregation, routing-decisions, tdd]

# Dependency graph
requires:
  - phase: 68-01
    provides: gatewayTasks.upsert mutation and routingDecisions.insert mutation (new dedicated tables)

provides:
  - OTel gateway.task_* handlers now write to gatewayTasks table (not toolExecutions)
  - OTel gateway.routing_decision handler now writes to routingDecisions table (not generic events)
  - costByPeriodByProvider query: time-bucketed costs grouped by provider (D-16)
  - FlexBarChart with StackedSegment support for provider-segmented cost visualization (D-15)

affects: [68-03, 68-04, 68-05, analytics-page, cost-trend-chart, provider-comparison-chart]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual attribute name fallback: getAttr(attrs, 'task_id') ?? getAttr(attrs, 'taskId') handles snake_case and camelCase OTel attribute names"
    - "FlexBarChart stacking: segments prop triggers alternate render path (backgroundColor style, not Tailwind gradient)"
    - "costByPeriodByProvider: time-bucketed aggregate query returning { bucket_start, byProvider } objects"

key-files:
  created:
    - src/components/FlexBarChart.test.tsx
  modified:
    - convex/otelLogs.ts
    - convex/aggregates.ts
    - src/components/FlexBarChart.tsx

key-decisions:
  - "D-15: FlexBarChart stacked segments use backgroundColor style (not Tailwind class) because colors are dynamic hex values from provider color map"
  - "D-16: costByPeriodByProvider returns array of time-bucketed objects (not flat Record) to enable trend chart rendering"
  - "Dual attribute fallback (task_id ?? taskId) applied to all 4 gateway handlers to handle gateway emit format variance"

patterns-established:
  - "Pattern: OTel handlers check both snake_case and camelCase attribute names via getAttr fallback chain"
  - "Pattern: FlexBarChart segments prop = alternate render path; absent = original gradient bar (backward compatible)"

requirements-completed: [GW-09, GW-10, GW-11]

# Metrics
duration: 18min
completed: 2026-05-22
---

# Phase 68 Plan 02: Gateway Event Redirect + FlexBarChart Stacked Segments Summary

**OTel gateway event handlers redirected to dedicated gatewayTasks/routingDecisions tables, costByPeriodByProvider time-bucketed query added, FlexBarChart extended with dynamic hex stacked segment rendering**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-22T11:00:00Z
- **Completed:** 2026-05-22T11:18:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Redirected 3 gateway.task_* OTel handlers from toolExecutions workaround to api.gatewayTasks.upsert (Plan 01 table)
- Redirected gateway.routing_decision OTel handler from generic events table to api.routingDecisions.insert (Plan 01 table)
- Added costByPeriodByProvider query to aggregates.ts returning time-bucketed { bucket_start, byProvider: Record<string, number> } for trend charts
- Extended FlexBarChart with StackedSegment interface and stacked rendering branch; all 6 tests passing; backward compatibility verified

## Task Commits

Each task was committed atomically:

1. **Task 1: OTel gateway event redirect + costByPeriodByProvider query** - `2a8bd3b` (feat)
2. **Task 2 RED: FlexBarChart stacked segments failing tests** - `936bc64` (test)
3. **Task 2 GREEN: FlexBarChart stacked segments implementation** - `63c0ce2` (feat)

**Plan metadata:** (final docs commit)

_Note: Task 2 follows TDD — separate RED (test) and GREEN (feat) commits_

## Files Created/Modified

- `convex/otelLogs.ts` - 4 gateway case handlers redirected to gatewayTasks.upsert / routingDecisions.insert
- `convex/aggregates.ts` - costByPeriodByProvider query exported (time-bucketed provider cost breakdown)
- `src/components/FlexBarChart.tsx` - StackedSegment interface exported; segments? prop on FlexBarSegment; stacked render path added
- `src/components/FlexBarChart.test.tsx` - 6 tests covering single-value backward compat and all stacked segment behavior

## Decisions Made

- Dual attribute name fallback (task_id ?? taskId) on all 4 gateway handlers: gateway can emit either snake_case or camelCase OTel attribute names; fallback chain handles both without config changes
- FlexBarChart stacked segments use inline `backgroundColor` style (not Tailwind class) because hex colors are dynamic provider values not statically known at compile time
- costByPeriodByProvider returns time-bucketed array (not flat grouped Record) — callers need per-bucket data to render trend lines

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript passed clean on both tasks. All 6 vitest tests pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 data pipeline is complete: OTel events write to correct tables, aggregate query available
- Plan 03 (UI: GatewayTasksPage + ProviderComparisonChart) can consume api.gatewayTasks.listPaginated and api.gatewayTasks.providerStats
- Plan 04 (UI: CostTrendChart with provider stacking) can consume api.aggregates.costByPeriodByProvider and FlexBarChart segments prop
- No blockers

---
*Phase: 68-gateway-observability*
*Completed: 2026-05-22*
