/**
 * Mission Control — per-agent kanban with drag-drop task reassignment.
 * Phase 72 Plan 05: D-10 per-agent columns, D-11 rich task cards, D-12 optimistic drag-drop.
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAvatars } from "@/hooks/useAvatars";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { WarRoomKanbanColumn, TaskItem } from "@/components/WarRoomKanbanColumn";
import { WarRoomTaskCard } from "@/components/WarRoomTaskCard";
import { toast } from "sonner";
import { useReducedMotion } from "motion/react";

const FALLBACK_AGENTS = [
  { profileId: "astrid", name: "Astridr", avatar: undefined },
  { profileId: "hervor", name: "Hervor", avatar: undefined },
  { profileId: "gondul", name: "Gondul", avatar: undefined },
  { profileId: "freya", name: "Freya", avatar: undefined },
  { profileId: "ragnhildr", name: "Ragnhildr", avatar: undefined },
];

const ROLE_MAP: Record<string, string> = {
  astrid: "System Orchestrator",
  hervor: "Security Specialist",
  gondul: "Data Architect",
  freya: "Creative Director",
  ragnhildr: "Infrastructure Lead",
  brynhildr: "Frontend Engineer",
  skuld: "Backend Engineer",
  hildr: "QA & Testing",
  idunn: "DevOps Engineer",
  urdr: "Product Manager",
  verdandi: "Scrum Master",
};

export default function MissionControl() {
  const serverTasks = useQuery(api.missionControl.listTasksByAgent) ?? [];
  const agentProfiles = useQuery(api.agentProfiles.list) ?? [];
  const avatars = useAvatars();
  const reassignTaskMutation = useMutation(api.missionControl.reassignTask);
  const [localTasks, setLocalTasks] = useState<TaskItem[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const shouldReduce = useReducedMotion();

  // Sync server tasks to local state (for optimistic updates)
  useEffect(() => {
    setLocalTasks(
      serverTasks.map((t: any) => ({
        ...t,
        id: t.taskId,
        source: t.source,
        progress: t.progress,
      }))
    );
  }, [serverTasks]);

  // Sensor configuration (12px activation constraint per UI-SPEC)
  const sensors = useSensors(
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
    for (const task of localTasks) {
      if (task.agentId) {
        const list = map.get(task.agentId) ?? [];
        list.push(task);
        map.set(task.agentId, list);
      }
    }
    return map;
  }, [localTasks, agents]);

  // Drag handlers with optimistic update + rollback
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newAgentId = over.id as string;

    const task = localTasks.find((t) => t.id === taskId);
    if (!task || task.agentId === newAgentId) return;

    // Capture previous state BEFORE optimistic update (Pitfall 3)
    const previousAgentId = task.agentId;
    const previousAgentName = task.agentName;

    // Find target agent name
    const targetAgent = agents.find((a) => a.profileId === newAgentId);
    const newAgentName = targetAgent?.name ?? newAgentId;

    // Optimistic update
    setLocalTasks((prev) =>
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
      setLocalTasks((prev) =>
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
    ? localTasks.find((t) => t.id === activeDragId)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Mission Control</h1>
      <SectionErrorBoundary name="Mission Control">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-y-auto pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 px-2">
              {agents.map((agent) => {
                const avatarId = "avatarId" in agent ? agent.avatarId : undefined;
                const av = avatarId ? avatarMap[avatarId] : null;
                const role = ROLE_MAP[agent.profileId.toLowerCase()] || "Autonomous Agent";
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
                <div className="text-sm text-muted-foreground py-8 text-center w-full">
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
  );
}
