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
      className={`group relative p-4 rounded-lg border-l-[3px] ${PRIORITY_BORDER[task.priority] ?? ""} bg-card/80 backdrop-blur border border-border/50 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:border-primary/50 transition-all duration-300 ${isDragging ? "opacity-50 scale-95 shadow-xl" : "hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(16,185,129,0.15)]"}`}
      onClick={() => onClick?.(task)}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-background/80 to-transparent rounded-l-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="10" height="18" viewBox="0 0 6 14" fill="currentColor" className="text-primary/50 group-hover:text-primary transition-colors">
          <circle cx="1" cy="1" r="1" /><circle cx="5" cy="1" r="1" />
          <circle cx="1" cy="5" r="1" /><circle cx="5" cy="5" r="1" />
          <circle cx="1" cy="9" r="1" /><circle cx="5" cy="9" r="1" />
          <circle cx="1" cy="13" r="1" /><circle cx="5" cy="13" r="1" />
        </svg>
      </div>

      {/* Row 1: title + priority badge */}
      <div className="flex flex-col gap-1.5 pl-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-foreground/90 leading-tight line-clamp-2">{task.title}</span>
          <div className="shrink-0 scale-90 origin-top-right">
            <StatusBadge status={task.priority} />
          </div>
        </div>

        {/* Row 2: description snippet */}
        {task.description && (
          <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2 mt-1 font-mono">
            {task.description}
          </p>
        )}

        {/* Row 3: source badge + due date */}
        <div className="flex items-center gap-2 mt-3">
          {task.source && (
            <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-mono bg-primary/5 text-primary border-primary/20 tracking-wider uppercase">
              {task.source}
            </Badge>
          )}
          {task.dueAt && (
            <span className="text-[10px] font-mono text-muted-foreground/60 ml-auto tracking-widest uppercase">
              {new Date(task.dueAt * 1000).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Row 4: progress bar */}
        {task.progress !== undefined && (
          <div className="h-1.5 bg-muted/50 mt-3 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-primary rounded-full relative shadow-[0_0_10px_rgba(16,185,129,0.8)]"
              style={{ width: `${Math.min(task.progress, 100)}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full animate-scanline" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
