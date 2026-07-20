---
phase: 101-reminders-calendar-command-center
fixed_at: 2026-07-20T19:03:00-04:00
review_path: .planning/phases/101-reminders-calendar-command-center/101-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 101: Code Review Fix Report

**Fixed at:** 2026-07-20T19:03:00-04:00
**Source review:** .planning/phases/101-reminders-calendar-command-center/101-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (2 Critical + 6 Warning; fix_scope=critical_warning — IN-01..IN-03 untouched)
- Fixed: 8
- Skipped: 0

All findings were verified against live code before fixing (mechanisms confirmed, including a cross-repo trace of `reminder_nudge.py:_is_due` for CR-01). **No astridr-repo code changes were needed**: CR-01 and WR-02 fix at the Convex handler level, which covers the dashboard, `/reminders-ingest`, and the Ástríðr tool path in one place (all snooze/create/update calls route through the same handlers), and WR-05's root fix belongs in the UI day-keying, not `calendar_cache.py`'s normalization. Verification: `npx vitest run convex/reminders.test.ts convex/remindersIngest.test.ts src/pages/Reminders.test.tsx` → 81 passed (73 before, +8 new regression tests), `npx tsc --noEmit` clean, and the astridr-repo suites (`test_reminders.py`, `test_calendar_cache.py`, `test_reminder_nudge.py`) → 42 passed, confirming the cross-repo contract still holds.

## Fixed Issues

### CR-01: Snooze silently defeated REM-05 nudge dedupe

**Files modified:** `convex/reminders.ts`, `convex/reminders.test.ts`
**Commit:** c4d5693
**Applied fix:** `snoozeReminderHandler` now patches `notifiedAt: undefined` (Convex removes the field), making the snoozed wake-up eligible for exactly one new nudge. Covers both the dashboard SnoozeMenu and Ástríðr's `op:snooze` (both dispatch to this handler). New test: snooze on a row carrying `notifiedAt` clears the stamp.

### CR-02: Edit popover shifted `dueAt` by the UTC offset on every save

**Files modified:** `src/components/reminders/ReminderList.tsx`
**Commit:** d02ab26
**Applied fix:** Seed the `datetime-local` input with local wall time via `format(new Date(...), "yyyy-MM-dd'T'HH:mm")` (date-fns `format` was already imported), matching the local parse on Save and QuickAdd/SnoozeMenu's local→local round trip.

### WR-01: `completeReminderHandler` not idempotent — duplicate next occurrence on double-complete

**Files modified:** `convex/reminders.ts`, `convex/reminders.test.ts`
**Commit:** 9613d84
**Applied fix:** Guard changed to `if (!existing || existing.status === "done") return;`. New test: completing a recurring reminder twice spawns exactly one next occurrence and does not re-patch the done row's timestamps.

### WR-02: `recurrence.interval` never validated — `interval: 0` caused a self-perpetuating nudge loop

**Files modified:** `convex/reminders.ts`, `convex/reminders.test.ts`
**Commit:** 43a391a
**Applied fix:** New `assertValidRecurrence()` throws `"recurrence.interval must be an integer >= 1"`, called from `createReminderHandler` and `updateReminderHandler` — one choke point covering UI, HTTP ingest, and the tool path. New tests: create rejects 0 / -1 / 1.5 (nothing inserted); update rejects invalid and accepts valid intervals.

### WR-03: Weekly recurrence ignored `interval` when `byday` present

**Files modified:** `convex/reminders.ts`, `convex/reminders.test.ts`
**Commit:** 218cc3c
**Applied fix:** Implemented option A from the review (implement, don't reject): after `nextBydayOccurrence`, if the match rolled into a new UTC week (Sunday-start, matching `ICAL_DAY_CODES`), add `(interval - 1) * 7` days. rrule-style: multi-byday matches within the same "on" week continue without a jump. New tests: every-2-weeks-on-MO → +14 days; MO→WE same week unshifted, WE→MO wraps two weeks out.

### WR-04: Calendar upsert matched by `googleEventId` alone — shared invites ping-ponged between profiles

**Files modified:** `convex/calendarEvents.ts`, `convex/remindersIngest.test.ts`
**Commit:** f999287
**Applied fix:** As suggested — match via `.collect().find(r => r.profileId === profileId && r.calendarAccount === calendarAccount)` and drop `profileId`/`calendarAccount` from the patch, so each (profile, account) pair keeps its own copy of a shared event. New test: a second account's push of the same `googleEventId` inserts its own row, never steals/re-owns the first, and re-pushes patch in place.

### WR-05: All-day events rendered one day early (cached UTC midnight, bucketed local midnight)

**Files modified:** `src/components/reminders/CalendarOverlay.tsx`, `src/pages/Reminders.tsx`, `src/pages/Reminders.test.tsx`
**Commit:** 2a68895
**Applied fix:** New exported `calendarEventDayKey(ev)` in CalendarOverlay — all-day events key by their UTC calendar date rendered as the local day; timed events keep local-day keying. Used by both `eventsByDay` and Reminders' `selectedDayEvents` so grid and day-filter agree. New test (runner is UTC-4, so it genuinely exercises the negative-offset path): an all-day event lands in its own date's cell and clicking that day shows it marked "All day".

### WR-06: Edit's optimistic override never reconciled and never rolled back on failure

**Files modified:** `src/components/reminders/ReminderList.tsx`
**Commit:** 572eac8
**Applied fix:** `handleEdit` now clears the edit fields (`title`/`dueAt`/`priority`) from the override in a `finally` block — rollback to server truth on failure, reconcile on success (Convex mutations resolve after local queries reflect the write, so no flicker). Deviation from the review's sketch: instead of deleting the whole override entry, only the edit fields are removed so a concurrent status/snooze override on the same row survives.

## Skipped Issues

None.

---

_Fixed: 2026-07-20T19:03:00-04:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
