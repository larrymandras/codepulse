/**
 * useKgDiff — Temporal diff hook (Phase 87, KG-11, Plan 03).
 *
 * Fetches two `fetchOverview({ asOf })` snapshots and computes client-side
 * diff sets: added/removed/changed nodes + independently-classified edges.
 *
 * Diff semantics (CONTEXT.md):
 *   D-10: A node is "changed" if its attributes OR incident current-edge set
 *         differ between snapshot A and B.
 *   D-11: Edges are diffed independently — each gets its own add/remove/change.
 *   D-12: Diff is client-side, node-id-based.
 *   D-08: Graceful-degrade on fetch failure — sets inline error copy, never throws.
 *
 * Edge identity: link.id when present, else composite `${source}|${target}|${predicate}`
 * (RESEARCH Pitfall 6 / Assumption A2).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { fetchOverview } from "../lib/kgApi";
import { AstridrApiError } from "../lib/astridrApi";
import {
  toGraphData,
  normalizeOverview,
  type KgGraphData,
  type KgNode,
  type KgAttribute,
  type KgLink,
} from "../lib/kg-graph";

// ── Diff sets type ───────────────────────────────────────────────────────────

export interface KgDiffSets {
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
  edges: {
    added: Set<string>;
    removed: Set<string>;
    changed: Set<string>;
  };
}

// ── Edge key ─────────────────────────────────────────────────────────────────

/**
 * Derive a stable edge identity key for diffing.
 * Uses link.id when present; falls back to composite source|target|predicate
 * if link.id is absent or empty (RESEARCH Pitfall 6 / A2).
 *
 * source/target may be a node-object reference after force-graph processing,
 * so we resolve to a string id defensively.
 */
function edgeKey(link: KgLink): string {
  if (link.id) return link.id;
  const src =
    typeof link.source === "object" && link.source !== null
      ? (link.source as KgNode).id
      : String(link.source);
  const tgt =
    typeof link.target === "object" && link.target !== null
      ? (link.target as KgNode).id
      : String(link.target);
  return `${src}|${tgt}|${link.predicate}`;
}

// ── Attribute serialization ───────────────────────────────────────────────────

function serializeAttrs(attrs: KgAttribute[]): string {
  // Sort by predicate+value+confidence for stable comparison (D-10).
  const sorted = [...attrs].sort((a, b) => {
    const kA = `${a.predicate}||${a.value}||${a.confidence}`;
    const kB = `${b.predicate}||${b.value}||${b.confidence}`;
    return kA < kB ? -1 : kA > kB ? 1 : 0;
  });
  return JSON.stringify(
    sorted.map((a) => ({
      predicate: a.predicate,
      value: a.value,
      confidence: a.confidence,
    })),
  );
}

// ── computeDiff pure function ─────────────────────────────────────────────────

/**
 * Pure function: computes diff sets between two KgGraphData snapshots.
 * Exported for unit testing.
 */
