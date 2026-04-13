import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
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

  // Group activity by day for chart (total events per day)
  const byDay: Record<string, number> = {};
  for (const event of activity) {
    const day = new Date(event.timestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  const chartData = Object.entries(byDay)
    .map(([label, value]) => ({ label, value }))
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

      {chartData.length > 0 ? (
        <FlexBarChart data={chartData} height={200} />
      ) : (
        <p className="text-sm text-gray-500 py-4 text-center">
          No chart data available
        </p>
      )}
    </div>
  );
}
