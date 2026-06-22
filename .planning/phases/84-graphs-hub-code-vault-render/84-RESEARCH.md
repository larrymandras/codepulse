# Phase 84: Graphs Hub + Code/Vault Render — Research

**Researched:** 2026-06-22
**Domain:** React SPA — Convex data consumer, force-directed graph rendering, page composition
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `/graphs` = hub index with code/vault graph as inline hero. Existing standalone routes (`/tool-galaxy`, `/mcp-inventory`, `/knowledge-graph`, `/capabilities`) are untouched. Flip the `placeholder:true` "Graphs Hub" nav entry in `DashboardLayout.tsx` GRAPHS group (~L156) to `to: "/graphs"`.
- **D-02:** Live summary tiles for the other three surfaces — MetricCard with live metrics from existing hooks (Tool Galaxy → toolCount + orphanCount via `useToolGalaxySources`; MCP Inventory → serverCount + errorCount via `useMcpHealthSources`; KG Explorer → entities/triples via `useKgSummary`) + click-through navigation.
- **D-03:** Layout = compact summary-tile row on top, large full-width code/vault graph below, with an expand-to-fullscreen affordance. No separate `/graphs/code-vault` route.
- **D-04:** Primary node color encoding = by source (code vs vault). `type` and `community` are NOT the primary encoding this phase.
- **D-05:** Dual "Matrix" palette — Emerald `#10b981` for **code**, Violet `#8b5cf6` for **vault** (finalized in UI-SPEC).
- **D-06:** Source filter = Code / Vault / Both toggle chips, client-side (no reload).
- **D-07:** Truncation indicator = summary line ("X of Y nodes") + per-source chips from `sources[]`, with "truncated" badge when `source.truncated === true`.
- **D-08:** Integrity signal (dangling links dropped) shown only when `storedNodeCount < nodeCount` OR `storedLinkCount < linkCount`. Silent when they match.
- **D-09:** Freshness = relative time + amber "stale" badge when older than **36h** from `generatedAt`.
- **D-10:** Node click = side detail panel (id/label/type/source/community + direct neighbors). No cross-graph deep-links (Phase 85).
- **D-11:** Hover tooltip = `"{node.label} · {node.type} · {node.source}"` via `labelFn`.
- **D-12:** Empty/null state = explainer UI when `getProjectGraph` returns `null`; summary tiles still render independently.

### Claude's Discretion

- Loading state (skeleton/spinner for hero while query loads).
- Exact contrasting vault hue (resolved: `#8b5cf6` in UI-SPEC D-05).
- Stale threshold (resolved: 36h, constant `STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000` in `CodeVaultGraph.tsx`).
- Tile metric phrasing (resolved in UI-SPEC: `{toolCount} tools · {orphanCount} orphans`, etc.).
- Detail panel field ordering (resolved in UI-SPEC: id, label, type, source, community, neighbors).
- `useProjectGraph` hook shape.
- Whether hero reuses `ObsidianGraph` directly or composes `ForceGraphCanvas` fresh — resolved: new `CodeVaultGraph` component with `ForceGraphCanvas` directly.

### Deferred Ideas (OUT OF SCOPE)

- Cross-graph deep-linking from the detail panel (Phase 85 / GH-04).
- Community/cluster-aware layout and coloring (Phase 86 / KG-09).
- Lightweight in-graph node-name find/focus box (Phase 86 / KG-08).
- Mini-graph preview thumbnails on tiles.
- A dedicated `/graphs/code-vault` route (replaced by fullscreen affordance).
- Temporal diff/animation, saved named views (Phase 87).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GH-02 | `/graphs` landing route renders the pushed code (graphify) + vault (Obsidian) graph from Convex via `useQuery`, reusing `ForceGraphCanvas`, with truncation explicitly indicated when caps are hit | Phase 83 `getProjectGraph` query confirmed (convex/graphSnapshots.ts:236); `ForceGraphCanvas` props contract confirmed (src/components/graph/ForceGraphCanvas.tsx); truncation signaling via `sources[].truncated` confirmed in schema |
| GH-03 | KG Explorer, Tool Galaxy, MCP Inventory, and the code/vault graph are all reachable from one unified Graphs hub with consistent interactions, replaces the `placeholder:true` "Graphs Hub" nav stub | Placeholder location confirmed at DashboardLayout.tsx:156; new-page pattern confirmed via HivePage; hook sources for live tile counts confirmed |
</phase_requirements>

---

## Summary

Phase 84 is a pure CodePulse frontend phase — no backend work, no new packages. Phase 83 (GH-01) shipped a complete Convex receiver (`convex/graphSnapshots.ts`) with a public `getProjectGraph` query that returns exactly the shape the UI needs: `{ snapshotId, sources[], nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes[{id,label,type,community,source}], links[{source,target,relation}] }` or `null`. The `ForceGraphCanvas` component is already a generic callback-driven wrapper that accepts `data:{nodes,links}`, `colorFn`, `labelFn`, `paintNode`, `linkColorFn`, and `onNodeClick` — every domain encoding for the dual-palette code/vault render is passed via these callbacks with no changes to the canvas itself.

