import { useState } from "react";
import { Plus } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import MetricCard from "../components/MetricCard";
import CronJobList, { type CronJob } from "../components/CronJobList";
import CronSheet from "../components/CronSheet";
import CronExecutionHistory from "../components/CronExecutionHistory";
import HeartbeatAlertsPanel from "../components/HeartbeatAlertsPanel";
import JobLifecyclePanel from "../components/JobLifecyclePanel";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import { formatDurationMs } from "../lib/formatters";
import { CRON_SCHEDULES } from "../lib/cronSchedules";
import { useCommandDispatch } from "../hooks/useCommandDispatch";
import {
  useAutomationSummary,
  useRecentCronExecutions,
  useRecentHeartbeats,
  useRecentJobs,
} from "../hooks/useAutomation";

function relTime(epoch: number | null): string {
  if (!epoch) return "--";
  const diff = Date.now() / 1000 - epoch;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Convert static CRON_SCHEDULES to CronJob shape for the list
function schedulesToCronJobs(): CronJob[] {
  return CRON_SCHEDULES.map((s) => ({
    name: s.jobName,
    expression: s.interval,
    enabled: true,
  }));
}

export default function Automation() {
  const summary = useAutomationSummary();
  const executions = useRecentCronExecutions(200);
  const heartbeats = useRecentHeartbeats(30);
  const jobs = useRecentJobs(100);
  const checkpointOverview = useQuery(api.pipelineCheckpoints.overview);
  const recentCheckpoints = useQuery(api.pipelineCheckpoints.recent, { limit: 20 });
  const integrationOverview = useQuery(api.integrationCalls.overview);
  const recentIntegrations = useQuery(api.integrationCalls.recent, { limit: 20 });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editJob, setEditJob] = useState<{ name: string; expression: string } | null>(null);

  const { dispatch } = useCommandDispatch();

  async function handleTrigger(jobName: string) {
    await dispatch({ type: "cron.trigger", job_name: jobName }, "Cron job triggered.");
  }

  async function handleToggle(jobName: string, enabled: boolean) {
    await dispatch(
      { type: "cron.toggle", job_name: jobName, enabled },
      enabled ? "Cron job enabled." : "Cron job disabled."
    );
  }

  function handleSave(name: string, expression: string) {
    dispatch({ type: "cron.create", job_name: name, expression }, "Cron job saved.");
  }

  const cronJobs = schedulesToCronJobs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Automation</h1>
        <Button
          variant="default"
          size="sm"
          onClick={() => { setEditJob(null); setSheetOpen(true); }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Cron Job
        </Button>
      </div>

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
        <CronJobList
          jobs={cronJobs}
          onTrigger={handleTrigger}
          onToggle={handleToggle}
          onEdit={(job) => { setEditJob(job); setSheetOpen(true); }}
        />
      </SectionErrorBoundary>

      {/* CronSheet slide-out panel */}
      <CronSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editJob={editJob}
        onSave={handleSave}
      />

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

      {/* Pipeline Checkpoints & Integrations side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Checkpoints */}
        <SectionErrorBoundary name="Pipeline Checkpoints">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
              Pipeline Checkpoints
              <InfoTooltip text="Durable pipeline execution — checkpoint persistence for restart-safe pipelines" />
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-background rounded-lg p-2 text-center">
                <p className="text-lg font-semibold text-foreground">{checkpointOverview?.totalCheckpoints ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="bg-background rounded-lg p-2 text-center">
                <p className="text-lg font-semibold text-yellow-400">{checkpointOverview?.activeExecutions ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="bg-background rounded-lg p-2 text-center">
                <p className="text-lg font-semibold text-green-400">{checkpointOverview?.completedExecutions ?? 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {(recentCheckpoints ?? []).map((cp: any, i: number) => (
                <div key={cp._id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${i % 2 === 0 ? "bg-card" : ""}`}>
                  <span className={`w-2 h-2 rounded-full ${cp.status === "completed" ? "bg-green-400" : cp.status === "resumed" ? "bg-blue-400" : cp.status === "saved" ? "bg-yellow-400" : "bg-muted-foreground"}`} />
                  <span className="text-muted-foreground font-mono w-16 shrink-0">{relTime(cp.timestamp)}</span>
                  <span className="text-foreground truncate">{cp.pipelineName}</span>
                  <span className="text-muted-foreground">step {cp.stepIndex}: {cp.stepName}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${cp.status === "completed" ? "bg-green-400/10 text-green-400" : cp.status === "resumed" ? "bg-blue-400/10 text-blue-400" : "bg-yellow-400/10 text-yellow-400"}`}>
                    {cp.status}
                  </span>
                </div>
              ))}
              {(!recentCheckpoints || recentCheckpoints.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No checkpoint events yet</p>
              )}
            </div>
          </div>
        </SectionErrorBoundary>

        {/* Integration Calls */}
        <SectionErrorBoundary name="Integration Calls">
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
              Integration Calls
              <InfoTooltip text="YAML-defined API integrations — declarative endpoint calls with automatic auth" />
            </h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-background rounded-lg p-2 text-center">
                <p className="text-lg font-semibold text-foreground">{integrationOverview?.totalCalls ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Calls</p>
              </div>
              <div className="bg-background rounded-lg p-2 text-center">
                <p className="text-lg font-semibold text-red-400">{integrationOverview?.failures ?? 0}</p>
                <p className="text-xs text-muted-foreground">Failures</p>
              </div>
              <div className="bg-background rounded-lg p-2 text-center">
                <p className="text-lg font-semibold text-blue-400">{integrationOverview?.avgDurationMs ?? 0}ms</p>
                <p className="text-xs text-muted-foreground">Avg Latency</p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {(recentIntegrations ?? []).map((call: any, i: number) => (
                <div key={call._id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${i % 2 === 0 ? "bg-card" : ""}`}>
                  <span className={`w-2 h-2 rounded-full ${call.success ? "bg-green-400" : "bg-red-400"}`} />
                  <span className="text-muted-foreground font-mono w-16 shrink-0">{relTime(call.timestamp)}</span>
                  <span className="text-foreground truncate">{call.integrationName}</span>
                  <span className="text-muted-foreground">{call.method} {call.endpointName}</span>
                  <span className="ml-auto text-muted-foreground font-mono">{call.statusCode}</span>
                  <span className="text-muted-foreground font-mono w-12 text-right">{call.durationMs}ms</span>
                </div>
              ))}
              {(!recentIntegrations || recentIntegrations.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No integration calls yet</p>
              )}
            </div>
          </div>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
