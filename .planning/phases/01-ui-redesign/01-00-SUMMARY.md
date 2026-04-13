---
phase: 01-ui-redesign
plan: "00"
subsystem: testing
tags:
  - wave-0
  - test-stubs
  - vitest
  - ui-redesign
dependency_graph:
  requires: []
  provides:
    - wave-0-test-infrastructure
    - test-stubs-UI-01
    - test-stubs-UI-02
    - test-stubs-UI-03
    - test-stubs-UI-04
    - test-stubs-UI-05
    - test-stubs-UI-06
    - test-stubs-UI-07
  affects:
    - all subsequent Phase 01 plans (verification mechanism)
tech_stack:
  added: []
  patterns:
    - test.todo stubs for TDD wave-0 scaffolding
key_files:
  created:
    - src/components/__tests__/theme.test.ts
    - src/components/__tests__/SectionHeader.test.tsx
    - src/layouts/__tests__/DashboardLayout.test.tsx
    - src/components/__tests__/FlexBarChart.test.tsx
    - src/components/__tests__/EntityRow.test.tsx
    - src/components/__tests__/ActivityAnimation.test.tsx
  modified:
    - src/components/__tests__/MetricCard.test.tsx
    - src/App.test.tsx
decisions:
  - Wave 0 stubs use test.todo exclusively so no implementation is required for the suite to be green
  - Pre-existing App.test.tsx failure (missing useConvexConnectionState mock) fixed inline as it blocked plan success criteria
metrics:
  duration: "~2 minutes"
  completed: 2026-04-13
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 2
---

# Phase 01 Plan 00: Wave 0 Test Stubs Summary

**One-liner:** 7 Vitest test stub files scaffolded with test.todo placeholders covering UI-01 through UI-07, enabling npm test as the feedback mechanism for all subsequent Phase 01 plans.

## What Was Built

Created 6 new test stub files and updated 1 existing file to establish the Wave 0 test infrastructure required by VALIDATION.md. All stubs use `test.todo` so they are counted as skipped (not failures), allowing `npm test -- --run` to serve as the verification command for every subsequent plan in Phase 01.

### Files Created

| File | Requirement | Stubs |
|------|-------------|-------|
| `src/components/__tests__/theme.test.ts` | UI-01 | 6 todos: oklch tokens, --radius, hex absence, CRT/Cinzel removal |
| `src/components/__tests__/SectionHeader.test.tsx` | UI-03 | 3 todos: uppercase styling, Separator, action slot |
| `src/layouts/__tests__/DashboardLayout.test.tsx` | UI-04 | 6 todos: 5 nav groups, Lucide icons, Badge counts, collapsed state |
| `src/components/__tests__/FlexBarChart.test.tsx` | UI-05 | 5 todos: bar rendering, proportionality, tooltip, click, CSS token |
| `src/components/__tests__/EntityRow.test.tsx` | UI-06 | 5 todos: icon+text, trailing content, hover, border-b, icon size |
| `src/components/__tests__/ActivityAnimation.test.tsx` | UI-07 | 3 todos: activity-entry-new class, keyframe, box-shadow |

### Files Modified

| File | Change |
|------|--------|
| `src/components/__tests__/MetricCard.test.tsx` | Commented out ASCII arrow tests; added 7 todos for tabular-nums, TrendingUp/Down icons, borderless style |
| `src/App.test.tsx` | Added missing `useConvexConnectionState` to convex/react mock (pre-existing failure) |

## Test Results

```
Test Files  11 passed | 6 skipped (17)
Tests       59 passed | 35 todo (94)
Duration    ~1.8s
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing useConvexConnectionState mock in App.test.tsx**
- **Found during:** Task 1 verification
- **Issue:** `src/App.test.tsx` was already failing before any changes — the `convex/react` vi.mock was missing `useConvexConnectionState`, which `DashboardLayout.tsx` now uses. This caused `npm test -- --run` to report 1 failed test file, blocking the plan's success criteria.
- **Fix:** Added `useConvexConnectionState: vi.fn(() => ({ isWebSocketConnected: true }))` to the convex/react mock in App.test.tsx.
- **Files modified:** `src/App.test.tsx`
- **Commit:** `578a95e`
- **Scope:** Pre-existing failure confirmed via `git stash` test run — not introduced by this plan.

## Known Stubs

All stubs are intentional. Every `test.todo` in this plan is a placeholder that will be implemented in Plans 01-01 through 01-07 after the corresponding UI components are built. None of these stubs prevent the plan's goal (establishing wave-0 infrastructure) — they ARE the goal.

## Self-Check

- [x] `src/components/__tests__/theme.test.ts` — exists
- [x] `src/components/__tests__/SectionHeader.test.tsx` — exists
- [x] `src/layouts/__tests__/DashboardLayout.test.tsx` — exists
- [x] `src/components/__tests__/FlexBarChart.test.tsx` — exists
- [x] `src/components/__tests__/EntityRow.test.tsx` — exists
- [x] `src/components/__tests__/ActivityAnimation.test.tsx` — exists
- [x] `src/components/__tests__/MetricCard.test.tsx` — contains "tabular-nums"
- [x] Task 1 commit: `578a95e`
- [x] Task 2 commit: `ce3051d`
- [x] `npm test -- --run` exits clean (11 passed, 0 failed)
