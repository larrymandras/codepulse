import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/hooks/useSystemResources", () => ({
  useSystemResources: vi.fn(),
}));
vi.mock("@/hooks/useLlmMetrics", () => ({
  useLlmMetrics: vi.fn(),
}));
vi.mock("@/hooks/useResolvedBrain", () => ({
  useLastTurnModel: vi.fn(),
}));

import { useSystemResources } from "@/hooks/useSystemResources";
import { useLlmMetrics } from "@/hooks/useLlmMetrics";
import { useLastTurnModel } from "@/hooks/useResolvedBrain";
import { SystemMonitorPanel } from "./SystemMonitorPanel";

const mockUseSystemResources = vi.mocked(useSystemResources);
const mockUseLlmMetrics = vi.mocked(useLlmMetrics);
const mockUseLastTurnModel = vi.mocked(useLastTurnModel);

function getGauge(label: string) {
  return screen
    .getAllByTestId("radial-gauge")
    .find((el) => el.getAttribute("data-label") === label);
}

describe("SystemMonitorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLlmMetrics.mockReturnValue({ calls: [], status: "Exhausted", loadMore: vi.fn() });
    mockUseLastTurnModel.mockReturnValue(null);
  });

  it('renders the chrome header "SYSTEM MONITOR"', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSystemResources.mockReturnValue(undefined as any);
    render(<SystemMonitorPanel />);
    expect(screen.getByText("SYSTEM MONITOR")).toBeInTheDocument();
  });

  it("renders all three gauges (CPU/RAM/DISK, never GPU) with plotted values", () => {
    mockUseSystemResources.mockReturnValue({
      cpu: 42,
      ram: { used: 4096, total: 16384 },
      disk: { used: 100_000, total: 512_000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<SystemMonitorPanel />);

    const gauges = screen.getAllByTestId("radial-gauge");
    expect(gauges).toHaveLength(3);
    expect(getGauge("CPU")?.getAttribute("data-has-value")).toBe("true");
    expect(getGauge("RAM")?.getAttribute("data-has-value")).toBe("true");
    expect(getGauge("DISK")?.getAttribute("data-has-value")).toBe("true");
  });

  it("renders an out-of-range metric with the warn state", () => {
    mockUseSystemResources.mockReturnValue({
      cpu: 92, // >= warnAt=85
      ram: { used: 1000, total: 16384 },
      disk: { used: 1000, total: 512_000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<SystemMonitorPanel />);

    expect(getGauge("CPU")?.getAttribute("data-warn")).toBe("true");
    expect(getGauge("RAM")?.getAttribute("data-warn")).toBe("false");
  });

  it("still plots a disconnected/no-data reading rather than going blank", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseSystemResources.mockReturnValue(undefined as any);
    render(<SystemMonitorPanel />);

    const gauges = screen.getAllByTestId("radial-gauge");
    expect(gauges).toHaveLength(3);
    for (const g of gauges) {
      expect(g.getAttribute("data-has-value")).toBe("false");
    }
    // The panel chrome and meters row still render — never a blank panel.
    expect(screen.getByText("SYSTEM MONITOR")).toBeInTheDocument();
    expect(screen.getByText("Tok/s")).toBeInTheDocument();
  });

  it("derives Tok/s and Latency from the most recent real completion, never TTFT", () => {
    mockUseSystemResources.mockReturnValue({
      cpu: 10,
      ram: { used: 1000, total: 16384 },
      disk: { used: 1000, total: 512_000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockUseLlmMetrics.mockReturnValue({
      calls: [{ completionTokens: 200, latencyMs: 2000, cost: 0.05, promptTokens: 1000 }],
      status: "Exhausted",
      loadMore: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<SystemMonitorPanel />);

    expect(screen.getByText("100")).toBeInTheDocument(); // 200 tok / 2s = 100 t/s
    expect(screen.getByText("2.00")).toBeInTheDocument(); // 2000ms -> 2.00s
    expect(screen.getByText("Latency")).toBeInTheDocument();
    expect(screen.queryByText(/ttft/i)).not.toBeInTheDocument();
  });

  it("hides the context fuel bar for an unrecognised model rather than inventing a denominator", () => {
    mockUseSystemResources.mockReturnValue({
      cpu: 10,
      ram: { used: 1000, total: 16384 },
      disk: { used: 1000, total: 512_000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockUseLlmMetrics.mockReturnValue({
      calls: [{ completionTokens: 10, latencyMs: 100, cost: 0, promptTokens: 500, model: "some-unknown-model" }],
      status: "Exhausted",
      loadMore: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<SystemMonitorPanel />);

    expect(screen.queryByTestId("context-fuel-bar")).not.toBeInTheDocument();
  });

  it("shows the context fuel bar for a recognised model", () => {
    mockUseSystemResources.mockReturnValue({
      cpu: 10,
      ram: { used: 1000, total: 16384 },
      disk: { used: 1000, total: 512_000 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    mockUseLastTurnModel.mockReturnValue("claude-sonnet-5");
    mockUseLlmMetrics.mockReturnValue({
      calls: [{ completionTokens: 10, latencyMs: 100, cost: 0, promptTokens: 50_000 }],
      status: "Exhausted",
      loadMore: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    render(<SystemMonitorPanel />);

    expect(screen.getByTestId("context-fuel-bar")).toBeInTheDocument();
  });
});
