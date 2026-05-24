import dagre from "dagre";
import { useMemo } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GraphEdge = {
  agentId: string;
  toolName: string;
  status: string; // "healthy" | "errored"
  callCount: number;
  errorCount: number;
};

export type LayoutNode = {
  id: string;
  label: string;
  type: "agent" | "tool";
  x: number;
  y: number;
  width: number;
  height: number;
  status: "healthy" | "errored" | "pending";
};

export type LayoutEdge = {
  source: string;
  target: string;
  errored: boolean;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENT_WIDTH = 120;
const AGENT_HEIGHT = 48;
const TOOL_WIDTH = 96;
const TOOL_HEIGHT = 32;

// ─── Layout computation (exported for testing) ──────────────────────────────

export function computeLayout(
  edges: GraphEdge[]
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  if (edges.length === 0) return { nodes: [], edges: [] };

  // Create a NEW dagre graph instance per call (per RESEARCH.md Pitfall 4)
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 48, marginx: 16, marginy: 16 });

  // Aggregate status per agent and tool (errored if ANY edge is errored)
  const agentStatus = new Map<string, "errored" | "healthy">();
  const toolStatus = new Map<string, "errored" | "healthy">();

  for (const e of edges) {
    const prevA = agentStatus.get(e.agentId) ?? "healthy";
    agentStatus.set(e.agentId, e.status === "errored" ? "errored" : prevA);
    const prevT = toolStatus.get(e.toolName) ?? "healthy";
    toolStatus.set(e.toolName, e.status === "errored" ? "errored" : prevT);
  }

  // Set nodes
  for (const [agentId] of agentStatus) {
    g.setNode(`agent:${agentId}`, { width: AGENT_WIDTH, height: AGENT_HEIGHT });
  }
  for (const [toolName] of toolStatus) {
    g.setNode(`tool:${toolName}`, { width: TOOL_WIDTH, height: TOOL_HEIGHT });
  }

  // Set edges (deduplicate by agent+tool pair)
  const edgeSet = new Set<string>();
  for (const e of edges) {
    const key = `agent:${e.agentId}->tool:${e.toolName}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      g.setEdge(`agent:${e.agentId}`, `tool:${e.toolName}`);
    }
  }

  dagre.layout(g);

  // Extract positioned nodes
  const nodes: LayoutNode[] = [
    ...[...agentStatus.entries()].map(([id, status]) => {
      const n = g.node(`agent:${id}`);
      return {
        id: `agent:${id}`,
        label: id,
        type: "agent" as const,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        status,
      };
    }),
    ...[...toolStatus.entries()].map(([name, status]) => {
      const n = g.node(`tool:${name}`);
      return {
        id: `tool:${name}`,
        label: name,
        type: "tool" as const,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        status,
      };
    }),
  ];

  // Extract positioned edges (deduplicated)
  const layoutEdges: LayoutEdge[] = [];
  const edgeDedup = new Set<string>();
  for (const e of edges) {
    const key = `agent:${e.agentId}->tool:${e.toolName}`;
    if (!edgeDedup.has(key)) {
      edgeDedup.add(key);
      layoutEdges.push({
        source: `agent:${e.agentId}`,
        target: `tool:${e.toolName}`,
        errored: e.status === "errored",
      });
    }
  }

  return { nodes, edges: layoutEdges };
}

// ─── Colors (from UI-SPEC.md) ───────────────────────────────────────────────

const NODE_COLORS = {
  agent: {
    healthy: { fill: "#141416", stroke: "#27272a", text: "#ffffff" },
    errored: { fill: "#ef4444", stroke: "#ef4444", text: "#ffffff" },
    pending: { fill: "#27272a", stroke: "#eab308", text: "#a1a1aa" },
  },
  tool: {
    healthy: { fill: "#27272a", stroke: "#27272a", text: "#a1a1aa" },
    errored: { fill: "#ef4444", stroke: "#ef4444", text: "#ffffff" },
    pending: { fill: "#27272a", stroke: "#eab308", text: "#a1a1aa" },
  },
};

const EDGE_COLORS = { normal: "#27272a", errored: "#ef4444" };

// ─── SVG Renderer ────────────────────────────────────────────────────────────

interface CallGraphSVGProps {
  edges: GraphEdge[];
}

export default function CallGraphSVG({ edges }: CallGraphSVGProps) {
  const layout = useMemo(() => computeLayout(edges), [edges]);

  if (layout.nodes.length === 0) return null;

  // Calculate SVG viewBox from node positions
  const padding = 24;
  const minX = Math.min(...layout.nodes.map((n) => n.x - n.width / 2)) - padding;
  const minY = Math.min(...layout.nodes.map((n) => n.y - n.height / 2)) - padding;
  const maxX = Math.max(...layout.nodes.map((n) => n.x + n.width / 2)) + padding;
  const maxY = Math.max(...layout.nodes.map((n) => n.y + n.height / 2)) + padding;
  const svgWidth = maxX - minX;
  const svgHeight = maxY - minY;

  // Build a node position map for edge drawing
  const nodeMap = new Map(layout.nodes.map((n) => [n.id, n]));

  return (
    <svg
      viewBox={`${minX} ${minY} ${svgWidth} ${svgHeight}`}
      className="w-full"
      style={{ minHeight: "320px", maxHeight: "600px" }}
    >
      {/* Arrow marker definitions */}
      <defs>
        <marker
          id="arrow-normal"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS.normal} />
        </marker>
        <marker
          id="arrow-errored"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill={EDGE_COLORS.errored} />
        </marker>
      </defs>

      {/* Edges */}
      {layout.edges.map((edge, i) => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return null;
        const color = edge.errored ? EDGE_COLORS.errored : EDGE_COLORS.normal;
        const strokeWidth = edge.errored ? 2 : 1;
        const markerId = edge.errored ? "arrow-errored" : "arrow-normal";
        return (
          <line
            key={`edge-${i}`}
            x1={source.x}
            y1={source.y + source.height / 2}
            x2={target.x}
            y2={target.y - target.height / 2}
            stroke={color}
            strokeWidth={strokeWidth}
            markerEnd={`url(#${markerId})`}
          />
        );
      })}

      {/* Nodes */}
      {layout.nodes.map((node) => {
        const colors = NODE_COLORS[node.type][node.status];
        const strokeDash = node.status === "pending" ? "4 2" : undefined;
        const strokeW =
          node.status === "errored" ? 2 : node.status === "pending" ? 1.5 : 1;
        const fontSize = node.type === "agent" ? 12 : 10;
        const fontWeight = node.type === "agent" ? 600 : 400;

        return (
          <g key={node.id}>
            <rect
              x={node.x - node.width / 2}
              y={node.y - node.height / 2}
              width={node.width}
              height={node.height}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={strokeW}
              strokeDasharray={strokeDash}
            />
            <text
              x={node.x}
              y={node.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={colors.text}
              fontSize={fontSize}
              fontWeight={fontWeight}
              fontFamily="'Geist Variable', 'Segoe UI', sans-serif"
            >
              {node.label.length > 14 ? node.label.slice(0, 12) + "…" : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
