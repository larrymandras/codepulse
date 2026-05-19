import { useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/** Astridr backend URL for backfill endpoint (D-14). */
const ASTRIDR_URL =
  import.meta.env.VITE_ASTRIDR_API_URL ?? "http://localhost:8181";

/** Astridr API key for authenticated backfill requests. */
const ASTRIDR_API_KEY = import.meta.env.VITE_ASTRIDR_API_KEY ?? "";

/**
 * Get the latest operator score (most recent single record).
 * Returns null during loading or if no scores exist.
 */
export function useLatestOperatorScore() {
  return useQuery(api.operatorScores.latest);
}

/**
 * Get historical operator scores for sparkline/trending.
 * Returns array of scores ordered oldest-first.
 */
export function useOperatorScoreHistory(limit?: number) {
  return useQuery(api.operatorScores.last30, limit ? { limit } : {}) ?? [];
}

/**
 * Trigger Supabase backfill if Convex has no recent operator scores (D-14).
 * Runs once on mount. If the latest score is older than 36 hours (allowing
 * for nightly pipeline timing), fetch missing scores from Astridr REST API.
 */
export function useOperatorScoreBackfill() {
  const latest = useQuery(api.operatorScores.latest);
  const backfill = useAction(api.operatorScores.backfillFromSupabase);
  const didRun = useRef(false);

  useEffect(() => {
    // Only run once, and only after we know the query result
    if (latest === undefined || didRun.current) return;
    didRun.current = true;

    const now = Date.now();
    const staleThresholdMs = 36 * 60 * 60 * 1000; // 36 hours

    // Backfill if no scores exist or latest is older than threshold
    if (
      latest === null ||
      now - (latest.computedAt ?? 0) > staleThresholdMs
    ) {
      backfill({
        astridrUrl: ASTRIDR_URL,
        apiKey: ASTRIDR_API_KEY || undefined,
      }).catch((err) => {
        console.warn("[OperatorScore] Backfill failed:", err);
      });
    }
  }, [latest, backfill]);
}
