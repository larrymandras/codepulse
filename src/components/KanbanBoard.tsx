/**
 * KanbanBoard — 3-column DnD board with DragOverlay ghost card.
 * Wraps everything in DndContext with closestCenter collision detection.
 * Phase 56 Plan 04: CPCC-04.
 */

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import type { KanbanTask, TaskColumn } from "../types/kanban";

const COLUMNS: { id: TaskColumn; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];

interface KanbanBoardProps {
  tasks: KanbanTask[];
  onTasksChange: (tasks: KanbanTask[]) => void;
  onCardClick: (task: KanbanTask) => void;
  onCreateTask: (column: TaskColumn) => void;
}

export function KanbanBoard({
  tasks,
  onTasksChange,
  onCardClick,
  onCreateTask,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  const getTasksByColumn = (col: TaskColumn) =>
    tasks.filter((t) => t.column === col);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column (not a card)
    const overColumn = COLUMNS.find((c) => c.id === overId);
    if (overColumn) {
      const activeTask = tasks.find((t) => t.id === activeId);
      if (activeTask && activeTask.column !== overColumn.id) {
        onTasksChange(
          tasks.map((t) =>
            t.id === activeId ? { ...t, column: overColumn.id } : t
          )
        );
      }
      return;
    }

    // Dropped over another card — move to that card's column
    const overTask = tasks.find((t) => t.id === overId);
    const activeTaskItem = tasks.find((t) => t.id === activeId);
    if (!overTask || !activeTaskItem) return;

    if (activeTaskItem.column !== overTask.column) {
      // Cross-column move
      onTasksChange(
        tasks.map((t) =>
          t.id === activeId ? { ...t, column: overTask.column } : t
        )
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeTask = tasks.find((t) => t.id === activeId);
    const overTask = tasks.find((t) => t.id === overId);

    if (!activeTask) return;

    // If dropped on a column droppable, column change already handled in dragOver
    const overColumn = COLUMNS.find((c) => c.id === overId);
    if (overColumn) return;

    if (!overTask) return;

    // Same column reorder
    if (activeTask.column === overTask.column) {
      const colTasks = getTasksByColumn(activeTask.column);
      const oldIndex = colTasks.findIndex((t) => t.id === activeId);
      const newIndex = colTasks.findIndex((t) => t.id === overId);
      const reordered = arrayMove(colTasks, oldIndex, newIndex);

      // Rebuild full tasks array with reordered column
      const otherTasks = tasks.filter((t) => t.column !== activeTask.column);
      onTasksChange([...otherTasks, ...reordered]);
    }
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-8 overflow-x-auto h-full p-4">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col.id}
            label={col.label}
            tasks={getTasksByColumn(col.id)}
            onCardClick={onCardClick}
            onCreateTask={onCreateTask}
          />
        ))}
      </div>

      {/* Drag overlay — ghost card at 90% opacity, scale(1.02), shadow-lg */}
      <DragOverlay>
        {activeTask ? (
          <div
            style={{ opacity: 0.9, transform: "scale(1.02)" }}
            className="shadow-lg"
          >
            <KanbanCard task={activeTask} onClick={() => {}} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
