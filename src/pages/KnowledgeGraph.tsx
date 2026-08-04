import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { Share2, AlertTriangle, Info, ChevronLeft } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import { PageHeader } from "../components/PageHeader";
import {
  ForceGraphCanvas,
  type ForceGraphHandle,
} from "../components/graph/ForceGraphCanvas";
import { type ForceGraph3DHandle } from "../components/graph/ForceGraph3D";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { api } from "../../convex/_generated/api";
import KGSummaryCards from "../components/kg/KGSummaryCards";
import KGControls from "../components/kg/KGControls";
import KGDetailsPanel from "../components/kg/KGDetailsPanel";
import KGSearchResults from "../components/kg/KGSearchResults";
import { useKnowledgeGraph } from "../hooks/useKnowledgeGraph";
import { useThemeColors } from "../hooks/useThemeColors";
import { useSavedViews } from "../hooks/useSavedViews";
import { useKgDiff } from "../hooks/useKgDiff";
import { useKgAnimation } from "../hooks/useKgAnimation";
import { useFocusParam } from "../hooks/useFocusParam";
import { centerNodeWhenReady } from "../lib/graph-center";
import { buildFocusUrl } from "../lib/focus-url";
import { fetchSearch, type KgSearchHit } from "../lib/kgApi";
import { AstridrApiError } from "../lib/astridrApi";
import type { KgLens, KgFilters } from "../hooks/useKnowledgeGraph";
import type { TemporalSubMode } from "../components/kg/KGControls";
import type { SavedKgView } from "../hooks/useSavedViews";
import { toast } from "sonner";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ENTITY_TYPE_COLORS,
  communityColor,
  neighborsOfIds,
  type KgNode,
  type KgLink,
} from "../lib/kg-graph";

// ── 3D color/size ladder — pure, exported for unit testing (Phase 187 Plan 04,
// GLXY-01; extraction precedent: Plan 03's kg.ts handler extraction). The
// component wraps these in useCallback below, closing over live state; Task 3's
// tests call them directly with synthetic inputs so litNodeIds/focusSet
// permutations don't require mounting the whole page.
//
// Priority order (UI-SPEC Node State Encoding): selected(1) > hovered(2) >
// lit(3) > dimmed(4) > normal(5). A lit node NEVER falls into the dimmed
// branch — priority 3 is checked before priority 4 — so a grounded source
// node always renders at full opacity even under an active ego-lens filter
// (D-08 dim-exemption, protects SC#1's "always rendered" guarantee).
export function computeColorFn3D(params: {
  node: { id: string; color: string };
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  litNodeIds: Set<string>;
  focusSet: Set<string> | null;
}): string {
  const { node, selectedNodeId, hoveredNodeId, litNodeIds, focusSet } = params;
  if (node.id === selectedNodeId) return "#ffffff"; // priority 1: selected
  if (node.id === hoveredNodeId) return "#ffffff"; // priority 2: hovered
  // priority 3: lit (dim-exempt) — Plan 05 populates litNodeIds from the
  // kg_answer_sync subscription; empty here (dormant).
  if (litNodeIds.has(node.id)) return "#10b981";
  // priority 4: dimmed — non-focus-set node while an ego-lens filter/selection
  // is active (#27272a zinc-800 hex, NOT rgba — Three.js Color drops alpha).
  if (focusSet && !focusSet.has(node.id)) return "#27272a";
  return node.color; // priority 5: normal — the node's precomputed entity color
}

export function computeNodeValFn3D(params: {
  node: { id: string; val?: number };
  selectedNodeId: string | null;
  litNodeIds: Set<string>;
  litSizeMultiplier: number;
}): number {
  const { node, selectedNodeId, litNodeIds, litSizeMultiplier } = params;
  if (node.id === selectedNodeId) return (node.val ?? 1) * 3; // priority 1 wins outright
  // Lit nodes render at the steady resting size (UI-SPEC D-08); Plan 05 drives
  // litSizeMultiplier through the 1→2.4→1.8 arrival-bloom animation on arrival.
  if (litNodeIds.has(node.id)) return (node.val ?? 1) * litSizeMultiplier;
  return node.val ?? 1;
}

// ── Answer-sync reaction — pure helpers, exported for unit testing (Phase 187
// Plan 05, GLXY-01). These are deliberately framework-free (no refs/state) so
// Task 1/2's tests can drive them with synthetic timers/inputs without
// mounting the page. The in-component effect below composes them.

// V5/T-187-13: sourceNodeIds must be UUID-shaped before driving
// nodeFilterFn/setFilter — a forged/garbage id degrades to a no-op rather
// than reaching the camera or the ego-lens fetch.
const SOURCE_NODE_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidSourceNodeId(id: unknown): id is string {
  return typeof id === "string" && SOURCE_NODE_ID_RE.test(id);
}
export function filterValidSourceNodeIds(ids: unknown[]): string[] {
  return (ids ?? []).filter(isValidSourceNodeId);
}

