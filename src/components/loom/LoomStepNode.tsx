/**
 * LoomStepNode — one step in a curated pipeline (Phase 119).
 *
 * Follows AgentTopology/SwarmGraph's custom-node idiom (registered through
 * `nodeTypes`, Handles on both sides). Colour comes entirely from
 * `STEP_STATE_COLOR`, so every visual state is a CSS var and the
 * error-vs-complete distinction the design doc's gate requires lives in one
 * tested place rather than in this component.
 */
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Circle } from "lucide-react";
import { iconComponents } from "@/lib/navRegistry";
import { STEP_STATE_COLOR, type StepState } from "@/lib/loomStepState";

export interface LoomStepNodeData extends Record<string, unknown> {
  label: string;
  icon?: string;
  state: StepState;
  isCurrent: boolean;
}

export default function LoomStepNode({ data }: NodeProps) {
  const { label, icon, state, isCurrent } = data as LoomStepNodeData;
  const color = STEP_STATE_COLOR[state];
  const Icon = (icon && iconComponents[icon]) || Circle;

  return (
    <div
      data-testid={`loom-step-${state}`}
      className="bg-card flex min-w-40 items-center gap-2 rounded-md border px-3 py-2"
      style={{
        borderColor: color,
        // Only the actively-running step glows. A finished pipeline should not
        // look like it is still working.
        boxShadow: isCurrent && state === "running" ? "var(--glow-sm)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Icon className="h-4 w-4 shrink-0" style={{ color }} />
      <span className="truncate font-mono text-xs font-bold tracking-wide">
        {label}
      </span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
