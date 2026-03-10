import { useState } from "react";
import { useDockerHealth } from "../hooks/useDockerHealth";
import InfoTooltip from "./InfoTooltip";

export default function DockerPanel() {
  const containers = useDockerHealth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    // Convex queries are reactive; show a brief visual indicator
    setTimeout(() => setRefreshing(false), 1500);
  };

  const statusColor = (status: string) => {
    if (status === "running") return "bg-green-500";
    if (status === "paused" || status === "restarting") return "bg-yellow-500";
    if (status === "exited") return "bg-gray-500";
    if (status === "unknown") return "bg-yellow-500";
    return "bg-red-500";
  };

  const healthBadge = (health?: string) => {
    if (!health) return null;
    const colors: Record<string, string> = {
      healthy: "text-green-400 bg-green-400/10",
      unhealthy: "text-red-400 bg-red-400/10",
      starting: "text-yellow-400 bg-yellow-400/10",
    };
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[health] ?? "text-gray-400 bg-gray-400/10"}`}>
        {health}
      </span>
    );
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-300">Docker Containers<InfoTooltip text="Docker container status including health, CPU, and memory usage" /></h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-[10px] px-2 py-0.5 rounded border border-gray-600/30 text-gray-500 hover:text-gray-300 hover:border-gray-500/50 transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <span className="animate-pulse text-yellow-400">Refreshing...</span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>
      {containers.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">Docker monitoring active — waiting for container data</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {containers.map((c: any) => (
            <div
              key={c._id}
              className="bg-gray-900/50 border border-gray-700/30 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusColor(c.status ?? "")}`} />
                  <span className="text-xs font-mono text-gray-300 truncate">{c.name}</span>
                </div>
                {healthBadge(c.health)}
              </div>
              {c.image && (
                <p className="text-[10px] text-gray-500 font-mono mb-1.5">{c.image}</p>
              )}
              <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                <span>CPU: {c.cpuPercent?.toFixed(1) ?? "N/A"}%</span>
                <span>Mem: {c.memoryMb?.toFixed(0) ?? "N/A"} MB</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
