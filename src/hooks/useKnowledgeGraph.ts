import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import {
  fetchOverview,
  fetchEntity,
  fetchContradictions,
} from "../lib/kgApi";
import {
  toGraphData,
  deriveView,
  normalizeOverview,
  normalizeEntity,
  normalizeEntities,
  normalizeContradictions,
  computeFocusSet,
  derivePredicates,
  deriveEntityTypes,
  type KgGraphData,
  type KgViewFilters,
} from "../lib/kg-graph";

export type KgLens = "overview" | "entity" | "temporal" | "contradiction" | "search";

export interface KgFilters {
  entityType: string | null;
  predicate: string | null;
  agentId: string | null;
  /** entity lens: search name + hops */
  entityName: string;
  /**
   * entity lens: pins the fetch to an exact entity UUID, bypassing
   * name-similarity resolution (187-05 D-09 fix). Takes precedence over
   * `entityName` when set (but see `entityIds`, which takes precedence over
   * THIS). Programmatic only (set by the answer-sync ego-lens fallback) —
   * never bound to a user-facing text input, and excluded from idb
   * persistence (ephemeral, mirrors `searchQuery`) so a stale id can never
   * survive a reload or leak into a later manual search.
   */
  entityId: string | null;
  /**
   * 190-08/D-11/GLXY-04: entity lens, pins the fetch to N entity UUIDs in one
   * round-trip (a turn resolving N>1 sources — the D-09 answer-sync
   * fallback). Takes precedence over `entityId`, which still takes
   * precedence over `entityName`. Programmatic only, same rationale as
   * `entityId` above — never bound to a user-facing input, excluded from idb
   * persistence and from saved views (a transient, sync-driven id set must
   * never survive a reload or leak into a later manual search/saved view).
   */
  entityIds: string[] | null;
  hops: number;
  /** temporal lens: as-of ISO date (or null = current) */
  asOf: string | null;
  /** overview/temporal limit */
  limit: number;
  /** search lens: full-text query. Ephemeral — NOT persisted to idb (RESEARCH Pitfall 6). */
  searchQuery: string;
}

const DEFAULT_FILTERS: KgFilters = {
  entityType: null,
  predicate: null,
  agentId: null,
  entityName: "",
  entityId: null,
  entityIds: null,
  hops: 1,
  asOf: null,
  limit: 100,
  searchQuery: "",
};

const PERSIST_KEY = "kg-explorer-state-v1";

interface PersistedState {
  lens: KgLens;
  filters: Partial<KgFilters>;
}

export interface UseKnowledgeGraph {
  lens: KgLens;
  setLens: (l: KgLens) => void;
  filters: KgFilters;
  setFilter: <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => void;
  /** rendered graph (post client-side deriveView). */
  graph: KgGraphData;
  /** full graph before deriveView (for option lists). */
  rawGraph: KgGraphData;
  loading: boolean;
  error: string | null;
  /** overview/temporal truncation metadata. */
  truncated: { truncated: boolean; total: number } | null;
  /** re-run the active lens fetch. */
  refresh: () => void;
  /** selection (transient). */
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  focusSet: Set<string> | null;
  /** filter option lists derived from the current graph. */
  predicates: string[];
  entityTypes: string[];
}

const EMPTY_GRAPH: KgGraphData = {
  nodes: [],
  links: [],
  stats: {
    nodeCount: 0,
    edgeCount: 0,
    attributeCount: 0,
    currentEdges: 0,
    supersededEdges: 0,
    contradictionEdges: 0,
  },
};

/**
 * Drives the KG Explorer: owns lens + filters (idb-persisted), per-lens fetch
 * (interactive /api/kg path), transform to {nodes,links}, client-side deriveView,
 * selection, and focus highlighting. Each lens picks a fetcher + normalizer; the
 * downstream pipeline (toGraphData → deriveView) is shared.
 */
