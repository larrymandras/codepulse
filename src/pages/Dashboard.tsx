import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { useActiveSessions } from "../hooks/useActiveSessions";
import { useLlmMetrics } from "../hooks/useLlmMetrics";
import { formatCost } from "../lib/formatters";
import MetricCard from "../components/MetricCard";
import EventFeed from "../components/EventFeed";
import ActiveSessions from "../components/ActiveSessions";
import PulseChart from "../components/PulseChart";
import AgentTopology from "../components/AgentTopology";
import ToolBreakdown from "../components/ToolBreakdown";
import DockerPanel from "../components/DockerPanel";
import LlmProviderPanel from "../components/LlmProviderPanel";

export default function Dashboard() {
  const events = useRecentEvents(100);
  const sessions = useActiveSessions();
  const llmCalls = useLlmMetrics();
  const alerts = useQuery(api.alerts.listActive) ?? [];
  const tools = useQuery(api.registry.listTools) ?? [];
  const agents = useQuery(api.agents.listRunning) ?? [];
  const securityEvents = useQuery(api.security.recentEvents) ?? [];
  const selfHealingHealth = useQuery(api.selfHealing.componentHealth) ?? [];
  const supabaseHealth = useQuery(api.supabase.currentHealth) ?? [];

  // Computed metrics
  const totalCost = llmCalls.reduce((s: number, c: any) => s + (c.cost ?? 0), 0);
  const errorsThisHour = events.filter(
    (e: any) => e.eventType === "Error" && e.timestamp > Date.now() / 1000 - 3600
  ).length;
  const healthyComponents = selfHealingHealth.filter(
    (c: any) => c.outcome === "resolved"
  ).length;
  const totalComponents = selfHealingHealth.length;
  const uptimeLabel = totalComponents > 0
    ? `${healthyComponents}/${totalComponents}`
    : "100%";

  // Supabase summary
  const supabaseOk = supabaseHealth.filter((s: any) => s.status === "healthy").length;
  const supabaseTotal = supabaseHealth.length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Row 1: Core build-time metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Active Sessions" value={sessions.length} />
        <MetricCard label="Total Agents" value={agents.length} />
        <MetricCard label="Errors This Hour" value={errorsThisHour} />
        <MetricCard
          label="Alerts"
          value={alerts.length}
          trend={alerts.length > 0 ? "up" : undefined}
        />
      </div>

      {/* Row 2: Capabilities + runtime */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Known Tools" value={tools.length} />
        <MetricCard label="LLM Calls" value={llmCalls.length} />
        <MetricCard label="Cost Today" value={formatCost(totalCost)} />
        <MetricCard label="Security Events" value={securityEvents.length} />
      </div>

      {/* Row 3: Ástríðr Runtime summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Docker</p>
          <p className="text-lg font-semibold text-gray-100 mt-1">
            <span className="text-green-400">{useQuery(api.docker.currentStatus)?.length ?? 0}</span>
            <span className="text-gray-500 text-sm ml-1">containers</span>
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Supabase</p>
          <p className="text-lg font-semibold text-gray-100 mt-1">
            {supabaseTotal > 0 ? (
              <>
                <span className={supabaseOk === supabaseTotal ? "text-green-400" : "text-yellow-400"}>
                  {supabaseOk}/{supabaseTotal}
                </span>
                <span className="text-gray-500 text-sm ml-1">healthy</span>
              </>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </p>
        </div>
        <MetricCard label="Self-Healing" value={uptimeLabel} />
        <MetricCard label="Recent Events" value={events.length} />
      </div>

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
