import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

// ── @xyflow/react mock ────────────────────────────────────────────────────────
// SwarmTaskNode renders Handle elements — stub the whole package so tests
// don't need a DOM with React Flow's internal context.
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
}));

import SwarmTaskNode, { SwarmTaskNodeData } from "./SwarmTaskNode";

function makeData(overrides: Partial<SwarmTaskNodeData> = {}): SwarmTaskNodeData {
  return {
    subtaskId: "task-1",
    subtask: "Write the tests",
    state: "pending",
    dependsOn: [],
    ...overrides,
  };
}

describe("SwarmTaskNode — cancelled state", () => {
  it("renders the 'Cancelled' label when state is cancelled", () => {
    render(<SwarmTaskNode data={makeData({ state: "cancelled" })} />);
    // Both the sr-only span and the visible status row contain "Cancelled" — use getAllByText
    const matches = screen.getAllByText(/Cancelled/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("aria-label contains 'State: Cancelled'", () => {
    render(<SwarmTaskNode data={makeData({ state: "cancelled" })} />);
    // The visually-hidden sr-only span carries the aria label text
    const srSpan = document.querySelector(".sr-only");
    expect(srSpan).not.toBeNull();
    expect(srSpan!.textContent).toContain("State: Cancelled");
  });

  it("cancelled node does NOT carry the running pulse animation class", () => {
    const { container } = render(
      <SwarmTaskNode data={makeData({ state: "cancelled" })} />
    );
    // The root div carries state-driven animation classes
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).not.toMatch(
      /animate-\[live-update-pulse_600ms/
    );
  });

  it("cancelled node does NOT carry the verifying pulse animation class", () => {
    const { container } = render(
      <SwarmTaskNode data={makeData({ state: "cancelled" })} />
    );
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).not.toMatch(
      /animate-\[live-update-pulse_1\.4s/
    );
  });
});

describe("SwarmTaskNode — regression: existing states unchanged", () => {
  it("state='done' renders the 'Done' label", () => {
    render(<SwarmTaskNode data={makeData({ state: "done" })} />);
    // Both the sr-only span and the visible status row contain "Done" — use getAllByText
    const matches = screen.getAllByText(/Done/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("state='done' aria-label contains 'State: Done'", () => {
    render(<SwarmTaskNode data={makeData({ state: "done" })} />);
    const srSpan = document.querySelector(".sr-only");
    expect(srSpan).not.toBeNull();
    expect(srSpan!.textContent).toContain("State: Done");
  });

  it("state='failed' renders the 'Failed' label", () => {
    render(<SwarmTaskNode data={makeData({ state: "failed" })} />);
    // Both the sr-only span and the visible status row contain "Failed" — use getAllByText
    const matches = screen.getAllByText(/Failed/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("state='running' carries the running pulse animation class", () => {
    const { container } = render(
      <SwarmTaskNode data={makeData({ state: "running" })} />
    );
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).toMatch(/animate-\[live-update-pulse_600ms/);
  });
});
