import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Convex mocks ────────────────────────────────────────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    aggregates: {
      costByGoalPeriod: "aggregates:costByGoalPeriod",
      llmByGoal: "aggregates:llmByGoal",
    },
  },
}));

// ── useCostByGoal mock ───────────────────────────────────────────────────────
let mockCostData: { rows: Array<{ provider: string; model: string; cost: number }>; totalCost: number } = {
  rows: [],
  totalCost: 0,
};
let mockLlmRows: Array<{ agentId?: string; model: string; provider: string; cost: number }> = [];

vi.mock("../hooks/useCostByGoal", () => ({
  useCostByGoal: vi.fn(() => mockCostData),
  useLlmByGoal: vi.fn(() => mockLlmRows),
}));

// ── FlexBarChart mock ────────────────────────────────────────────────────────
vi.mock("./FlexBarChart", () => ({
  FlexBarChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="flex-bar-chart" data-count={data.length} />
  ),
}));

import { useCostByGoal, useLlmByGoal } from "../hooks/useCostByGoal";
import CostBreakdown from "./CostBreakdown";

const mockUseCostByGoal = vi.mocked(useCostByGoal);
const mockUseLlmByGoal = vi.mocked(useLlmByGoal);

describe("CostBreakdown", () => {
  beforeEach(() => {
    mockCostData = { rows: [], totalCost: 0 };
    mockLlmRows = [];
    vi.clearAllMocks();
    mockUseCostByGoal.mockReturnValue({ rows: [], totalCost: 0 });
    mockUseLlmByGoal.mockReturnValue([]);
  });

  it('renders "No cost data yet" empty state when rows are empty', () => {
    mockUseCostByGoal.mockReturnValue({ rows: [], totalCost: 0 });
    mockUseLlmByGoal.mockReturnValue([]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("No cost data yet")).toBeInTheDocument();
  });

  it("renders total cost in tabular-nums format", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [{ provider: "anthropic", model: "claude-sonnet-4-5", cost: 0.1234 }],
      totalCost: 0.1234,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", cost: 0.1234 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    // Total cost appears as text-xl semibold; the TOTAL COST label is the sibling
    expect(screen.getByText("TOTAL COST")).toBeInTheDocument();
    // At least one "$0.1234" must be in the document (total + table cell)
    const costEls = screen.getAllByText("$0.1234");
    expect(costEls.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "TIER OK" when all workers are on Sonnet/Haiku (no opus workers)', () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [{ provider: "anthropic", model: "claude-sonnet-4-5", cost: 0.05 }],
      totalCost: 0.05,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", cost: 0.05 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("TIER OK")).toBeInTheDocument();
  });

  it('shows "OPUS WORKER" when a non-queen agentId is on an opus model', () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [{ provider: "anthropic", model: "claude-opus-4-8", cost: 0.20 }],
      totalCost: 0.20,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "worker-1", model: "claude-opus-4-8", provider: "anthropic", cost: 0.20 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("OPUS WORKER")).toBeInTheDocument();
  });

  it('shows "TIER OK" when only the queen is on opus (worker on sonnet)', () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [{ provider: "anthropic", model: "claude-opus-4-8", cost: 0.10 }],
      totalCost: 0.10,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "queen", model: "claude-opus-4-8", provider: "anthropic", cost: 0.10 },
      { agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", cost: 0.05 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("TIER OK")).toBeInTheDocument();
    expect(screen.queryByText("OPUS WORKER")).not.toBeInTheDocument();
  });

  it("activates runaway warning when totalCost > RUNAWAY_THRESHOLD (0.6 > 0.50)", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [{ provider: "anthropic", model: "claude-opus-4-8", cost: 0.6 }],
      totalCost: 0.6,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "queen", model: "claude-opus-4-8", provider: "anthropic", cost: 0.6 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("COST WARNING")).toBeInTheDocument();
  });

  it("does NOT activate runaway warning when totalCost < RUNAWAY_THRESHOLD (0.4 < 0.50)", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [{ provider: "anthropic", model: "claude-sonnet-4-5", cost: 0.4 }],
      totalCost: 0.4,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", cost: 0.4 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.queryByText("COST WARNING")).not.toBeInTheDocument();
  });

  it("renders per-model table rows with provider and model columns", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [
        { provider: "anthropic", model: "claude-sonnet-4-5", cost: 0.05 },
        { provider: "anthropic", model: "claude-haiku-3", cost: 0.01 },
      ],
      totalCost: 0.06,
    });
    mockUseLlmByGoal.mockReturnValue([
      { agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", cost: 0.05 },
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("claude-sonnet-4-5")).toBeInTheDocument();
    expect(screen.getByText("claude-haiku-3")).toBeInTheDocument();
  });

  it("renders COST header", () => {
    render(<CostBreakdown goalId="goal-1" />);
    expect(screen.getByText("COST")).toBeInTheDocument();
  });

  it('shows "CHECKING..." tier flag while llmByGoal rows are loading (empty)', () => {
    mockUseCostByGoal.mockReturnValue({ rows: [], totalCost: 0 });
    mockUseLlmByGoal.mockReturnValue([]);

    render(<CostBreakdown goalId="goal-1" />);

    // When there's no data at all (goalId just set), tier flag should show CHECKING...
    // (In practice: loading means empty rows while not null goalId → CHECKING...)
    // With null goalId we'd also get CHECKING... — test the goalId=null path separately
    // For non-null goalId with empty rows from a real goalId, CHECKING... is correct
    expect(screen.getByText("CHECKING...")).toBeInTheDocument();
  });
});
