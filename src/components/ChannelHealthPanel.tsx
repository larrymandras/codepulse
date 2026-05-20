import { memo } from "react";
import { useChannelHealth } from "../hooks/useChannelHealth";

const channelLabels: Record<string, string> = {
  telegram: "Telegram",
  slack: "Slack",
  web: "Web",
  email: "Email",
  voice: "Voice",
};

const statusConfig: Record<string, { dot: string; label: string }> = {
  healthy: { dot: "bg-green-500", label: "healthy" },
  degraded: { dot: "bg-yellow-500", label: "degraded" },
  down: { dot: "bg-red-500", label: "down" },
};

function formatRelativeTime(epochSec: number): string {
  if (!epochSec) return "—";
  const diff = Math.max(0, Date.now() / 1000 - epochSec);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function ChannelHealthPanelInner() {
  const healthData = useChannelHealth();
  const channels = ["telegram", "slack", "web", "email", "voice"];

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <h2 className="text-xs font-mono tracking-widest text-primary uppercase mb-3 flex items-center gap-2">Channel Health</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {channels.map((ch) => {
          const data = healthData[ch];
          const status = data ? statusConfig[data.status] ?? statusConfig.down : null;

          return (
            <div
              key={ch}
              className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`w-2 h-2 rounded-full ${status?.dot ?? "bg-gray-600"}`}
                />
                <span className="text-sm font-medium text-gray-200">
                  {channelLabels[ch]}
                </span>
              </div>
              {data ? (
                <div className="space-y-1 text-xs text-gray-400">
                  <div>{Math.round(data.messagesLastHour)} msg/hr</div>
                  <div>{(data.avgResponseMs / 1000).toFixed(1)}s avg</div>
                  <div>last: {formatRelativeTime(data.lastMessageAt)}</div>
                </div>
              ) : (
                <p className="text-xs text-gray-600">No data</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChannelHealthPanel = memo(ChannelHealthPanelInner);
export default ChannelHealthPanel;
