import { useState } from "react";
import { useDockerHealth } from "../hooks/useDockerHealth";
import InfoTooltip from "./InfoTooltip";
import { ScrollArea } from "./ui/scroll-area";

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
      <span className={`text-xs px-1.5 py-0.5 rounded ${colors[health] ?? "text-gray-400 bg-gray-400/10"}`}>
        {health}
      </span>
    );
  };

  return (
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden hover:border-primary/50 transition-colors shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)] hover:scale-[1.01] transition-transform duration-300">
      <div className="flex items-center justify-between mb-6 border-b border-border/30 pb-4">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Docker Containers
          <InfoTooltip text="Docker container status including health, CPU, and memory usage" />
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="text-xs uppercase tracking-widest font-mono px-3 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {refreshing ? (
            <span className="animate-pulse">Refreshing...</span>
          ) : (
            "Refresh"
          )}
        </button>
      </div>
      {containers.length === 0 ? (
        <p className="text-sm font-mono text-muted-foreground py-6 text-center">Docker monitoring active — waiting for container data</p>
      ) : (
        <ScrollArea className="h-[300px] pr-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {containers.map((c: any) => (
            <div
              key={c._id}
              className="bg-background/80 border-l-2 border-l-primary border border-border/30 rounded-r-lg p-3 hover:border-primary/50 hover:bg-card/80 transition-all hover-glitch shadow-[0_0_10px_rgba(0,0,0,0.3)] hover:shadow-[var(--glow-sm)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${statusColor(c.status ?? "")} shadow-[0_0_5px_currentColor]`} />
                  <span className="text-sm font-mono text-foreground truncate">{c.name}</span>
                </div>
                {healthBadge(c.health)}
              </div>
              {c.image && (
                <p className="text-xs text-muted-foreground font-mono mb-2 truncate opacity-70">{c.image}</p>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs uppercase font-mono tracking-widest text-muted-foreground pt-2 border-t border-border/30 mt-2">
                <span className="flex flex-col gap-0.5">
                  <span className="text-primary/70">CPU</span>
                  <span className="text-foreground">{c.cpuPercent?.toFixed(1) ?? "N/A"}%</span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-primary/70">Mem</span>
                  <span className="text-foreground">{c.memoryMb?.toFixed(0) ?? "N/A"} MB</span>
                </span>
              </div>
            </div>
          ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
