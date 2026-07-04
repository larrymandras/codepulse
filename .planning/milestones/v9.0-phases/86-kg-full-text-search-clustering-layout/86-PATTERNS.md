# Phase 86: KG Full-Text Search + Clustering Layout - Pattern Map

**Mapped:** 2026-06-23
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/kgApi.ts` | utility/API client | request-response | `src/lib/kgApi.ts` (self — additive) | exact |
| `src/lib/kg-graph.ts` | utility/transform | transform | `src/lib/kg-graph.ts` (self — additive, `entityTypeColor` pattern) | exact |
| `src/components/graph/ForceGraphCanvas.tsx` | component | event-driven | `src/components/graph/ForceGraphCanvas.tsx` (self — additive) | exact |
| `src/components/kg/KGControls.tsx` | component | request-response | `src/components/kg/KGControls.tsx` (self — additive, lens array pattern) | exact |
| `src/components/kg/KGSearchResults.tsx` | component (NEW) | request-response | `src/components/kg/KGDetailsPanel.tsx` (`PanelShell` + row pattern) | role-match |
| `src/pages/KnowledgeGraph.tsx` | page | request-response | `src/pages/KnowledgeGraph.tsx` (self — additive, legend + focus wiring) | exact |
| `src/hooks/useKnowledgeGraph.ts` | hook | request-response | `src/hooks/useKnowledgeGraph.ts` (self — additive, lens/filter pattern) | exact |
| `src/components/graph/CodeVaultGraph.tsx` | component | request-response | `src/components/graph/CodeVaultGraph.tsx` (self — additive, community read) | exact |

---

## Pattern Assignments

### `src/lib/kgApi.ts` — add `fetchSearch()` (additive)

**Analog:** Self — the existing `kgGet` internal + public fetcher pattern (lines 111–165).

**File header comment pattern** (lines 1–19):
```typescript
/**
 * Temporal-KG read API client (Phase 74).
 *
 * Typed fetchers for Ástríðr's Phase 135 `/api/kg/*` HTTP surface. Every call is
 * Bearer-authed via `authHeaders()` (CLAUDE.md: all /api/* calls require it) and
 * hits `VITE_ASTRIDR_API_URL`. This is the *interactive* path — fetch-on-demand,
 * NOT mirrored into Convex (the always-on summary cards read Convex instead).
 *
 * The response shapes here mirror the LIVE emitter
 * (`astridr/channels/kg_read_api.py`), which differs from the idealized spec:
 *   …
 * ADD for Phase 86:
 *   - `/search` consumer shape is consumer-defined (see KgSearchParams /
 *     KgSearchResponse). Ástríðr is the source of truth when live — document
 *     any known consumer/emitter divergences here.
 */
```

**Imports** (line 20):
```typescript
import { authHeaders, astridrApiBase, AstridrApiError } from "./astridrApi";
```

**`kgGet` internal helper** (lines 111–133) — copy verbatim, new fetcher calls it:
```typescript
async function kgGet<T>(
  path: string,
  params?: Record<string, string | number | null | undefined>,
): Promise<T> {
  const url = new URL(`${astridrApiBase()}${path}`, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== null && v !== undefined && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
  }
  const res = await fetch(url.toString(), { headers: authHeaders() });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ detail: res.statusText }) as { detail?: unknown });
    const detail =
      typeof body.detail === "string" ? body.detail : res.statusText;
    throw new AstridrApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}
