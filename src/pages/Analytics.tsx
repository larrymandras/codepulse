import UnpricedModelsNudge from "../components/UnpricedModelsNudge";
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
import CostBreakdownTable from "../components/CostBreakdownTable";
import GatewayQuotaPanel from "../components/GatewayQuotaPanel";
import ProviderComparisonChart from "../components/ProviderComparisonChart";
import RoutingDecisionsTable from "../components/RoutingDecisionsTable";
import GatewayTasksPanel from "../components/GatewayTasksPanel";
import LlmProviderPanel from "../components/LlmProviderPanel";
import { SectionHeader } from "../components/SectionHeader";
import { GlassPanel } from "../components/GlassPanel";
import { PageHeader } from "../components/PageHeader";
import TotalEventsCard from "../components/analytics/TotalEventsCard";
import LlmVolumeCards from "../components/analytics/LlmVolumeCards";
import CacheHitRateCard from "../components/analytics/CacheHitRateCard";
import ApiSpendCard from "../components/analytics/ApiSpendCard";
import PromptCachePanel from "../components/analytics/PromptCachePanel";
import RecentLlmCallsPanel from "../components/analytics/RecentLlmCallsPanel";
import ExecutionDepthPanel from "../components/analytics/ExecutionDepthPanel";
import AdvisorStrategyPanel from "../components/analytics/AdvisorStrategyPanel";

/**
 * Composition-only page (Phase 121 D-01/D-02). `Analytics()` fetches nothing —
 * it lays out boundaries and the components they wrap. Every query that used
 * to be hoisted here now lives inside one of the eight `src/components/
 * analytics/*` components, each a `SectionErrorBoundary` ancestor of its own
 * throw. A query throwing during render used to unmount this whole function's
 * output (the 2026-08-11 blackout); now it can only take down the one
 * boundary-wrapped child that owns it.
 *
 * Any new data need on this page is a new self-fetching child rendered inside
 * a `SectionErrorBoundary`, never a hook call added to this function body.
 * `src/pages/Analytics.test.tsx`'s per-query fault-injection cases are the
 * proof; plan 121-05 adds a structural ratchet over this file's shape.
 */
