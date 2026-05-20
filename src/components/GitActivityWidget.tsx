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
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden flex flex-col max-h-[450px] hover:border-primary/50 transition-colors shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Git Activity
        <InfoTooltip text="Git activity: commits, pull requests, and lines of code changed over time" />
      </h2>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-6 text-[10px] uppercase font-mono tracking-widest">
          <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
            <p className="text-primary/70 mb-1">Commits</p>
            <p className="text-sm font-bold tracking-tight text-indigo-400">
              {summary.commits}
            </p>
          </div>
          <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
            <p className="text-primary/70 mb-1">PRs</p>
            <p className="text-sm font-bold tracking-tight text-primary">
              {summary.pullRequests}
            </p>
          </div>
          <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
            <p className="text-primary/70 mb-1">+ Lines</p>
            <p className="text-sm font-bold tracking-tight text-green-400">
              +{summary.linesAdded}
            </p>
          </div>
          <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
            <p className="text-primary/70 mb-1">- Lines</p>
            <p className="text-sm font-bold tracking-tight text-red-400">
              -{summary.linesRemoved}
            </p>
          </div>
        </div>
      )}

      {chartData.length > 0 ? (
        <FlexBarChart data={chartData} height={200} />
      ) : (
        <p className="text-xs font-mono text-muted-foreground py-4 text-center">
          No chart data available
        </p>
      )}
    </div>
  );
}
