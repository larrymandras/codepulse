import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Thin useQuery wrapper over api.workspace.getWorkspaceMap.
 *
 * Returns the RAW Convex result — three-state passthrough (do NOT coerce):
 *   undefined → Convex subscription still resolving (loading)
 *   null      → query resolved, no workspaceSnapshots row exists yet
 *               (true-empty state — e.g. the nightly scan hasn't run)
 *   object    → live workspace map data (meta fields + dirs[])
 *
 * D-02: this is the SINGLE getWorkspaceMap subscription for the whole map;
 * expand/collapse is entirely client-side over the returned payload.
 *
 * Do NOT coerce or collapse the result with a fallback operator of any
 * kind — the consumer branches on all three states, and collapsing the
 * loading state into the empty state would render the "no snapshot yet,
 * check Task Scheduler" copy during ordinary loading (Phase 114 Task 2
 * acceptance criteria).
 *
 * @param snapshotId - Optional snapshot ID. Defaults to WORKSPACE_SNAPSHOT_ID
 *   (handled by the Convex handler itself).
 */
export type WorkspaceMapData = NonNullable<
  ReturnType<typeof useQuery<typeof api.workspace.getWorkspaceMap>>
>;

export function useWorkspaceMap(snapshotId?: string) {
  return useQuery(
    api.workspace.getWorkspaceMap,
    snapshotId ? { snapshotId } : {}
  );
}
