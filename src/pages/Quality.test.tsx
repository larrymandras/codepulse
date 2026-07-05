import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QualityTrendChart } from "../components/QualityTrendChart";

// Recharts requires layout dimensions ResponsiveContainer can't get in jsdom,
// so mock it locally (mirrors the existing App.test.tsx precedent) to assert
// on line/marker structure without real SVG rendering.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ReferenceLine: ({ label }: { label?: { value?: string } | string }) => (
    <div data-testid="reference-line">
      {typeof label === "object" ? label?.value : label}
    </div>
  ),
}));

const fixtureSeries = [
  {
    timestamp: 1751328000,
    sessionId: "session-1",
    overall: 0.9,
    dimensions: {
      task_completion: { score: 0.95, rationale: "clean completion" },
      error_handling: { score: 0.92, rationale: "no errors" },
      tool_efficiency: { score: 0.88, rationale: "lean tool use" },
      cost_discipline: { score: 0.9, rationale: "proportionate cost" },
    },
  },
  {
    timestamp: 1751414400,
    sessionId: "session-2",
    overall: 0.6,
    dimensions: {
      task_completion: { score: 0.6, rationale: "partial completion" },
      error_handling: { score: 0.55, rationale: "unrecovered retries" },
      tool_efficiency: { score: 0.6, rationale: "redundant calls" },
      cost_discipline: { score: 0.65, rationale: "elevated cost" },
    },
  },
];

const fixtureMarkers: { timestamp: number; changeType: "model" | "switch" }[] = [
  { timestamp: 1751371200, changeType: "model" },
];

describe("QualityTrendChart", () => {
  it("renders a line per rubric dimension plus overall, and a ReferenceLine per change marker", () => {
    render(<QualityTrendChart series={fixtureSeries} markers={fixtureMarkers} />);

    expect(screen.getByTestId("line-overall")).toBeInTheDocument();
    expect(screen.getByTestId("line-task_completion")).toBeInTheDocument();
    expect(screen.getByTestId("line-error_handling")).toBeInTheDocument();
    expect(screen.getByTestId("line-tool_efficiency")).toBeInTheDocument();
    expect(screen.getByTestId("line-cost_discipline")).toBeInTheDocument();
    expect(screen.getAllByTestId("reference-line")).toHaveLength(1);
    expect(screen.getByText("Model change")).toBeInTheDocument();
  });

  it("renders the empty-state copy when there is no judged-session data", () => {
    render(<QualityTrendChart series={[]} markers={[]} />);

    expect(screen.getByText(/no judged sessions/i)).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });
});
