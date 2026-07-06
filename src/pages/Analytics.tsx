import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { useLlmMetrics } from "../hooks/useLlmMetrics";
import { formatCost, formatDurationMs, formatTimestamp } from "../lib/formatters";
import MetricCard, { thresholdColor } from "../components/MetricCard";
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
import CostForecastPanel from "../components/CostForecastPanel";
import SDKSpendGuard from "../components/SDKSpendGuard";
import GatewayQuotaPanel from "../components/GatewayQuotaPanel";
import ProviderComparisonChart from "../components/ProviderComparisonChart";
import RoutingDecisionsTable from "../components/RoutingDecisionsTable";
import GatewayTasksPanel from "../components/GatewayTasksPanel";
import LlmProviderPanel from "../components/LlmProviderPanel";
import AnomalyBadge from "../components/AnomalyBadge";
import { TokenSavingsIndicator } from "../components/TokenSavingsIndicator";
import { FlexBarChart } from "../components/FlexBarChart";
import { SectionHeader } from "../components/SectionHeader";
import { GlassPanel } from "../components/GlassPanel";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../components/ui/table";

/** Deep-link into the session's Trace tab (TRACE-02, D-08). Null-guarded + encoded, mirrors KGDetailsPanel's provenanceHref. */
function traceHref(sessionId?: string | null): string | null {
  return sessionId ? `/sessions/${encodeURIComponent(sessionId)}?tab=trace` : null;
}

