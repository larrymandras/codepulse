---
phase: 07-intelligence-layer
plan: 02
subsystem: intelligence
tags:
  - forecasting
  - cost-tracking
  - budget
  - analytics
dependency_graph:
  requires:
    - 07-01 (daily aggregates must exist for forecast to read)
    - convex/aggregates.ts (costByPeriod pattern, by_type_period_bucket index)
    - convex/alertRulesConfig.ts (agentConfigs upsert pattern)
  provides:
    - convex/forecasts.ts (costForecast query, getBudgetConfig query, setBudgetCap mutation)
    - src/components/CostForecastPanel.tsx (cost forecast UI panel)
    - Analytics page CostForecastPanel integration
    - Settings page Intelligence section with budget cap input
  affects:
    - src/pages/Analytics.tsx (CostForecastPanel inserted before summary row)
    - src/pages/Settings.tsx (Intelligence section appended)
tech_stack:
  added: []
  patterns:
    - Moving average with 7/14-day window selection based on data availability
    - agentConfigs upsert pattern (query by_key, patch if exists, insert if not)
    - FlexBarChart CSS flex sparkline pattern
    - Optimistic save state (idle -> saving -> saved -> idle)
key_files:
  created:
    - convex/forecasts.ts
    - src/components/CostForecastPanel.tsx
  modified:
    - convex/forecasts.test.ts
    - src/pages/Analytics.tsx
    - src/pages/Settings.tsx
    - convex/_generated/api.d.ts
decisions:
  - Used 7-day window when <30 days data available, 14-day when >=30 for more stable forecast as data grows
  - classifyBudgetStatus thresholds: 80% = warning, 100% = exceeded (matches UI-SPEC)
  - Budget cap of 0 treated same as null (no cap) for UX simplicity
  - api.d.ts updated manually since npx convex dev not available in worktree context
metrics:
  duration: ~20 min
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_changed: 6
---

# Phase 7 Plan 02: Cost Forecasting — Summary

**One-liner:** Moving average cost forecasting with daily/weekly/monthly projections, budget threshold tracking, and CostForecastPanel UI on Analytics page with budget cap configuration on Settings page.

## What Was Built

### convex/forecasts.ts
Three exported pure helper functions (tested) and three Convex functions:

- `computeMovingAverage(dailyValues, totalDaysAvailable)` — 7-day window when <30 days data, 14-day when >=30
- `projectSpend(avgDaily)` — returns `{ daily, weekly: daily*7, monthly: daily*30 }`
- `classifyBudgetStatus(projectedMonthly, budgetCap)` — ok/warning (>=80%)/exceeded (>=100%)
- `costForecast` query — reads last 30 days of daily cost aggregates, groups by bucket_start, computes moving average, returns projections + budget status + dailyHistory + insufficientData flag
- `getBudgetConfig` query — reads `intelligence.budget_cap` from agentConfigs
- `setBudgetCap` mutation — validates `cap > 0 && cap < 1_000_000`, upserts agentConfigs row

### src/components/CostForecastPanel.tsx
- Three stat boxes: Projected Daily | Projected Weekly | Projected Monthly (formatCost values)
- Budget progress bar with `--status-ok` / `--status-warn` / `--status-error` CSS variables
- Status labels: "On track" / "Near limit" / "Over budget"
- "No budget cap configured" message when no cap set
- 7-day CSS flex sparkline from `dailyHistory` array
- "Insufficient data for forecast" message when fewer than 3 days available

### Analytics.tsx integration
CostForecastPanel inserted before the summary row grid, wrapped in `SectionErrorBoundary name="Cost Forecast"`.

### Settings.tsx Intelligence section
- `IntelligenceSettings` component with Monthly Budget Cap ($) number input
- Initialized from `getBudgetConfig` query, saves via `setBudgetCap` mutation
- Optimistic save state: idle → "Saving..." → "Saved" (2 sec) → idle
- Validation: must be > 0 and < 1,000,000
- Wrapped in `SectionErrorBoundary name="Intelligence"`

## Test Results

`npx vitest run convex/forecasts.test.ts` — 8/8 tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] api.d.ts missing forecasts module**
- **Found during:** Task 2 TypeScript check
- **Issue:** `convex/_generated/api.d.ts` didn't include `forecasts` module — `api.forecasts` was unknown type. `npx convex dev` cannot run in worktree context.
- **Fix:** Manually added `import type * as forecasts from "../forecasts.js"` and `forecasts: typeof forecasts` to the generated type file, following the exact pattern of all other modules.
- **Files modified:** `convex/_generated/api.d.ts`
- **Commit:** 25ce7c9

**2. [Rule 1 - Bug] Implicit any types in CostForecastPanel sparkline**
- **Found during:** Task 2 TypeScript check
- **Issue:** `dailyHistory.map((d, i) =>` had implicit `any` types since query return type wasn't inferred through the generated API yet.
- **Fix:** Added explicit type annotations `(d: { date: string; value: number }, i: number)` and same for the max calculation.
- **Files modified:** `src/components/CostForecastPanel.tsx`
- **Commit:** 25ce7c9

## Pre-existing Issues (Out of Scope)

- `convex/crons.ts` — `briefings`, `anomalyDetection`, `memoryQuality` not in generated API (future phase stubs)
- `convex/runtimeIngest.ts` — duplicate `now` variable declarations

Logged to deferred items — not caused by this plan's changes.

## Known Stubs

None. All data is wired to live Convex queries.

## Threat Surface Scan

No new network endpoints or auth paths introduced beyond what the threat model covers. `setBudgetCap` mutation validates `cap > 0 && cap < 1_000_000` as required by T-07-03.

## Self-Check: PASSED

- [x] `convex/forecasts.ts` — exists, contains all required exports
- [x] `convex/forecasts.test.ts` — no `test.todo` stubs, 8 tests pass
- [x] `src/components/CostForecastPanel.tsx` — exists, contains `api.forecasts.costForecast`, all required strings
- [x] `src/pages/Analytics.tsx` — contains `CostForecastPanel`, `SectionErrorBoundary name="Cost Forecast"`
- [x] `src/pages/Settings.tsx` — contains `setBudgetCap`, `Save Budget Settings`, `Intelligence` section header
- [x] Commits: `2f93a6f` (Task 1), `25ce7c9` (Task 2)
