/**
 * Phase 101 Plan 01 (REM-01/REM-04) — reminders Convex module unit tests.
 *
 * Uses plain vitest — convex-test is NOT installed in this repo
 * (see convex/runtimeIngest.test.ts:9). CRUD mutations/queries are tested
 * against a minimal in-memory fake `ctx.db` (mirrors the pattern in
 * convex/evalScores.test.ts's `storeEvalScoreHandler` coverage).
 */
import { describe, it, expect } from "vitest";
import { computeNextDueAt } from "./reminders";

// ---------------------------------------------------------------------------
// Task 2 — computeNextDueAt (pure, unit-first)
// ---------------------------------------------------------------------------

// Epoch-seconds fixture helper (matches profiles.ts Date.now()/1000 convention).
const day = (y: number, m: number, d: number, h = 9) =>
  Math.floor(Date.UTC(y, m - 1, d, h, 0, 0) / 1000);

describe("computeNextDueAt", () => {
  it("advances daily by interval days", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, { freq: "daily", interval: 1 })).toBe(
      day(2026, 3, 11)
    );
  });

  it("advances daily by a multi-day interval", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, { freq: "daily", interval: 3 })).toBe(
      day(2026, 3, 13)
    );
  });

  it("advances weekly by interval weeks with no byday", () => {
    const due = day(2026, 3, 10); // Tuesday
    expect(computeNextDueAt(due, { freq: "weekly", interval: 1 })).toBe(
      day(2026, 3, 17)
    );
  });

  it("advances weekly by a multi-week interval", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, { freq: "weekly", interval: 2 })).toBe(
      day(2026, 3, 24)
    );
  });

  it("selects the next matching byday weekday for weekly recurrence", () => {
    const due = day(2026, 3, 9); // Monday
    const next = computeNextDueAt(due, {
      freq: "weekly",
      interval: 1,
      byday: ["MO", "WE", "FR"],
    });
    // Next matching weekday strictly after Monday is Wednesday 2026-03-11.
    expect(next).toBe(day(2026, 3, 11));
  });

  it("advances monthly by interval months", () => {
    const due = day(2026, 1, 15);
    expect(computeNextDueAt(due, { freq: "monthly", interval: 1 })).toBe(
      day(2026, 2, 15)
    );
  });

  it("clamps end-of-month overflow (Jan 31 -> Feb 28, non-leap year)", () => {
    const due = day(2026, 1, 31);
    expect(computeNextDueAt(due, { freq: "monthly", interval: 1 })).toBe(
      day(2026, 2, 28)
    );
  });

  it("clamps end-of-month overflow across a leap year (Jan 31 2028 -> Feb 29)", () => {
    const due = day(2028, 1, 31);
    expect(computeNextDueAt(due, { freq: "monthly", interval: 1 })).toBe(
      day(2028, 2, 29)
    );
  });

  it("returns null when the computed next occurrence is past `until`", () => {
    const due = day(2026, 3, 10);
    const until = day(2026, 3, 12); // before the computed next (2026-03-17)
    expect(
      computeNextDueAt(due, { freq: "weekly", interval: 1, until })
    ).toBeNull();
  });

  it("returns the next occurrence when it lands exactly on `until`", () => {
    const due = day(2026, 3, 10);
    const until = day(2026, 3, 11); // exactly the computed next (daily +1)
    expect(
      computeNextDueAt(due, { freq: "daily", interval: 1, until })
    ).toBe(until);
  });

  it("returns null for a one-off (no recurrence)", () => {
    const due = day(2026, 3, 10);
    expect(computeNextDueAt(due, undefined)).toBeNull();
  });
});
