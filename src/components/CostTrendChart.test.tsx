import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
      costOverTime: "costDerived:costOverTime",
    },
  },
}));

// ── FlexBarChart mock — capture the segments/data it was called with ───────
vi.mock("./FlexBarChart", () => ({
  FlexBarChart: ({ data }: { data: Array<{ label: string; segments: Array<{ value: number; color: string; label: string }> }> }) => (
    <div data-testid="flex-bar-chart" data-json={JSON.stringify(data)} />
  ),
}));

import CostTrendChart from "./CostTrendChart";

type Bucket = {
  bucket_start: number;
  billedByProvider: Record<string, number>;
  coveredByProvider: Record<string, number>;
  unpricedTokensByProvider: Record<string, number>;
};

function readChartData() {
  const el = screen.getByTestId("flex-bar-chart");
  return JSON.parse(el.getAttribute("data-json") ?? "[]") as Array<{
    label: string;
    segments: Array<{ value: number; color: string; label: string }>;
  }>;
}

describe("CostTrendChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "No cost data yet." on an empty result', () => {
    mockUseQuery.mockReturnValue([]);
    render(<CostTrendChart />);
    expect(screen.getByText("No cost data yet.")).toBeInTheDocument();
  });

  it("defaults to Billed active with zero covered segments, one segment per billed provider", () => {
    const buckets: Bucket[] = [
      {
        bucket_start: 1700000000,
        billedByProvider: { anthropic_direct: 1.25, openrouter: 0.5 },
        coveredByProvider: { "claude-cli": 0.75 },
        unpricedTokensByProvider: {},
      },
    ];
    mockUseQuery.mockReturnValue(buckets);
    render(<CostTrendChart />);

    const billedButton = screen.getByRole("button", { name: "Billed" });
    expect(billedButton).toHaveAttribute("aria-pressed", "true");
    const coveredButton = screen.getByRole("button", { name: "Billed + Covered" });
    expect(coveredButton).toHaveAttribute("aria-pressed", "false");

    const data = readChartData();
    expect(data).toHaveLength(1);
    expect(data[0].segments).toHaveLength(2);
    expect(data[0].segments.every((s) => !s.label.includes("covered"))).toBe(true);
  });

  it("toggling to Billed + Covered adds one segment per provider with covered spend, without changing billed values (never-merged guard, D-05)", () => {
    const buckets: Bucket[] = [
      {
        bucket_start: 1700000000,
        // "claude-cli" deliberately appears in BOTH maps, to prove the two
        // never collapse into one summed segment.
        billedByProvider: { anthropic_direct: 1.25, "claude-cli": 0.1 },
        coveredByProvider: { "claude-cli": 0.75 },
        unpricedTokensByProvider: {},
      },
    ];
    mockUseQuery.mockReturnValue(buckets);
    render(<CostTrendChart />);

    const before = readChartData();
    const billedBefore = before[0].segments.filter((s) => !s.label.includes("covered"));
    expect(billedBefore).toHaveLength(2);
    const anthropicBefore = billedBefore.find((s) => s.label.toLowerCase().includes("anthropic"))!;
    const claudeCliBilledBefore = billedBefore.find((s) => !s.label.includes("covered") && s.value === 0.1)!;
    expect(anthropicBefore.value).toBe(1.25);
    expect(claudeCliBilledBefore.value).toBe(0.1);

    fireEvent.click(screen.getByRole("button", { name: "Billed + Covered" }));

    const after = readChartData();
    expect(after[0].segments).toHaveLength(3);

    const billedAfter = after[0].segments.filter((s) => !s.label.includes("covered"));
    expect(billedAfter).toHaveLength(2);
    // Billed values are byte-identical before and after the toggle.
    const anthropicAfter = billedAfter.find((s) => s.label.toLowerCase().includes("anthropic"))!;
    const claudeCliBilledAfter = billedAfter.find((s) => s.value === 0.1)!;
    expect(anthropicAfter.value).toBe(anthropicBefore.value);
    expect(claudeCliBilledAfter.value).toBe(claudeCliBilledBefore.value);

    // D-05: no segment for "claude-cli" ever equals billed+covered summed.
    const mergedValue = 0.1 + 0.75;
    expect(after[0].segments.some((s) => s.value === mergedValue)).toBe(false);

    // Covered segment's color is derived from the same PROVIDER_COLORS hex
    // as its billed sibling.
    const coveredSegment = after[0].segments.find((s) => s.label.includes("covered"))!;
    expect(coveredSegment.color).toContain("#10b981"); // claude-cli's PROVIDER_COLORS hex
  });

  it("states excluded unpriced tokens in a caption rather than dropping them", () => {
    const buckets: Bucket[] = [
      {
        bucket_start: 1700000000,
        billedByProvider: { anthropic_direct: 1 },
        coveredByProvider: {},
        unpricedTokensByProvider: { ollama: 500 },
      },
      {
        bucket_start: 1700003600,
        billedByProvider: {},
        coveredByProvider: {},
        unpricedTokensByProvider: { ollama: 250 },
      },
    ];
    mockUseQuery.mockReturnValue(buckets);
    render(<CostTrendChart />);

    expect(
      screen.getByText("750 tokens in this window aren't priced and aren't in this chart.")
    ).toBeInTheDocument();
  });

  it("does not render the unpriced caption when there are no unpriced tokens", () => {
    const buckets: Bucket[] = [
      {
        bucket_start: 1700000000,
        billedByProvider: { anthropic_direct: 1 },
        coveredByProvider: {},
        unpricedTokensByProvider: {},
      },
    ];
    mockUseQuery.mockReturnValue(buckets);
    render(<CostTrendChart />);

    expect(screen.queryByText(/aren't priced/)).not.toBeInTheDocument();
  });

  it("has an accessible toggle group with both options reachable as buttons", () => {
    mockUseQuery.mockReturnValue([
      {
        bucket_start: 1700000000,
        billedByProvider: { anthropic_direct: 1 },
        coveredByProvider: {},
        unpricedTokensByProvider: {},
      },
    ]);
    render(<CostTrendChart />);

    const group = screen.getByRole("group", { name: "Cost series" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Billed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Billed + Covered" })).toBeInTheDocument();
  });

  it("reads from costDerived.costOverTime", () => {
    mockUseQuery.mockReturnValue([]);
    render(<CostTrendChart />);
    expect(mockUseQuery).toHaveBeenCalledWith(
      "costDerived:costOverTime",
      expect.objectContaining({ period: "hourly" })
    );
  });

  it("contains no hex outside the PROVIDER_COLORS fallback and #6b7280 literal", () => {
    const source = readFileSync(join(__dirname, "CostTrendChart.tsx"), "utf-8");
    const hexMatches = source.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    const distinct = Array.from(new Set(hexMatches));
    expect(distinct).toEqual(["#6b7280"]);
  });

  it("contains no legacy gray-800/gray-700 wrapper classes", () => {
    const source = readFileSync(join(__dirname, "CostTrendChart.tsx"), "utf-8");
    expect(source).not.toMatch(/bg-gray-800|border-gray-700/);
  });
});
