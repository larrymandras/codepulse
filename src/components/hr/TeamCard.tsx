import { StackedAvatars } from "@/components/hr/StackedAvatars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Zap } from "lucide-react";
import type { TeamPreset } from "@/hooks/useTeamPresets";

interface TeamCardProps {
  team: TeamPreset;
  agents: Array<{ name: string; id: string }>;
  onLaunch: (team: TeamPreset) => void;
  onEdit: (teamId: string) => void;
}

function formatRelativeTime(epochSeconds: number): string {
  const now = Date.now() / 1000;
  const diff = now - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

export function TeamCard({ team, agents, onLaunch, onEdit }: TeamCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {team.name}
          </h3>
          {team.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {team.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onEdit(team._id)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Avatars + count */}
      <div className="flex items-center gap-2">
        <StackedAvatars agents={agents} max={4} size="sm" />
        <Badge variant="secondary" className="text-[10px]">
          {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Usage stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{team.warRoomCount ?? 0} sessions</span>
        <span>
          {team.lastUsedAt
            ? formatRelativeTime(team.lastUsedAt)
            : "Never used"}
        </span>
      </div>

      {/* Launch button */}
      <Button
        className="w-full bg-red-600 hover:bg-red-700 text-white"
        size="sm"
        onClick={() => onLaunch(team)}
      >
        <Zap className="h-4 w-4 mr-1" />
        Launch War Room
      </Button>
    </div>
  );
}

export default TeamCard;
