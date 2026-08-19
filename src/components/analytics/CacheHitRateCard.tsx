import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import MetricCard from "../MetricCard";
import { useMetricState } from "../../hooks/useMetricState";

/**
 * Cache Hit Rate (24h) summary card. Self-fetching: owns llm.cacheStats.
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. D-14: declares its state explicitly via
 * useMetricState rather than the old ad-hoc "--" loading fallback, which
 * MetricCard's own loading skeleton now replaces.
 */
export default function CacheHitRateCard() {
  const cacheStats = useQuery(api.llm.cacheStats, {});
  const { state } = useMetricState(cacheStats, undefined, {});

  return (
    <MetricCard
      label="Cache Hit Rate (24h)"
      value={cacheStats ? `${(cacheStats.overall.hitRate * 100).toFixed(1)}%` : "0.0%"}
      numericValue={cacheStats ? cacheStats.overall.hitRate * 100 : undefined}
      format={(v) => `${v.toFixed(1)}%`}
      threshold={{ ok: 50, warn: 20, invertDirection: true }}
      state={state}
    />
  );
}
