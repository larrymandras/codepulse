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

const PROFILE_META: Record<string, { name: string; emoji: string; color: string; description: string }> = {
  personal: {
    name: "Personal",
    emoji: "🍎",
    color: "#4ADE80",
    description: "Personal life — family, health, travel, learning",
  },
  business: {
    name: "Business",
    emoji: "⚡",
    color: "#FBBF24",
    description: "CTO operations — code, architecture, vendor management",
  },
  consulting: {
    name: "Consulting",
    emoji: "🛡️",
    color: "#60A5FA",
    description: "Client delivery — SOWs, milestones, BD pipeline",
  },
};

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

  const meta = PROFILE_META[profileId];

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-4">
      <div className="flex items-center gap-3 mb-1">
        {meta ? (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: meta.color + "20" }}
          >
            {meta.emoji}
          </div>
        ) : (
          <span
            className={`h-2 w-2 rounded-full flex-shrink-0 ${hasRecentActivity ? "bg-green-400" : "bg-muted-foreground"}`}
            aria-hidden="true"
          />
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">
            {meta?.name ?? profileId}
          </h3>
          {meta?.description && (
            <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
          )}
        </div>
        {!meta && (
          <span className="sr-only">{hasRecentActivity ? "Recently active" : "Inactive"}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-background/50 rounded-lg p-2">
          <p className="text-muted-foreground">Cost Today</p>
          <p className="text-foreground font-semibold">${costToday.toFixed(4)}</p>
        </div>
        <div className="bg-background/50 rounded-lg p-2">
          <p className="text-muted-foreground">Messages</p>
          <p className="text-foreground font-semibold">{messageCount}</p>
        </div>
        <div className="bg-background/50 rounded-lg p-2">
          <p className="text-muted-foreground">Rate Limit</p>
          <p className="text-foreground font-semibold">{rateLimitPct.toFixed(0)}%</p>
        </div>
        <div className="bg-background/50 rounded-lg p-2">
          <p className="text-muted-foreground">Active Jobs</p>
          <p className="text-foreground font-semibold">{activeJobCount}</p>
        </div>
      </div>

      {/* Extended info section */}
      <div className="border-t border-border/50 mt-3 pt-3 space-y-2 text-sm">
        {/* Channel health */}
        {channels && channels.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted-foreground">Channels:</span>
            {channels.map((ch) => {
              const isActive = ch.status === "active";
              return (
                <span key={ch.type} className="flex items-center gap-1">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                  <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
                    {ch.type}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Channels:</span>
            <span className="text-muted-foreground">none configured</span>
          </div>
        )}

        {/* Agent count */}
        {agentCount !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Agents:</span>
            <span className="text-foreground">
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
              <span className="text-muted-foreground">Budget ({budgetPeriod})</span>
              <span className="text-foreground">
                ${budgetSpent.toFixed(2)} / ${budgetLimit.toFixed(2)}
              </span>
            </div>
            <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
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
