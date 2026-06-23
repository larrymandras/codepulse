import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Share2, AlertTriangle, Info, ChevronLeft } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import {
  ForceGraphCanvas,
  type ForceGraphHandle,
} from "../components/graph/ForceGraphCanvas";
import KGSummaryCards from "../components/kg/KGSummaryCards";
import KGControls from "../components/kg/KGControls";
import KGDetailsPanel from "../components/kg/KGDetailsPanel";
import KGSearchResults from "../components/kg/KGSearchResults";
import { useKnowledgeGraph } from "../hooks/useKnowledgeGraph";
import { useSavedViews } from "../hooks/useSavedViews";
import { useKgDiff } from "../hooks/useKgDiff";
import { useFocusParam } from "../hooks/useFocusParam";
import { centerNodeWhenReady } from "../lib/graph-center";
import { buildFocusUrl } from "../lib/focus-url";
import { fetchSearch, type KgSearchHit } from "../lib/kgApi";
import { AstridrApiError } from "../lib/astridrApi";
import type { KgLens } from "../hooks/useKnowledgeGraph";
import type { TemporalSubMode } from "../components/kg/KGControls";
import type { SavedKgView } from "../hooks/useSavedViews";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ENTITY_TYPE_COLORS,
  communityColor,
  type KgNode,
  type KgLink,
} from "../lib/kg-graph";

// ── Edge styling (KG-07): current solid / superseded dashed+dim / contradiction red.
const COLOR_CONTRA = "#ef4444";
const COLOR_CURRENT = "rgba(16, 185, 129, 0.55)";
const COLOR_SUPERSEDED = "rgba(148, 163, 184, 0.3)";

function linkColorFn(l: any): string {
  const link = l as KgLink;
  if (link.contradictionFlag) return COLOR_CONTRA;
  return link.current ? COLOR_CURRENT : COLOR_SUPERSEDED;
}
function linkWidthFn(l: any): number {
  return (l as KgLink).width ?? 1;
}
function linkLineDashFn(l: any): number[] | null {
  return (l as KgLink).current ? null : [4, 3];
}

// ── Diff edge styling (KG-11, Plan 03) — UI-SPEC Color section ──────────────
// Resolves the same edge key as computeDiff (must stay in sync with useKgDiff.ts).
function diffEdgeKey(l: KgLink): string {
  if (l.id) return l.id;
  const src =
    typeof l.source === "object" && l.source !== null
      ? (l.source as KgNode).id
      : String(l.source);
  const tgt =
    typeof l.target === "object" && l.target !== null
      ? (l.target as KgNode).id
      : String(l.target);
  return `${src}|${tgt}|${l.predicate}`;
}

function makeLinkColorDiffFn(edges: {
  added: Set<string>;
  removed: Set<string>;
  changed: Set<string>;
}) {
  return function linkColorDiffFn(l: any): string {
    const link = l as KgLink;
    const key = diffEdgeKey(link);
    if (edges.added.has(key)) return "rgba(34,197,94,0.55)";   // green — added
    if (edges.removed.has(key)) return "rgba(239,68,68,0.40)"; // red — removed
    if (edges.changed.has(key)) return "rgba(234,179,8,0.55)";  // amber — changed
    return "rgba(161,163,170,0.15)";                            // zinc — unchanged
  };
}

function makeLinkLineDashDiffFn(edges: { removed: Set<string> }) {
  return function linkLineDashDiffFn(l: any): number[] | null {
    const link = l as KgLink;
    const key = diffEdgeKey(link);
    return edges.removed.has(key) ? [4, 3] : null; // removed edges are dashed
  };
}

/** Derive origin surface label from the decoded from-param path. */
function originLabel(fromPath: string): string {
  const segment = fromPath.split("?")[0];
  if (segment === "/tool-galaxy") return "Tool Galaxy";
  if (segment === "/graphs") return "Code/Vault Graph";
  if (segment === "/knowledge-graph") return "KG Explorer";
  return "previous graph";
}