// D-08 bloom/clear timing constants (UI-SPEC Camera & Lighting Contract).
// Reused as named constants (not magic numbers) so a future spec tweak is a
// one-line change.
export const LIT_RESTING_MULTIPLIER = 1.8;
const BLOOM_PEAK_MULTIPLIER = 2.4;
const BLOOM_GROW_MS = 400;
const BLOOM_SETTLE_MS = 400;
const CLEAR_MS = 200;
const CLEAR_TO_BLOOM_STAGGER_MS = 100;
// D-07 layout-readiness poll budget — same maxFrames as centerNode3DWhenReady
// (graph-center.ts), reused rather than invented (RESEARCH "Don't Hand-Roll").
// Scope: D-07's in-memory-only wait (nodes already loaded, only force-layout
// needs to settle) — a ~1.5s frame budget is appropriate there. Do NOT reuse
// this for D-09's fetch-dependent wait (see D09_FETCH_POLL_MAX_MS below);
// 187-05 live-checkpoint fix #1 found the D-09 fly never completing because
// it shared this same tight budget despite also waiting on a network fetch
// (setFilter("entityName", ...) triggers /api/kg/entity via the astridr API)
// that routinely outlasts 90 frames.
const D09_POLL_MAX_FRAMES = 90;
// D-09 fetch-dependent poll budget — a WALL-CLOCK deadline (ms), not a frame
// count. A frame count is a poor proxy for network+render latency: rAF frame
// delivery itself throttles in backgrounded tabs (making a frame-based budget
// take far longer in wall time than a foregrounded tab), and the fetch time
// is independent of frame rate anyway. 8s comfortably covers a local astridr
// API round-trip + the neighborhood's subsequent force-layout settle while
// staying clearly bounded (T-187-14: no unbounded fetch/poll loop) — on
// expiry flyToLitSources still degrades to "fly to whatever resolved,
// silently skip the rest", exactly like the frame-bounded path.
export const D09_FETCH_POLL_MAX_MS = 8000;
// Camera-park distance for a lit source with no loaded 1-hop neighbors (187-05
// live-checkpoint fix #2). zoomToFit has nothing to widen the frame to for a
// truly isolated node, so it zooms in until the single sphere fills the
// viewport (Larry: "3D does not focus very well in the window"). Matches the
// existing `centerNode3DWhenReady` (graph-center.ts) z-offset convention for
// parking the camera a fixed distance back from a single node instead of
// hand-rolling new distance math.
export const ISOLATED_NODE_CAMERA_DISTANCE = 150;

// 187 post-verify fix (GLXY-01, Verification "The camera and lighting code is
// also real" gap #3): react-force-graph-3d's onEngineStop fires on EVERY
// settle, including one triggered later by the D-09 ego-lens fetch streaming
// in new neighbor nodes — well after the D-07/D-09 fly's 800ms tween has
// already completed. All three 3D mount sites previously wired
// onEngineStop={() => fgRef3d.current?.zoomToFit(400, 60)} unconditionally,
// so that LATER settle silently re-framed the WHOLE graph, undoing the fly.
// SYNC_CAMERA_GRACE_MS bounds how long a settle-driven refit must instead
// re-frame onto the lit sources (+ neighbors) rather than the whole graph —
// covers the D09_FETCH_POLL_MAX_MS fetch window plus settle margin. Ordinary
// initial-load / lens-switch refits (no active sync) are untouched.
export const SYNC_CAMERA_GRACE_MS = D09_FETCH_POLL_MAX_MS + 3000;

/**
 * Resolves what a react-force-graph-3d `onEngineStop` settle should do: while
 * a sync-driven camera framing is still authoritative (within its grace
 * window) AND a lit set exists, re-frame onto the lit sources (+ neighbors)
 * instead of performing an unfiltered whole-graph refit. Returns `null` for
 * the ordinary case (ordinary initial load / lens switch / no active sync),
 * preserving the original unconditional `zoomToFit(400, 60)` behavior.
 * Pure + exported so this can be unit-tested without mounting the page.
 */
export function resolveEngineStopFilter(params: {
  now: number;
  syncFramingExpiresAt: number;
  litNodeIds: Set<string>;
  framingIds: Set<string>;
}): ((node: { id: string }) => boolean) | null {
  const { now, syncFramingExpiresAt, litNodeIds, framingIds } = params;
  if (now < syncFramingExpiresAt && litNodeIds.size > 0) {
    return (node) => framingIds.has(node.id);
  }
  return null;
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function scheduleFrame(cb: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => cb());
  } else {
    setTimeout(cb, 16);
  }
}

/**
 * D-08 arrival bloom — one grow-then-settle size pulse, timestamp-driven (not
 * frame-counted) so total duration is independent of frame rate: ×1 -> ×2.4
 * over 400ms (ease-out), then ×2.4 -> ×1.8 (resting) over 400ms. A single
 * bloom, never a multi-pulse loop. Returns a cancel fn.
 */
export function runArrivalBloom(setMultiplier: (v: number) => void): () => void {
  let cancelled = false;
  const start = nowMs();

  const tick = () => {
    if (cancelled) return;
    const elapsed = nowMs() - start;
    if (elapsed < BLOOM_GROW_MS) {
      const t = elapsed / BLOOM_GROW_MS;
      const eased = 1 - Math.pow(1 - t, 2); // ease-out
      setMultiplier(1 + eased * (BLOOM_PEAK_MULTIPLIER - 1));
      scheduleFrame(tick);
    } else if (elapsed < BLOOM_GROW_MS + BLOOM_SETTLE_MS) {
      const t = (elapsed - BLOOM_GROW_MS) / BLOOM_SETTLE_MS;
      setMultiplier(
        BLOOM_PEAK_MULTIPLIER - t * (BLOOM_PEAK_MULTIPLIER - LIT_RESTING_MULTIPLIER),
      );
      scheduleFrame(tick);
    } else {
      setMultiplier(LIT_RESTING_MULTIPLIER);
    }
  };
  scheduleFrame(tick);
  return () => {
    cancelled = true;
  };
}

/**
 * D-08 "a superseded set clears" — a single continuous timeline (no two
 * concurrently-scheduled tickers fighting over the same state): the OLD set
 * fades ×1.8 -> ×1 over 200ms; the new set swaps in ~100ms after clearing
 * starts (slight stagger, avoids an instant "pop"); once the clear window
 * ends the SAME loop continues straight into the arrival bloom on the new
 * set. Returns a cancel fn.
 */
