import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTeamPresets } from "@/hooks/useTeamPresets";
import { useRosterAgents, type RosterAgent } from "@/hooks/useRosterAgents";
import AgentAvatar from "@/components/AgentAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, X, GripVertical, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Tier badge colors (consistent with AgentCard / RosterTable)
// ---------------------------------------------------------------------------

const TIER_BADGE_COLOR: Record<string, string> = {
  command: "bg-purple-600 text-white",
  domain: "bg-blue-600 text-white",
  shared: "bg-gray-600 text-white",
};

// ---------------------------------------------------------------------------
// Sortable member item
// ---------------------------------------------------------------------------

interface SortableMemberProps {
  agentId: string;
  agent: RosterAgent | undefined;
  onRemove: (id: string) => void;
}

function SortableMember({ agentId, agent, onRemove }: SortableMemberProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agentId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 backdrop-blur p-2.5 shadow-sm hover:border-primary/50 transition-colors group"
    >
      <button
        className="cursor-grab text-muted-foreground/50 hover:text-primary transition-colors group-hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <AgentAvatar
        avatar={{ name: agent?.name ?? agentId }}
        size="sm"
        status="idle"
      />
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold font-mono tracking-wide text-foreground truncate group-hover:text-primary transition-colors">
          {agent?.name ?? agentId}
        </p>
      </div>
      {agent?.tier && (
        <Badge
          variant="secondary"
          className={`text-[11px] font-mono tracking-widest uppercase px-2 py-0.5 ${TIER_BADGE_COLOR[agent.tier] ?? TIER_BADGE_COLOR.shared}`}
        >
          {agent.tier}
        </Badge>
      )}
      <button
        className="text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 p-1.5 rounded transition-all opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(agentId)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag overlay preview
// ---------------------------------------------------------------------------

function DragPreview({ agent }: { agent: RosterAgent | undefined }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background p-2 shadow-lg">
      <AgentAvatar
        avatar={{ name: agent?.name ?? "Agent" }}
        size="sm"
        status="idle"
      />
      <span className="text-base font-medium">{agent?.name ?? "Agent"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamEditor
// ---------------------------------------------------------------------------

interface TeamEditorProps {
  teamId?: string; // undefined = create mode
}

export function TeamEditor({ teamId }: TeamEditorProps) {
  const navigate = useNavigate();
  const { teams, create, update, remove } = useTeamPresets();
  const { agents } = useRosterAgents();

  const existingTeam = useMemo(
    () => (teamId ? teams.find((t) => t._id === teamId) : undefined),
    [teams, teamId],
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize from existing team when data loads
  useEffect(() => {
    if (existingTeam && !initialized) {
      setName(existingTeam.name);
      setDescription(existingTeam.description ?? "");
      setMemberIds([...existingTeam.agentIds]);
      setInitialized(true);
    }
  }, [existingTeam, initialized]);

  // Available agents = all agents minus team members
  const availableAgents = useMemo(() => {
    const memberSet = new Set(memberIds);
    return agents
      .filter((a) => !memberSet.has(a.id))
      .filter(
        (a) =>
          !availableSearch ||
          a.name.toLowerCase().includes(availableSearch.toLowerCase()),
      );
  }, [agents, memberIds, availableSearch]);

  // Resolve agent data by ID
  const agentMap = useMemo(() => {
    const map = new Map<string, RosterAgent>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // If dragging from available to team panel
    if (!memberIds.includes(activeId) && over.id === "team-droppable") {
      setMemberIds((prev) => [...prev, activeId]);
      return;
    }

    // If reordering within team
    if (memberIds.includes(activeId) && memberIds.includes(overId)) {
      const oldIndex = memberIds.indexOf(activeId);
      const newIndex = memberIds.indexOf(overId);
      if (oldIndex !== newIndex) {
        setMemberIds((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const addMember = (agentId: string) => {
    if (!memberIds.includes(agentId)) {
      setMemberIds((prev) => [...prev, agentId]);
    }
  };

  const removeMember = (agentId: string) => {
    setMemberIds((prev) => prev.filter((id) => id !== agentId));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Team name is required");
      return;
    }
    if (memberIds.length === 0) {
      toast.error("Add at least one agent to the team");
      return;
    }
    setIsSaving(true);
    try {
      if (existingTeam) {
        await update({
          id: existingTeam._id,
          name: name.trim(),
          description: description.trim() || undefined,
          agentIds: memberIds,
        });
      } else {
        await create({
          name: name.trim(),
          description: description.trim() || undefined,
          agentIds: memberIds,
        });
      }
      navigate("/hr/teams");
    } catch {
      // Toast already shown by hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingTeam) return;
    try {
      await remove(existingTeam._id);
      navigate("/hr/teams");
    } catch {
      // Toast already shown by hook
    }
  };

  const isEditMode = !!existingTeam;

  // If editing a team that doesn't exist yet (data loading)
  if (teamId && !existingTeam && teams.length > 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-base text-muted-foreground">Team not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/hr/teams")}>
          Back to Teams
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isEditMode ? "Edit Team" : "New Team"}
        </h2>
        <p className="text-base text-muted-foreground mt-1">
          {isEditMode
            ? "Update team members and details."
            : "Create a reusable team preset for war room launches."}
        </p>
      </div>

      {/* Name and Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="team-name"
            className="text-base font-medium text-foreground"
          >
            Team Name *
          </label>
          <Input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Strategy Council"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="team-desc"
            className="text-base font-medium text-foreground"
          >
            Description
          </label>
          <Textarea
            id="team-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this team for?"
            rows={1}
          />
        </div>
      </div>

      {/* Dual-panel DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
          {/* Left panel — Available Agents */}
          <div className="border border-border/50 rounded-xl p-5 flex flex-col gap-4 bg-card/80 backdrop-blur glow-card shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[var(--glow-sm)] transition-all">
            <h3 className="text-base font-bold font-mono tracking-wide text-foreground uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary/50" />
              Available Agents
            </h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search agents..."
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-auto max-h-[350px] space-y-1.5">
              {availableAgents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {agents.length === 0
                    ? "No agents registered"
                    : "All agents are in the team"}
                </p>
              )}
              {availableAgents.map((agent) => (
                <button
                  key={agent.id}
                  className="w-full flex items-center gap-2 rounded-md border border-transparent hover:border-border hover:bg-accent/50 p-2 text-left transition-colors"
                  onClick={() => addMember(agent.id)}
                >
                  <AgentAvatar
                    avatar={{ name: agent.name }}
                    size="sm"
                    status="idle"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-foreground truncate">
                      {agent.name}
                    </p>
                  </div>
                  {agent.tier && (
                    <Badge
                      variant="secondary"
                      className={`text-xs ${TIER_BADGE_COLOR[agent.tier] ?? TIER_BADGE_COLOR.shared}`}
                    >
                      {agent.tier}
                    </Badge>
                  )}
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Right panel — Team Members */}
          <div className="border border-primary/20 rounded-xl p-5 flex flex-col gap-4 bg-primary/5 backdrop-blur glow-card shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)] transition-all relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <h3 className="text-base font-bold font-mono tracking-wide text-primary uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Team Members ({memberIds.length})
            </h3>
            <SortableContext
              items={memberIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex-1 overflow-auto max-h-[390px] space-y-1.5">
                {memberIds.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Click agents on the left to add them to this team.
                  </p>
                )}
                {memberIds.map((agentId) => (
                  <SortableMember
                    key={agentId}
                    agentId={agentId}
                    agent={agentMap.get(agentId)}
                    onRemove={removeMember}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </div>

        <DragOverlay>
          {activeDragId ? (
            <DragPreview agent={agentMap.get(activeDragId)} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Actions bar */}
      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          {isEditMode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete team?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &ldquo;{name}&rdquo;. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/hr/teams")}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!name.trim() || memberIds.length === 0 || isSaving}
          >
            {isSaving
              ? "Saving..."
              : isEditMode
                ? "Save Changes"
                : "Create Team"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default TeamEditor;
