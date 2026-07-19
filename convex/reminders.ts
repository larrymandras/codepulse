/**
 * Phase 101 Plan 01 (REM-01/REM-04) — reminders Convex module.
 *
 * Convex is the single source of truth for reminders (D-01) — both CodePulse
 * (this module's mutations, called directly from the UI) and Ástríðr
 * (authed /reminders-ingest + /reminders-read httpActions, D-07) read/write
 * the same `reminders` table. `source` records origin only and is never a
 * write gate (D-09).
 *
 * Recurrence is "rrule-lite" (D-05): { freq, interval, byday?, until? }.
 * `computeNextDueAt` is the pure engine — see the "Task 2" section below.
 */

// ============================================================
// Task 2 — computeNextDueAt (pure, unit-first recurrence engine)
// ============================================================

export type RecurrenceFreq = "daily" | "weekly" | "monthly";

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
  byday?: string[];
  until?: number;
}

const ICAL_DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/**
 * Given a UTC calendar date, add `months` months, clamping the day-of-month
 * to the last valid day of the target month (e.g. Jan 31 + 1mo -> Feb 28/29).
 * Preserves the original UTC time-of-day.
 */
function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();

  const targetMonthIndex = month + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  // Day 0 of (targetMonth + 1) is the last day of targetMonth.
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(
    Date.UTC(targetYear, targetMonth, clampedDay, hours, minutes, seconds)
  );
}

/**
 * Weekly + byday: find the next date strictly after `date` whose weekday
 * matches one of the given iCal day codes (MO/TU/WE/TH/FR/SA/SU).
 */
function nextBydayOccurrence(date: Date, byday: string[]): Date {
  const codes = new Set(byday.map((d) => d.toUpperCase()));
  const next = new Date(date);
  for (let i = 0; i < 14; i++) {
    next.setUTCDate(next.getUTCDate() + 1);
    if (codes.has(ICAL_DAY_CODES[next.getUTCDay()])) return next;
  }
  // No match found in two weeks (malformed byday) — fall back to +7 days.
  const fallback = new Date(date);
  fallback.setUTCDate(fallback.getUTCDate() + 7);
  return fallback;
}

/**
 * Advances `dueAt` (epoch seconds) by one occurrence of `recurrence`.
 * Deterministic — operates only on the passed dueAt, never the wall clock.
 * Returns null for a one-off (no recurrence) or when the computed next
 * occurrence is past `recurrence.until` (bounded recurrence terminates).
 */
export function computeNextDueAt(
  dueAt: number,
  recurrence: Recurrence | undefined
): number | null {
  if (!recurrence) return null;
  const { freq, interval, byday, until } = recurrence;
  const date = new Date(dueAt * 1000);
  let next: Date;

  if (freq === "daily") {
    next = new Date(date);
    next.setUTCDate(next.getUTCDate() + interval);
  } else if (freq === "weekly") {
    next =
      byday && byday.length > 0
        ? nextBydayOccurrence(date, byday)
        : (() => {
            const d = new Date(date);
            d.setUTCDate(d.getUTCDate() + 7 * interval);
            return d;
          })();
  } else {
    next = addMonthsClamped(date, interval);
  }

  const nextEpoch = Math.round(next.getTime() / 1000);
  if (until !== undefined && nextEpoch > until) return null;
  return nextEpoch;
}
