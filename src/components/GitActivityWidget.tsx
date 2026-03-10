import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import InfoTooltip from "./InfoTooltip";

export default function GitActivityWidget() {
  const summary = useQuery(api.gitActivity.summary);
  const activity = useQuery(api.gitActivity.recentActivity) ?? [];

  if (!summary && activity.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Git Activity<InfoTooltip text="Git activity: commits, pull requests, and lines of code changed over time" />
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">No data yet</p>
      </div>
    );
  }

  // Group activity by day for chart
  const byDay: Record<string, { commits: number; prs: number }> = {};
  for (const event of activity) {
    const day = new Date(event.timestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    if (!byDay[day]) byDay[day] = { commits: 0, prs: 0 };
    if (event.type === "commit") byDay[day].commits++;
    if (event.type === "pull_request") byDay[day].prs++;
  }

  const chartData = Object.entries(byDay)
    .map(([day, counts]) => ({ day, ...counts }))
    .reverse();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Git Activity<InfoTooltip text="Git activity: commits, pull requests, and lines of code changed over time" />
      </h2>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-900/50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">Commits</p>
            <p className="text-sm font-bold text-indigo-400">
              {summary.commits}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">PRs</p>
            <p className="text-sm font-bold text-emerald-400">
              {summary.pullRequests}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">+ Lines</p>
            <p className="text-sm font-bold text-green-400">
              +{summary.linesAdded}
            </p>
          </div>
          <div className="bg-gray-900/50 rounded-lg px-2 py-1.5 text-center">
            <p className="text-[10px] text-gray-400">- Lines</p>
            <p className="text-sm font-bold text-red-400">
              -{summary.linesRemoved}
            </p>
          </div>
        </div>
      )}

      {/* Area chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="commitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="prGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="day"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              stroke="#4b5563"
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              stroke="#4b5563"
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="commits"
              stroke="#818cf8"
              strokeWidth={2}
              fill="url(#commitGrad)"
            />
            <Area
              type="monotone"
              dataKey="prs"
              stroke="#34d399"
              strokeWidth={2}
              fill="url(#prGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-500 py-4 text-center">
          No chart data available
        </p>
      )}
    </div>
  );
}
