import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Always-on KG summary snapshot for the Explorer's summary cards (Phase 74,
 * KG-01). Reads the Convex `kgSummary` table (fed by Ástríðr's `kg_summary`
 * telemetry) — NOT the interactive /api/kg fetch — so the cards render even
 * when Ástríðr is offline.
 *
 * `loading` is true only while Convex is resolving the query (undefined).
 * `summary` is null when no telemetry has ever arrived.
 */
export interface KgSummaryView {
  entitiesByType: Record<string, number>;
  totalEntities: number;
  currentTripleCount: number;
  historicalTripleCount: number;
  contradictionCount: number;
  lastExtractionAt?: string;
  updatedAt: number;
}

export function useKgSummary(): {
  summary: KgSummaryView | null;
  loading: boolean;
} {
  const doc = useQuery(api.kg.latestSummary);
  return {
    summary: doc
      ? {
          entitiesByType: doc.entitiesByType,
          totalEntities: doc.totalEntities,
          currentTripleCount: doc.currentTripleCount,
          historicalTripleCount: doc.historicalTripleCount,
          contradictionCount: doc.contradictionCount,
          lastExtractionAt: doc.lastExtractionAt,
          updatedAt: doc.updatedAt,
        }
      : null,
    loading: doc === undefined,
  };
}