export function runClearThenBloom(params: {
  setLitNodeIds: (ids: Set<string>) => void;
  setLitSizeMultiplier: (v: number) => void;
  newLitIds: Set<string>;
}): () => void {
  const { setLitNodeIds, setLitSizeMultiplier, newLitIds } = params;
  let cancelled = false;
  let swapped = false;
  const start = nowMs();

  const tick = () => {
    if (cancelled) return;
    const elapsed = nowMs() - start;

    if (!swapped && elapsed >= CLEAR_TO_BLOOM_STAGGER_MS) {
      setLitNodeIds(newLitIds);
      swapped = true;
    }

    if (elapsed < CLEAR_MS) {
      const t = elapsed / CLEAR_MS;
      setLitSizeMultiplier(LIT_RESTING_MULTIPLIER - t * (LIT_RESTING_MULTIPLIER - 1));
      scheduleFrame(tick);
    } else if (elapsed < CLEAR_MS + BLOOM_GROW_MS) {
      const t = (elapsed - CLEAR_MS) / BLOOM_GROW_MS;
      const eased = 1 - Math.pow(1 - t, 2);
      setLitSizeMultiplier(1 + eased * (BLOOM_PEAK_MULTIPLIER - 1));
      scheduleFrame(tick);
    } else if (elapsed < CLEAR_MS + BLOOM_GROW_MS + BLOOM_SETTLE_MS) {
      const t = (elapsed - CLEAR_MS - BLOOM_GROW_MS) / BLOOM_SETTLE_MS;
      setLitSizeMultiplier(
        BLOOM_PEAK_MULTIPLIER - t * (BLOOM_PEAK_MULTIPLIER - LIT_RESTING_MULTIPLIER),
      );
      scheduleFrame(tick);
    } else {
      setLitSizeMultiplier(LIT_RESTING_MULTIPLIER);
    }
  };

  if (!swapped && CLEAR_TO_BLOOM_STAGGER_MS <= 0) {
    setLitNodeIds(newLitIds);
    swapped = true;
  }
  scheduleFrame(tick);
  return () => {
    cancelled = true;
  };
}

/**
 * D-07/D-09 fly-to poll — adapted from graph-center.ts's centerNode3DWhenReady
 * rAF-bounded-poll SHAPE to a Set of ids (RESEARCH "Don't Hand-Roll": reuse
 * the idiom, don't invent a new one). Polls `getNodes()` fresh every frame
 * (not a captured array) so it sees nodes that stream in asynchronously via
 * the ego-lens fetch.
 *
 * Also waits for `getHandle()` to be non-null — immediately after toggling
 * into 3D mode, `fgRef3d.current` can still be null for one or more frames
 * (the lazy-loaded ForceGraph3D sits behind its own Suspense boundary, which
 * resolves asynchronously; a sync `fgRef3d.current?.zoomToFit(...)` call
 * right when the effect fires would silently no-op and — since the turnId is
 * already marked applied — never retry, permanently dropping that turn's
 * fly-to).
 *
 * Bounded by EITHER `maxFrames` (default, frame-count budget — appropriate
 * for D-07's in-memory-only wait) OR `maxWaitMs` (wall-clock budget —
 * appropriate for D-09's fetch-dependent wait, see D09_FETCH_POLL_MAX_MS;
 * 187-05 live-checkpoint fix #1). When `maxWaitMs` is supplied it takes over
 * expiry entirely (frames are not counted against `maxFrames` in that mode).
 * On expiry, flies to whatever DID resolve (skipping unresolved ids and/or a
 * still-null handle) — never throws, never retries beyond the budget.
 *
 * 187-05 live-checkpoint fix #2: a lone lit source with no other nodes in
 * frame fills zoomToFit's viewport with a single giant sphere and no context
 * (Larry: "3D does not focus very well in the window"). `getFramingIds`, when
 * supplied, widens the zoomToFit filterFn to the resolved sources PLUS their
 * 1-hop neighbors — CAMERA FRAMING ONLY. `onFlown`'s resolvedIds (which drives
 * `litNodeIds`/coloring upstream) is untouched — only the real sources are
 * "lit"; neighbors never light up. Defaults to identity (no widening) so
 * callers that don't pass it keep the original single-set framing. When the
 * (possibly-widened) framing set still resolves to exactly one node — no
 * neighbors were loaded to widen to — `zoomToFit` is skipped in favor of
 * `cameraPosition` parked `ISOLATED_NODE_CAMERA_DISTANCE` back from that node
 * (the same "look at one node" primitive `centerNode3DWhenReady` uses for the
 * `?focus=` deep link), so an isolated source sits in context instead of
 * filling the screen. Falls back to `zoomToFit` if that node's coordinates are
 * unexpectedly missing.
 */