export default function Analytics() {
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" className="col-span-12 mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
        {/* Unpriced Models Nudge — full-width, above the fold, no GlassPanel chrome (D-03) */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Unpriced Models">
            <UnpricedModelsNudge />
          </SectionErrorBoundary>
        </div>

        {/* Top Row */}
        <div className="md:col-span-8">
          <SectionErrorBoundary name="Cost Forecast">
             <GlassPanel className="p-4 h-full">
               <CostForecastPanel />
             </GlassPanel>
          </SectionErrorBoundary>
        </div>
        <div className="md:col-span-4">
           {/* SDK Spend Cap */}
           <SectionErrorBoundary name="SDK Spend Cap">
             <GlassPanel className="p-4 h-full">
               <SDKSpendGuard />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Summary Row — four cards, each its own boundary (D-01/D-02): one
            failing query costs one card, not the whole row. */}
        <div className="md:col-span-12">
           <GlassPanel className="p-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <SectionErrorBoundary name="Total Events">
                    <TotalEventsCard />
                  </SectionErrorBoundary>
                  <SectionErrorBoundary name="LLM Volume">
                    <LlmVolumeCards />
                  </SectionErrorBoundary>
                  <SectionErrorBoundary name="Cache Hit Rate">
                    <CacheHitRateCard />
                  </SectionErrorBoundary>
                  <SectionErrorBoundary name="API Spend">
                    <ApiSpendCard />
                  </SectionErrorBoundary>
              </div>
           </GlassPanel>
        </div>

        {/* Prompt Cache by Model (24h) — main agent caches a large stable prefix; the haiku classifier's prefix is below the cache minimum */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Prompt Cache">
            <GlassPanel className="p-4">
              <PromptCachePanel />
            </GlassPanel>
          </SectionErrorBoundary>
        </div>

        {/* Recent LLM Calls — bounded, paginated; rows deep-link to the session's Trace tab (TRACE-02) */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Recent LLM Calls">
            <GlassPanel className="p-4">
              <RecentLlmCallsPanel />
            </GlassPanel>
          </SectionErrorBoundary>
        </div>

        {/* Cost Trend & Gateway Quota */}
        <div className="md:col-span-8">
           <SectionErrorBoundary name="Cost Trend">
             <GlassPanel className="p-4 h-full">
               <CostTrendChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-4">
           <SectionErrorBoundary name="Gateway Quota">
             <GlassPanel className="p-4 h-full">
               <GatewayQuotaPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Cost Breakdown — per-provider/per-model table with Unpriced rows (COST-01) */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Cost Breakdown">
            <GlassPanel className="p-4">
              <CostBreakdownTable />
            </GlassPanel>
          </SectionErrorBoundary>
        </div>

        {/* LLM Analytics & Capability Growth */}
        {/* Boundary added 2026-08-01: this was one of the few panels on the page
            NOT wrapped, so when its `llm:providerBreakdown` query timed out
            ("too many system operations") the unhandled query-hook throw
            unmounted the whole React tree and blanked ALL of Analytics rather
            than just this widget. 35 sibling sections were already wrapped. */}
        <div className="md:col-span-6">
           <SectionErrorBoundary name="LLM Analytics">
             <GlassPanel className="p-4 h-full">
               <LlmAnalyticsPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-6">
           <SectionErrorBoundary name="Capability Growth">
             <GlassPanel className="p-4 h-full">
               <CapabilityGrowthChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Session Comparison */}
        <div className="md:col-span-12">
           <SectionErrorBoundary name="Session Comparison">
             <GlassPanel className="p-4">
               <SessionComparison />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12 mt-4">
          <SectionHeader title="Advanced Visualizations" />
        </div>

        {/* Heatmap */}
        <div className="md:col-span-12">
           <SectionErrorBoundary name="Activity Heatmap">
             <GlassPanel className="p-4">
               <ActivityHeatmap />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Sankey & Sunburst */}
        <div className="md:col-span-8">
           <SectionErrorBoundary name="Token Flow">
             <GlassPanel className="p-4 h-full">
               <SankeyFlow />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-4">
           <SectionErrorBoundary name="Token Sunburst">
             <GlassPanel className="p-4 h-full">
               <TokenSunburst />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Error Rate & Session Duration */}
        <div className="md:col-span-6">
           <SectionErrorBoundary name="Error Rate Trend">
             <GlassPanel className="p-4 h-full">
               <ErrorRateTrend />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-6">
           <SectionErrorBoundary name="Session Duration">
             <GlassPanel className="p-4 h-full">
               <SessionDurationHistogram />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Token Waterfall */}
        <div className="md:col-span-12">
           <SectionErrorBoundary name="Token Waterfall">
             <GlassPanel className="p-4">
               <TokenWaterfall />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12 mt-4">
          <SectionHeader title="Agent Telemetry" />
        </div>

        <div className="md:col-span-12">
           <SectionErrorBoundary name="Prompt Activity">
             <GlassPanel className="p-4">
               <PromptActivityChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-6">
           <SectionErrorBoundary name="LLM by Provider">
             <GlassPanel className="p-4 h-full">
               <LlmProviderPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-6">
           <SectionErrorBoundary name="Provider Comparison">
             <GlassPanel className="p-4 h-full">
               <ProviderComparisonChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12">
           <SectionErrorBoundary name="Routing Decisions">
             <GlassPanel className="p-4">
               <RoutingDecisionsTable />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12">
           <SectionErrorBoundary name="Gateway Tasks">
             <GlassPanel className="p-4">
               <GatewayTasksPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-8">
           <SectionErrorBoundary name="Permission Decisions">
             <GlassPanel className="p-4 h-full">
               <PermissionDecisionsChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>
        <div className="md:col-span-4">
           <SectionErrorBoundary name="Active Time">
             <GlassPanel className="p-4 h-full">
               <ActiveTimeChart />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12">
           <SectionErrorBoundary name="API Errors">
             <GlassPanel className="p-4">
               <ApiErrorPanel />
             </GlassPanel>
           </SectionErrorBoundary>
        </div>

        {/* Depth Histogram & Advisor Strategy — component owns its own
            GlassPanel(s) + SectionHeader (see ExecutionDepthPanel.tsx /
            AdvisorStrategyPanel.tsx header comments); the page contributes
            only the boundary and grid slot. */}
        <div className="md:col-span-12 mt-4">
           <SectionErrorBoundary name="Execution Depth">
             <ExecutionDepthPanel />
           </SectionErrorBoundary>
        </div>

        <div className="md:col-span-12 mt-4">
           <SectionErrorBoundary name="Advisor Strategy">
             <AdvisorStrategyPanel />
           </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
