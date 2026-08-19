import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// ── Convex mocks (must precede the component import) ────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    toolAnalytics: {
      usageOverTime: "toolAnalytics:usageOverTime",
      usageByTool: "toolAnalytics:usageByTool",
      recentExecutionsBySource: "toolAnalytics:recentExecutionsBySource",
    },
  },
}));

import { useQuery } from "convex/react";
import ToolUsagePanel from "./ToolUsagePanel";

const mockUseQuery = vi.mocked(useQuery);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BY_TOOL_WITH_DATA = {
  rows: [
    {
      toolName: "web_search",
      source: "astridr",
      calls: 10,
      failures: 2,
      successRate: 0.8,
      avgDurationMs: 200,
    },
    {
      toolName: "Bash",
      source: "claude-code",
      calls: 5,
      failures: 0,
      successRate: 1,
      avgDurationMs: null,
    },
  ],
  totals: { calls: 15, failures: 2, successRate: 13 / 15 },
  sources: ["astridr", "claude-code"],
  truncated: false,
  windowHours: 168,
};

const OVER_TIME_WITH_ZERO_BUCKET = {
  buckets: [
    { bucketStart: 1_700_000_000, calls: 3, failures: 1 },
    { bucketStart: 1_700_003_600, calls: 0, failures: 0 },
    { bucketStart: 1_700_007_200, calls: 2, failures: 0 },
  ],
  truncated: false,
  windowHours: 168,
};

const EMPTY_BY_TOOL = {
  rows: [],
  totals: { calls: 0, failures: 0, successRate: null },
  sources: [] as string[],
  truncated: false,
  windowHours: 168,
};

const EMPTY_OVER_TIME = { buckets: [], truncated: false, windowHours: 168 };

/**
 * Dispatches useQuery by its first arg (the mocked query identifier), the
 * same shape TraceWaterfall.test.tsx's mock scaffold uses (105-05, finding
 * F5) — so one test can control the usageByTool feed and the usageOverTime
 * feed independently.
 */
function mockUseQueryDispatch(
  byToolResult: unknown = EMPTY_BY_TOOL,
  overTimeResult: unknown = EMPTY_OVER_TIME
) {
  mockUseQuery.mockImplementation(((query: unknown, ..._rest: unknown[]) => {
    if (query === "toolAnalytics:usageByTool") return byToolResult;
    if (query === "toolAnalytics:usageOverTime") return overTimeResult;
    return undefined;
  }) as typeof useQuery);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToolUsagePanel", () => {
  it("defaults the active source filter to Ástríðr on first render, asserted from the rendered DOM state", () => {
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);

    const astridrRadio = screen.getByRole("radio", { name: "Ástríðr" });
    expect(astridrRadio).toHaveAttribute("data-state", "on");
    expect(astridrRadio).toHaveAttribute("aria-checked", "true");

    const claudeCodeRadio = screen.getByRole("radio", { name: "Claude Code" });
    expect(claudeCodeRadio).toHaveAttribute("data-state", "off");
  });

  it("selecting Claude Code re-issues the queries with source: 'claude-code'", () => {
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);

    fireEvent.click(screen.getByRole("radio", { name: "Claude Code" }));

    const byToolCalls = mockUseQuery.mock.calls.filter(
      (c) => (c[0] as unknown as string) === "toolAnalytics:usageByTool"
    );
    const lastByToolArgs = byToolCalls[byToolCalls.length - 1][1] as { source: string };
    expect(lastByToolArgs.source).toBe("claude-code");

    const overTimeCalls = mockUseQuery.mock.calls.filter(
      (c) => (c[0] as unknown as string) === "toolAnalytics:usageOverTime"
    );
    const lastOverTimeArgs = overTimeCalls[overTimeCalls.length - 1][1] as { source: string };
    expect(lastOverTimeArgs.source).toBe("claude-code");
  });

  it("no rendered element has the accessible name exactly 'All' — the D-02 guard as a real DOM test", () => {
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);

    expect(screen.queryByRole("radio", { name: "All" })).toBeNull();
    expect(screen.getByRole("radio", { name: "All sources" })).toBeInTheDocument();
  });

  it("a tool row with avgDurationMs: null renders 'n/a' and the string '0ms' appears nowhere", () => {
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);

    const table = screen.getByRole("table");
    const bashRow = within(table).getByText("Bash").closest("tr")!;
    expect(within(bashRow).getByText("n/a")).toBeInTheDocument();
    expect(screen.queryByText("0ms")).not.toBeInTheDocument();
    expect(screen.queryByText(/^0ms$/)).not.toBeInTheDocument();
  });

  it("totals.successRate === null renders 'n/a' in the Success Rate card, not '0%'", () => {
    mockUseQueryDispatch(EMPTY_BY_TOOL, EMPTY_OVER_TIME);
    render(<ToolUsagePanel />);

    const label = screen.getByText("Success Rate");
    // MetricCard's outer wrapper stopped carrying `glow-card` when 122-13
    // rewrote it to the six-state contract (D-13 strips glow-card
    // entirely) -- `[data-testid="metric-card"]` is MetricCard's own
    // stable test hook for its wrapper now.
    const card = label.closest('[data-testid="metric-card"]') as HTMLElement;
    expect(within(card).getByText("n/a")).toBeInTheDocument();
    expect(within(card).queryByText("0%")).not.toBeInTheDocument();
  });

  it("with rows: [] the empty-state heading and body render and no chart bar element is present", () => {
    mockUseQueryDispatch(EMPTY_BY_TOOL, EMPTY_OVER_TIME);
    const { container } = render(<ToolUsagePanel />);

    expect(screen.getByText("No tool calls yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Ástríðr's tool calls will appear here once the agent loop runs — no refresh needed."
      )
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-stacked-bar]")).toHaveLength(0);
  });

  it("renders the truncation banner when truncated is true", () => {
    mockUseQueryDispatch(
      { ...BY_TOOL_WITH_DATA, truncated: true },
      OVER_TIME_WITH_ZERO_BUCKET
    );
    render(<ToolUsagePanel />);

    expect(
      screen.getByText(/Showing a capped slice of the aggregate history/)
    ).toBeInTheDocument();
  });

  it("does not render the truncation banner when both feeds report truncated: false", () => {
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);

    expect(
      screen.queryByText(/Showing a capped slice of the aggregate history/)
    ).not.toBeInTheDocument();
  });

  it("an usageOverTime series containing a zero bucket renders that bucket (a real zero, never dropped)", () => {
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);

    const overTimeChart = screen.getByTestId("tool-usage-over-time-chart");
    // 3 buckets in the fixture, including the zero-value middle bucket —
    // FlexBarChart renders one [data-stacked-bar] wrapper per data point
    // regardless of value, so a dropped/closed-over gap would show 2, not 3.
    expect(overTimeChart.querySelectorAll("[data-stacked-bar]")).toHaveLength(3);
  });

  it("mutation check: rendering avgDurationMs ?? 0 instead of the honest null guard would break the n/a assertion above", () => {
    // Documents the required mutation proof inline (see SUMMARY for the
    // actual mutate/observe-failure/restore cycle performed against the
    // component source). This test re-asserts the correct (non-mutated)
    // behavior stands as the permanent regression guard.
    mockUseQueryDispatch(BY_TOOL_WITH_DATA, OVER_TIME_WITH_ZERO_BUCKET);
    render(<ToolUsagePanel />);
    const table = screen.getByRole("table");
    const bashRow = within(table).getByText("Bash").closest("tr")!;
    expect(within(bashRow).queryByText("0ms")).not.toBeInTheDocument();
  });
});
