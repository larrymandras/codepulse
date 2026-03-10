import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Tool Usage<InfoTooltip text="Top 10 most-used tools ranked by execution count" /></h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No tool data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="tool"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="count" fill="#818cf8" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
