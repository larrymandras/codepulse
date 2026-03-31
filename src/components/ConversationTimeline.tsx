import { useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useConversationTimeline } from "../hooks/useConversationTimeline";

const channelColors: Record<string, string> = {
  telegram: "#2AABEE",
  slack: "#4A154B",
  web: "#10B981",
  email: "#F59E0B",
  voice: "#8B5CF6",
};

const channelOrder = ["telegram", "slack", "web", "email", "voice"];

function formatTime(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

type ZoomLevel = "1h" | "6h" | "24h" | "7d";

export default function ConversationTimeline() {
  const { buckets, zoom, setZoom } = useConversationTimeline();

  const chartData = useMemo(() => {
    return buckets.map((b: any) => ({
      x: b.timestamp,
      y: channelOrder.indexOf(b.channel),
      channel: b.channel,
      total: b.inbound + b.outbound,
      inbound: b.inbound,
      outbound: b.outbound,
    }));
  }, [buckets]);

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

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500 py-12 text-center">
          No message activity in this time range
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 60 }}>
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[-0.5, 4.5]}
              ticks={[0, 1, 2, 3, 4]}
              tickFormatter={(val: number) => channelOrder[val] ?? ""}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              stroke="#4b5563"
            />
            <Tooltip
              content={({ payload }) => {
                if (!payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-2 text-xs">
                    <p className="text-gray-200 font-medium">{d.channel}</p>
                    <p className="text-gray-400">{formatTime(d.x)}</p>
                    <p className="text-gray-400">
                      In: {d.inbound} / Out: {d.outbound}
                    </p>
                  </div>
                );
              }}
            />
            <Scatter data={chartData}>
              {chartData.map((entry: any, i: number) => (
                <Cell
                  key={i}
                  fill={channelColors[entry.channel] ?? "#6b7280"}
                  r={Math.min(8, 3 + entry.total)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {/* Channel legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        {channelOrder.map((ch) => (
          <div key={ch} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: channelColors[ch] }}
            />
            <span className="text-xs text-gray-400">{ch}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
