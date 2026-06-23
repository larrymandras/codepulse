/**
 * CodeVaultGraph — dual-palette hero render for the /graphs hub (GH-02).
 *
 * Consumes useProjectGraph() and branches on three states:
 *   undefined → loading pulse
 *   null      → D-12 explainer (no snapshot ingested)
 *   object    → live force graph with filter/truncation/freshness/integrity/detail panel
 *
 * Owns:
 *   - colorFn / labelFn (code=emerald #10b981, vault=violet #8b5cf6)
 *   - source filter (Code | Vault | Both) — client-side, no reload
 *   - truncation header + per-source chips + freshness badge + integrity banner
 *   - node-click detail panel (id/label/type/source/community/neighbors)
 *   - fullscreen toggle (Maximize2/Minimize2 + ESC to exit)
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ExternalLink,
  Maximize2,
  Minimize2,
  Network,
  X,
} from "lucide-react";
import {
  ForceGraphCanvas,
  type ForceGraphHandle,
} from "./ForceGraphCanvas";
import { useProjectGraph, type ProjectGraphData } from "../../hooks/useProjectGraph";
import { useKnowledgeGraph } from "../../hooks/useKnowledgeGraph";
import { centerNodeWhenReady } from "../../lib/graph-center";
import { useFocusParam } from "../../hooks/useFocusParam";
import { buildFocusUrl, normalizeFocusKey } from "../../lib/focus-url";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { Skeleton } from "../ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { ScrollArea } from "../ui/scroll-area";
import SectionErrorBoundary from "../SectionErrorBoundary";

// ── Palette constants (D-04 / D-05) ─────────────────────────────────────────

const CODE_COLOR = "#10b981";  // Matrix Emerald — graphify:* nodes
const VAULT_COLOR = "#8b5cf6"; // Violet-500 — vault:* nodes

// ── Freshness threshold (D-09) ───────────────────────────────────────────────

const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // 36 hours

// ── Source filter type ────────────────────────────────────────────────────────

type SourceFilter = "code" | "vault" | "both";

// ── Helper: strip prefix for display label (Pitfall 3) ───────────────────────

function sourceLabel(source: string): string {
  if (source.startsWith("graphify:")) {
    // "graphify:codepulse:" → "codepulse"
    return source.split(":")[1] ?? source;
  }
  if (source.startsWith("vault:")) return "vault";
  return source;
}

// ── Helper: relative time string ──────────────────────────────────────────────

function relativeTime(ageMs: number): string {
  const hours = Math.floor(ageMs / (1000 * 60 * 60));
  if (hours < 1) {
    const minutes = Math.floor(ageMs / (1000 * 60));
    return `${minutes}m ago`;
  }
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Vault-origin discriminator ───────────────────────────────────────────────
// A node is vault-origin iff its id carries the `vault:` prefix — the SAME
// discriminator linkColorFn uses on link endpoints. getProjectGraph returns the
// node `source` field as a BARE source NAME ("vault" | "codepulse" |
// "astridr-repo"), NOT a prefixed string, so `source.startsWith("vault:")` never
// matches real data — it mis-colored the vault node green and made the Vault
// filter show 0 nodes (UAT-84). Node ids are reliably prefixed; use them.
function isVaultNode(node: { id?: string }): boolean {
  return node.id?.startsWith("vault:") ?? false;
}

// ── colorFn (D-04 / D-05) ────────────────────────────────────────────────────

function colorFn(node: any): string {
  return isVaultNode(node) ? VAULT_COLOR : CODE_COLOR;
}

// ── labelFn (D-11) ───────────────────────────────────────────────────────────

function labelFn(node: any): string {
  return `${node.label} · ${node.type} · ${node.source}`;
}

// ── linkColorFn (UI-SPEC Edge colors) ────────────────────────────────────────

function linkColorFn(link: any): string {
  const srcIsVault = typeof link.source === "string"
    ? link.source.startsWith("vault:")
    : link.source?.source?.startsWith("vault:") ?? false;
  const tgtIsVault = typeof link.target === "string"
    ? link.target.startsWith("vault:")
    : link.target?.source?.startsWith("vault:") ?? false;

  if (srcIsVault && tgtIsVault) return "rgba(139, 92, 246, 0.18)";
  if (!srcIsVault && !tgtIsVault) return "rgba(16, 185, 129, 0.18)";
  return "rgba(255, 255, 255, 0.08)";
}

// ── GraphContent — rendered when snapshot is available ───────────────────────

function GraphContent({ snapshot }: { snapshot: ProjectGraphData }) {
  const fgRef = useRef<ForceGraphHandle>(null);
  const navigate = useNavigate();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("both");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // ── Inbound focus param (Plan 01 hook — one-shot, SC#3-safe) ─────────────
  // snapshotNodes is already the full node list; pass as-is so the hook can
  // wait for data (snapshot is non-null here, so nodes are already resolved).
  const { fromParam } = useFocusParam({
    nodes: snapshot.nodes,
    getId: (n) => n.id,
    onFocus: (node) => {
      setSelectedNodeId(node.id);
      // Center once the force layout assigns x/y (WR-02 — retry, don't skip).
      centerNodeWhenReady(fgRef, node as { x?: number; y?: number });
    },
  });

  // ── Eager agent→KG resolution (existing hook — no new Convex query) ──────
  // useKnowledgeGraph already exists; we scope it to the selected node name.
  const kg = useKnowledgeGraph();

  // When a node is selected, scope the KG overview to that node's bare name
  // (agentId join). When deselected, clear the filter so we don't hold stale state.
  useEffect(() => {
    if (selectedNodeId) {
      const node = snapshot.nodes.find((n) => n.id === selectedNodeId);
      if (node) {
        kg.setLens("overview");
        kg.setFilter("agentId", normalizeFocusKey(node.label));
      }
    } else {
      // Clear agentId scope when nothing is selected
      kg.setFilter("agentId", null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  // Derive related KG entities: nodes returned by the agentId-scoped overview.
  // Only trust the result when not loading and not errored (SC#3 degrade).
  const kgEntities = useMemo(
    () => (kg.loading || kg.error ? [] : kg.graph.nodes),
    [kg.loading, kg.error, kg.graph.nodes]
  );

  // Sort by normalized name and pick the first as the jump target (UI-SPEC).
  const sortedKgEntities = useMemo(
    () =>
      [...kgEntities].sort((a, b) =>
        normalizeFocusKey(a.name).localeCompare(normalizeFocusKey(b.name))
      ),
    [kgEntities]
  );
  const kgCount = sortedKgEntities.length;
  const firstKgEntity = kgCount > 0 ? sortedKgEntities[0] : null;

  // ── Derive friendly origin label from fromParam ───────────────────────────
  const returnLabel = useMemo(() => {
    if (!fromParam) return null;
    const path = fromParam.split("?")[0];
    if (path.startsWith("/tool-galaxy")) return "Tool Galaxy";
    if (path.startsWith("/knowledge-graph")) return "KG Explorer";
    if (path.startsWith("/graphs")) return "Code/Vault Graph";
    return "previous graph";
  }, [fromParam]);

  // ── ESC to exit fullscreen (Pitfall 5 — let both handlers fire; no stopPropagation)
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen]);

  // ── Client-side source filter (Pattern 4 — no dangling links) ────────────
  const filteredData = useMemo(() => {
    if (sourceFilter === "both") {
      return { nodes: snapshot.nodes, links: snapshot.links };
    }
    const keptNodes = snapshot.nodes.filter((n) =>
      sourceFilter === "code" ? !isVaultNode(n) : isVaultNode(n)
    );
    const keptIds = new Set(keptNodes.map((n) => n.id));
    const keptLinks = snapshot.links.filter(
      (l) => keptIds.has(l.source) && keptIds.has(l.target)
    );
    return { nodes: keptNodes, links: keptLinks };
  }, [snapshot, sourceFilter]);

  // ── Freshness (D-09 / Pitfall 4 — generatedAt is SECONDS) ───────────────
  const ageMs = Date.now() - snapshot.generatedAt * 1000;
  const isStale = ageMs > STALE_THRESHOLD_MS;
  const ageStr = relativeTime(ageMs);

  // ── Integrity (D-08) ─────────────────────────────────────────────────────
  const droppedNodeCount = snapshot.nodeCount - snapshot.storedNodeCount;
  const droppedLinkCount = snapshot.linkCount - snapshot.storedLinkCount;
  const hasIntegrityWarning = droppedNodeCount > 0 || droppedLinkCount > 0;
  // Report only the dimension(s) that actually triggered — a nodes-only
  // discrepancy must not render a "0 links dropped" message (WR-01).
  const integrityParts: string[] = [];
  if (droppedNodeCount > 0)
    integrityParts.push(`${droppedNodeCount} node${droppedNodeCount === 1 ? "" : "s"}`);
  if (droppedLinkCount > 0)
    integrityParts.push(`${droppedLinkCount} link${droppedLinkCount === 1 ? "" : "s"}`);

  // ── Detail panel data ────────────────────────────────────────────────────
  // Derive from filteredData so the panel never crosses the active source
  // filter boundary (WR-02) — a hidden node must not appear as a neighbor.
  const selectedNode = useMemo(
    () => filteredData.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [filteredData.nodes, selectedNodeId]
  );

  const neighborNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    const neighborIds = new Set<string>();
    filteredData.links.forEach((l) => {
      const srcId = typeof l.source === "string" ? l.source : (l.source as any)?.id;
      const tgtId = typeof l.target === "string" ? l.target : (l.target as any)?.id;
      if (srcId === selectedNodeId && tgtId) neighborIds.add(tgtId);
      if (tgtId === selectedNodeId && srcId) neighborIds.add(srcId);
    });
    return filteredData.nodes.filter((n) => neighborIds.has(n.id));
  }, [filteredData, selectedNodeId]);

  // ── paintNode — selection ring (KnowledgeGraph L59-103 pattern) ──────────
  const paintNode = useCallback(
    (
      node: any,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
      opts: { hovered: boolean; dimmed: boolean }
    ) => {
      const isSelected = node.id === selectedNodeId;
      const size = Math.max(node.val ?? 3, 2);
      const c = colorFn(node);
      ctx.globalAlpha = opts.dimmed ? 0.2 : 1;

      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
      ctx.shadowColor = c;
      ctx.shadowBlur = opts.hovered || isSelected ? 24 : 10;
      ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : c;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI, false);
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (globalScale > 1.3 || opts.hovered || isSelected) {
        const fontSize = (opts.hovered ? 13 : 11) / globalScale;
        ctx.font = `${opts.hovered ? "bold " : ""}${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = node.label ?? node.id;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(9, 9, 11, 0.7)";
        ctx.fillRect(node.x - tw / 2 - 4, node.y + size + 2, tw + 8, fontSize + 4);
        ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : c;
        ctx.fillText(label, node.x, node.y + size + 2 + (fontSize + 4) / 2);
      }
      ctx.globalAlpha = 1;
    },
    [selectedNodeId]
  );

  // ── Canvas className (Pitfall 6 — always explicit, fullscreen switch) ─────
  const canvasClass = fullscreen
    ? "relative w-full h-[calc(100vh-48px)] overflow-hidden bg-[#09090b]"
    : "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]";

  // ── Container wrapper (fixed overlay when fullscreen) ─────────────────────
  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-[#09090b] flex flex-col transition-all duration-300"
    : "flex flex-col";

  // ── Filter chip helper ────────────────────────────────────────────────────
  const chipClass = (filter: SourceFilter) =>
    sourceFilter === filter
      ? "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-primary/10 text-primary border border-primary/40"
      : "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-transparent text-muted-foreground border border-border";

  return (
    <div className={containerClass}>
      {/* ── Hero header row ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2 px-4 pt-4 pb-2">
        {/* Left: truncation summary + per-source chips + freshness */}
        <div className="flex items-center gap-2 flex-wrap text-sm font-mono text-muted-foreground">
          <span>
            Showing {filteredData.nodes.length} of {snapshot.nodeCount} nodes
          </span>
          {snapshot.sources.map((src) => (
            <span key={src.source} className="flex items-center gap-1">
              <span className="border border-border rounded-sm px-1.5 py-0.5">
                {sourceLabel(src.source)}: {src.emittedNodeCount} / {src.nodeCount}
              </span>
              {src.truncated && (
                <Badge
                  variant="outline"
                  className="text-amber-400 border-amber-400/30 text-xs"
                >
                  truncated
                </Badge>
              )}
            </span>
          ))}
          {/* Freshness badge (D-09) */}
          {isStale ? (
            <>
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-400 border-amber-400/30"
                aria-label={`Graph snapshot is stale — last updated ${ageStr}`}
              >
                stale
              </Badge>
              <span className="text-muted-foreground font-mono text-sm">
                Updated {ageStr}
              </span>
            </>
          ) : (
            <span className="text-sm font-mono text-muted-foreground">
              Updated {ageStr}
            </span>
          )}
        </div>

        {/* Right: filter chips + fullscreen button */}
        <div className="flex items-center gap-2">
          {/* Source filter chips (D-06) */}
          <div role="group" aria-label="Source filter" className="flex items-center gap-1">
            <button
              className={chipClass("code")}
              aria-pressed={sourceFilter === "code"}
              onClick={() => setSourceFilter("code")}
            >
              Code
            </button>
            <button
              className={chipClass("vault")}
              aria-pressed={sourceFilter === "vault"}
              onClick={() => setSourceFilter("vault")}
            >
              Vault
            </button>
            <button
              className={chipClass("both")}
              aria-pressed={sourceFilter === "both"}
              onClick={() => setSourceFilter("both")}
            >
              Both
            </button>
          </div>

          {/* Fullscreen toggle (D-03) — local TooltipProvider: routed pages
              render outside DashboardLayout's provider (its Outlet is outside
              the provider subtree), matching AnomalyBadge/AlertRulesEngine. */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={fullscreen ? "Exit fullscreen" : "Expand graph"}
                  onClick={() => setFullscreen((f) => !f)}
                >
                  {fullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {fullscreen ? "Exit fullscreen" : "Expand graph"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Integrity warning (D-08) — gated, never unconditional ───────────
          Amber, not red: D-08 is a "subtle data-quality signal, not normal-
          state info" — matches the sibling `stale`/`truncated` amber badges.
          Dropped dangling links are an expected condition, not an error. */}
      {hasIntegrityWarning && (
        <div className="flex items-start gap-3 mx-4 mb-2 rounded-[var(--radius)] border border-amber-400/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
          <p className="text-sm font-mono text-muted-foreground">
            {integrityParts.join(" and ")} dropped during ingest (stored{" "}
            {snapshot.storedNodeCount}/{snapshot.nodeCount} nodes,{" "}
            {snapshot.storedLinkCount}/{snapshot.linkCount} links)
          </p>
        </div>
      )}

      {/* ── Graph + detail panel grid ─────────────────────────────────────── */}
      <div
        className={`grid gap-4 px-4 pb-4 ${
          selectedNodeId || fromParam ? "grid-cols-1 lg:grid-cols-[1fr_320px]" : "grid-cols-1"
        }`}
      >
        {/* Graph region */}
        <div className="relative">
          {/* Legend (absolute overlay — UI-SPEC Legend Spec) */}
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-xs font-mono">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CODE_COLOR }}
              />
              Code (graphify)
            </span>
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: VAULT_COLOR }}
              />
              Vault (Obsidian)
            </span>
          </div>

          {/* ForceGraphCanvas — explicit className prop (Pitfall 6).
              ref + onEngineStop frame the graph to the viewport once the
              simulation settles (and after filter/fullscreen reheats) so a
              small node set never strands in a corner (IN-01). */}
          <ForceGraphCanvas
            ref={fgRef}
            data={filteredData}
            colorFn={colorFn}
            labelFn={labelFn}
            paintNode={paintNode}
            linkColorFn={linkColorFn}
            onNodeClick={(node: any) => setSelectedNodeId(node.id)}
            onBackgroundClick={() => setSelectedNodeId(null)}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
            className={canvasClass}
          />
        </div>

        {/* Detail panel (D-10) — also renders with just the return chip when
            ?from is present but no node is focused (e.g. focus target absent) */}
        {(selectedNodeId || fromParam) && (
          <div
            aria-label="Node details"
            className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 h-full overflow-y-auto"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                {/* Return chip — only when ?from is present (D-06 / SC#4) */}
                {fromParam && returnLabel && (
                  <SectionErrorBoundary name="Return navigation">
                    <button
                      aria-label={`Return to ${returnLabel}`}
                      onClick={() => navigate(fromParam)}
                      className="inline-flex items-center gap-1 text-sm font-mono text-muted-foreground hover:text-foreground border-l-2 border-primary/40 pl-2 py-1.5 hover:border-primary/70 transition-colors duration-200 shrink-0"
                    >
                      <ChevronLeft className="h-3 w-3" />
                      {`Back to ${returnLabel}`}
                    </button>
                  </SectionErrorBoundary>
                )}
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Node Details
                </span>
              </div>
              <button
                aria-label="Close node details"
                onClick={() => setSelectedNodeId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedNode ? (
              <div className="space-y-3">
                {/* 1. id — mono truncate + full id in title */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">id</p>
                  <p
                    className="font-mono text-sm text-muted-foreground truncate"
                    title={selectedNode.id}
                  >
                    {selectedNode.id}
                  </p>
                </div>

                {/* 2. label */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">label</p>
                  <p className="font-bold text-base text-foreground">{selectedNode.label}</p>
                </div>

                {/* 3. type */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">type</p>
                  <Badge variant="outline" className="text-sm">{selectedNode.type}</Badge>
                </div>

                {/* 4. source — color pill matching node color */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">source</p>
                  <span
                    className="inline-block text-sm font-mono px-2 py-0.5 rounded-full"
                    style={{
                      color: isVaultNode(selectedNode) ? VAULT_COLOR : CODE_COLOR,
                      border: `1px solid ${isVaultNode(selectedNode) ? VAULT_COLOR : CODE_COLOR}`,
                      backgroundColor: isVaultNode(selectedNode)
                        ? "rgba(139, 92, 246, 0.1)"
                        : "rgba(16, 185, 129, 0.1)",
                    }}
                  >
                    {sourceLabel(selectedNode.source ?? "")}
                  </span>
                </div>

                {/* 5. community */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">community</p>
                  <p className="text-sm text-muted-foreground">
                    community: {selectedNode.community ?? "—"}
                  </p>
                </div>

                {/* 6. neighbors */}
                <div>
                  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-1">
                    Neighbors ({neighborNodes.length})
                  </p>
                  {neighborNodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60">No direct neighbors</p>
                  ) : neighborNodes.length > 8 ? (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-1">
                        {neighborNodes.map((n) => (
                          <button
                            key={n.id}
                            className="w-full text-left text-sm font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-primary/5 truncate block"
                            onClick={() => setSelectedNodeId(n.id)}
                            title={n.label}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="space-y-1">
                      {neighborNodes.map((n) => (
                        <button
                          key={n.id}
                          className="w-full text-left text-sm font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-primary/5 truncate block"
                          onClick={() => setSelectedNodeId(n.id)}
                          title={n.label}
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 7. Related across graphs — agent→KG link (SC#2 / D-04 / D-05) */}
                {/* Renders ONLY when ≥1 KG entity is eagerly confirmed. SC#3: silently
                    absent when zero entities or KG unavailable/loading/errored. */}
                {firstKgEntity && kgCount > 0 && (
                  <>
                    <Separator className="mt-6 mb-4" />
                    <div aria-label="Related across graphs navigation links">
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                        RELATED ACROSS GRAPHS
                      </p>
                      <SectionErrorBoundary name="Cross-graph links">
                        <button
                          className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded hover:bg-primary/5 cursor-pointer transition-colors duration-200"
                          onClick={() =>
                            navigate(
                              buildFocusUrl(
                                {
                                  surface: "knowledge-graph",
                                  entityName: firstKgEntity.name,
                                  hops: 1,
                                },
                                `/graphs?focus=${encodeURIComponent(selectedNodeId ?? "")}`
                              )
                            )
                          }
                        >
                          <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                          <span className="text-sm text-muted-foreground">
                            {kgCount === 1 ? "1 KG entity" : `${kgCount} KG entities`}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground/50 ml-auto shrink-0" />
                        </button>
                      </SectionErrorBoundary>
                    </div>
                  </>
                )}
              </div>
            ) : fromParam ? (
              // Panel open due to ?from but no node resolved — show skeleton
              // (loading arrival state; also shown when focus target is absent)
              <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
            ) : (
              <p className="text-sm font-mono text-muted-foreground text-center mt-8">
                Select a node to inspect
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── CodeVaultGraph — public export ──────────────────────────────────────────

export function CodeVaultGraph() {
  const snapshot = useProjectGraph();

  // ── Loading state (undefined — Convex subscription resolving) ────────────
  if (snapshot === undefined) {
    return (
      <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
        <p className="text-primary/70 font-mono text-base animate-pulse">
          Loading graph snapshot…
        </p>
      </div>
    );
  }

  // ── Empty state (null — no snapshot ingested yet, D-12) ──────────────────
  if (snapshot === null) {
    return (
      <div className="h-[600px] flex flex-col items-center justify-center gap-3 border border-primary/20 rounded-[var(--radius)] bg-[#09090b]">
        <Network className="h-8 w-8 text-primary/40" />
        <p className="text-base font-mono text-muted-foreground">
          No graph snapshot received yet
        </p>
        <p className="text-sm text-muted-foreground/70 max-w-md text-center">
          Ástríðr's nightly graph_snapshot cron (graphify + Obsidian vault) has not
          pushed a snapshot to this deployment yet. Summary tiles above are
          independent and update on their own.
        </p>
      </div>
    );
  }

  // ── Live graph state ──────────────────────────────────────────────────────
  return <GraphContent snapshot={snapshot} />;
}

export default CodeVaultGraph;
