import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AgentNode from "./AgentNode";
import AgentDetailPanel from "./AgentDetailPanel";
import { useAllAgents, useCoordinationEvents } from "../hooks/useAgentTopology";
import { formatDuration } from "../lib/formatters";
import type { Agent } from "../types";

const nodeTypes = { agent: AgentNode };

type StatusFilter = "all" | "running" | "completed" | "failed";

const COORDINATION_COLORS: Record<string, string> = {
  handoff: "#a78bfa",
  message: "#60a5fa",
  delegation: "#22d3ee",
  result: "#34d399",
};

export default function AgentTopology() {
  const allAgents = useAllAgents();
  const coordination = useCoordinationEvents();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const agents = useMemo(
    () =>
      statusFilter === "all"
        ? allAgents
        : allAgents.filter((a) => a.status === statusFilter),
    [allAgents, statusFilter]
  );

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedAgent((prev) => (prev === node.id ? null : node.id));
  }, []);

  const { nodes, edges } = useMemo(() => {
    const now = Date.now() / 1000;
    const agentIds = new Set(agents.map((a) => a.agentId));

    // Build adjacency: parent -> children[]
    const childrenOf: Record<string, typeof agents> = {};
    const roots: typeof agents = [];

    for (const agent of agents) {
      if (!agent.parentAgentId || !agentIds.has(agent.parentAgentId)) {
        roots.push(agent);
      } else {
        if (!childrenOf[agent.parentAgentId]) childrenOf[agent.parentAgentId] = [];
        childrenOf[agent.parentAgentId].push(agent);
      }
    }

    // Recursive tree layout
    const NODE_W = 160;
    const NODE_H = 120;
    const H_GAP = 20;
    const V_GAP = 40;

    const nodes: Node[] = [];
    const agentEdges: Edge[] = [];

    function measureWidth(agentId: string): number {
      const kids = childrenOf[agentId] ?? [];
      if (kids.length === 0) return NODE_W;
      return kids.reduce((sum, k) => sum + measureWidth(k.agentId), 0) + (kids.length - 1) * H_GAP;
    }

    function layoutNode(agent: (typeof agents)[number], x: number, y: number) {
      const dur =
        agent.endedAt && agent.startedAt
          ? formatDuration(agent.endedAt - agent.startedAt)
          : agent.startedAt
            ? formatDuration(now - agent.startedAt)
            : undefined;

      nodes.push({
        id: agent.agentId,
        type: "agent",
        position: { x, y },
        data: {
          agentId: agent.agentId,
          agentType: agent.agentType,
          status: agent.status,
          model: agent.model,
          label: agent.agentId,
          duration: dur,
          selected: selectedAgent === agent.agentId,
          onClick: () =>
            setSelectedAgent((prev) =>
              prev === agent.agentId ? null : agent.agentId
            ),
        },
      });

      // Parent → child edges
      if (agent.parentAgentId && agentIds.has(agent.parentAgentId)) {
        agentEdges.push({
          id: `tree-${agent.parentAgentId}-${agent.agentId}`,
          source: agent.parentAgentId,
          target: agent.agentId,
          type: "smoothstep",
          animated: agent.status === "running",
          style: {
            stroke: agent.status === "running" ? "#22c55e" : agent.status === "failed" ? "#ef4444" : "#4b5563",
            strokeWidth: 2,
          },
        });
      }

      const kids = childrenOf[agent.agentId] ?? [];
      if (kids.length === 0) return;

      const totalW = measureWidth(agent.agentId);
      let cx = x + NODE_W / 2 - totalW / 2;

      for (const kid of kids) {
        const kidW = measureWidth(kid.agentId);
        layoutNode(kid, cx + kidW / 2 - NODE_W / 2, y + NODE_H + V_GAP);
        cx += kidW + H_GAP;
      }
    }

    // Layout all root nodes side by side
    let rootX = 0;
    for (const root of roots) {
      const w = measureWidth(root.agentId);
      layoutNode(root, rootX + w / 2 - NODE_W / 2, 0);
      rootX += w + H_GAP * 2;
    }

    // Coordination edges (between known agents)
    const coordEdges: Edge[] = [];
    for (const c of coordination) {
      if (agentIds.has(c.fromAgent) && agentIds.has(c.toAgent) && c.fromAgent !== c.toAgent) {
        const edgeId = `coord-${c.fromAgent}-${c.toAgent}-${c.eventType}`;
        // Deduplicate
        if (!coordEdges.find((e) => e.id === edgeId)) {
          coordEdges.push({
            id: edgeId,
            source: c.fromAgent,
            target: c.toAgent,
            type: "smoothstep",
            animated: true,
            label: c.eventType,
            labelStyle: { fill: "#9ca3af", fontSize: 9 },
            labelBgStyle: { fill: "#1f2937", stroke: "#374151", rx: 4 },
            labelBgPadding: [4, 2] as [number, number],
            style: {
              stroke: COORDINATION_COLORS[c.eventType] ?? "#6b7280",
              strokeWidth: 1.5,
              strokeDasharray: "4 3",
            },
          });
        }
      }
    }

    return { nodes, edges: [...agentEdges, ...coordEdges] };
  }, [agents, coordination, selectedAgent]);

  const statusCounts = useMemo(() => {
    const c = { running: 0, completed: 0, failed: 0 };
    for (const a of allAgents) {
      const s = a.status as keyof typeof c;
      if (s in c) c[s]++;
    }
    return c;
  }, [allAgents]);

  const filters: { label: string; value: StatusFilter; count: number; dot: string }[] = [
    { label: "All", value: "all", count: allAgents.length, dot: "" },
    { label: "Running", value: "running", count: statusCounts.running, dot: "bg-green-400" },
    { label: "Completed", value: "completed", count: statusCounts.completed, dot: "bg-yellow-400" },
    { label: "Failed", value: "failed", count: statusCounts.failed, dot: "bg-red-400" },
  ];

  if (allAgents.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Agent Topology</h2>
        <p className="text-sm text-gray-500 py-8 text-center">No agents running</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-gray-300">Agent Topology</h2>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700/30 rounded-lg p-0.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors ${
                statusFilter === f.value
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
              {f.label}
              <span className="text-gray-500 text-[10px]">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <span className="text-[9px] text-gray-500 uppercase">Edges:</span>
        <span className="flex items-center gap-1 text-[9px] text-gray-400">
          <span className="w-4 h-0.5 bg-green-500 rounded" /> parent→child
        </span>
        {Object.entries(COORDINATION_COLORS).map(([type, color]) => (
          <span key={type} className="flex items-center gap-1 text-[9px] text-gray-400">
            <span className="w-4 h-0.5 rounded" style={{ backgroundColor: color, opacity: 0.7 }} /> {type}
          </span>
        ))}
      </div>

      {/* Graph + Detail panel */}
      <div className="flex gap-3">
        <div style={{ height: 400 }} className={`rounded-lg overflow-hidden ${selectedAgent ? "flex-1" : "w-full"}`}>
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
            <Background color="#374151" gap={20} />
            <Controls
              showInteractive={false}
              className="!bg-gray-800 !border-gray-700 !shadow-none [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-600"
            />
          </ReactFlow>
        </div>

        {/* Detail panel */}
        {selectedAgent && (
          <div className="shrink-0">
            <AgentDetailPanel
              agentId={selectedAgent}
              onClose={() => setSelectedAgent(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