The three existing graph surfaces (Tool Galaxy, MCP Inventory, KG Explorer) each have live hooks (`useToolGalaxySources`, `useMcpHealthSources`, `useKgSummary`) that expose the metrics the summary tiles need. The nav system uses a single `placeholder: true` flag to suppress a route; removing that flag and adding `to: "/graphs"` auto-registers the route in the CommandPalette. The established new-page pattern (HivePage) shows exactly the composition: a page file in `src/pages/` → a lazy `<Route>` in `App.tsx` → flip the nav entry.

The three significant net-new pieces are: (1) `useProjectGraph` hook wrapping `api.graphSnapshots.getProjectGraph`, (2) `CodeVaultGraph` component owning the dual-palette + source filter + detail panel + fullscreen toggle over `ForceGraphCanvas`, and (3) `GraphsHub` page composing the tile row and the hero. All UI patterns (legend, loading state, empty state, error banner, detail panel layout, filter chips) have direct precedents in `KnowledgeGraph.tsx` and `ToolGalaxy.tsx`.

**Primary recommendation:** Build in three logical layers — hook, graph component, page — following the HivePage/KnowledgeGraph composition pattern. Everything required exists; this is assembly work with well-defined seams.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Snapshot data storage + versioning | Database (Convex) | — | Phase 83 complete; `graphSnapshotNodes`/`graphSnapshotLinks`/`graphSnapshots` tables own this |
| Read query for UI consumption | API / Backend (Convex query) | — | `getProjectGraph` is a public Convex query; no Clerk gating |
| Graph rendering + interaction | Frontend / Browser | — | `ForceGraphCanvas` is a React canvas component; all encoding is client-side |
| Source filter (Code/Vault/Both) | Frontend / Browser | — | Client-side `useState` filter on the already-loaded bounded payload; no query reload |
| Freshness/truncation metadata | Frontend / Browser | — | Derived from `generatedAt`, `nodeCount`, `sources[]` returned by the query |
| Nav registration | Frontend / Browser (DashboardLayout) | — | One flag flip; auto-propagates to CommandPalette |
| Summary tile live counts | Frontend / Browser (existing hooks) | Convex (existing queries) | `useToolGalaxySources`/`useMcpHealthSources`/`useKgSummary` already subscribe to Convex |

---

## Standard Stack

### Core (all pre-installed — zero new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-force-graph-2d` | installed (via `ForceGraphCanvas`) | Force-directed graph rendering | Already in use; `ForceGraphCanvas` wraps it |
| `convex/react` | installed | `useQuery(api.graphSnapshots.getProjectGraph)` | Project-wide Convex data layer |
| `lucide-react` | installed | Icons (Network, Maximize2, Minimize2, AlertTriangle, Info, X) | CLAUDE.md mandate — Lucide only |
| shadcn/ui `Badge`, `Button`, `Tooltip`, `ScrollArea` | installed (New York preset) | Truncation chips, filter chips, fullscreen button, neighbor scroll | All 30 primitives confirmed present in `src/components/ui/` |
| `motion/react` | installed | `GlassPanel` entry animation | Used by existing GlassPanel component |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` + `vitest` | installed | Component unit tests | Phase test coverage |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Composing `ForceGraphCanvas` directly in `CodeVaultGraph` | Wrapping `ObsidianGraph` | `ObsidianGraph` uses a different palette (neon cyberpunk), group-based coloring, and `node.group` field. The Phase 83 nodes use `node.source` not `node.group`. Composing `ForceGraphCanvas` directly is cleaner. |
| New `CodeVaultGraph` component | Inlining all logic in `GraphsHub.tsx` | The detail panel + filter state + fullscreen toggle is substantial enough (~200 lines) to deserve its own component; keeps the page thin (HivePage pattern). |

**Installation:** No new packages. Zero install step.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All dependencies are pre-existing in the project.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Convex DB (graphSnapshots/Nodes/Links)
        │
        │  useQuery(api.graphSnapshots.getProjectGraph)
        ▼
useProjectGraph hook  ─── returns null (loading) | null (no snapshot) | ProjectGraphData
        │
        ▼
CodeVaultGraph component
  ├── source filter state (Code|Vault|Both) ──── filters nodes/links client-side
  ├── selectedNodeId state ────────────────────── drives detail panel
  ├── fullscreen state ────────────────────────── drives container class switch
  ├── colorFn(node) ───── source === "vault:*" → #8b5cf6, else → #10b981
  ├── labelFn(node) ───── "{label} · {type} · {source}"
  ├── linkColorFn(link) ─ cross-source → dim white, same-source → source color at 0.18 alpha
  ├── onNodeClick(node) ── setSelectedNodeId
  ├── ForceGraphCanvas [h-[600px] or h-screen]
  │       └── react-force-graph-2d (canvas render)
  ├── Legend (absolute overlay)
  ├── Header row (truncation chips + freshness badge + filter chips + fullscreen btn)
  └── Detail panel (w-[320px]) when selectedNodeId set
        ├── id, label, type, source pill, community, direct neighbors list
        └── close X (aria-label="Close node details")

GraphsHub page
  ├── Page header (GRAPHS HUB label + Network icon + InfoTooltip)
  ├── Summary tile row [grid grid-cols-1 md:grid-cols-3 gap-4]
  │   ├── SectionErrorBoundary → MetricCard (Tool Galaxy, onClick→/tool-galaxy)
  │   ├── SectionErrorBoundary → MetricCard (MCP Inventory, onClick→/mcp-inventory)
  │   └── SectionErrorBoundary → MetricCard (KG Explorer, onClick→/knowledge-graph)
  └── SectionErrorBoundary → GlassPanel → CodeVaultGraph
```

