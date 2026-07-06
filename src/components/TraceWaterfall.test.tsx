import { describe, it, expect } from "vitest";
import {
  groupByTrace,
  barMetrics,
  cacheBadge,
  costLabel,
  type LlmCallRow,
} from "./TraceWaterfall";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<LlmCallRow> = {}): LlmCallRow {
  return {
    provider: "anthropic",
    model: "claude-sonnet-5",
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
    latencyMs: 500,
    timestamp: 1_700_000_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// groupByTrace
// ---------------------------------------------------------------------------

describe("groupByTrace", () => {
  it("groups rows sharing the same traceId into one group", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "a", traceId: "trace-1", timestamp: 1_700_000_000 }),
      makeRow({ _id: "b", traceId: "trace-1", timestamp: 1_700_000_010 }),
    ];

    const groups = groupByTrace(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].traceId).toBe("trace-1");
    expect(groups[0].rows).toHaveLength(2);
  });

  it("puts rows with traceId===undefined into a single untraced bucket", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "a", traceId: undefined, timestamp: 1_700_000_000 }),
      makeRow({ _id: "b", traceId: undefined, timestamp: 1_700_000_050 }),
    ];

    const groups = groupByTrace(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].traceId).toBeUndefined();
    expect(groups[0].rows).toHaveLength(2);
  });

  it("orders traced groups by earliest row timestamp", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "a", traceId: "trace-late", timestamp: 1_700_000_500 }),
      makeRow({ _id: "b", traceId: "trace-early", timestamp: 1_700_000_000 }),
    ];

    const groups = groupByTrace(rows);

    expect(groups.map((g) => g.traceId)).toEqual(["trace-early", "trace-late"]);
  });

  it("always renders the untraced bucket last, even if it is chronologically earliest", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "a", traceId: undefined, timestamp: 1_699_999_000 }), // earliest overall
      makeRow({ _id: "b", traceId: "trace-1", timestamp: 1_700_000_000 }),
    ];

    const groups = groupByTrace(rows);

    expect(groups.map((g) => g.traceId)).toEqual(["trace-1", undefined]);
  });

  it("mixed fixture: drops no row and buckets untraced ones together (Pitfall 4)", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "1", traceId: "trace-a", timestamp: 1_700_000_000 }),
      makeRow({ _id: "2", traceId: undefined, timestamp: 1_700_000_010 }),
      makeRow({ _id: "3", traceId: "trace-b", timestamp: 1_700_000_020 }),
      makeRow({ _id: "4", traceId: undefined, timestamp: 1_700_000_030 }),
      makeRow({ _id: "5", traceId: "trace-a", timestamp: 1_700_000_040 }),
    ];

    const groups = groupByTrace(rows);

    const totalRows = groups.reduce((sum, g) => sum + g.rows.length, 0);
    expect(totalRows).toBe(5);

    const untracedGroups = groups.filter((g) => g.traceId === undefined);
    expect(untracedGroups).toHaveLength(1);
    expect(untracedGroups[0].rows.map((r) => r._id)).toEqual(["2", "4"]);

    // untraced bucket must be last
    expect(groups[groups.length - 1].traceId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// barMetrics — Pitfall 1: seconds/ms unit conversion
// ---------------------------------------------------------------------------

describe("barMetrics", () => {
  it("computes start = timestamp - latencyMs/1000 and width = latencyMs/1000 (Pitfall 1)", () => {
    const row = { timestamp: 1_700_000_000, latencyMs: 2500 };

    const { start, width } = barMetrics(row);

    expect(start).toBe(1_699_999_997.5);
    expect(width).toBe(2.5);
  });

  it("handles sub-second latency correctly", () => {
    const row = { timestamp: 1_700_000_000, latencyMs: 100 };

    const { start, width } = barMetrics(row);

    expect(width).toBeCloseTo(0.1, 5);
    expect(start).toBeCloseTo(1_699_999_999.9, 5);
  });
});

// ---------------------------------------------------------------------------
// cacheBadge — three-state, never conflate undefined with 0 (D-13)
// ---------------------------------------------------------------------------

describe("cacheBadge", () => {
  it('returns "HIT" when cacheReadInputTokens > 0', () => {
    expect(cacheBadge({ cacheReadInputTokens: 42 })).toBe("HIT");
  });

  it('returns "MISS" when cacheReadInputTokens === 0', () => {
    expect(cacheBadge({ cacheReadInputTokens: 0 })).toBe("MISS");
  });

  it('returns "NO_DATA" when cacheReadInputTokens === undefined (distinct from 0)', () => {
    expect(cacheBadge({ cacheReadInputTokens: undefined })).toBe("NO_DATA");
  });
});

// ---------------------------------------------------------------------------
// costLabel — cost dash, never an estimate (D-14)
// ---------------------------------------------------------------------------

describe("costLabel", () => {
  it("returns formatCost(row.cost) when cost is a number", () => {
    expect(costLabel({ cost: 0.042 })).toBe("$0.0420");
  });

  it('returns "n/a" when cost is undefined (never an estimated number)', () => {
    expect(costLabel({ cost: undefined })).toBe("n/a");
  });

  it('returns "n/a" when cost is 0 (real zero-cost call, not treated as missing)', () => {
    // 0 is a valid, real cost value (typeof 0 === "number") — must format, not dash.
    expect(costLabel({ cost: 0 })).toBe("$0.0000");
  });
});
