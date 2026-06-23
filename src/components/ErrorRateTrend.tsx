import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

export default function ErrorRateTrend() {
  const data = useQuery(api.analytics.errorRateTrend) ?? [];

  if (data.length === 0 || data.every((d) => d.errors === 0)) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
          Error Rate Trend (24h)<InfoTooltip text="Error count trend over the last 24 hours" />
        </h2>
        <p className="text-gray-500 text-base">No errors in the last 24 hours.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ label: d.label, value: d.errors }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">
        Error Rate Trend (24h)
      </h2>
      <FlexBarChart data={chartData} height={260} />
    </div>
  );
}