### Recommended Project Structure

```
src/
├── pages/
│   └── GraphsHub.tsx            # new — route page, thin composition
├── components/graph/
│   └── CodeVaultGraph.tsx       # new — dual-palette hero (colorFn, filter, detail panel, fullscreen)
└── hooks/
    └── useProjectGraph.ts       # new — wraps useQuery(api.graphSnapshots.getProjectGraph)
```

No new directories needed. All three files slot into existing structure.

### Pattern 1: New Page Registration (from HivePage)

**What:** page file + lazy route + nav entry flip
**When to use:** Every new top-level route in this project

```tsx
// App.tsx — add alongside sibling graph routes (~L58-59)
const GraphsHub = lazy(() => import("./pages/GraphsHub"));

// Inside <Routes> (~L123)
{/* Phase 84: Graphs Hub */}
<Route path="/graphs" element={
  <Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Graphs Hub...</div>}>
    <GraphsHub />
  </Suspense>
} />
```

```ts
// DashboardLayout.tsx — GRAPHS group (~L156), flip placeholder
// Before:
{ label: "Graphs Hub", icon: "network", group: "GRAPHS", placeholder: true }
// After:
{ to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" }
```

The `navItems` auto-exclude checks `placeholder: true` (DashboardLayout.tsx:208-209) — removing it auto-registers the route for CommandPalette. `"network"` → `Network` is already in `iconComponents` at DashboardLayout.tsx:105. [VERIFIED: codebase read]

### Pattern 2: `useProjectGraph` hook shape

**What:** Thin Convex query wrapper returning `null` for both loading and empty states (D-12)
**When to use:** Everywhere the code/vault snapshot data is needed

```ts
// src/hooks/useProjectGraph.ts
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type ProjectGraphData = NonNullable<
  ReturnType<typeof useQuery<typeof api.graphSnapshots.getProjectGraph>>
>;

/**
 * Wraps getProjectGraph. Returns:
 *   undefined  — Convex still loading (first render before subscription resolves)
 *   null       — no snapshot ingested yet (graceful-skip)
 *   object     — live snapshot data
 *
 * CodeVaultGraph maps both undefined and null to the explainer / loading states;
 * callers that only care about "has data vs not" can treat undefined as null.
 */
export function useProjectGraph(snapshotId?: string) {
  return useQuery(api.graphSnapshots.getProjectGraph,
    snapshotId ? { snapshotId } : {}
  );
}
```

Note: Convex `useQuery` returns `undefined` while loading and then the query result. For `getProjectGraph` the result is `null` (no snapshot) or the data object. The hook should NOT coerce `undefined` → `null` prematurely — `CodeVaultGraph` needs to distinguish loading (`undefined`) from empty (`null`) to show the correct UI state (loading pulse vs explainer). [VERIFIED: codebase read — KnowledgeGraph.tsx:217-238 pattern]

### Pattern 3: Source-aware colorFn for `ForceGraphCanvas`

**What:** Derive source family from `node.source` prefix; return dual-palette color
**When to use:** `colorFn` prop passed to `ForceGraphCanvas` inside `CodeVaultGraph`

```ts
// Source: 84-CONTEXT.md D-04/D-05 + 84-UI-SPEC.md Color section
const CODE_COLOR = "#10b981";  // Matrix Emerald — graphify:* nodes
const VAULT_COLOR = "#8b5cf6"; // Violet-500 — vault:* nodes

function colorFn(node: any): string {
  return node.source?.startsWith("vault:") ? VAULT_COLOR : CODE_COLOR;
}
```

Node ids arrive pre-namespaced (`graphify:<repo>:<path>` or `vault:<note-path>`) per Phase 83 D-05. The `node.source` field is set at ingest time; derive the family from `node.source.startsWith("vault:")`, not from parsing the `id`. [VERIFIED: convex/graphSnapshots.ts:268 — nodes mapped with `source: n.source`]

### Pattern 4: Client-side source filter (from GAL-04)

**What:** Toggle state that filters the already-loaded bounded payload — no Convex query re-issue
**When to use:** Code/Vault/Both chips (D-06)

