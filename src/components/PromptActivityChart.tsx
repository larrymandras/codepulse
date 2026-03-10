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
    hour: d.hour.slice(11) + ":00",
    count: d.count,
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

      {/* Area chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="promptGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="hour"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              stroke="#4b5563"
              interval={2}
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
              formatter={(value: any) => [value, "Prompts"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#818cf8"
              strokeWidth={2}
              fill="url(#promptGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-500 py-4 text-center">
          Awaiting hourly data...
        </p>
      )}
    </div>
  );
}
