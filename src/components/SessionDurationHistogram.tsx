import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
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

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Session Duration Distribution
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#818cf8" stopOpacity={0.9} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: any) => [value, "Sessions"]}
          />
          <Bar
            dataKey="count"
            fill="url(#barGradient)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