```

**Param interface pattern** (lines 90–102) — shape for `KgSearchParams`:
```typescript
// Existing pattern to copy:
export interface OverviewParams {
  limit?: number;
  entityType?: string | null;
  agentId?: string | null;
  asOf?: string | null;
}
// New interface follows same camelCase/optional pattern:
export interface KgSearchParams {
  query: string;
  entity_type?: string | null;   // snake_case to match kgGet param-key convention
  agent_id?: string | null;
  limit?: number;
}
```

**Public fetcher pattern** (lines 141–148) — `fetchOverview` → `fetchSearch` shape:
```typescript
// Existing analog:
export function fetchOverview(
  params: OverviewParams = {},
): Promise<KgOverviewResponse> {
  return kgGet<KgOverviewResponse>("/api/kg/overview", {
    limit: params.limit,
    entity_type: params.entityType,
    agent_id: params.agentId,
    asOf: params.asOf,
  });
}
// New fetcher follows exact same shape — one-liner delegation to kgGet:
export function fetchSearch(params: KgSearchParams): Promise<KgSearchResponse> {
  return kgGet<KgSearchResponse>("/api/kg/search", {
    query: params.query,
    entity_type: params.entity_type,
    agent_id: params.agent_id,
    limit: params.limit,
  });
}
```

**`AstridrApiError` gate pattern** (from `src/lib/astridrApi.ts` lines 107–115):
```typescript
// AstridrApiError has a `status` number field:
export class AstridrApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AstridrApiError";
    this.status = status;
  }
}
// Consumer gate (D-01) pattern in the Search lens fetch handler:
try {
  const data = await fetchSearch({ query, entity_type: entityType, agent_id: agentId });
  setResults(data.results);
  setGateState("ok");
} catch (e) {
  if (e instanceof AstridrApiError && (e.status === 404 || e.status === 501)) {
    setGateState("not-deployed"); // → informational copy, NOT a hard error
  } else {
    setGateState("error");        // → error banner
  }
}
```

---

### `src/lib/kg-graph.ts` — add `KgNode.community`, `COMMUNITY_PALETTE`, `communityColor()` (additive)

**Analog:** Self — `ENTITY_TYPE_COLORS` + `entityTypeColor()` pattern (lines 100–137).

**`ENTITY_TYPE_COLORS` palette constant pattern** (lines 101–112):
```typescript
export const ENTITY_TYPE_COLORS: { type: string; color: string }[] = [
  { type: "person", color: "#10b981" }, // emerald — primary
  { type: "organization", color: "#3b82f6" },
  // ... 10 slots total
];
```
New palette follows the same export-constant pattern, but as a flat string array:
```typescript
// ADD after ENTITY_TYPE_COLORS (same file, co-located per RESEARCH.md):
export const COMMUNITY_PALETTE: string[] = [
  "#60a5fa", // slot 0 — blue-400
  "#f472b6", // slot 1 — pink-400
  "#fbbf24", // slot 2 — amber-400
  "#34d399", // slot 3 — emerald-400 (lighter than #10b981 accent — distinct)
  "#a78bfa", // slot 4 — violet-400
  "#22d3ee", // slot 5 — cyan-400
  "#fb923c", // slot 6 — orange-400
  "#a3e635", // slot 7 — lime-400
];
```

**`entityTypeColor()` lookup pattern** (lines 135–137) — `communityColor()` mirrors it:
```typescript
// Existing pattern:
export function entityTypeColor(raw: string | null | undefined): string {
  return _colorByType.get(normalizeEntityType(raw)) ?? FALLBACK_COLOR;
}
// New function — same module-level export pattern, null-returns instead of fallback:
export function communityColor(community: number | null | undefined): string | null {
  if (community == null) return null;
  return COMMUNITY_PALETTE[Math.abs(community) % 8];
}
```

**`KgNode` interface field addition** (lines 39–52) — add after `synthetic`:
```typescript
export interface KgNode {
  id: string;
  name: string;
  entityType: string;
  agentId: string;
  val: number;
  degree: number;
  color: string;
  attributes: KgAttribute[];
  synthetic: boolean;
  /** Community cluster id (from graphify snapshot or future KG community detection).
   *  null = unclustered (vault nodes, un-clustered KG nodes). undefined = API hasn't emitted it yet. */
  community?: number | null;  // ADD THIS FIELD
}
```

**`upsertNode` threading pattern** (lines 226–250) — add `community` beside existing fields:
```typescript
// In upsertNode, when creating a new node (n is undefined):
n = {
  id,
  name: seed?.name ?? id,
  entityType: et,
  agentId: seed?.agentId ?? "",
  val: MIN_NODE_SIZE,
  degree: 0,
  color: entityTypeColor(et),
  attributes: [],
  synthetic,
  community: (seed as any)?.community ?? null,  // ADD: thread from KgEntity once API emits it
};
```

---

### `src/components/graph/ForceGraphCanvas.tsx` — add cluster force + halo + `ForceGraphHandle` members (additive)

**Analog:** Self — `useImperativeHandle` + `paintNode` callback + `ForceGraph2D` ref pattern (lines 28–200).

**`ForceGraphHandle` interface** (lines 28–32) — extend with d3Force members:
```typescript
// Existing:
export interface ForceGraphHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
}
// ADD two members:
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
```

**`useImperativeHandle` block** (lines 96–100) — extend to expose new members:
```typescript
// Existing:
useImperativeHandle(ref, () => ({
  centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
  zoom: (k, ms) => fgRef.current?.zoom(k, ms),
  zoomToFit: (ms, padding) => fgRef.current?.zoomToFit(ms, padding),
}));
// ADD:
  d3Force: (name, force) => fgRef.current?.d3Force(name, force),
  d3ReheatSimulation: () => fgRef.current?.d3ReheatSimulation(),
