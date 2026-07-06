import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Convex mocks (must precede the component import) ────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    llm: {
      sessionCalls: "llm:sessionCalls",
    },
  },
}));

import { useQuery } from "convex/react";
import {
  groupByTrace,
  barMetrics,
  cacheBadge,
  costLabel,
  computeSummary,
  TraceWaterfall,
  type LlmCallRow,
} from "./TraceWaterfall";

const mockUseQuery = vi.mocked(useQuery);

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

// ---------------------------------------------------------------------------
// computeSummary
// ---------------------------------------------------------------------------

describe("computeSummary", () => {
  it("includes cache-creation tokens in the cache-ratio denominator (matches shapeCacheAcc)", () => {
    const rows: LlmCallRow[] = [
      makeRow({
        promptTokens: 100,
        cacheReadInputTokens: 300,
        cacheCreationInputTokens: 600,
      }),
    ];

    // hitRate = read / (uncached input + cache writes + cache reads)
    //         = 300 / (100 + 600 + 300) = 0.3
    expect(computeSummary(rows).cacheRatio).toBeCloseTo(0.3);
  });

  it("treats missing cache fields as zero and returns 0 ratio when no tokens at all", () => {
    expect(computeSummary([makeRow({ promptTokens: 0 })]).cacheRatio).toBe(0);
  });

  it("sums cost only over rows with a numeric cost and counts the rest", () => {
    const rows: LlmCallRow[] = [
      makeRow({ cost: 0.01 }),
      makeRow({ cost: undefined }),
      makeRow({ cost: 0.02 }),
    ];

    const summary = computeSummary(rows);
    expect(summary.totalCost).toBeCloseTo(0.03);
    expect(summary.callsWithoutCost).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TraceWaterfall (component) — mount tests with mocked useQuery
// ---------------------------------------------------------------------------

describe("TraceWaterfall (component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No LLM calls yet" empty state when the session has zero rows', () => {
    mockUseQuery.mockReturnValue([]);

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText("No LLM calls yet")).toBeInTheDocument();
  });

  it("renders nothing (loading) while useQuery returns undefined", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { container } = render(<TraceWaterfall sessionId="session-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one collapsible group per traceId + Untraced calls last, dropping no row (mixed fixture)", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "1", traceId: "trace-a", timestamp: 1_700_000_000 }),
      makeRow({ _id: "2", traceId: undefined, timestamp: 1_700_000_010 }),
      makeRow({ _id: "3", traceId: "trace-b", timestamp: 1_700_000_020 }),
      makeRow({ _id: "4", traceId: undefined, timestamp: 1_700_000_030 }),
      makeRow({ _id: "5", traceId: "trace-a", timestamp: 1_700_000_040 }),
    ];
    mockUseQuery.mockReturnValue(rows);

    render(<TraceWaterfall sessionId="session-1" />);

    // Two traced turn headers (Turn 1 = trace-a, Turn 2 = trace-b)
    expect(screen.getByText(/Turn 1 · 2 ·/)).toBeInTheDocument();
    expect(screen.getByText(/Turn 2 · 1 ·/)).toBeInTheDocument();
    // Untraced group renders last, with its own row count
    expect(screen.getByText("Untraced calls · 2")).toBeInTheDocument();

    // No row dropped: 5 model labels total across all groups
    expect(screen.getAllByText((_, el) => el?.tagName === "SPAN" && !!el.className?.includes?.("truncate"))).toHaveLength(5);
  });

  it("renders the summary strip with total cost, call count, and total tokens", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "1", cost: 0.01, totalTokens: 100 }),
      makeRow({ _id: "2", cost: undefined, totalTokens: 200 }),
    ];
    mockUseQuery.mockReturnValue(rows);

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText("Total Cost")).toBeInTheDocument();
    expect(screen.getByText("1 call without cost")).toBeInTheDocument();
    expect(screen.getByText("Call Count")).toBeInTheDocument();
    expect(screen.getByText("Total Tokens")).toBeInTheDocument();
    expect(screen.getByText("Cache Read Ratio")).toBeInTheDocument();
  });
});
