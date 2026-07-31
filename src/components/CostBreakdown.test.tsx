import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DerivedRow } from "../../convex/costDerived";
import type { CostByGoalResult, LlmRow } from "../hooks/useCostByGoal";

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
let mockCostData: CostByGoalResult = {
  rows: [],
  billedTotal: 0,
  coveredTotal: 0,
  unpricedModelCount: 0,
  reportedTotal: 0,
};
let mockLlmRows: LlmRow[] = [];

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

function pricedRow(overrides: Partial<DerivedRow> & { provider: string; model: string }): DerivedRow {
  return {
    billingType: "api",
    promptTokens: 1000,
    completionTokens: 500,
    billedUsd: 0,
    coveredUsd: null,
    priced: true,
    pricedVia: "model",
    ...overrides,
  };
}

function unpricedRow(overrides: Partial<DerivedRow> & { provider: string; model: string }): DerivedRow {
  return {
    billingType: "api",
    promptTokens: 300,
    completionTokens: 100,
    billedUsd: null,
    coveredUsd: null,
    priced: false,
    pricedVia: null,
    ...overrides,
  };
}

function llmRow(overrides: Partial<LlmRow> & { model: string; provider: string }): LlmRow {
  return {
    promptTokens: 1000,
    completionTokens: 500,
    billingType: "api",
    billedUsd: 0,
    reportedCost: 0,
    ...overrides,
  };
}

describe("CostBreakdown", () => {
  beforeEach(() => {
    mockCostData = { rows: [], billedTotal: 0, coveredTotal: 0, unpricedModelCount: 0, reportedTotal: 0 };
    mockLlmRows = [];
    vi.clearAllMocks();
    mockUseCostByGoal.mockReturnValue(mockCostData);
    mockUseLlmByGoal.mockReturnValue([]);
  });

  it('renders "No cost data yet" empty state when rows are empty', () => {
    mockUseCostByGoal.mockReturnValue({ rows: [], billedTotal: 0, coveredTotal: 0, unpricedModelCount: 0, reportedTotal: 0 });
    mockUseLlmByGoal.mockReturnValue([]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("No cost data yet")).toBeInTheDocument();
  });

  it("renders total cost in tabular-nums format from billedTotal (D-01 recomputed figure, not the ingested cost)", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [pricedRow({ provider: "anthropic", model: "claude-sonnet-4-5", billedUsd: 0.1234 })],
      billedTotal: 0.1234,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.5, // deliberately different from billedTotal — proves it's not read anywhere
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", billedUsd: 0.1234 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("TOTAL COST")).toBeInTheDocument();
    const costEls = screen.getAllByText("$0.1234");
    expect(costEls.length).toBeGreaterThanOrEqual(1);
    // The stale/ingested reportedTotal figure never renders.
    expect(screen.queryByText("$0.5000")).not.toBeInTheDocument();
  });

  it('renders an "Unpriced" badge with real token counts for a priced:false row — never $0.00, and never inside the total', () => {
    // Mix a priced row with an unpriced row so the total is genuinely
    // non-zero — proves the unpriced row's tokens were excluded from
    // billedTotal (D-03), not merely that an all-unpriced total happens to
    // read $0.0000 correctly.
    mockUseCostByGoal.mockReturnValue({
      rows: [
        pricedRow({ provider: "anthropic", model: "claude-sonnet-4-5", billedUsd: 0.05 }),
        unpricedRow({ provider: "openrouter", model: "unrated-model", promptTokens: 300, completionTokens: 100 }),
      ],
      billedTotal: 0.05,
      coveredTotal: 0,
      unpricedModelCount: 1,
      reportedTotal: 0.05,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", billedUsd: 0.05 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("Unpriced")).toBeInTheDocument();
    expect(screen.getByText("400 tok")).toBeInTheDocument();
    // The header total reflects ONLY the priced row.
    expect(screen.getAllByText("$0.0500").length).toBeGreaterThanOrEqual(1);
    // No cell anywhere renders the unpriced row as a fabricated $0.00.
    expect(screen.queryByText("$0.0000")).not.toBeInTheDocument();
  });

  it('shows "TIER OK" when all workers are on Sonnet/Haiku (no opus workers)', () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [pricedRow({ provider: "anthropic", model: "claude-sonnet-4-5", billedUsd: 0.05 })],
      billedTotal: 0.05,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.05,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", billedUsd: 0.05 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("TIER OK")).toBeInTheDocument();
  });

  it('shows "OPUS WORKER" when a non-queen agentId is on an opus model', () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [pricedRow({ provider: "anthropic", model: "claude-opus-4-8", billedUsd: 0.20 })],
      billedTotal: 0.20,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.20,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "worker-1", model: "claude-opus-4-8", provider: "anthropic", billedUsd: 0.20 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("OPUS WORKER")).toBeInTheDocument();
  });

  it('shows "TIER OK" when only the queen is on opus (worker on sonnet)', () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [pricedRow({ provider: "anthropic", model: "claude-opus-4-8", billedUsd: 0.10 })],
      billedTotal: 0.10,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.10,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "queen", model: "claude-opus-4-8", provider: "anthropic", billedUsd: 0.10 }),
      llmRow({ agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", billedUsd: 0.05 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("TIER OK")).toBeInTheDocument();
    expect(screen.queryByText("OPUS WORKER")).not.toBeInTheDocument();
  });

  it("activates runaway warning when billedTotal > RUNAWAY_THRESHOLD (0.6 > 0.50)", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [pricedRow({ provider: "anthropic", model: "claude-opus-4-8", billedUsd: 0.6 })],
      billedTotal: 0.6,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.6,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "queen", model: "claude-opus-4-8", provider: "anthropic", billedUsd: 0.6 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.getByText("COST WARNING")).toBeInTheDocument();
  });

  it("does NOT activate runaway warning when billedTotal < RUNAWAY_THRESHOLD (0.4 < 0.50)", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [pricedRow({ provider: "anthropic", model: "claude-sonnet-4-5", billedUsd: 0.4 })],
      billedTotal: 0.4,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.4,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", billedUsd: 0.4 }),
    ]);

    render(<CostBreakdown goalId="goal-1" />);

    expect(screen.queryByText("COST WARNING")).not.toBeInTheDocument();
  });

  it("renders per-model table rows with provider and model columns", () => {
    mockUseCostByGoal.mockReturnValue({
      rows: [
        pricedRow({ provider: "anthropic", model: "claude-sonnet-4-5", billedUsd: 0.05 }),
        pricedRow({ provider: "anthropic", model: "claude-haiku-3", billedUsd: 0.01 }),
      ],
      billedTotal: 0.06,
      coveredTotal: 0,
      unpricedModelCount: 0,
      reportedTotal: 0.06,
    });
    mockUseLlmByGoal.mockReturnValue([
      llmRow({ agentId: "agent-1", model: "claude-sonnet-4-5", provider: "anthropic", billedUsd: 0.05 }),
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
    mockUseCostByGoal.mockReturnValue({ rows: [], billedTotal: 0, coveredTotal: 0, unpricedModelCount: 0, reportedTotal: 0 });
    mockUseLlmByGoal.mockReturnValue([]);

    render(<CostBreakdown goalId="goal-1" />);

    // When there's no data at all (goalId just set), tier flag should show CHECKING...
    // (In practice: loading means empty rows while not null goalId → CHECKING...)
    // With null goalId we'd also get CHECKING... — test the goalId=null path separately
    // For non-null goalId with empty rows from a real goalId, CHECKING... is correct
    expect(screen.getByText("CHECKING...")).toBeInTheDocument();
  });
});
