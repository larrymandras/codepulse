/**
 * KanbanCard — rich draggable task card for the Kanban board.
 * Shows priority stripe, labels, due date, time-in-column, agent avatar, finding badge.
 * Phase 04 Plan 02: rich card content (D-03).
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KanbanTask, TaskPriority } from "../types/kanban";

interface KanbanCardProps {
  task: KanbanTask;
  isDragging?: boolean;
  onClick?: (task: KanbanTask) => void;
}

const PRIORITY_BORDER: Record<TaskPriority, string> = {
  high: "border-l-(--status-error)",
  medium: "border-l-(--status-warn)",
  low: "border-l-(--status-ok)",
};

function formatTimeInColumn(enteredAt: number): string {
  const diff = Math.floor(Date.now() / 1000 - enteredAt);
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return "<1h";
}

export function KanbanCard({ task, isDragging = false, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardContent = (
    <div
      className={`bg-(--card) border border-(--border) border-l-2 ${PRIORITY_BORDER[task.priority]} p-3 rounded-none cursor-grab active:cursor-grabbing select-none ${isDragging || isSortableDragging ? "opacity-40" : ""}`}
      onClick={() => onClick?.(task)}
    >
      {/* Title */}
      <p className="text-sm font-medium line-clamp-2 leading-snug">{task.title}</p>

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {task.labels.map((label) => (
            <span
              key={label}
              className="text-[10px] px-1.5 py-0.5 bg-(--muted) text-(--muted-foreground)"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 mt-2 text-xs text-(--muted-foreground)">
        {/* Agent avatar */}
        {task.agentName && (
          <div
            className="w-4 h-4 rounded-full bg-(--primary) text-[8px] font-bold text-(--primary-foreground) flex items-center justify-center flex-shrink-0"
            title={task.agentName}
          >
            {task.agentName[0]?.toUpperCase()}
          </div>
        )}

        {/* Due date */}
        {task.dueAt && (
          <span>
            {new Date(task.dueAt * 1000).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}

        {/* Time in column */}
        <span className="ml-auto">{formatTimeInColumn(task.columnEnteredAt)}</span>

        {/* Finding badge */}
        {task.findingId && (
          <span className="text-[10px] px-1 py-0.5 bg-(--status-warn)/20 text-(--status-warn)">
            Finding
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {cardContent}
    </div>
  );
}
