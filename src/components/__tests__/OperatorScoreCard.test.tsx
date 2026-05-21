import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock Convex hooks
vi.mock("../../hooks/useOperatorScore", () => ({
  useLatestOperatorScore: vi.fn(),
  useOperatorScoreHistory: vi.fn(),
  useOperatorScoreBackfill: vi.fn(),
}));

// Mock sub-components that require complex setup
vi.mock("../MetricCard", () => ({
  AnimatedNumber: ({
    value,
    format,
  }: {
    value: number;
    format?: (v: number) => string;
  }) => (
    <span data-testid="animated-number">
      {format ? format(value) : value}
    </span>
  ),
}));

vi.mock("../Sparkline", () => ({
  default: ({ data }: { data: number[] }) => (
    <div data-testid="sparkline" data-points={data.length} />
  ),
}));

vi.mock("../GlassPanel", () => ({
  GlassPanel: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="glass-panel" className={className}>
      {children}
    </div>
  ),
}));

import OperatorScoreCard from "../OperatorScoreCard";
import {
  useLatestOperatorScore,
  useOperatorScoreHistory,
} from "../../hooks/useOperatorScore";

const mockLatest = useLatestOperatorScore as ReturnType<typeof vi.fn>;
const mockHistory = useOperatorScoreHistory as ReturnType<typeof vi.fn>;

describe("OperatorScoreCard", () => {
  it("renders loading state when data is undefined", () => {
    mockLatest.mockReturnValue(undefined);
    mockHistory.mockReturnValue([]);
    render(<OperatorScoreCard />);
    expect(screen.getByText("Loading...")).toBeTruthy();
  });

  it("renders empty state when latest is null", () => {
    mockLatest.mockReturnValue(null);
    mockHistory.mockReturnValue([]);
    render(<OperatorScoreCard />);
    expect(screen.getByText("No score yet")).toBeTruthy();
    expect(
      screen.getByText(/Operator Score is computed after the nightly audit/),
    ).toBeTruthy();
  });

  it("renders score with green color for score > 70 (SCORE-02)", () => {
    mockLatest.mockReturnValue({
      score: 85,
      memoryFreshness: 90,
      skillRoi: 80,
      activityLevel: 75,
      uptime: 100,
      trendDay: "up",
      trend7d: "improving",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([{ score: 82 }, { score: 85 }]);
    render(<OperatorScoreCard />);
    expect(screen.getByText(/Healthy/)).toBeTruthy();
    expect(screen.getByTestId("animated-number").textContent).toBe("85");
  });

  it("renders score with yellow color for score 40-70 (SCORE-02)", () => {
    mockLatest.mockReturnValue({
      score: 55,
      memoryFreshness: 60,
      skillRoi: 50,
      activityLevel: 55,
      uptime: 0,
      trendDay: "flat",
      trend7d: "flat",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([]);
    render(<OperatorScoreCard />);
    expect(screen.getByText(/Needs Attention/)).toBeTruthy();
  });

  it("renders score with red color for score < 40 (SCORE-02)", () => {
    mockLatest.mockReturnValue({
      score: 25,
      memoryFreshness: 20,
      skillRoi: 30,
      activityLevel: 15,
      uptime: 0,
      trendDay: "down",
      trend7d: "declining",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([]);
    render(<OperatorScoreCard />);
    expect(screen.getByText(/Critical/)).toBeTruthy();
  });

  it("renders sub-score breakdown with correct labels (D-16)", () => {
    mockLatest.mockReturnValue({
      score: 72,
      memoryFreshness: 82,
      skillRoi: 71,
      activityLevel: 68,
      uptime: 100,
      trendDay: "up",
      trend7d: "improving",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([]);
    render(<OperatorScoreCard />);
    expect(screen.getByText(/Memory Freshness/)).toBeTruthy();
    expect(screen.getByText(/Skill ROI/)).toBeTruthy();
    expect(screen.getByText(/Activity Level/)).toBeTruthy();
    expect(screen.getByText(/Uptime/)).toBeTruthy();
    expect(screen.getByText(/25%/)).toBeTruthy();
    expect(screen.getByText(/35%/)).toBeTruthy();
    expect(screen.getByText(/30%/)).toBeTruthy();
    expect(screen.getByText(/10%/)).toBeTruthy();
  });

  it("renders sparkline when history has >= 2 data points", () => {
    mockLatest.mockReturnValue({
      score: 72,
      memoryFreshness: 80,
      skillRoi: 70,
      activityLevel: 65,
      uptime: 100,
      trendDay: "up",
      trend7d: "flat",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([
      { score: 65 },
      { score: 68 },
      { score: 72 },
    ]);
    render(<OperatorScoreCard />);
    const sparkline = screen.getByTestId("sparkline");
    expect(sparkline).toBeTruthy();
    expect(sparkline.getAttribute("data-points")).toBe("3");
  });

  it("does not render sparkline with < 2 data points", () => {
    mockLatest.mockReturnValue({
      score: 72,
      memoryFreshness: 80,
      skillRoi: 70,
      activityLevel: 65,
      uptime: 100,
      trendDay: "flat",
      trend7d: "flat",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([{ score: 72 }]);
    render(<OperatorScoreCard />);
    expect(screen.queryByTestId("sparkline")).toBeNull();
  });

  it("uses backend-computed trendDay from Convex record", () => {
    mockLatest.mockReturnValue({
      score: 72,
      memoryFreshness: 80,
      skillRoi: 70,
      activityLevel: 65,
      uptime: 100,
      trendDay: "up",
      trend7d: "improving",
      computedAt: Date.now(),
    });
    mockHistory.mockReturnValue([{ score: 60 }, { score: 72 }]);
    render(<OperatorScoreCard />);
    // Verify trend arrows are rendered (backend-computed values used)
    expect(screen.getByText(/1D/)).toBeTruthy();
    expect(screen.getByText(/7D/)).toBeTruthy();
  });
});
