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
  const costByProvider = useQuery(api.llm.costByProvider) ?? {};

  const totalCost = Object.values(costByProvider).reduce((s, v) => s + (v as number), 0);
  const totalTokens = llmCalls.reduce((s: number, c: any) => s + (c.totalTokens ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>

      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Events" value={events.length} />
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
