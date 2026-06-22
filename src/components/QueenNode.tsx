/**
 * QueenNode — custom React Flow root node for the goal Queen.
 *
 * Phase 149-03 — PULSE-03.
 * Amber border + glow (distinct from emerald worker glow).
 * Bottom-only source Handle (Queen has no incoming dependency edges).
 * 260px wide, min-h-108px — matches SwarmTaskNode dimensions.
 */

import { Handle, Position } from "@xyflow/react";
import { Crown } from "lucide-react";

export interface QueenNodeData {
  goalId: string;
  label?: string;
}

export default function QueenNode({ data }: { data: QueenNodeData }) {
  const shortGoalId = data.goalId ? data.goalId.slice(0, 8) : "——";

  return (
    <div
      className={[
        "relative bg-card/80 backdrop-blur",
        "border border-amber-500/60 rounded-xl px-2.5 py-2",
        "shadow-[0_0_20px_rgba(245,158,11,0.25)]",
        "w-[260px] min-h-[108px] flex flex-col justify-between overflow-hidden",
        "transition-all duration-300 ease-in-out",
      ].join(" ")}
    >
      {/* No target Handle — Queen is the root, no incoming edges */}

      {/* Top row: Crown icon + "Queen" label */}
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-[11px] font-semibold text-amber-300 truncate">
          Queen
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-amber-500/20 my-1" />

      {/* Bottom row: short goalId */}
      <div className="flex items-center">
        <span className="text-[10px] font-mono text-amber-400/70 truncate">
          {shortGoalId}
        </span>
      </div>

      {/* Source handle at bottom — dispatches to subtask roots */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-500/40 !w-2 !h-2 !border-background"
      />
    </div>
  );
}
