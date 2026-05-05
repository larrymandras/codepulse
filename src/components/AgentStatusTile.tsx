import { motion } from "motion/react";
import AgentAvatar from "./AgentAvatar";

export type AgentState = "active" | "waiting" | "recent" | "idle";

const STATE_BG: Record<AgentState, string> = {
  active:  "bg-green-500/20",
  waiting: "bg-blue-500/20",
  recent:  "bg-amber-500/20",
  idle:    "bg-gray-500/10",
};
const STATE_BORDER: Record<AgentState, string> = {
  active:  "border-green-500/40",
  waiting: "border-blue-500/40",
  recent:  "border-amber-500/40",
  idle:    "border-gray-700/50",
};
const STATE_TEXT: Record<AgentState, string> = {
  active:  "text-green-300",
  waiting: "text-blue-300",
  recent:  "text-amber-300",
  idle:    "text-gray-500",
};
const STATE_PULSE: Record<AgentState, boolean> = {
  active: true, waiting: false, recent: true, idle: false,
};
const AVATAR_STATUS: Record<AgentState, "active" | "idle"> = {
  active: "active", waiting: "active", recent: "active", idle: "idle",
};

interface AgentStatusTileProps {
  agentId: string;
  agentName: string;
  state: AgentState;
  currentTask?: string;
  selected?: boolean;
  onClick?: () => void;
}

export default function AgentStatusTile({ agentId, agentName, state, currentTask, selected, onClick }: AgentStatusTileProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      className={`relative rounded-xl p-4 border cursor-pointer transition-all hover:brightness-110 min-w-[80px] min-h-[80px] aspect-square flex flex-col items-center justify-center ${STATE_BG[state]} ${STATE_BORDER[state]} ${selected ? "ring-1 ring-indigo-500/40 border-indigo-500" : ""}`}
    >
      {STATE_PULSE[state] && (
        <motion.div
          className={`absolute inset-0 rounded-xl border ${state === "active" ? "border-green-400" : "border-amber-400"}`}
          animate={{ opacity: [0.6, 0], scale: [1, 1.04] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
      <AgentAvatar avatar={{ name: agentId }} status={AVATAR_STATUS[state]} size="sm" />
      <p className="text-xs font-medium text-gray-200 mt-2 truncate max-w-full">{agentName}</p>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATE_TEXT[state]} bg-black/20`}>{state}</span>
      {currentTask && <p className="text-[9px] text-gray-500 mt-1 truncate max-w-full">{currentTask}</p>}
    </div>
  );
}