```ts
// Inside CodeVaultGraph
type SourceFilter = "code" | "vault" | "both";
const [sourceFilter, setSourceFilter] = useState<SourceFilter>("both");

const filteredData = useMemo(() => {
  if (!snapshot || sourceFilter === "both") {
    return { nodes: snapshot?.nodes ?? [], links: snapshot?.links ?? [] };
  }
  const keep = sourceFilter === "code"
    ? (s: string) => !s.startsWith("vault:")
    : (s: string) => s.startsWith("vault:");
  const keptNodes = snapshot.nodes.filter(n => keep(n.source));
  const keptIds = new Set(keptNodes.map(n => n.id));
  const keptLinks = snapshot.links.filter(
    l => keptIds.has(l.source) && keptIds.has(l.target)
  );
  return { nodes: keptNodes, links: keptLinks };
}, [snapshot, sourceFilter]);
```

This mirrors `ToolGalaxy.tsx` GAL-04 pattern exactly — the payload from `getProjectGraph` is already bounded (Phase 83 node cap), so client filtering is O(n) with no reload. [VERIFIED: codebase read]

### Pattern 5: Detail panel layout (from KnowledgeGraph.tsx:183)

```tsx
// The grid-split: graph left, panel right
<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
  <div className="relative">
    {/* Legend overlay + ForceGraphCanvas */}
  </div>
  {/* Detail panel */}
  <div className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 h-full overflow-y-auto">
    {selectedNodeId ? <NodeDetailContent /> : (
      <p className="text-xs font-mono text-muted-foreground text-center">
        Select a node to inspect
      </p>
    )}
  </div>
</div>
```

[VERIFIED: src/pages/KnowledgeGraph.tsx:182-183]

### Pattern 6: Fullscreen affordance

No existing precedent in the codebase — this is net-new behavior. The pattern from the UI-SPEC is a boolean toggle that switches the container from flow layout to `fixed inset-0 z-50 bg-[#09090b]`. Key considerations:

- `fixed inset-0 z-50` removes the component from layout flow completely; parent `overflow-hidden` on `<main>` does not clip it.
- ESC key handler must be attached in a `useEffect` that cleans up on unmount.
- Canvas height switches from `h-[600px]` to `h-screen` minus the 48px toolbar strip.
- No route change; the URL stays `/graphs` throughout.

### Anti-Patterns to Avoid

- **Reusing `ObsidianGraph` for the code/vault render:** `ObsidianGraph` uses `node.group` for color mapping via `groupColors` Map. Phase 83 nodes use `node.source`, not `node.group`. Wrapping `ObsidianGraph` would require shimming field names — just use `ForceGraphCanvas` directly with the correct `colorFn`.
- **Coercing `useQuery` `undefined` to `null` in the hook:** Convex's `undefined` (still loading) and `null` (loaded, no data) carry different UI meaning. The hook should return the raw Convex result; let `CodeVaultGraph` branch on all three states.
- **Filtering nodes without also filtering links:** Client-side source filter must drop links whose `source` or `target` node is no longer in the filtered set. Dangling links cause `react-force-graph-2d` to emit console errors and render phantom node positions.
- **Calling `ForceGraphCanvas` without a stable `data` reference:** If `filteredData` is computed inline (not memoized), the force simulation restarts on every render. Always wrap in `useMemo`.
- **Mutating node objects for the filter:** `react-force-graph-2d` mutates node objects (adds `x`/`y` at runtime). Do not clone or recreate node objects mid-simulation. Filter by building a new array of references, not new objects.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-directed layout | Custom physics loop | `ForceGraphCanvas` → `react-force-graph-2d` | Handles D3 force simulation, zoom, pan, hover, click-to-center, canvas scaling — ~1,000 lines of battle-tested code |
| Relative time formatting | Custom date math | `Date.now()` arithmetic + manual string (this codebase has no shared `formatRelativeTime` util — check before introducing one) | The freshness string is a single expression: `"{N}h ago"` derived from `(Date.now() - generatedAt * 1000) / 3600000` |
| Node selection ring | Custom canvas drawing | Extend the existing `defaultPaint` in `ForceGraphCanvas` via `paintNode` callback | `paintNode` already receives `{hovered, dimmed}` — add `isSelected` via closure over `selectedNodeId` state |
| Glass card surfaces | Custom CSS | `GlassPanel` from `src/components/GlassPanel.tsx` | Project standard; handles dark-mode glassmorphism tokens and entry animation |
| Animated metric counts | Custom spring | `MetricCard` with `numericValue` prop → `AnimatedNumber` | Already uses `motion/react` spring internally |

**Key insight:** Every surface primitive (GlassPanel, MetricCard, Badge, ForceGraphCanvas, SectionErrorBoundary) is pre-built. Phase 84 is composition, not construction.

---

## Common Pitfalls

### Pitfall 1: MetricCard tile metric derivation mismatch

**What goes wrong:** The tile copy in the UI-SPEC says `"{toolCount} tools · {orphanCount} orphans"` but `useToolGalaxySources` returns raw `tools[]`, `mcpServers[]`, `edges[]`, `kits[]` arrays — not pre-computed counts. The `buildGalaxy()` function in `src/lib/tool-galaxy.ts` derives `stats.toolCount`, `stats.orphanCount`, `stats.serverCount`, etc.

