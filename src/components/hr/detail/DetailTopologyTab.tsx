import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

interface DetailTopologyTabProps {
  agentId: string;
}

const COORDINATION_COLORS: Record<string, string> = {
  handoff: "#a78bfa",
  message: "#60a5fa",
  delegation: "#22d3ee",
  result: "#34d399",
};

export function DetailTopologyTab({ agentId }: DetailTopologyTabProps) {
  const detail = useQuery(api.agents.detail, { agentId }) ?? null;

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (!detail) return { nodes, edges };

    // Center node: the selected agent
    nodes.push({
      id: agentId,
      position: { x: 200, y: 150 },
      data: { label: agentId },
      style: {
        background: "var(--accent)",
        color: "var(--accent-foreground)",
        border: "2px solid var(--accent)",
        borderRadius: "8px",
        padding: "8px 16px",
        fontSize: "12px",
        fontWeight: 600,
      },
    });

    // Connected nodes from coordination events
    const seen = new Set<string>();
    const coordEvents = detail.coordination ?? [];
    let angle = 0;
    const radius = 150;
    const step = coordEvents.length > 0 ? (2 * Math.PI) / Math.min(coordEvents.length, 8) : 0;

    for (const c of coordEvents) {
      const otherId = c.fromAgent === agentId ? c.toAgent : c.fromAgent;
      if (!otherId || otherId === agentId || seen.has(otherId)) continue;
      seen.add(otherId);

      const x = 200 + radius * Math.cos(angle);
      const y = 150 + radius * Math.sin(angle);
      angle += step;

      nodes.push({
        id: otherId,
        position: { x, y },
        data: { label: otherId },
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "8px 16px",
          fontSize: "11px",
        },
      });

      const color = COORDINATION_COLORS[c.eventType] ?? "#6b7280";
      edges.push({
        id: `coord-${agentId}-${otherId}-${c.eventType}`,
        source: c.fromAgent === agentId ? agentId : otherId,
        target: c.fromAgent === agentId ? otherId : agentId,
        type: "smoothstep",
        animated: true,
        label: c.eventType,
        labelStyle: { fill: "#9ca3af", fontSize: 9 },
        labelBgStyle: { fill: "var(--card)", stroke: "var(--border)", rx: 4 },
        labelBgPadding: [4, 2] as [number, number],
        style: { stroke: color, strokeWidth: 1.5, strokeDasharray: "4 3" },
      });
    }

    return { nodes, edges };
  }, [detail, agentId]);

  if (!detail || (detail.coordination ?? []).length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No coordination events found for this agent.
      </p>
    );
  }

  return (
    <div className="h-[350px] rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.5}
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

export default DetailTopologyTab;