export function useKnowledgeGraph(): UseKnowledgeGraph {
  const [lens, setLensState] = useState<KgLens>("overview");
  const [filters, setFilters] = useState<KgFilters>(DEFAULT_FILTERS);
  const [rawGraph, setRawGraph] = useState<KgGraphData>(EMPTY_GRAPH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState<{
    truncated: boolean;
    total: number;
  } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Monotonic request token so a slow stale fetch can't clobber a newer one.
  const reqRef = useRef(0);
  // Manual refresh bump.
  const [refreshTick, setRefreshTick] = useState(0);

  // ── Persistence: hydrate lens + filters from idb once. ────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = (await idbGet(PERSIST_KEY)) as PersistedState | undefined;
        if (!cancelled && saved) {
          // Do not restore the "search" lens — it is ephemeral and a stale query
          // is poor UX (RESEARCH Pitfall 6 / Open Q3). Fall back to "overview".
          if (saved.lens && saved.lens !== "search") setLensState(saved.lens);
          if (saved.filters)
            setFilters((f) => ({ ...f, ...saved.filters }));
        }
      } catch {
        /* ignore — first run / private mode */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist lens + filters (after hydration so we don't write defaults over saved).
  // Strip searchQuery — it is ephemeral and must not be persisted (RESEARCH Pitfall 6).
  // Strip entityId (187-05) and entityIds (190-08/D-11) for the same reason:
  // both are programmatic/sync-driven, re-derived fresh from the latest
  // kg_answer_sync row on every mount (D-08 page-open replay) — persisting a
  // stale id (or id set) across reloads/sessions would let it silently
  // outlive the sync it came from.
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { searchQuery: _sq, entityId: _eid, entityIds: _eids, ...persistableFilters } = filters;
    idbSet(PERSIST_KEY, { lens, filters: persistableFilters } as PersistedState).catch(() => {});
  }, [lens, filters, hydrated]);

  const setLens = useCallback((l: KgLens) => {
    setLensState(l);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const setFilter = useCallback(
    <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => {
      setFilters((f) => ({ ...f, [key]: value }));
    },
    [],
  );

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  // ── Fetch the active lens. Re-runs when lens / relevant filters change. ───
  // The entity lens fetches when a name, entityId, OR entityIds is present.
  // Precedence: entityIds (190-08/D-11) > entityId (187-05) > entityName.
  const { entityName, entityId, entityIds, hops, asOf, entityType, agentId, limit } = filters;

  useEffect(() => {
    if (!hydrated) return;
    const token = ++reqRef.current;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        let next: KgGraphData = EMPTY_GRAPH;
        let trunc: { truncated: boolean; total: number } | null = null;

        if (lens === "overview" || lens === "temporal") {
          const resp = await fetchOverview({
            limit,
            entityType,
            agentId,
            asOf: lens === "temporal" ? asOf : null,
          });
          const payload = normalizeOverview(resp);
          next = toGraphData(payload);
          trunc = { truncated: resp.truncated, total: resp.total };
        } else if (lens === "entity") {
          if (entityIds && entityIds.length > 0) {
            // 190-08/D-11/GLXY-04: N>1 resolved sources known — fetch all in
            // one round-trip via the multi-id path, ahead of entityId/name.
            const resp = await fetchEntity({ entityIds, hops, agentId, asOf });
            next = toGraphData(normalizeEntities(resp));
          } else if (entityId) {
            // 187-05 D-09 fix: an exact UUID is known — fetch by id, bypassing
            // astridr's name-similarity resolver entirely (never ambiguous).
            const resp = await fetchEntity({ entityId, hops, agentId, asOf });
            next = toGraphData(normalizeEntity(resp));
          } else if (!entityName.trim()) {
            next = EMPTY_GRAPH;
          } else {
            const resp = await fetchEntity({
              name: entityName.trim(),
              hops,
              agentId,
              asOf,
            });
            next = toGraphData(normalizeEntity(resp));
          }
        } else if (lens === "contradiction") {
          const resp = await fetchContradictions();
          next = toGraphData(normalizeContradictions(resp));
        } else if (lens === "search") {
          // Search results live in separate page-level state (KnowledgeGraph.tsx).
          // The hook manages lens/filter plumbing only; rawGraph stays empty in this lens.
          next = EMPTY_GRAPH;
        }

        if (!cancelled && token === reqRef.current) {
          setRawGraph(next);
          setTruncated(trunc);
        }
      } catch (e: any) {
        if (!cancelled && token === reqRef.current) {
          setError(e?.message ?? "Failed to load knowledge graph.");
          setRawGraph(EMPTY_GRAPH);
          setTruncated(null);
        }
      } finally {
        if (!cancelled && token === reqRef.current) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    lens,
    entityName,
    entityId,
    entityIds,
    hops,
    asOf,
    entityType,
    agentId,
    limit,
    refreshTick,
  ]);

  // ── Client-side view derivation (type / predicate / agent). ───────────────
  // For overview/temporal, server already applied type+agent; we still apply the
  // predicate filter (server has no predicate param) and re-apply type/agent so
  // the same control set works across all lenses uniformly.
  const viewFilters: KgViewFilters = useMemo(
    () => ({
      entityTypes: entityType ? [entityType] : null,
      predicates: filters.predicate ? [filters.predicate] : null,
      agentId: agentId,
    }),
    [entityType, filters.predicate, agentId],
  );

  const graph = useMemo(
    () => deriveView(rawGraph, viewFilters),
    [rawGraph, viewFilters],
  );

  const focusSet = useMemo(
    () => computeFocusSet(graph, selectedNodeId),
    [graph, selectedNodeId],
  );

  const predicates = useMemo(() => derivePredicates(rawGraph), [rawGraph]);
  const entityTypes = useMemo(() => deriveEntityTypes(rawGraph), [rawGraph]);

  const selectNode = useCallback((id: string | null) => {
    setSelectedNodeId(id);
    setSelectedEdgeId(null);
  }, []);
  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    setSelectedNodeId(null);
  }, []);

  return {
    lens,
    setLens,
    filters,
    setFilter,
    graph,
    rawGraph,
    loading,
    error,
    truncated,
    refresh,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    focusSet,
    predicates,
    entityTypes,
  };
}
