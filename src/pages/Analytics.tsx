import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRecentEvents } from "../hooks/useRecentEvents";
import { useLlmMetrics } from "../hooks/useLlmMetrics";
import { formatCost } from "../lib/formatters";
import ToolBreakdown from "../components/ToolBreakdown";
import PulseChart from "../components/PulseChart";

export default function Analytics() {
  const events = useRecentEvents(100);
  const llmCalls = useLlmMetrics();
  const costByProvider = useQuery(api.llm.costByProvider) ?? {};

  const totalCost = Object.values(costByProvider).reduce((s, v) => s + (v as number), 0);
  const totalTokens = llmCalls.reduce((s: number, c: any) => s + (c.totalTokens ?? 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Events</p>
          <p className="text-2xl font-bold text-gray-100">{events.length}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-500">LLM Calls</p>
          <p className="text-2xl font-bold text-gray-100">{llmCalls.length}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Tokens</p>
          <p className="text-2xl font-bold text-gray-100">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <p className="text-xs text-gray-500">Total Cost</p>
          <p className="text-2xl font-bold text-gray-100">{formatCost(totalCost)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PulseChart events={events} />
        <ToolBreakdown events={events} />
      </div>

      {Object.keys(costByProvider).length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Cost by Provider</h2>
          <div className="space-y-2">
            {Object.entries(costByProvider)
              .sort((a, b) => (b[1] as number) - (a[1] as number))
              .map(([provider, cost]) => (
                <div key={provider} className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{provider}</span>
                  <span className="text-sm font-mono text-gray-200">{formatCost(cost as number)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
