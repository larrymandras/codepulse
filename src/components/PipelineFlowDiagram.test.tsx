import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PipelineFlowDiagram from "./PipelineFlowDiagram";

const mockSubscribeEvent = vi.fn(() => vi.fn());
vi.mock("../contexts/AstridrWSContext", () => ({
  useAstridrWS: () => ({ subscribeEvent: mockSubscribeEvent }),
}));

vi.mock("../hooks/usePipelineStepEvents", () => ({
  usePipelineStepEvents: () => [],
  useRecentPipelineExecutionIds: () => [],
}));

vi.mock("./InfoTooltip", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  Handle: () => <div data-testid="rf-handle" />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
}));

describe("PipelineFlowDiagram", () => {
  it("renders Pipeline Flow heading", () => {
    render(<PipelineFlowDiagram />);
    expect(screen.getByText("Pipeline Flow")).toBeInTheDocument();
  });

  it("renders the execution selector dropdown with Live option", () => {
    render(<PipelineFlowDiagram />);
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("contains the ReactFlow container with explicit height style", () => {
    const { container } = render(<PipelineFlowDiagram />);
    const heightDiv = container.querySelector('[style*="height: 400px"]') ??
                      container.querySelector('[style*="height"]');
    expect(heightDiv).not.toBeNull();
  });

  it("shows empty state text when no events exist in live mode", () => {
    render(<PipelineFlowDiagram />);
    expect(
      screen.getByText(/No pipeline runs/)
    ).toBeInTheDocument();
  });

  it("subscribes to step_started and step_completed WebSocket events", () => {
    render(<PipelineFlowDiagram />);
    expect(mockSubscribeEvent).toHaveBeenCalledWith("step_started", expect.any(Function));
    expect(mockSubscribeEvent).toHaveBeenCalledWith("step_completed", expect.any(Function));
  });
});
