/**
 * KanbanColumn — single droppable column for the Kanban board.
 * Uses @dnd-kit/core useDroppable + @dnd-kit/sortable SortableContext.
 * Phase 56 Plan 04: CPCC-04.
 */

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { KanbanCard } from "./KanbanCard";
import type { KanbanTask, TaskColumn } from "../types/kanban";

interface KanbanColumnProps {
  column: TaskColumn;
  label: string;
  tasks: KanbanTask[];
  onCardClick: (task: KanbanTask) => void;
  onCreateTask: (column: TaskColumn) => void;
}

export function KanbanColumn({
  column,
  label,
  tasks,
  onCardClick,
  onCreateTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column });

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2 mb-2">
        <span className="text-xs text-(--muted-foreground) font-semibold tracking-wider uppercase">
          {label}
          <span className="ml-2 text-(--muted-foreground) font-normal">{tasks.length}</span>
        </span>
        <button
          onClick={() => onCreateTask(column)}
          className="w-5 h-5 flex items-center justify-center text-(--muted-foreground) hover:text-(--foreground) transition-colors"
          aria-label={`Create task in ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 bg-(--muted) p-2 flex flex-col gap-2 min-h-[200px] transition-colors ${
          isOver ? "ring-1 ring-(--primary)" : ""
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} onClick={onCardClick} />
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
