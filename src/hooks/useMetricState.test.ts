import { describe, expect, it } from "vitest";
import { useMetricState } from "./useMetricState";
import { DEFAULT_STALE_AFTER_MS } from "@/lib/metricState";
import type { MetricState } from "@/lib/metricState";

// The hook takes a plain value and a plain timestamp -- no Convex mocking,
// no DOM, no renderHook needed. Call it directly like any pure function.

const NOW = Date.parse("2026-08-19T12:00:00Z");

describe("useMetricState", () => {
  it("unavailable wins over everything, including value === undefined", () => {
    const result = useMetricState(undefined, undefined, { unavailable: true });
    expect(result.state).toBe("unavailable");
  });

  it("unavailable wins even when a real, current value is present", () => {
    const result = useMetricState(42, Date.now(), { unavailable: true });
    expect(result.state).toBe("unavailable");
  });

  it("value === undefined and not unavailable -> loading", () => {
    const result = useMetricState(undefined, undefined);
    expect(result.state).toBe("loading");
  });

  it("an empty array -> empty", () => {
    const result = useMetricState<number[]>([], undefined);
    expect(result.state).toBe("empty");
  });

  it("null -> empty", () => {
    const result = useMetricState<null>(null, undefined);
    expect(result.state).toBe("empty");
  });

  it("an empty object with no meaningful key -> empty", () => {
    const result = useMetricState<Record<string, never>>({}, undefined);
    expect(result.state).toBe("empty");
  });

  it("0 is NOT empty -- a real zero is a real value", () => {
    const result = useMetricState(0, undefined);
    expect(result.state).not.toBe("empty");
    expect(result.state).toBe("ready");
  });

  it("a value older than staleAfter -> stale, not ready", () => {
    const staleUpdatedAt = NOW - 10 * 60 * 1000; // 10 minutes ago
    const result = useMetricState(42, staleUpdatedAt, { staleAfter: 5 * 60 * 1000 });
    expect(result.state).toBe("stale");
  });

  it("per-call staleAfter beats DEFAULT_STALE_AFTER_MS", () => {
    // 2 minutes old: stale under a tight 1-minute window, ready under the
    // shared 5-minute default -- proves the per-call value actually wins,
    // in both directions, on the same input.
    const updatedAt = Date.now() - 2 * 60 * 1000;
    const tight = useMetricState(42, updatedAt, { staleAfter: 60 * 1000 });
    expect(tight.state).toBe("stale");

    const usingDefault = useMetricState(42, updatedAt);
    expect(usingDefault.state).toBe("ready");
    expect(DEFAULT_STALE_AFTER_MS).toBeGreaterThan(2 * 60 * 1000);
  });

  it("updatedAt === undefined can never produce stale, however old the caller's staleAfter is", () => {
    const result = useMetricState(42, undefined, { staleAfter: 1 });
    expect(result.state).not.toBe("stale");
    expect(result.state).toBe("ready");
  });

  it("throws loudly on an implausible epoch (seconds passed as milliseconds), rather than silently reading it as extremely stale", () => {
    const epochSecondsLookingLikeMs = 1_700_000_000; // a real epoch-SECONDS value, far before 2001 in ms terms
    expect(() => useMetricState(42, epochSecondsLookingLikeMs)).toThrow();
  });

  it("never returns error, across a matrix of input combinations", () => {
    const values: unknown[] = [undefined, null, 0, 1, "", "x", [], [1], {}, { a: 1 }];
    const updatedAts: (number | undefined)[] = [undefined, Date.now(), Date.now() - 1_000_000_000];
    const unavailableFlags = [true, false];

    const seenStates = new Set<MetricState>();
    for (const value of values) {
      for (const updatedAt of updatedAts) {
        for (const unavailable of unavailableFlags) {
          const result = useMetricState(value as never, updatedAt, { unavailable });
          seenStates.add(result.state);
          expect(result.state).not.toBe("error");
        }
      }
    }
    // Sanity: the matrix actually exercised more than one state, so this
    // test is not vacuously true over a single degenerate case.
    expect(seenStates.size).toBeGreaterThan(1);
  });
});
