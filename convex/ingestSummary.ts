/**
 * Pure helpers for /runtime-ingest legacy-table storage.
 *
 * The legacy `runtime_events` table stores each event's `data` as a single
 * document field, which is bound by Convex's ~1 MiB per-document limit. Most
 * events are tiny, but a `graph_snapshot` carries the full {nodes, links} graph
 * (can be > 1 MiB). That full payload is already persisted row-based by the
 * graphSnapshots receiver, so the legacy row only needs a compact summary —
 * otherwise the oversized insert rejects the whole ingest (events.ts doc-size
 * limit), defeating the row-based receiver.
 *
 * Kept Convex-free so it is unit-testable without the Convex runtime.
 */

/**
 * Returns the value to store in `runtime_events.data` for an event.
 *
 * - `graph_snapshot`: strip the heavy `nodes`/`links` arrays, keep the compact
 *   metadata (snapshotId, counts, sources, generatedAt) plus a `summarized`
 *   marker. The full graph lives in graphSnapshot{Nodes,Links}.
 * - everything else: pass through unchanged.
 */
export function legacyEventData(eventType: string, data: unknown): unknown {
  if (eventType !== "graph_snapshot" || data === null || typeof data !== "object") {
    return data;
  }
  const d = data as Record<string, unknown>;
  const { nodes, links, ...rest } = d;
  return {
    ...rest,
    nodeCount:
      typeof d.nodeCount === "number"
        ? d.nodeCount
        : Array.isArray(nodes)
          ? nodes.length
          : 0,
    linkCount:
      typeof d.linkCount === "number"
        ? d.linkCount
        : Array.isArray(links)
          ? links.length
          : 0,
    summarized: true,
  };
}
