import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import MetricCard from "../MetricCard";

/**
 * Cache Hit Rate (24h) summary card. Self-fetching: owns llm.cacheStats.
 *
 * No error handling here (D-02) — relies entirely on the error-boundary
 * wrapper its parent supplies. Renders exactly the markup Analytics.tsx's
 * Summary Row rendered for this card before this move, including the "--"
 * fallback while cacheStats is loading.
 */
export default function CacheHitRateCard() {
  const cacheStats = useQuery(api.llm.cacheStats, {});

  return (
    <MetricCard
      label="Cache Hit Rate (24h)"
      value={cacheStats ? `${(cacheStats.overall.hitRate * 100).toFixed(1)}%` : "--"}
      numericValue={cacheStats ? cacheStats.overall.hitRate * 100 : undefined}
      format={(v) => `${v.toFixed(1)}%`}
      threshold={{ ok: 50, warn: 20, invertDirection: true }}
    />
  );
}
