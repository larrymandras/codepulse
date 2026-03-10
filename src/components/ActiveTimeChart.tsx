import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import InfoTooltip from "./InfoTooltip";

export default function ActiveTimeChart() {
  const rawData = useQuery(api.activeTime.recent) ?? [];

  if (rawData.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Active Time<InfoTooltip text="Daily active time split between user interaction and CLI usage" />
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">No data yet</p>
      </div>
    );
  }

  // Group by day and type (user vs cli)
  const byDay: Record<string, { user: number; cli: number }> = {};
  for (const entry of rawData) {
    const day = new Date(entry.timestamp * 1000).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    if (!byDay[day]) byDay[day] = { user: 0, cli: 0 };
    const minutes = entry.durationSeconds / 60;
    if (entry.type === "user") {
      byDay[day].user += minutes;
    } else {
      byDay[day].cli += minutes;
    }
  }

  const chartData = Object.entries(byDay)
    .map(([day, times]) => ({
      day,
      User: Math.round(times.user * 10) / 10,
      CLI: Math.round(times.cli * 10) / 10,
    }))
    .reverse();

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Active Time
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="day"
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            stroke="#4b5563"
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 10 }}
            stroke="#4b5563"
            label={{
              value: "minutes",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#6b7280", fontSize: 10 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: any, name: any) => [
              `${value} min`,
              name,
            ]}
          />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="User" stackId="a" fill="#818cf8" radius={[0, 0, 0, 0]} />
          <Bar dataKey="CLI" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
