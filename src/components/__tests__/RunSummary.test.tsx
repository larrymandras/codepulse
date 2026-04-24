import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunSummary } from "../RunSummary";

const completedData = {
  rounds: 3,
  inputTokens: 1500,
  outputTokens: 800,
  cost: 0.047,
  startedAt: 1714000000000,
  completedAt: 1714000012000,
  status: "completed" as const,
};

describe("RunSummary", () => {
  it("renders round count", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders cost formatted as dollars", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("$0.047")).toBeInTheDocument();
  });

  it("renders token counts", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("renders duration", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("12.0s")).toBeInTheDocument();
  });

  it("renders status indicator", () => {
    render(<RunSummary {...completedData} blocks={[]} />);
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  it("shows dashes for token/cost during live run", () => {
    render(
      <RunSummary
        rounds={1}
        status="running"
        startedAt={Date.now()}
        blocks={[]}
      />
    );
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("renders tool usage from blocks", () => {
    const blocks = [
      { type: "tool_call", tool_name: "web_search" },
      { type: "tool_call", tool_name: "web_search" },
      { type: "tool_call", tool_name: "memory_save" },
    ];
    render(<RunSummary {...completedData} blocks={blocks} />);
    expect(screen.getByText(/web_search/)).toBeInTheDocument();
    expect(screen.getByText(/×2/)).toBeInTheDocument();
    expect(screen.getByText(/memory_save/)).toBeInTheDocument();
  });

  it("renders provider trail from failover blocks", () => {
    const blocks = [
      { type: "failover", failedProvider: "anthropic_direct", newProvider: "ollama" },
    ];
    render(<RunSummary {...completedData} blocks={blocks} />);
    expect(screen.getByText(/anthropic_direct/)).toBeInTheDocument();
    expect(screen.getByText(/ollama/)).toBeInTheDocument();
  });

  it("shows empty state when no run data", () => {
    render(<RunSummary status="idle" blocks={[]} />);
    expect(screen.getByText(/No run data/i)).toBeInTheDocument();
  });
});
