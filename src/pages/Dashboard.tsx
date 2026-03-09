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

export default function Dashboard() {
  const events = useRecentEvents(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Hero Stats Bar — replaces 3 rows of MetricCards */}
      <HeroStatsBar />

      {/* Activity Pulse */}
      <PulseChart events={events} />

      {/* Agent Topology */}
      <AgentTopology />

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <ActiveSessions />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DockerPanel />
            <ToolBreakdown events={events} />
          </div>
          <DriftTimeline />
        </div>

        {/* Right 1/3 */}
        <div className="space-y-6">
          <EventFeed />
          <LlmProviderPanel />
        </div>
      </div>
    </div>
  );
}
