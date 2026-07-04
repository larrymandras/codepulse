# Phase 84: Graphs Hub + Code/Vault Render - Pattern Map

**Mapped:** 2026-06-22
**Files analyzed:** 5 (3 new, 2 edited)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/hooks/useProjectGraph.ts` | hook | request-response | `src/hooks/useKgSummary.ts` | exact |
| `src/components/graph/CodeVaultGraph.tsx` | component | request-response | `src/pages/KnowledgeGraph.tsx` | exact |
| `src/pages/GraphsHub.tsx` | page/component | request-response | `src/pages/HivePage.tsx` | exact |
| `src/App.tsx` (edit) | config/route | request-response | `src/App.tsx` lines 51-71, 118-123 | self |
| `src/layouts/DashboardLayout.tsx` (edit) | config/nav | — | `src/layouts/DashboardLayout.tsx` line 156 | self |

---

## Pattern Assignments

### `src/hooks/useProjectGraph.ts` (hook, request-response)

**Analog:** `src/hooks/useKgSummary.ts`

**Imports pattern** (`useKgSummary.ts` lines 1-2):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
```

**Core hook pattern** (`useKgSummary.ts` lines 23-42) — thin `useQuery` wrapper with typed return and explicit `loading` derived from `undefined`:
```typescript
export function useKgSummary(): {
  summary: KgSummaryView | null;
  loading: boolean;
} {
  const doc = useQuery(api.kg.latestSummary);
  return {
    summary: doc ? { ...mappedFields } : null,
    loading: doc === undefined,
  };
}
```

**Adaptation for `useProjectGraph`:** Do NOT follow the `{ data, loading }` return shape — for `getProjectGraph`, return the raw Convex result directly (preserving the three-state signal: `undefined` = loading, `null` = no snapshot, `object` = data). `CodeVaultGraph` needs all three states to branch between loading pulse, explainer, and live graph. The multi-field wrapper in `useKgSummary` is not needed here.

**Secondary analog:** `src/hooks/useToolGalaxy.ts` lines 18-39 — pattern for `?? []` fallback on array fields (same `undefined` → loading guard). Not applicable here since the query returns a single object/null, not arrays.

**Copy-ready shape** (from RESEARCH.md Pattern 2, verified against `convex/graphSnapshots.ts`):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export type ProjectGraphData = NonNullable<
  ReturnType<typeof useQuery<typeof api.graphSnapshots.getProjectGraph>>
>;

export function useProjectGraph(snapshotId?: string) {
  return useQuery(
    api.graphSnapshots.getProjectGraph,
    snapshotId ? { snapshotId } : {}
  );
}
```

---

### `src/components/graph/CodeVaultGraph.tsx` (component, request-response)

**Primary analog:** `src/pages/KnowledgeGraph.tsx` — detail-panel + legend + `ForceGraphCanvas` integration + loading/empty states.

**Secondary analog:** `src/pages/ToolGalaxy.tsx` `GalaxyCanvas` — client-side filter state pattern + `LegendDot` component pattern.

**Tertiary analog:** `src/components/graph/ForceGraphCanvas.tsx` — props contract to satisfy.

#### Imports pattern (`KnowledgeGraph.tsx` lines 1-17):
```typescript
import { useCallback, useMemo, useRef } from "react";
import { Share2, AlertTriangle, Info } from "lucide-react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import InfoTooltip from "../components/InfoTooltip";
import {
  ForceGraphCanvas,
  type ForceGraphHandle,
} from "../components/graph/ForceGraphCanvas";
```
For `CodeVaultGraph`, replace with: `Network, Maximize2, Minimize2, AlertTriangle, Info, X` from `lucide-react`; add `useState` for filter + selected + fullscreen state; import `Badge`, `Button`, `Tooltip*` from `@/components/ui/`.

#### Loading state pattern (`KnowledgeGraph.tsx` lines 217-221):
```tsx
{loading ? (
  <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
    <p className="text-primary/70 font-mono text-sm animate-pulse">
      Querying knowledge graph…
    </p>
  </div>
) : ...}
```
Adapt: replace message with `"Loading graph snapshot…"` and check `snapshot === undefined` (Convex loading) rather than a `loading` boolean.

#### Empty state pattern (`KnowledgeGraph.tsx` lines 223-238):
```tsx
<div className="h-[600px] flex flex-col items-center justify-center gap-2 text-center px-6 rounded-[var(--radius)] border border-primary/20 bg-[#09090b]">
  <AlertTriangle className="h-6 w-6 text-primary/50" />
  <p className="text-sm text-muted-foreground font-mono">
    {explanatory text}
  </p>
  <p className="text-xs text-muted-foreground/60 max-w-md">
    {secondary context}
  </p>
