import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function ErrorRateTrend() {
  const data = useQuery(api.analytics.errorRateTrend) ?? [];

  if (data.length === 0 || data.every((d) => d.errors === 0)) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Error Rate Trend (24h)
        </h2>
        <p className="text-gray-500 text-sm">No errors in the last 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">
        Error Rate Trend (24h)
      </h2>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            interval={3}
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
            formatter={(value: any) => [value, "Errors"]}
          />
          <Area
            type="monotone"
            dataKey="errors"
            stroke="#ef4444"
            strokeWidth={2}
            fill="url(#errorGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
