/**
 * WarRoomKanbanColumn — Per-agent droppable kanban column for Mission Control.
 * Phase 72 Plan 05: D-10 per-agent columns with drag-drop.
 */

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import AgentAvatar from "@/components/AgentAvatar";
import { WarRoomTaskCard } from "./WarRoomTaskCard";

export interface TaskItem {
  _id: string;
  id: string;
  taskId: string;
  title: string;
  description?: string;
  priority: string;
  agentId?: string;
  agentName?: string;
  labels?: string[];
  dueAt?: number;
  source?: string;
  progress?: number;
  createdAt: number;
}

export interface AgentColumn {
  agentId: string;
  agentName: string;
  avatar?: { name: string; emoji?: string; color?: string } | null;
}

export interface WarRoomKanbanColumnProps {
  agent: AgentColumn;
  tasks: TaskItem[];
  onCardClick?: (task: TaskItem) => void;
}

export function WarRoomKanbanColumn({
  agent,
  tasks,
  onCardClick,
}: WarRoomKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: agent.agentId });

  return (
    <div
      className={`flex flex-col w-72 flex-shrink-0 rounded-xl overflow-hidden ${
        isOver
          ? "border-2 border-dashed border-[var(--speaking-ring)] bg-(--accent)/30"
          : "border border-(--border)"
      }`}
    >
      {/* Column header */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-(--border)">
        <AgentAvatar
          avatar={agent.avatar ?? { name: agent.agentName }}
          status="active"
          size="sm"
        />
        <span className="text-sm font-semibold">{agent.agentName}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {tasks.length}
        </span>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 flex flex-col gap-2 min-h-[200px] overflow-y-auto"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <WarRoomTaskCard
              key={task.id}
              task={task}
              onClick={onCardClick}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-4">
            <p className="text-xs text-muted-foreground text-center py-4">
              No tasks
            </p>
            <p className="text-xs text-muted-foreground text-center">
              Drag a task here or create one from conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