**Why it happens:** The hooks expose raw data for the full galaxy render; the stats are computed inside `GalaxyCanvas` via `useMemo` → `buildGalaxy()`.

**How to avoid:** The summary tiles do NOT need to call `buildGalaxy()`. Derive counts directly:
- Tool Galaxy: `toolCount = tools.length` (all discovered tools), `orphanCount = tools.filter(t => !edges.some(e => e.toolName === t.name)).length` (approximation) — OR call `buildGalaxy({ tools, mcpServers, edges, kits, agentFilter: null, mcpFilter: null, now: Date.now()/1000 }).stats` for the authoritative count. The latter is simpler.
- MCP Inventory: `serverCount = mcpServers.length`, `errorCount` from `buildMcpHealth()` in `src/lib/mcp-health.ts` — OR just use `mcpServers.length` and `mcpServers.filter(s => s.status === 'error').length` if the lib types expose `status`.
- KG Explorer: `useKgSummary()` returns `summary.totalEntities` and `summary.currentTripleCount` directly — no extra computation.

**Warning signs:** Tile shows `0` for all metrics even when data is present; or counts differ from what the full page shows.

### Pitfall 2: `getProjectGraph` returns nodes without `x`/`y` — simulation must warm up

**What goes wrong:** On first render, the force simulation starts with all nodes at position `(0, 0)`. For large graphs (hundreds of nodes), there is a visible "explosion" as the simulation runs its 120 cooldown ticks. This is expected behavior — not a bug.

**Why it happens:** `react-force-graph-2d` initializes node positions to random or zero and runs the D3 force simulation until `cooldownTicks` is exhausted. ForceGraphCanvas is already configured with `cooldownTicks={120}` and `d3VelocityDecay={0.3}` — do not change these.

**How to avoid:** Accept the warmup. The existing `zoomToFit` on the `ForceGraphHandle` ref can be called after the simulation cools to center the view: wire `onEngineStop` → `fgRef.current?.zoomToFit(400)` if centering is desired (KnowledgeGraph.tsx does not do this, but ToolGalaxy does).

**Warning signs:** Graph nodes all start stacked then explode outward — this is normal, not a data problem.

### Pitfall 3: `sources[]` label parsing

**What goes wrong:** The `source.source` field in `sources[]` (from the Phase 83 schema) is the raw string like `"graphify:codepulse:"` or `"vault:"`. The UI-SPEC says to derive the display label by stripping the prefix.

**Why it happens:** The producer emits the full namespaced source identifier. The UI-SPEC specifies: strip `graphify:` → use the repo name portion; strip `vault:` → display `"vault"`.

**How to avoid:**
```ts
function sourceLabel(source: string): string {
  if (source.startsWith("graphify:")) {
    // "graphify:codepulse:" → "codepulse"
    return source.split(":")[1] ?? source;
  }
  if (source.startsWith("vault:")) return "vault";
  return source;
}
```
[VERIFIED: 84-CONTEXT.md "Specifics" + convex/graphSnapshots.ts `sources[]` schema]

### Pitfall 4: `generatedAt` is a float64 Unix timestamp (seconds), not milliseconds

**What goes wrong:** `Date.now()` returns milliseconds; `generatedAt` from `getProjectGraph` is a Unix timestamp in **seconds** (float64). Computing freshness as `Date.now() - generatedAt` gives a value in the billions, not hours.

**Why it happens:** The Phase 83 schema stores `generatedAt: v.float64()` as a Unix epoch in seconds (per standard Ástríðr telemetry convention).

**How to avoid:** Always multiply `generatedAt * 1000` before comparing to `Date.now()`:
```ts
const ageMs = Date.now() - snapshot.generatedAt * 1000;
const ageHours = ageMs / (1000 * 60 * 60);
const isStale = ageMs > STALE_THRESHOLD_MS; // 36 * 60 * 60 * 1000
```
[VERIFIED: convex/graphSnapshots.ts:82 — `generatedAt: v.float64()` + upsertGraphSnapshot args]

### Pitfall 5: ESC key handler for fullscreen must not conflict with existing handlers

**What goes wrong:** `DashboardLayout.tsx` already has a global `keydown` handler (L589-617) that handles ESC → `setSidebarOpen(false)`. Adding another global ESC handler in `CodeVaultGraph` will fire both.

**Why it happens:** Multiple `addEventListener("keydown", ...)` on `window` both fire for the same event.

**How to avoid:** Either (a) use `e.stopPropagation()` in the `CodeVaultGraph` ESC handler — but this is fragile — or (b) simply let both fire; the sidebar close is a no-op when the sidebar is already closed. On mobile, if the sidebar is open AND the graph is fullscreen, ESC will both exit fullscreen and close the sidebar — an acceptable edge case.

**Warning signs:** ESC in fullscreen mode also closes other overlays unexpectedly.

