import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { GraphSnapshot } from "../lib/graph-snapshot";

/**
 * Live graph snapshots for the Unified Graph Hub (Phase 76, HUB-01).
 *
 * Wraps the `graphSnapshots` Convex query. Returns `loading: true` while the
 * query is still undefined (Convex's loading sentinel) so the page can show one
 * coherent state instead of flashing the no-telemetry banner mid-load.
 *
 * Each row is normalized to the `GraphSnapshot` shape consumed by the pure
 * transforms in `lib/graph-snapshot.ts`.
 */
export function useGraphSnapshots(): {
  snapshots: GraphSnapshot[];
  loading: boolean;
} {
  const rows = useQuery(api.graphSnapshots.listSnapshots);
  const loading = rows === undefined;
  const snapshots: GraphSnapshot[] = (rows ?? []).map((r) => ({
    snapshotId: r.snapshotId,
    nodes: r.nodes,
    links: r.links,
    snapshotTimestamp: r.snapshotTimestamp,
  }));
  return { snapshots, loading };
}
