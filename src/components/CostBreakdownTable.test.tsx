import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Convex mocks ────────────────────────────────────────────────────────────
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    costDerived: {
      costBreakdown: "costDerived:costBreakdown",
    },
  },
}));

import CostBreakdownTable from "./CostBreakdownTable";

type Row = {
  provider: string;
  model: string;
  billingType: "api" | "subscription";
  promptTokens: number;
  completionTokens: number;
  billedUsd: number | null;
  coveredUsd: number | null;
  priced: boolean;
  pricedVia: "model" | "shadow" | null;
};

const PRICED_API_ROW: Row = {
  provider: "anthropic_direct",
  model: "claude-sonnet-5",
  billingType: "api",
  promptTokens: 1000,
  completionTokens: 500,
  billedUsd: 1.25,
  coveredUsd: null,
  priced: true,
  pricedVia: "model",
};

const SUBSCRIPTION_ROW: Row = {
  provider: "claude-cli",
  model: "claude-opus-5",
  billingType: "subscription",
  promptTokens: 2000,
  completionTokens: 800,
  billedUsd: 0,
  coveredUsd: 3.5,
  priced: true,
  pricedVia: "shadow",
};

const UNPRICED_ROW: Row = {
  provider: "codex",
  model: "gpt-mystery",
  billingType: "api",
  promptTokens: 300,
  completionTokens: 100,
  priced: false,
  billedUsd: null,
  coveredUsd: null,
  pricedVia: null,
};

const BREAKDOWN_FIXTURE = {
  rows: [PRICED_API_ROW, SUBSCRIPTION_ROW, UNPRICED_ROW],
  billedTotal: 1.25,
  coveredTotal: 3.5,
  unpricedModelCount: 1,
  unpricedTokenTotal: 400,
};

const EMPTY_BREAKDOWN = {
  rows: [],
  billedTotal: 0,
  coveredTotal: 0,
  unpricedModelCount: 0,
  unpricedTokenTotal: 0,
};

describe("CostBreakdownTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one row per breakdown entry with the provider display name applied", () => {
    mockUseQuery.mockReturnValue(BREAKDOWN_FIXTURE);
    render(<CostBreakdownTable />);

    expect(screen.getByText("Anthropic Direct")).toBeInTheDocument();
    expect(screen.getByText("Claude CLI")).toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
  });

  it("renders an unpriced row with the Unpriced badge, real token counts, and no $0.00 figure scoped to that row", () => {
    mockUseQuery.mockReturnValue(BREAKDOWN_FIXTURE);
    render(<CostBreakdownTable />);

    const unpricedRow = screen.getByText("gpt-mystery").closest("tr")!;
    expect(within(unpricedRow).getByText("Unpriced")).toBeInTheDocument();
    expect(within(unpricedRow).getByText("300")).toBeInTheDocument();
    expect(within(unpricedRow).getByText("100")).toBeInTheDocument();
    expect(within(unpricedRow).queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it("renders a subscription row with a zero billed figure and a non-zero covered figure", () => {
    mockUseQuery.mockReturnValue(BREAKDOWN_FIXTURE);
    render(<CostBreakdownTable />);

    const subRow = screen.getByText("claude-opus-5").closest("tr")!;
    expect(within(subRow).getByText("$0.0000")).toBeInTheDocument();
    expect(within(subRow).getByText("$3.5000")).toBeInTheDocument();
  });

  it("renders two distinct footer totals, never merged into one figure (D-05)", () => {
    mockUseQuery.mockReturnValue(BREAKDOWN_FIXTURE);
    render(<CostBreakdownTable />);

    const billedTotalRow = screen.getByText("Billed total").closest("tr")!;
    const coveredTotalRow = screen.getByText("Covered total").closest("tr")!;
    expect(within(billedTotalRow).getByText("$1.2500")).toBeInTheDocument();
    expect(within(coveredTotalRow).getByText("$3.5000")).toBeInTheDocument();
    // billedTotal + coveredTotal = 4.75 -> "$4.7500" must never appear anywhere.
    expect(screen.queryByText("$4.7500")).not.toBeInTheDocument();
  });

  it("switching the window selector to 7d re-queries with { period: 'daily', lookbackHours: 168 }", () => {
    mockUseQuery.mockReturnValue(BREAKDOWN_FIXTURE);
    render(<CostBreakdownTable />);

    fireEvent.click(screen.getByRole("button", { name: "7d" }));

    expect(mockUseQuery).toHaveBeenLastCalledWith(
      "costDerived:costBreakdown",
      expect.objectContaining({ period: "daily", lookbackHours: 168 })
    );
  });

  it('renders "No cost data yet." on an empty result', () => {
    mockUseQuery.mockReturnValue(EMPTY_BREAKDOWN);
    render(<CostBreakdownTable />);
    expect(screen.getByText("No cost data yet.")).toBeInTheDocument();
  });

  it("contains no hardcoded hex color", () => {
    const source = readFileSync(join(__dirname, "CostBreakdownTable.tsx"), "utf-8");
    expect(source.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)).toBeNull();
  });

  it("imports no Recharts", () => {
    const source = readFileSync(join(__dirname, "CostBreakdownTable.tsx"), "utf-8");
    expect(source).not.toMatch(/from "recharts"/);
  });
});
