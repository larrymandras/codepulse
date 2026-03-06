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
import { formatCost } from "../lib/formatters";

export default function LlmAnalyticsPanel() {
  const providerData = useQuery(api.llm.providerBreakdown) ?? [];
  const costByModel = useQuery(api.llm.costByModel) ?? {};

  const modelRows = Object.entries(costByModel)
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.cost - a.cost);

  // Compute avgLatency from providerData for bar chart
  const barData = providerData.map((p) => ({
    provider: p.provider,
    calls: p.calls,
    avgLatency: p.avgLatency,
    cost: p.cost,
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Provider Comparison</h2>
        {barData.length === 0 ? (
          <p className="text-gray-500 text-sm">No provider data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis
                dataKey="provider"
                type="category"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: any, name: any) => {
                  if (name === "cost") return [formatCost(Number(value)), "Cost"];
                  if (name === "avgLatency") return [`${value}ms`, "Avg Latency"];
                  return [value, name];
                }}
              />
              <Bar dataKey="calls" fill="#60a5fa" name="calls" />
              <Bar dataKey="avgLatency" fill="#a78bfa" name="avgLatency" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Model Breakdown</h2>
        {modelRows.length === 0 ? (
          <p className="text-gray-500 text-sm">No model data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 pr-3 font-medium">Model</th>
                  <th className="text-right py-2 px-3 font-medium">Calls</th>
                  <th className="text-right py-2 px-3 font-medium">Tokens</th>
                  <th className="text-right py-2 pl-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((row) => (
                  <tr key={row.model} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                    <td className="py-2 pr-3 text-gray-200 font-mono text-xs">{row.model}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{row.calls}</td>
                    <td className="py-2 px-3 text-right text-gray-300">{row.tokens.toLocaleString()}</td>
                    <td className="py-2 pl-3 text-right text-gray-300 font-mono">{formatCost(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
