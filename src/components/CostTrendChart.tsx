import { FlexBarChart } from "./FlexBarChart";
import { useCostOverTime } from "../hooks/useAnalytics";
import InfoTooltip from "./InfoTooltip";

export default function CostTrendChart() {
  const raw = useCostOverTime();

  // Aggregate cost by time bucket (group by time label)
  const byTime: Record<string, number> = {};
  for (const r of raw) {
    const time = new Date(r.timestamp * 1000).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    byTime[time] = (byTime[time] ?? 0) + r.cost;
  }

  const data = Object.entries(byTime).map(([label, value]) => ({ label, value }));

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Cost Trend<InfoTooltip text="Cumulative cost over time broken down by LLM provider" /></h2>
        <p className="text-gray-500 text-sm">No LLM cost data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Cost Trend (Cumulative)<InfoTooltip text="Cumulative cost over time broken down by LLM provider" /></h2>
      <FlexBarChart data={data} height={300} />
    </div>
  );
}
