import { describe, expect, it } from "vitest";
import { METRIC_STATE_COPY, DEFAULT_STALE_AFTER_MS } from "./metricState";
import type { MetricState } from "./metricState";

const EXPECTED_STATES: MetricState[] = [
  "loading",
  "ready",
  "empty",
  "stale",
  "unavailable",
  "error",
];

describe("metricState", () => {
  it("has exactly the six expected states, no more, no fewer", () => {
    // length===6 alone would pass on the wrong six members. Assert identity
    // of the sorted key set against the sorted expected set.
    const actual = Object.keys(METRIC_STATE_COPY).sort();
    const expected = [...EXPECTED_STATES].sort();
    expect(actual).toEqual(expected);
  });

  it('renders "no signal yet" as the exact empty-state copy (D-20)', () => {
    expect(METRIC_STATE_COPY.empty.label).toBe("no signal yet");
  });

  it("gives every state a non-empty default copy string", () => {
    for (const state of EXPECTED_STATES) {
      expect(METRIC_STATE_COPY[state].label.length).toBeGreaterThan(0);
    }
  });

  it("gives every state a Lucide icon component, never an emoji or a string", () => {
    for (const state of EXPECTED_STATES) {
      const icon = METRIC_STATE_COPY[state].icon;
      expect(typeof icon).not.toBe("string");
      expect(icon).toBeTruthy();
    }
  });

  it("never uses a hex literal for any tone", () => {
    for (const state of EXPECTED_STATES) {
      expect(METRIC_STATE_COPY[state].tone).not.toContain("#");
    }
  });

  it("never uses a raw Tailwind palette class for any tone", () => {
    const palettePattern = /-(slate|zinc|gray|neutral|stone|violet|purple|fuchsia)-[0-9]/;
    for (const state of EXPECTED_STATES) {
      expect(METRIC_STATE_COPY[state].tone).not.toMatch(palettePattern);
    }
  });

  it("uses only var(--token) references for tone, never a literal colour", () => {
    for (const state of EXPECTED_STATES) {
      expect(METRIC_STATE_COPY[state].tone).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it("gives loading and unavailable a neutral tone rather than a status colour", () => {
    // T-122-09-A: a metric that has not loaded has no health to report, and
    // a metric with no emitter behind it is an absence, not a failure.
    expect(METRIC_STATE_COPY.loading.tone).toBe("var(--muted-foreground)");
    expect(METRIC_STATE_COPY.unavailable.tone).toBe("var(--muted-foreground)");
  });

  it("gives ready a real, non-undefined table entry", () => {
    // ready has no icon-and-copy affordance in the same sense as the other
    // states (it renders the value instead) -- but the table still records
    // it explicitly so every consumer can index uniformly.
    expect(METRIC_STATE_COPY.ready).toBeDefined();
    expect(METRIC_STATE_COPY.ready.icon).toBeTruthy();
  });

  it("exports a single named DEFAULT_STALE_AFTER_MS constant", () => {
    expect(typeof DEFAULT_STALE_AFTER_MS).toBe("number");
    expect(DEFAULT_STALE_AFTER_MS).toBeGreaterThan(0);
  });
});
