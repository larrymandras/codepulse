import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import ProfileCard from "../components/ProfileCard";
import CostBreakdown from "../components/CostBreakdown";
import RateLimitGauges from "../components/RateLimitGauges";
import LlmProviderPanel from "../components/LlmProviderPanel";
import { formatCost } from "../lib/formatters";

export default function Profiles() {
  const overview = useQuery(api.profiles.overview) ?? {};
  const profiles = Object.entries(overview);
  const providerBreakdown = useQuery(api.llm.providerBreakdown) ?? [];

  // Summary calculations
  const totalProfiles = profiles.length;
  const totalLlmCalls = providerBreakdown.reduce((sum, p) => sum + p.calls, 0);
  const totalCost = providerBreakdown.reduce((sum, p) => sum + p.cost, 0);

  // Count "active" profiles — those with activity in the last 5 minutes
  const now = Date.now() / 1000;
  const activeProfiles = profiles.filter(([, metrics]) =>
    (metrics as any[]).some((m) => now - m.timestamp < 300)
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agent Profiles</h1>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Profiles" value={totalProfiles} />
        <MetricCard label="Total LLM Calls" value={totalLlmCalls} />
        <MetricCard label="Total Cost" value={formatCost(totalCost)} />
        <MetricCard label="Active" value={activeProfiles} />
      </div>

      {/* Profile Cards */}
      {profiles.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-8 text-center">
          <p className="text-gray-500">No profile metrics recorded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profiles.map(([profileId, metrics]) => (
            <ProfileCard
              key={profileId}
              profileId={profileId}
              metrics={metrics as any[]}
            />
          ))}
        </div>
      )}

      {/* Cost Breakdown */}
      <CostBreakdown />

      {/* Rate Limits */}
      <RateLimitGauges profiles={overview} />

      {/* LLM Provider Usage */}
      <LlmProviderPanel />
    </div>
  );
}
