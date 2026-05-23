---
phase: 69-sdk-spend-guard-multi-provider-ux
plan: 02
subsystem: ui
tags: [react, convex, sparkline, alerts, spend-guard, typescript]

# Dependency graph
requires:
  - phase: 69-01
    provides: SDKSpendGuard shim, costByPeriodByProvider query, providers lib extraction

provides:
  - SDKSpendGuard full component with hourly sparkline, projected daily spend, and inline overshoot warning
  - SDKSpendCapGauge replaced with backward-compat re-export shim
  - Analytics page wired to SDKSpendGuard
  - evaluateCondition in alerts.ts extended with sdk_spend_usd_today metric (both instances)
  - alerts.test.ts filled with real threshold comparison and billingType filtering tests

affects: [Analytics page, alert cron evaluation, SDKSpendCapGauge consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "projectDayEndSpend: exported pure function for day-end projection, testable without React"
    - "evaluateCondition made async with Promise.all for db-backed metrics"
    - "Backward-compat shim pattern: old component file becomes re-export of new location"

key-files:
  created: []
  modified:
    - src/components/SDKSpendGuard.tsx
    - src/components/SDKSpendCapGauge.tsx
    - src/components/SDKSpendGuard.test.tsx
    - src/pages/Analytics.tsx
    - convex/alerts.ts
    - convex/alerts.test.ts

key-decisions:
  - "evaluateCondition made async (was sync) to enable ctx.db queries for sdk_spend_usd_today — required updating all .map() callers to await Promise.all()"
  - "Daily rollup queried first; falls back to hourly sum when daily rollup not yet available (runs at 01:00 UTC)"
  - "SDKSpendCapGauge.tsx replaced with 3-line re-export shim rather than deletion to preserve backward compatibility with any direct imports"
  - "Sparkline fixed-width 300px rather than ResizeObserver for simplicity — adequate for card layout"
  - "Projection row only shown when elapsedHours >= 2 to avoid misleading early-day extrapolations"

patterns-established:
  - "Async evaluateCondition pattern: inner functions in Convex cron handlers can use ctx.db when made async and called via Promise.all"
  - "Exported pure projection function: complex business logic split from React component for unit testability"

requirements-completed: [GW-12, GW-14]

# Metrics
duration: 15min
completed: 2026-05-23
---

# Phase 69 Plan 02: SDK Spend Guard Upgrade Summary

**SDKSpendGuard upgraded with hourly sparkline + day-end projection; alerts.ts evaluateCondition extended with async sdk_spend_usd_today metric and daily/hourly fallback**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-23T10:30:00Z
- **Completed:** 2026-05-23T10:45:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- SDKSpendGuard now sources data from `costByPeriodByProvider` (hourly, 24h lookback) and renders an SVG sparkline showing hourly API spend buckets
- `projectDayEndSpend` exported as pure function: computes projected daily total and estimated cap-hit time based on elapsed hours and current spend; inline overshoot warning appears when elapsedHours >= 2
- SDKSpendCapGauge.tsx converted to a 3-line backward-compat re-export shim; all existing test imports continue to work
- Analytics page imports SDKSpendGuard directly (no more SDKSpendCapGauge reference)
- Both `evaluateCondition` instances in alerts.ts made async and extended with `sdk_spend_usd_today`: queries daily aggregate table first, falls back to hourly sum when daily rollup not yet available; filters to billingType=api
- alerts.test.ts filled with 6 real tests covering threshold comparison (at/above/below threshold, zero) and billingType filtering (api-only sum, subscription excluded)

## Task Commits

Each task was committed atomically:

1. **Task 1: Upgrade SDKSpendCapGauge to SDKSpendGuard with sparkline and projection** - `7895739` (feat)
2. **Task 2: Extend evaluateCondition with sdk_spend_usd_today metric + fill alerts.test.ts** - `29d1507` (feat)

## Files Created/Modified

- `src/components/SDKSpendGuard.tsx` - Full upgraded component: sparkline, projectDayEndSpend, projection row, overshoot warning
- `src/components/SDKSpendCapGauge.tsx` - Replaced with 3-line re-export shim pointing to SDKSpendGuard
- `src/components/SDKSpendGuard.test.tsx` - Real tests for projectDayEndSpend (3 tests) + classifyCapStatus regression (4 tests)
- `src/pages/Analytics.tsx` - Switched import from SDKSpendCapGauge to SDKSpendGuard
- `convex/alerts.ts` - Both evaluateCondition instances made async; sdk_spend_usd_today branch added with daily+hourly fallback; all .map() calls upgraded to Promise.all
- `convex/alerts.test.ts` - Replaced .todo stubs with 6 real tests

## Decisions Made

- Made `evaluateCondition` async in both cron handler instances — adding `ctx.db.query()` requires async, and all callers must use `await Promise.all(conditions.map(evaluateCondition))`. The plan flagged this exactly.
- Daily rollup queried first, hourly used as fallback — daily rollup is seeded at 01:00 UTC, so early-morning evaluations before rollup runs would return 0 without the hourly fallback.
- Backward-compat shim for SDKSpendCapGauge — existing test file imports from `./SDKSpendCapGauge` and would break without the shim; 3 lines vs tracking down all import sites.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both evaluateCondition instances matched exactly as described in the plan. TypeScript was clean after both tasks.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SDKSpendGuard is ready for visual verification at the Analytics page
- The sdk_spend_usd_today metric in evaluateCondition is wired to the existing alert cron infrastructure; the "SDK Spend Guard" seeded rule from Plan 01 will fire when API spend hits 80% of $5 daily cap
- All 21 tests pass (SDKSpendGuard: 7, SDKSpendCapGauge: 8, alerts: 6)

---
*Phase: 69-sdk-spend-guard-multi-provider-ux*
*Completed: 2026-05-23*
