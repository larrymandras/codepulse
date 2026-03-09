import { Handle, Position } from "@xyflow/react";
import AgentAvatar from "./AgentAvatar";

interface AgentNodeData {
  agentId: string;
  agentType: string;
  status: string;
  model?: string;
  label: string;
  duration?: string;
  selected?: boolean;
  onClick?: () => void;
}

const statusBorder: Record<string, string> = {
  running: "border-green-500/60",
  completed: "border-yellow-500/40",
  failed: "border-red-500/60",
};

const statusDot: Record<string, string> = {
  running: "bg-green-400",
  completed: "bg-yellow-400",
  failed: "bg-red-400",
};

const statusLabel: Record<string, string> = {
  running: "Running",
  completed: "Done",
  failed: "Failed",
};

const avatarStatus: Record<string, "active" | "working" | "idle" | "completed" | "error"> = {
  running: "active",
  completed: "completed",
  failed: "error",
};

const MODEL_COLORS: Record<string, string> = {
  opus: "bg-amber-500/20 text-amber-300",
  sonnet: "bg-cyan-500/20 text-cyan-300",
  haiku: "bg-emerald-500/20 text-emerald-300",
  gpt: "bg-green-500/20 text-green-300",
  gemini: "bg-blue-500/20 text-blue-300",
};

function modelBadgeClass(model?: string): string {
  if (!model) return "bg-gray-700/50 text-gray-400";
  const lower = model.toLowerCase();
  for (const [key, cls] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return cls;
  }
  return "bg-gray-700/50 text-gray-400";
}

export default function AgentNode({ data }: { data: AgentNodeData }) {
  return (
    <div
      onClick={data.onClick}
      className={`relative bg-gray-800/80 backdrop-blur border rounded-xl px-3 py-2 min-w-[120px] max-w-[160px] cursor-pointer transition-all hover:bg-gray-700/80 ${
        data.selected
          ? "border-indigo-500 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
          : statusBorder[data.status] ?? "border-gray-600/50"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2 !border-gray-800" />

      <div className="flex items-center gap-2 mb-1.5">
        <AgentAvatar
          avatar={{ name: data.agentId }}
          status={avatarStatus[data.status] ?? "idle"}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-gray-200 truncate">{data.agentId}</p>
          <p className="text-[9px] text-gray-500 truncate">{data.agentType}</p>
        </div>
      </div>

      {/* Bottom row: status + model */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot[data.status] ?? "bg-gray-500"}`} />
          <span className="text-[9px] text-gray-400">
            {statusLabel[data.status] ?? data.status}
          </span>
        </span>
        {data.model && (
          <span className={`text-[8px] px-1 py-0.5 rounded ${modelBadgeClass(data.model)}`}>
            {data.model.split("/").pop()?.split("-").slice(0, 2).join("-") ?? data.model}
          </span>
        )}
      </div>

      {data.duration && (
        <p className="text-[8px] text-gray-600 mt-1">{data.duration}</p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2 !border-gray-800" />
    </div>
  );
}
