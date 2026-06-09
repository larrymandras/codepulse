import { useState, useMemo, useEffect } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "../hooks/useLiveFlash";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import ExecutionTable from "../components/ExecutionTable";
import ExecutionFilterBar from "../components/ExecutionFilterBar";
import LoadMoreButton from "../components/LoadMoreButton";

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

  // WS live counters overlay on Convex data
  const [wsRunningDelta, setWsRunningDelta] = useState(0);
  const [wsFailedDelta, setWsFailedDelta] = useState(0);
  const [wsTotalDelta, setWsTotalDelta] = useState(0);

  const { subscribeEvent } = useAstridrWS();
  const { flashRef, triggerFlash } = useLiveFlash();

  const stats = useQuery(api.commandExecutions.summaryStats);

  const hasActiveFilters = Object.values(filters).some((v) => v !== null);

  // When filters are active, use the server-side filtered query so results
  // aren't limited to the paginated window. Otherwise use pagination.
  const filteredResults = useQuery(
    api.commandExecutions.listExecutions,
    hasActiveFilters
      ? {
          status: filters.status ?? undefined,
          profileId: filters.profile ?? undefined,
          channelId: filters.channel ?? undefined,
          origin: filters.origin ?? undefined,
        }
      : "skip"
  );

  const { results: allExecutions, status: execStatus, loadMore: loadMoreExec } = usePaginatedQuery(
    api.commandExecutions.listExecutionsPaginated,
    {},
    { initialNumItems: 25 }
  );

  const executions = hasActiveFilters ? (filteredResults ?? []) : allExecutions;

  const profiles = useMemo(() => {
    const seen = new Set<string>();
    for (const e of allExecutions) {
      if (e.profileId) seen.add(e.profileId);
    }
    return Array.from(seen).sort();
  }, [allExecutions]);

  const handleFilterChange = (key: string, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // WS: subscribe to execution events for live counter overlays
  useEffect(() => {
    const unsubStart = subscribeEvent("execution_start", () => {
      setWsRunningDelta((prev) => prev + 1);
      setWsTotalDelta((prev) => prev + 1);
      triggerFlash();
    });

    const unsubComplete = subscribeEvent("execution_complete", () => {
      setWsRunningDelta((prev) => Math.max(0, prev - 1));
      triggerFlash();
    });

    const unsubError = subscribeEvent("execution_error", () => {
      setWsRunningDelta((prev) => Math.max(0, prev - 1));
      setWsFailedDelta((prev) => prev + 1);
      triggerFlash();
    });

    return () => {
      unsubStart();
      unsubComplete();
      unsubError();
    };
  }, [subscribeEvent, triggerFlash]);

  const totalDisplay = stats != null ? (stats.total ?? 0) + wsTotalDelta : "—";
  const runningDisplay = stats != null ? (stats.running ?? 0) + wsRunningDelta : "—";
  const failedDisplay = stats != null ? (stats.failed ?? 0) + wsFailedDelta : "—";
  const avgDurationDisplay = stats?.avgDuration != null
    ? `${stats.avgDuration.toFixed(0)}ms`
    : "—";

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <h1 className="text-2xl font-semibold text-gray-100">
        Execution History
      </h1>

      {/* Summary stat bar — PRIMARY VISUAL ANCHOR */}
      <SectionErrorBoundary name="Execution Metrics">
        <div ref={flashRef} className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Total</p>
            <p className="text-2xl font-semibold text-gray-100">
              {totalDisplay}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Running</p>
            <p className="text-2xl font-semibold text-gray-100">
              {runningDisplay}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Failed</p>
            <p className="text-2xl font-semibold text-red-400">
              {failedDisplay}
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Avg Duration</p>
            <p className="text-2xl font-semibold text-indigo-400">
              {avgDurationDisplay}
            </p>
          </div>
        </div>
      </SectionErrorBoundary>

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
        <LoadMoreButton status={execStatus} loadMore={loadMoreExec} />
      </div>
    </div>
  );
}
