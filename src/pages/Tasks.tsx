/**
 * Tasks — merged board: "By Status" Kanban view + "By Agent" per-agent view.
 * Phase 96 Plan 04 (D-01/D-02): Mission Control folded into Tasks with a
 * ?view=-synced segmented control; typed api.tasks.* (previously untyped, F10);
 * <PageHeader> migration (F7); the old height-capped wrapper is removed (F7).
 *
 * Drag to action columns (running/cancelled) shows confirmation toast before WS command.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useCommandDispatch } from "@/hooks/useCommandDispatch";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useAvatars } from "@/hooks/useAvatars";
import { useRosterAgents } from "@/hooks/useRosterAgents";
import { PageHeader } from "@/components/PageHeader";
import { WSStatusIndicator } from "../components/WSStatusIndicator";
import { KanbanBoard } from "../components/KanbanBoard";
import { TaskDetail } from "../components/TaskDetail";
import { TaskCreateForm } from "../components/TaskCreateForm";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { WarRoomKanbanColumn, type TaskItem } from "../components/WarRoomKanbanColumn";
import { WarRoomTaskCard } from "../components/WarRoomTaskCard";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { useReducedMotion } from "motion/react";
import { ACTION_COLUMNS, TASK_COLUMNS, type TaskColumn, type KanbanTask, type NewTask, type TaskPriority } from "../types/kanban";

type BoardView = "status" | "agent";

// Fallback roster shown when no agentProfiles are configured yet (mirrors the
// pre-merge MissionControl.tsx default so the By Agent view degrades gracefully).
const FALLBACK_AGENTS = [
  { profileId: "astrid", name: "Astridr", avatar: undefined },
  { profileId: "hervor", name: "Hervor", avatar: undefined },
  { profileId: "gondul", name: "Gondul", avatar: undefined },
  { profileId: "freya", name: "Freya", avatar: undefined },
  { profileId: "ragnhildr", name: "Ragnhildr", avatar: undefined },
];

/**
 * Quiet segmented control (UI-SPEC: accent only on the active segment, must
 * not compete with the board for attention). Synced to ?view= by the caller.
 */