</div>
```
Adapt for `null` state (D-12): swap `AlertTriangle` for `Network className="h-8 w-8 text-primary/40"`, update copy per UI-SPEC.

#### Error banner pattern (`KnowledgeGraph.tsx` lines 159-170):
```tsx
<div className="flex items-start gap-3 rounded-[var(--radius)] border border-red-500/30 bg-red-500/5 px-4 py-3">
  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
  <div className="text-xs font-mono leading-relaxed">
    <p className="text-foreground">Could not reach the KG read API.</p>
    <p className="text-muted-foreground mt-0.5">{error}</p>
  </div>
</div>
```
Adapt for D-08 integrity warning: same border/bg pattern but trigger condition is `storedNodeCount < nodeCount || storedLinkCount < linkCount`.

#### Legend pattern (`KnowledgeGraph.tsx` lines 186-215, `ToolGalaxy.tsx` lines 212-219):
```tsx
{/* Legend — absolute overlay, floats over canvas */}
<div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-[10px] font-mono">
  {legendTypes.map((t) => (
    <span key={t.type} className="flex items-center gap-2 text-muted-foreground">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: t.color }}
      />
      {t.type}
    </span>
  ))}
</div>
```
Adapt: two fixed entries (Code `#10b981` / Vault `#8b5cf6`) — no dynamic filter needed on the legend.

#### `LegendDot` helper pattern (`ToolGalaxy.tsx` lines 286-309):
```tsx
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
```

#### Graph + detail panel grid layout (`KnowledgeGraph.tsx` lines 182-184):
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
  <div className="relative">
    {/* Legend overlay + ForceGraphCanvas or loading/empty state */}
  </div>
  {/* Detail panel — KGDetailsPanel or inline equivalent */}
</div>
```

#### `ForceGraphCanvas` call with all relevant callbacks (`KnowledgeGraph.tsx` lines 240-257):
```tsx
<ForceGraphCanvas
  ref={fgRef}
  data={graph}
  colorFn={(n: any) => (n as KgNode).color}
  labelFn={labelFn}
  paintNode={paintNode}
  linkColorFn={linkColorFn}
  linkWidthFn={linkWidthFn}
  linkLineDashFn={linkLineDashFn}
  focusSet={focusSet}
  onNodeClick={(n: any) => selectNode(n.id)}
  onBackgroundClick={() => { selectNode(null); selectEdge(null); }}
/>
```
Adapt: `colorFn` returns `#8b5cf6` for `node.source?.startsWith("vault:")` else `#10b981`. No `linkDirectionalArrow` needed. Pass explicit `className` to enable fullscreen height switch (see RESEARCH.md Pitfall 6).

#### `ForceGraphCanvas` props contract (full interface at `ForceGraphCanvas.tsx` lines 34-63):
```typescript
export interface ForceGraphCanvasProps {
  data: { nodes: any[]; links: any[] };
  colorFn?: (node: any) => string;
  labelFn?: (node: any) => string;
  paintNode?: (node: any, ctx: CanvasRenderingContext2D, globalScale: number,
               opts: { hovered: boolean; dimmed: boolean }) => void;
  linkColorFn?: (link: any) => string;
  linkWidthFn?: (link: any) => number;
  linkLineDashFn?: (link: any) => number[] | null;
  linkDirectionalArrow?: boolean;
  focusSet?: Set<string> | null;
  onNodeClick?: (node: any) => void;
  onNodeHover?: (node: any | null) => void;
  onBackgroundClick?: () => void;
  nodeRelSize?: number;
  className?: string;      // pass explicitly for fullscreen height switch
  backdrop?: boolean;
}
// Default className (applied when undefined): "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"
// DEFAULT_COLOR = "#10b981"
```

#### `ForceGraphHandle` ref for `zoomToFit` (`ForceGraphCanvas.tsx` lines 28-32):
```typescript
export interface ForceGraphHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
}
```