```

**`ForceGraphCanvasProps` interface** (lines 34–66) — add cluster prop:
```typescript
// Existing props follow this pattern — add after onEngineStop:
  /** When true and nodes carry community, inject forceX/forceY cluster forces.
   *  No-op when no node has a non-null community (SC#4 no-regression). */
  clusterForce?: boolean;
```

**`paintNode` delegator** (lines 141–153) — the community halo slots INSIDE the custom `paintNode` callback at the call site (`KnowledgeGraph.tsx`), NOT inside `ForceGraphCanvas` itself. The canvas receives the `paintNode` prop and calls it as-is. The halo draw is applied in the caller's `paintNode` callback before the selection ring (see `KnowledgeGraph.tsx` pattern below).

**`defaultPaint` pattern** (lines 110–139) — reference for halo layer order:
```typescript
// Existing layer order in defaultPaint:
//   1. globalAlpha set (dimmed / full)
//   2. arc fill (node color)
//   3. shadowBlur = 0 after fill
//   4. label at zoom threshold
// Community halo (in KnowledgeGraph's paintNode) inserts at step 2.5:
//   2. arc fill
//   2.5 community halo arc (before selection ring — see KnowledgeGraph pattern)
//   3. selection ring arc
//   4. label
```

**d3-force cluster injection pattern** (use `useEffect` after data/mount, never during render):
```typescript
// Import at top of ForceGraphCanvas.tsx:
import { forceX, forceY, forceCollide } from "d3-force-3d";

