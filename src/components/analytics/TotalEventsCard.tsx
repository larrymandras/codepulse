import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRecentEvents } from "../../hooks/useRecentEvents";
import MetricCard from "../MetricCard";
import AnomalyBadge from "../AnomalyBadge";
import type { MetricState } from "../../lib/metricState";

/**
 * Total Events summary card. Self-fetching: owns useRecentEvents,
 * aggregates.eventCountsByPeriod, and anomalyDetection.getActiveAnomalies
 * (shared with ApiSpendCard — Convex dedupes identical query subscriptions on
 * the client, so this is not a re-coupling of the two cards).
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. D-14: blends two sources' loading signals --
 * useRecentEvents's own `status` field, and a raw (undefaulted) duplicate of
 * the aggregates query, since `eventCounts` is otherwise collapsed to `{}`
 * while loading.
 */
export default function TotalEventsCard() {
  const { events, status } = useRecentEvents(100);
  const eventCountsRaw = useQuery(api.aggregates.eventCountsByPeriod, { period: "daily" });
  const eventCounts = eventCountsRaw ?? {};
  const totalAggregateEvents = Object.values(eventCounts).reduce((s, v) => s + (v as number), 0);
  const anomalies = useQuery(api.anomalyDetection.getActiveAnomalies) ?? {};

  // `totalAggregateEvents || events.length` means the aggregate query is the
  // PRIMARY source and `events` is only ever consulted as a fallback when
  // the aggregate resolves to a falsy total -- so events' own loading state
  // must not gate the card when the aggregate has already resolved a real
  // (nonzero) total.
  const aggregatesLoading = eventCountsRaw === undefined;
  const usingFallback = !aggregatesLoading && totalAggregateEvents === 0;
  const eventsLoading = status === "LoadingFirstPage";
  const stillLoading = aggregatesLoading || (usingFallback && eventsLoading);
  const isZero = !stillLoading && totalAggregateEvents === 0 && events.length === 0;
  const state: MetricState = stillLoading ? "loading" : isZero ? "empty" : "ready";

  return (
    <div className="flex items-start gap-2">
      <MetricCard label="Total Events" value={totalAggregateEvents || events.length} state={state} />
      {anomalies.errors && (
        <AnomalyBadge
          severity={anomalies.errors.severity as "warning" | "critical"}
          metric="errors"
          value={anomalies.errors.value}
          mean={anomalies.errors.mean}
          zScore={anomalies.errors.zScore}
        />
      )}
    </div>
  );
}
