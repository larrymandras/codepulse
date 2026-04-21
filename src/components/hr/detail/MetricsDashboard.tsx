import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { estimateCost } from "@/lib/modelPricing";
import { formatCost } from "@/lib/formatters";
import { ResponseTimeChart, calcPercentile } from "./ResponseTimeChart";
import { CompletionRateChart } from "./CompletionRateChart";
import { TokenUsageChart } from "./TokenUsageChart";

export type MetricRecord = {
  agentId: string;
  timestamp: number;
  responseTimeMs?: number;
  taskOutcome: string;
  inputTokens: number;
  outputTokens: number;
  modelUsed?: string;
};

export type TimeWindow = "1h" | "24h" | "7d" | "30d";

interface MetricsDashboardProps {
  metrics: MetricRecord[];
  timeWindow: TimeWindow;
  onWindowChange: (w: TimeWindow) => void;
}

export function MetricsDashboard({
  metrics,
  timeWindow,
  onWindowChange,
}: MetricsDashboardProps) {
  const stats = useMemo(() => {
    if (metrics.length === 0) return null;
    const times = metrics
      .map((m) => m.responseTimeMs ?? 0)
      .filter((t) => t > 0)
      .sort((a, b) => a - b);
    const successCount = metrics.filter(
      (m) => m.taskOutcome === "success",
    ).length;
    const failureCount = metrics.filter(
      (m) => m.taskOutcome === "failure",
    ).length;
    const timeoutCount = metrics.filter(
      (m) => m.taskOutcome === "timeout",
    ).length;
    const totalTokens = metrics.reduce(
      (s, m) => s + m.inputTokens + m.outputTokens,
      0,
    );
    const totalCost = metrics.reduce(
      (s, m) =>
        s +
        estimateCost(m.inputTokens, m.outputTokens, m.modelUsed ?? "default"),
      0,
    );
    return {
      p50: calcPercentile(times, 50),
      p95: calcPercentile(times, 95),
      p99: calcPercentile(times, 99),
      successRate:
        metrics.length > 0 ? (successCount / metrics.length) * 100 : 0,
      errorRate:
        metrics.length > 0 ? (failureCount / metrics.length) * 100 : 0,
      timeoutRate:
        metrics.length > 0 ? (timeoutCount / metrics.length) * 100 : 0,
      totalTokens,
      totalCost,
    };
  }, [metrics]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Performance Metrics</h3>
        <ToggleGroup
          type="single"
          value={timeWindow}
          onValueChange={(v) => v && onWindowChange(v as TimeWindow)}
        >
          {(["1h", "24h", "7d", "30d"] as const).map((w) => (
            <ToggleGroupItem
              key={w}
              value={w}
              className="text-xs px-3 h-7"
            >
              {w}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {metrics.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-muted-foreground">
            No metrics yet
          </p>
          <p className="text-xs text-muted-foreground">
            Performance data will appear here once this agent processes
            interactions.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Response Time (p50)
              </p>
              <p className="font-mono text-2xl font-semibold">
                {stats ? `${Math.round(stats.p50)}ms` : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                p95: {stats ? `${Math.round(stats.p95)}ms` : "--"} / p99:{" "}
                {stats ? `${Math.round(stats.p99)}ms` : "--"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">
                Task Completion
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--status-ok)]">
                {stats ? `${stats.successRate.toFixed(1)}%` : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                Error: {stats ? `${stats.errorRate.toFixed(1)}%` : "--"} /
                Timeout: {stats ? `${stats.timeoutRate.toFixed(1)}%` : "--"}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground mb-1">Token Usage</p>
              <p className="font-mono text-2xl font-semibold">
                {stats ? stats.totalTokens.toLocaleString() : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                Est. cost: {stats ? formatCost(stats.totalCost) : "--"}
              </p>
            </div>
          </div>

          {/* Charts */}
          <ResponseTimeChart metrics={metrics} />
          <CompletionRateChart metrics={metrics} />
          <TokenUsageChart metrics={metrics} />
        </>
      )}
    </div>
  );
}

export default MetricsDashboard;