### Pitfall 6: `ForceGraphCanvas` default `className` vs. explicit className for fullscreen

**What goes wrong:** `ForceGraphCanvas` has a default `className` that includes `h-[600px]` (L153-156). When fullscreen mode is toggled, the height must switch to `h-screen`. If `className` is not passed explicitly, the default always applies.

**Why it happens:** The default is: `"relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"`. This is applied when `className` is undefined.

**How to avoid:** Always pass `className` explicitly from `CodeVaultGraph`, derived from `fullscreen` state:
```ts
const canvasClass = fullscreen
  ? "relative w-full h-[calc(100vh-48px)] overflow-hidden bg-[#09090b]"
  : "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]";
```

---

## Code Examples

### getProjectGraph return shape (confirmed from source)

```ts
// Source: convex/graphSnapshots.ts:260-281
{
  snapshotId:      string,           // "astridr-project-graph"
  sources: Array<{
    source:           string,        // "graphify:codepulse:" | "vault:"
    kind:             string,        // "graphify" | "vault"
    nodeCount:        number,        // total nodes in the source (pre-cap)
    linkCount:        number,        // total links in the source
    emittedNodeCount: number,        // nodes emitted after producer cap
    emittedLinkCount: number,
    truncated:        boolean,       // true when producer cap was hit
  }>,
  nodeCount:       number,           // producer-reported total (for "X of Y" display)
  linkCount:       number,
  storedNodeCount: number,           // actual rows stored (after dangling-link drop)
  storedLinkCount: number,
  generatedAt:     number,           // Unix seconds (float64)
  nodes: Array<{
    id:        string,               // pre-namespaced: "graphify:codepulse:src/..." | "vault:..."
    label:     string,
    type:      string,               // "file" | "function" | "class" | "note" | etc.
    community: number | null | undefined,
    source:    string,               // same prefix as id namespace
  }>,
  links: Array<{
    source:   string,                // node id
    target:   string,                // node id
    relation: string,                // "imports" | "calls" | "links_to" | etc.
  }>,
}
```

### Truncation header render

```tsx
// Source: 84-UI-SPEC.md + 84-CONTEXT.md D-07
<div className="flex items-center gap-2 flex-wrap text-xs font-mono text-muted-foreground">
  <span>Showing {displayedNodeCount} of {snapshot.nodeCount} nodes</span>
  {snapshot.sources.map(src => (
    <span key={src.source} className="flex items-center gap-1">
      <span className="border border-border rounded-sm px-1.5 py-0.5">
        {sourceLabel(src.source)}: {src.emittedNodeCount} / {src.nodeCount}
      </span>
      {src.truncated && (
        <Badge variant="outline" className="text-amber-400 border-amber-400/30 text-[10px]">
          truncated
        </Badge>
      )}
    </span>
  ))}
</div>
```

### Loading and empty states (mirrors KnowledgeGraph.tsx:217-238)

```tsx
// Loading (Convex undefined — before first response)
{snapshot === undefined && (
  <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
    <p className="text-primary/70 font-mono text-sm animate-pulse">Loading graph snapshot…</p>
  </div>
)}

// Empty (null — no snapshot ingested yet, D-12)
{snapshot === null && (
  <div className="h-[600px] flex flex-col items-center justify-center gap-3 border border-primary/20 rounded-[var(--radius)] bg-[#09090b]">
    <Network className="h-8 w-8 text-primary/40" />
    <p className="text-sm font-mono text-muted-foreground">No graph snapshot received yet</p>
    <p className="text-xs text-muted-foreground/70 max-w-md text-center">
      Ástríðr's nightly graph_snapshot cron (graphify + Obsidian vault) has not pushed a snapshot to this deployment yet. Summary tiles above are independent and update on their own.
    </p>
  </div>
)}
```

### Summary tile composition

```tsx
// Tool Galaxy tile — derives counts from useToolGalaxySources()
const { tools, mcpServers, edges, kits } = useToolGalaxySources();
const galaxy = useMemo(
  () => buildGalaxy({ tools, mcpServers, edges, kits, agentFilter: null, mcpFilter: null, now: Date.now()/1000 }),
  [tools, mcpServers, edges, kits]
);
<MetricCard
  label="TOOL GALAXY"
  value={`${galaxy.stats.toolCount} tools · ${galaxy.stats.orphanCount} orphans`}
  onClick={() => navigate("/tool-galaxy")}
/>

// KG Explorer tile — uses useKgSummary() directly
const { summary } = useKgSummary();
<MetricCard
  label="KG EXPLORER"
  value={`${summary?.totalEntities ?? 0} entities · ${summary?.currentTripleCount ?? 0} triples`}
  onClick={() => navigate("/knowledge-graph")}
/>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ObsidianGraph` for vault render (local parser `lib/obsidian.ts`) | `ForceGraphCanvas` with `source`-based colorFn consuming Convex-pushed snapshot | Phase 83 (receiver) + Phase 84 (render) | `lib/obsidian.ts` is now a disconnected local parser; the Convex-push path is canonical |
| `placeholder:true` nav stub with "soon" badge | Real `/graphs` route via nav flip | This phase | CommandPalette auto-registers the route once placeholder removed |
| Three standalone graph pages with no common entry point | `/graphs` hub landing with summary tiles + hero | This phase | Unified discoverability; existing routes preserved |

