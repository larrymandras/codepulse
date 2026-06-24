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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
        {/* Operator Score Hero Card (Phase 120) */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Operator Score">
            <OperatorScoreCard />
          </SectionErrorBoundary>
        </div>

        {/* Hero Stats Bar */}
        <div className="md:col-span-12">
          <SectionErrorBoundary name="Live Metrics">
            <div ref={heroFlashRef}>
              <HeroStatsBar />
            </div>
          </SectionErrorBoundary>
        </div>

        {/* Activity Charts with Tab Toggle (Hero Panel) */}
        <div className="md:col-span-8 flex flex-col">
          <SectionErrorBoundary name="Activity Charts">
            <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl relative group overflow-hidden hover:scale-[1.01] transition-transform duration-300 shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)] h-full flex flex-col">
              <div className="flex items-center gap-6 p-4 pb-0 border-b border-border/50">
                <button
                  onClick={() => setChartTab("pulse")}
                  className={`text-xs pb-3 uppercase tracking-widest font-mono transition-colors border-b-2 ${
                    chartTab === "pulse"
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  Activity Pulse
                </button>
                <button
                  onClick={() => setChartTab("timeline")}
                  className={`text-xs pb-3 uppercase tracking-widest font-mono transition-colors border-b-2 ${
                    chartTab === "timeline"
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  Conversation Timeline
                </button>
              </div>
              <div className="p-0 bg-grid-pattern min-h-[300px] flex-1">
                {chartTab === "pulse" ? (
                  <PulseChart events={events} />
                ) : (
                  <ConversationTimeline />
                )}
              </div>
            </div>
          </SectionErrorBoundary>
        </div>

        {/* Right side topology & sessions */}
        <div className="md:col-span-4 space-y-6">
          <SectionErrorBoundary name="Agent Topology">
            <div className="hover:scale-[1.01] transition-transform duration-300">
              <AgentTopology />
            </div>
          </SectionErrorBoundary>
          
          <SectionErrorBoundary name="Active Sessions">
            <div className="hover:scale-[1.01] transition-transform duration-300">
              <ActiveSessions />
            </div>
          </SectionErrorBoundary>
        </div>

        {/* Mid-sized widgets */}
        <div className="md:col-span-4">
          <SectionErrorBoundary name="Docker">
            <div className="hover:scale-[1.01] transition-transform duration-300 h-full">
              <DockerPanel />
            </div>
          </SectionErrorBoundary>
        </div>
        
        <div className="md:col-span-4">
          <SectionErrorBoundary name="Tool Breakdown">
            <div className="hover:scale-[1.01] transition-transform duration-300 h-full">
              <ToolBreakdown events={events} />
            </div>
          </SectionErrorBoundary>
        </div>

        <div className="md:col-span-4">
          <SectionErrorBoundary name="Event Feed">
            <div className="hover:scale-[1.01] transition-transform duration-300 h-full">
              <EventFeed />
            </div>
          </SectionErrorBoundary>
        </div>

        {/* Lower Left - Wide Widgets */}
        <div className="md:col-span-8 space-y-6">
          <SectionErrorBoundary name="Drift Timeline">
            <div className="hover:scale-[1.01] transition-transform duration-300">
              <DriftTimeline />
            </div>
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Tool Executions">
            <div className="hover:scale-[1.01] transition-transform duration-300">
              <ToolExecutionPanel />
            </div>
          </SectionErrorBoundary>
        </div>

        {/* Lower Right - Tall/List Widgets */}
        <div className="md:col-span-4 space-y-6">
          <SectionErrorBoundary name="LLM Providers">
            <div className="hover:scale-[1.01] transition-transform duration-300">
              <LlmProviderPanel />
            </div>
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Git Activity">
            <div className="hover:scale-[1.01] transition-transform duration-300">
              <GitActivityWidget />
            </div>
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
