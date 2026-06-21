/**
 * Pure swarm layout utility — no @xyflow/react imports.
 * Computes node positions and edges for the SwarmGraph React Flow DAG.
 *
 * Phase 149-03 — PULSE-03 swarm graph layout algorithm.
 * Implements topological sort by dependsOn depth (not recursive parent tree).
 * Cycle-safe: missing or circular deps resolve to depth 0 (T-149-08 mitigation).
 */

export interface SwarmTask {
  subtaskId: string;
  subtask: string;
  state: string;
  dependsOn: string[];
  goalId: string;
  claimedBy?: string;
  model?: string;
  agentId?: string;
  timestamp: number;
  updatedAt?: number;
}

export interface SwarmNode {
  id: string;
  type: "swarmTask" | "queen";
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface SwarmEdge {
  id: string;
  source: string;
  target: string;
  type: "smoothstep";
  animated?: boolean;
  style?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface SwarmLayoutResult {
  nodes: SwarmNode[];
  edges: SwarmEdge[];
}

// Layout constants from UI-SPEC
const NODE_W = 172;
const NODE_H = 88;
const H_GAP = 20;
const V_GAP = 48;

/**
 * Cycle-safe topological depth resolver.
 *
 * Per plan spec (T-149-08 mitigation):
 * - A task with a MISSING dependsOn id → the task resolves to depth 0
 * - A task involved in a CYCLE → ALL cycle participants resolve to depth 0
 *
 * Implementation: two-pass approach.
 * Pass 1: detect which task ids are involved in cycles or have missing deps.
 * Pass 2: assign depths (cycle/bad-dep tasks → depth 0, rest → 1+max(parents)).
 */
function computeDepths(tasks: SwarmTask[]): Map<string, number> {
  const taskMap = new Map(tasks.map((t) => [t.subtaskId, t]));

  // Pass 1: identify "bad" nodes (cycle participants or missing-dep owners)
  const bad = new Set<string>();

  // Detect missing deps
  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      if (!taskMap.has(depId)) {
        bad.add(task.subtaskId);
      }
    }
  }

  // Detect cycles via DFS with three-color marking (white/gray/black)
  const color = new Map<string, "white" | "gray" | "black">();
  tasks.forEach((t) => color.set(t.subtaskId, "white"));

  function dfs(id: string): void {
    color.set(id, "gray");
    const task = taskMap.get(id);
    if (task) {
      for (const depId of task.dependsOn) {
        if (!taskMap.has(depId)) continue; // missing dep already handled
        const c = color.get(depId);
        if (c === "gray") {
          // Back edge → cycle: mark both endpoints as bad
          bad.add(id);
          bad.add(depId);
        } else if (c === "white") {
          dfs(depId);
          // If the recursive call found that depId is bad (part of a cycle),
          // propagate badness up to id as well
          if (bad.has(depId)) {
            bad.add(id);
          }
        }
      }
    }
    color.set(id, "black");
  }

  tasks.forEach((t) => {
    if (color.get(t.subtaskId) === "white") dfs(t.subtaskId);
  });

  // Pass 2: compute depths (bad nodes → 0, others → topological depth)
  const depthMap = new Map<string, number>();

  function getDepth(id: string): number {
    if (depthMap.has(id)) return depthMap.get(id)!;
    if (bad.has(id)) {
      depthMap.set(id, 0);
      return 0;
    }
    const task = taskMap.get(id);
    if (!task || task.dependsOn.length === 0) {
      depthMap.set(id, 0);
      return 0;
    }
    const parentDepths = task.dependsOn
      .filter((depId) => taskMap.has(depId) && !bad.has(depId))
      .map((depId) => getDepth(depId));
    const depth = parentDepths.length > 0 ? 1 + Math.max(...parentDepths) : 0;
    depthMap.set(id, depth);
    return depth;
  }

  tasks.forEach((t) => getDepth(t.subtaskId));
  return depthMap;
}

/**
 * computeSwarmLayout — pure function, no React Flow imports.
 *
 * @param goalId  The goal ID (used for the Queen node data)
 * @param tasks   Array of SwarmTask rows from Convex
 * @returns       { nodes, edges } shaped for React Flow
 */
export function computeSwarmLayout(
  goalId: string,
  tasks: SwarmTask[]
): SwarmLayoutResult {
  if (tasks.length === 0) {
    // Queen only, centered
    const queenNode: SwarmNode = {
      id: "queen",
      type: "queen",
      position: { x: 0, y: -(NODE_H + V_GAP) },
      data: { goalId, label: "Queen" },
    };
    return { nodes: [queenNode], edges: [] };
  }

  const depthMap = computeDepths(tasks);

  // Group tasks by depth level
  const byDepth = new Map<number, SwarmTask[]>();
  for (const task of tasks) {
    const d = depthMap.get(task.subtaskId) ?? 0;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(task);
  }

  // Compute total width of a depth level
  function levelWidth(level: SwarmTask[]): number {
    return level.length * NODE_W + (level.length - 1) * H_GAP;
  }

  // Find total row width at depth 0 for centering the Queen
  const depth0Tasks = byDepth.get(0) ?? [];
  const depth0Width = depth0Tasks.length > 0 ? levelWidth(depth0Tasks) : NODE_W;
  const depth0OriginX = 0;

  // Build node positions
  const posMap = new Map<string, { x: number; y: number }>();
  const nodes: SwarmNode[] = [];

  const depths = Array.from(byDepth.keys()).sort((a, b) => a - b);
  for (const depth of depths) {
    const level = byDepth.get(depth)!;
    const totalW = levelWidth(level);
    // Center this level relative to depth-0 row
    const startX = depth0OriginX + depth0Width / 2 - totalW / 2;
    level.forEach((task, i) => {
      const x = startX + i * (NODE_W + H_GAP);
      const y = depth * V_GAP;
      posMap.set(task.subtaskId, { x, y });
      nodes.push({
        id: task.subtaskId,
        type: "swarmTask",
        position: { x, y },
        data: {
          subtaskId: task.subtaskId,
          subtask: task.subtask,
          state: task.state,
          dependsOn: task.dependsOn,
          claimedBy: task.claimedBy,
          model: task.model,
          agentId: task.agentId,
        },
      });
    });
  }

  // Queen node: centered horizontally above depth 0, at depth -1
  const queenX = depth0OriginX + depth0Width / 2 - NODE_W / 2;
  const queenY = -(NODE_H + V_GAP);
  const queenNode: SwarmNode = {
    id: "queen",
    type: "queen",
    position: { x: queenX, y: queenY },
    data: { goalId, label: "Queen" },
  };
  nodes.unshift(queenNode);

  // Build edges
  const edges: SwarmEdge[] = [];

  // Queen → each depth-0 task (amber dashed dispatch edges)
  for (const task of depth0Tasks) {
    edges.push({
      id: `queen-dispatch-${task.subtaskId}`,
      source: "queen",
      target: task.subtaskId,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: "#f59e0b",
        strokeWidth: 1.5,
        strokeDasharray: "6 3",
      },
      data: { edgeKind: "dispatch" },
    });
  }

  // Dependency edges: parent → child (state of target drives color/animation)
  for (const task of tasks) {
    for (const depId of task.dependsOn) {
      // Only emit edge if the dep actually exists in our task set
      const depExists = tasks.some((t) => t.subtaskId === depId);
      if (!depExists) continue;
      edges.push({
        id: `dep-${depId}-${task.subtaskId}`,
        source: depId,
        target: task.subtaskId,
        type: "smoothstep",
        data: { targetState: task.state },
      });
    }
  }

  return { nodes, edges };
}
