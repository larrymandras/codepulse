import MetricCard from "../components/MetricCard";
import CronJobList from "../components/CronJobList";
import CronExecutionHistory from "../components/CronExecutionHistory";
import HeartbeatAlertsPanel from "../components/HeartbeatAlertsPanel";
import JobLifecyclePanel from "../components/JobLifecyclePanel";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { formatDurationMs } from "../lib/formatters";
import {
  useAutomationSummary,
  useRecentCronExecutions,
  useRecentHeartbeats,
  useRecentJobs,
} from "../hooks/useAutomation";

export default function Automation() {
  const summary = useAutomationSummary();
  const executions = useRecentCronExecutions(200);
  const heartbeats = useRecentHeartbeats(30);
  const jobs = useRecentJobs(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Automation</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Cron Jobs" value={summary?.totalJobs ?? 12} />
        <MetricCard label="Runs (1h)" value={summary?.totalRuns ?? 0} />
        <MetricCard
          label="Failed (1h)"
          value={summary?.failed ?? 0}
          trend={summary?.failed ? "down" : undefined}
        />
        <MetricCard
          label="Avg Duration"
          value={summary ? formatDurationMs(summary.avgDurationMs) : "—"}
        />
      </div>

      {/* Cron job list */}
      <SectionErrorBoundary name="Cron Jobs">
        <CronJobList executions={executions} />
      </SectionErrorBoundary>

      {/* Execution history */}
      <SectionErrorBoundary name="Execution History">
        <CronExecutionHistory executions={executions} />
      </SectionErrorBoundary>

      {/* Heartbeats and Jobs side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionErrorBoundary name="Heartbeat Alerts">
          <HeartbeatAlertsPanel heartbeats={heartbeats} />
        </SectionErrorBoundary>
        <SectionErrorBoundary name="Job Lifecycle">
          <JobLifecyclePanel jobs={jobs} />
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
