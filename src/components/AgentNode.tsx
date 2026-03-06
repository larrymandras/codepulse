import { Handle, Position } from "@xyflow/react";
import AgentAvatar from "./AgentAvatar";

interface AgentNodeData {
  agentId: string;
  agentType: string;
  status: string;
  model?: string;
  label: string;
}

export default function AgentNode({ data }: { data: AgentNodeData }) {
  const statusMap: Record<string, "active" | "working" | "idle" | "completed" | "error"> = {
    running: "active",
    completed: "completed",
    failed: "error",
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <Handle type="target" position={Position.Top} className="!bg-gray-600 !w-2 !h-2" />
      <AgentAvatar
        avatar={{ name: data.agentId }}
        status={statusMap[data.status] ?? "idle"}
        size="lg"
      />
      <div className="text-center max-w-[100px]">
        <p className="text-xs font-mono text-gray-200 truncate">{data.agentId}</p>
        <p className="text-[10px] text-gray-500">{data.agentType}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-600 !w-2 !h-2" />
    </div>
  );
}
