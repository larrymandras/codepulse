import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

export default function ActiveTimeChart() {
  const rawData = useQuery(api.activeTime.recent) ?? [];

  if (rawData.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-base font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Active Time<InfoTooltip text="Daily active time split between user interaction and CLI usage" />
        </h2>
        <p className="text-base text-gray-500 py-4 text-center">No data yet</p>
      </div>
    );
  }

  // Group by day and sum total minutes
  const byDay: Record<string, number> = {};
  for (const entry of rawData) {
    const day = new Date(entry.timestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    byDay[day] = (byDay[day] ?? 0) + entry.durationSeconds / 60;
  }

  const chartData = Object.entries(byDay)
    .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
    .reverse();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-base font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Active Time
      </h2>
      <FlexBarChart data={chartData} height={260} />
    </div>
  );
}
