import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

interface ToolBreakdownProps {
  events: any[];
}

export default function ToolBreakdown({ events }: ToolBreakdownProps) {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.toolName) {
      counts.set(event.toolName, (counts.get(event.toolName) || 0) + 1);
    }
  }

  const data = Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Tool Usage<InfoTooltip text="Top 10 most-used tools ranked by execution count" /></h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No tool data yet</p>
      ) : (
        <FlexBarChart data={data} height={200} />
      )}
    </div>
  );
}
