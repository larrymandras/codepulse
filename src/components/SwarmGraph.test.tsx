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
    // useAgentAvatarResolver (Queen/agent avatars) queries these; useQuery is
    // mocked to return undefined → resolver sees empty lists → no avatarData.
    avatars: { list: "avatars:list" },
    agentProfiles: { list: "agentProfiles:list" },
  },
}));

// ── @xyflow/react mock ───────────────────────────────────────────────────────
// Capture the nodes/edges arrays passed to ReactFlow so we can assert on them.
// Because React Flow is a canvas-heavy library, we stub it entirely.
const h = vi.hoisted(() => ({
  lastNodes: null as unknown[] | null,
  lastEdges: null as unknown[] | null,
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({
    nodes,
    edges,
    children,
  }: {
    nodes: unknown[];
    edges: unknown[];
    children?: React.ReactNode;
  }) => {
    h.lastNodes = nodes;
    h.lastEdges = edges;
    return (
      <div data-testid="mock-flow">
        {children}
      </div>
    );
  },
  Background: () => <div data-testid="mock-bg" />,
  Controls: () => <div data-testid="mock-controls" />,
  EdgeLabelRenderer: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom" },
  useReactFlow: () => ({ fitView: vi.fn() }),
}));

// ── useSwarmGraph mock ───────────────────────────────────────────────────────
// Control what rows the hook returns so we can test node-count and state mapping
let mockRows: unknown[] = [];
vi.mock("../hooks/useSwarmGraph", () => ({
  useSwarmGraph: vi.fn(() => mockRows),
  useGoalList: vi.fn(() => []),
}));

import { useQuery } from "convex/react";
import SwarmGraph from "./SwarmGraph";

const mockUseQuery = vi.mocked(useQuery);

function makeTask(
  id: string,
  state = "pending",
  dependsOn: string[] = []
) {
  return {
    subtaskId: id,
    subtask: `Task ${id}`,
    state,
    dependsOn,
    goalId: "goal-1",
    timestamp: Date.now(),
  };
}

describe("SwarmGraph", () => {
  beforeEach(() => {
    mockRows = [];
    h.lastNodes = null;
    h.lastEdges = null;
    mockUseQuery.mockReturnValue(undefined);
  });

  // ── Empty states ───────────────────────────────────────────────────────────

  it("renders 'No active goal' when goalId is null", () => {
    render(<SwarmGraph goalId={null} />);
    expect(screen.getByText("No active goal")).toBeInTheDocument();
  });

  it("renders the body copy for no-active-goal state", () => {
    render(<SwarmGraph goalId={null} />);
    expect(
      screen.getByText(/Select a goal above or trigger a swarm run/)
    ).toBeInTheDocument();
  });

  it("renders 'Waiting for decomposition' when goalId is set but tasks is empty", () => {
    mockRows = [];
    render(<SwarmGraph goalId="goal-1" />);
    expect(screen.getByText("Waiting for decomposition")).toBeInTheDocument();
  });

  it("renders the body copy for waiting-for-decomposition state", () => {
    mockRows = [];
    render(<SwarmGraph goalId="goal-1" />);
    expect(
      screen.getByText(/The Queen is planning subtasks/)
    ).toBeInTheDocument();
  });

  // ── Node count ────────────────────────────────────────────────────────────

  it("passes N+1 nodes to ReactFlow for N tasks (includes Queen)", () => {
    mockRows = [makeTask("a"), makeTask("b"), makeTask("c")];
    render(<SwarmGraph goalId="goal-1" />);
    // 3 tasks + 1 Queen = 4 nodes
    expect(h.lastNodes).toHaveLength(4);
  });

  it("includes a node with id='queen' and type='queen'", () => {
    mockRows = [makeTask("a")];
    render(<SwarmGraph goalId="goal-1" />);
    const queen = (h.lastNodes as Array<{ id: string; type: string }>).find(
      (n) => n.id === "queen"
    );
    expect(queen).toBeDefined();
    expect(queen!.type).toBe("queen");
  });

  it("task nodes have type='swarmTask'", () => {
    mockRows = [makeTask("a", "pending")];
    render(<SwarmGraph goalId="goal-1" />);
    const taskNode = (
      h.lastNodes as Array<{ id: string; type: string }>
    ).find((n) => n.id === "a");
    expect(taskNode).toBeDefined();
    expect(taskNode!.type).toBe("swarmTask");
  });

  // ── State mapping ─────────────────────────────────────────────────────────

  it("task node data carries the correct state for 'running'", () => {
    mockRows = [makeTask("a", "running")];
    render(<SwarmGraph goalId="goal-1" />);
    const taskNode = (
      h.lastNodes as Array<{ id: string; data: { state: string } }>
    ).find((n) => n.id === "a");
    expect(taskNode!.data.state).toBe("running");
  });

  it("task node data carries the correct state for 'done'", () => {
    mockRows = [makeTask("a", "done")];
    render(<SwarmGraph goalId="goal-1" />);
    const taskNode = (
      h.lastNodes as Array<{ id: string; data: { state: string } }>
    ).find((n) => n.id === "a");
    expect(taskNode!.data.state).toBe("done");
  });

  it("task node data carries the correct state for 'failed'", () => {
    mockRows = [makeTask("a", "failed")];
    render(<SwarmGraph goalId="goal-1" />);
    const taskNode = (
      h.lastNodes as Array<{ id: string; data: { state: string } }>
    ).find((n) => n.id === "a");
    expect(taskNode!.data.state).toBe("failed");
  });

  // ── React Flow renders ─────────────────────────────────────────────────────

  it("renders the ReactFlow mock when tasks exist", () => {
    mockRows = [makeTask("a")];
    render(<SwarmGraph goalId="goal-1" />);
    expect(screen.getByTestId("mock-flow")).toBeInTheDocument();
  });

  // ── Height fix: ReactFlow wrapper must have an explicit height (gap-149 #1) ──
  // h-full (height:100%) resolves to 0 when the parent has no explicit height
  // (only min-height). The wrapper must own its height with h-[400px] or similar.

  it("ReactFlow wrapper does NOT use h-full — has an explicit height class", () => {
    mockRows = [makeTask("a")];
    const { container } = render(<SwarmGraph goalId="goal-1" />);
    // The wrapper div is the one with tabIndex=0 that directly wraps the ReactFlow mock.
    const wrapper = container.querySelector("[tabIndex='0']");
    expect(wrapper).not.toBeNull();
    const cls = wrapper!.className;
    // Must not rely on h-full (which resolves to 0 against a min-height parent)
    expect(cls).not.toMatch(/\bh-full\b/);
    // Must have an explicit height (e.g. h-[400px])
    expect(cls).toMatch(/\bh-\[/);
  });
});
