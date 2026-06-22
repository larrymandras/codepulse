import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SwarmTaskDetail, { type SwarmTaskDetailData } from "./SwarmTaskDetail";

const LONG =
  "Research and write Deliverable 1 — Competitive Analysis of the top 5 AI coding assistants as of mid-2026. Conduct thorough web research, then write a structured comparison covering product name, key features, IDE/platform integrations, pricing tiers, standout differentiators, and weaknesses.";

function makeTask(overrides: Partial<SwarmTaskDetailData> = {}): SwarmTaskDetailData {
  return {
    subtaskId: "subtask-abc-123",
    subtask: LONG,
    state: "done",
    dependsOn: ["subtask-x", "subtask-y"],
    claimedBy: "urdhr",
    model: "claude-sonnet-4-6",
    ...overrides,
  };
}

describe("SwarmTaskDetail", () => {
  it("renders the FULL subtask text (no truncation) when a task is selected", () => {
    render(<SwarmTaskDetail task={makeTask()} onClose={() => {}} />);
    expect(screen.getByText(LONG)).toBeInTheDocument();
  });

  it("renders the dependency count and each dependency id", () => {
    render(<SwarmTaskDetail task={makeTask()} onClose={() => {}} />);
    expect(screen.getByText(/Depends on \(2\)/)).toBeInTheDocument();
    expect(screen.getByText("subtask-x")).toBeInTheDocument();
    expect(screen.getByText("subtask-y")).toBeInTheDocument();
  });

  it("shows the agent and model", () => {
    render(<SwarmTaskDetail task={makeTask()} onClose={() => {}} />);
    expect(screen.getByText("urdhr")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
  });

  it("renders nothing visible when no task is selected (closed)", () => {
    render(<SwarmTaskDetail task={null} onClose={() => {}} />);
    expect(screen.queryByText(LONG)).not.toBeInTheDocument();
  });
});