#### Client-side source filter pattern (`ToolGalaxy.tsx` lines 311-316, adapted from RESEARCH.md Pattern 4):
```typescript
// In ToolGalaxy, filters are passed down to GalaxyCanvas via props.
// For CodeVaultGraph, keep all state local:
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
    l => keptIds.has(l.source as string) && keptIds.has(l.target as string)
  );
  return { nodes: keptNodes, links: keptLinks };
}, [snapshot, sourceFilter]);
```
Key warning from RESEARCH.md: always filter links together with nodes; dangling links cause `react-force-graph-2d` console errors and phantom positions.

#### Detail panel shell pattern (`KGDetailsPanel.tsx` lines 117-150):
```tsx
// PanelShell — the reusable close-button + scroll container
<div className="rounded-[var(--radius)] border border-primary/20 bg-card/70 backdrop-blur p-4 space-y-3 h-full overflow-y-auto custom-scrollbar">
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-foreground break-words">{title}</h3>
    </div>
    <button
      onClick={onClose}
      className="text-muted-foreground hover:text-foreground shrink-0"
      aria-label="Close details"   // Phase 84 spec: "Close node details"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
  {children}
</div>
```

#### Empty detail panel (`KGDetailsPanel.tsx` lines 164-172):
```tsx
if (!selectedNodeId && !selectedEdgeId) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-border bg-card/30 p-4 h-full flex items-center justify-center text-center">
      <p className="text-xs text-muted-foreground font-mono">
        Select an entity or edge to inspect its facts and provenance.
      </p>
    </div>
  );
}
```
Adapt: change copy to `"Select a node to inspect"`.

#### `paintNode` with selection ring pattern (`KnowledgeGraph.tsx` lines 59-103):
```typescript
const paintNode = useCallback(
  (node: any, ctx: CanvasRenderingContext2D, globalScale: number,
   opts: { hovered: boolean; dimmed: boolean }) => {
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
    // label on hover/zoom (same JetBrains Mono pattern as defaultPaint)
    ctx.globalAlpha = 1;
  },
  [selectedNodeId],
);
```
Adapt: `n.color` = `colorFn(n)` derived from `n.source` prefix. `paintNode` is a `useCallback` with `[selectedNodeId]` dependency so the selection ring repaints on node change.

---

### `src/pages/GraphsHub.tsx` (page, request-response)

**Analog:** `src/pages/HivePage.tsx` — canonical new-page composition exemplar.

#### Imports pattern (`HivePage.tsx` lines 1-17):
```typescript
import { useState, useEffect } from "react";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { GlassPanel } from "../components/GlassPanel";
import { useGoalList } from "../hooks/useSwarmGraph";
// + domain-specific component imports
```
Adapt: add `useNavigate` from `react-router-dom`; import `MetricCard`, `InfoTooltip`; import tile hooks (`useToolGalaxySources`, `useMcpHealthSources`, `useKgSummary`); import `CodeVaultGraph`.

#### Page structure pattern (`HivePage.tsx` lines 19-63):
```tsx
export default function HivePage() {
  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-2">
          {/* icon + label + InfoTooltip */}
        </h1>
      </div>

      {/* Hero region */}
      <SectionErrorBoundary name="Swarm Graph">
        <GlassPanel className="rounded-xl p-5 min-h-[400px]">
          {/* hero component */}
        </GlassPanel>
      </SectionErrorBoundary>

      {/* Secondary regions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionErrorBoundary name="Region A">
          <GlassPanel className="rounded-xl p-5">{/* ... */}</GlassPanel>
        </SectionErrorBoundary>
        <SectionErrorBoundary name="Region B">
          <GlassPanel className="rounded-xl p-5">{/* ... */}</GlassPanel>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
```
Adapt: summary tiles use `grid grid-cols-1 md:grid-cols-3 gap-4` (3 columns on md+). Each tile is a standalone `SectionErrorBoundary` wrapping a `MetricCard` directly — no `GlassPanel` wrapper on individual tiles (MetricCard has its own `bg-card/60 backdrop-blur` surface). Hero is `SectionErrorBoundary` > `GlassPanel className="rounded-xl"` > `CodeVaultGraph`.

