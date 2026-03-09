import type { ProfileMetric } from "../types";

interface Channel {
  type: string;
  status?: string;
}

interface Budget {
  spent?: number;
  limit?: number;
  period?: string;
}

interface ProfileCardProps {
  profileId: string;
  metrics: ProfileMetric[];
  channels?: Channel[];
  budget?: Budget;
  agentCount?: number;
  runningAgentCount?: number;
}

export default function ProfileCard({
  profileId,
  metrics,
  channels,
  budget,
  agentCount,
  runningAgentCount,
}: ProfileCardProps) {
  const now = Date.now() / 1000;
  const recentThreshold = 300; // 5 minutes
  const hasRecentActivity = metrics.some(
    (m) => now - m.timestamp < recentThreshold
  );

  // Extract key metrics
  const costToday = metrics
    .filter((m) => m.metric === "cost")
    .reduce((sum, m) => sum + m.value, 0);
  const messageCount = metrics.filter((m) => m.metric === "message_count").length
    ? metrics
        .filter((m) => m.metric === "message_count")
        .reduce((sum, m) => sum + m.value, 0)
    : 0;
  const rateLimitMetric = metrics.find((m) => m.metric === "rate_limit_percent");
  const rateLimitPct = rateLimitMetric ? rateLimitMetric.value : 0;
  const activeJobs = metrics.filter(
    (m) => m.metric === "active_jobs"
  );
  const activeJobCount = activeJobs.length
    ? activeJobs[activeJobs.length - 1].value
    : 0;

  // Budget calculations
  const budgetSpent = budget?.spent ?? 0;
  const budgetLimit = budget?.limit ?? 0;
  const budgetPct = budgetLimit > 0 ? Math.min((budgetSpent / budgetLimit) * 100, 100) : 0;
  const budgetPeriod = budget?.period ?? "daily";

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`h-2 w-2 rounded-full ${hasRecentActivity ? "bg-green-400" : "bg-gray-600"}`}
          aria-hidden="true"
        />
        <span className="sr-only">{hasRecentActivity ? "Recently active" : "Inactive"}</span>
        <h3 className="text-sm font-mono text-gray-200 truncate">{profileId}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-gray-500">Cost Today</p>
          <p className="text-gray-200 font-semibold">${costToday.toFixed(4)}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-gray-500">Messages</p>
          <p className="text-gray-200 font-semibold">{messageCount}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-gray-500">Rate Limit</p>
          <p className="text-gray-200 font-semibold">{rateLimitPct.toFixed(0)}%</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-gray-500">Active Jobs</p>
          <p className="text-gray-200 font-semibold">{activeJobCount}</p>
        </div>
      </div>

      {/* Extended info section */}
      <div className="border-t border-gray-700/50 mt-3 pt-3 space-y-2 text-xs">
        {/* Channel health */}
        {channels && channels.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-500">Channels:</span>
            {channels.map((ch) => {
              const isActive = ch.status === "active";
              return (
                <span key={ch.type} className="flex items-center gap-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                  <span className={isActive ? "text-gray-300" : "text-gray-500"}>
                    {ch.type}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Channels:</span>
            <span className="text-gray-600">none configured</span>
          </div>
        )}

        {/* Agent count */}
        {agentCount !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Agents:</span>
            <span className="text-gray-300">
              {agentCount} agent{agentCount !== 1 ? "s" : ""}
              {runningAgentCount !== undefined && runningAgentCount > 0 && (
                <span className="text-green-400 ml-1">
                  ({runningAgentCount} running)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Budget bar */}
        {budgetLimit > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-500">Budget ({budgetPeriod})</span>
              <span className="text-gray-300">
                ${budgetSpent.toFixed(2)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-1.5 bg-gray-900/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct > 90
                    ? "bg-red-400"
                    : budgetPct > 70
                      ? "bg-yellow-400"
                      : "bg-green-400"
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
