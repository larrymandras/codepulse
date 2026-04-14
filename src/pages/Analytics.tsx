import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { useLlmMetrics } from "../hooks/useLlmMetrics";
import { formatCost } from "../lib/formatters";
import MetricCard from "../components/MetricCard";
import CostTrendChart from "../components/CostTrendChart";
import LlmAnalyticsPanel from "../components/LlmAnalyticsPanel";
import CapabilityGrowthChart from "../components/CapabilityGrowthChart";
import SessionComparison from "../components/SessionComparison";
import ActivityHeatmap from "../components/ActivityHeatmap";
import SankeyFlow from "../components/SankeyFlow";
import TokenSunburst from "../components/TokenSunburst";
import TokenWaterfall from "../components/TokenWaterfall";
import ErrorRateTrend from "../components/ErrorRateTrend";
import SessionDurationHistogram from "../components/SessionDurationHistogram";
import PromptActivityChart from "../components/PromptActivityChart";
import PermissionDecisionsChart from "../components/PermissionDecisionsChart";
import ActiveTimeChart from "../components/ActiveTimeChart";
import ApiErrorPanel from "../components/ApiErrorPanel";
import SectionErrorBoundary from "../components/SectionErrorBoundary";

export default function Analytics() {
  const events = useRecentEvents(100);
  const llmCalls = useLlmMetrics();
  // Swap 1: costByProvider now reads from pre-computed aggregates (D-11, DP-02)
  const costByProvider = useQuery(api.aggregates.costByPeriod, { period: "daily" }) ?? {};
  // Swap 2: error trend aggregate for ErrorRateTrend (child component fetches its own data; this is available for future prop pass)
  const errorTrend = useQuery(api.aggregates.errorTrendByPeriod, { period: "hourly" }) ?? [];
  // Swap 3: event counts aggregate for Total Events MetricCard
  const eventCounts = useQuery(api.aggregates.eventCountsByPeriod, { period: "daily" }) ?? {};
  const totalAggregateEvents = Object.values(eventCounts).reduce((s, v) => s + (v as number), 0);

  const totalCost = Object.values(costByProvider).reduce((s, v) => s + (v as number), 0);
  const totalTokens = llmCalls.reduce((s: number, c: any) => s + (c.totalTokens ?? 0), 0);

  // Suppress unused variable warning — errorTrend is available for future ErrorRateTrend prop swap
  void errorTrend;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Events" value={totalAggregateEvents || events.length} />
        <MetricCard label="LLM Calls" value={llmCalls.length} />
        <MetricCard label="Total Tokens" value={totalTokens.toLocaleString()} />
        <MetricCard label="Total Cost" value={formatCost(totalCost)} />
      </div>

      {/* Cost Trend — full width */}
      <CostTrendChart />

      {/* Two-column: LLM Analytics + Capability Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LlmAnalyticsPanel />
        <CapabilityGrowthChart />
      </div>

      {/* Session Comparison — full width */}
      <SessionComparison />

      {/* Advanced Visualizations */}
      <h2 className="text-lg font-semibold text-gray-200 pt-4">Advanced Visualizations</h2>

      {/* Activity Heatmap — full width */}
      <ActivityHeatmap />

      {/* Sankey + Sunburst — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SankeyFlow />
        <TokenSunburst />
      </div>

      {/* Error Rate + Session Duration — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorRateTrend />
        <SessionDurationHistogram />
      </div>

      {/* Token Waterfall — full width */}
      <TokenWaterfall />

      {/* Claude Code Telemetry */}
      <h2 className="text-lg font-semibold text-gray-200 pt-4">Claude Code Telemetry</h2>

      {/* Prompt Activity — full width */}
      <SectionErrorBoundary name="Prompt Activity">
        <PromptActivityChart />
      </SectionErrorBoundary>

      {/* Permission Decisions + Active Time — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionErrorBoundary name="Permission Decisions">
          <PermissionDecisionsChart />
        </SectionErrorBoundary>
        <SectionErrorBoundary name="Active Time">
          <ActiveTimeChart />
        </SectionErrorBoundary>
      </div>

      {/* API Errors — full width */}
      <SectionErrorBoundary name="API Errors">
        <ApiErrorPanel />
      </SectionErrorBoundary>
    </div>
  );
}
