/**
 * TaskDetail — read-only dialog showing all task fields.
 * Edit is out of scope for Phase 56.
 * Phase 56 Plan 04: CPCC-04.
 */

import type { KanbanTask, TaskColumn } from "../types/kanban";
import { formatRelativeTime } from "../lib/time";

interface TaskDetailProps {
  task: KanbanTask | null;
  open: boolean;
  onClose: () => void;
}

const COLUMN_LABELS: Record<TaskColumn, string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_COLORS: Record<KanbanTask["priority"], string> = {
  high: "bg-(--status-error)",
  medium: "bg-(--status-warn)",
  low: "bg-(--status-ok)",
};

export function TaskDetail({ task, open, onClose }: TaskDetailProps) {
  if (!open || !task) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      {/* Dialog panel */}
      <div
        className="bg-(--card) border border-(--border) w-full max-w-lg mx-4 p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-(--foreground) leading-snug">
            {task.title}
          </h2>
          <button
            onClick={onClose}
            className="text-(--muted-foreground) hover:text-(--foreground) text-lg leading-none mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3 text-sm">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-(--muted-foreground) w-24 flex-shrink-0">Status</span>
            <span className="text-(--foreground)">{COLUMN_LABELS[task.column]}</span>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-2">
            <span className="text-(--muted-foreground) w-24 flex-shrink-0">Priority</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm text-(--foreground) uppercase ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>

          {/* Agent */}
          {task.agentName && (
            <div className="flex items-center gap-2">
              <span className="text-(--muted-foreground) w-24 flex-shrink-0">Agent</span>
              <span className="text-(--foreground)">{task.agentName}</span>
            </div>
          )}

          {/* Created */}
          <div className="flex items-center gap-2">
            <span className="text-(--muted-foreground) w-24 flex-shrink-0">Created</span>
            <span className="text-(--foreground)">{formatRelativeTime(task.createdAt)}</span>
          </div>

          {/* Description */}
          {task.description && (
            <div className="flex flex-col gap-1 pt-2 border-t border-(--border)">
              <span className="text-(--muted-foreground) text-xs font-medium uppercase tracking-wider">
                Description
              </span>
              <p className="text-(--foreground) leading-relaxed whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-(--border)">
          <span className="text-xs text-(--muted-foreground) italic">
            Read-only — editing deferred to a future phase
          </span>
        </div>
      </div>
    </div>
  );
}
