import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import PhaseProgressBars from "../components/PhaseProgressBars";
import TeamStatusCards from "../components/TeamStatusCards";
import BuildActivityFeed from "../components/BuildActivityFeed";
import ComponentTable from "../components/ComponentTable";
import { PageHeader } from "../components/PageHeader";
import { useMetricState } from "../hooks/useMetricState";

export default function BuildProgress() {
  const componentsRaw = useQuery(api.build.phaseProgress);
  const components = componentsRaw ?? [];
  const phases = useQuery(api.build.phaseOverview) ?? [];
  const activity = useQuery(api.build.recentActivity, { limit: 20 }) ?? [];
  const pipelines = useQuery(api.pipelines.listAll, {}) ?? [];
  const activePipelinesRaw = useQuery(api.pipelines.listActive);
  const activePipelines = activePipelinesRaw ?? [];

  // D-14: both counters below currently collapse `undefined` (loading) into
  // `[]`, so state is derived from the raw (undefaulted) query results.
  const componentsState = useMetricState(componentsRaw, undefined, {}).state;
  const activePipelinesState = useMetricState(activePipelinesRaw, undefined, {}).state;

  const totalComponents = components.length;
  const completedCount = components.filter((c) => c.status === "completed").length;
  const completedPct = totalComponents > 0 ? Math.round((completedCount / totalComponents) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header + summary stats */}
      <div>
        <PageHeader title="Build Progress" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard label="Total Components" value={totalComponents} state={componentsState} />
          <MetricCard
            label="Completed"
            value={`${completedPct}%`}
            trend={completedPct >= 80 ? "up" : completedPct >= 40 ? "neutral" : "down"}
            state={componentsState}
          />
          <MetricCard
            label="Active Pipelines"
            value={activePipelines.length}
            state={activePipelinesState}
          />
        </div>
      </div>

      {/* Phase progress bars — full width */}
      <PhaseProgressBars phases={phases} />

      {/* Two-column grid: teams + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TeamStatusCards components={components} pipelines={pipelines} />
        <BuildActivityFeed entries={activity} />
      </div>

      {/* Component table — full width */}
      <ComponentTable components={components} />
    </div>
  );
}
