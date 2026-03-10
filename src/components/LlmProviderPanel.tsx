import { useLlmMetrics } from "../hooks/useLlmMetrics";
import { formatCost } from "../lib/formatters";
import InfoTooltip from "./InfoTooltip";

export default function LlmProviderPanel() {
  const calls = useLlmMetrics();

  const totalCalls = calls.length;
  const totalTokens = calls.reduce(
    (sum: number, c: any) => sum + (c.totalTokens ?? 0),
    0
  );
  const totalCost = calls.reduce((sum: number, c: any) => sum + (c.cost ?? 0), 0);
  const avgLatency =
    totalCalls > 0
      ? calls.reduce((sum: number, c: any) => sum + (c.latencyMs ?? 0), 0) / totalCalls
      : 0;

  // Group by model
  const byModel = new Map<string, { count: number; cost: number; tokens: number }>();
  for (const c of calls as any[]) {
    const model = c.model ?? "unknown";
    const existing = byModel.get(model) ?? { count: 0, cost: 0, tokens: 0 };
    existing.count += 1;
    existing.cost += c.cost ?? 0;
    existing.tokens += c.totalTokens ?? 0;
    byModel.set(model, existing);
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">LLM Metrics<InfoTooltip text="LLM usage metrics: API calls, token consumption, cost, and latency by provider and model" /></h2>
      {totalCalls === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No LLM calls recorded</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500">Calls</p>
              <p className="text-gray-200 font-semibold">{totalCalls}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500">Tokens</p>
              <p className="text-gray-200 font-semibold">{totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500">Cost</p>
              <p className="text-gray-200 font-semibold">{formatCost(totalCost)}</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-2">
              <p className="text-gray-500">Avg Latency</p>
              <p className="text-gray-200 font-semibold">{avgLatency.toFixed(0)}ms</p>
            </div>
          </div>

          <div className="border-t border-gray-700/30 pt-2">
            <p className="text-xs text-gray-500 mb-1">By Model</p>
            {Array.from(byModel.entries())
              .sort((a, b) => b[1].cost - a[1].cost)
              .map(([model, stats]) => (
                <div key={model} className="flex justify-between text-xs py-0.5">
                  <span className="text-gray-400 font-mono">{model}</span>
                  <span className="text-gray-300">
                    {stats.count} calls &middot; {formatCost(stats.cost)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
