/**
 * KanbanBoard — 6-column DnD board with PointerSensor activation constraint.
 * Uses TASK_COLUMNS for column definitions and validates drop targets against
 * the known column list (T-04-03 threat mitigation).
 * Phase 04 Plan 02.
 */

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { TASK_COLUMNS, type TaskColumn, type KanbanTask } from "../types/kanban";

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onMoveTask: (taskId: string, newColumn: TaskColumn) => void;
  onAddTask?: (column: TaskColumn) => void;
  onTaskClick?: (task: KanbanTask) => void;
  /** Legacy: called when tasks are reordered within a column */
  onTasksChange?: (tasks: KanbanTask[]) => void;
}

export function KanbanBoard({
  tasks,
  onMoveTask,
  onAddTask,
  onTaskClick,
  onTasksChange,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Validate target column against TASK_COLUMNS (T-04-03)
    const overColumn = TASK_COLUMNS.find((c) => c === overId);
    if (overColumn) {
      const draggedTask = tasks.find((t) => t.id === activeId);
      if (draggedTask && draggedTask.column !== overColumn) {
        onMoveTask(activeId, overColumn);
      }
      return;
    }

    // Dropped over another card — move to that card's column
    const overTask = tasks.find((t) => t.id === overId);
    const activeTaskItem = tasks.find((t) => t.id === activeId);
    if (!overTask || !activeTaskItem) return;

    if (activeTaskItem.column !== overTask.column) {
      // Validate the target column is a known TASK_COLUMN (T-04-03)
      if (TASK_COLUMNS.includes(overTask.column)) {
        onMoveTask(activeId, overTask.column);
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const draggedTask = tasks.find((t) => t.id === activeId);
    const overTask = tasks.find((t) => t.id === overId);

    if (!draggedTask) return;

    // Validate column drop target against TASK_COLUMNS (T-04-03)
    const overColumn = TASK_COLUMNS.find((c) => c === overId);
    if (overColumn) {
      // Column change already handled in dragOver
      return;
    }

    if (!overTask) return;

    // Same-column reorder
    if (draggedTask.column === overTask.column && onTasksChange) {
      const colTasks = tasks.filter((t) => t.column === draggedTask.column);
      const oldIndex = colTasks.findIndex((t) => t.id === activeId);
      const newIndex = colTasks.findIndex((t) => t.id === overId);
      const reordered = arrayMove(colTasks, oldIndex, newIndex);
      const otherTasks = tasks.filter((t) => t.column !== draggedTask.column);
      onTasksChange([...otherTasks, ...reordered]);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
        {TASK_COLUMNS.map((col) => (
          <KanbanColumn
            key={col}
            column={col}
            tasks={tasks.filter((t) => t.column === col)}
            onAddTask={() => onAddTask?.(col)}
            onCardClick={onTaskClick}
          />
        ))}
      </div>

      {/* DragOverlay — ghost card at 95% scale with shadow */}
      <DragOverlay>
        {activeTask ? (
          <div className="scale-95 shadow-lg opacity-90">
            <KanbanCard task={activeTask} isDragging={false} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
