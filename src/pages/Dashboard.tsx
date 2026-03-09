import { useRecentEvents } from "../hooks/useRecentEvents";
import EventFeed from "../components/EventFeed";
import ActiveSessions from "../components/ActiveSessions";
import PulseChart from "../components/PulseChart";
import AgentTopology from "../components/AgentTopology";
import ToolBreakdown from "../components/ToolBreakdown";
import DockerPanel from "../components/DockerPanel";
import LlmProviderPanel from "../components/LlmProviderPanel";
import HeroStatsBar from "../components/HeroStatsBar";
import DriftTimeline from "../components/DriftTimeline";
import SectionErrorBoundary from "../components/SectionErrorBoundary";

export default function Dashboard() {
  const events = useRecentEvents(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Hero Stats Bar — replaces 3 rows of MetricCards */}
      <SectionErrorBoundary name="Hero Stats">
        <HeroStatsBar />
      </SectionErrorBoundary>

      {/* Activity Pulse */}
      <SectionErrorBoundary name="Activity Pulse">
        <PulseChart events={events} />
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
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
          <SectionErrorBoundary name="Event Feed">
            <EventFeed />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="LLM Providers">
            <LlmProviderPanel />
          </SectionErrorBoundary>
        </div>
      </div>
    </div>
  );
}
