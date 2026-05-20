import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";

export default function CostBreakdown() {
  const costByModel = useQuery(api.llm.costByModel) ?? {};

  const data = Object.entries(costByModel)
    .map(([model, stats]) => ({
      label: model,
      value: stats.cost,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Cost by Model</h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No cost data yet</p>
      ) : (
        <FlexBarChart data={data} height={250} />
      )}
    </div>
  );
}
