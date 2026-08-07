import { describe, test, expect } from "vitest";
import { assertAggregatePeriod, AGGREGATE_PERIODS } from "./aggregatePeriod";

describe("assertAggregatePeriod (COST-01)", () => {
  test("CONTROL: accepts every value the aggregates table actually stores", () => {
    for (const period of AGGREGATE_PERIODS) {
      expect(assertAggregatePeriod(period, "test")).toBe(period);
    }
  });

  test('rejects "day" — the typo that silently reported $0 across every lookback', () => {
    expect(() => assertAggregatePeriod("day", "costBreakdown")).toThrow(/invalid period "day"/);
  });

  test("rejects an unrelated string rather than returning an empty result", () => {
    expect(() => assertAggregatePeriod("weekly", "costOverTime")).toThrow(/invalid period/);
  });

  test("names the caller so the failing surface is identifiable from the error alone", () => {
    expect(() => assertAggregatePeriod("day", "billedOverTime")).toThrow(/\[billedOverTime\]/);
  });

  test("lists the valid values in the message", () => {
    expect(() => assertAggregatePeriod("day", "test")).toThrow(/"hourly" \| "daily"/);
  });
});
