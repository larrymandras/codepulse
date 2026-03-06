import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useCostOverTime } from "../hooks/useAnalytics";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "#a78bfa",
  openai: "#34d399",
  google: "#60a5fa",
  mistral: "#f97316",
  cohere: "#f472b6",
};

function getColor(provider: string, idx: number) {
  return PROVIDER_COLORS[provider.toLowerCase()] ?? ["#fbbf24", "#fb923c", "#c084fc", "#22d3ee", "#e879f9"][idx % 5];
}

export default function CostTrendChart() {
  const raw = useCostOverTime();

  // Build cumulative cost per provider over time
  const providers = [...new Set(raw.map((r) => r.provider))];
  const cumulative: Record<string, number> = {};
  providers.forEach((p) => (cumulative[p] = 0));

  const data = raw.map((r) => {
    cumulative[r.provider] = (cumulative[r.provider] ?? 0) + r.cost;
    return {
      timestamp: r.timestamp,
      time: new Date(r.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ...Object.fromEntries(providers.map((p) => [p, cumulative[p]])),
    };
  });

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Cost Trend</h2>
        <p className="text-gray-500 text-sm">No LLM cost data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Cost Trend (Cumulative)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} tickFormatter={(v: any) => `$${v.toFixed(3)}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: any, name: any) => [`$${Number(value).toFixed(4)}`, name]}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {providers.map((provider, i) => (
            <Line
              key={provider}
              type="monotone"
              dataKey={provider}
              stroke={getColor(provider, i)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
