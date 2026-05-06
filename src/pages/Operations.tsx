import { useMemo } from "react";
import MetricCard from "../components/MetricCard";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import StatusHeartbeatGrid from "../components/StatusHeartbeatGrid";
import CronCalendarView from "../components/CronCalendarView";
import PipelineFlowDiagram from "../components/PipelineFlowDiagram";
import { useRecentAgentStatus } from "../hooks/useAgentStatus";
import { useDailyRhythm } from "../hooks/useDailyRhythm";
import { useRecentPipelineExecutionIds } from "../hooks/usePipelineStepEvents";
import { AGENT_ROSTER } from "../lib/agentRoster";
import { parseDays, todayDayIndex } from "../lib/dayUtils";

export default function Operations() {
  const statusEvents = useRecentAgentStatus();
  const rhythmEntries = useDailyRhythm();
  const pipelineExecutionIds = useRecentPipelineExecutionIds();

  const activeCount = useMemo(() => {
    const now = Date.now();
    const latestByAgent = new Map<string, { state: string; timestamp: number }>();
    for (const evt of statusEvents) {
      const existing = latestByAgent.get(evt.agentId);
      if (!existing || evt.timestamp > existing.timestamp) {
        latestByAgent.set(evt.agentId, { state: evt.state, timestamp: evt.timestamp });
      }
    }
    let count = 0;
    for (const [, entry] of latestByAgent) {
      if (entry.state === "active" && now - entry.timestamp * 1000 < 300000) {
        count++;
      }
    }
    return count;
  }, [statusEvents]);

  const idleCount = useMemo(() => {
    return AGENT_ROSTER.length - activeCount;
  }, [activeCount]);

  const scheduledTodayCount = useMemo(() => {
    const today = todayDayIndex();
    return rhythmEntries.filter((entry) => {
      return parseDays(entry.days).includes(today);
    }).length;
  }, [rhythmEntries]);

  const pipelineRunCount = pipelineExecutionIds.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-[Cinzel]">Operations</h1>

      {/* Summary MetricCards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Active Agents" value={activeCount} />
        <MetricCard label="Idle" value={idleCount} />
        <MetricCard label="Scheduled Today" value={scheduledTodayCount} />
        <MetricCard label="Pipeline Runs" value={pipelineRunCount} />
      </div>

      {/* Status Grid (D-01, D-02, D-03, D-04, D-11 dual-channel) */}
      <SectionErrorBoundary name="Agent Status">
        <StatusHeartbeatGrid />
      </SectionErrorBoundary>

      {/* Cron Calendar (D-05, D-06, D-07, D-12 offline-resilient) */}
      <SectionErrorBoundary name="Cron Calendar">
        <CronCalendarView />
      </SectionErrorBoundary>

      {/* Pipeline Flow (D-08, D-09, D-10, D-13 fine-grained events) */}
      <SectionErrorBoundary name="Pipeline Flow">
        <PipelineFlowDiagram />
      </SectionErrorBoundary>
    </div>
  );
}
