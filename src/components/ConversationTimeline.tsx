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
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">
          Conversation Timeline
        </h2>
        <div className="flex items-center gap-1 bg-gray-900/50 rounded-lg p-0.5">
          {zoomLevels.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                zoom === z
                  ? "bg-gray-700 text-gray-100"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
      </div>

      {aggregated.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No message activity in this time range
        </p>
      ) : (
        <FlexBarChart data={aggregated} height={180} />
      )}
    </div>
  );
}
