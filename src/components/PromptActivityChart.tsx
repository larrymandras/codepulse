import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

export default function PromptActivityChart() {
  const volumeData = useQuery(api.promptActivity.promptVolume) ?? [];
  const recentPrompts = useQuery(api.promptActivity.recentPrompts) ?? [];

  const totalPrompts = recentPrompts.length;
  const avgLength =
    totalPrompts > 0
      ? Math.round(
          recentPrompts.reduce(
            (s: number, p: any) => s + (p.promptLength ?? 0),
            0
          ) / totalPrompts
        )
      : 0;

  if (volumeData.length === 0 && recentPrompts.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Prompt Activity<InfoTooltip text="User prompt volume and average length over the last 24 hours" />
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">No data yet</p>
      </div>
    );
  }

  const chartData = volumeData.map((d: any) => ({
    label: d.hour.slice(11) + ":00",
    value: d.count,
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Prompt Activity
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400">Total Prompts (24h)</p>
          <p className="text-lg font-bold text-indigo-400">{totalPrompts}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400">Avg Prompt Length</p>
          <p className="text-lg font-bold text-amber-400">
            {avgLength.toLocaleString()} chars
          </p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <FlexBarChart data={chartData} height={240} />
      ) : (
        <p className="text-sm text-gray-500 py-4 text-center">
          Awaiting hourly data...
        </p>
      )}
    </div>
  );
}
