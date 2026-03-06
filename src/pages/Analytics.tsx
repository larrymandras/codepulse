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
    </div>
  );
}
