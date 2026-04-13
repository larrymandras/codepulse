import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";

interface PulseChartProps {
  events: any[];
}

export default function PulseChart({ events }: PulseChartProps) {
  // Group events into 1-minute buckets
  const buckets = new Map<string, number>();
  for (const event of events) {
    const ts = event.timestamp ?? 0;
    const date = new Date(ts * 1000);
    const key = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const data = Array.from(buckets.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">Activity Pulse<InfoTooltip text="Real-time event activity over the last hour, grouped into 1-minute buckets" /></h2>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">No activity data yet</p>
      ) : (
        <FlexBarChart data={data} height={200} />
      )}
    </div>
  );
}
