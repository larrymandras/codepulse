/**
 * Tasks — Kanban board page wired to Convex tasks table.
 * Drag to action columns (running/cancelled) shows confirmation toast before WS command.
 * Phase 04 Plan 06: wire Convex tasks, drag confirmation, WS dispatch.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { anyApi } from "convex/server";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { KanbanBoard } from "../components/KanbanBoard";
import { TaskDetail } from "../components/TaskDetail";
import { TaskCreateForm } from "../components/TaskCreateForm";
import { toast } from "sonner";
import { ACTION_COLUMNS, TASK_COLUMNS, type TaskColumn, type KanbanTask, type NewTask, type TaskPriority } from "../types/kanban";

export default function Tasks() {
  const { status } = useAstridrWS();
  const { dispatch } = useCommandDispatch();

  // Convex tasks table — sole source of truth (D-05)
  const rawTasks = useQuery(anyApi.tasks.listByColumn);
  const moveColumn = useMutation(anyApi.tasks.moveColumn);
  const createTask = useMutation(anyApi.tasks.create);

  // Dialog state
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createColumn, setCreateColumn] = useState<TaskColumn>("backlog");
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<NewTask> | null>(null);

  if (rawTasks === undefined) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-(--muted-foreground)">Loading tasks...</p>
      </div>
    );
  }

  // Map Convex documents to KanbanTask
  const tasks: KanbanTask[] = (rawTasks as any[]).map((t) => ({
    id: t.taskId,
    _id: t._id as string,
    title: t.title,
    description: t.description,
    priority: t.priority as TaskPriority,
    column: t.column as TaskColumn,
    agentId: t.agentId,
    agentName: t.agentName,
    labels: t.labels,
    dueAt: t.dueAt,
    columnEnteredAt: t.columnEnteredAt,
    findingId: t.findingId,
    createdAt: t.createdAt,
  }));

  // Validate column is known before any Convex/WS call (T-04-10 mitigation)
  async function handleMoveTask(taskId: string, newColumn: TaskColumn) {
    if (!TASK_COLUMNS.includes(newColumn)) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task._id) return;

    if (ACTION_COLUMNS.includes(newColumn)) {
      // Show confirmation toast with 5s timeout before WS command (D-04)
      toast(`${task.title} -> ${newColumn}. Send command to Astrid?`, {
        duration: 5000,
        action: {
          label: "Confirm",
          onClick: async () => {
            // Optimistic Convex update
            try {
              await moveColumn({ id: task._id as any, column: newColumn });
            } catch (e) {
              toast.error(`Failed to move task: ${e instanceof Error ? e.message : "Unknown error"}`);
              return;
            }
            // Send WS command to Astrid
            dispatch(
              { type: "task.move", task_id: taskId, column: newColumn },
              `Task moved to ${newColumn}.`
            );
          },
        },
        cancel: {
          label: "Cancel",
          onClick: () => { /* no-op, toast dismissed */ },
        },
      });
    } else {
      // Non-action columns: move immediately, no WS command
      try {
        await moveColumn({ id: task._id as any, column: newColumn });
      } catch (e) {
        toast.error(`Failed to move task: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }
  }

  function handleAddTask(column: TaskColumn) {
    setCreateColumn(column);
    setPrefillData(null);
    setCreateOpen(true);
  }

  function handleTaskClick(task: KanbanTask) {
    setSelectedTask(task);
    setDetailOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--border) flex-shrink-0">
        <h1 className="text-lg font-semibold text-(--foreground)">Tasks</h1>
        <WSStatusIndicator status={status} />
      </div>

      {/* Board or empty state */}
      {rawTasks !== undefined && tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-base font-semibold text-(--foreground)">No tasks yet</p>
          <p className="text-sm text-(--muted-foreground)">
            Create a task with the + button in any column, or convert an ideation finding.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden px-4 py-4">
          <KanbanBoard
            tasks={tasks}
            onMoveTask={handleMoveTask}
            onAddTask={handleAddTask}
            onTaskClick={handleTaskClick}
          />
        </div>
      )}

      {/* Task detail dialog */}
      <TaskDetail
        task={selectedTask}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onMove={handleMoveTask}
      />

      {/* Task create form */}
      <TaskCreateForm
        open={createOpen}
        defaultColumn={createColumn}
        prefillData={prefillData}
        onCancel={() => setCreateOpen(false)}
        onSubmit={async (newTask) => {
          try {
            await createTask({
              title: newTask.title,
              description: newTask.description,
              priority: newTask.priority,
              agentId: newTask.agentId,
              agentName: newTask.agentName,
              labels: newTask.labels,
              dueAt: newTask.dueAt,
              findingId: newTask.findingId as any,
            });
            setCreateOpen(false);
            toast("Task created.");
          } catch (e) {
            toast.error(`Failed to create task: ${e instanceof Error ? e.message : "Unknown error"}`);
          }
        }}
      />
    </div>
  );
}
