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
  Cell,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd", "#818cf8", "#7c3aed"];

export default function CostBreakdown() {
  const costByModel = useQuery(api.llm.costByModel) ?? {};

  const data = Object.entries(costByModel)
    .map(([model, stats]) => ({
      model,
      cost: stats.cost,
      tokens: stats.tokens,
      calls: stats.calls,
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Cost by Model</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No cost data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="model"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              tickFormatter={(v) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: any, _name: any, props: any) => [
                `$${(Number(value) || 0).toFixed(4)} (${(props?.payload?.tokens ?? 0).toLocaleString()} tokens)`,
                "Cost",
              ]}
            />
            <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
              {data.map((_entry, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
