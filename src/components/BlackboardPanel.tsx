/**
 * BlackboardPanel — live subtask board filtered by goalId.
 *
 * Phase 149-04 — PULSE-04.
 * Composes EntityRow + StatusBadge + SectionHeader to show live swarm task rows.
 * Data sourced from useSwarmGraph(goalId) (Plan 03).
 */

import {
  Clock,
  ArrowRight,
  Zap,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ShieldX,
  ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EntityRow } from "./EntityRow";
import StatusBadge from "./StatusBadge";
import { useSwarmGraph } from "../hooks/useSwarmGraph";

// ── State icon mapping (mirrors SwarmTaskNode state icons) ──────────────────
const stateIcon: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />,
  claimed: <ArrowRight className="h-3.5 w-3.5 text-primary/60" />,
  running: <Zap className="h-3.5 w-3.5 text-[#22c55e] animate-pulse" />,
  verifying: <ShieldCheck className="h-3.5 w-3.5 text-primary" />,
  done: <CheckCircle className="h-3.5 w-3.5 text-primary/80" />,
  failed: <XCircle className="h-3.5 w-3.5 text-[#ef4444]" />,
  verify_rejected: <ShieldX className="h-3.5 w-3.5 text-[#ef4444]" />,
};

// Format elapsed time from a timestamp (ms epoch) to a short string
function formatElapsed(timestamp: number | undefined, updatedAt?: number): string {
  const now = Date.now();
  const ref = updatedAt ?? timestamp;
  if (!ref) return "";
  const diffMs = now - ref;
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

interface BlackboardPanelProps {
  goalId: string | null | undefined;
  /** If true, shows the "No tasks found for this goal." empty state instead of "Waiting for tasks" */
  completedGoal?: boolean;
}

export default function BlackboardPanel({ goalId, completedGoal = false }: BlackboardPanelProps) {
  const tasks = useSwarmGraph(goalId);
  const taskCount = tasks.length;

  return (
    <div>
      {/* Header: BLACKBOARD label + live-pulse dot + task count badge */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          BLACKBOARD
        </h2>
        <Badge variant="outline" className="text-[10px] font-mono">
          {taskCount} tasks
        </Badge>
      </div>

      {/* Task list */}
      {taskCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-2 text-center">
          <ClipboardList className="h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs font-medium text-foreground">
            {completedGoal ? "No tasks found for this goal." : "Waiting for tasks"}
          </p>
          {!completedGoal && (
            <p className="text-xs text-muted-foreground">
              Subtasks will appear here once the Queen begins decomposition.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[160px]">
          {tasks.map((task) => {
            const elapsed = formatElapsed(task.timestamp, task.updatedAt);
            return (
              <EntityRow
                key={task.subtaskId}
                icon={stateIcon[task.state] ?? <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />}
                primary={task.subtask}
                secondary={task.claimedBy}
                trailing={
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={task.state} />
                    {elapsed && (
                      <span className="text-[10px] font-mono text-muted-foreground">{elapsed}</span>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
