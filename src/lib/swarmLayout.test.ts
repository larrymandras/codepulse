import { describe, it, expect } from "vitest";
import { computeSwarmLayout } from "./swarmLayout";

// Minimal SwarmTask shape used by computeSwarmLayout
type SwarmTask = {
  subtaskId: string;
  subtask: string;
  state: string;
  dependsOn: string[];
  goalId: string;
  claimedBy?: string;
  model?: string;
  agentId?: string;
  timestamp: number;
};

function task(
  id: string,
  dependsOn: string[] = [],
  state = "pending"
): SwarmTask {
  return {
    subtaskId: id,
    subtask: `Task ${id}`,
    state,
    dependsOn,
    goalId: "goal-1",
    timestamp: Date.now(),
  };
}

describe("computeSwarmLayout", () => {
  it("returns N+1 nodes for N tasks (includes Queen)", () => {
    const tasks = [task("a"), task("b"), task("c")];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    expect(nodes).toHaveLength(4); // 3 tasks + 1 Queen
  });

  it("Queen node has id 'queen' and type 'queen'", () => {
    const tasks = [task("a")];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    const queen = nodes.find((n) => n.id === "queen");
    expect(queen).toBeDefined();
    expect(queen!.type).toBe("queen");
  });

  it("assigns depth 0 to tasks with no dependencies", () => {
    const tasks = [task("a"), task("b")];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    const nodeA = nodes.find((n) => n.id === "a");
    const nodeB = nodes.find((n) => n.id === "b");
    // Both at y=0 (depth 0)
    expect(nodeA!.position.y).toBe(0);
    expect(nodeB!.position.y).toBe(0);
  });

  it("assigns depth 1+max(parents) for a linear A→B→C chain", () => {
    // A has no deps (depth 0), B depends on A (depth 1), C depends on B (depth 2)
    const tasks = [task("a", []), task("b", ["a"]), task("c", ["b"])];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    // Row pitch = NODE_H (120) + V_GAP (48); rows must clear each other.
    const ROW_PITCH = 120 + 48;
    const nodeA = nodes.find((n) => n.id === "a")!;
    const nodeB = nodes.find((n) => n.id === "b")!;
    const nodeC = nodes.find((n) => n.id === "c")!;
    expect(nodeA.position.y).toBe(0);
    expect(nodeB.position.y).toBe(ROW_PITCH);
    expect(nodeC.position.y).toBe(ROW_PITCH * 2);
  });

  it("spreads peers at the same depth left-to-right with H_GAP", () => {
    const tasks = [task("a"), task("b")];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    const nodeA = nodes.find((n) => n.id === "a")!;
    const nodeB = nodes.find((n) => n.id === "b")!;
    // They're at the same depth; x positions should differ
    expect(nodeA.position.x).not.toBe(nodeB.position.x);
    // Gap between right edge of A and left edge of B should be H_GAP=32
    const NODE_W = 260;
    const H_GAP = 32;
    const rightA = nodeA.position.x + NODE_W;
    const leftB = nodeB.position.x;
    expect(leftB - rightA).toBe(H_GAP);
  });

  it("Queen node is above depth 0 (negative y)", () => {
    const tasks = [task("a")];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    const queen = nodes.find((n) => n.id === "queen")!;
    expect(queen.position.y).toBeLessThan(0);
  });

  it("cyclic dependsOn does not hang and resolves to depth 0", () => {
    // A → B → A (cycle) — must terminate
    const tasks = [task("a", ["b"]), task("b", ["a"])];
    const start = Date.now();
    expect(() => computeSwarmLayout("goal-1", tasks)).not.toThrow();
    expect(Date.now() - start).toBeLessThan(500); // completes fast
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    // Both should have depth 0 (cycle guard)
    const nodeA = nodes.find((n) => n.id === "a")!;
    const nodeB = nodes.find((n) => n.id === "b")!;
    expect(nodeA.position.y).toBe(0);
    expect(nodeB.position.y).toBe(0);
  });

  it("missing dependsOn id resolves to depth 0", () => {
    // A depends on non-existent 'ghost'
    const tasks = [task("a", ["ghost"])];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    const nodeA = nodes.find((n) => n.id === "a")!;
    expect(nodeA.position.y).toBe(0);
  });

  it("creates dependency edges from dependsOn relationships", () => {
    const tasks = [task("a"), task("b", ["a"])];
    const { edges } = computeSwarmLayout("goal-1", tasks);
    const depEdge = edges.find((e) => e.source === "a" && e.target === "b");
    expect(depEdge).toBeDefined();
    expect(depEdge!.type).toBe("smoothstep");
  });

  it("creates Queen dispatch edges to each depth-0 task", () => {
    const tasks = [task("a"), task("b")];
    const { edges } = computeSwarmLayout("goal-1", tasks);
    const queenEdgeA = edges.find((e) => e.source === "queen" && e.target === "a");
    const queenEdgeB = edges.find((e) => e.source === "queen" && e.target === "b");
    expect(queenEdgeA).toBeDefined();
    expect(queenEdgeB).toBeDefined();
  });

  it("returns task node with correct type 'swarmTask'", () => {
    const tasks = [task("a", [], "running")];
    const { nodes } = computeSwarmLayout("goal-1", tasks);
    const nodeA = nodes.find((n) => n.id === "a")!;
    expect(nodeA.type).toBe("swarmTask");
    expect(nodeA.data.state).toBe("running");
  });
});
