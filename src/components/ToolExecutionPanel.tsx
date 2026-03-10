import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import InfoTooltip from "./InfoTooltip";

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
      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
        active
          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
          : "bg-gray-700/30 text-gray-400 border-gray-600/30 hover:bg-gray-700/50 hover:text-gray-300"
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
    // "time" is already sorted desc from the query

    return result;
  }, [executions, toolFilter, statusFilter, sortMode]);

  // Filter chart data based on tool and status filters
  const chartData = useMemo(() => {
    if (toolFilter === "All" && statusFilter === "All") {
      return successRateData.slice(0, 10).map((d) => ({
        tool:
          d.toolName.length > 12
            ? d.toolName.slice(0, 12) + "..."
            : d.toolName,
        Success: d.success,
        Failure: d.failure,
      }));
    }

    // Recompute from filtered executions
    const byTool: Record<string, { success: number; failure: number }> = {};
    for (const e of filteredExecutions) {
      if (!byTool[e.toolName]) byTool[e.toolName] = { success: 0, failure: 0 };
      if (e.success) byTool[e.toolName].success++;
      else byTool[e.toolName].failure++;
    }

    return Object.entries(byTool)
      .sort(
        (a, b) =>
          b[1].success + b[1].failure - (a[1].success + a[1].failure)
      )
      .slice(0, 10)
      .map(([name, counts]) => ({
        tool: name.length > 12 ? name.slice(0, 12) + "..." : name,
        Success: counts.success,
        Failure: counts.failure,
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
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Tool Executions
          <InfoTooltip text="Tool execution metrics: success rates, durations, and recent activity with decision tracking" />
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">No data yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Tool Executions
        <InfoTooltip text="Tool execution metrics: success rates, durations, and recent activity with decision tracking" />
      </h2>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400">Total</p>
          <p className="text-lg font-bold text-gray-100">{totalExecutions}</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400">Success Rate</p>
          <p className="text-lg font-bold text-emerald-400">{overallRate}%</p>
        </div>
        <div className="bg-gray-900/50 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-gray-400">Avg Duration</p>
          <p className="text-lg font-bold text-indigo-400">{avgDuration}ms</p>
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
          <span className="text-[10px] text-gray-500">Sort:</span>
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

      {/* Success vs Failure chart */}
      {chartData.length > 0 && (
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="tool"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                stroke="#4b5563"
              />
              <YAxis
                tick={{ fill: "#9ca3af", fontSize: 10 }}
                stroke="#4b5563"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="Success" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Failure" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent executions list */}
      {filteredExecutions.length === 0 ? (
        <p className="text-sm text-gray-500 py-2 text-center">
          No executions match filters.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {filteredExecutions.slice(0, 20).map((exec) => {
            const isExpanded = expandedId === exec._id;
            return (
              <div key={exec._id}>
                <div
                  className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-900/50 transition-colors"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === exec._id ? null : exec._id
                    )
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      exec.success ? "bg-emerald-400" : "bg-red-400"
                    }`}
                  />
                  <span className="text-xs text-gray-200 font-mono truncate flex-1">
                    {exec.toolName}
                  </span>
                  {exec.durationMs != null && (
                    <span className="text-[10px] text-gray-500">
                      {exec.durationMs.toFixed(0)}ms
                    </span>
                  )}
                  {exec.decision && (
                    <span
                      className={`text-[9px] uppercase tracking-wider font-semibold rounded px-1.5 py-0.5 ${
                        exec.decision === "accept"
                          ? "text-emerald-400 bg-emerald-600/10"
                          : "text-amber-400 bg-amber-600/10"
                      }`}
                    >
                      {exec.decision}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-500 shrink-0">
                    {relativeTime(exec.timestamp)}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {isExpanded ? "\u25BE" : "\u25B8"}
                  </span>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="ml-5 mt-1 mb-1 p-2 bg-gray-900/40 rounded-lg border border-gray-700/30 text-[11px] space-y-1">
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
      )}
    </div>
  );
}
