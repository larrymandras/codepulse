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

function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() / 1000 - ts);
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ToolExecutionPanel() {
  const executions = useQuery(api.toolExecutions.recentExecutions) ?? [];
  const successRateData = useQuery(api.toolExecutions.successRate) ?? [];

  const totalExecutions = successRateData.reduce((s, d) => s + d.total, 0);
  const totalSuccess = successRateData.reduce((s, d) => s + d.success, 0);
  const overallRate = totalExecutions > 0 ? ((totalSuccess / totalExecutions) * 100).toFixed(1) : "0";
  const avgDuration =
    executions.length > 0
      ? (
          executions.reduce((s, e: any) => s + (e.durationMs ?? 0), 0) /
          executions.filter((e: any) => e.durationMs != null).length
        ).toFixed(0)
      : "0";

  if (executions.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
          Tool Executions
        </h2>
        <p className="text-sm text-gray-500 py-4 text-center">No data yet</p>
      </div>
    );
  }

  const chartData = successRateData.slice(0, 10).map((d) => ({
    tool: d.toolName.length > 12 ? d.toolName.slice(0, 12) + "..." : d.toolName,
    Success: d.success,
    Failure: d.failure,
  }));

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-4">
        Tool Executions
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
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {executions.slice(0, 20).map((exec: any) => (
          <div
            key={exec._id}
            className="flex items-center gap-3 bg-gray-900/30 rounded-lg px-3 py-2"
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
          </div>
        ))}
      </div>
    </div>
  );
}
