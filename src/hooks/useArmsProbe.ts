import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Live probe for whether any graphSnapshots row carries a source with
 * `kind: "arms"` — i.e. whether Ástríðr's ARMS inventory (astridr A3,
 * queued for v29, not yet scheduled) has ever ingested.
 *
 * D-11: this MUST be a live probe, never a hardcoded claim about another
 * repo's state. A hardcoded `return false` (or a comment asserting
 * "Ástríðr has no ARMS inventory") is exactly the line that goes stale
 * silently and is never struck the day A3 ships.
 *
 * Returns:
 *   undefined → api.graphSnapshots.listSnapshots is still resolving
 *   false     → resolved, no row has a "arms" source (or no rows at all)
 *   true      → at least one row has a source with kind: "arms"
 *
 * Defensively guards `r.sources` against a missing/non-array value — an
 * older stored row could in principle lack it — so the probe degrades to
 * `false` for that row rather than throwing. An unhandled throw here would
 * propagate to the nearest error boundary and blank the page (CLAUDE.md §
 * Patterns).
 */
export function useArmsProbe(): boolean | undefined {
  const rows = useQuery(api.graphSnapshots.listSnapshots);

  if (rows === undefined) return undefined;

  return rows.some(
    (r) =>
      Array.isArray(r.sources) &&
      r.sources.some((s) => s.kind === "arms")
  );
}
