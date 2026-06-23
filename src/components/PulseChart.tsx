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
    <div className="p-6 h-full flex flex-col">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Activity Pulse
        <InfoTooltip text="Real-time event activity over the last hour, grouped into 1-minute buckets" />
      </h2>
      <div className="flex-1 min-h-[200px]">
        {data.length === 0 ? (
          <p className="text-sm font-mono text-muted-foreground py-12 text-center">No activity data yet</p>
        ) : (
          <FlexBarChart data={data} height={200} />
        )}
      </div>
    </div>
  );
}
