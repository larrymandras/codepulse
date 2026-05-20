import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import { formatCost } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

export default function LlmAnalyticsPanel() {
  const providerData = useQuery(api.llm.providerBreakdown) ?? [];
  const costByModel = useQuery(api.llm.costByModel) ?? {};

  const modelRows = Object.entries(costByModel)
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.cost - a.cost);

  const barData = providerData.map((p) => ({
    label: p.provider,
    value: p.calls,
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 space-y-6">
      <div>
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Provider Comparison<InfoTooltip text="Detailed LLM analytics: provider comparison and per-model performance breakdown" /></h2>
        {barData.length === 0 ? (
          <p className="text-gray-500 text-sm">No provider data yet.</p>
        ) : (
          <FlexBarChart data={barData} height={220} />
        )}
      </div>

      <div>
        <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Model Breakdown</h2>
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
