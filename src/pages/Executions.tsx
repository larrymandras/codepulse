import { useState, useMemo, useEffect } from "react";
import { useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAstridrWS } from "../contexts/AstridrWSContext";
import { useLiveFlash } from "../hooks/useLiveFlash";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import ExecutionTable from "../components/ExecutionTable";
import ExecutionFilterBar from "../components/ExecutionFilterBar";
import LoadMoreButton from "../components/LoadMoreButton";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineMetricState } from "@/components/EmptyState";
import { useMetricState } from "@/hooks/useMetricState";

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

  // 122-16 (D-19/D-20): `stats` is undefined strictly while the query is
  // unresolved, and a real (always-populated) object once resolved -- so
  // "no value yet" is a genuine loading state, never a data gap, for
  // total/running/failed. `avgDuration` is the one field that can also be
  // genuinely null on a resolved stats object (no completed executions to
  // average), so it gets its own two-way split below.
  const { state: statsState } = useMetricState(stats, undefined);
  const totalDisplay = statsState === "ready" ? (stats!.total ?? 0) + wsTotalDelta : null;
  const runningDisplay = statsState === "ready" ? (stats!.running ?? 0) + wsRunningDelta : null;
  const failedDisplay = statsState === "ready" ? (stats!.failed ?? 0) + wsFailedDelta : null;
  const avgDurationDisplay =
    statsState === "ready" && stats!.avgDuration != null
      ? `${stats!.avgDuration.toFixed(0)}ms`
      : null;

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <PageHeader title="Execution History" />

      {/* Summary stat bar — PRIMARY VISUAL ANCHOR */}
      <SectionErrorBoundary name="Execution Metrics">
        <div ref={flashRef} className="grid grid-cols-4 gap-4">
          {/* `div`, not `p`, for each value slot below: the loading branch
              renders a block-level Skeleton, which is invalid inside a <p>
              (hydration error) -- caught live on /executions during Task 3
              verification. */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
            <div className="text-2xl font-semibold text-foreground">
              {totalDisplay === null ? <Skeleton className="h-8 w-16" /> : totalDisplay}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground">Running</p>
            <div className="text-2xl font-semibold text-foreground">
              {runningDisplay === null ? <Skeleton className="h-8 w-16" /> : runningDisplay}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground">Failed</p>
            <div className="text-2xl font-semibold text-red-400">
              {failedDisplay === null ? <Skeleton className="h-8 w-16" /> : failedDisplay}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-base font-semibold uppercase tracking-wide text-muted-foreground">Avg Duration</p>
            <div className="text-2xl font-semibold text-indigo-400">
              {avgDurationDisplay !== null ? (
                avgDurationDisplay
              ) : statsState === "ready" ? (
                <InlineMetricState state="empty" label="no completions yet" />
              ) : (
                <Skeleton className="h-8 w-16" />
              )}
            </div>
          </div>
        </div>
      </SectionErrorBoundary>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-lg p-4">
        <ExecutionFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          profiles={profiles}
        />
      </div>

      {/* Execution table */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-base font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Command Executions
        </h2>
        <ExecutionTable executions={executions} hasActiveFilters={hasActiveFilters} />
        <LoadMoreButton status={execStatus} loadMore={loadMoreExec} />
      </div>
    </div>
  );
}