function ViewToggle({ view, onChange }: { view: BoardView; onChange: (v: BoardView) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
      <button
        type="button"
        aria-pressed={view === "status"}
        onClick={() => onChange("status")}
        className={`px-2.5 py-1 text-sm rounded-md transition-colors ${
          view === "status"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        By Status
      </button>
      <button
        type="button"
        aria-pressed={view === "agent"}
        onClick={() => onChange("agent")}
        className={`px-2.5 py-1 text-sm rounded-md transition-colors ${
          view === "agent"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        By Agent
      </button>
    </div>
  );
}

export default function Tasks() {
  const { status } = useAstridrWS();
  const { dispatch } = useCommandDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const view: BoardView = searchParams.get("view") === "agent" ? "agent" : "status";

  function setView(next: BoardView) {
    const params = new URLSearchParams(searchParams);
    if (next === "agent") {
      params.set("view", "agent");
    } else {
      params.delete("view");
    }
    setSearchParams(params, { replace: true });
  }

  // ─── By Status: Convex tasks table — sole source of truth (D-05) ─────────
  const rawTasks = useQuery(api.tasks.listByColumn) ?? [];
  const moveColumn = useMutation(api.tasks.moveColumn);
  const createTask = useMutation(api.tasks.create);

  // Dialog state
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createColumn, setCreateColumn] = useState<TaskColumn>("backlog");
  const [createOpen, setCreateOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<NewTask> | null>(null);

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
            await moveColumn({ id: task._id as any, column: newColumn });
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
      await moveColumn({ id: task._id as any, column: newColumn });
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

  // ─── By Agent: folded-in Mission Control per-agent grouping (D-01) ───────
  const serverAgentTasks = useQuery(api.missionControl.listTasksByAgent);
  const agentProfiles = useQuery(api.agentProfiles.list) ?? [];
  const avatars = useAvatars();
  const { agents: rosterAgents } = useRosterAgents();
  const reassignTaskMutation = useMutation(api.missionControl.reassignTask);
  const [localAgentTasks, setLocalAgentTasks] = useState<TaskItem[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const shouldReduce = useReducedMotion();

  // Sync server tasks to local state (for optimistic updates). Convex
  // useQuery returns a stable reference, so depend on it directly rather
  // than a `?? []` literal (avoids an infinite update-depth loop).
  useEffect(() => {
    if (serverAgentTasks === undefined) return;
    setLocalAgentTasks(
      serverAgentTasks.map((t: any) => ({
        ...t,
        id: t.taskId,
        source: t.source,
        progress: t.progress,
      }))
    );
  }, [serverAgentTasks]);

  // Sensor configuration (12px activation constraint per UI-SPEC)
  const agentSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Determine column source
  const agents = agentProfiles.length > 0 ? agentProfiles : FALLBACK_AGENTS;

  const avatarMap = useMemo(() => {
    const map: Record<string, (typeof avatars)[number]> = {};
    for (const a of avatars) {
      map[a._id] = a;
    }
    return map;
  }, [avatars]);

  // Group tasks by agentId
  const tasksByAgent = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const agent of agents) {
      map.set(agent.profileId, []);
    }
    for (const task of localAgentTasks) {
      if (task.agentId) {
        const list = map.get(task.agentId) ?? [];
        list.push(task);
        map.set(task.agentId, list);
      }
    }
    return map;
  }, [localAgentTasks, agents]);

  // Drag handlers with optimistic update + rollback
  function handleAgentDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleAgentDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newAgentId = over.id as string;

    const task = localAgentTasks.find((t) => t.id === taskId);
    if (!task || task.agentId === newAgentId) return;

    // Capture previous state BEFORE optimistic update
    const previousAgentId = task.agentId;
    const previousAgentName = task.agentName;

    const targetAgent = agents.find((a) => a.profileId === newAgentId);
    const newAgentName = targetAgent?.name ?? newAgentId;

    // Optimistic update
    setLocalAgentTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, agentId: newAgentId, agentName: newAgentName }
          : t
      )
    );

    try {
      await reassignTaskMutation({
        taskId: task._id as any,
        newAgentId,
        newAgentName,
      });
      toast.success(`Task reassigned to ${newAgentName}.`);
    } catch {
      // Rollback
      setLocalAgentTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, agentId: previousAgentId, agentName: previousAgentName }
            : t
        )
      );
      toast.error(
        `Reassignment failed. Card returned to ${previousAgentName ?? previousAgentId}.`
      );
    }
  }

  // Active drag card for DragOverlay
  const activeDragTask = activeDragId
    ? localAgentTasks.find((t) => t.id === activeDragId)
    : null;

  return (
    <div className="flex flex-col h-full px-4 py-3">
      <PageHeader
        title="Tasks"
        actions={
          <div className="flex items-center gap-3">
            <ViewToggle view={view} onChange={setView} />
            <WSStatusIndicator status={status} />
          </div>
        }
      />

      {view === "status" ? (
        rawTasks !== undefined && tasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <p className="text-base font-semibold text-(--foreground)">No tasks yet</p>
            <p className="text-base text-(--muted-foreground)">
              Create a task with the + button in any column, or convert an ideation finding.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <KanbanBoard
              tasks={tasks}
              onMoveTask={handleMoveTask}
              onAddTask={handleAddTask}
              onTaskClick={handleTaskClick}
            />
          </div>
        )
      ) : (
        <div className="flex-1 overflow-hidden">
          <SectionErrorBoundary name="Tasks — By Agent">
            <DndContext
              sensors={agentSensors}
              collisionDetection={closestCorners}
              onDragStart={handleAgentDragStart}
              onDragEnd={handleAgentDragEnd}
            >
              <div className="overflow-y-auto h-full pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 px-2">
                  {agents.map((agent) => {
                    const avatarId = "avatarId" in agent ? agent.avatarId : undefined;
                    const av = avatarId ? avatarMap[avatarId] : null;
                    const rosterAgent = rosterAgents.find((ra) => ra.id === agent.profileId || ra.name === agent.name);
                    const description = rosterAgent?.description;
                    let role = "Autonomous Agent";
                    if (description) {
                      const match = description.match(/^([A-Za-z0-9\s&]+?)\s*[—–-]/);
                      if (match) {
                        role = match[1].trim();
                      } else {
                        role = description.split(" — ")[0].split("-")[0].trim();
                      }
                    }
                    return (
                      <div key={agent.profileId}>
                        <WarRoomKanbanColumn
                          agent={{
                            agentId: agent.profileId,
                            agentName: agent.name,
                            role: role,
                            avatar: av
                              ? { name: av.name, emoji: av.emoji, color: av.color, imageStorageId: av.imageStorageId }
                              : { name: agent.name },
                          }}
                          tasks={tasksByAgent.get(agent.profileId) ?? []}
                        />
                      </div>
                    );
                  })}
                  {agents.length === 0 && (
                    <div className="text-base text-muted-foreground py-8 text-center w-full">
                      Could not load tasks. Refresh to retry.
                    </div>
                  )}
                </div>
              </div>
              <DragOverlay>
                {activeDragTask && (
                  <div
                    className={
                      shouldReduce
                        ? "opacity-100"
                        : "opacity-90 shadow-lg"
                    }
                  >
                    <WarRoomTaskCard task={activeDragTask} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </SectionErrorBoundary>
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
        }}
      />
    </div>
  );
}