**Deprecated/outdated:**
- `lib/obsidian.ts` + `ObsidianGraph.tsx`: The local Obsidian parser is superseded by the Convex-push path for the `/graphs` hub. `ObsidianGraph` still exists and is not removed — it is simply not used for the new hub render.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useToolGalaxySources` + `buildGalaxy()` from `src/lib/tool-galaxy.ts` can be imported in `GraphsHub.tsx` without pulling in heavy ForceGraph2D bundle (tree-shaking handles it) | Summary tile derivation | Tile component may need to call `buildGalaxy` for orphanCount — if bundle size is a concern, compute directly from raw arrays instead | 
| A2 | `node.source` on the returned nodes from `getProjectGraph` reliably starts with `"graphify:"` or `"vault:"` | colorFn + filter logic | Wrong prefix → all nodes render as code-colored (emerald); filter never shows vault-only. Verified indirectly: Phase 83 receiver stores `source: node.source` verbatim from the producer payload. The producer namespaces per Phase 83 D-05 ("graphify:<repo>:" / "vault:"). Risk: LOW |
| A3 | `buildGalaxy()` from `src/lib/tool-galaxy.ts` is a pure function with no side effects safe to call in a tile's `useMemo` | Summary tile | If it has side effects, tiles may exhibit unexpected behavior. File is binary in grep output suggesting TypeScript compilation, but pattern matches Phase 72 pure-builder convention. Risk: LOW |

**If this table is empty:** Not applicable — three minor assumptions noted above, all LOW risk.

---

## Open Questions (RESOLVED)

1. **RESOLVED (call `buildGalaxy()`): Should `buildGalaxy()` be called for the Tool Galaxy tile, or derive counts from raw arrays?**
   - What we know: `buildGalaxy()` returns authoritative `stats.toolCount` and `stats.orphanCount`. Raw derivation is simpler but approximates orphanCount.
   - What's unclear: Whether calling `buildGalaxy()` in a `useMemo` on the hub page (when the full ToolGalaxy page also does it) causes any duplicate work concern.
   - Recommendation: Call `buildGalaxy()` for correctness; the computation is fast (array operations, no I/O). Alternatively derive `toolCount = tools.length` and `orphanCount = tools.filter(t => !edgeToolNames.has(t.name)).length` for simplicity. Both are fine — planner chooses.

2. **RESOLVED (use `value` string per UI-SPEC; resolve overflow at build time): `MetricCard` `value` prop is `string | number` — can it accept a multi-metric string?**
   - What we know: `MetricCard` renders `value` as a string in a `text-3xl font-medium` span (MetricCard.tsx:131). A string like `"12 tools · 3 orphans"` will render but may overflow the card at large text size.
   - What's unclear: Whether the UI-SPEC intends the full metric string as the large `value` or as a subtitle.
   - Recommendation: Use `value` for the primary count (e.g., toolCount) and a `label` or subtitle for the secondary metric — OR adjust the tile layout to use a custom composition rather than MetricCard directly. The UI-SPEC shows MetricCard; this is a layout detail for the implementer to resolve at build time.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure CodePulse frontend changes with no external dependencies beyond the already-running Convex backend (verified operational, Phase 83 live round-trip confirmed 2026-06-18 vs `tidy-whale-981`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + jsdom + @testing-library/react |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx src/hooks/useProjectGraph.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GH-02 | `CodeVaultGraph` renders ForceGraphCanvas when snapshot data is present | unit | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` | ❌ Wave 0 |
