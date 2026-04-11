/**
 * KanbanCard — compact draggable task card for the Kanban board.
 * Uses @dnd-kit/sortable for drag behavior.
 * Phase 56 Plan 04: CPCC-04.
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KanbanTask } from "../types/kanban";
import { formatRelativeTime } from "../lib/time";

interface KanbanCardProps {
  task: KanbanTask;
  onClick: (task: KanbanTask) => void;
  /** When true, renders a static ghost (inside DragOverlay) */
  isOverlay?: boolean;
}

const PRIORITY_BADGE: Record<KanbanTask["priority"], string> = {
  high: "bg-(--status-error)",
  medium: "bg-(--status-warn)",
  low: "bg-(--status-ok)",
};

const PRIORITY_LABEL: Record<KanbanTask["priority"], string> = {
  high: "HIGH",
  medium: "MED",
  low: "LOW",
};

export function KanbanCard({ task, onClick, isOverlay = false }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isOverlay });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const cardContent = (
    <div
      className="bg-(--card) border border-(--border) p-2 rounded-none cursor-grab active:cursor-grabbing flex flex-col gap-1 select-none"
      onClick={() => onClick(task)}
    >
      {/* Title — truncated at 2 lines */}
      <p className="text-sm text-(--foreground) font-medium line-clamp-2 leading-snug">
        {task.title}
      </p>

      {/* Footer: agent avatar + timestamp + priority badge */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          {task.agentName && (
            <div
              className="w-4 h-4 rounded-full bg-(--primary) flex items-center justify-center flex-shrink-0"
              title={task.agentName}
            >
              <span className="text-[8px] font-bold text-(--primary-foreground) uppercase">
                {task.agentName.charAt(0)}
              </span>
            </div>
          )}
          <span className="text-xs text-(--muted-foreground)">
            {formatRelativeTime(task.createdAt)}
          </span>
        </div>

        {/* Priority badge */}
        <span
          className={`text-[10px] font-semibold px-1 py-0.5 rounded-sm text-(--foreground) ${PRIORITY_BADGE[task.priority]}`}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>
    </div>
  );

  if (isOverlay) {
    return cardContent;
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {cardContent}
    </div>
  );
}
