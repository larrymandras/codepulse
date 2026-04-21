import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/GlassPanel";
import { TeamCard } from "@/components/hr/TeamCard";
import { TeamEditor } from "@/components/hr/TeamEditor";
import { useTeamPresets, type TeamPreset } from "@/hooks/useTeamPresets";
import { useRosterAgents } from "@/hooks/useRosterAgents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersRound, Plus } from "lucide-react";

function resolveTeamAgents(
  agentIds: string[],
  agents: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  return agentIds.map((id) => agentMap.get(id) ?? { id, name: id });
}

export default function Teams() {
  const { teamId } = useParams<{ teamId?: string }>();
  const navigate = useNavigate();

  const { teams, isLoading } = useTeamPresets();
  const { agents } = useRosterAgents();

  const [launchTeam, setLaunchTeam] = useState<TeamPreset | null>(null);

  // Team Editor mode
  if (teamId) {
    return (
      <div className="flex-1 overflow-auto">
        <GlassPanel className="m-6 p-8">
          <TeamEditor teamId={teamId === "new" ? undefined : teamId} />
        </GlassPanel>
      </div>
    );
  }

  // Card grid mode
  return (
    <div className="flex-1 overflow-auto">
      <GlassPanel className="m-6 p-8">
        <div className="flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-foreground">Teams</h1>
              <span className="text-xs text-muted-foreground">
                {teams.length} team{teams.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Button size="sm" onClick={() => navigate("/hr/teams/new")}>
              <Plus className="h-4 w-4 mr-1" />
              New Team
            </Button>
          </div>

          {/* Loading state */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[200px] rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && teams.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <UsersRound className="h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  No teams yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create team presets to quickly launch war rooms with your
                  favorite agent combinations.
                </p>
              </div>
              <Button size="sm" onClick={() => navigate("/hr/teams/new")}>
                <Plus className="h-4 w-4 mr-1" />
                Create Your First Team
              </Button>
            </div>
          )}

          {/* Team card grid */}
          {!isLoading && teams.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {teams.map((team) => (
                <TeamCard
                  key={team._id}
                  team={team}
                  agents={resolveTeamAgents(team.agentIds, agents)}
                  onLaunch={setLaunchTeam}
                  onEdit={(id) => navigate(`/hr/teams/${id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </GlassPanel>

      {/* War Room Launch Dialog — wired in plan 78-03 */}
      {/* Placeholder: launchTeam state is ready for WarRoomLaunchDialog integration */}
    </div>
  );
}
