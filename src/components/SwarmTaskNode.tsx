/**
 * SwarmTaskNode — custom React Flow node for swarm subtasks.
 *
 * Phase 149-03 — PULSE-03. Extends the AgentNode pattern.
 * Fixed 172×88px. 7-state visual mapping per UI-SPEC State vocabulary table.
 * Imports modelBadgeClass from AgentNode (no duplicate).
 * Accessibility: visually-hidden aria-label span per UI-SPEC requirement.
 */

import { Handle, Position } from "@xyflow/react";
import {
  Clock,
  ArrowRight,
  Zap,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ShieldX,
  Ban,
} from "lucide-react";
import { modelBadgeClass } from "./AgentNode";
import AgentAvatar from "./AgentAvatar";
import type { AvatarData } from "../hooks/useRosterAgents";

export interface SwarmTaskNodeData {
  subtaskId: string;
  subtask: string;
  state: string;
  dependsOn: string[];
  claimedBy?: string;
  model?: string;
  agentId?: string;
  /** Resolved avatar for the claiming agent (injected by SwarmGraph). */
  avatarData?: AvatarData;
}

// Map subtask state → AgentAvatar status ring (reuses AgentAvatar's vocabulary).
const stateAvatarStatus: Record<string, "active" | "working" | "idle" | "completed" | "error"> = {
  pending: "idle",
  claimed: "active",
  running: "working",
  verifying: "active",
  done: "completed",
  failed: "error",
  verify_rejected: "error",
  cancelled: "idle",
};

// 8-state border class map (UI-SPEC State vocabulary table + cancelled)
const stateBorder: Record<string, string> = {
  pending: "border-border/50",
  claimed: "border-primary/40",
  running: "border-cyan-400/60",
  verifying: "border-primary/70",
  done: "border-primary/30",
  failed: "border-[#ef4444]/60",
  verify_rejected: "border-[#ef4444]/60",
  cancelled: "border-[#f59e0b]/50",
};

// 8-state glow/shadow map
const stateGlow: Record<string, string> = {
  pending: "shadow-md",
  claimed: "shadow-[var(--glow-xs)]",
  running: "shadow-[var(--glow-md)]",
  verifying: "shadow-[0_4px_20px_rgba(139,92,246,0.25)]",  // violet — state identity color, exempt
  done: "shadow-[var(--glow-xs)]",
  failed: "shadow-[0_4px_15px_rgba(239,68,68,0.25)]",     // red — state identity color, exempt
  verify_rejected: "shadow-[0_4px_15px_rgba(239,68,68,0.25)]", // red — state identity color, exempt
  cancelled: "shadow-sm",
};

// 8-state animation for glow pulse (running=600ms, verifying=1.4s; cancelled=terminal/inert)
const stateAnimation: Record<string, string> = {
  pending: "",
  claimed: "",
  running: "animate-[live-update-pulse_600ms_ease-in-out_infinite]",
  verifying: "animate-[live-update-pulse_1.4s_ease-in-out_infinite]",
  done: "",
  failed: "",
  verify_rejected: "",
  cancelled: "",
};

// 8-state status dot color map
const stateDot: Record<string, string> = {
  pending: "bg-muted-foreground/50",
  claimed: "bg-primary/60",
  running: "bg-cyan-400",
  verifying: "bg-violet-400",
  done: "bg-primary/80",
  failed: "bg-[#ef4444]",
  verify_rejected: "bg-[#ef4444]",
  cancelled: "bg-[#f59e0b]/70",
};

// 8-state icon map (Lucide icons, 14px h-3.5 w-3.5)
const stateIconColor: Record<string, string> = {
  pending: "text-muted-foreground/70",
  claimed: "text-primary/70",
  running: "text-cyan-400",
  verifying: "text-violet-400",
  done: "text-primary/70",
  failed: "text-[#ef4444]",
  verify_rejected: "text-[#ef4444]",
  cancelled: "text-[#f59e0b]/80",
};

// 8-state label map (UI-SPEC Copywriting Contract + cancelled)
const stateLabel: Record<string, string> = {
  pending: "Pending",
  claimed: "Claimed",
  running: "Running",
  verifying: "Verifying",
  done: "Done",
  failed: "Failed",
  verify_rejected: "Rejected",
  cancelled: "Cancelled",
};

function StateIcon({ state }: { state: string }) {
  const cls = `h-3.5 w-3.5 ${stateIconColor[state] ?? "text-muted-foreground"} ${state === "running" ? "animate-pulse" : ""}`;
  switch (state) {
    case "pending":
      return <Clock className={cls} />;
    case "claimed":
      return <ArrowRight className={cls} />;
    case "running":
      return <Zap className={cls} />;
    case "verifying":
      return <ShieldCheck className={cls} />;
    case "done":
      return <CheckCircle className={cls} />;
    case "failed":
      return <XCircle className={cls} />;
    case "verify_rejected":
      return <ShieldX className={cls} />;
    case "cancelled":
      return <Ban className={cls} />;
    default:
      return <Clock className={cls} />;
  }
}

export default function SwarmTaskNode({ data }: { data: SwarmTaskNodeData }) {
  const state = data.state ?? "pending";
  const label = stateLabel[state] ?? state;
  const agentDisplay = data.agentId
    ? data.agentId.slice(0, 12)
    : data.claimedBy
      ? data.claimedBy.slice(0, 12)
      : "—";
  const hasAgent = Boolean(data.agentId || data.claimedBy);
  const avatarStatus = stateAvatarStatus[state] ?? "idle";

  // aria-label for screen readers (UI-SPEC Accessibility)
  const ariaLabel = `Subtask: ${data.subtask}, State: ${label}, Claimed by: ${agentDisplay}`;

  return (
    <div
      className={[
        "relative bg-card/90 backdrop-blur-md border rounded-xl px-4 py-3.5",
        "w-[300px] min-h-[116px] flex flex-col justify-between gap-2 overflow-hidden",
        "cursor-pointer hover:ring-1 hover:ring-primary/50 hover:scale-[1.05] hover:shadow-2xl hover:z-10",
        "transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
        stateBorder[state] ?? "border-border/50",
        stateGlow[state] ?? "",
        stateAnimation[state] ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Visually-hidden aria-label for screen readers */}
      <span className="sr-only">{ariaLabel}</span>

      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-500 !w-2 !h-2 !border-background"
      />

      {/* Top row: state icon + subtask description */}
      <div className="flex items-start gap-2 flex-1 min-h-0">
        <div className="shrink-0 mt-1">
          <StateIcon state={state} />
        </div>
        <p className="text-base font-medium text-foreground/90 line-clamp-2 leading-relaxed flex-1 min-w-0">
          {data.subtask}
        </p>
      </div>

      {/* Divider */}
      <div className="border-t border-border/30 my-1" />

      {/* Bottom row: dot + STATE • agentId + model badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="flex items-center gap-1.5 min-w-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${stateDot[state] ?? "bg-muted-foreground/50"}`}
          />
          {hasAgent && (
            <AgentAvatar
              avatar={data.avatarData ?? { name: data.agentId ?? data.claimedBy ?? "?" }}
              status={avatarStatus}
              size="sm"
            />
          )}
          <span className="text-xs font-mono text-muted-foreground truncate">
            {label} • {agentDisplay}
          </span>
        </span>
        {data.model && (
          <span
            className={`text-xs px-1 py-0.5 rounded shrink-0 ${modelBadgeClass(data.model)}`}
          >
            {data.model.split("/").pop()?.split("-").slice(0, 2).join("-") ??
              data.model}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-500 !w-2 !h-2 !border-background"
      />
    </div>
  );
}
