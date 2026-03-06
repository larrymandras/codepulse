import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useContextHistory } from "../hooks/useContextSnapshots";

interface ContextHistoryProps {
  sessionId: string;
}

export default function ContextHistory({ sessionId }: ContextHistoryProps) {
  const snapshots = useContextHistory(sessionId);

  const data = [...snapshots]
    .reverse()
    .map((s) => {
      const date = new Date(s.timestamp * 1000);
      return {
        time: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
        tokens: s.contextTokens ?? 0,
      };
    });

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Context History</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No context data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="contextGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#eab308" stopOpacity={0.2} />
                <stop offset="75%" stopColor="#f97316" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              allowDecimals={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [(value ?? 0).toLocaleString(), "Tokens"]}
            />
            <Area
              type="monotone"
              dataKey="tokens"
              stroke="#22c55e"
              fill="url(#contextGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
