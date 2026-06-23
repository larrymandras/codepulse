import { useMemo } from "react";
import { FlexBarChart } from "./FlexBarChart";
import { useConversationTimeline } from "../hooks/useConversationTimeline";

type ZoomLevel = "1h" | "6h" | "24h" | "7d";

export default function ConversationTimeline() {
  const { buckets, zoom, setZoom } = useConversationTimeline();

  const chartData = useMemo(() => {
    return buckets.map((b: any) => ({
      label: b.channel,
      value: b.inbound + b.outbound,
    }));
  }, [buckets]);

  // Aggregate by channel for the bar chart
  const aggregated = useMemo(() => {
    const byChannel: Record<string, number> = {};
    for (const d of chartData) {
      byChannel[d.label] = (byChannel[d.label] ?? 0) + d.value;
    }
    return Object.entries(byChannel).map(([label, value]) => ({ label, value }));
  }, [chartData]);

  const zoomLevels: ZoomLevel[] = ["1h", "6h", "24h", "7d"];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Conversation Timeline
        </h2>
        <div className="flex items-center gap-2 bg-card/60 border border-border/50 rounded-lg p-1">
          {zoomLevels.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`text-xs font-mono tracking-widest uppercase px-3 py-1.5 rounded transition-colors ${
                zoom === z
                  ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(249,115,22,0.4)]"
                  : "text-muted-foreground hover:text-primary hover:bg-card"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-[200px]">
        {aggregated.length === 0 ? (
          <p className="text-sm font-mono text-muted-foreground py-12 text-center">
            No message activity in this time range
          </p>
        ) : (
          <FlexBarChart data={aggregated} height={180} />
        )}
      </div>
    </div>
  );
}