export function computeDiff(
  graphA: KgGraphData,
  graphB: KgGraphData,
): KgDiffSets {
  // ── Node sets ───────────────────────────────────────────────────────────────
  const idsA = new Set(graphA.nodes.map((n) => n.id));
  const idsB = new Set(graphB.nodes.map((n) => n.id));

  const added = new Set<string>([...idsB].filter((id) => !idsA.has(id)));
  const removed = new Set<string>([...idsA].filter((id) => !idsB.has(id)));
  const changed = new Set<string>();

  // Build incident-current-edge key sets for each node in each graph.
  function incidentCurrentEdgeKeys(
    nodeId: string,
    links: KgLink[],
  ): Set<string> {
    const keys = new Set<string>();
    for (const l of links) {
      if (!l.current) continue;
      const src =
        typeof l.source === "object" && l.source !== null
          ? (l.source as KgNode).id
          : String(l.source);
      const tgt =
        typeof l.target === "object" && l.target !== null
          ? (l.target as KgNode).id
          : String(l.target);
      if (src === nodeId || tgt === nodeId) {
        keys.add(edgeKey(l));
      }
    }
    return keys;
  }

  // Build a lookup map for O(1) node access.
  const nodeMapA = new Map<string, KgNode>(graphA.nodes.map((n) => [n.id, n]));
  const nodeMapB = new Map<string, KgNode>(graphB.nodes.map((n) => [n.id, n]));

  for (const id of idsB) {
    if (!idsA.has(id)) continue; // already in added
    const nA = nodeMapA.get(id)!;
    const nB = nodeMapB.get(id)!;

    // D-10: attribute comparison
    if (serializeAttrs(nA.attributes) !== serializeAttrs(nB.attributes)) {
      changed.add(id);
      continue;
    }

    // D-10: incident current-edge set comparison
    const edgesA = incidentCurrentEdgeKeys(id, graphA.links);
    const edgesB = incidentCurrentEdgeKeys(id, graphB.links);
    if (
      edgesA.size !== edgesB.size ||
      [...edgesA].some((k) => !edgesB.has(k))
    ) {
      changed.add(id);
    }
  }

  // ── Edge diff (D-11 — independent classification) ────────────────────────
  const edgeMapA = new Map<string, KgLink>();
  for (const l of graphA.links) {
    edgeMapA.set(edgeKey(l), l);
  }
  const edgeMapB = new Map<string, KgLink>();
  for (const l of graphB.links) {
    edgeMapB.set(edgeKey(l), l);
  }

  const edgesAdded = new Set<string>();
  const edgesRemoved = new Set<string>();
  const edgesChanged = new Set<string>();

  // Find added and changed edges
  for (const [key, lB] of edgeMapB) {
    if (!edgeMapA.has(key)) {
      edgesAdded.add(key);
    } else {
      const lA = edgeMapA.get(key)!;
      // D-11: changed if current or validTo differs
      if (lA.current !== lB.current || lA.validTo !== lB.validTo) {
        edgesChanged.add(key);
      }
    }
  }

  // Find removed edges
  for (const key of edgeMapA.keys()) {
    if (!edgeMapB.has(key)) {
      edgesRemoved.add(key);
    }
  }

  return {
    added,
    removed,
    changed,
    edges: {
      added: edgesAdded,
      removed: edgesRemoved,
      changed: edgesChanged,
    },
  };
}

// ── useKgDiff hook ────────────────────────────────────────────────────────────

export interface UseKgDiff {
  diff: KgDiffSets | null;
  graphB: KgGraphData | null;
  loading: boolean;
  error: string | null;
  compare: () => Promise<void>;
}

export function useKgDiff(
  dateA: string | null,
  dateB: string | null,
): UseKgDiff {
  const [graphA, setGraphA] = useState<KgGraphData | null>(null);
  const [graphBState, setGraphB] = useState<KgGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Monotonic request token — drops stale in-flight fetches (mirror useKnowledgeGraph.ts:116).
  const reqRef = useRef(0);

  const compare = useCallback(async () => {
    if (!dateA || !dateB) return;

    const token = ++reqRef.current;
    setLoading(true);
    setError(null);
    // Clear any prior result so a failed re-compare cannot render a stale diff
    // beneath the error banner (D-08). Repopulated on success below.
    setGraphA(null);
    setGraphB(null);

    try {
      const [respA, respB] = await Promise.all([
        fetchOverview({ asOf: dateA }),
        fetchOverview({ asOf: dateB }),
      ]);

      // Drop if a newer compare() was called while these fetches were in flight.
      if (token !== reqRef.current) return;

      setGraphA(toGraphData(normalizeOverview(respA)));
      setGraphB(toGraphData(normalizeOverview(respB)));
    } catch (e) {
      // Stale-drop on error too.
      if (token !== reqRef.current) return;

      // D-08 graceful-degrade: set human-readable error, do not throw.
      if (e instanceof AstridrApiError && e.status === 404) {
        setError(
          `Could not load snapshot for ${dateA} or ${dateB}.`,
        );
      } else if (e instanceof Error && e.name === "AstridrApiError") {
        // Handles mocked errors in tests where instanceof may not work across module boundaries
        const errWithStatus = e as Error & { status?: number };
        if (errWithStatus.status === 404) {
          setError(`Could not load snapshot for ${dateA} or ${dateB}.`);
        } else {
          setError("Could not reach Ástríðr.");
        }
      } else {
        setError("Could not reach Ástríðr.");
      }
    } finally {
      // Only clear loading if this is still the active request.
      if (token === reqRef.current) {
        setLoading(false);
      }
    }
  }, [dateA, dateB]);

  const diff = useMemo(
    () => (graphA && graphBState ? computeDiff(graphA, graphBState) : null),
    [graphA, graphBState],
  );

  return {
    diff,
    graphB: graphBState,
    loading,
    error,
    compare,
  };
}
