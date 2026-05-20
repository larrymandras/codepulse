import { useState, useMemo, useEffect } from "react";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { useLiveState } from "@/hooks/useLiveState";
import { useLiveFlash } from "@/hooks/useLiveFlash";
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import EventFeed from "../components/EventFeed";
import ActiveSessions from "../components/ActiveSessions";
import PulseChart from "../components/PulseChart";
import ConversationTimeline from "../components/ConversationTimeline";
import AgentTopology from "../components/AgentTopology";
import ToolBreakdown from "../components/ToolBreakdown";
import DockerPanel from "../components/DockerPanel";
import LlmProviderPanel from "../components/LlmProviderPanel";
import HeroStatsBar from "../components/HeroStatsBar";
import DriftTimeline from "../components/DriftTimeline";
import ToolExecutionPanel from "../components/ToolExecutionPanel";
import GitActivityWidget from "../components/GitActivityWidget";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import OperatorScoreCard from "../components/OperatorScoreCard";

type ChartTab = "pulse" | "timeline";

export default function Dashboard() {
  const { events } = useRecentEvents(100);
  const [chartTab, setChartTab] = useState<ChartTab>("pulse");

  // Live WS state for metric delta overlay on hero stats
  const dashTopics = useMemo(() => ["health", "executions", "agents"], []);
  const { isLive } = useLiveState({ topics: dashTopics });
  const { flashRef: heroFlashRef, triggerFlash: triggerHeroFlash } = useLiveFlash();
  const { subscribeEvent } = useAstridrWS();

  // Flash hero stats on any relevant metric update
  useEffect(() => {
    const unsubMetric = subscribeEvent("metric_delta", () => {
      triggerHeroFlash();
    });
    const unsubExecStart = subscribeEvent("execution_start", () => {
      triggerHeroFlash();
    });
    const unsubAgentStatus = subscribeEvent("agent_status_change", () => {
      triggerHeroFlash();
    });
    return () => {
      unsubMetric();
      unsubExecStart();
      unsubAgentStatus();
    };
  }, [subscribeEvent, triggerHeroFlash]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Operator Score Hero Card (Phase 120) */}
      <SectionErrorBoundary name="Operator Score">
        <OperatorScoreCard />
      </SectionErrorBoundary>

      {/* Hero Stats Bar */}
      <SectionErrorBoundary name="Live Metrics">
        <div ref={heroFlashRef}>
          <HeroStatsBar />
        </div>
      </SectionErrorBoundary>

      {/* Activity Charts with Tab Toggle */}
      <SectionErrorBoundary name="Activity Charts">
        <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl relative group overflow-hidden hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
          <div className="flex items-center gap-6 p-4 pb-0 border-b border-border/50">
            <button
              onClick={() => setChartTab("pulse")}
              className={`text-[10px] pb-3 uppercase tracking-widest font-mono transition-colors border-b-2 ${
                chartTab === "pulse"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-gray-200"
              }`}
            >
              Activity Pulse
            </button>
            <button
              onClick={() => setChartTab("timeline")}
              className={`text-[10px] pb-3 uppercase tracking-widest font-mono transition-colors border-b-2 ${
                chartTab === "timeline"
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-gray-200"
              }`}
            >
              Conversation Timeline
            </button>
          </div>
          <div className="p-0 bg-grid-pattern min-h-[300px]">
            {chartTab === "pulse" ? (
              <PulseChart events={events} />
            ) : (
              <ConversationTimeline />
            )}
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Agent Topology */}
      <SectionErrorBoundary name="Agent Topology">
        <AgentTopology />
      </SectionErrorBoundary>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <SectionErrorBoundary name="Active Sessions">
            <ActiveSessions />
          </SectionErrorBoundary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SectionErrorBoundary name="Docker">
              <DockerPanel />
            </SectionErrorBoundary>
            <SectionErrorBoundary name="Tool Breakdown">
              <ToolBreakdown events={events} />
            </SectionErrorBoundary>
          </div>
          <SectionErrorBoundary name="Drift Timeline">
            <DriftTimeline />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Tool Executions">
            <ToolExecutionPanel />
          </SectionErrorBoundary>
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
          <SectionErrorBoundary name="Event Feed">
            <EventFeed />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="LLM Providers">
            <LlmProviderPanel />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Git Activity">
            <GitActivityWidget />
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
