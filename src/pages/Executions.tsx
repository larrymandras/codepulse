import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import ExecutionTable from "../components/ExecutionTable";
import ExecutionFilterBar from "../components/ExecutionFilterBar";

interface FilterState {
  status: string | null;
  channel: string | null;
  profile: string | null;
  origin: string | null;
}

export default function Executions() {
  const [filters, setFilters] = useState<FilterState>({
    status: null,
    channel: null,
    profile: null,
    origin: null,
  });

  const stats = useQuery(api.commandExecutions.summaryStats);

  const executions = useQuery(api.commandExecutions.listExecutions, {
    ...(filters.status !== null ? { status: filters.status } : {}),
    ...(filters.profile !== null ? { profileId: filters.profile } : {}),
    ...(filters.channel !== null ? { channelId: filters.channel } : {}),
    ...(filters.origin !== null ? { origin: filters.origin } : {}),
  });

  const profiles = useMemo(() => {
    if (!executions) return [];
    const seen = new Set<string>();
    for (const e of executions) {
      if (e.profileId) seen.add(e.profileId);
    }
    return Array.from(seen).sort();
  }, [executions]);

  const hasActiveFilters = Object.values(filters).some((v) => v !== null);

  const handleFilterChange = (key: string, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const avgDurationDisplay = stats?.avgDuration != null
    ? `${stats.avgDuration.toFixed(0)}ms`
    : "—";

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <h1
        className="text-2xl font-semibold text-gray-100"
        style={{ fontFamily: "Cinzel, serif" }}
      >
        Execution History
      </h1>

      {/* Summary stat bar — PRIMARY VISUAL ANCHOR */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Total</p>
          <p className="text-2xl font-semibold text-gray-100">
            {stats?.total ?? "—"}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Running</p>
          <p className="text-2xl font-semibold text-gray-100">
            {stats?.running ?? "—"}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Failed</p>
          <p className="text-2xl font-semibold text-red-400">
            {stats?.failed ?? "—"}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Avg Duration</p>
          <p className="text-2xl font-semibold text-indigo-400">
            {avgDurationDisplay}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
        <ExecutionFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          profiles={profiles}
        />
      </div>

      {/* Execution table */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
          Command Executions
        </h2>
        <ExecutionTable executions={executions} hasActiveFilters={hasActiveFilters} />
      </div>
    </div>
  );
}
