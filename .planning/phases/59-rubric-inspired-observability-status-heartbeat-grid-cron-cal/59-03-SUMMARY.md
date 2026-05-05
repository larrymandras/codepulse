---
phase: 59-rubric-inspired-observability
plan: 03
subsystem: cron-calendar
tags: [calendar, cron, daily-rhythm, visualization, observability]
dependency_graph:
  requires: [59-01]
  provides: [CronCalendarView]
  affects: [Automation page integration]
tech_stack:
  added: [date-fns]
  patterns: [hour-grid calendar, slot-click detail, category color-coding]
key_files:
  created:
    - src/components/CronCalendarView.tsx
    - src/components/CronCalendarView.test.tsx
  modified: []
decisions:
  - "Adapted to actual cronSchedules.ts interface (CronSchedule object with jobName/label/intervalSeconds/dailyUTC) instead of plan-assumed string-based interface"
  - "Used Fragment keyed rows to avoid React key warnings in grid"
  - "Added data-slot attributes for reliable test targeting"
  - "Show header/toggle always; empty state only affects grid area"
metrics:
  duration: "4m"
  completed: "2026-05-05T19:00:21Z"
  tasks_completed: 1
  tasks_total: 1
  test_count: 7
  test_pass: 7
---

# Phase 59 Plan 03: Cron Calendar View Summary

7-day hour-by-hour calendar grid combining Astridr daily_rhythm entries (via Convex hook) and Convex system cron jobs with category color coding, system toggle, slot-click detail panel, current-time indicator, and next-up countdown.

## What Was Built

### CronCalendarView Component (`src/components/CronCalendarView.tsx`)

- **7-day grid** from Monday to Sunday with hour rows (5:00-22:00 default, expands if entries exist outside range)
- **Daily rhythm entries** parsed from `useDailyRhythm()` hook — maps days/time to grid slots
- **System cron entries** from `CRON_SCHEDULES` — handles interval-based (hourly slots), dailyUTC (fixed hour), and daily crons
- **Category color coding** via `CATEGORY_COLORS` — health=teal, morning=orange, research=blue, content=purple, review=red, system=gray
- **System crons toggle** — checkbox to show/hide Convex system cron entries
- **Slot click detail** (D-07) — clicking any occupied cell opens a detail panel below the grid showing full action text, category badge, and source
- **Current-time indicator** — indigo border line positioned at current minute within the current hour/day cell
- **Next-up countdown** — shows the soonest upcoming entry with time-to-fire
- **Empty state** — graceful "No scheduled tasks" message when no data sources available
- **Overflow handling** — max 3 badges per cell, "+N" for overflow

### Test Coverage (`src/components/CronCalendarView.test.tsx`)

7 tests covering:
1. Heading text rendered
2. Day column headers (Mon-Sun)
3. System crons toggle present
4. Toggle checked by default
5. Empty state when no data
6. D-07: Slot click reveals detail panel with full action text
7. D-12: Calendar renders from stored Convex data without live Astridr connection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted to actual cronSchedules.ts interface**
- **Found during:** Task 1 implementation (per .continue-here.md critical deviation)
- **Issue:** Plan assumed `estimateNextRun(schedule: string): Date | null` but actual interface is `estimateNextRun(schedule: CronSchedule, lastRunAt?: number): number` with `CronSchedule` having `jobName`, `label`, `interval`, `source`, `intervalSeconds`, `dailyUTC?` fields
- **Fix:** Used actual interface — pass full `CronSchedule` object to `estimateNextRun`, read `jobName`/`label` instead of `name`/`schedule`/`functionPath`, handle `dailyUTC` and `intervalSeconds` for slot placement
- **Files modified:** src/components/CronCalendarView.tsx
- **Commit:** a9699ee

**2. [Rule 1 - Bug] Fixed React Fragment key warning and empty state rendering**
- **Found during:** Task 1 test execution
- **Issue:** Hour rows needed Fragment wrapping with keys; empty state early-return prevented header/toggle from rendering in tests
- **Fix:** Used `<Fragment key={...}>` for hour rows; restructured to always render header+toggle, empty state only in grid area
- **Files modified:** src/components/CronCalendarView.tsx, src/components/CronCalendarView.test.tsx
- **Commit:** a9699ee

## Verification

- `npx vitest run src/components/CronCalendarView.test.tsx` — 7/7 pass
- `npx tsc --noEmit` — 0 errors
- Component imports from useDailyRhythm, rhythmCategories, cronSchedules (all from Plan 01)

## Self-Check: PASSED