export default function Analytics() {
  const { events } = useRecentEvents(100);
  const { calls: llmCalls, status: llmStatus, loadMore: loadMoreLlm } = useLlmMetrics();
  // Phase 67 D-01: Split cost view — API spend (real money) vs Subscription usage (call counts/tokens)
  const apiCostByProvider = useQuery(api.aggregates.costByPeriod, {
    period: "daily",
    billingType: "api",
  }) ?? {};
  const subscriptionUsage = useQuery(api.llm.subscriptionUsage) ?? { calls: 0, tokens: 0 };
  // Prompt-cache hit rate (Anthropic) — verifies caching is actually being hit
  const cacheStats = useQuery(api.llm.cacheStats, {});
  // Keep total cost (all types) for backward compat with existing components
  const costByProvider = useQuery(api.aggregates.costByPeriod, { period: "daily" }) ?? {};
  // Swap 2: error trend aggregate for ErrorRateTrend (child component fetches its own data; this is available for future prop pass)
  const errorTrend = useQuery(api.aggregates.errorTrendByPeriod, { period: "hourly" }) ?? [];
  // Swap 3: event counts aggregate for Total Events MetricCard
  const eventCounts = useQuery(api.aggregates.eventCountsByPeriod, { period: "daily" }) ?? {};
  const totalAggregateEvents = Object.values(eventCounts).reduce((s, v) => s + (v as number), 0);

  const anomalies = useQuery(api.anomalyDetection.getActiveAnomalies) ?? {};

  // Execution depth histogram + Advisor Strategy (CPUX-09)
  const depthHistogram = useQuery(api.advisorEvents.executionDepthHistogram);
  const advisorSavings = useQuery(api.advisorEvents.savingsSummary);
  const advisorRecent = useQuery(api.advisorEvents.recent, { limit: 20 });

  const totalApiSpend = Object.values(apiCostByProvider).reduce((s, v) => s + (v as number), 0);
  const totalCost = Object.values(costByProvider).reduce((s, v) => s + (v as number), 0);
  const totalTokens = llmCalls.reduce((s: number, c: any) => s + (c.totalTokens ?? 0), 0);

  // Suppress unused variable warning — errorTrend is available for future ErrorRateTrend prop swap
  void errorTrend;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between col-span-12 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <div className="flex items-center gap-3">
          <TokenSavingsIndicator savedTokens={0} totalTokens={0} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
        {/* Top Row */}
        <div className="md:col-span-8">
          <SectionErrorBoundary name="Cost Forecast">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <CostForecastPanel />
             </GlassPanel>
          </SectionErrorBoundary>
        </div>
        <div className="md:col-span-4">
           {/* SDK Spend Cap */}
           <SectionErrorBoundary name="SDK Spend Cap">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <SDKSpendGuard />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        
        {/* Summary Row */}
        <div className="md:col-span-12">
           <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-start gap-2">
                    <MetricCard label="Total Events" value={totalAggregateEvents || events.length} />
                    {anomalies.errors && (
                      <AnomalyBadge
                        severity={anomalies.errors.severity as "warning" | "critical"}
                        metric="errors"
                        value={anomalies.errors.value}
                        mean={anomalies.errors.mean}
                        zScore={anomalies.errors.zScore}
                      />
                    )}
                  </div>
                  <MetricCard label="LLM Calls" value={llmCalls.length} />
                  <MetricCard label="Total Tokens" value={totalTokens.toLocaleString()} />
                  <MetricCard
                    label="Cache Hit Rate (24h)"
                    value={cacheStats ? `${(cacheStats.overall.hitRate * 100).toFixed(1)}%` : "--"}
                    numericValue={cacheStats ? cacheStats.overall.hitRate * 100 : undefined}
                    format={(v) => `${v.toFixed(1)}%`}
                    threshold={{ ok: 50, warn: 20, invertDirection: true }}
                  />
                  <div className="flex items-start gap-2">
                    <MetricCard label="API Spend" value={formatCost(totalApiSpend)} />
                    {anomalies.cost && (
                      <AnomalyBadge
                        severity={anomalies.cost.severity as "warning" | "critical"}
                        metric="cost"
                        value={anomalies.cost.value}
                        mean={anomalies.cost.mean}
                        zScore={anomalies.cost.zScore}
                      />
                    )}
                  </div>
              </div>
           </GlassPanel>
        </div>

        {/* Prompt Cache by Model (24h) — main agent caches a large stable prefix; the haiku classifier's prefix is below the cache minimum */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Prompt Cache">
            <GlassPanel className="p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Prompt Cache by Model — last 24h
                </h3>
                <span className="text-xs text-muted-foreground">
                  cache reads bill at ~0.1× input
                </span>
              </div>
              {!cacheStats || cacheStats.byModel.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Anthropic calls in the last 24h.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50">
                        <th className="py-1 pr-4 font-medium">Model</th>
                        <th className="py-1 pr-4 font-medium text-right">Calls</th>
                        <th className="py-1 pr-4 font-medium text-right">Hit Rate</th>
                        <th className="py-1 pr-4 font-medium text-right">Cache Read</th>
                        <th className="py-1 font-medium text-right">Total Prompt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cacheStats.byModel.map((m) => (
                        <tr key={m.model} className="border-b border-border/30 last:border-0">
                          <td className="py-1.5 pr-4 font-mono">{m.model}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{m.calls.toLocaleString()}</td>
                          <td
                            className="py-1.5 pr-4 text-right tabular-nums font-medium"
                            style={{ color: thresholdColor(m.hitRate * 100, { ok: 50, warn: 20, invertDirection: true }) }}
                          >
                            {(m.hitRate * 100).toFixed(1)}%
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">
                            {m.cacheReadInputTokens.toLocaleString()}
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                            {m.totalPromptTokens.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </SectionErrorBoundary>
        </div>

        {/* Recent LLM Calls — bounded, paginated; rows deep-link to the session's Trace tab (TRACE-02) */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Recent LLM Calls">
            <GlassPanel className="p-4">
              <SectionHeader title="Recent LLM Calls" />
              {llmCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No LLM calls recorded yet.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>Cache</TableHead>
                        <TableHead>Trace</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {llmCalls.map((call, i) => {
                        const href = traceHref(call.sessionId);
                        return (
                          <TableRow key={call._id ?? i}>
                            <TableCell className="font-mono text-sm tabular-nums">
                              {formatTimestamp(call.timestamp)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{call.model}</TableCell>
                            <TableCell className="tabular-nums">
                              {call.cost != null ? formatCost(call.cost) : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {formatDurationMs(call.latencyMs)}
                            </TableCell>
                            <TableCell>
                              {call.cacheReadInputTokens === undefined ? (
                                "—"
                              ) : call.cacheReadInputTokens > 0 ? (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={{ borderColor: "var(--status-ok)", color: "var(--status-ok)" }}
                                >
                                  cached
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs"
                                  style={{ borderColor: "var(--status-warn)", color: "var(--status-warn)" }}
                                >
                                  miss
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {href ? (
                                <Link
                                  to={href}
                                  style={{ color: "var(--primary)" }}
                                  className="hover:underline text-sm font-medium"
                                >
                                  View Trace
                                </Link>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {llmStatus === "CanLoadMore" && (
                    <div className="flex justify-center mt-3">
                      <button
                        onClick={() => loadMoreLlm(25)}
                        className="px-3 py-1.5 text-sm font-mono text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </>
              )}
            </GlassPanel>
          </SectionErrorBoundary>
        </div>

        {/* Cost Trend & Gateway Quota */}
        <div className="md:col-span-8">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <CostTrendChart />
           </GlassPanel>
        </div>
        <div className="md:col-span-4">
           <SectionErrorBoundary name="Gateway Quota">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <GatewayQuotaPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        
        {/* LLM Analytics & Capability Growth */}
        <div className="md:col-span-6">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <LlmAnalyticsPanel />
           </GlassPanel>
        </div>
        <div className="md:col-span-6">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <CapabilityGrowthChart />
           </GlassPanel>
        </div>

        {/* Session Comparison */}
        <div className="md:col-span-12">
           <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
             <SessionComparison />
           </GlassPanel>
        </div>

        <div className="md:col-span-12 mt-4">
          <SectionHeader title="Advanced Visualizations" />
        </div>

        {/* Heatmap */}
        <div className="md:col-span-12">
           <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
             <ActivityHeatmap />
           </GlassPanel>
        </div>

        {/* Sankey & Sunburst */}
        <div className="md:col-span-8">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <SankeyFlow />
           </GlassPanel>
        </div>
        <div className="md:col-span-4">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <TokenSunburst />
           </GlassPanel>
        </div>
        
        {/* Error Rate & Session Duration */}
        <div className="md:col-span-6">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <ErrorRateTrend />
           </GlassPanel>
        </div>
        <div className="md:col-span-6">
           <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
             <SessionDurationHistogram />
           </GlassPanel>
        </div>

        {/* Token Waterfall */}
        <div className="md:col-span-12">
           <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
             <TokenWaterfall />
           </GlassPanel>
        </div>
        
        <div className="md:col-span-12 mt-4">
          <SectionHeader title="Agent Telemetry" />
        </div>
        
        <div className="md:col-span-12">
           <SectionErrorBoundary name="Prompt Activity">
             <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
               <PromptActivityChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-6">
           <SectionErrorBoundary name="LLM by Provider">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <LlmProviderPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-6">
           <SectionErrorBoundary name="Provider Comparison">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <ProviderComparisonChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12">
           <SectionErrorBoundary name="Routing Decisions">
             <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
               <RoutingDecisionsTable />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12">
           <SectionErrorBoundary name="Gateway Tasks">
             <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
               <GatewayTasksPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-8">
           <SectionErrorBoundary name="Permission Decisions">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <PermissionDecisionsChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-4">
           <SectionErrorBoundary name="Active Time">
             <GlassPanel className="p-4 h-full hover:scale-[1.01] transition-transform duration-300">
               <ActiveTimeChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        
        <div className="md:col-span-12">
           <SectionErrorBoundary name="API Errors">
             <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
               <ApiErrorPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Depth Histogram & Advisor Strategy */}
        <div className="md:col-span-12 mt-4">
           <SectionErrorBoundary name="Execution Depth">
             <SectionHeader title="Execution Depth Distribution" />
             <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
               {depthHistogram && depthHistogram.length > 0 ? (
                 <FlexBarChart
                   data={depthHistogram.map(d => ({ label: d.label, value: d.count }))}
                   height={120}
                 />
               ) : (
                 <p className="text-base text-muted-foreground">No execution depth data yet.</p>
               )}
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12 mt-4">
           <SectionErrorBoundary name="Advisor Strategy">
             <SectionHeader title="Advisor Strategy" />
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
                 <p className="text-sm text-muted-foreground uppercase tracking-wide">Total Savings</p>
                 <p className="text-2xl font-semibold tabular-nums mt-1">
                   ${(advisorSavings?.totalSavings ?? 0).toFixed(2)}
                 </p>
               </GlassPanel>
               <GlassPanel className="p-4 hover:scale-[1.01] transition-transform duration-300">
                 <p className="text-sm text-muted-foreground uppercase tracking-wide">Escalation Rate</p>
                 <p className="text-2xl font-semibold tabular-nums mt-1">
                   {advisorRecent && advisorRecent.length > 0
                     ? `${Math.round((advisorRecent.filter(e => e.used).length / advisorRecent.length) * 100)}%`
                     : "—"}
                 </p>
               </GlassPanel>
             </div>
             {/* Cost comparison table */}
             <GlassPanel className="p-4 mt-4 hover:scale-[1.01] transition-transform duration-300">
               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Provider</TableHead>
                     <TableHead>Advisor Cost</TableHead>
                     <TableHead>Standard Cost</TableHead>
                     <TableHead>Saved</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {(advisorRecent ?? []).slice(0, 10).map((evt, i) => (
                     <TableRow key={i}>
                       <TableCell className="font-mono text-sm">{evt.provider}</TableCell>
                       <TableCell className="tabular-nums">${evt.costUsd.toFixed(4)}</TableCell>
                       <TableCell className="tabular-nums">${evt.standardCostUsd.toFixed(4)}</TableCell>
                       <TableCell className="tabular-nums" style={{ color: "var(--status-ok)" }}>
                         ${(evt.standardCostUsd - evt.costUsd).toFixed(4)}
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