export default function KnowledgeGraph() {
  const kg = useKnowledgeGraph();
  const savedViews = useSavedViews();
  const fgRef = useRef<ForceGraphHandle>(null);
  const navigate = useNavigate();

  const {
    lens,
    setLens,
    filters,
    setFilter,
    graph,
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
  } = kg;

  // ── Temporal sub-mode state (KG-11, Plan 03) ─────────────────────────────────
  // Defaults to "point" which preserves the existing single-as-of behavior (SC — no regression).
  // Resets to "point" when lens changes away from / re-enters temporal (UI-SPEC: state discarded).
  const [temporalSubMode, setTemporalSubMode] = useState<TemporalSubMode>("point");

  useEffect(() => {
    if (lens !== "temporal") {
      setTemporalSubMode("point");
    }
  }, [lens]);

  // ── Diff state (KG-11, Plan 03) ───────────────────────────────────────────────
  const [diffDateA, setDiffDateA] = useState<string | null>(null);
  const [diffDateB, setDiffDateB] = useState<string | null>(null);
  const {
    diff,
    graphB: diffGraphB,
    loading: diffLoading,
    error: diffError,
    compare,
  } = useKgDiff(diffDateA, diffDateB);

  // ── Search lens state (KG-08) ─────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<KgSearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchGateState, setSearchGateState] = useState<
    "ok" | "not-deployed" | "error" | "idle"
  >("idle");
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  // Monotonic token — drops stale responses when a new fetch supersedes the current one.
  const searchReqRef = useRef(0);

  // ── Inbound entity-lens focus params ────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const focusEntity = searchParams.get("focus");
  const lensParam = searchParams.get("lens");
  const hopsParam = searchParams.get("hops");

  // ── ?view share-link hydration (KG-10) ──────────────────────────────────────
  const viewToken = searchParams.get("view");
  // One-shot guard: apply the ?view hydration exactly once (mirrors appliedFocusRef).
  const appliedViewRef = useRef(false);
  // Track the currently-loaded saved-view _id (cleared on any subsequent filter/lens change).
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  // Track idb hydration completion as reactive STATE (not a ref) so the
  // override effect below re-runs explicitly when hydration settles, instead of
  // depending on incidental `loading`-flip ordering (WR-04). The saved-state
  // restore runs inside useKnowledgeGraph before the first fetch; once loading
  // transitions to false the first time, hydration is done.
  const [hydrated, setHydrated] = useState(false);
  // One-shot guard: apply the inbound override exactly once.
  const appliedFocusRef = useRef(false);

  useEffect(() => {
    // Idempotent: flips to true on the first non-loading render and stays.
    if (!loading) setHydrated(true);
  }, [loading]);

  useEffect(() => {
    // No focus entity → nothing to override.
    if (!focusEntity) return;
    // Already applied → stay no-op.
    if (appliedFocusRef.current) return;
    // idb hydration not yet complete → wait (explicit dependency, WR-04).
    if (!hydrated) return;

    // Apply the entity-lens override AFTER hydration so saved-state restore
    // cannot clobber it.
    appliedFocusRef.current = true;
    if (lensParam === "entity") setLens("entity");
    setFilter("entityName", focusEntity);
    // Clamp ?hops to a sane integer range — a crafted URL could supply a
    // negative or huge value that would otherwise reach the backend (WR-03).
    const parsedHops = Math.max(1, Math.min(6, Math.floor(Number(hopsParam)) || 1));
    setFilter("hops", parsedHops);
  }, [focusEntity, lensParam, hopsParam, hydrated, setLens, setFilter]);

  // ── ?view share-link one-shot hydration (KG-10, RESEARCH Pitfall 1) ─────────
  // Mirrors the ?focus guard above. Requires a THIRD guard (views !== undefined)
  // because view resolution needs a Convex query result, not just idb hydration.
  useEffect(() => {
    if (!viewToken) return;             // no ?view param → nothing to do
    if (appliedViewRef.current) return; // already applied
    if (!hydrated) return;              // wait for idb hydration
    // RESEARCH Pitfall 1: wait for Convex list query to settle.
    // isLoading is true when the underlying useQuery returns undefined.
    // This is the third guard condition required for ?view (not needed for ?focus
    // which only uses nodes already in the graph, not a separate Convex query).
    if (savedViews.isLoading) return;

    const view = savedViews.views.find((v) => v.shareToken === viewToken);
    if (!view) return; // token absent/expired → silent fallback (D-04)

    appliedViewRef.current = true;
    appliedFocusRef.current = true; // suppress ?focus guard (RESEARCH Pitfall 5)

    setLens(view.lens as KgLens);
    // Apply all persisted filter fields
    setFilter("entityName", (view.filters.entityName as string) ?? "");
    setFilter("hops", (view.filters.hops as number) ?? 1);
    setFilter("asOf", (view.filters.asOf as string | null) ?? null);
    setFilter("entityType", (view.filters.entityType as string | null) ?? null);
    setFilter("predicate", (view.filters.predicate as string | null) ?? null);
    setFilter("agentId", (view.filters.agentId as string | null) ?? null);
    setFilter("limit", (view.filters.limit as number) ?? 100);
    setActiveViewId(view._id);
  }, [viewToken, hydrated, savedViews.isLoading, savedViews.views, setLens, setFilter]);

  // ── Search lens: debounced fetch (KG-08) ────────────────────────────────────
  // Active only when lens === "search". Empty/whitespace query → idle, no fetch.
  // Gate: AstridrApiError 404/501 → "not-deployed" informational copy (D-01/SC#2).
  // Monotonic token guard drops stale responses from superseded fetches (T-86-10).
  useEffect(() => {
    if (lens !== "search") return;

    const query = filters.searchQuery.trim();
    if (!query) {
      setSearchGateState("idle");
      setSearchResults([]);
      return;
    }

    // 250ms debounce (UI-SPEC Interaction Contract)
    const timer = setTimeout(async () => {
      const token = ++searchReqRef.current;
      setSearchLoading(true);
      setSearchErrorMessage(null);

      try {
        const data = await fetchSearch({
          query,
          entity_type: filters.entityType,
          agent_id: filters.agentId,
        });
        if (token !== searchReqRef.current) return; // stale drop
        setSearchResults(data.results);
        setSearchGateState("ok");
      } catch (e) {
        if (token !== searchReqRef.current) return; // stale drop
        if (
          e instanceof AstridrApiError &&
          (e.status === 404 || e.status === 501)
        ) {
          // D-01 graceful-degrade: endpoint not yet deployed on this Ástríðr build
          setSearchGateState("not-deployed");
          setSearchResults([]);
        } else {
          setSearchGateState("error");
          setSearchResults([]);
          setSearchErrorMessage(
            e instanceof Error ? e.message : "Unknown error",
          );
        }
      } finally {
        if (token === searchReqRef.current) setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [lens, filters.searchQuery, filters.entityType, filters.agentId]);

  // ── Saved-view callbacks (KG-10) ─────────────────────────────────────────────
  const handleSaveView = useCallback(
    (name: string) => {
      savedViews.saveView(name, lens, filters, filters.entityName, filters.hops);
    },
    [savedViews, lens, filters],
  );

  const handleLoadView = useCallback(
    (view: SavedKgView) => {
      setLens(view.lens as KgLens);
      setFilter("entityName", (view.filters.entityName as string) ?? "");
      setFilter("hops", (view.filters.hops as number) ?? 1);
      setFilter("asOf", (view.filters.asOf as string | null) ?? null);
      setFilter("entityType", (view.filters.entityType as string | null) ?? null);
      setFilter("predicate", (view.filters.predicate as string | null) ?? null);
      setFilter("agentId", (view.filters.agentId as string | null) ?? null);
      setFilter("limit", (view.filters.limit as number) ?? 100);
      setActiveViewId(view._id);
    },
    [setLens, setFilter],
  );

  const handleDeleteView = useCallback(
    (id: Id<"savedKgViews">) => {
      savedViews.deleteView(id);
      // Clear active if this was the loaded view
      setActiveViewId((prev) => (prev === id ? null : prev));
    },
    [savedViews],
  );

  const handleCopyLink = useCallback(
    (shareToken: string) => {
      navigator.clipboard.writeText(savedViews.buildShareUrl(shareToken));
      toast.success("View link copied");
    },
    [savedViews],
  );

  // ── Result-click → ego lens focus (D-02, Phase 85 buildFocusUrl reuse) ──────
  // subjectName is passed VERBATIM — no normalization (RESEARCH Pitfall 4).
  // buildFocusUrl produces: /knowledge-graph?focus=<name>&lens=entity&hops=1&from=<encoded>
  // The existing inbound override effect (lensParam === "entity" branch) switches
  // from "search" to "entity" automatically when the URL is navigated to.
  const handleSearchResultClick = useCallback(
    (subjectName: string) => {
      const url = buildFocusUrl(
        { surface: "knowledge-graph", entityName: subjectName, hops: 1 },
        window.location.pathname + window.location.search,
      );
      navigate(url);
    },
    [navigate],
  );

  // ── Center the focused entity once it resolves ───────────────────────────────
  // useFocusParam matches on node.name (KG focus is name-based, D-02).
  // Silent no-op when the entity is not found (SC#3).
  const { fromParam } = useFocusParam({
    nodes: focusEntity ? kg.graph.nodes : undefined,
    getId: (n: KgNode) => n.name,
    onFocus: (node: KgNode) => {
      kg.selectNode(node.id);
      // Center once the force layout assigns x/y (WR-02 — retry, don't skip).
      centerNodeWhenReady(fgRef, node as KgNode & { x?: number; y?: number });
    },
  });

  // Derive the return chip label from the decoded from-param.
  const returnLabel = fromParam ? originLabel(fromParam) : null;

  // KG-07 node paint: type color, degree size, focus dim, label on zoom/hover.
  const paintNode = useCallback(
    (
      node: any,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
      opts: { hovered: boolean; dimmed: boolean },
    ) => {
      const n = node as KgNode & { x: number; y: number };
      const size = Math.max(n.val ?? 3, 3);
      const isSelected = n.id === selectedNodeId;
      ctx.globalAlpha = opts.dimmed ? 0.18 : 1;

      ctx.beginPath();
      ctx.arc(n.x, n.y, size, 0, 2 * Math.PI, false);
      ctx.shadowColor = n.color;
      ctx.shadowBlur = opts.hovered || isSelected ? 24 : 8;
      ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : n.color;
      ctx.fill();
      ctx.shadowBlur = 0;

      // selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, size + 3, 0, 2 * Math.PI, false);
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (globalScale > 1.3 || opts.hovered || isSelected) {
        const fontSize = (opts.hovered ? 13 : 11) / globalScale;
        ctx.font = `${opts.hovered ? "bold " : ""}${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = n.name;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
        ctx.fillRect(n.x - tw / 2 - 4, n.y + size + 2, tw + 8, fontSize + 4);
        ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : n.color;
        ctx.fillText(label, n.x, n.y + size + 2 + (fontSize + 4) / 2);
      }
      ctx.globalAlpha = 1;
    },
    [selectedNodeId],
  );

  // ── Diff canvas paint function (KG-11, Plan 03) ──────────────────────────────
  // Mirrors paintNode but applies the diff color palette (UI-SPEC Color section).
  // Unchanged nodes are dimmed to globalAlpha 0.35 (RESEARCH Pitfall 3 — explicit dim).
  const paintNodeDiff = useCallback(
    (
      node: any,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
      opts: { hovered: boolean; dimmed: boolean },
    ) => {
      const n = node as KgNode & { x: number; y: number };
      const size = Math.max(n.val ?? 3, 3);
      const isSelected = n.id === selectedNodeId;

      // Diff color lookup — added/removed/changed/unchanged (UI-SPEC Color section)
      const DIFF_COLORS: Record<string, { fill: string; alpha: number }> = {
        added:     { fill: "#22c55e", alpha: 1.0 },
        removed:   { fill: "#ef4444", alpha: 1.0 },
        changed:   { fill: "#eab308", alpha: 1.0 },
        unchanged: { fill: n.color,   alpha: 0.35 }, // node.color @ 35% (Pitfall 3)
      };

      const state = diff
        ? diff.added.has(n.id)
          ? "added"
          : diff.removed.has(n.id)
            ? "removed"
            : diff.changed.has(n.id)
              ? "changed"
              : "unchanged"
        : "unchanged";

      const dc = DIFF_COLORS[state];

      ctx.globalAlpha = dc.alpha; // 0.35 for unchanged (RESEARCH Pitfall 3)

      ctx.beginPath();
      ctx.arc(n.x, n.y, size, 0, 2 * Math.PI, false);
      ctx.shadowColor = dc.fill;
      ctx.shadowBlur = opts.hovered || isSelected ? 24 : 8;
      ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : dc.fill;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Selection ring (same as paintNode — unchanged in diff mode)
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, size + 3, 0, 2 * Math.PI, false);
        ctx.strokeStyle = dc.fill;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (globalScale > 1.3 || opts.hovered || isSelected) {
        const fontSize = (opts.hovered ? 13 : 11) / globalScale;
        ctx.font = `${opts.hovered ? "bold " : ""}${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = n.name;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
        ctx.fillRect(n.x - tw / 2 - 4, n.y + size + 2, tw + 8, fontSize + 4);
        ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : dc.fill;
        ctx.fillText(label, n.x, n.y + size + 2 + (fontSize + 4) / 2);
      }

      // Reset alpha after painting each node (RESEARCH Pitfall 3)
      ctx.globalAlpha = 1;
    },
    [selectedNodeId, diff],
  );

  const labelFn = useCallback((n: any) => {
    const node = n as KgNode;
    return `${node.name} · ${node.entityType}${
      node.attributes.length ? ` · ${node.attributes.length} attrs` : ""
    }`;
  }, []);

  // ── Diff edge style functions (memoized on diff.edges) ─────────────────────
  const linkColorDiffFn = useMemo(
    () => (diff ? makeLinkColorDiffFn(diff.edges) : linkColorFn),
    [diff],
  );
  const linkLineDashDiffFn = useMemo(
    () =>
      diff
        ? makeLinkLineDashDiffFn(diff.edges)
        : linkLineDashFn,
    [diff],
  );

  // ── Determine which graph data to render (diff: use graphB; otherwise: graph) ──
  const isDiffActive =
    lens === "temporal" &&
    temporalSubMode === "diff" &&
    diff !== null &&
    diffGraphB !== null;

  // The active graph data: use diffGraphB when in diff mode, otherwise the main graph.
  const activeGraph = isDiffActive ? diffGraphB! : graph;

  // Legend shows only the types present in the current graph.
  const legendTypes = useMemo(() => {
    const present = new Set(activeGraph.nodes.map((n) => n.entityType));
    return ENTITY_TYPE_COLORS.filter((c) => present.has(c.type));
  }, [activeGraph.nodes]);

  // Community legend: sorted unique non-null community ids from the current graph.
  // Auto-hides when no node carries community (SC#4 no-regression).
  const presentCommunities = useMemo(() => {
    const ids = new Set<number>();
    for (const n of activeGraph.nodes) {
      if (n.community != null) ids.add(n.community);
    }
    return [...ids].sort((a, b) => a - b);
  }, [activeGraph.nodes]);

  const isEmpty = graph.nodes.length === 0;
  const needsEntityName =
    lens === "entity" && !filters.entityName.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            KG Explorer
            <InfoTooltip text="Ástríðr's temporal knowledge graph: entities (type-colored) and the facts connecting them. Current relationships are solid; superseded facts dashed; contradictions red. Literal facts show as entity attributes in the details panel." />
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            entities · knowledge_triples — fetched on demand from /api/kg
          </p>
        </div>
      </div>

      {/* KG-01: always-on summary cards (Convex kgSummary) */}
      <SectionErrorBoundary name="KG Summary">
        <KGSummaryCards />
      </SectionErrorBoundary>

      {/* Controls */}
      <SectionErrorBoundary name="KG Controls">
        <KGControls
          lens={lens}
          onLens={setLens}
          filters={filters}
          setFilter={setFilter}
          entityTypes={entityTypes}
          predicates={predicates}
          loading={loading}
          onRefresh={refresh}
          views={savedViews.views}
          activeViewId={activeViewId}
          onLoadView={handleLoadView}
          onDeleteView={handleDeleteView}
          onCopyLink={handleCopyLink}
          onSaveView={handleSaveView}
          temporalSubMode={temporalSubMode}
          onSubMode={setTemporalSubMode}
          diffDateA={diffDateA}
          diffDateB={diffDateB}
          onChangeDiffDateA={setDiffDateA}
          onChangeDiffDateB={setDiffDateB}
          onCompare={compare}
          diffLoading={diffLoading}
        />
      </SectionErrorBoundary>

      {/* Error / truncation banners */}
      {error && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          <div className="text-sm font-mono leading-relaxed">
            <p className="text-foreground">Could not reach the KG read API.</p>
            <p className="text-muted-foreground mt-0.5">{error}</p>
            <p className="text-muted-foreground/70 mt-0.5">
              The summary cards above still reflect the last pushed telemetry.
            </p>
          </div>
        </div>
      )}

      {/* Diff error banner — inline, non-blocking (D-08 graceful-degrade) */}
      {diffError && temporalSubMode === "diff" && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          <div className="text-sm font-mono leading-relaxed">
            <p className="text-foreground">{diffError}</p>
            <p className="text-muted-foreground/70 mt-0.5">
              Check that Ástríðr is running and the date is within the stored snapshot range.
            </p>
          </div>
        </div>
      )}
      {truncated?.truncated && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm font-mono">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            Showing {graph.stats.nodeCount} of {truncated.total} entities
            (bounded). Narrow by type/agent or raise the limit to see more.
          </span>
        </div>
      )}

      {/* Graph + details panel — layout forks on the Search lens (KG-08) */}
      <SectionErrorBoundary name="KG Graph">
        {lens === "search" ? (
          /* Search lens: left pane = KGSearchResults, right pane = KGDetailsPanel */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <SectionErrorBoundary name="KG Search Results">
              <KGSearchResults
                results={searchResults}
                query={filters.searchQuery}
                loading={searchLoading}
                gateState={searchGateState}
                errorMessage={searchErrorMessage}
                onSelectResult={handleSearchResultClick}
              />
            </SectionErrorBoundary>

            {/* Details panel reused — shows selected entity after a result-click ego-load */}
            <KGDetailsPanel
              graph={graph}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onClose={() => {
                selectNode(null);
                selectEdge(null);
              }}
              onSelectNode={selectNode}
              returnTo={fromParam}
              returnLabel={returnLabel}
              onReturnNav={(url) => navigate(url)}
            />
          </div>
        ) : (
          /* All other lenses: existing graph + details layout unchanged */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div className="relative">
              {/* Legend */}
              <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-xs font-mono max-h-[60%] overflow-y-auto custom-scrollbar">
                {legendTypes.length > 0 ? (
                  legendTypes.map((t) => (
                    <span
                      key={t.type}
                      className="flex items-center gap-2 text-muted-foreground"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.type}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">no entities</span>
                )}
                <span className="mt-1 border-t border-border pt-1 flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block w-4 border-t-2 border-primary/60" />
                  current
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block w-4 border-t-2 border-dashed border-slate-400/50" />
                  superseded
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="inline-block w-4 border-t-2 border-red-500" />
                  contradiction
                </span>
                {presentCommunities.length > 0 && (
                  <>
                    <span className="mt-1 border-t border-border pt-1 text-muted-foreground uppercase tracking-wide">
                      Communities
                    </span>
                    {presentCommunities.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-2 text-muted-foreground"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: communityColor(c) ?? "transparent",
                          }}
                        />
                        Cluster {c}
                      </span>
                    ))}
                  </>
                )}

                {/* DIFF legend — appended below entity types when diff mode is active (UI-SPEC Layout Contract) */}
                {temporalSubMode === "diff" && diff && (
                  <>
                    <span className="mt-1 border-t border-border pt-1 text-muted-foreground uppercase tracking-wide text-[10px]">
                      DIFF
                    </span>
                    {[
                      { label: "added",     color: "#22c55e", alpha: 1 },
                      { label: "removed",   color: "#ef4444", alpha: 1 },
                      { label: "changed",   color: "#eab308", alpha: 1 },
                      { label: "unchanged", color: "#a1a1aa", alpha: 0.35 },
                    ].map(({ label, color, alpha }) => (
                      <span key={label} className="flex items-center gap-2 text-muted-foreground">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color, opacity: alpha }}
                        />
                        {label}
                      </span>
                    ))}
                  </>
                )}
              </div>

              {/* Diff loading overlay — "Diffing knowledge graph…" animate-pulse */}
              {diffLoading && temporalSubMode === "diff" && (
                <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
                  <p className="text-primary/70 font-mono text-base animate-pulse">
                    Diffing knowledge graph…
                  </p>
                </div>
              )}

              {/* Diff empty result — no changes between snapshots */}
              {!diffLoading &&
                isDiffActive &&
                diff.added.size === 0 &&
                diff.removed.size === 0 &&
                diff.changed.size === 0 && (
                  <div className="flex items-center gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm font-mono text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0 text-amber-500" />
                    No changes between these two snapshots.
                  </div>
                )}

              {!diffLoading && (
                loading ? (
                  <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
                    <p className="text-primary/70 font-mono text-base animate-pulse">
                      Querying knowledge graph…
                    </p>
                  </div>
                ) : activeGraph.nodes.length === 0 ? (
                  <div className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 rounded-[var(--radius)] border border-primary/20 bg-[#09090b]">
                    <AlertTriangle className="h-6 w-6 text-primary/50" />
                    <p className="text-base text-muted-foreground font-mono">
                      {needsEntityName
                        ? "Search for an entity to view its ego graph."
                        : lens === "contradiction"
                          ? "No flagged contradictions. 🎉"
                          : isDiffActive
                            ? "No entities in the selected snapshot."
                            : "No entities match the current lens/filters."}
                    </p>
                    <p className="text-sm text-muted-foreground/60 max-w-md">
                      {error
                        ? "The KG read API is unreachable — start Ástríðr or check VITE_ASTRIDR_API_URL/KEY."
                        : "Data appears once Ástríðr's KG is backfilled and the read API is reachable."}
                    </p>
                  </div>
                ) : isDiffActive ? (
                  /* Diff mode: render graphB with diff paint functions */
                  <ForceGraphCanvas
                    ref={fgRef}
                    data={activeGraph}
                    colorFn={(n: any) => (n as KgNode).color}
                    labelFn={labelFn}
                    paintNode={paintNodeDiff}
                    linkColorFn={linkColorDiffFn}
                    linkWidthFn={linkWidthFn}
                    linkLineDashFn={linkLineDashDiffFn}
                    linkDirectionalArrow
                    focusSet={focusSet}
                    clusterForce={true}
                    communityColorFn={(n: any) =>
                      communityColor((n as KgNode).community)
                    }
                    onNodeClick={(n: any) => selectNode(n.id)}
                    onBackgroundClick={() => {
                      selectNode(null);
                      selectEdge(null);
                    }}
                  />
                ) : (
                  /* Point mode (and other lenses): original paintNode/linkColorFn — NO REGRESSION */
                  <ForceGraphCanvas
                    ref={fgRef}
                    data={graph}
                    colorFn={(n: any) => (n as KgNode).color}
                    labelFn={labelFn}
                    paintNode={paintNode}
                    linkColorFn={linkColorFn}
                    linkWidthFn={linkWidthFn}
                    linkLineDashFn={linkLineDashFn}
                    linkDirectionalArrow
                    focusSet={focusSet}
                    clusterForce={true}
                    communityColorFn={(n: any) =>
                      communityColor((n as KgNode).community)
                    }
                    onNodeClick={(n: any) => selectNode(n.id)}
                    onBackgroundClick={() => {
                      selectNode(null);
                      selectEdge(null);
                    }}
                  />
                )
              )}
            </div>

            {/* Details panel (KG-06) — uses activeGraph so diff mode shows "To" snapshot facts */}
            <KGDetailsPanel
              graph={activeGraph}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onClose={() => {
                selectNode(null);
                selectEdge(null);
              }}
              onSelectNode={selectNode}
              returnTo={fromParam}
              returnLabel={returnLabel}
              onReturnNav={(url) => navigate(url)}
            />
          </div>
        )}
      </SectionErrorBoundary>
    </div>
  );
}
