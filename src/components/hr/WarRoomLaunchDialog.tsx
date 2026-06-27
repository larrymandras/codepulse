import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import AgentAvatar from "@/components/AgentAvatar";
import { useRosterAgents } from "@/hooks/useRosterAgents";
import { useTeamPresets } from "@/hooks/useTeamPresets";
import { createWarRoom } from "@/lib/astridrApi";
import { X, Zap, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "../../../convex/_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarRoomLaunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialParticipantIds: string[];
  teamPresetId?: string;
  showSaveAsTeam?: boolean;
}

// ---------------------------------------------------------------------------
// Agent picker (inline list for adding participants)
// ---------------------------------------------------------------------------

function AgentPicker({
  agents,
  onSelect,
  onClose,
}: {
  agents: Array<{ id: string; name: string; tier: string }>;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = agents.filter(
    (a) =>
      !search || a.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="border rounded-md bg-popover p-2 space-y-2">
      <Input
        placeholder="Search agents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-base"
        autoFocus
      />
      <div className="max-h-[200px] overflow-auto space-y-1">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No agents available
          </p>
        )}
        {filtered.map((agent) => (
          <button
            key={agent.id}
            className="w-full flex items-center gap-2 rounded-md hover:bg-accent/50 p-1.5 text-left text-base transition-colors"
            onClick={() => onSelect(agent.id)}
          >
            <AgentAvatar
              avatar={{ name: agent.name }}
              size="sm"
              status="idle"
            />
            <span className="truncate">{agent.name}</span>
          </button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-sm"
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WarRoomLaunchDialog
// ---------------------------------------------------------------------------

export function WarRoomLaunchDialog({
  open,
  onOpenChange,
  initialParticipantIds,
  teamPresetId,
  showSaveAsTeam = false,
}: WarRoomLaunchDialogProps) {
  const { agents } = useRosterAgents();
  const { incrementUsage, create: createTeamPreset } = useTeamPresets();

  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [agenda, setAgenda] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [saveAsTeam, setSaveAsTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");

  // Reset state only when the dialog transitions OPEN. We intentionally depend on
  // `open` alone: parents pass a fresh `initialParticipantIds` array literal on every
  // render, so including it here would re-fire this effect on each parent re-render
  // and wipe the participants/topic the user is entering (and keep Launch disabled).
  useEffect(() => {
    if (open) {
      setParticipantIds([...initialParticipantIds]);
      setTopic("");
      setAgenda("");
      setIsLaunching(false);
      setShowAddAgent(false);
      setSaveAsTeam(false);
      setNewTeamName("");
      setNewTeamDescription("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Agent lookup map
  const agentMap = useMemo(() => {
    const map = new Map<string, (typeof agents)[number]>();
    for (const a of agents) map.set(a.id, a);
    return map;
  }, [agents]);

  // Available agents for picker (not already in participants)
  const availableAgents = useMemo(() => {
    const selected = new Set(participantIds);
    return agents.filter((a) => !selected.has(a.id));
  }, [agents, participantIds]);

  const addParticipant = (id: string) => {
    if (!participantIds.includes(id)) {
      setParticipantIds((prev) => [...prev, id]);
    }
  };

  const removeParticipant = (id: string) => {
    setParticipantIds((prev) => prev.filter((x) => x !== id));
  };

  const handleLaunch = async () => {
    if (participantIds.length === 0) return;
    setIsLaunching(true);
    try {
      // Save as team if requested
      if (saveAsTeam && newTeamName.trim()) {
        await createTeamPreset({
          name: newTeamName.trim(),
          description: newTeamDescription.trim() || undefined,
          agentIds: participantIds,
        });
      }

      // Launch war room
      const result = await createWarRoom({
        participants: participantIds,
        topic: topic.trim() || undefined,
        teamPresetId: teamPresetId,
      });

      // Increment usage if team-based launch
      if (teamPresetId) {
        incrementUsage(teamPresetId as Id<"teamPresets">);
      }

      toast.success(
        `War room "${result.room_name}" created with ${result.participants.length} agents`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to launch war room",
      );
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Launch War Room</DialogTitle>
          <DialogDescription>
            Configure participants and set a topic before launching.
          </DialogDescription>
        </DialogHeader>

        {/* Participants */}
        <div className="space-y-3">
          <Label>Participants ({participantIds.length})</Label>
          <div className="flex flex-wrap gap-2">
            {participantIds.map((id) => {
              const agent = agentMap.get(id);
              return (
                <div
                  key={id}
                  className="flex items-center gap-1.5 bg-muted rounded-full px-2 py-1"
                >
                  <AgentAvatar
                    avatar={{ name: agent?.name ?? id }}
                    size="sm"
                    status="idle"
                  />
                  <span className="text-sm font-medium">
                    {agent?.name ?? id}
                  </span>
                  <button
                    className="text-muted-foreground hover:text-destructive ml-0.5"
                    onClick={() => removeParticipant(id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-sm"
              onClick={() => setShowAddAgent(!showAddAgent)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          {showAddAgent && (
            <AgentPicker
              agents={availableAgents}
              onSelect={(id) => {
                addParticipant(id);
              }}
              onClose={() => setShowAddAgent(false)}
            />
          )}
        </div>

        {/* Topic */}
        <div className="space-y-2">
          <Label htmlFor="wr-topic">Topic (optional)</Label>
          <Input
            id="wr-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What's this session about?"
          />
        </div>

        {/* Agenda */}
        <div className="space-y-2">
          <Label htmlFor="wr-agenda">Agenda (optional)</Label>
          <Textarea
            id="wr-agenda"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="Key discussion points..."
            rows={3}
          />
        </div>

        {/* Save as Team (roster ad-hoc path) */}
        {showSaveAsTeam && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="saveAsTeam"
                checked={saveAsTeam}
                onCheckedChange={(checked) =>
                  setSaveAsTeam(checked === true)
                }
              />
              <Label htmlFor="saveAsTeam" className="text-base cursor-pointer">
                Save as team preset
              </Label>
            </div>
            {saveAsTeam && (
              <div className="space-y-2 pl-6">
                <Input
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Team name"
                />
                <Input
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  placeholder="Description (optional)"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            disabled={
              participantIds.length === 0 ||
              isLaunching ||
              (saveAsTeam && !newTeamName.trim())
            }
            onClick={handleLaunch}
          >
            <Zap className="h-4 w-4 mr-1" />
            {isLaunching ? "Launching..." : "Launch War Room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WarRoomLaunchDialog;
