/**
 * Tests for LlmAnalyticsPanel's Model Breakdown money column.
 *
 * CR-01 follow-up (2026-08-03, found by the phase verifier). This table used to
 * render `formatCost(row.cost)` straight from `api.llm.costByModel`, which sums
 * the RAW ingested `llmMetrics.cost` field. D-01 says that value is stored but is
 * no longer the displayed truth, and on the live instance it under-reported by
 * ~13% versus the derived figure. Calls and tokens still come from llmMetrics
 * (raw measurements are fine); only the dollar column moved to costDerived.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    llm: { providerBreakdown: "llm:providerBreakdown", costByModel: "llm:costByModel" },
    costDerived: { costBreakdown: "costDerived:costBreakdown" },
  },
}));

vi.mock("./FlexBarChart", () => ({
  FlexBarChart: () => <div data-testid="flexbar" />,
}));

vi.mock("./InfoTooltip", () => ({ default: () => null }));

import LlmAnalyticsPanel from "./LlmAnalyticsPanel";

/** Calls/tokens come from llmMetrics; `cost` here is the LEGACY value we must ignore. */
const CALLS_AND_TOKENS = {
  "claude-sonnet-5": { calls: 10, tokens: 5000, cost: 99.99 },
  "mystery-model": { calls: 3, tokens: 700, cost: 42.42 },
};

function wire(breakdown: unknown) {
  mockUseQuery.mockImplementation((ref: string) => {
    if (ref === "llm:providerBreakdown") return [];
    if (ref === "llm:costByModel") return CALLS_AND_TOKENS;
    if (ref === "costDerived:costBreakdown") return breakdown;
    return undefined;
  });
}

beforeEach(() => mockUseQuery.mockReset());

describe("LlmAnalyticsPanel — Model Breakdown money column (D-01)", () => {
  it("renders the DERIVED cost, not the legacy llmMetrics.cost value", () => {
    wire({
      rows: [
        { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 4000, completionTokens: 1000, billedUsd: 1.2345, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
      ],
      billedTotal: 1.2345, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0,
    });

    render(<LlmAnalyticsPanel />);

    // The derived figure is shown...
    expect(screen.getByText("$1.2345")).toBeInTheDocument();
    // ...and the legacy 99.99 never reaches the DOM in any formatting.
    expect(screen.queryByText(/99\.99/)).toBeNull();
  });

  it("sums the derived cost across providers for the same model id", () => {
    wire({
      rows: [
        { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 1000, completionTokens: 0, billedUsd: 1.0, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
        { provider: "anthropic_advisor", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 1000, completionTokens: 0, billedUsd: 0.5, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
      ],
      billedTotal: 1.5, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0,
    });

    render(<LlmAnalyticsPanel />);
    expect(screen.getByText("$1.5000")).toBeInTheDocument();
  });

  it('shows "Unpriced" for a model with no derived price — never $0.00 (D-03)', () => {
    wire({
      rows: [
        { provider: "anthropic_direct", model: "claude-sonnet-5", billingType: "api",
          promptTokens: 4000, completionTokens: 1000, billedUsd: 1.2345, coveredUsd: null,
          priced: true, pricedVia: "model", unpricedReason: null },
      ],
      billedTotal: 1.2345, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0,
    });

    render(<LlmAnalyticsPanel />);

    // "mystery-model" has calls/tokens but no row in the derived breakdown.
    expect(screen.getByText("Unpriced")).toBeInTheDocument();
    expect(screen.queryByText("$0.0000")).toBeNull();
    expect(screen.queryByText(/42\.42/)).toBeNull();
  });

  it('renders "--" while the derivation is loading, not a fabricated $0.00', () => {
    wire(undefined);
    render(<LlmAnalyticsPanel />);
    expect(screen.queryByText("$0.0000")).toBeNull();
    expect(screen.getAllByText("--").length).toBeGreaterThan(0);
  });

  it("still shows calls and tokens from llmMetrics — those are raw measurements", () => {
    wire({ rows: [], billedTotal: 0, coveredTotal: 0, unpricedModelCount: 0, unpricedTokenTotal: 0 });
    render(<LlmAnalyticsPanel />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("5,000")).toBeInTheDocument();
  });

  it("does not import the legacy cost value into the money column at source level", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(resolve(process.cwd(), "src/components/LlmAnalyticsPanel.tsx"), "utf-8");
    // The regression was literally `formatCost(row.cost)`.
    expect(src).not.toMatch(/formatCost\(\s*row\.cost\s*\)/);
    expect(src).toContain("costDerived.costBreakdown");
  });
});
