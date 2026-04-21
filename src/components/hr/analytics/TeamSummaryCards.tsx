import { useMemo } from "react";
import MetricCard from "@/components/MetricCard";
import { formatCost, formatDurationMs } from "@/lib/formatters";
import type { ScoredRow } from "@/lib/leaderboardScoring";

interface TeamSummaryCardsProps {
  rows: ScoredRow[];
}

export function TeamSummaryCards({ rows }: TeamSummaryCardsProps) {
  const stats = useMemo(() => {
    if (rows.length === 0) return null;

    const totalTasks = rows.reduce((s, r) => s + r.taskCount, 0);
    const avgCompletion =
      rows.reduce((s, r) => s + r.completionRate, 0) / rows.length;
    const responseTimes = rows
      .map((r) => r.avgResponseTimeMs)
      .filter((v): v is number => v != null);
    const avgResponse =
      responseTimes.length > 0
        ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length
        : null;
    const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);

    return { totalTasks, avgCompletion, avgResponse, totalCost };
  }, [rows]);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Total Tasks" value={stats.totalTasks} numericValue={stats.totalTasks} />
      <MetricCard
        label="Avg Response Time"
        value={stats.avgResponse != null ? formatDurationMs(stats.avgResponse) : "-"}
      />
      <MetricCard
        label="Completion Rate"
        value={`${(stats.avgCompletion * 100).toFixed(1)}%`}
      />
      <MetricCard
        label="Total Cost"
        value={formatCost(stats.totalCost)}
      />
    </div>
  );
}
