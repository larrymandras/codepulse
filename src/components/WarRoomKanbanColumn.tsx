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
  role?: string;
  avatar?: { name: string; emoji?: string; color?: string; imageStorageId?: any } | null;
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
      className={`flex flex-col w-full max-h-[80vh] flex-shrink-0 rounded-xl overflow-hidden transition-all duration-300 ${
        isOver
          ? "border-2 border-dashed border-primary bg-primary/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
          : "border border-border/50 glow-card hover:border-primary/50 shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
      }`}
    >
      {/* Column header */}
      <div className="p-4 flex items-center gap-4 border-b border-border/50 bg-background/50 backdrop-blur">
        <AgentAvatar
          avatar={agent.avatar ?? { name: agent.agentName }}
          status="active"
          size="lg"
        />
        <div className="flex flex-col">
          <span className="text-base font-bold text-foreground font-mono tracking-wide">{agent.agentName}</span>
          {agent.role && (
            <span className="text-sm text-muted-foreground/80 font-mono tracking-widest mt-0.5 uppercase">
              {agent.role}
            </span>
          )}
          <span className="text-xs text-primary/70 uppercase font-mono tracking-widest mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            Online
          </span>
        </div>
        <div className="ml-auto flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 text-primary border border-primary/20 text-sm font-mono">
          {tasks.length}
        </div>
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
            <p className="text-sm text-muted-foreground text-center py-4">
              No tasks
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Drag a task here or create one from conversation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
