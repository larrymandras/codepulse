/**
 * Tasks — Kanban board page with drag-and-drop task management.
 * Backed by Convex commandExecutions table, supplemented by locally created tasks.
 * Phase 56 Plan 04: CPCC-04.
 */

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { KanbanBoard } from "../components/KanbanBoard";
import { TaskDetail } from "../components/TaskDetail";
import { TaskCreateForm } from "../components/TaskCreateForm";
import { toast } from "sonner";
import type { KanbanTask, NewTask, TaskColumn } from "../types/kanban";

// Map commandExecution status -> Kanban column
function statusToColumn(status: string): TaskColumn {
  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "failed") return "cancelled";
  return "done";
}

// Map commandExecution priority field if present, else default to medium
function derivePriority(toolName: string): KanbanTask["priority"] {
  if (toolName.toLowerCase().includes("estop") || toolName.toLowerCase().includes("security")) {
    return "high";
  }
  if (toolName.toLowerCase().includes("cron") || toolName.toLowerCase().includes("config")) {
    return "medium";
  }
  return "low";
}

export default function Tasks() {
  const { status, sendCommand } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  // Convex-backed executions
  const executions = useQuery(api.commandExecutions.listExecutions, {});

  // Local tasks created from the board (supplement Convex data)
  const [localTasks, setLocalTasks] = useState<KanbanTask[]>([]);

  // Dialog state
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createColumn, setCreateColumn] = useState<TaskColumn>("backlog");
  const [createOpen, setCreateOpen] = useState(false);

  // Derive tasks from Convex + local
  const convexTasks: KanbanTask[] = (executions ?? []).map((exec) => ({
    id: exec.executionId,
    title: exec.toolName,
    description: exec.errorMessage ?? undefined,
    priority: derivePriority(exec.toolName),
    column: statusToColumn(exec.status),
    agentId: exec.profileId,
    agentName: exec.origin !== "internal" ? exec.origin : undefined,
    columnEnteredAt: exec.startedAt ?? exec.queuedAt,
    createdAt: exec.queuedAt,
  }));

  // Merge: local tasks take precedence for same IDs (for column moves)
  const localIds = new Set(localTasks.map((t) => t.id));
  const tasks: KanbanTask[] = [
    ...localTasks,
    ...convexTasks.filter((t) => !localIds.has(t.id)),
  ];

  const handleTasksChange = useCallback((updated: KanbanTask[]) => {
    // Persist optimistic column moves in local state
    setLocalTasks((prev) => {
      const allIds = new Set(updated.map((t) => t.id));
      const convexIds = new Set(convexTasks.map((t) => t.id));

      // Track IDs that are purely local (never came from Convex)
      const newLocalIds = new Set(prev.filter((t) => !convexIds.has(t.id)).map((t) => t.id));

      // Keep only local tasks that are in updated list
      const prevLocalById = new Map(prev.map((t) => [t.id, t]));
      const result: KanbanTask[] = [];

      for (const task of updated) {
        const prevLocal = prevLocalById.get(task.id);
        const isConvex = convexIds.has(task.id);

        if (prevLocal) {
          result.push(task); // update local
        } else if (isConvex) {
          // Track column change for Convex tasks in local override
          const convexTask = convexTasks.find((t) => t.id === task.id);
          if (convexTask && convexTask.column !== task.column) {
            result.push(task); // override column
          }
        } else {
          result.push(task);
        }
      }

      // Keep local-only tasks that weren't in updated
      for (const t of prev) {
        if (!allIds.has(t.id)) result.push(t);
      }

      // Prune stale overrides: if Convex has caught up to the local column,
      // drop the local copy so it no longer shadows the Convex record (WR-06 fix).
      return result.filter((t) => {
        const convexTask = convexTasks.find((c) => c.id === t.id);
        if (convexTask && convexTask.column === t.column && !newLocalIds.has(t.id)) {
          return false; // Convex already reflects this override — safe to drop
        }
        return true;
      });
    });

    // Emit task move via WS (fire-and-forget)
    // Since there's no task.move command yet, we use agent.send_task as a signal
    // This is best-effort — the Kanban is primarily client-side state
  }, [convexTasks]);

  const handleCreateTask = useCallback(
    async (newTask: NewTask, column: TaskColumn) => {
      const now = Date.now() / 1000;
      const task: KanbanTask = {
        id: crypto.randomUUID(),
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        column,
        agentId: newTask.agentId,
        agentName: newTask.agentName,
        columnEnteredAt: now,
        createdAt: now,
      };

      setLocalTasks((prev) => [task, ...prev]);
      setCreateOpen(false);

      // Send task to Ástríðr if an agent is assigned
      if (newTask.agentId && status === "connected") {
        try {
          await sendCommand({
            type: "agent.send_task",
            agent_id: newTask.agentId,
            task: newTask.title,
          });
          triggerFlash();
        } catch {
          // Non-fatal — task already added locally
        }
      }

      toast("Task created.");
    },
    [sendCommand, status]
  );

  const handleCardClick = useCallback((task: KanbanTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  }, []);

  const handleCreateOpen = useCallback((column: TaskColumn) => {
    setCreateColumn(column);
    setCreateOpen(true);
  }, []);

  const allEmpty = tasks.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) flex-shrink-0">
        <h1 className="text-lg font-semibold text-(--foreground)">Tasks</h1>
        <WSStatusIndicator status={status} />
      </div>

      {/* Board or empty state */}
      {allEmpty && executions !== undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-(--muted-foreground)">
            No tasks yet. Create one with the + button.
          </p>
        </div>
      ) : (
        <div ref={flashRef} className="flex-1 overflow-hidden">
          <KanbanBoard
            tasks={tasks}
            onTasksChange={handleTasksChange}
            onCardClick={handleCardClick}
            onCreateTask={handleCreateOpen}
          />
        </div>
      )}

      {/* Dialogs */}
      <TaskDetail
        task={selectedTask}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
      <TaskCreateForm
        open={createOpen}
        defaultColumn={createColumn}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}