export function flyToLitSources(params: {
  litIds: Set<string>;
  getNodes: () => Array<{ id: string; x?: number; y?: number; z?: number }>;
  getHandle: () => {
    zoomToFit: (ms: number, px: number, filterFn: (n: any) => boolean) => void;
    cameraPosition: (
      position: { x: number; y: number; z: number },
      lookAt?: { x: number; y: number; z: number } | null,
      ms?: number,
    ) => void;
  } | null;
  /** Stale-response guard (T-187-15) — checked every frame; a newer sync
   *  superseding this one aborts the poll without ever calling zoomToFit. */
  isStale: () => boolean;
  onFlown: (resolvedIds: Set<string>) => void;
  maxFrames?: number;
  /** Wall-clock deadline (ms) — when supplied, overrides `maxFrames` for
   *  expiry purposes. Use for fetch-dependent waits (D-09) where a frame
   *  count is a poor proxy for network+render latency. */
  maxWaitMs?: number;
  /** Widens the zoomToFit FRAMING filter beyond the resolved lit-source ids
   *  (see doc comment above). Does not affect `onFlown`'s resolvedIds. */
  getFramingIds?: (resolvedIds: Set<string>) => Set<string>;
}): () => void {
  const {
    litIds,
    getNodes,
    getHandle,
    isStale,
    onFlown,
    maxFrames = D09_POLL_MAX_FRAMES,
    maxWaitMs,
    getFramingIds = (ids) => ids,
  } = params;
  let cancelled = false;
  let frames = 0;
  const startedAt = nowMs();

  const resolvedNow = (): Set<string> => {
    const nodes = getNodes();
    const resolved = new Set<string>();
    for (const id of litIds) {
      const n = nodes.find((x) => x.id === id);
      if (n && n.x != null && n.y != null) resolved.add(id);
    }
    return resolved;
  };

  const flyCamera = (
    handle: NonNullable<ReturnType<typeof getHandle>>,
    resolved: Set<string>,
  ) => {
    const framingIds = getFramingIds(resolved);
    if (framingIds.size === 1) {
      const [onlyId] = framingIds;
      const node = getNodes().find((n) => n.id === onlyId);
      if (node && node.x != null && node.y != null) {
        handle.cameraPosition(
          { x: node.x, y: node.y, z: (node.z ?? 0) + ISOLATED_NODE_CAMERA_DISTANCE },
          { x: node.x, y: node.y, z: node.z ?? 0 },
          800,
        );
        return;
      }
      // Coordinates unexpectedly missing — fall through to zoomToFit rather
      // than silently doing nothing.
    }
    handle.zoomToFit(800, 60, (n: any) => framingIds.has(n.id));
  };

  const tick = () => {
    if (cancelled || isStale()) return;
    const handle = getHandle();
    const resolved = resolvedNow();

    if (handle && resolved.size === litIds.size) {
      flyCamera(handle, resolved);
      onFlown(resolved);
      return;
    }

    const withinBudget =
      typeof maxWaitMs === "number"
        ? nowMs() - startedAt < maxWaitMs
        : frames++ < maxFrames;

    if (withinBudget) {
      scheduleFrame(tick);
      return;
    }
    // T-187-14 budget expiry: fly to whichever resolved (if the handle ever
    // mounted), silently skip the rest — never retries beyond this.
    if (handle && resolved.size > 0) {
      flyCamera(handle, resolved);
    }
    onFlown(resolved);
  };
  tick();

  return () => {
    cancelled = true;
  };
}

// ── Lazy-load 3D render surface so three.js stays in a separate chunk ───────
// Module-level declaration (avoids "lazy inside component" React warning). This
// dynamic-import boundary is distinct from CodeVaultGraph.tsx's own lazy() call
// (each page owns its own Suspense boundary) but resolves the same ForceGraph3D
// module — Three.js stays out of the main bundle until either page toggles 3D
// (Phase 187 Plan 04, GLXY-01, T-187-12).
const LazyForceGraph3D = lazy(() =>
  import("../components/graph/ForceGraph3D").then((m) => ({ default: m.ForceGraph3D }))
);

// ── Edge styling (KG-07): current solid / superseded dashed+dim / contradiction red.
// COLOR_CURRENT is resolved from useThemeColors().primaryAlpha55 inside the component
// so it follows the active theme. COLOR_CONTRA and COLOR_SUPERSEDED are fixed semantics.
const COLOR_CONTRA = "#ef4444";
const COLOR_SUPERSEDED = "rgba(148, 163, 184, 0.3)";
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
  if (segment === "/hive") return "Hive";
  if (segment === "/memory") return "Memory";
  return "previous graph";
}

