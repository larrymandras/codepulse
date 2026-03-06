import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import AgentNode from "./AgentNode";
import { useRunningAgents } from "../hooks/useAgentTopology";

const nodeTypes = { agent: AgentNode };

export default function AgentTopology() {
  const agents = useRunningAgents();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = agents.map((agent: any, i: number) => ({
      id: agent.agentId,
      type: "agent",
      position: { x: i * 160, y: agent.parentAgentId ? 160 : 0 },
      data: {
        agentId: agent.agentId,
        agentType: agent.agentType,
        status: agent.status,
        model: agent.model,
        label: agent.agentId,
      },
    }));

    const edges: Edge[] = agents
      .filter((a: any) => a.parentAgentId)
      .map((a: any) => ({
        id: `${a.parentAgentId}-${a.agentId}`,
        source: a.parentAgentId!,
        target: a.agentId,
        animated: a.status === "running",
        style: { stroke: a.status === "running" ? "#22c55e" : "#4b5563", strokeWidth: 2 },
      }));

    // Auto-layout: position parent nodes at top, children below
    const parentIds = new Set(agents.filter((a: any) => !a.parentAgentId).map((a: any) => a.agentId));
    let parentX = 0;
    for (const node of nodes) {
      if (parentIds.has(node.id)) {
        node.position = { x: parentX, y: 0 };
        const children = nodes.filter((n) => {
          const agent = agents.find((a: any) => a.agentId === n.id);
          return agent?.parentAgentId === node.id;
        });
        children.forEach((child, ci) => {
          child.position = { x: parentX + (ci - (children.length - 1) / 2) * 140, y: 160 };
        });
        parentX += Math.max(children.length, 1) * 140 + 60;
      }
    }

    return { nodes, edges };
  }, [agents]);

  if (agents.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Agent Topology</h2>
        <p className="text-sm text-gray-500 py-8 text-center">No agents running</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Agent Topology</h2>
      <div style={{ height: 300 }} className="rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background color="#374151" gap={20} />
          <Controls
            showInteractive={false}
            className="!bg-gray-800 !border-gray-700 !shadow-none [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-600"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
