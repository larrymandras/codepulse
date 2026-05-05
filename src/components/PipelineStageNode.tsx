import { Handle, Position } from "@xyflow/react";
import { formatDurationMs } from "../lib/formatters";

export interface PipelineStageNodeData {
  stepName: string; // "receive" | "route" | "process" | "respond" | "tts_followup"
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  durationMs?: number;
  selected?: boolean;
  onClick?: () => void;
}

const STATUS_BORDER: Record<string, string> = {
  pending: "border-gray-600",
  running: "border-indigo-500 ring-1 ring-indigo-500/40",
  completed: "border-green-500/60",
  failed: "border-red-500/60",
  skipped: "border-gray-700",
};

const STATUS_BG: Record<string, string> = {
  pending: "bg-gray-800",
  running: "bg-indigo-950/30",
  completed: "bg-green-950/20",
  failed: "bg-red-950/20",
  skipped: "bg-gray-900",
};

const STATUS_TEXT: Record<string, string> = {
  pending: "text-gray-500",
  running: "text-indigo-300",
  completed: "text-green-300",
  failed: "text-red-300",
  skipped: "text-gray-600",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-gray-500",
  running: "bg-indigo-400 animate-pulse",
  completed: "bg-green-400",
  failed: "bg-red-400",
  skipped: "bg-gray-600",
};

const STEP_LABELS: Record<string, string> = {
  receive: "Receive",
  route: "Route",
  process: "Process",
  respond: "Respond",
  tts_followup: "TTS",
};

export default function PipelineStageNode({ data }: { data: PipelineStageNodeData }) {
  const borderClass = data.selected
    ? "border-indigo-500 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
    : STATUS_BORDER[data.status] ?? "border-gray-600";

  return (
    <div
      onClick={data.onClick}
      className={`relative backdrop-blur border rounded-xl px-3 py-2 min-w-[120px] max-w-[160px] cursor-pointer transition-all hover:bg-gray-700/80 ${STATUS_BG[data.status]} ${borderClass}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-gray-500 !w-2 !h-2 !border-gray-800" />

      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${STATUS_DOT[data.status]}`} />
        <span className={`text-sm font-medium ${STATUS_TEXT[data.status]}`}>
          {STEP_LABELS[data.stepName] ?? data.stepName}
        </span>
      </div>

      {data.durationMs !== undefined && (
        <p className="text-[10px] font-mono text-gray-400">
          {formatDurationMs(data.durationMs)}
        </p>
      )}

      <Handle type="source" position={Position.Right} className="!bg-gray-500 !w-2 !h-2 !border-gray-800" />
    </div>
  );
}
