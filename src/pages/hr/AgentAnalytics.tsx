import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { GlassPanel } from "@/components/GlassPanel";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgentProfiles } from "@/hooks/useAgentProfiles";
import { useTeamPresets } from "@/hooks/useTeamPresets";
import { estimateCost } from "@/lib/modelPricing";
import {
  type Weights,
  DEFAULT_WEIGHTS,
  computeScores,
} from "@/lib/leaderboardScoring";
import type { TimeWindow } from "@/components/hr/detail/MetricsDashboard";
import { LeaderboardTable } from "@/components/hr/analytics/LeaderboardTable";
import { WeightSliders } from "@/components/hr/analytics/WeightSliders";
import { TeamSummaryCards } from "@/components/hr/analytics/TeamSummaryCards";
import { AgentComparisonChart } from "@/components/hr/analytics/AgentComparisonChart";
import { PageHeader } from "@/components/PageHeader";

// ─── Time window → seconds ─────────────────────────────────────────────────

const WINDOW_SECONDS: Record<TimeWindow, number> = {
  "1h": 3600,
  "24h": 86400,
  "7d": 604800,
  "30d": 2592000,
};

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AgentAnalytics() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("24h");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  // ── Agent name map ─────────────────────────────────────────────────────
  const profiles = useAgentProfiles();
  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) {
      map.set(p.profileId, p.displayName ?? p.name);
    }
    return map;
  }, [profiles]);

  // ── Teams ──────────────────────────────────────────────────────────────
  const { teams } = useTeamPresets();
  const selectedTeam = useMemo(
    () => teams.find((t) => t._id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );
  const agentIds = useMemo(
    () => selectedTeam?.agentIds ?? undefined,
    [selectedTeam],
  );

  // ── Leaderboard query ──────────────────────────────────────────────────
  const windowStart = useMemo(
    () => Date.now() / 1000 - WINDOW_SECONDS[timeWindow],
    [timeWindow],
  );

  const rawRows = useQuery(api.agentMetrics.leaderboard, {
    windowStart,
    agentIds,
  });
  const isLoading = rawRows === undefined;

  // ── Scored rows ────────────────────────────────────────────────────────
  const scoredRows = useMemo(
    () => (rawRows ? computeScores(rawRows, weights, estimateCost) : []),
    [rawRows, weights],
  );

  // ── Row click → agent detail ──────────────────────────────────────────
  const handleRowClick = (agentId: string) => {
    navigate(`/hr/agent/${agentId}`);
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="m-6 flex flex-col gap-6">
        {/* Header + time selector */}
        <SectionErrorBoundary name="Header">
          <GlassPanel className="p-6 relative overflow-hidden hover:scale-[1.01] transition-transform duration-300">
            <div className="absolute top-0 right-0 h-full w-32 bg-gradient-to-l from-primary/10 to-transparent pointer-events-none animate-scanline mix-blend-overlay" />
            <div className="relative z-10">
              <PageHeader
                title="Agent Analytics"
                actions={
                  <ToggleGroup
                    type="single"
                    value={timeWindow}
                    onValueChange={(v) => v && setTimeWindow(v as TimeWindow)}
                  >
                    {(["1h", "24h", "7d", "30d"] as const).map((w) => (
                      <ToggleGroupItem
                        key={w}
                        value={w}
                        className="text-xs font-mono tracking-widest uppercase px-3 h-7 data-[state=on]:bg-primary/20 data-[state=on]:text-primary border border-transparent data-[state=on]:border-primary/30 transition-all data-[state=on]:shadow-[var(--glow-xs)]"
                      >
                        {w}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                }
              />
            </div>
          </GlassPanel>
        </SectionErrorBoundary>

        {/* Controls: team filter + weight sliders */}
        <SectionErrorBoundary name="Controls">
          <GlassPanel className="p-6 glow-card transition-all duration-300 hover:scale-[1.01] transition-transform duration-300">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Team selector */}
              <div className="flex flex-col gap-2 lg:w-64">
                <label className="text-sm text-muted-foreground uppercase tracking-wide">
                  Team Filter
                </label>
                <Select
                  value={selectedTeamId ?? "__all__"}
                  onValueChange={(v) =>
                    setSelectedTeamId(v === "__all__" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All agents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All agents</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team._id} value={team._id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Weight sliders */}
              <div className="flex-1">
                <label className="text-sm text-muted-foreground uppercase tracking-wide mb-2 block">
                  Scoring Weights
                </label>
                <WeightSliders
                  weights={weights}
                  onWeightsChange={setWeights}
                />
              </div>
            </div>
          </GlassPanel>
        </SectionErrorBoundary>

        {/* Team summary cards (only when team selected and data present) */}
        {selectedTeamId && scoredRows.length > 0 && (
          <SectionErrorBoundary name="Team Summary">
            <GlassPanel className="p-6 glow-card transition-all duration-300 hover:scale-[1.01] transition-transform duration-300">
              <TeamSummaryCards rows={scoredRows} />
            </GlassPanel>
          </SectionErrorBoundary>
        )}

        {/* Leaderboard */}
        <SectionErrorBoundary name="Leaderboard">
          <GlassPanel className="p-6 glow-card transition-all duration-300 hover:scale-[1.01] transition-transform duration-300">
            <h2 className="text-base font-bold font-mono tracking-wide text-foreground uppercase mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
              Leaderboard
            </h2>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : (
              <LeaderboardTable
                rows={scoredRows}
                agentNameMap={agentNameMap}
                onRowClick={handleRowClick}
              />
            )}
          </GlassPanel>
        </SectionErrorBoundary>

        {/* Comparison chart (only when team selected and data present) */}
        {selectedTeamId && scoredRows.length > 0 && (
          <SectionErrorBoundary name="Comparison Chart">
            <GlassPanel className="p-6 glow-card transition-all duration-300 hover:scale-[1.01] transition-transform duration-300">
              <h2 className="text-base font-bold font-mono tracking-wide text-foreground uppercase mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                Agent Comparison
              </h2>
              <AgentComparisonChart
                rows={scoredRows}
                agentNameMap={agentNameMap}
              />
            </GlassPanel>
          </SectionErrorBoundary>
        )}
      </div>
    </div>
  );
}
