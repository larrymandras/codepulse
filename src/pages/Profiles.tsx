import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import MetricCard from "../components/MetricCard";
import ProfileCard from "../components/ProfileCard";
import CostBreakdown from "../components/CostBreakdown";
import RateLimitGauges from "../components/RateLimitGauges";
import LlmProviderPanel from "../components/LlmProviderPanel";
import { formatCost, formatTimestamp } from "../lib/formatters";
import { useProfileConfigs } from "../hooks/useProfileConfigs";
import { useProfileSwitches } from "../hooks/useProfileSwitches";

export default function Profiles() {
  const overview = useQuery(api.profiles.overview) ?? {};
  const profiles = Object.entries(overview);
  const providerBreakdown = useQuery(api.llm.providerBreakdown) ?? [];
  const allAgents = useQuery(api.agents.listAll) ?? [];
  const runningAgents = useQuery(api.agents.listRunning) ?? [];
  const profileConfigs = useProfileConfigs();
  const profileSwitches = useProfileSwitches();

  // Summary calculations
  const totalProfiles = profiles.length;
  const totalLlmCalls = providerBreakdown.reduce((sum, p) => sum + p.calls, 0);
  const totalCost = providerBreakdown.reduce((sum, p) => sum + p.cost, 0);

  // Count "active" profiles — those with activity in the last 5 minutes
  const now = Date.now() / 1000;
  const activeProfiles = profiles.filter(([, metrics]) =>
    (metrics as any[]).some((m) => now - m.timestamp < 300)
  ).length;

  // Build config lookup by profileId
  const configByProfile: Record<string, any> = {};
  for (const cfg of profileConfigs) {
    configByProfile[cfg.profileId] = cfg;
  }

  // Build agent counts per profile (agents may have a sessionId matching profileId pattern)
  // Since agents don't have a direct profileId field, count all agents as shared
  const totalAgentCount = allAgents.length;
  const totalRunningCount = runningAgents.length;

  // Collect all channels across all profiles for the summary
  const allChannels: { profileId: string; type: string; status: string }[] = [];
  for (const cfg of profileConfigs) {
    const channels = cfg.channels;
    if (Array.isArray(channels)) {
      for (const ch of channels) {
        allChannels.push({
          profileId: cfg.profileId,
          type: ch.type ?? "unknown",
          status: ch.status ?? "unknown",
        });
      }
    }
  }

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
          {profiles.map(([profileId, metrics]) => {
            const cfg = configByProfile[profileId];
            const channels = cfg?.channels;
            const budget = cfg?.budget;
            return (
              <ProfileCard
                key={profileId}
                profileId={profileId}
                metrics={metrics as any[]}
                channels={Array.isArray(channels) ? channels : undefined}
                budget={budget}
                agentCount={totalAgentCount}
                runningAgentCount={totalRunningCount}
              />
            );
          })}
        </div>
      )}

      {/* Profile Activity Timeline */}
      {profileSwitches.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Profile Switch Timeline
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {profileSwitches.map((sw: any) => (
              <div
                key={sw._id}
                className="flex items-start gap-3 text-xs border-l-2 border-gray-700 pl-3 py-1"
              >
                <span className="text-gray-500 whitespace-nowrap shrink-0">
                  {formatTimestamp(sw.timestamp)}
                </span>
                <div>
                  <span className="text-gray-400">{sw.fromProfile}</span>
                  <span className="text-gray-600 mx-1">&rarr;</span>
                  <span className="text-gray-200">{sw.toProfile}</span>
                  {sw.reason && (
                    <span className="text-gray-500 ml-2">
                      &mdash; {sw.reason}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Channel Health Summary */}
      {allChannels.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-200 mb-3">
            Channel Health Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-700/50">
                  <th className="text-left py-1.5 pr-4">Profile</th>
                  <th className="text-left py-1.5 pr-4">Channel</th>
                  <th className="text-left py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {allChannels.map((ch, i) => (
                  <tr
                    key={`${ch.profileId}-${ch.type}-${i}`}
                    className="border-b border-gray-800/50"
                  >
                    <td className="py-1.5 pr-4 text-gray-300 font-mono">
                      {ch.profileId}
                    </td>
                    <td className="py-1.5 pr-4 text-gray-300 capitalize">
                      {ch.type}
                    </td>
                    <td className="py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            ch.status === "active"
                              ? "bg-green-400"
                              : ch.status === "inactive"
                                ? "bg-red-400"
                                : "bg-gray-500"
                          }`}
                        />
                        <span
                          className={
                            ch.status === "active"
                              ? "text-green-400"
                              : ch.status === "inactive"
                                ? "text-red-400"
                                : "text-gray-500"
                          }
                        >
                          {ch.status}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
