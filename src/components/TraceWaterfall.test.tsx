import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";

// ── Convex mocks (must precede the component import) ────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    llm: {
      sessionCalls: "llm:sessionCalls",
    },
    toolExecutions: {
      listBySession: "toolExecutions:listBySession",
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
  groupCacheRatio,
  groupRoundsForTrace,
  toolBarMetrics,
  TraceWaterfall,
  type LlmCallRow,
  type ToolExecRow,
  type TraceGroup,
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

function makeToolRow(overrides: Partial<ToolExecRow> = {}): ToolExecRow {
  return {
    toolName: "web_search",
    success: true,
    timestamp: 1_700_000_000,
    ...overrides,
  };
}

function makeGroup(traceId: string, rows: LlmCallRow[]): TraceGroup {
  return {
    traceId,
    rows,
    earliestTimestamp: Math.min(...rows.map((r) => r.timestamp)),
  };
}

/**
 * Dispatches useQuery by its first arg (the mocked query identifier), so a
 * single test can control the LLM-calls feed and the tool-executions feed
 * independently (finding F5 — the pre-105-05 mock was single-return, which
 * cannot express "the LLM lane loaded but the tool feed is still loading" or
 * two different truncation states per feeder).
 */
function mockUseQueryDispatch(
  callsResult: unknown,
  toolsResult: unknown = { rows: [], truncated: false, cap: 1000 }
) {
  mockUseQuery.mockImplementation(((
    query: unknown,
    ..._rest: unknown[]
  ) => {
    if (query === "llm:sessionCalls") return callsResult;
    if (query === "toolExecutions:listBySession") return toolsResult;
    return undefined;
  }) as typeof useQuery);
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
// Phase 105 OBS-03 pure helpers — groupCacheRatio, groupRoundsForTrace, toolBarMetrics
// ---------------------------------------------------------------------------

describe("Phase 105 OBS-03 pure helpers", () => {
  describe("groupCacheRatio", () => {
    it("returns 0 for an empty array, never NaN", () => {
      expect(groupCacheRatio([])).toBe(0);
    });

    it("returns 0 (not NaN) when all cache fields are undefined and promptTokens sum to 0", () => {
      const rows: LlmCallRow[] = [
        makeRow({
          promptTokens: 0,
          cacheReadInputTokens: undefined,
          cacheCreationInputTokens: undefined,
        }),
      ];
      expect(groupCacheRatio(rows)).toBe(0);
    });

    it("returns 0, not NaN, when cache fields are undefined but promptTokens is nonzero (denominator falls back to prompt tokens only)", () => {
      const rows: LlmCallRow[] = [
        makeRow({
          promptTokens: 500,
          cacheReadInputTokens: undefined,
          cacheCreationInputTokens: undefined,
        }),
      ];
      expect(groupCacheRatio(rows)).toBe(0);
    });

    it("DENOMINATOR PARITY: matches computeSummary.cacheRatio for a cache-creation + reads fixture", () => {
      const rows: LlmCallRow[] = [
        makeRow({
          promptTokens: 100,
          cacheReadInputTokens: 300,
          cacheCreationInputTokens: 600,
        }),
      ];
      expect(groupCacheRatio(rows)).toBeCloseTo(
        computeSummary(rows).cacheRatio,
        12
      );
    });

    it("DENOMINATOR PARITY: matches computeSummary.cacheRatio for cache creation with zero reads", () => {
      const rows: LlmCallRow[] = [
        makeRow({
          promptTokens: 200,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 400,
        }),
      ];
      expect(groupCacheRatio(rows)).toBeCloseTo(
        computeSummary(rows).cacheRatio,
        12
      );
    });

    it("DENOMINATOR PARITY: matches computeSummary.cacheRatio across multiple rows with mixed undefined cache fields", () => {
      const rows: LlmCallRow[] = [
        makeRow({
          _id: "a",
          promptTokens: 50,
          cacheReadInputTokens: 10,
          cacheCreationInputTokens: 5,
        }),
        makeRow({
          _id: "b",
          promptTokens: 80,
          cacheReadInputTokens: undefined,
          cacheCreationInputTokens: undefined,
        }),
      ];
      expect(groupCacheRatio(rows)).toBeCloseTo(
        computeSummary(rows).cacheRatio,
        12
      );
    });
  });

  describe("groupRoundsForTrace", () => {
    it("partitions LLM rows and tool rows into ascending-ordered rounds, each internally timestamp-ordered", () => {
      const group = makeGroup("trace-1", [
        makeRow({ _id: "l2", traceId: "trace-1", round: 2, timestamp: 1_700_000_100 }),
        makeRow({ _id: "l1", traceId: "trace-1", round: 1, timestamp: 1_700_000_000 }),
      ]);
      const toolRows: ToolExecRow[] = [
        makeToolRow({ _id: "t2", traceId: "trace-1", round: 2, timestamp: 1_700_000_150 }),
        makeToolRow({ _id: "t1", traceId: "trace-1", round: 1, timestamp: 1_700_000_050 }),
      ];

      const { rounds, unroundedLlmRows, unattributedToolRows } =
        groupRoundsForTrace(group, toolRows);

      expect(rounds.map((r) => r.round)).toEqual([1, 2]);
      expect(rounds[0].llmRows.map((r) => r._id)).toEqual(["l1"]);
      expect(rounds[0].toolRows.map((r) => r._id)).toEqual(["t1"]);
      expect(rounds[1].llmRows.map((r) => r._id)).toEqual(["l2"]);
      expect(unroundedLlmRows).toHaveLength(0);
      expect(unattributedToolRows).toHaveLength(0);
    });

    it("puts a tool row whose round is undefined into unattributedToolRows, never the last round (D-10)", () => {
      const group = makeGroup("trace-2", [
        makeRow({ _id: "l1", traceId: "trace-2", round: 1, timestamp: 1_700_000_000 }),
      ]);
      const toolRows: ToolExecRow[] = [
        makeToolRow({ _id: "t1", traceId: "trace-2", round: undefined, timestamp: 1_700_000_050 }),
      ];

      const { rounds, unattributedToolRows } = groupRoundsForTrace(group, toolRows);

      expect(rounds).toHaveLength(1);
      expect(rounds[0].toolRows).toHaveLength(0);
      expect(unattributedToolRows.map((r) => r._id)).toEqual(["t1"]);
    });

    it("ignores a tool row whose traceId doesn't match this group at all (some other group's concern, or the component-level bucket's)", () => {
      const group = makeGroup("trace-3", [
        makeRow({ _id: "l1", traceId: "trace-3", round: 1, timestamp: 1_700_000_000 }),
      ]);
      const toolRows: ToolExecRow[] = [
        makeToolRow({ _id: "t-other", traceId: "trace-other", round: 1, timestamp: 1_700_000_050 }),
      ];

      const { rounds, unattributedToolRows } = groupRoundsForTrace(group, toolRows);

      expect(rounds[0].toolRows).toHaveLength(0);
      expect(unattributedToolRows).toHaveLength(0);
    });

    it("puts an LLM row with round undefined into unroundedLlmRows, creating no synthetic round", () => {
      const group = makeGroup("trace-4", [
        makeRow({ _id: "l1", traceId: "trace-4", round: undefined, timestamp: 1_700_000_000 }),
      ]);

      const { rounds, unroundedLlmRows } = groupRoundsForTrace(group, []);

      expect(rounds).toHaveLength(0);
      expect(unroundedLlmRows.map((r) => r._id)).toEqual(["l1"]);
    });

    it("treats round 0 as a real round, not absent (no ?? or truthiness coalesce)", () => {
      const group = makeGroup("trace-5", [
        makeRow({ _id: "l1", traceId: "trace-5", round: 0, timestamp: 1_700_000_000 }),
      ]);
      const toolRows: ToolExecRow[] = [
        makeToolRow({ _id: "t1", traceId: "trace-5", round: 0, timestamp: 1_700_000_050 }),
      ];

      const { rounds, unroundedLlmRows, unattributedToolRows } =
        groupRoundsForTrace(group, toolRows);

      expect(rounds.map((r) => r.round)).toEqual([0]);
      expect(unroundedLlmRows).toHaveLength(0);
      expect(unattributedToolRows).toHaveLength(0);
    });
  });

  describe("toolBarMetrics", () => {
    it("computes start/width in the seconds domain, mirroring barMetrics", () => {
      const { start, width, hasDuration } = toolBarMetrics({
        timestamp: 1_700_000_000,
        durationMs: 2500,
      });
      expect(width).toBe(2.5);
      expect(start).toBe(1_699_999_997.5);
      expect(hasDuration).toBe(true);
    });

    it("returns a zero-width bar and hasDuration:false when durationMs is undefined", () => {
      const { width, hasDuration } = toolBarMetrics({
        timestamp: 1_700_000_000,
        durationMs: undefined,
      });
      expect(width).toBe(0);
      expect(hasDuration).toBe(false);
    });
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
    mockUseQueryDispatch({ rows: [], truncated: false, cap: 1000 });

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText("No LLM calls yet")).toBeInTheDocument();
  });

  it("renders nothing (loading) while useQuery returns undefined", () => {
    mockUseQueryDispatch(undefined);

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
    mockUseQueryDispatch({ rows, truncated: false, cap: 1000 });

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
    mockUseQueryDispatch({ rows, truncated: false, cap: 1000 });

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText("Total Cost")).toBeInTheDocument();
    expect(screen.getByText("1 call without cost")).toBeInTheDocument();
    expect(screen.getByText("Call Count")).toBeInTheDocument();
    expect(screen.getByText("Total Tokens")).toBeInTheDocument();
    expect(screen.getByText("Cache Read Ratio")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Truncation banner (Phase 105 D-12) — present only when truncated is true
  // -------------------------------------------------------------------------

  it("does NOT render the truncation banner when truncated is false", () => {
    const rows: LlmCallRow[] = [makeRow({ _id: "1" })];
    mockUseQueryDispatch({ rows, truncated: false, cap: 1000 });

    render(<TraceWaterfall sessionId="session-1" />);

    expect(
      screen.queryByText(/older calls in this session aren't loaded/)
    ).not.toBeInTheDocument();
  });

  it("renders the exact Task-2 truncation banner copy when truncated is true", () => {
    const rows: LlmCallRow[] = [makeRow({ _id: "1" })];
    mockUseQueryDispatch({ rows, truncated: true, cap: 1000 });

    render(<TraceWaterfall sessionId="session-1" />);

    expect(
      screen.getByText(
        "Showing the most recent 1000 calls — older calls in this session aren't loaded."
      )
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase 105 OBS-03 rendering — nesting, attribution honesty, dual truncation
// ---------------------------------------------------------------------------

describe("Phase 105 OBS-03 rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("nests tool executions under their reported round; each tool name appears exactly once", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "l1", traceId: "trace-x", round: 1, timestamp: 1_700_000_000 }),
      makeRow({ _id: "l2", traceId: "trace-x", round: 2, timestamp: 1_700_000_100 }),
    ];
    const tools: ToolExecRow[] = [
      makeToolRow({ _id: "t1", traceId: "trace-x", round: 1, toolName: "web_search", timestamp: 1_700_000_050 }),
      makeToolRow({ _id: "t2", traceId: "trace-x", round: 2, toolName: "memory_search", timestamp: 1_700_000_150 }),
    ];
    mockUseQueryDispatch(
      { rows, truncated: false, cap: 1000 },
      { rows: tools, truncated: false, cap: 1000 }
    );

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    expect(screen.getByText(/Round 2/)).toBeInTheDocument();
    expect(screen.getAllByText(/web_search/)).toHaveLength(1);
    expect(screen.getAllByText(/memory_search/)).toHaveLength(1);
  });

  it("ATTRIBUTION-HONESTY CONTROL: a tool row with a round-less report never renders inside a Round section, and is labelled instead of guessed (D-10)", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "l1", traceId: "trace-y", round: 1, timestamp: 1_700_000_000 }),
    ];
    const tools: ToolExecRow[] = [
      makeToolRow({
        _id: "t1",
        traceId: "trace-y",
        round: undefined,
        toolName: "leaky_tool",
        timestamp: 1_700_000_010,
      }),
    ];
    mockUseQueryDispatch(
      { rows, truncated: false, cap: 1000 },
      { rows: tools, truncated: false, cap: 1000 }
    );

    render(<TraceWaterfall sessionId="session-1" />);

    // Labelled, not dropped.
    expect(screen.getByText(/no reported round/)).toBeInTheDocument();
    expect(screen.getByText(/leaky_tool/)).toBeInTheDocument();

    // Scoped negative assertion: the round-1 section's own DOM subtree must
    // NOT contain the leaked tool row. A whole-document match would pass
    // even if the row were wrongly nested — this is the actual proof.
    const roundTrigger = screen.getByText(/Round 1/);
    const roundSection = roundTrigger.closest('[data-slot="collapsible"]');
    expect(roundSection).not.toBeNull();
    expect(
      within(roundSection as HTMLElement).queryByText(/leaky_tool/)
    ).toBeNull();
  });

  it("renders a tool row whose traceId matches no rendered group under 'Untraced tool calls', never dropped", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "l1", traceId: "trace-known", round: 1, timestamp: 1_700_000_000 }),
    ];
    const tools: ToolExecRow[] = [
      makeToolRow({
        _id: "t1",
        traceId: "trace-unknown",
        round: 1,
        toolName: "orphan_tool",
        timestamp: 1_700_000_010,
      }),
    ];
    mockUseQueryDispatch(
      { rows, truncated: false, cap: 1000 },
      { rows: tools, truncated: false, cap: 1000 }
    );

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText(/Untraced tool calls · 1/)).toBeInTheDocument();
    expect(screen.getByText(/orphan_tool/)).toBeInTheDocument();
  });

  it("renders LLM rows with no round flat, with no Round header anywhere in that group", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "l1", traceId: "trace-z", round: undefined, timestamp: 1_700_000_000 }),
      makeRow({ _id: "l2", traceId: "trace-z", round: undefined, timestamp: 1_700_000_010 }),
    ];
    mockUseQueryDispatch({ rows, truncated: false, cap: 1000 });

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.queryByText(/Round \d/)).not.toBeInTheDocument();
  });

  it("renders 'duration n/a' (not '0ms') for a tool row with durationMs undefined", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "l1", traceId: "trace-d", round: 1, timestamp: 1_700_000_000 }),
    ];
    const tools: ToolExecRow[] = [
      makeToolRow({
        _id: "t1",
        traceId: "trace-d",
        round: 1,
        toolName: "no_duration_tool",
        durationMs: undefined,
        timestamp: 1_700_000_010,
      }),
    ];
    mockUseQueryDispatch(
      { rows, truncated: false, cap: 1000 },
      { rows: tools, truncated: false, cap: 1000 }
    );

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText(/duration n\/a/)).toBeInTheDocument();
    expect(screen.queryByText(/\b0ms\b/)).not.toBeInTheDocument();
  });

  it("treats round: 0 as a real round, not unattributed", () => {
    const rows: LlmCallRow[] = [
      makeRow({ _id: "l1", traceId: "trace-zero", round: 0, timestamp: 1_700_000_000 }),
    ];
    const tools: ToolExecRow[] = [
      makeToolRow({
        _id: "t1",
        traceId: "trace-zero",
        round: 0,
        toolName: "zero_round_tool",
        timestamp: 1_700_000_005,
      }),
    ];
    mockUseQueryDispatch(
      { rows, truncated: false, cap: 1000 },
      { rows: tools, truncated: false, cap: 1000 }
    );

    render(<TraceWaterfall sessionId="session-1" />);

    expect(screen.getByText(/Round 0/)).toBeInTheDocument();
    expect(screen.queryByText(/no reported round/)).not.toBeInTheDocument();
  });

  it("appends the cache-ratio suffix to the turn header using groupCacheRatio's value", () => {
    const rows: LlmCallRow[] = [
      makeRow({
        _id: "l1",
        traceId: "trace-c",
        promptTokens: 100,
        cacheReadInputTokens: 300,
        cacheCreationInputTokens: 600,
      }),
    ];
    mockUseQueryDispatch({ rows, truncated: false, cap: 1000 });

    render(<TraceWaterfall sessionId="session-1" />);

    // groupCacheRatio = 300 / (300 + 600 + 100) = 0.3 -> 30%
    expect(screen.getByText(/30% cached/)).toBeInTheDocument();
  });

  describe("combined truncation banner (both feeders, D-12/F3)", () => {
    it("renders only the calls sentence when only the calls feed is truncated", () => {
      mockUseQueryDispatch(
        { rows: [makeRow({ _id: "1" })], truncated: true, cap: 1000 },
        { rows: [], truncated: false, cap: 500 }
      );

      render(<TraceWaterfall sessionId="session-1" />);

      expect(screen.getByText(/most recent 1000 calls/)).toBeInTheDocument();
      expect(screen.queryByText(/tool executions/)).not.toBeInTheDocument();
    });

    it("renders only the tool-executions sentence when only the tool feed is truncated", () => {
      mockUseQueryDispatch(
        { rows: [makeRow({ _id: "1" })], truncated: false, cap: 1000 },
        { rows: [], truncated: true, cap: 500 }
      );

      render(<TraceWaterfall sessionId="session-1" />);

      expect(
        screen.getByText(/most recent 500 tool executions/)
      ).toBeInTheDocument();
      expect(screen.queryByText(/most recent 1000 calls/)).not.toBeInTheDocument();
    });

    it("renders both sentences inside ONE banner element when both feeders are truncated", () => {
      mockUseQueryDispatch(
        { rows: [makeRow({ _id: "1" })], truncated: true, cap: 1000 },
        { rows: [], truncated: true, cap: 500 }
      );

      render(<TraceWaterfall sessionId="session-1" />);

      const callsSentence = screen.getByText(/most recent 1000 calls/);
      const toolsSentence = screen.getByText(/most recent 500 tool executions/);
      const banner = callsSentence.closest("div");
      expect(banner).not.toBeNull();
      expect(banner as HTMLElement).toContainElement(toolsSentence);
    });
  });
});
