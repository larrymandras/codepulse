import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useRecentEvents } from "../../hooks/useRecentEvents";
import MetricCard from "../MetricCard";
import AnomalyBadge from "../AnomalyBadge";

/**
 * Total Events summary card. Self-fetching: owns useRecentEvents,
 * aggregates.eventCountsByPeriod, and anomalyDetection.getActiveAnomalies
 * (shared with ApiSpendCard — Convex dedupes identical query subscriptions on
 * the client, so this is not a re-coupling of the two cards).
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. Renders exactly the markup Analytics.tsx's
 * Summary Row rendered for this card before this move.
 */
export default function TotalEventsCard() {
  const { events } = useRecentEvents(100);
  const eventCounts = useQuery(api.aggregates.eventCountsByPeriod, { period: "daily" }) ?? {};
  const totalAggregateEvents = Object.values(eventCounts).reduce((s, v) => s + (v as number), 0);
  const anomalies = useQuery(api.anomalyDetection.getActiveAnomalies) ?? {};

  return (
    <div className="flex items-start gap-2">
      <MetricCard label="Total Events" value={totalAggregateEvents || events.length} />
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
