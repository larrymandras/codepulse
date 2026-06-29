/**
 * HivePage — ?goal= inbound deep-link (from a Tool Galaxy agent's "swarm goals"
 * link). The param preselects a goal instead of auto-following the newest.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Stub children to thin, prop-reflecting components.
vi.mock("../components/SwarmGraph", () => ({
  default: ({ goalId }: { goalId: string | null }) => (
    <div data-testid="swarm-graph">{goalId ?? ""}</div>
  ),
}));
vi.mock("../components/BlackboardPanel", () => ({ default: () => null }));
vi.mock("../components/CostBreakdown", () => ({ default: () => null }));
vi.mock("../components/GoalPicker", () => ({ default: () => null }));
vi.mock("../components/SwarmTaskDetail", () => ({ default: () => null }));
vi.mock("../hooks/useSwarmGraph", () => ({
  useGoalList: () => [
    { goalId: "newest", firstSubtask: "x", latestState: "done", createdAt: 2, updatedAt: 2 },
  ],
}));

import HivePage from "./HivePage";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <HivePage />
    </MemoryRouter>,
  );

describe("HivePage ?goal= deep-link", () => {
  it("preselects the ?goal= goal over the newest", () => {
    renderAt("/hive?goal=goal-2");
    expect(screen.getByTestId("swarm-graph").textContent).toBe("goal-2");
  });

  it("auto-follows the newest goal when no ?goal= is present", () => {
    renderAt("/hive");
    expect(screen.getByTestId("swarm-graph").textContent).toBe("newest");
  });
});
