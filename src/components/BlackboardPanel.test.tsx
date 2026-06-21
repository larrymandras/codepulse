import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Convex mocks ────────────────────────────────────────────────────────────
vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    swarmTasks: {
      byGoal: "swarmTasks:byGoal",
      listGoals: "swarmTasks:listGoals",
    },
  },
}));

// ── useSwarmGraph mock ───────────────────────────────────────────────────────
let mockRows: unknown[] = [];
vi.mock("../hooks/useSwarmGraph", () => ({
  useSwarmGraph: vi.fn(() => mockRows),
  useGoalList: vi.fn(() => []),
}));

import { useSwarmGraph } from "../hooks/useSwarmGraph";
import BlackboardPanel from "./BlackboardPanel";

const mockUseSwarmGraph = vi.mocked(useSwarmGraph);

const makeRow = (id: string, state = "running", claimedBy = "agent-1") => ({
  goalId: "goal-1",
  subtaskId: id,
  state,
  subtask: `Do task ${id}`,
  dependsOn: [],
  claimedBy,
  timestamp: Date.now() - 60_000,
  updatedAt: Date.now() - 5_000,
});

describe("BlackboardPanel", () => {
  beforeEach(() => {
    mockRows = [];
    vi.clearAllMocks();
  });

  it("renders one EntityRow per swarmTask row", () => {
    mockRows = [makeRow("t1", "running"), makeRow("t2", "done")];
    mockUseSwarmGraph.mockReturnValue(mockRows as ReturnType<typeof useSwarmGraph>);

    render(<BlackboardPanel goalId="goal-1" />);

    expect(screen.getByText("Do task t1")).toBeInTheDocument();
    expect(screen.getByText("Do task t2")).toBeInTheDocument();
  });

  it('renders "{n} tasks" Badge with correct count', () => {
    mockRows = [makeRow("t1"), makeRow("t2"), makeRow("t3")];
    mockUseSwarmGraph.mockReturnValue(mockRows as ReturnType<typeof useSwarmGraph>);

    render(<BlackboardPanel goalId="goal-1" />);

    expect(screen.getByText("3 tasks")).toBeInTheDocument();
  });

  it('renders "Waiting for tasks" empty state when rows are empty', () => {
    mockRows = [];
    mockUseSwarmGraph.mockReturnValue([]);

    render(<BlackboardPanel goalId="goal-1" />);

    expect(screen.getByText("Waiting for tasks")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Subtasks will appear here once the Queen begins decomposition."
      )
    ).toBeInTheDocument();
  });

  it("renders BLACKBOARD header label", () => {
    mockRows = [];
    mockUseSwarmGraph.mockReturnValue([]);

    render(<BlackboardPanel goalId="goal-1" />);

    expect(screen.getByText("BLACKBOARD")).toBeInTheDocument();
  });

  it("renders state badge for each task row", () => {
    mockRows = [makeRow("t1", "running"), makeRow("t2", "claimed")];
    mockUseSwarmGraph.mockReturnValue(mockRows as ReturnType<typeof useSwarmGraph>);

    render(<BlackboardPanel goalId="goal-1" />);

    // StatusBadge should render RUNNING and CLAIMED labels
    expect(screen.getByText("RUNNING")).toBeInTheDocument();
    expect(screen.getByText("CLAIMED")).toBeInTheDocument();
  });

  it("StatusBadge resolves swarm states without 'unknown' badge", () => {
    const swarmStates = ["claimed", "verifying", "done", "verify_rejected"];
    mockRows = swarmStates.map((s, i) => makeRow(`t${i}`, s));
    mockUseSwarmGraph.mockReturnValue(mockRows as ReturnType<typeof useSwarmGraph>);

    render(<BlackboardPanel goalId="goal-1" />);

    // All of these should resolve to known labels, not the state name itself uppercased
    expect(screen.getByText("CLAIMED")).toBeInTheDocument();
    expect(screen.getByText("VERIFYING")).toBeInTheDocument();
    expect(screen.getByText("DONE")).toBeInTheDocument();
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
  });

  it('shows "No tasks found for this goal." for completed goal with no rows', () => {
    mockRows = [];
    mockUseSwarmGraph.mockReturnValue([]);

    render(<BlackboardPanel goalId="goal-1" completedGoal />);

    expect(screen.getByText("No tasks found for this goal.")).toBeInTheDocument();
  });
});
