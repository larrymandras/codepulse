/**
 * TaskDetail — dialog showing all task fields including linked finding.
 * Shows Origin section with finding badge if task has findingId.
 * Phase 04 Plan 06: finding link display, rich fields, column move selector.
 */

import type { KanbanTask, TaskColumn } from "../types/kanban";
import { TASK_COLUMNS } from "../types/kanban";
import { formatRelativeTime } from "../lib/time";

interface TaskDetailProps {
  task: KanbanTask | null;
  open: boolean;
  onClose: () => void;
  onMove?: (taskId: string, column: TaskColumn) => void;
}

const COLUMN_LABELS: Record<TaskColumn, string> = {
  backlog: "Backlog",
  queued: "Queued",
  running: "Running",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

const PRIORITY_COLORS: Record<KanbanTask["priority"], string> = {
  high: "bg-(--status-error)",
  medium: "bg-(--status-warn)",
  low: "bg-(--status-ok)",
};

export function TaskDetail({ task, open, onClose, onMove }: TaskDetailProps) {
  if (!open || !task) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      {/* Dialog panel */}
      <div
        className="bg-(--card) border border-(--border) w-full max-w-lg mx-4 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
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
          {/* Priority */}
          <div className="flex items-center gap-2">
            <span className="text-(--muted-foreground) w-24 flex-shrink-0">Priority</span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-sm text-(--foreground) uppercase ${PRIORITY_COLORS[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-(--muted-foreground) w-24 flex-shrink-0">Status</span>
            <span className="text-(--foreground)">{COLUMN_LABELS[task.column]}</span>
          </div>

          {/* Agent */}
          {task.agentName && (
            <div className="flex items-center gap-2">
              <span className="text-(--muted-foreground) w-24 flex-shrink-0">Agent</span>
              <span className="text-(--foreground)">{task.agentName}</span>
            </div>
          )}

          {/* Labels */}
          {task.labels && task.labels.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-(--muted-foreground) w-24 flex-shrink-0 pt-0.5">Labels</span>
              <div className="flex flex-wrap gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="text-[10px] px-1.5 py-0.5 bg-(--muted) text-(--muted-foreground) border border-(--border)"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Due date */}
          {task.dueAt && (
            <div className="flex items-center gap-2">
              <span className="text-(--muted-foreground) w-24 flex-shrink-0">Due</span>
              <span className="text-(--foreground)">
                {new Date(task.dueAt * 1000).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Time in column */}
          <div className="flex items-center gap-2">
            <span className="text-(--muted-foreground) w-24 flex-shrink-0">In column</span>
            <span className="text-(--foreground)">{formatRelativeTime(task.columnEnteredAt)}</span>
          </div>

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

          {/* Origin — linked finding (D-07 bidirectional linking) */}
          {task.findingId && (
            <div className="mt-4 pt-4 border-t border-(--border)">
              <p className="text-xs font-semibold uppercase tracking-wide text-(--muted-foreground) mb-2">Origin</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1 py-0.5 bg-(--status-warn)/20 text-(--status-warn)">Finding</span>
                <span className="text-sm text-(--foreground)">Linked finding: {task.findingId}</span>
              </div>
            </div>
          )}
        </div>

        {/* Move to column selector */}
        {onMove && (
          <div className="pt-2 border-t border-(--border)">
            <label className="text-xs font-medium text-(--muted-foreground) uppercase tracking-wider block mb-1">
              Move to
            </label>
            <select
              value={task.column}
              onChange={(e) => onMove(task.id, e.target.value as TaskColumn)}
              className="bg-(--background) border border-(--border) text-(--foreground) text-sm px-3 py-2 outline-none focus:ring-1 focus:ring-(--primary) w-full"
            >
              {TASK_COLUMNS.map((col) => (
                <option key={col} value={col}>
                  {COLUMN_LABELS[col]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-(--border)">
          <button
            onClick={onClose}
            className="text-sm text-(--muted-foreground) hover:text-(--foreground) px-3 py-1.5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