#### MetricCard usage with `onClick` (`ToolGalaxy.tsx` lines 181-186, `MetricCard.tsx` lines 53-64):
```tsx
// MetricCard signature:
interface MetricCardProps {
  label: string;
  value: string | number;
  numericValue?: number;   // triggers AnimatedNumber spring
  trend?: "up" | "down" | "neutral";
  severity?: "critical" | "error" | "warning" | "info" | "default";
  onClick?: () => void;
}

// Usage in ToolGalaxy:
<MetricCard label="Tools" value={graph.stats.toolCount} />
// Usage for GraphsHub tiles (value is string, onClick navigates):
<MetricCard
  label="TOOL GALAXY"
  value={`${toolCount} tools · ${orphanCount} orphans`}
  onClick={() => navigate("/tool-galaxy")}
/>
```
Note from RESEARCH.md open question 2: `value` renders at `text-3xl font-medium` — a multi-metric string will render small at that scale. If it overflows, use `numericValue` for the primary count and handle secondary metric differently.

#### GlassPanel props (`GlassPanel.tsx` lines 4-8):
```typescript
interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean; // default true
}
// Renders motion.div with glassmorphism tokens:
// "bg-card border border-border dark:bg-[var(--glass-bg)] dark:border-[var(--glass-border)] dark:backdrop-blur-[var(--glass-blur)]"
```

---

### `src/App.tsx` (edit — add `/graphs` lazy route)

**Analog:** Self — existing GRAPHS cluster route entries (lines 51-72 and 118-123).

#### Lazy import declaration pattern (lines 51-71):
```typescript
// Phase 72: Tool / Capability Galaxy
const ToolGalaxy = lazy(() => import("./pages/ToolGalaxy"));

// Phase 73: MCP Inventory + Health (GRAPHS cluster)
const McpInventory = lazy(() => import("./pages/McpInventory"));

// Phase 74: Temporal-KG Explorer
const KnowledgeGraph = lazy(() => import("./pages/KnowledgeGraph"));

// Phase 149: Hive swarm observability
const HivePage = lazy(() => import("./pages/HivePage"));
```
Add after line 71:
```typescript
// Phase 84: Graphs Hub
const GraphsHub = lazy(() => import("./pages/GraphsHub"));
```

#### Route registration pattern (lines 118-123):
```tsx
{/* Phase 72: Tool / Capability Galaxy (GRAPHS cluster) */}
<Route path="/tool-galaxy" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Tool Galaxy...</div>}><ToolGalaxy /></Suspense>} />
{/* Phase 73: MCP Inventory + Health (GRAPHS cluster) */}
<Route path="/mcp-inventory" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading MCP Inventory...</div>}><McpInventory /></Suspense>} />
{/* Phase 74: Temporal-KG Explorer (GRAPHS cluster) */}
<Route path="/knowledge-graph" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading KG Explorer...</div>}><KnowledgeGraph /></Suspense>} />
```
Insert immediately before line 118 (before the other GRAPHS cluster routes, so hub is first):
```tsx
{/* Phase 84: Graphs Hub (GRAPHS cluster) */}
<Route path="/graphs" element={<Suspense fallback={<div className="text-muted-foreground text-sm p-8 text-center">Loading Graphs Hub...</div>}><GraphsHub /></Suspense>} />
```

---

### `src/layouts/DashboardLayout.tsx` (edit — flip placeholder to real route)

**Analog:** Self — exact target is line 156.

#### GRAPHS group current state (lines 154-161):
```typescript
{
  group: "GRAPHS",
  items: [
    { label: "Graphs Hub", icon: "network", group: "GRAPHS", placeholder: true },
    { to: "/tool-galaxy", label: "Tool Galaxy", icon: "boxes", group: "GRAPHS" },
    { to: "/mcp-inventory", label: "MCP Inventory", icon: "server", group: "GRAPHS" },
    { to: "/knowledge-graph", label: "KG Explorer", icon: "share-2", group: "GRAPHS" },
    { to: "/capabilities", label: "Capabilities", icon: "cpu", group: "GRAPHS" },
  ],
},
```

**Edit:** Change line 156 from:
```typescript
{ label: "Graphs Hub", icon: "network", group: "GRAPHS", placeholder: true },
```
To:
```typescript
{ to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" },
```

**Verification:** `"network"` → `Network` is already in `iconComponents` at line 105. The `navItems` dedup filter (lines 204-216) checks `item.placeholder || !item.to` — removing `placeholder: true` and adding `to: "/graphs"` auto-registers the route in the CommandPalette with no further changes.

---

## Shared Patterns

