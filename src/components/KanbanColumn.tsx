/**
 * KanbanColumn — single droppable column for the Kanban board.
 * Supports 6 columns with auto-collapse/expand behavior.
 * Phase 04 Plan 02: collapsible empty columns (D-02).
 */

import { useState, useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import type { KanbanTask, TaskColumn } from "../types/kanban";

const COLUMN_LABELS: Record<TaskColumn, string> = {
  backlog: "Backlog",
  queued: "Queued",
  running: "Running",
  review: "Review",
  done: "Done",
  cancelled: "Cancelled",
};

interface KanbanColumnProps {
  column: TaskColumn;
  tasks: KanbanTask[];
  onAddTask?: (column: TaskColumn) => void;
  onCardClick?: (task: KanbanTask) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onAddTask,
  onCardClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const prevTaskCount = useRef(tasks.length);

  const columnLabel = COLUMN_LABELS[column];

  useEffect(() => {
    // Collapse when tasks go from >0 to 0
    if (prevTaskCount.current > 0 && tasks.length === 0) {
      setIsCollapsed(true);
    }
    // Auto-expand when tasks arrive while collapsed
    if (tasks.length > 0 && isCollapsed) {
      setIsCollapsed(false);
    }
    prevTaskCount.current = tasks.length;
  }, [tasks.length, isCollapsed]);

  const showExpanded = !isCollapsed || isHovered;

  if (!showExpanded) {
    return (
      <div
        className="w-10 flex-shrink-0 border border-(--border) bg-(--muted)/20 transition-[width] duration-200 ease-in-out cursor-pointer flex items-center justify-center"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span
          className="text-[10px] uppercase tracking-wider text-(--muted-foreground) whitespace-nowrap"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          {columnLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col w-[260px] flex-shrink-0 bg-(--muted)/40 border transition-[width] duration-200 ease-in-out ${
        isOver
          ? "border-dashed border-(--primary) bg-(--accent)/30"
          : "border-(--border)"
      }`}
      onMouseEnter={() => isCollapsed && setIsHovered(true)}
      onMouseLeave={() => {
        if (isCollapsed && tasks.length === 0) {
          setIsHovered(false);
        }
      }}
    >
      {/* Column header */}
      <div className="px-3 py-2 border-b border-(--border) flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-(--muted-foreground)">
          {columnLabel}
          <span className="ml-2 font-normal">({tasks.length})</span>
        </span>
        <button
          onClick={() => onAddTask?.(column)}
          className="w-6 h-6 flex items-center justify-center text-(--muted-foreground) hover:bg-(--accent) transition-colors"
          aria-label={`Add task to ${columnLabel}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 flex flex-col gap-2 min-h-[200px]"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onClick={onCardClick ?? (() => {})}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center border border-dashed border-(--border) p-4">
            <span className="text-xs text-(--muted-foreground) text-center">
              Drop tasks here
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
