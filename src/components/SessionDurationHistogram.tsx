import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

export default function SessionDurationHistogram() {
  const data = useQuery(api.analytics.sessionDurations) ?? [];

  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Session Duration Distribution<InfoTooltip text="Distribution of completed session durations grouped into time buckets" />
        </h2>
        <p className="text-gray-500 text-sm">No completed sessions yet.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ label: d.label, value: d.count }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Session Duration Distribution
      </h2>
      <FlexBarChart data={chartData} height={260} />
    </div>
  );
}
