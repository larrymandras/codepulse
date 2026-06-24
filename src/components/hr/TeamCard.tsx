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
    <div className="group bg-card/80 backdrop-blur border border-border/50 glow-card rounded-xl p-5 flex flex-col gap-4 hover:border-primary/50 transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[var(--glow-sm)] hover:-translate-y-1 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-foreground font-mono tracking-wide truncate group-hover:text-primary transition-colors">
            {team.name}
          </h3>
          {team.description && (
            <p className="text-sm text-muted-foreground/80 font-mono line-clamp-2 mt-1">
              {team.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors ml-2"
          onClick={() => onEdit(team._id)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      {/* Avatars + count */}
      <div className="flex items-center gap-3">
        <StackedAvatars agents={agents} max={4} size="sm" />
        <Badge variant="secondary" className="text-[11px] font-mono tracking-widest uppercase bg-primary/10 text-primary/90 border border-primary/20 py-0.5 px-2">
          {agents.length} agent{agents.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Usage stats */}
      <div className="flex items-center gap-4 text-xs font-mono tracking-widest uppercase text-muted-foreground/60 bg-muted/20 rounded p-2 border border-border/30">
        <span>{team.warRoomCount ?? 0} sessions</span>
        <span>•</span>
        <span>
          {team.lastUsedAt
            ? formatRelativeTime(team.lastUsedAt)
            : "Never used"}
        </span>
      </div>

      {/* Launch button */}
      <Button
        className="w-full mt-2 font-bold font-mono tracking-wider uppercase bg-primary/10 border border-primary/30 hover:bg-primary hover:text-primary-foreground text-primary transition-all shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)]"
        size="sm"
        onClick={() => onLaunch(team)}
      >
        <Zap className="h-4 w-4 mr-2" />
        Launch War Room
      </Button>
    </div>
  );
}

export default TeamCard;
