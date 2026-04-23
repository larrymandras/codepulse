/**
 * WarRoomTaskCard — Rich draggable task card for Mission Control kanban.
 * Phase 72 Plan 05: D-11 rich task cards with priority, description, source, progress.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import type { TaskItem } from "./WarRoomKanbanColumn";

export interface WarRoomTaskCardProps {
  task: TaskItem;
  onClick?: (task: TaskItem) => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  critical: "border-l-(--status-error)",
  high: "border-l-(--status-error)",
  normal: "border-l-(--status-warn)",
  low: "border-l-(--status-ok)",
};

export function WarRoomTaskCard({ task, onClick }: WarRoomTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`group relative p-4 rounded-lg border-l-2 ${PRIORITY_BORDER[task.priority] ?? ""} bg-(--card) border border-(--border) hover:border-(--ring) transition-colors ${isDragging ? "opacity-50" : ""}`}
      onClick={() => onClick?.(task)}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-60 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="6" height="14" viewBox="0 0 6 14" fill="currentColor" className="text-muted-foreground">
          <circle cx="1" cy="1" r="1" /><circle cx="5" cy="1" r="1" />
          <circle cx="1" cy="5" r="1" /><circle cx="5" cy="5" r="1" />
          <circle cx="1" cy="9" r="1" /><circle cx="5" cy="9" r="1" />
          <circle cx="1" cy="13" r="1" /><circle cx="5" cy="13" r="1" />
        </svg>
      </div>

      {/* Row 1: title + priority badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium line-clamp-2">{task.title}</span>
        <StatusBadge status={task.priority} />
      </div>

      {/* Row 2: description snippet */}
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Row 3: source badge + due date */}
      <div className="flex items-center gap-2 mt-2">
        {task.source && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
            {task.source}
          </Badge>
        )}
        {task.dueAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(task.dueAt * 1000).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Row 4: progress bar */}
      {task.progress !== undefined && (
        <div className="h-1 bg-(--muted) mt-2 rounded-full">
          <div
            className="h-1 bg-(--primary) rounded-full"
            style={{ width: `${Math.min(task.progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
