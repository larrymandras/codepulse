import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import PhaseProgressBars from "../components/PhaseProgressBars";
import TeamStatusCards from "../components/TeamStatusCards";
import BuildActivityFeed from "../components/BuildActivityFeed";
import ComponentTable from "../components/ComponentTable";

export default function BuildProgress() {
  const components = useQuery(api.build.phaseProgress) ?? [];
  const phases = useQuery(api.build.phaseOverview) ?? [];
  const activity = useQuery(api.build.recentActivity, { limit: 20 }) ?? [];
  const pipelines = useQuery(api.pipelines.listAll, {}) ?? [];
  const activePipelines = useQuery(api.pipelines.listActive) ?? [];

  const totalComponents = components.length;
  const completedCount = components.filter((c: any) => c.status === "completed").length;
  const completedPct = totalComponents > 0 ? Math.round((completedCount / totalComponents) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header + summary stats */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100 mb-4">Build Progress</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Total Components" value={totalComponents} />
          <MetricCard
            label="Completed"
            value={`${completedPct}%`}
            trend={completedPct >= 80 ? "up" : completedPct >= 40 ? "neutral" : "down"}
          />
          <MetricCard label="Active Pipelines" value={activePipelines.length} />
        </div>
      </div>

      {/* Phase progress bars — full width */}
      <PhaseProgressBars phases={phases} />

      {/* Two-column grid: teams + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamStatusCards components={components as any} pipelines={pipelines as any} />
        <BuildActivityFeed entries={activity as any} />
      </div>

      {/* Component table — full width */}
      <ComponentTable components={components as any} />
    </div>
  );
}
