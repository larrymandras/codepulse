import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import AgentAvatar from "@/components/AgentAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import type { RosterAgent, AvatarData } from "@/hooks/useRosterAgents";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RosterOrgChartProps {
  agents: RosterAgent[];
  onAgentClick: (agentId: string) => void;
}

// ---------------------------------------------------------------------------
// Tier config
// ---------------------------------------------------------------------------

const TIER_RANK: Record<string, number> = {
  command: 0,
  domain: 1,
  shared: 2,
};

const TIER_COLOR: Record<string, string> = {
  command: "bg-purple-600",
  domain: "bg-blue-600",
  shared: "bg-gray-600",
};

// ---------------------------------------------------------------------------
// Custom node
// ---------------------------------------------------------------------------

interface RosterNodeData {
  agentId: string;
  name: string;
  description?: string;
  tier: string;
  status: string;
  avatarData?: AvatarData;
  [key: string]: unknown;
}

function RosterNode({ data }: NodeProps<Node<RosterNodeData>>) {
  const isPending = data.status === "pending";
  const avatarStatus =
    data.status === "active"
      ? "active"
      : data.status === "pending"
        ? "working"
        : "idle";

  return (
    <div
      className={`bg-card border rounded-lg px-3 py-2 w-[200px] cursor-pointer transition-all hover:border-accent/50 ${
        isPending
          ? "border-dashed border-amber-500/60"
          : "border-border"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground !w-2 !h-2 !border-card"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <AgentAvatar
          avatar={data.avatarData ?? { name: data.name }}
          status={avatarStatus as "active" | "working" | "idle"}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {data.name}
          </p>
          {data.description && (
            <p className="text-[11px] text-muted-foreground truncate">
              {data.description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Badge
          variant="secondary"
          className={`text-[11px] px-1 py-0 text-white ${TIER_COLOR[data.tier] ?? "bg-gray-600"}`}
        >
          {data.tier}
        </Badge>
        <StatusBadge status={data.status} />
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground !w-2 !h-2 !border-card"
      />
    </div>
  );
}

const nodeTypes = { roster: RosterNode };

// ---------------------------------------------------------------------------
// Layout with dagre
// ---------------------------------------------------------------------------

const NODE_W = 200;
const NODE_H = 80;

function buildLayout(agents: RosterAgent[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  // Sort by tier rank for consistent ordering
  const sorted = [...agents].sort(
    (a, b) => (TIER_RANK[a.tier] ?? 1) - (TIER_RANK[b.tier] ?? 1),
  );

  for (const agent of sorted) {
    g.setNode(agent.id, { width: NODE_W, height: NODE_H });
  }

  // Create edges: connect command agents to their domain children, domain to shared
  // Since we don't have explicit reports_to, use tier hierarchy with invisible group edges
  const byTier: Record<string, RosterAgent[]> = {};
  for (const a of sorted) {
    (byTier[a.tier] ??= []).push(a);
  }

  const commandAgents = byTier["command"] ?? [];
  const domainAgents = byTier["domain"] ?? [];
  const sharedAgents = byTier["shared"] ?? [];

  // Connect command -> domain
  for (const d of domainAgents) {
    const parent = commandAgents[0];
    if (parent) g.setEdge(parent.id, d.id);
  }

  // Connect domain -> shared
  for (let i = 0; i < sharedAgents.length; i++) {
    const parent = domainAgents[i % Math.max(domainAgents.length, 1)];
    if (parent) g.setEdge(parent.id, sharedAgents[i].id);
  }

  dagre.layout(g);

  const nodes: Node<RosterNodeData>[] = sorted.map((agent) => {
    const pos = g.node(agent.id);
    return {
      id: agent.id,
      type: "roster",
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
      data: {
        agentId: agent.id,
        name: agent.name,
        description: agent.description,
        tier: agent.tier,
        status: agent.status,
        avatarData: agent.avatarData,
      },
    };
  });

  const edges: Edge[] = [];
  for (const e of g.edges()) {
    edges.push({
      id: `edge-${e.v}-${e.w}`,
      source: e.v,
      target: e.w,
      type: "smoothstep",
      style: { stroke: "var(--border)", strokeWidth: 1.5 },
    });
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RosterOrgChart({ agents, onAgentClick }: RosterOrgChartProps) {
  const { nodes, edges } = useMemo(() => buildLayout(agents), [agents]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onAgentClick(node.id);
    },
    [onAgentClick],
  );

  if (agents.length === 0) {
    return (
      <p className="text-base text-muted-foreground text-center py-12">
        No agents to display.
      </p>
    );
  }

  return (
    <div className="h-[600px] rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="var(--border)" gap={20} />
        <Controls
          showInteractive={false}
          className="!bg-card !border-border !shadow-none [&>button]:!bg-muted [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-accent"
        />
      </ReactFlow>
    </div>
  );
}

export default RosterOrgChart;