### SectionErrorBoundary — widget-level fault isolation
**Source:** `src/pages/HivePage.tsx` lines 42-61, `src/pages/KnowledgeGraph.tsx` lines 140-156, 182-272
**Apply to:** All new components in GraphsHub (hero + each tile independently)
```tsx
<SectionErrorBoundary name="Code/Vault Graph">
  <GlassPanel className="rounded-xl">
    <CodeVaultGraph />
  </GlassPanel>
</SectionErrorBoundary>
```
Each MetricCard tile gets its own `SectionErrorBoundary` so one failing hook doesn't take down the whole tile row.

### Convex `useQuery` three-state guard
**Source:** `src/hooks/useKgSummary.ts` lines 26-41, `src/hooks/useToolGalaxy.ts` lines 30-31
**Apply to:** `useProjectGraph`, `GraphsHub` tile derivation
- `undefined` = Convex subscription not yet resolved → loading state
- `null` = query resolved, no document → empty/explainer state
- `object` / array = live data → render
- Pattern: `const data = useQuery(...); const loading = data === undefined;`

### InfoTooltip — page-level help text
**Source:** `src/pages/KnowledgeGraph.tsx` line 131, `src/pages/ToolGalaxy.tsx` line 326
**Apply to:** `GraphsHub.tsx` page header
```tsx
<InfoTooltip text="Ástríðr's code, vault, and tool graphs — unified. The hero below shows the nightly graphify + Obsidian snapshot." />
```

### Absolute legend overlay
**Source:** `src/pages/KnowledgeGraph.tsx` lines 186-215, `src/pages/ToolGalaxy.tsx` lines 212-219
**Apply to:** `CodeVaultGraph` canvas container
```tsx
// Container must be `relative` for the absolute legend to clip correctly
<div className="relative">
  <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5 bg-card/70 backdrop-blur border border-border rounded-[var(--radius-sm)] px-3 py-2 text-[10px] font-mono">
    {/* legend entries */}
  </div>
  <ForceGraphCanvas ... />
</div>
```

### `useMemo` for stable graph data reference
**Source:** `src/pages/ToolGalaxy.tsx` lines 71-83
**Apply to:** `CodeVaultGraph` `filteredData` derivation
Always wrap `filteredData` in `useMemo` — if computed inline, `react-force-graph-2d` restarts the force simulation on every render cycle.

### Tile metric derivation from existing hooks
**Source:** `src/hooks/useToolGalaxy.ts`, `src/hooks/useMcpHealth.ts`, `src/hooks/useKgSummary.ts`

| Tile | Hook | Count derivation |
|------|------|-----------------|
| Tool Galaxy | `useToolGalaxySources()` → call `buildGalaxy({tools, mcpServers, edges, kits, agentFilter: null, mcpFilter: null, now: Date.now()/1000}).stats` | `stats.toolCount`, `stats.orphanCount` |
| MCP Inventory | `useMcpHealthSources()` | `mcpServers.length`, `mcpServers.filter(s => s.status === 'error').length` — or use `buildMcpHealth()` for authoritative count |
| KG Explorer | `useKgSummary()` | `summary?.totalEntities ?? 0`, `summary?.currentTripleCount ?? 0` |

---

## No Analog Found

No files are without analog. All 5 files have direct precedents in the codebase.

The fullscreen affordance in `CodeVaultGraph` (D-03) has no direct precedent in the codebase — it is net-new behavior. RESEARCH.md Pattern 6 documents the implementation: `fixed inset-0 z-50 bg-[#09090b]` container swap via boolean state, ESC key via `useEffect` cleanup, `h-screen` canvas height substitution.

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/pages/`, `src/components/graph/`, `src/components/`, `src/layouts/`, `src/App.tsx`
**Files read for analog extraction:** 11
- `src/hooks/useKgSummary.ts`
- `src/hooks/useToolGalaxy.ts`
- `src/hooks/useMcpHealth.ts`
- `src/pages/HivePage.tsx`
- `src/pages/KnowledgeGraph.tsx`
- `src/pages/ToolGalaxy.tsx`
- `src/components/graph/ForceGraphCanvas.tsx`
- `src/components/MetricCard.tsx`
- `src/components/GlassPanel.tsx`
- `src/components/kg/KGDetailsPanel.tsx`
- `src/layouts/DashboardLayout.tsx`
- `src/App.tsx`
**Pattern extraction date:** 2026-06-22
