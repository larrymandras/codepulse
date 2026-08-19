import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { formatCost } from "../../lib/formatters";
import MetricCard from "../MetricCard";
import AnomalyBadge from "../AnomalyBadge";
import { useMetricState } from "../../hooks/useMetricState";

/**
 * API Spend summary card. Self-fetching: owns costDerived.billedOverTime and
 * anomalyDetection.getActiveAnomalies (shared with TotalEventsCard — Convex
 * dedupes identical query subscriptions on the client, so this is not a
 * re-coupling of the two cards).
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. D-14: declares its state explicitly via
 * useMetricState rather than the old ad-hoc "--" loading fallback, which
 * MetricCard's own loading skeleton now replaces.
 */
export default function ApiSpendCard() {
  const apiSpendDerived = useQuery(api.costDerived.billedOverTime, {
    period: "daily",
    lookbackHours: 30 * 24,
  });
  const anomalies = useQuery(api.anomalyDetection.getActiveAnomalies) ?? {};
  const { state } = useMetricState(apiSpendDerived, undefined, {});

  const totalApiSpend = (apiSpendDerived?.buckets ?? []).reduce(
    (s: number, b: { billedUsd: number }) => s + b.billedUsd,
    0
  );

  return (
    <div className="flex items-start gap-2">
      <MetricCard label="API Spend" value={formatCost(totalApiSpend)} state={state} />
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