export default function KnowledgeGraph() {
  // ── Theme-aware canvas colors (TH-01) ─────────────────────────────────────
  // Canvas APIs cannot read CSS variables — resolves them to hex/rgba at render
  // time and re-resolves on data-theme switch via MutationObserver.
  const colors = useThemeColors();

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

  // ── 3D render-mode toggle (Phase 187 Plan 04, GLXY-01) ────────────────────
  // Mirrors CodeVaultGraph.tsx's toggle scaffold exactly, with one deliberate
  // deviation: the idb key below is "codepulse:kg-render-mode", DISTINCT from
  // CodeVaultGraph's "codepulse:render-mode" (T-187-11 — sharing it would
  // cross-clobber /graphs' and /knowledge-graph's independent toggle state).
  const fgRef3d = useRef<ForceGraph3DHandle>(null);
  const [renderMode, setRenderMode] = useState<"2d" | "3d">("2d");
  // hoveredNodeId for 3D colorFn3D hover/dim logic (no 2D analog — paintNode
  // handles 2D hover via ForceGraphCanvas's own opts.hovered).
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // litNodeIds: the current kg_answer_sync source-node set. Plan 05 populates
  // this via useQuery(api.kg.latestAnswerSync) + setLitNodeIds; this plan wires
  // the ladder only — stays empty (dormant) here. litSizeMultiplier defaults to
  // the resting 1.8x (UI-SPEC D-08) so Plan 05 can animate it through the
  // 1→2.4→1.8 arrival bloom without changing this state's shape.
  const [litNodeIds, setLitNodeIds] = useState<Set<string>>(() => new Set());
  const [litSizeMultiplier, setLitSizeMultiplier] = useState(1.8);

  useEffect(() => {
    let cancelled = false;
    try {
      idbGet("codepulse:kg-render-mode")
        .then((saved) => {
          if (!cancelled && saved === "3d") setRenderMode("3d");
        })
        .catch(() => {
          /* private browsing / IDB unavailable — stay on 2d */
        });
    } catch {
      /* synchronous IDB-open failure (jsdom/SSR/private browsing) — stay on 2d */
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const handleModeToggle = (mode: "2d" | "3d") => {
    setRenderMode(mode);
    try {
      idbSet("codepulse:kg-render-mode", mode).catch(() => {
        /* best effort — silent failure in private browsing */
      });
    } catch {
      /* synchronous IDB-open failure — best effort, ignore */
    }
  };

  const renderModeChipClass = (mode: "2d" | "3d") =>
    renderMode === mode
      ? "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-primary/10 text-primary border border-primary/40"
      : "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-transparent text-muted-foreground border border-border";

  // ── 3D color/size callbacks (Pitfall 1: hex-only, Three.js Color drops rgba)
  // 5-state priority ladder (selected → hovered → lit → dimmed → normal) —
  // delegates to the pure computeColorFn3D/computeNodeValFn3D above so Task 3's
  // tests can exercise every priority branch without mounting the page.
  const colorFn3D = useCallback(
    (node: any): string =>
      computeColorFn3D({
        node: node as KgNode,
        selectedNodeId,
        hoveredNodeId,
        litNodeIds,
        focusSet,
      }),
    [selectedNodeId, hoveredNodeId, litNodeIds, focusSet],
  );

  const nodeValFn3D = useCallback(
    (node: any): number =>
      computeNodeValFn3D({
        node,
        selectedNodeId,
        litNodeIds,
        litSizeMultiplier,
      }),
    [selectedNodeId, litNodeIds, litSizeMultiplier],
  );

  // Post-state-change 3D redraw (RESEARCH Pattern 4) — refresh() re-applies
  // nodeColor/nodeVal to already-cached Three.js materials when selection,
  // hover, or the lit set changes, since react-force-graph-3d doesn't
  // auto-redraw on prop change.
  useEffect(() => {
    if (renderMode !== "3d") return;
    fgRef3d.current?.refresh();
  }, [selectedNodeId, hoveredNodeId, litNodeIds, litSizeMultiplier, renderMode]);

  // ── Answer-sync reaction (Phase 187 Plan 05, GLXY-01) ─────────────────────
  // Subscribes to the latest kg_answer_sync row and drives D-07 (frame all
  // sources), D-09 (ego-lens fallback for off-screen sources), and D-08
  // (arrival bloom / clear / replay-resting) — with SC#2 (no new row / not in
  // 3D mode) guaranteed silent: zero camera motion, zero color/size change.
  const answerSync = useQuery(api.kg.latestAnswerSync);
  // Guards which turnId has already been applied — also doubles as the
  // monotonic stale-response token the D-09 async poll checks against (T-187-15).
  const appliedSyncTurnRef = useRef<string | null>(null);
  // First-ever apply (page-open replay of a persisted row) shows resting
  // state, no bloom (D-08) — every subsequent apply is a genuinely new
  // arrival and blooms.
  const hasAppliedSyncOnceRef = useRef(false);
  // Live mirror of graph.nodes for the D-09 poll, which runs across many rAF
  // frames outside the React effect lifecycle and must see nodes that stream
  // in asynchronously from the ego-lens fetch, not a stale closure snapshot.
  const graphNodesRef = useRef(graph.nodes);
  // Live mirror of graph.links (187-05 fix) — used only to widen the
  // zoomToFit camera-framing filter to a lit source's 1-hop neighbors so a
  // lone lit node isn't framed alone with no context; never affects which
  // ids are actually "lit" (see flyToLitSources' getFramingIds doc comment).
  const graphLinksRef = useRef(graph.links);
  const bloomCancelRef = useRef<() => void>(() => {});
  const fallbackPollCancelRef = useRef<() => void>(() => {});
  // D-09 partial-resolution degrade banner (amber, non-blocking).
  const [staleSourceBanner, setStaleSourceBanner] = useState<{
    resolved: number;
    requested: number;
  } | null>(null);
  // 187 post-verify fix: wall-clock deadline until which onEngineStop must
  // re-frame onto the lit sources instead of doing an unfiltered whole-graph
  // refit (see resolveEngineStopFilter / SYNC_CAMERA_GRACE_MS above). 0 =
  // no active sync framing (ordinary refit behavior, unchanged).
  const syncFramingExpiresAtRef = useRef<number>(0);

  useEffect(() => {
    graphNodesRef.current = graph.nodes;
    graphLinksRef.current = graph.links;
  }, [graph.nodes, graph.links]);

  // 187-05 fix: widens a resolved lit-source set to include its 1-hop
  // neighbors, for zoomToFit's camera-FRAMING filter only. Degrades
  // gracefully to the source-only set when no neighbor links resolve (e.g.
  // a source with no loaded edges) — flyToLitSources' identity default
  // covers that case since the union is then just the source set itself.
  const framingIdsFor = useCallback((resolvedIds: Set<string>): Set<string> => {
    const neighbors = neighborsOfIds(graphLinksRef.current, resolvedIds);
    if (neighbors.size === 0) return resolvedIds;
    return new Set([...resolvedIds, ...neighbors]);
  }, []);

  // 187 post-verify fix: shared onEngineStop handler for all three 3D mount
  // sites. Pre-fix, every settle unconditionally ran an unfiltered
  // zoomToFit(400, 60) — including the settle caused by the D-09 ego-lens
  // fetch streaming in new neighbor nodes, which silently re-framed the WHOLE
  // graph and undid the D-07/D-09 fly. Within SYNC_CAMERA_GRACE_MS of a sync
  // reaction starting (see the effect below), re-frame onto the lit sources
  // instead; otherwise fall through to the original unfiltered refit
  // unchanged (ordinary initial load / lens switch / no active sync).
  const handleEngineStop3d = useCallback(() => {
    const filterFn = resolveEngineStopFilter({
      now: Date.now(),
      syncFramingExpiresAt: syncFramingExpiresAtRef.current,
      litNodeIds,
      framingIds: framingIdsFor(litNodeIds),
    });
    fgRef3d.current?.zoomToFit(400, 60, filterFn ?? undefined);
  }, [litNodeIds, framingIdsFor]);

  // Cancel any in-flight tween/poll on unmount — the rAF loops above are
  // self-contained and would otherwise keep calling setState after unmount.
  useEffect(() => {
    return () => {
      bloomCancelRef.current();
      fallbackPollCancelRef.current();
    };
  }, []);

  useEffect(() => {
    // SC#2: no sync row yet, or not mounted in 3D — completely silent.
    if (!answerSync || renderMode !== "3d") return;
    // SC#2: same turnId already applied — no-op (zero motion/color/toast).
    if (appliedSyncTurnRef.current === answerSync.turnId) return;

    const turnId = answerSync.turnId;
    const isReplay = !hasAppliedSyncOnceRef.current;
    appliedSyncTurnRef.current = turnId;
    hasAppliedSyncOnceRef.current = true;

    // V5/T-187-13: UUID-validate before any nodeFilterFn/setFilter use —
    // malformed/empty sourceNodeIds degrades to a graceful no-op.
    const validIds = filterValidSourceNodeIds(answerSync.sourceNodeIds ?? []);
    if (validIds.length === 0) return;

    const litIds = new Set(validIds);

    // 187 post-verify fix: this turn's camera framing becomes authoritative
    // over onEngineStop's settle-driven refit for the grace window — covers
    // both the immediate D-07/D-09 fly AND any later settle triggered by the
    // D-09 ego-lens fetch streaming in new nodes (see handleEngineStop3d /
    // resolveEngineStopFilter above).
    syncFramingExpiresAtRef.current = Date.now() + SYNC_CAMERA_GRACE_MS;

    // A newer sync always wins over any in-flight animation/poll from a
    // superseded one.
    bloomCancelRef.current();
    fallbackPollCancelRef.current();
    setStaleSourceBanner(null);

    const hadPriorLitSet = litNodeIds.size > 0;
    if (isReplay) {
      // D-08: page-open replay — resting state, no bloom.
      setLitNodeIds(litIds);
      setLitSizeMultiplier(LIT_RESTING_MULTIPLIER);
    } else if (hadPriorLitSet) {
      // D-08: a superseded set clears (~200ms) while the new set's bloom
      // begins ~100ms after clearing starts (slight stagger).
      bloomCancelRef.current = runClearThenBloom({
        setLitNodeIds,
        setLitSizeMultiplier,
        newLitIds: litIds,
      });
    } else {
      // D-08: first-ever arrival this session — straight into the bloom.
      setLitNodeIds(litIds);
      bloomCancelRef.current = runArrivalBloom(setLitSizeMultiplier);
    }

    const nodes = graphNodesRef.current;
    const allOnScreen = [...litIds].every((id) => nodes.some((n) => n.id === id));

    if (allOnScreen) {
      // D-07 primary path — frame every source directly. Routed through
      // flyToLitSources (not a bare sync zoomToFit call) because fgRef3d.current
      // can still be null immediately after toggling into 3D mode — the lazy
      // ForceGraph3D hasn't mounted through its Suspense boundary yet.
      fallbackPollCancelRef.current = flyToLitSources({
        litIds,
        getNodes: () => graphNodesRef.current,
        getHandle: () => fgRef3d.current,
        isStale: () => appliedSyncTurnRef.current !== turnId,
        onFlown: () => {},
        getFramingIds: framingIdsFor,
      });
      return;
    }

    // D-09 fallback — reuse the exact ?focus= ego-lens mechanism, then poll
    // for layout readiness (and ref-mount readiness), then the SAME
    // zoomToFit call as D-07.
    //
    // 187 post-verify fix (187-REVIEW WR-03): target the emitted UUID
    // directly via setFilter("entityId", ...) — validIds[0] is guaranteed to
    // exist here (the validIds.length===0 guard above already returned), so
    // this path no longer gates on primaryEntityName at all. Entity names
    // are NOT unique — a live example has two "astridr" rows (a [person]
    // with no facts and a [persona] with 5 facts) — so a name-driven fetch
    // can silently resolve to the WRONG duplicate. Pre-fix, a degraded
    // `GraphQueryTool.get_name` lookup (primaryEntityName === null) disabled
    // this entire fallback despite a perfectly usable UUID being present —
    // the `if (!answerSync.primaryEntityName) return;` guard that used to
    // sit here is the defect this fixes.
    setLens("entity");
    setFilter("entityId", validIds[0]);
    setFilter("hops", 1);

    fallbackPollCancelRef.current = flyToLitSources({
      litIds,
      getNodes: () => graphNodesRef.current,
      getHandle: () => fgRef3d.current,
      isStale: () => appliedSyncTurnRef.current !== turnId,
      // 187-05 live-checkpoint fix #1: this path is fetch-dependent
      // (setFilter above triggers a /api/kg/entity round-trip before any
      // node can lay out), so it gets a wall-clock budget instead of D-07's
      // in-memory-only frame budget — see D09_FETCH_POLL_MAX_MS.
      maxWaitMs: D09_FETCH_POLL_MAX_MS,
      onFlown: (resolvedIds) => {
        // 187-05 live-checkpoint fix #1: total non-resolution after a
        // genuine (bounded) wait is surfaced too, not silently dropped —
        // reuses the existing "showing {N} of {M}" banner with honest
        // numbers (N may be 0) rather than inventing new copy. litNodeIds
        // still reflects reality: nothing resolved -> nothing lights up.
        setLitNodeIds(resolvedIds);
        if (resolvedIds.size < litIds.size) {
          setStaleSourceBanner({ resolved: resolvedIds.size, requested: litIds.size });
        }
      },
      getFramingIds: framingIdsFor,
    });
    // NOTE: graph.nodes and litNodeIds are intentionally excluded — this
    // effect must fire exactly once per new turnId (guarded by
    // appliedSyncTurnRef above); reactivity to graph.nodes streaming in later
    // is handled by the graphNodesRef-driven poll, not by re-running this
    // effect.
  }, [answerSync, renderMode]);

  // Shared Suspense fallback for the lazy 3D surface — sized identically to the
  // default ForceGraphCanvas/ForceGraph3D canvasClass so toggling doesn't shift
  // layout while the react-force-graph-3d/three.js chunk is fetched.
  const loading3dFallback = (
    <div className="relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]">
      <div className="flex h-full items-center justify-center">
        <p className="text-primary/70 font-mono text-base animate-pulse">
          Loading 3D render…
        </p>
      </div>
    </div>
  );

  // ── Temporal sub-mode state (KG-11, Plan 03) ─────────────────────────────────
  // Defaults to "point" which preserves the existing single-as-of behavior (SC — no regression).
  // Resets to "point" when lens changes away from / re-enters temporal (UI-SPEC: state discarded).
  const [temporalSubMode, setTemporalSubMode] = useState<TemporalSubMode>("point");

  // animPauseRef holds the latest anim.pause so the lens-change effect below can
  // call it without depending on the anim object (avoids a circular dep chain).
  const animPauseRef = useRef<() => void>(() => {});

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

  // ── Animation state (KG-11, Plan 04) ─────────────────────────────────────────
  const [animRangeStart, setAnimRangeStart] = useState<string | null>(null);
  const [animRangeEnd, setAnimRangeEnd] = useState<string | null>(null);
  const [animInterval, setAnimInterval] = useState<"day" | "week" | "month">("day");

  const anim = useKgAnimation({
    rangeStart: animRangeStart,
    rangeEnd: animRangeEnd,
    interval: animInterval,
  });

  // Keep animPauseRef current so the sub-mode/lens reset effect can call pause without deps.
  animPauseRef.current = anim.pause;

  // Reset temporal sub-mode to "point" and pause animation when leaving temporal lens
  // (UI-SPEC: animation + diff state discarded on lens change).
  useEffect(() => {
    if (lens !== "temporal") {
      setTemporalSubMode("point");
      animPauseRef.current();
    }
  }, [lens]);

  // Pause animation when switching temporal sub-mode away from animate (UI-SPEC).
  useEffect(() => {
    if (temporalSubMode !== "animate") {
      animPauseRef.current();
    }
  }, [temporalSubMode]);

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
    // 187-05: clear a stale D-09 sync entityId — this is the user-driven
    // name path, which must win outright, never race a previous sync's id.
    setFilter("entityId", null);
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
    // 187-05: entityId is never persisted in a saved view (programmatic-only,
    // excluded from idb persistence) — clear any stale D-09 sync id so the
    // loaded view's name wins outright.
    setFilter("entityId", null);
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
      // 187-05: same rationale as the ?view hydration effect above.
      setFilter("entityId", null);
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

  // User-initiated lens/filter changes diverge from any loaded saved view, so
  // clear the active-view highlight (WR-01). These wrap the raw setters ONLY
  // where they're handed to KGControls — programmatic load/hydration keeps
  // using setLens/setFilter directly and re-sets activeViewId afterward.
  const handleUserLens = useCallback(
    (l: KgLens) => {
      setActiveViewId(null);
      setLens(l);
    },
    [setLens],
  );
  const handleUserFilter = useCallback(
    <K extends keyof KgFilters>(key: K, value: KgFilters[K]) => {
      setActiveViewId(null);
      setFilter(key, value);
    },
    [setFilter],
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
      // Reset the one-shot inbound-focus guard so THIS click re-applies the
      // entity-lens override. Without this, appliedFocusRef stays true after the
      // first ?focus (deep-link hydration or a prior click left in the URL on
      // reload), and every subsequent search-result click is silently ignored —
      // the URL changes (return chip appears) but setLens("entity") never fires.
      appliedFocusRef.current = false;
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

  // ── linkColorFn — theme-aware current-edge color (TH-01) ────────────────────
  // COLOR_CURRENT is resolved from colors.primaryAlpha55 (--primary @ 0.55 opacity)
  // so it follows the active theme. Wrapped in useCallback([colors]) to re-create
  // on theme switch.
  const linkColorFn = useCallback(
    (l: any): string => {
      const link = l as KgLink;
      if (link.contradictionFlag) return COLOR_CONTRA;
      return link.current ? colors.primaryAlpha55 : COLOR_SUPERSEDED;
    },
    [colors],
  );

  // ── Diff edge style functions (memoized on diff.edges) ─────────────────────
  const linkColorDiffFn = useMemo(
    () => (diff ? makeLinkColorDiffFn(diff.edges) : linkColorFn),
    [diff, linkColorFn],
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
  // 187-05: an entityId-driven fetch (D-09 answer-sync fallback) has no
  // entityName text — must not show the "type a name" empty state while it
  // is loading/loaded.
  const needsEntityName =
    lens === "entity" && !filters.entityName.trim() && !filters.entityId;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-min">
      {/* Header */}
      <div className="md:col-span-12 flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            icon={Share2}
            title={
              <>
                KG Explorer
                <InfoTooltip text="Ástríðr's temporal knowledge graph: entities (type-colored) and the facts connecting them. Current relationships are solid; superseded facts dashed; contradictions red. Literal facts show as entity attributes in the details panel." />
              </>
            }
          />
          <p className="text-sm text-muted-foreground font-mono mt-1">
            entities · knowledge_triples — fetched on demand from /api/kg
          </p>
        </div>

        {/* 2D | 3D render-mode toggle (Phase 187 Plan 04, GLXY-01) — copied
            verbatim from CodeVaultGraph.tsx's chip pair, KG-distinct idb key
            (T-187-11). Neutral active treatment — never recolored emerald
            (UI-SPEC Color: that would fake a "something is lit" signal). */}
        <div role="group" aria-label="Render mode" className="flex items-center gap-1">
          <button
            className={renderModeChipClass("2d")}
            aria-pressed={renderMode === "2d"}
            onClick={() => handleModeToggle("2d")}
          >
            2D
          </button>
          <button
            className={renderModeChipClass("3d")}
            aria-pressed={renderMode === "3d"}
            onClick={() => handleModeToggle("3d")}
          >
            3D
          </button>
        </div>
      </div>

      {/* KG-01: always-on summary cards (Convex kgSummary) */}
      <div className="md:col-span-12">
        <SectionErrorBoundary name="KG Summary">
          <KGSummaryCards />
        </SectionErrorBoundary>
      </div>

      {/* Controls */}
      <div className="md:col-span-12">
        <SectionErrorBoundary name="KG Controls">
          <KGControls
            lens={lens}
            onLens={handleUserLens}
            filters={filters}
            setFilter={handleUserFilter}
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
            animRangeStart={animRangeStart}
            animRangeEnd={animRangeEnd}
            animInterval={animInterval}
            onChangeAnimRange={(start, end) => {
              setAnimRangeStart(start);
              setAnimRangeEnd(end);
            }}
            onChangeAnimInterval={setAnimInterval}
            animFrames={anim.frames}
            animCurrentFrameIndex={anim.currentFrameIndex}
            animIsPlaying={anim.isPlaying}
            animFps={anim.fps}
            animFrameError={anim.frameError}
            onAnimPlay={anim.play}
            onAnimPause={anim.pause}
            onAnimStepBack={anim.stepBack}
            onAnimStepForward={anim.stepForward}
            onAnimSetFrameIndex={anim.setFrameIndex}
            onAnimSetFps={anim.setFps}
          />
        </SectionErrorBoundary>
      </div>

      {/* Error / truncation banners */}
      <div className="md:col-span-12 space-y-4">
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

        {/* D-09 partial-resolution degrade banner (Phase 187 Plan 05, GLXY-01) —
            some grounded sources didn't lay out within the poll budget; the
            resolved subset still flew/lit normally, this is non-blocking. */}
        {staleSourceBanner && (
          <div className="flex items-start gap-3 rounded-[var(--radius)] border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm font-mono">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
            <span className="text-muted-foreground">
              Some grounded sources are no longer in the graph — showing{" "}
              {staleSourceBanner.resolved} of {staleSourceBanner.requested}.
            </span>
          </div>
        )}
      </div>

      {/* Graph + details panel — layout forks on the Search lens (KG-08) */}
      <div className="md:col-span-12">
        <SectionErrorBoundary name="KG Graph">
          {lens === "search" ? (
            /* Search lens: left pane = KGSearchResults, right pane = KGDetailsPanel */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8">
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
              </div>

              {/* Details panel reused — shows selected entity after a result-click ego-load */}
              <div className="md:col-span-4">
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
                  onAgentNav={(agentId, entityName) =>
                    navigate(
                      buildFocusUrl(
                        { surface: "tool-galaxy", nodeId: `agent:${agentId}` },
                        "/knowledge-graph?focus=" +
                          encodeURIComponent(entityName) +
                          "&lens=entity&hops=1",
                      ),
                    )
                  }
                />
              </div>
            </div>
        ) : (
          /* All other lenses: existing graph + details layout unchanged */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="relative md:col-span-8">
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

              {/* Animate sub-mode: frame error + canvas (KG-11, Plan 04, D-08 graceful-degrade) */}
              <SectionErrorBoundary name="KG Animation">
                {lens === "temporal" && temporalSubMode === "animate" && (
                  <>
                    {/* Per-frame inline error — non-blocking (D-08) */}
                    {anim.frameError && (
                      <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3 mb-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                        <div className="text-sm font-mono leading-relaxed">
                          <p className="text-foreground">{anim.frameError}</p>
                          <p className="text-muted-foreground/70 mt-0.5">
                            Check that Ástríðr is running and the date is within the stored snapshot range.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Animate canvas: render anim.currentGraph with standard paintNode */}
                    {anim.frames.length > 0 && (
                      anim.currentGraph === null ? (
                        /* Loading first frame */
                        <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
                          <p className="text-primary/70 font-mono text-base animate-pulse">
                            Animating…
                          </p>
                        </div>
                      ) : renderMode === "2d" ? (
                        <ForceGraphCanvas
                          ref={fgRef}
                          data={anim.currentGraph}
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
                      ) : (
                        <Suspense fallback={loading3dFallback}>
                          <LazyForceGraph3D
                            ref={fgRef3d}
                            data={anim.currentGraph}
                            colorFn={colorFn3D}
                            nodeValFn={nodeValFn3D}
                            labelFn={labelFn}
                            onNodeClick={(n: any) => selectNode(n.id)}
                            onNodeHover={(n: any) => setHoveredNodeId(n?.id ?? null)}
                            onBackgroundClick={() => {
                              selectNode(null);
                              selectEdge(null);
                            }}
                            onEngineStop={handleEngineStop3d}
                          />
                        </Suspense>
                      )
                    )}
                  </>
                )}
              </SectionErrorBoundary>

              {!diffLoading && temporalSubMode !== "animate" && (
                loading ? (
                  <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
                    <p className="text-primary/70 font-mono text-base animate-pulse">
                      Querying knowledge graph…
                    </p>
                  </div>
                ) : activeGraph.nodes.length === 0 ? (
                  <div className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 rounded-[var(--radius)] border border-primary/20 bg-background">
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
                  renderMode === "2d" ? (
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
                    <Suspense fallback={loading3dFallback}>
                      <LazyForceGraph3D
                        ref={fgRef3d}
                        data={activeGraph}
                        colorFn={colorFn3D}
                        nodeValFn={nodeValFn3D}
                        labelFn={labelFn}
                        onNodeClick={(n: any) => selectNode(n.id)}
                        onNodeHover={(n: any) => setHoveredNodeId(n?.id ?? null)}
                        onBackgroundClick={() => {
                          selectNode(null);
                          selectEdge(null);
                        }}
                        onEngineStop={handleEngineStop3d}
                      />
                    </Suspense>
                  )
                ) : (
                  /* Point mode (and other lenses): original paintNode/linkColorFn — NO REGRESSION */
                  renderMode === "2d" ? (
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
                  ) : (
                    <Suspense fallback={loading3dFallback}>
                      <LazyForceGraph3D
                        ref={fgRef3d}
                        data={graph}
                        colorFn={colorFn3D}
                        nodeValFn={nodeValFn3D}
                        labelFn={labelFn}
                        onNodeClick={(n: any) => selectNode(n.id)}
                        onNodeHover={(n: any) => setHoveredNodeId(n?.id ?? null)}
                        onBackgroundClick={() => {
                          selectNode(null);
                          selectEdge(null);
                        }}
                        onEngineStop={handleEngineStop3d}
                      />
                    </Suspense>
                  )
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
    </div>
  );
}
