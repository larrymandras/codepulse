/**
 * SwarmGraph — React Flow DAG of a goal's swarm subtask graph.
 *
 * Phase 149-03 — PULSE-03. Extends AgentTopology.tsx pattern (D-04).
 * 2D, animated emerald edges, particle flow on running edges, state-driven glow.
 *
 * Props: goalId (string | null | undefined) — the active goal to display.
 * null/undefined → "No active goal" empty state.
 * goalId set but no tasks yet → "Waiting for decomposition" empty state.
 */

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  EdgeLabelRenderer,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import SwarmTaskNode, { type SwarmTaskNodeData } from "./SwarmTaskNode";
import type { SwarmTaskDetailData } from "./SwarmTaskDetail";
import QueenNode from "./QueenNode";
import SwarmEdgeParticle from "./SwarmEdgeParticle";
import { useSwarmGraph } from "../hooks/useSwarmGraph";
import { computeSwarmLayout } from "../lib/swarmLayout";

// Node types registered with React Flow (D-04)
const nodeTypes = {
  swarmTask: SwarmTaskNode,
  queen: QueenNode,
} as const;

// ── Edge color/style per target node state (UI-SPEC Edge visual design table) ──
function edgeStyleForState(state: string): {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
} {
  switch (state) {
    case "pending":
      return { stroke: "#27272a", strokeWidth: 1.5, strokeDasharray: "4 3" };
    case "claimed":
      return { stroke: "#10b981", strokeWidth: 1.5 };
    case "running":
      return { stroke: "#22c55e", strokeWidth: 2 };
    case "verifying":
      return { stroke: "#10b981", strokeWidth: 2 };
    case "done":
      return { stroke: "rgba(16,185,129,0.4)", strokeWidth: 1.5 };
    case "failed":
      return { stroke: "rgba(239,68,68,0.6)", strokeWidth: 1.5 };
    case "verify_rejected":
      return { stroke: "rgba(239,68,68,0.6)", strokeWidth: 1.5 };
    default:
      return { stroke: "#27272a", strokeWidth: 1.5 };
  }
}

function isAnimatedState(state: string): boolean {
  return state === "running" || state === "verifying";
}

// ── Empty state components ────────────────────────────────────────────────────

function NoActiveGoal() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
      <p className="text-[13px] font-semibold text-foreground">
        No active goal
      </p>
      <p className="text-xs text-muted-foreground text-center max-w-[260px]">
        Select a goal above or trigger a swarm run from Ástríðr.
      </p>
    </div>
  );
}

function WaitingForDecomposition() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 gap-3">
      <p className="text-[13px] font-semibold text-foreground">
        Waiting for decomposition
      </p>
      <p className="text-xs text-muted-foreground text-center max-w-[300px]">
        The Queen is planning subtasks. The graph will populate as tasks are
        written to the blackboard.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface SwarmGraphProps {
  goalId: string | null | undefined;
  /** Called when a subtask node is clicked, with its full data for the detail panel. */
  onSelectTask?: (task: SwarmTaskDetailData) => void;
}

