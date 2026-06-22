import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { useKnowledgeGraph } from "../hooks/useKnowledgeGraph";
import { useFocusParam } from "../hooks/useFocusParam";
import {
  ENTITY_TYPE_COLORS,
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

  // ── Inbound entity-lens focus params ────────────────────────────────────────
  const [searchParams] = useSearchParams();
  const focusEntity = searchParams.get("focus");
  const lensParam = searchParams.get("lens");
  const hopsParam = searchParams.get("hops");

  // Track the first time loading becomes false (idb hydration complete).
  // The saved-state restore runs inside useKnowledgeGraph before the first
  // fetch; once loading transitions to false the first time, hydration is done.
  const hydratedRef = useRef(false);
  // One-shot guard: apply the inbound override exactly once.
  const appliedFocusRef = useRef(false);

  useEffect(() => {
    // Record when idb hydration has settled at least once.
    if (!loading && !hydratedRef.current) {
      hydratedRef.current = true;
    }
  }, [loading]);

  useEffect(() => {
    // No focus entity → nothing to override.
    if (!focusEntity) return;
    // Already applied → stay no-op.
    if (appliedFocusRef.current) return;
    // idb hydration not yet complete → wait.
    if (!hydratedRef.current) return;

    // Apply the entity-lens override AFTER hydration so saved-state restore
    // cannot clobber it.
    appliedFocusRef.current = true;
    if (lensParam === "entity") setLens("entity");
    setFilter("entityName", focusEntity);
    setFilter("hops", hopsParam ? (Number(hopsParam) || 1) : 1);
  }, [focusEntity, lensParam, hopsParam, loading, setLens, setFilter]);

  // ── Center the focused entity once it resolves ───────────────────────────────
  // useFocusParam matches on node.name (KG focus is name-based, D-02).
  // Silent no-op when the entity is not found (SC#3).
  const { fromParam } = useFocusParam({
    nodes: focusEntity ? kg.graph.nodes : undefined,
    getId: (n: KgNode) => n.name,
    onFocus: (node: KgNode) => {
      kg.selectNode(node.id);
      const n = node as KgNode & { x?: number; y?: number };
      if (n.x != null && n.y != null) {
        fgRef.current?.centerAt(n.x, n.y, 800);
        fgRef.current?.zoom(3, 800);
      }
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

  const labelFn = useCallback((n: any) => {
    const node = n as KgNode;
    return `${node.name} · ${node.entityType}${
      node.attributes.length ? ` · ${node.attributes.length} attrs` : ""
    }`;
  }, []);

  // Legend shows only the types present in the current graph.
  const legendTypes = useMemo(() => {
    const present = new Set(graph.nodes.map((n) => n.entityType));
    return ENTITY_TYPE_COLORS.filter((c) => present.has(c.type));
  }, [graph.nodes]);

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
          <p className="text-xs text-muted-foreground font-mono mt-1">
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
        />
      </SectionErrorBoundary>

      {/* Error / truncation banners */}
      {error && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          <div className="text-xs font-mono leading-relaxed">
            <p className="text-foreground">Could not reach the KG read API.</p>
            <p className="text-muted-foreground mt-0.5">{error}</p>
            <p className="text-muted-foreground/70 mt-0.5">
              The summary cards above still reflect the last pushed telemetry.
            </p>
          </div>
        </div>
      )}
      {truncated?.truncated && (
        <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs font-mono">
          <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
          <span className="text-muted-foreground">
            Showing {graph.stats.nodeCount} of {truncated.total} entities
            (bounded). Narrow by type/agent or raise the limit to see more.
          </span>
        </div>
      )}

      {/* Graph + details panel */}
      <SectionErrorBoundary name="KG Graph">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="relative">
            {/* Legend */}
            <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-[10px] font-mono max-h-[60%] overflow-y-auto custom-scrollbar">
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
            </div>

            {loading ? (
              <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
                <p className="text-primary/70 font-mono text-sm animate-pulse">
                  Querying knowledge graph…
                </p>
              </div>
            ) : isEmpty ? (
              <div className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 rounded-[var(--radius)] border border-primary/20 bg-[#09090b]">
                <AlertTriangle className="h-6 w-6 text-primary/50" />
                <p className="text-sm text-muted-foreground font-mono">
                  {needsEntityName
                    ? "Search for an entity to view its ego graph."
                    : lens === "contradiction"
                      ? "No flagged contradictions. 🎉"
                      : "No entities match the current lens/filters."}
                </p>
                <p className="text-xs text-muted-foreground/60 max-w-md">
                  {error
                    ? "The KG read API is unreachable — start Ástríðr or check VITE_ASTRIDR_API_URL/KEY."
                    : "Data appears once Ástríðr's KG is backfilled and the read API is reachable."}
                </p>
              </div>
            ) : (
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
                onNodeClick={(n: any) => selectNode(n.id)}
                onBackgroundClick={() => {
                  selectNode(null);
                  selectEdge(null);
                }}
              />
            )}
          </div>

          {/* Details panel (KG-06) */}
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
      </SectionErrorBoundary>
    </div>
  );
}
