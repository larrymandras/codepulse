---
phase: 101-reminders-calendar-command-center
plan: 07
subsystem: ui
tags: [react, vitest, reminders, calendar]

# Dependency graph
requires:
  - phase: 101-reminders-calendar-command-center (plan 06)
    provides: Reminders page UI, ReminderList grouping/day-filter logic, 101-UAT.md gap diagnosis (test 8)
provides:
  - Fix for the one diagnosed gap from 101-UAT.md test 8 — undated reminders no longer vanish when a calendar day is selected
  - Regression test guarding undated-reminder visibility under a day filter
affects: [101-reminders-calendar-command-center (phase close-out)]

# Tech tracking
tech-stack:
  added: []
  patterns: [RED-first regression test for a UAT-diagnosed gap, minimal single-predicate fix]

key-files:
  created: []
  modified:
    - src/pages/Reminders.test.tsx
    - src/components/reminders/ReminderList.tsx

key-decisions:
  - "Exempt due===undefined rows from dayFiltered rather than adding a new UI grouping — undated reminders already group under Upcoming, so this is a pure filter-predicate fix with zero UI/CSS/Convex changes."

patterns-established:
  - "Gap-closure plans (gap_source: 101-UAT.md) follow RED-first: the regression test is committed failing before the fix, so the test file's own history proves the defect existed."

requirements-completed: [UI-02, CAL-02]

# Metrics
duration: 6min
completed: 2026-07-20
---

# Phase 101 Plan 07: Undated Reminder Day-Filter Gap Closure Summary

**Closed UAT test 8: `dayFiltered` in ReminderList.tsx now exempts `due === undefined` rows so undated reminders stay visible under Upcoming when a calendar day is selected — one-line predicate change, RED-first regression test.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-20T18:19:00-04:00 (approx)
- **Completed:** 2026-07-20T18:20:52-04:00
- **Tasks:** 2 completed (RED, GREEN)
- **Files modified:** 2

## Accomplishments
- Added a regression test to `Reminders.test.tsx` that reproduces the operator's exact repro (undated reminder created via QuickAdd "vanishes" the moment a future calendar day is clicked) and confirmed it fails at the correct assertion (post-click visibility in the Upcoming region), not at setup/click
- Fixed `dayFiltered` in `ReminderList.tsx` to keep a row when `selectedDay === null`, when the row is undated (`due === undefined`), or when its due day matches `selectedDay` — dated-row filtering behavior is unchanged
- All 14 tests in `Reminders.test.tsx` pass; `npx tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — regression test for undated reminders under a day filter** - `9c246ab` (test)
2. **Task 2: GREEN — exempt undated reminders from the day filter** - `4afabf2` (fix)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/pages/Reminders.test.tsx` - Added "an undated reminder stays visible when a calendar day is selected (regression: UAT test 8)" test to the "calendar overlay (CAL-02)" describe block
- `src/components/reminders/ReminderList.tsx` - `dayFiltered` predicate changed from `due !== undefined && startOfDaySeconds(due) === selectedDay` to `due === undefined || startOfDaySeconds(due) === selectedDay`, with an explanatory comment

## Decisions Made
- Exempting `due === undefined` from `dayFiltered` (rather than introducing a new UI sub-group or "always show undated" toggle) is the minimal fix consistent with existing behavior: undated rows already land in the Upcoming bucket (`groups` L493-495) whenever they pass the day filter, so no `groups`/JSX/CSS change was needed at all.

## Deviations from Plan

None - plan executed exactly as written. RED confirmed before any fix was made; GREEN required only the single predicate line specified in the plan's `<action>`.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- This closes the last open gap from `101-UAT.md` (test 8, the only diagnosed issue out of 9 passed + 1 issue). Phase 101 has no other outstanding gaps or plans.
- Recommended before formally closing the phase: a quick live re-check per the plan's `<verification>` (open `/reminders` with an undated reminder present, click a future day, confirm it stays under Upcoming) — not required to close this plan since the automated regression test + tsc are green, but cheap insurance before the phase-level close-out.
- UAT test 8's secondary finding (conversational NL round-trip via Ástríðr) is explicitly out of scope here — both operator repro rows were `source:"dashboard"` QuickAdd, not Ástríðr-originated, per `101-UAT.md` "Secondary findings".

---
*Phase: 101-reminders-calendar-command-center*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: src/components/reminders/ReminderList.tsx
- FOUND: src/pages/Reminders.test.tsx
- FOUND: 9c246ab (test commit)
- FOUND: 4afabf2 (fix commit)
