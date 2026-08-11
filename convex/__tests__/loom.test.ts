/**
 * loom.ts pure helpers (Phase 119).
 *
 * Three rules carry decisions and each has a plausible wrong implementation:
 *  - D-05's cap must keep the NEWEST events, because a run's tail is what you
 *    read when it fails. Dropping the tail loses the error that ended it.
 *  - `error` must be STICKY: a run that errored is not "complete" because a
 *    later step finished.
 *  - the event vocabulary is closed, so a typo'd emit is refused rather than
 *    stored as a state nothing renders.
 */
import { describe, test, expect } from "vitest";
import {
  LOOM_STEP_EVENT_CAP,
  appendBounded,
  deriveStatus,
  isLoomEvent,
} from "../loom";

describe("appendBounded — D-05 bounded trail", () => {
  test("appends normally below the cap", () => {
    expect(appendBounded([1, 2], 3)).toEqual([1, 2, 3]);
  });

  test("at the cap, keeps the NEWEST and drops the oldest", () => {
    const full = Array.from({ length: LOOM_STEP_EVENT_CAP }, (_, i) => i);
    const out = appendBounded(full, 9999);

    expect(out.length).toBe(LOOM_STEP_EVENT_CAP);
    // The newest event survived...
    expect(out[out.length - 1]).toBe(9999);
    // ...and the oldest was the one dropped.
    expect(out[0]).toBe(1);
    expect(out).not.toContain(0);
  });

  test("never exceeds the cap even when far over", () => {
    const over = Array.from({ length: LOOM_STEP_EVENT_CAP + 50 }, (_, i) => i);
    expect(appendBounded(over, -1).length).toBe(LOOM_STEP_EVENT_CAP);
  });
});

describe("deriveStatus", () => {
  const ev = (stepId: string, event: string) => ({ stepId, event });

  test("running while steps remain", () => {
    expect(deriveStatus([ev("a", "complete")], 3)).toBe("running");
  });

  test("complete once every step has completed", () => {
    expect(
      deriveStatus([ev("a", "complete"), ev("b", "complete")], 2)
    ).toBe("complete");
  });

  test("error is STICKY — a later completion does not clear it", () => {
    const events = [
      ev("a", "error"),
      ev("a", "complete"),
      ev("b", "complete"),
    ];
    // Without stickiness this reports "complete" and a partially-failed run
    // renders as a success.
    expect(deriveStatus(events, 2)).toBe("error");
  });

  test("duplicate completes for one step do not fake progress", () => {
    const events = [ev("a", "complete"), ev("a", "complete")];
    expect(deriveStatus(events, 2)).toBe("running");
  });

  test("CONTROL: a clean full run really does reach complete", () => {
    // Pairs with the error test — proves "error" is not simply always returned.
    expect(
      deriveStatus([ev("a", "complete"), ev("b", "complete")], 2)
    ).toBe("complete");
  });
});

describe("isLoomEvent — closed vocabulary", () => {
  test("accepts every documented event", () => {
    for (const e of ["start", "action", "complete", "error", "warn"]) {
      expect(isLoomEvent(e)).toBe(true);
    }
  });

  test("rejects anything else, so a typo cannot be stored", () => {
    expect(isLoomEvent("completed")).toBe(false);
    expect(isLoomEvent("")).toBe(false);
    expect(isLoomEvent("START")).toBe(false);
  });
});
