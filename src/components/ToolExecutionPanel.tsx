import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FlexBarChart } from "./FlexBarChart";
import InfoTooltip from "./InfoTooltip";
import { ScrollArea } from "./ui/scroll-area";

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type SortMode = "time" | "duration";
type StatusFilter = "All" | "Success" | "Failed";

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2 py-0.5 rounded-sm border font-mono uppercase tracking-widest transition-colors ${
        active
          ? "bg-primary/20 text-primary border-primary"
          : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

export default function ToolExecutionPanel() {
  const executions = useQuery(api.toolExecutions.recentExecutions) ?? [];
  const successRateData = useQuery(api.toolExecutions.successRate) ?? [];

  const [toolFilter, setToolFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Derive top tool names from executions
  const toolNames = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of executions) {
      counts[e.toolName] = (counts[e.toolName] ?? 0) + 1;
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    return ["All", ...sorted];
  }, [executions]);

  // Filter executions
  const filteredExecutions = useMemo(() => {
    let result = executions.filter((e) => {
      if (toolFilter !== "All" && e.toolName !== toolFilter) return false;
      if (statusFilter === "Success" && !e.success) return false;
      if (statusFilter === "Failed" && e.success) return false;
      return true;
    });

    if (sortMode === "duration") {
      result = [...result].sort(
        (a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)
      );
    }

    return result;
  }, [executions, toolFilter, statusFilter, sortMode]);

  // Build chart data: success counts per tool
  const chartData = useMemo(() => {
    if (toolFilter === "All" && statusFilter === "All") {
      return successRateData.slice(0, 10).map((d) => ({
        label:
          d.toolName.length > 12
            ? d.toolName.slice(0, 12) + "..."
            : d.toolName,
        value: d.success,
      }));
    }

    const byTool: Record<string, number> = {};
    for (const e of filteredExecutions) {
      byTool[e.toolName] = (byTool[e.toolName] ?? 0) + (e.success ? 1 : 0);
    }

    return Object.entries(byTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({
        label: name.length > 12 ? name.slice(0, 12) + "..." : name,
        value,
      }));
  }, [successRateData, filteredExecutions, toolFilter, statusFilter]);

  // Compute summary metrics from filtered data
  const totalExecutions = filteredExecutions.length;
  const totalSuccess = filteredExecutions.filter((e) => e.success).length;
  const overallRate =
    totalExecutions > 0
      ? ((totalSuccess / totalExecutions) * 100).toFixed(1)
      : "0";
  const withDuration = filteredExecutions.filter(
    (e) => e.durationMs != null
  );
  const avgDuration =
    withDuration.length > 0
      ? (
          withDuration.reduce((s, e) => s + (e.durationMs ?? 0), 0) /
          withDuration.length
        ).toFixed(0)
      : "0";

  if (executions.length === 0) {
    return (
      <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden flex flex-col max-h-[450px] hover:border-primary/50 transition-colors shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)] hover:scale-[1.01] transition-transform duration-300">
        <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[var(--glow-xs)]" />
          Tool Executions
          <InfoTooltip text="Tool execution metrics: success rates, durations, and recent activity with decision tracking" />
        </h2>
        
        <div className="flex-1 flex flex-col items-center justify-center opacity-70 min-h-[200px]">
          <div className="w-12 h-12 border border-primary/20 rounded-full border-t-primary animate-spin mb-4 shadow-[var(--glow-sm)]" />
          <p className="text-xs font-mono tracking-widest text-primary uppercase animate-pulse">Awaiting Telemetry</p>
          <div className="mt-4 text-[11px] font-mono text-primary/40 flex flex-col items-center gap-1.5">
            <span className="bg-primary/10 px-2 py-0.5 rounded border border-primary/20">[ SYSTEM STANDBY ]</span>
            <span>Intercepting agent tool calls...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glow-card bg-card/60 backdrop-blur-md border border-border/50 rounded-xl p-6 relative overflow-hidden flex flex-col max-h-[450px] hover:border-primary/50 transition-colors shadow-[var(--glow-xs)] hover:shadow-[var(--glow-sm)] hover:scale-[1.01] transition-transform duration-300">
      <h2 className="text-sm font-mono tracking-widest text-primary uppercase mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        Tool Executions
        <InfoTooltip text="Tool execution metrics: success rates, durations, and recent activity with decision tracking" />
      </h2>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-6 text-xs uppercase font-mono tracking-widest">
        <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
          <p className="text-primary/70 mb-1">Total</p>
          <p className="text-base font-bold tracking-tight text-foreground">{totalExecutions}</p>
        </div>
        <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
          <p className="text-primary/70 mb-1">Success Rate</p>
          <p className="text-base font-bold tracking-tight text-primary">{overallRate}%</p>
        </div>
        <div className="bg-background/50 border border-border/30 rounded-lg p-2 text-center shadow-[0_0_10px_rgba(0,0,0,0.2)] hover:border-primary/40 transition-colors">
          <p className="text-primary/70 mb-1">Avg Duration</p>
          <p className="text-base font-bold tracking-tight text-indigo-400">{avgDuration}ms</p>
        </div>
      </div>

      {/* Tool name filter pills */}
      {toolNames.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {toolNames.slice(0, 12).map((name) => (
            <PillButton
              key={name}
              active={toolFilter === name}
              onClick={() => setToolFilter(name)}
            >
              {name === "All"
                ? "All"
                : name.length > 16
                  ? name.slice(0, 16) + "..."
                  : name}
            </PillButton>
          ))}
        </div>
      )}

      {/* Status filter + Sort toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          {(["All", "Success", "Failed"] as const).map((s) => (
            <PillButton
              key={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </PillButton>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Sort:</span>
          <PillButton
            active={sortMode === "time"}
            onClick={() => setSortMode("time")}
          >
            Time
          </PillButton>
          <PillButton
            active={sortMode === "duration"}
            onClick={() => setSortMode("duration")}
          >
            Duration
          </PillButton>
        </div>
      </div>

      {/* Success count chart */}
      {chartData.length > 0 && (
        <div className="mb-4">
          <FlexBarChart data={chartData} height={200} />
        </div>
      )}

      {/* Recent executions list */}
      {filteredExecutions.length === 0 ? (
        <p className="text-sm font-mono text-muted-foreground py-2 text-center">
          No executions match filters.
        </p>
      ) : (
        <ScrollArea className="h-[300px] pr-2">
          <div className="space-y-1.5">
            {filteredExecutions.slice(0, 20).map((exec) => {
            const isExpanded = expandedId === exec._id;
            return (
              <div key={exec._id}>
                  <div
                    className="flex items-start gap-3 bg-background/30 border-l-2 border-transparent hover:border-primary/50 px-3 py-2 cursor-pointer hover:bg-primary/5 transition-all group"
                    onClick={() =>
                      setExpandedId((prev) =>
                        prev === exec._id ? null : exec._id
                      )
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${
                        exec.success ? "bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-mono truncate tracking-widest group-hover:text-primary transition-colors">
                          {exec.toolName}
                        </span>
                        {exec.durationMs != null && (
                          <span className="text-[11px] text-primary/60 font-mono">
                            {exec.durationMs.toFixed(0)}ms
                          </span>
                        )}
                        {exec.decision && (
                          <span
                            className={`text-[10px] uppercase tracking-widest font-mono rounded-sm px-1.5 py-0.5 ml-auto ${
                              exec.decision === "accept"
                                ? "text-primary border border-primary/30 bg-primary/10"
                                : "text-yellow-500 border border-yellow-500/30 bg-yellow-500/10"
                            }`}
                          >
                            {exec.decision}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] font-mono text-muted-foreground/50">
                          ID: {exec._id.slice(-6)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                            {relativeTime(exec.timestamp)}
                          </span>
                          <span className="text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
                            {isExpanded ? "\u25BE" : "\u25B8"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-1 p-2 bg-background/50 rounded-lg border border-border/30 text-sm font-mono tracking-wide space-y-1">
                    {!exec.success && exec.errorMessage && (
                      <div>
                        <span className="text-gray-500 font-medium">
                          Error:
                        </span>{" "}
                        <span className="text-red-300">
                          {exec.errorMessage}
                        </span>
                      </div>
                    )}
                    {exec.decisionSource && (
                      <div>
                        <span className="text-gray-500 font-medium">
                          Decision source:
                        </span>{" "}
                        <span className="text-gray-300">
                          {exec.decisionSource}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500 font-medium">
                        Session:
                      </span>{" "}
                      <span className="text-gray-300 font-mono">
                        {exec.sessionId}
                      </span>
                    </div>
                    {exec.durationMs != null && (
                      <div>
                        <span className="text-gray-500 font-medium">
                          Duration:
                        </span>{" "}
                        <span className="text-gray-300">
                          {exec.durationMs.toFixed(2)}ms
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
