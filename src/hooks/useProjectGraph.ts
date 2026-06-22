import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Thin useQuery wrapper over api.graphSnapshots.getProjectGraph.
 *
 * Returns the RAW Convex result — three-state passthrough (do NOT coerce):
 *   undefined → Convex subscription still resolving (loading)
 *   null      → query resolved, no snapshot ingested yet (D-12: explainer state)
 *   object    → live snapshot data
 *
 * Callers that only care about data can check `snapshot != null` to distinguish
 * loading+empty from data. CodeVaultGraph needs all three states to branch
 * between loading pulse, explainer, and live graph.
 *
 * @param snapshotId - Optional snapshot ID. Defaults to the Ástríðr stable ID
 *   "astridr-project-graph" (handled by the Convex handler itself).
 */
export type ProjectGraphData = NonNullable<
  ReturnType<typeof useQuery<typeof api.graphSnapshots.getProjectGraph>>
>;

export function useProjectGraph(snapshotId?: string) {
  return useQuery(
    api.graphSnapshots.getProjectGraph,
    snapshotId ? { snapshotId } : {}
  );
}
