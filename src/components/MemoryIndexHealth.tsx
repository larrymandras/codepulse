import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

function relativeTime(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const stalenessConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  fresh: { label: "Fresh", color: "text-emerald-400", bg: "bg-emerald-500/20" },
  aging: { label: "Aging", color: "text-yellow-400", bg: "bg-yellow-500/20" },
  stale: { label: "Stale", color: "text-red-400", bg: "bg-red-500/20" },
  empty: { label: "Empty", color: "text-gray-500", bg: "bg-gray-700/50" },
};

const typeColors = [
  "bg-indigo-500/20 text-indigo-400",
  "bg-sky-500/20 text-sky-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",
  "bg-violet-500/20 text-violet-400",
  "bg-teal-500/20 text-teal-400",
  "bg-rose-500/20 text-rose-400",
];

export default function MemoryIndexHealth() {
  const health = useQuery(api.memory.indexHealth);

  if (!health) {
    return (
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-700 rounded mb-4" />
        <div className="h-8 w-20 bg-gray-700 rounded" />
      </div>
    );
  }

  const st = stalenessConfig[health.staleness] ?? stalenessConfig.empty;
  const typeEntries = Object.entries(health.byType);
  const agentEntries = Object.entries(health.byAgent);

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300">
          Memory Index Health
        </h2>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}
        >
          {st.label}
        </span>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-semibold text-gray-100">
            {health.totalEvents}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last 24h</p>
          <p className="text-lg font-semibold text-gray-100">
            {health.last24h}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last 7d</p>
          <p className="text-lg font-semibold text-gray-100">
            {health.last7d}
          </p>
        </div>
      </div>

      {/* Last event */}
      {health.lastEvent && (
        <p className="text-xs text-gray-500">
          Last event:{" "}
          <span className="text-gray-400">
            {relativeTime(health.lastEvent)}
          </span>
        </p>
      )}

      {/* Event type breakdown */}
      {typeEntries.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Event Types</p>
          <div className="flex flex-wrap gap-1.5">
            {typeEntries.map(([type, count], i) => (
              <span
                key={type}
                className={`text-xs px-2 py-0.5 rounded-full ${typeColors[i % typeColors.length]}`}
              >
                {type}{" "}
                <span className="opacity-70">{count as number}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agent breakdown */}
      {agentEntries.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">By Agent</p>
          <div className="space-y-1">
            {agentEntries.map(([agent, count]) => (
              <div
                key={agent}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-400 truncate">{agent}</span>
                <span className="text-gray-500 ml-2">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
