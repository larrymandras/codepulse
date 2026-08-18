import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatCost } from "../../lib/formatters";
import MetricCard from "../MetricCard";
import AnomalyBadge from "../AnomalyBadge";

/**
 * API Spend summary card. Self-fetching: owns costDerived.billedOverTime and
 * anomalyDetection.getActiveAnomalies (shared with TotalEventsCard — Convex
 * dedupes identical query subscriptions on the client, so this is not a
 * re-coupling of the two cards).
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. Keeps the "--" loading fallback: an honest
 * dash, never a confident zero-dollar figure.
 */
export default function ApiSpendCard() {
  const apiSpendDerived = useQuery(api.costDerived.billedOverTime, {
    period: "daily",
    lookbackHours: 30 * 24,
  });
  const anomalies = useQuery(api.anomalyDetection.getActiveAnomalies) ?? {};

  const totalApiSpend = (apiSpendDerived?.buckets ?? []).reduce(
    (s: number, b: { billedUsd: number }) => s + b.billedUsd,
    0
  );

  return (
    <div className="flex items-start gap-2">
      <MetricCard label="API Spend" value={apiSpendDerived ? formatCost(totalApiSpend) : "--"} />
      {anomalies.cost && (
        <AnomalyBadge
          severity={anomalies.cost.severity as "warning" | "critical"}
          metric="cost"
          value={anomalies.cost.value}
          mean={anomalies.cost.mean}
          zScore={anomalies.cost.zScore}
        />
      )}
    </div>
  );
}