export default function SwarmGraph({ goalId, onSelectTask }: SwarmGraphProps) {
  const taskRows = useSwarmGraph(goalId);

  // Click a subtask node → open the detail panel. Queen node has no detail.
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === "queen") return;
      // React Flow types node.data as Record<string, unknown>; double-cast
      // through unknown (standard idiom). SwarmTaskNodeData is structurally
      // assignable to onSelectTask's SwarmTaskDetailData.
      onSelectTask?.(node.data as unknown as SwarmTaskNodeData);
    },
    [onSelectTask]
  );

  // Build a lookup for target-node state (for edge coloring)
  const stateById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of taskRows) {
      m.set(t.subtaskId, t.state);
    }
    return m;
  }, [taskRows]);

  // Memoize layout computation (pure function, safe to memo on taskRows)
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => computeSwarmLayout(goalId ?? "", taskRows),
    [goalId, taskRows]
  );

  // Enrich edges with state-driven style + animation
  const enrichedEdges: Edge[] = useMemo(() => {
    return layoutEdges.map((e) => {
      const edgeData = e.data as { edgeKind?: string; targetState?: string } | undefined;
      // Queen dispatch edges: fixed amber dashed style (already set in layout)
      if (edgeData?.edgeKind === "dispatch") {
        return e as Edge;
      }
      // Dependency edges: style driven by target node state
      const targetState = stateById.get(e.target) ?? "pending";
      const style = edgeStyleForState(targetState);
      return {
        ...e,
        animated: isAnimatedState(targetState),
        style,
      } as Edge;
    });
  }, [layoutEdges, stateById]);

  // Collect SVG paths for running edges (for SwarmEdgeParticle)
  // We pass path as a data prop from the layout — React Flow doesn't expose
  // the computed SVG path easily from outside, so we use a data marker and
  // SwarmEdgeParticle receives the edge id. For this implementation we render
  // one SwarmEdgeParticle per running-target dependency edge using a synthetic path.
  // The path is derived from node positions as a straight line approximation;
  // the visual particle still follows the edge area (accurate enough for V1).
  const runningEdgesForParticle = useMemo(() => {
    return enrichedEdges.filter((e) => {
      const edgeData = e.data as { edgeKind?: string } | undefined;
      if (edgeData?.edgeKind === "dispatch") return false;
      const targetState = stateById.get(e.target) ?? "pending";
      return targetState === "running";
    });
  }, [enrichedEdges, stateById]);

  // Build synthetic SVG paths for particle animation using source→target positions
  const nodePositionById = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    for (const n of layoutNodes) {
      m.set(n.id, n.position);
    }
    return m;
  }, [layoutNodes]);

  // ── Empty states ───────────────────────────────────────────────────────────
  if (!goalId) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center">
        <NoActiveGoal />
      </div>
    );
  }

  if (taskRows.length === 0) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center">
        <WaitingForDecomposition />
      </div>
    );
  }

  // ── Render React Flow DAG ──────────────────────────────────────────────────
  return (
    <div
      className="w-full h-[min(64vh,620px)] rounded-xl overflow-hidden
                 border border-border/30 bg-background/30
                 focus:outline-none focus:ring-1 focus:ring-primary/40"
      tabIndex={0}
    >
      <ReactFlow
        nodes={layoutNodes as Node[]}
        edges={enrichedEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        nodesDraggable={false}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        {/* UI-SPEC: gap=24, size=0.5, opacity=0.3 (subtler than AgentTopology).
            Background doesn't accept opacity prop in @xyflow/react v12 — use style. */}
        <Background color="#10b981" gap={24} size={0.5} style={{ opacity: 0.3 }} />
        {/* Same emerald Controls overrides as AgentTopology */}
        <Controls
          showInteractive={false}
          className="!bg-background !border-border !shadow-md
                     [&>button]:!bg-background/80 [&>button]:!border-border/50
                     [&>button]:!text-primary [&>button:hover]:!bg-primary/20
                     [&>button:hover]:!text-primary"
        />

        {/* Particle overlays — one per running-target dependency edge */}
        <EdgeLabelRenderer>
          {runningEdgesForParticle.map((edge) => {
            const srcPos = nodePositionById.get(edge.source);
            const tgtPos = nodePositionById.get(edge.target);
            if (!srcPos || !tgtPos) return null;
            // Synthetic path: straight line from source bottom-center to target top-center
            const NODE_W = 260;
            const NODE_H = 120;
            const x1 = srcPos.x + NODE_W / 2;
            const y1 = srcPos.y + NODE_H;
            const x2 = tgtPos.x + NODE_W / 2;
            const y2 = tgtPos.y;
            // Smooth bezier control points for a gentle arc
            const cy = (y1 + y2) / 2;
            const syntheticPath = `M${x1},${y1} C${x1},${cy} ${x2},${cy} ${x2},${y2}`;
            return (
              <SwarmEdgeParticle
                key={`particle-${edge.id}`}
                path={syntheticPath}
              />
            );
          })}
        </EdgeLabelRenderer>
      </ReactFlow>
    </div>
  );
}