| GH-02 | Loading state renders pulse text when `useProjectGraph` returns `undefined` | unit | same | ❌ Wave 0 |
| GH-02 | Empty state renders explainer when `useProjectGraph` returns `null` | unit | same | ❌ Wave 0 |
| GH-02 | Source filter: "Code" chip filters out vault nodes and dangling links | unit | same | ❌ Wave 0 |
| GH-02 | Truncation header shows correct "X of Y" counts from `snapshot.nodeCount` | unit | same | ❌ Wave 0 |
| GH-02 | Stale badge appears when `generatedAt` is > 36h ago | unit | same | ❌ Wave 0 |
| GH-02 | Integrity warning appears when `storedNodeCount < nodeCount` | unit | same | ❌ Wave 0 |
| GH-02 | Detail panel opens on node click, shows id/label/type/source/community/neighbors | unit | same | ❌ Wave 0 |
| GH-02 | `colorFn` returns `#10b981` for `graphify:*` source, `#8b5cf6` for `vault:*` source | unit | same | ❌ Wave 0 |
| GH-03 | `GraphsHub` page renders three MetricCard summary tiles | unit | `npx vitest run src/pages/GraphsHub.test.tsx` | ❌ Wave 0 |
| GH-03 | Summary tiles each have click navigation to their respective routes | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/graph/CodeVaultGraph.test.tsx src/hooks/useProjectGraph.test.ts src/pages/GraphsHub.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/graph/CodeVaultGraph.test.tsx` — covers GH-02 render, filter, truncation, freshness, detail panel, colorFn
- [ ] `src/pages/GraphsHub.test.tsx` — covers GH-03 tile render and click navigation
- [ ] `src/hooks/useProjectGraph.test.ts` — covers hook return shape (loading/null/data states)
- [ ] Mock for `api.graphSnapshots.getProjectGraph` in test setup (pattern: `vi.mock("../../convex/_generated/api")`)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | `getProjectGraph` is public (no Clerk gating) — matches existing pattern for operational telemetry |
| V3 Session Management | no | Read-only page; no session mutations |
| V4 Access Control | no | Same public-read posture as KG summary cards, forge.listJobs |
| V5 Input Validation | no | No user input; all data comes from Convex queries |
| V6 Cryptography | no | No secrets handled |

No security concerns for this phase. The read-only, public-query posture is established by Phase 83 and consistent with the existing operational telemetry pattern.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 84 |
|-----------|-------------------|
| Lucide icons only — no other icon library | Confirmed: Network, Maximize2, Minimize2, AlertTriangle, Info, X are all Lucide. No new icon library. |
| shadcn/ui New York — compose primitives, don't hand-roll | All UI primitives (Badge, Button, Tooltip, ScrollArea) are pre-installed. Zero new installs. |
| Tailwind CSS 4 via `@tailwindcss/vite` | No new CSS; use existing utility classes. |
| `SectionErrorBoundary` wraps widget groups | Wrap hero and each tile independently. |
| `ForceGraphCanvas` is the graph render engine — no canvas changes | `colorFn`/`labelFn`/`onNodeClick`/`onNodeHover` carry all domain encoding; canvas is unchanged. |
| `VITE_ASTRIDR_API_KEY` required for Ástríðr API calls | Not applicable — `getProjectGraph` is a Convex query, not an Ástríðr API call. No auth header needed. |
| TypeScript, strict — no `any` in new code except at graph boundaries | ForceGraphCanvas already uses `any` at the graph boundary (intentional); new code should type the hook return and component props. |
| Zero new packages | Confirmed — all dependencies are pre-installed. |

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `convex/graphSnapshots.ts` — full Phase 83 read API shape, `getProjectGraph` return type, `sources[]` schema, `generatedAt` as float64 Unix seconds
- `src/components/graph/ForceGraphCanvas.tsx` — complete props contract, `ForceGraphHandle`, `DEFAULT_COLOR`, `cooldownTicks`/`d3VelocityDecay` settings
- `src/layouts/DashboardLayout.tsx` — exact placeholder location (line 156), `iconComponents` map (`"network"` → `Network` at line 105), `navItems` filter logic
- `src/App.tsx` — lazy route pattern for graph pages (lines 51-59, 119-123)
- `src/pages/KnowledgeGraph.tsx` — loading state (L217-219), empty state (L224-238), error banner (L159-177), detail panel grid (L182-183), legend (L186-215)
- `src/pages/HivePage.tsx` — current new-page composition exemplar
- `src/pages/ToolGalaxy.tsx` — client-side filter pattern (GAL-04), `stats.orphanCount`/`stats.toolCount` from `buildGalaxy()`
- `src/hooks/useToolGalaxy.ts`, `src/hooks/useMcpHealth.ts`, `src/hooks/useKgSummary.ts` — exact return shapes for tile metric derivation
- `src/components/MetricCard.tsx` — `value: string | number` prop, `onClick` support
- `src/components/GlassPanel.tsx` — `className` prop, entry animation
- `src/components/kg/KGDetailsPanel.tsx` — detail panel composition pattern
- `vitest.config.ts` — test environment, `include` globs, `jsdom` setup
- `.planning/phases/84-graphs-hub-code-vault-render/84-CONTEXT.md` — all locked decisions D-01..D-12
- `.planning/phases/84-graphs-hub-code-vault-render/84-UI-SPEC.md` — all visual/interaction specs resolved

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — GH-02/GH-03 full requirement text
- `.planning/STATE.md` — Phase 83 completion status, verified round-trip
- `src/lib/mcp-health.ts` — `serverCount`, `errorCount` field locations confirmed via grep

---

## Metadata

**Confidence breakdown:**
- Data contract (Phase 83 API): HIGH — read from source
- ForceGraphCanvas props: HIGH — read from source
- Nav integration: HIGH — read from source, exact line numbers
- Component patterns (legend, loading, empty, detail panel): HIGH — read from KnowledgeGraph.tsx source
- Tile metric derivation: MEDIUM — hook return shapes confirmed, exact count derivation requires checking `buildGalaxy()` stats output (binary file, could not read directly)
- Test infrastructure: HIGH — vitest.config.ts read directly

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable React/Convex phase; no fast-moving dependencies)
