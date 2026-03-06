interface ProfileCardProps {
  profileId: string;
  metrics: any[];
}

export default function ProfileCard({ profileId, metrics }: ProfileCardProps) {
  const now = Date.now() / 1000;
  const recentThreshold = 300; // 5 minutes
  const hasRecentActivity = metrics.some(
    (m) => now - m.timestamp < recentThreshold
  );

  // Extract key metrics
  const costToday = metrics
    .filter((m) => m.metric === "cost")
    .reduce((sum: number, m: any) => sum + m.value, 0);
  const messageCount = metrics.filter((m) => m.metric === "message_count").length
    ? metrics
        .filter((m) => m.metric === "message_count")
        .reduce((sum: number, m: any) => sum + m.value, 0)
    : 0;
  const rateLimitMetric = metrics.find((m) => m.metric === "rate_limit_percent");
  const rateLimitPct = rateLimitMetric ? rateLimitMetric.value : 0;
  const activeJobs = metrics.filter(
    (m) => m.metric === "active_jobs"
  );
  const activeJobCount = activeJobs.length
    ? activeJobs[activeJobs.length - 1].value
    : 0;

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`h-2 w-2 rounded-full ${hasRecentActivity ? "bg-green-400" : "bg-gray-600"}`}
        />
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
    </div>
  );
}