// Inside ForceGraphCanvas, new useEffect — runs after data changes, guarded:
useEffect(() => {
  if (!clusterForce) return;
  const fg = fgRef.current;
  if (!fg) return;
  const hasCommunity = data.nodes.some((n: any) => n.community != null);
  if (!hasCommunity) {
    fg.d3Force("clusterX", null);
    fg.d3Force("clusterY", null);
    fg.d3Force("clusterCollide", null);
    return;
  }
  const communities = [...new Set(
    data.nodes.filter((n: any) => n.community != null).map((n: any) => n.community as number)
  )];
  const R = 150;
  const centroids = new Map(communities.map((c, i) => {
    const angle = (i / communities.length) * 2 * Math.PI;
    return [c, { x: Math.cos(angle) * R, y: Math.sin(angle) * R }];
  }));
  fg.d3Force("clusterX",
    forceX((node: any) => node.community != null ? (centroids.get(node.community)?.x ?? 0) : undefined)
      .strength(0.15)
  );
  fg.d3Force("clusterY",
    forceY((node: any) => node.community != null ? (centroids.get(node.community)?.y ?? 0) : undefined)
      .strength(0.15)
  );
  fg.d3Force("clusterCollide",
    forceCollide((node: any) => (node.val ?? 3) + 2).strength(0.7)
  );
  fg.d3ReheatSimulation();
}, [data.nodes, clusterForce]);
// CRITICAL: return undefined (not 0) for null-community nodes in forceX/forceY
// accessors — d3 treats undefined as "no target" (RESEARCH Pitfall 3).
// CRITICAL: always call d3Force("clusterX", null) before re-applying (Pitfall 2).
// CRITICAL: inject in useEffect, not during render (Pitfall 1).
// CRITICAL: call d3ReheatSimulation() after setting forces (Pitfall 5).
```

---

### `src/components/kg/KGControls.tsx` — add 5th "Search" lens (additive)

**Analog:** Self — `LENSES` array + lens-gated filter block pattern (lines 15–107).

**`LENSES` array pattern** (lines 15–20) — append 5th entry:
```typescript
const LENSES: { id: KgLens; label: string; hint: string }[] = [
  { id: "overview",      label: "Overview",      hint: "Bounded top-N entities + relationships" },
  { id: "entity",        label: "Entity (ego)",  hint: "Search an entity → its ego graph" },
  { id: "temporal",      label: "Temporal",      hint: "Scrub an as-of date; superseded facts dashed" },
  { id: "contradiction", label: "Contradictions", hint: "Conflicting current beliefs" },
  // ADD (Phase 86, KG-08):
  { id: "search",        label: "Search",        hint: "Full-text across fact text + relationship labels" },
];
```

**Lens tab render pattern** (lines 49–63) — unchanged, drives rendering from LENSES array:
```typescript
{LENSES.map((l) => (
  <button
    key={l.id}
    onClick={() => onLens(l.id)}
    title={l.hint}
    aria-pressed={lens === l.id}
    className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-sm font-mono border transition-colors ${
      lens === l.id
        ? "bg-primary/15 border-primary/50 text-primary"
        : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
    }`}
  >
    {l.label}
  </button>
))}
```

**Lens-gated input block pattern** (lines 82–107) — entity lens block is the template for Search:
```typescript
// Existing entity lens gate:
{lens === "entity" && (
  <div className="flex items-center gap-2">
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={filters.entityName}
        onChange={(e) => setFilter("entityName", e.target.value)}
        placeholder="Search entity by name…"
        className="pl-8 w-56 font-mono text-sm"
      />
    </div>
    …
  </div>
)}
// New Search lens gate follows same pattern — different placeholder + filter key:
{lens === "search" && (
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
    <Input
      value={filters.searchQuery ?? ""}
      onChange={(e) => setFilter("searchQuery", e.target.value)}
      placeholder="Search facts & relationships…"
      className="pl-8 w-64 font-mono text-sm"
    />
  </div>
)}
// NOTE: entity-name Input MUST NOT render when lens==="search" (SC#1 distinctness).
// The existing {lens === "entity" && ...} gate already handles this — no change needed.
```

**`KGControlsProps` interface** (lines 24–33) — `KgLens` and `KgFilters` types come from the hook; no local changes needed beyond what the hook exposes.

---

### `src/components/kg/KGSearchResults.tsx` — NEW results-list panel

**Analog:** `src/components/kg/KGDetailsPanel.tsx` — `PanelShell` container + `AttributeRow`/`EdgeRow` row pattern (lines 60–177).

**Container shell pattern** (lines 143–177 of KGDetailsPanel):
```typescript
// KGDetailsPanel's PanelShell:
<div className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 space-y-3 h-full overflow-y-auto custom-scrollbar">
  {/* content */}
</div>
// KGSearchResults mirrors this surface/scroll convention:
// - bg-card/70 backdrop-blur border border-primary/20
// - max-h-[600px] overflow-y-auto custom-scrollbar (UI-SPEC: aligns with 600px canvas)
// - p-4 space-y-3 internal rhythm
```

**Row pattern** (lines 60–82 of KGDetailsPanel — `AttributeRow`):
```typescript
// Existing row: rounded-[var(--radius-sm)] border border-border bg-card/50 px-2.5 py-1.5
<div className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-card/50 px-2.5 py-1.5">
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-sm font-mono text-primary">{attr.predicate}</span>
      …
    </div>
    <div className="text-xs text-muted-foreground font-mono mt-0.5">…</div>
  </div>
</div>
// KGSearchResults result row mirrors this — entity name (foreground) · predicate (muted mono) · snippet:
<button
  onClick={() => onSelectResult(hit.subjectName)}
  className="w-full text-left flex items-start gap-3 rounded-[var(--radius-sm)] border border-border bg-card/50 px-3 py-2.5 hover:bg-accent/50 hover:border-primary/30 transition-colors"
>
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-sm font-mono text-foreground">{hit.subjectName}</span>
      <span className="text-xs text-muted-foreground font-mono">·</span>
      <span className="text-xs font-mono text-muted-foreground">{hit.predicate}</span>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed mt-0.5 break-words">
      {/* render snippet with matched term emphasized (font-semibold text-primary) */}
    </p>
  </div>
</button>
```

**Loading/error/empty state pattern** (from `KnowledgeGraph.tsx` lines 285–306):
```typescript
// Existing loading state:
{loading ? (
  <div className="h-[600px] flex items-center justify-center …">
    <p className="text-primary/70 font-mono text-base animate-pulse">
      Querying knowledge graph…
    </p>
  </div>
) : isEmpty ? (
  <div className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 …">
    <AlertTriangle className="h-6 w-6 text-primary/50" />
    <p className="text-base text-muted-foreground font-mono">…</p>
  </div>
) : (
  // content
)}
// KGSearchResults mirrors this pattern with copy from UI-SPEC Copywriting Contract:
// loading → "Searching knowledge graph…" (animate-pulse, text-primary/70)
// no query → heading "Search the knowledge graph" + body copy
// no results → "No matches for "{query}"" + body copy
// not-deployed (AstridrApiError 404/501) → informational copy (NOT red banner)
// error → border-red-500/30 bg-red-500/5 banner with endpoint + fallback note
```

**Error banner pattern** (from `KnowledgeGraph.tsx` lines 227–237):
```typescript
// Existing error banner:
{error && (
  <div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
    <div className="text-sm font-mono leading-relaxed">
      <p className="text-foreground">Could not reach the KG read API.</p>
      <p className="text-muted-foreground mt-0.5">{error}</p>
    </div>
  </div>
)}
// KGSearchResults error variant: same structure, endpoint-named copy per UI-SPEC.
// NOT-deployed variant: amber/info tone (informational), not red.
```

**Props interface for new component:**
```typescript
export interface KGSearchResultsProps {
  results: KgSearchHit[];
  query: string;
  loading: boolean;
  /** "ok" | "not-deployed" | "error" | "idle" */
  gateState: "ok" | "not-deployed" | "error" | "idle";
  errorMessage?: string | null;
  /** Called with subjectName; caller builds focus URL (D-02). */
  onSelectResult: (subjectName: string) => void;
}
```

---

### `src/pages/KnowledgeGraph.tsx` — host Search lens + community legend (additive)

**Analog:** Self — `paintNode` callback, `useFocusParam` wiring, `legendTypes` derived list, `buildFocusUrl`/`useNavigate` navigation pattern (lines 1–346).

**`useFocusParam` wiring** (lines 113–122) — copy pattern for result-click focus:
```typescript
// Existing (name-based):
const { fromParam } = useFocusParam({
  nodes: focusEntity ? kg.graph.nodes : undefined,
  getId: (n: KgNode) => n.name,
  onFocus: (node: KgNode) => {
    kg.selectNode(node.id);
    centerNodeWhenReady(fgRef, node as KgNode & { x?: number; y?: number });
  },
});
// Result-click handler uses buildFocusUrl + useNavigate (same as CodeVaultGraph):
const navigate = useNavigate(); // already imported L2
// On KGSearchResults onSelectResult:
function handleSearchResultClick(subjectName: string) {
  const url = buildFocusUrl(
    { surface: "knowledge-graph", entityName: subjectName, hops: 1 },
    window.location.pathname + window.location.search,
  );
  navigate(url);
}
```

**`buildFocusUrl` for knowledge-graph surface** (from `src/lib/focus-url.ts` lines 46–58):
```typescript
// Produces: /knowledge-graph?focus=<entityName>&lens=entity&hops=1&from=<encoded>
buildFocusUrl({ surface: "knowledge-graph", entityName: hit.subjectName, hops: 1 }, fromUrl)
```

**`paintNode` callback** (lines 128–172) — community halo insertion point:
```typescript
// Existing paintNode structure (KnowledgeGraph.tsx lines 128–172):
const paintNode = useCallback(
  (node, ctx, globalScale, opts) => {
    const n = node as KgNode & { x: number; y: number };
    const size = Math.max(n.val ?? 3, 3);
    const isSelected = n.id === selectedNodeId;
    ctx.globalAlpha = opts.dimmed ? 0.18 : 1;

    // 1. fill
    ctx.beginPath();
    ctx.arc(n.x, n.y, size, 0, 2 * Math.PI, false);
    ctx.shadowColor = n.color;
    ctx.shadowBlur = opts.hovered || isSelected ? 24 : 8;
    ctx.fillStyle = opts.hovered || isSelected ? "#ffffff" : n.color;
    ctx.fill();
    ctx.shadowBlur = 0;

    // ADD: community halo (between fill and selection ring, per UI-SPEC layer order)
    const haloColor = communityColor((n as any).community);
    if (haloColor) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 3, 0, 2 * Math.PI, false);
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = opts.dimmed ? 0.08 : 0.7;
      ctx.shadowColor = haloColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = opts.dimmed ? 0.18 : 1; // restore node alpha
    }

    // 2. selection ring (existing — unchanged)
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, size + 3, 0, 2 * Math.PI, false);
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // … label rendering continues unchanged
  },
  [selectedNodeId],
);
```

**`legendTypes` derived list** (lines 182–185) — community legend mirrors same `useMemo` + filter pattern:
```typescript
// Existing entity-type legend:
const legendTypes = useMemo(() => {
  const present = new Set(graph.nodes.map((n) => n.entityType));
  return ENTITY_TYPE_COLORS.filter((c) => present.has(c.type));
}, [graph.nodes]);

// Community legend (add alongside):
const presentCommunities = useMemo(() => {
  const ids = new Set<number>();
  for (const n of graph.nodes) {
    if ((n as any).community != null) ids.add((n as any).community as number);
  }
  return [...ids].sort((a, b) => a - b);
}, [graph.nodes]);
```

**Legend DOM pattern** (lines 254–283) — community legend appends after entity-type rows:
```typescript
// Existing legend container:
<div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-xs font-mono max-h-[60%] overflow-y-auto custom-scrollbar">
  {legendTypes.map((t) => (
    <span key={t.type} className="flex items-center gap-2 text-muted-foreground">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
      {t.type}
    </span>
  ))}
  {/* … current/superseded/contradiction rows … */}

  {/* ADD community section (auto-hide: only when presentCommunities.length > 0): */}
  {presentCommunities.length > 0 && (
    <>
      <span className="mt-1 border-t border-border pt-1 text-muted-foreground uppercase tracking-wide">
        Communities
      </span>
      {presentCommunities.map((c) => (
        <span key={c} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: communityColor(c) ?? "transparent" }}
          />
          Cluster {c}
        </span>
      ))}
    </>
  )}
</div>
```

**Search lens layout fork** (lines 250–326) — Search lens renders `KGSearchResults` in the 1fr left pane:
```typescript
// Existing graph+details grid:
<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
  <div className="relative">
    {/* ForceGraphCanvas or loading/empty state */}
  </div>
  <KGDetailsPanel … />
</div>
// Search lens fork: left pane = KGSearchResults (results-only, no canvas in Search):
{lens === "search" ? (
  <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
    <SectionErrorBoundary name="KG Search Results">
      <KGSearchResults
        results={searchResults}
        query={filters.searchQuery ?? ""}
        loading={searchLoading}
        gateState={searchGateState}
        onSelectResult={handleSearchResultClick}
      />
    </SectionErrorBoundary>
    <KGDetailsPanel … />
  </div>
) : (
  // existing graph+details layout
)}
```

**Inbound focus override effect** (lines 87–109) — pattern for applying `?lens=entity` after search result-click:
```typescript
// Existing one-shot effect guards idb hydration before overriding lens/filter:
useEffect(() => {
  if (!focusEntity) return;
  if (appliedFocusRef.current) return;
  if (!hydrated) return;
  appliedFocusRef.current = true;
  if (lensParam === "entity") setLens("entity");
  setFilter("entityName", focusEntity);
  const parsedHops = Math.max(1, Math.min(6, Math.floor(Number(hopsParam)) || 1));
  setFilter("hops", parsedHops);
}, [focusEntity, lensParam, hopsParam, hydrated, setLens, setFilter]);
// buildFocusUrl({ surface: "knowledge-graph", entityName, hops: 1 }) produces
// ?focus=<name>&lens=entity&hops=1 — the existing lensParam === "entity" branch
// handles the switch from "search" to "entity" automatically.
```

---

### `src/hooks/useKnowledgeGraph.ts` — extend `KgLens`, `KgFilters`, search fetch branch (additive)

**Analog:** Self — lens switch/persist/fetch pattern (lines 21–287).

**`KgLens` union type** (line 21) — add `"search"`:
```typescript
// Existing:
export type KgLens = "overview" | "entity" | "temporal" | "contradiction";
// Modified:
export type KgLens = "overview" | "entity" | "temporal" | "contradiction" | "search";
```

**`KgFilters` interface** (lines 23–34) — add `searchQuery`:
```typescript
export interface KgFilters {
  entityType: string | null;
  predicate: string | null;
  agentId: string | null;
  entityName: string;
  hops: number;
  asOf: string | null;
  limit: number;
  searchQuery: string;  // ADD: ephemeral, not persisted to idb (RESEARCH Pitfall 6)
}
const DEFAULT_FILTERS: KgFilters = {
  …
  searchQuery: "",  // ADD
};
```

**idb persist pattern** (lines 139–143) — `searchQuery` excluded from persist (per RESEARCH open question 3):
```typescript
// Existing persist writes full `filters` object; after adding searchQuery,
// strip it before writing to avoid persisting ephemeral state:
useEffect(() => {
  if (!hydrated) return;
  const { searchQuery: _sq, ...persistableFilters } = filters;
  idbSet(PERSIST_KEY, { lens, filters: persistableFilters } as PersistedState).catch(() => {});
}, [lens, filters, hydrated]);
// Also: do not restore "search" lens from idb (non-persisted), or validate
// on hydration: if saved.lens === "search", fall back to "overview".
```

**Per-lens fetch branch** (lines 169–231) — add `"search"` branch alongside existing ones:
```typescript
// Existing branch structure:
if (lens === "overview" || lens === "temporal") {
  …
} else if (lens === "entity") {
  if (!entityName.trim()) { next = EMPTY_GRAPH; }
  else { … }
} else if (lens === "contradiction") {
  …
}
// ADD search branch (same try/catch wrapper, same token guard):
} else if (lens === "search") {
  if (!filters.searchQuery.trim()) {
    next = EMPTY_GRAPH; // no-fetch on empty query (idle state)
  } else {
    // fetchSearch handled separately — gateState managed, not rawGraph error
    // Recommendation: manage search results in separate useState, not rawGraph,
    // so search results and the graph state don't collide.
  }
}
```

**`setLens` callback** (lines 145–149) — `"search"` switch clears selection (existing behavior, unchanged):
```typescript
const setLens = useCallback((l: KgLens) => {
  setLensState(l);
  setSelectedNodeId(null);
  setSelectedEdgeId(null);
}, []);
```

**Monotonic request token pattern** (lines 113–115, 165–167) — search fetch should use same token guard:
```typescript
const reqRef = useRef(0);
// In the search fetch: const token = ++reqRef.current;
// Check if (!cancelled && token === reqRef.current) before setState calls.
```

---

### `src/components/graph/CodeVaultGraph.tsx` — consume ForceGraphCanvas clustering (additive)

**Analog:** Self — existing `community` read-only display (lines 562–568) + `ForceGraphCanvas` usage pattern.

**Existing community read** (lines 562–568) — already displays `community` in the detail panel:
```typescript
{/* 5. community */}
<div>
  <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest mb-0.5">community</p>
  <p className="text-sm text-muted-foreground">
    community: {selectedNode.community ?? "—"}
  </p>
</div>
```

**`ForceGraphCanvas` usage** (existing call site in CodeVaultGraph) — add `clusterForce` prop:
```typescript
// Existing ForceGraphCanvas usage in CodeVaultGraph (find by Grep for <ForceGraphCanvas):
<ForceGraphCanvas
  ref={fgRef}
  data={filteredGraph}
  colorFn={colorFn}
  labelFn={labelFn}
  …
  // ADD:
  clusterForce={true}
  // The canvas gates the force internally on nodes.some(n => n.community != null).
/>
```

**Node paint halo in CodeVaultGraph** — if CodeVaultGraph uses `ForceGraphCanvas`'s default `paintNode` (no custom paint prop), the halo should be drawn by a custom `paintNode` prop added here, following the same pattern as `KnowledgeGraph.tsx paintNode` (import `communityColor` from `kg-graph.ts`). Alternatively, if `ForceGraphCanvas` accepts an `onCommunityColor?: (node: any) => string | null` prop and draws the halo in `defaultPaint`, the CodeVaultGraph gets halo for free. **Recommendation:** implement as a shared `paintNode` helper or add halo into `defaultPaint` inside `ForceGraphCanvas` when `communityColor(node.community)` is non-null, so both KG and CodeVaultGraph benefit without duplicating canvas draw code.

---

## Shared Patterns

### Authentication (applies to `kgApi.ts` fetchSearch)
**Source:** `src/lib/astridrApi.ts` lines 117–121
```typescript
export function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (ASTRIDR_API_KEY) h["Authorization"] = `Bearer ${ASTRIDR_API_KEY}`;
  return h;
}
```
**Apply to:** `fetchSearch()` via `kgGet()` (already calls `authHeaders()` at `kgApi.ts:123`).

### Error handling / graceful degrade (applies to `kgApi.ts`, `KGSearchResults`, `useKnowledgeGraph`)
**Source:** `src/lib/astridrApi.ts` lines 107–115 (`AstridrApiError` class)
```typescript
export class AstridrApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AstridrApiError";
    this.status = status;
  }
}
```
**Pattern:** Catch `AstridrApiError`; branch on `e.status === 404 || e.status === 501` → informational copy (not error state). All other errors → error banner. Network failures propagate as-is.

### Focus URL construction (applies to `KnowledgeGraph.tsx` result-click, `KGSearchResults`)
**Source:** `src/lib/focus-url.ts` lines 46–58
```typescript
export function buildFocusUrl(target: FocusTarget, fromUrl?: string): string {
  // For knowledge-graph result-click:
  // buildFocusUrl({ surface: "knowledge-graph", entityName: hit.subjectName, hops: 1 }, fromUrl)
  // → /knowledge-graph?focus=<name>&lens=entity&hops=1&from=<encoded>
}
```
**Apply to:** `handleSearchResultClick` in `KnowledgeGraph.tsx`.

### Section error boundary (applies to all new JSX sections)
**Source:** `src/pages/KnowledgeGraph.tsx` lines 207–224 (`SectionErrorBoundary` usage)
```typescript
<SectionErrorBoundary name="KG Search Results">
  <KGSearchResults … />
</SectionErrorBoundary>
```
**Apply to:** All new JSX sections in `KnowledgeGraph.tsx`.

### idb persistence pattern (applies to `useKnowledgeGraph.ts`)
**Source:** `src/hooks/useKnowledgeGraph.ts` lines 118–143
- Hydrate once on mount via `useEffect` + `idbGet`.
- Persist on `lens`/`filters` change after hydration via `useEffect` + `idbSet`.
- Volatile state (`searchQuery`) excluded from the persisted object.

### `forwardRef` + `useImperativeHandle` pattern (applies to `ForceGraphCanvas.tsx`)
**Source:** `src/components/graph/ForceGraphCanvas.tsx` lines 70–100
```typescript
export const ForceGraphCanvas = forwardRef<ForceGraphHandle, ForceGraphCanvasProps>(
  function ForceGraphCanvas(props, ref) {
    const fgRef = useRef<any>(null);
    useImperativeHandle(ref, () => ({
      centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
      // ... extend with d3Force + d3ReheatSimulation
    }));
  }
);
```

---

## No Analog Found

All 8 files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns alone.

| File | Role | Data Flow | Notes |
|------|------|-----------|-------|
| `src/components/kg/KGSearchResults.tsx` (NEW) | component | request-response | No exact search-results panel exists; closest is `KGDetailsPanel.tsx` (panel shell + row pattern) + `KnowledgeGraph.tsx` (loading/error/empty state copy). Both analogs verified from live source. |

---

## Metadata

**Analog search scope:** `src/lib/`, `src/components/kg/`, `src/components/graph/`, `src/hooks/`, `src/pages/`, `src/lib/focus-url.ts`, `src/lib/astridrApi.ts`
**Files scanned:** 10 source files read in full
**Pattern extraction date:** 2026-06-23

**Key verified facts from live source:**
- `kgApi.ts:111–133` — exact `kgGet` helper (internal, not exported)
- `kg-graph.ts:101–137` — exact `ENTITY_TYPE_COLORS` + `entityTypeColor` pattern
- `ForceGraphCanvas.tsx:28–32` — exact `ForceGraphHandle` interface (3 members today)
- `ForceGraphCanvas.tsx:96–100` — exact `useImperativeHandle` block
- `ForceGraphCanvas.tsx:141–153` — exact `paint` delegator
- `KGControls.tsx:15–20` — exact `LENSES` array (4 entries)
- `KGControls.tsx:82–107` — exact lens-gated entity input block
- `useKnowledgeGraph.ts:21` — exact `KgLens` union (4 values)
- `useKnowledgeGraph.ts:23–34` — exact `KgFilters` interface
- `KnowledgeGraph.tsx:113–122` — exact `useFocusParam` call
- `KnowledgeGraph.tsx:128–172` — exact `paintNode` callback with layer order
- `KnowledgeGraph.tsx:182–185` — exact `legendTypes` useMemo
- `KnowledgeGraph.tsx:254–283` — exact legend DOM structure
- `CodeVaultGraph.tsx:562–568` — exact `community` display block
- `focus-url.ts:46–58` — exact `buildFocusUrl` signature + knowledge-graph case
- `useFocusParam.ts:39–71` — exact hook signature + one-shot guard
- `astridrApi.ts:107–121` — exact `AstridrApiError` class + `authHeaders()`
