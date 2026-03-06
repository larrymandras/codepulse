interface RateLimitGaugesProps {
  profiles: Record<string, any[]>;
}

function getBarColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-orange-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-green-500";
}

export default function RateLimitGauges({ profiles }: RateLimitGaugesProps) {
  const gauges: { profileId: string; pct: number }[] = [];

  for (const [profileId, metrics] of Object.entries(profiles)) {
    const rlMetric = (metrics as any[]).find(
      (m) => m.metric === "rate_limit_percent"
    );
    if (rlMetric) {
      gauges.push({ profileId, pct: rlMetric.value });
    }
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Rate Limit Usage</h2>
      {gauges.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">
          No rate limit data available
        </p>
      ) : (
        <div className="space-y-3">
          {gauges.map(({ profileId, pct }) => (
            <div key={profileId} className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-mono w-32 truncate">
                {profileId}
              </span>
              <div className="flex-1 bg-gray-900/50 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(pct)}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-300 w-10 text-right font-semibold">
                {pct.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
