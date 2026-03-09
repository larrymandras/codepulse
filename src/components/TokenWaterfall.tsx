import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useTokenWaterfall } from "../hooks/useAdvancedAnalytics";

const MODEL_COLORS: Record<string, string> = {
  "claude-opus": "#fbbf24",
  "claude-sonnet": "#22d3ee",
  "claude-haiku": "#34d399",
  opus: "#fbbf24",
  sonnet: "#22d3ee",
  haiku: "#34d399",
  ollama: "#f97316",
};

function getModelColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "#94a3b8";
}

export default function TokenWaterfall() {
  const raw = useTokenWaterfall();

  const { data, models } = useMemo(() => {
    if (raw.length === 0) return { data: [], models: [] as string[] };

    const modelSet = new Set<string>();
    const buckets: Record<number, Record<string, { up: number; down: number }>> = {};

    for (const r of raw) {
      const bucket = Math.floor(r.timestamp / 60) * 60; // 1-min bucket
      if (!buckets[bucket]) buckets[bucket] = {};
      if (!buckets[bucket][r.model]) buckets[bucket][r.model] = { up: 0, down: 0 };
      buckets[bucket][r.model].up += r.completionTokens;
      buckets[bucket][r.model].down += r.promptTokens;
      modelSet.add(r.model);
    }

    const modelList = [...modelSet];
    const sorted = Object.entries(buckets)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([ts, models]) => {
        const time = new Date(Number(ts) * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const row: Record<string, any> = { time };
        for (const m of modelList) {
          row[`${m}_out`] = models[m]?.up ?? 0;
          row[`${m}_in`] = -(models[m]?.down ?? 0);
        }
        return row;
      });

    return { data: sorted, models: modelList };
  }, [raw]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Token Waterfall (30 min)</h2>
        <p className="text-gray-500 text-sm">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Token Waterfall (30 min)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" tick={{ fill: "#9ca3af", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) => `${Math.abs(v)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: any, name: string) => [
              Math.abs(Number(value)).toLocaleString(),
              name.replace(/_out$/, " (output)").replace(/_in$/, " (input)"),
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px" }}
            formatter={(value: string) =>
              value.replace(/_out$/, " ↑").replace(/_in$/, " ↓")
            }
          />
          <ReferenceLine y={0} stroke="#6b7280" />
          {models.map((m) => (
            <Bar
              key={`${m}_out`}
              dataKey={`${m}_out`}
              stackId="stack"
              fill={getModelColor(m)}
              fillOpacity={0.9}
            />
          ))}
          {models.map((m) => (
            <Bar
              key={`${m}_in`}
              dataKey={`${m}_in`}
              stackId="stack"
              fill={getModelColor(m)}
              fillOpacity={0.5}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
