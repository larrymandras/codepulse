# Phase 91: 3D Memory Galaxy — Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 5 (2 new, 1 modified, 1 new test, 1 lib extension)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/graph/ForceGraph3D.tsx` | component | event-driven | `src/components/graph/ForceGraphCanvas.tsx` | exact |
| `src/components/graph/CodeVaultGraph.tsx` (modified) | component (host) | event-driven + transform | itself (chipClass, L329–404) + `src/App.tsx` (lazy pattern) | exact |
| idb persistence (inline, inside CodeVaultGraph.tsx) | utility pattern | transform | `src/hooks/useKnowledgeGraph.ts` L1–151 | exact |
| `src/components/graph/ForceGraph3D.test.tsx` | test | — | `src/components/graph/CodeVaultGraph.test.tsx` | exact |
| `src/lib/graph-center.ts` (extend) | utility | event-driven | itself — `centerNodeWhenReady` L30–61 | exact |

---

## Pattern Assignments

### `src/components/graph/ForceGraph3D.tsx` (component, event-driven)

**Analog:** `src/components/graph/ForceGraphCanvas.tsx`

**Imports pattern** (ForceGraphCanvas.tsx lines 1–11):
```typescript
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ForceGraph2D from "react-force-graph-2d";
```
For ForceGraph3D.tsx, swap to:
```typescript
import ForceGraph3DLib from "react-force-graph-3d";
```
All `three`, `react-force-graph-3d`, and `3d-force-graph` imports MUST stay inside this file — it is the dynamic import boundary that isolates the Three.js chunk (SC#2).

**Handle interface pattern** (ForceGraphCanvas.tsx lines 30–38):
```typescript
export interface ForceGraphHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
}
```
For ForceGraph3D.tsx, define an equivalent `ForceGraph3DHandle` that matches the 3D library's imperative API:
```typescript
export interface ForceGraph3DHandle {
  cameraPosition: (
    position: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number } | null,
    ms?: number
  ) => void;
  zoomToFit: (ms?: number, px?: number, nodeFilterFn?: (node: any) => boolean) => void;
  refresh: () => void;
  scene: () => any;
  renderer: () => any;
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
  pauseAnimation: () => void;
  resumeAnimation: () => void;
}
```

**forwardRef + useImperativeHandle pattern** (ForceGraphCanvas.tsx lines 88–151):
```typescript
export const ForceGraphCanvas = forwardRef<
  ForceGraphHandle,
  ForceGraphCanvasProps
>(function ForceGraphCanvas(props, ref) {
  const fgRef = useRef<any>(null);
  // ...
  useImperativeHandle(ref, () => ({
    centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
    zoom: (k, ms) => fgRef.current?.zoom(k, ms),
    zoomToFit: (ms, padding) => fgRef.current?.zoomToFit(ms, padding),
    d3Force: (name, force) => fgRef.current?.d3Force(name, force),
    d3ReheatSimulation: () => fgRef.current?.d3ReheatSimulation(),
  }));
  // ...
});
```
ForceGraph3D.tsx follows the exact same `forwardRef<ForceGraph3DHandle, ForceGraph3DProps>` shape, forwarding to the internal `fgRef3dInner` that holds the react-force-graph-3d instance.

**Prop interface pattern** (ForceGraphCanvas.tsx lines 40–86):
```typescript
export interface ForceGraphCanvasProps {
  data: { nodes: any[]; links: any[] };
  colorFn?: (node: any) => string;
  labelFn?: (node: any) => string;
  linkColorFn?: (link: any) => string;
  linkWidthFn?: (link: any) => number;
  onNodeClick?: (node: any) => void;
  onNodeHover?: (node: any | null) => void;
  onBackgroundClick?: () => void;
  onEngineStop?: () => void;
  nodeRelSize?: number;
  className?: string;
}
```
ForceGraph3D.tsx uses the same prop names where they map to 3D equivalents. Add `nodeValFn?: (node: any) => number` for the selection size bump.

**Container + backdrop render pattern** (ForceGraphCanvas.tsx lines 287–329):
```typescript
return (
  <div
    className={
      className ??
      "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]"
    }
    style={{ boxShadow: "var(--glow-lg)" }}
  >
    {backdrop && (
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,...)] from-zinc-900 via-[#09090b] to-black opacity-80 pointer-events-none" />
    )}
    <ForceGraph2D
      ref={fgRef}
      graphData={data}
      nodeId="id"
      cooldownTicks={120}
      d3VelocityDecay={0.3}
      backgroundColor="transparent"
      // ...
    />
  </div>
);
```
ForceGraph3D.tsx wraps `<ForceGraph3DLib>` in the same outer `<div className={className ?? canvasClass}>` shape. The 3D library owns its own canvas element — do not add a backdrop div inside (three.js `backgroundColor="#09090b"` handles the dark fill).

**Core 3D prop baseline** (from RESEARCH.md Pattern 2 — verified):
```typescript
<ForceGraph3DLib
  ref={fgRef3dInner}
  graphData={data}
  nodeId="id"
  nodeLabel={labelFn}
  nodeColor={colorFn}
  nodeVal={nodeValFn}
  nodeRelSize={4}
  nodeResolution={6}
  linkColor={linkColorFn}
  linkOpacity={0.2}
  linkWidth={0.6}
  backgroundColor="#09090b"
  cooldownTicks={150}
  warmupTicks={0}
  d3VelocityDecay={0.3}
  onNodeClick={(node: any) => onNodeClick?.(node)}
  onNodeHover={(node: any | null) => onNodeHover?.(node ?? null)}
  onBackgroundClick={() => onBackgroundClick?.()}
  onEngineStop={() => onEngineStop?.()}
/>
```

**Anti-pattern:** Do NOT import `three`, `react-force-graph-3d`, or `3d-force-graph` anywhere outside this file. Static imports in any file reachable from the main entry will break chunk isolation (SC#2).

---

### `src/components/graph/CodeVaultGraph.tsx` (modified — renderMode state, toggle UI, lazy swap)

**Analog A (lazy-load declaration):** `src/App.tsx` lines 24–74

The module-level `lazy()` declaration pattern — OUTSIDE the component:
```typescript
// App.tsx lines 24–74: all lazy declarations at module level
const Agents = lazy(() => import("./pages/Agents"));
const Analytics = lazy(() => import("./pages/Analytics"));
const WarRoom = lazy(() => import("./pages/WarRoom"));
```
For CodeVaultGraph.tsx, add at module level (outside `GraphContent`):
```typescript
// At module top, outside GraphContent — avoids React "lazy inside component" warning
const LazyForceGraph3D = React.lazy(() => import("./ForceGraph3D"));
```
`React` import must be added explicitly since `lazy` is a named export from React 19.

**Analog B (Suspense fallback pattern):** `src/App.tsx` lines 86, 96, 105:
```typescript
<Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading Forge...</div>}>
  <ForgePage />
</Suspense>
```
For the graph Suspense, use `canvasClass` as the wrapper to maintain sizing:
```typescript
<Suspense
  fallback={
    <div className={canvasClass}>
      <div className="flex h-full items-center justify-center">
        <p className="text-primary/70 font-mono text-base animate-pulse">
          Loading 3D render…
        </p>
      </div>
    </div>
  }
>
  <LazyForceGraph3D ref={fgRef3d} graphData={filteredData} /* ... */ />
</Suspense>
```

**Analog C (chipClass — active/inactive chip styling):** `CodeVaultGraph.tsx` lines 329–332:
```typescript
const chipClass = (filter: SourceFilter) =>
  sourceFilter === filter
    ? "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-primary/10 text-primary border border-primary/40"
    : "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-transparent text-muted-foreground border border-border";
```
The render-mode toggle uses the same active/inactive strings. Add a third `disabled` variant for the 3D button while the chunk is loading:
```typescript
const renderModeChipClass = (mode: "2d" | "3d") =>
  renderMode === mode
    ? "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-primary/10 text-primary border border-primary/40"
    : "text-sm font-mono px-3 py-1 rounded-[var(--radius-sm)] cursor-pointer bg-transparent text-muted-foreground border border-border";
```

**Analog D (source-filter chip group markup):** `CodeVaultGraph.tsx` lines 382–404:
```tsx
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
```
The 2D|3D toggle is a faithful clone of this structure placed between the source-filter group and the fullscreen button in the right cluster (CodeVaultGraph.tsx lines 380–430):
```tsx
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
```
Insert this div inside the right-cluster div (CodeVaultGraph.tsx line 380: `<div className="flex items-center gap-2">`) immediately before the `<TooltipProvider>` block at line 409.

**Analog E (ForceGraphCanvas mount — conditional swap slot):** `CodeVaultGraph.tsx` lines 478–493:
```tsx
<ForceGraphCanvas
  ref={fgRef}
  data={filteredData}
  colorFn={colorFn}
  labelFn={labelFn}
  paintNode={paintNode}
  linkColorFn={linkColorFn}
  defaultNodeColor={colors.primary}
  defaultLinkColor={colors.primaryAlpha18}
  onNodeClick={(node: any) => setSelectedNodeId(node.id)}
  onBackgroundClick={() => setSelectedNodeId(null)}
  onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}
  className={canvasClass}
  clusterForce={true}
  communityColorFn={(node: any) => communityColor(node.community)}
/>
```
This is the swap point. Restructure to a conditional based on `renderMode`:
```tsx
{renderMode === "2d" ? (
  <ForceGraphCanvas ref={fgRef2d} {/* all existing props */} />
) : (
  <Suspense fallback={/* canvasClass loading fallback */}>
    <LazyForceGraph3D
      ref={fgRef3d}
      data={filteredData}
      colorFn={colorFn3D}
      nodeValFn={nodeValFn3D}
      linkColorFn={linkColorFn3D}
      labelFn={labelFn}
      onNodeClick={(node: any) => setSelectedNodeId(node.id)}
      onBackgroundClick={() => setSelectedNodeId(null)}
      onEngineStop={() => fgRef3d.current?.zoomToFit(400, 60)}
      className={canvasClass}
    />
  </Suspense>
)}
```
Rename existing `fgRef` to `fgRef2d` to disambiguate. Add `fgRef3d = useRef<ForceGraph3DHandle>(null)`.

**Analog F (colorFn useCallback pattern):** `CodeVaultGraph.tsx` lines 125–147:
```typescript
const colorFn = useCallback(
  (node: any): string => isVaultNode(node) ? colors.vaultNode : colors.primary,
  [colors],
);

const linkColorFn = useCallback(
  (link: any): string => {
    const srcIsVault = typeof link.source === "string"
      ? link.source.startsWith("vault:")
      : link.source?.source?.startsWith("vault:") ?? false;
    const tgtIsVault = typeof link.target === "string"
      ? link.target.startsWith("vault:")
      : link.target?.source?.startsWith("vault:") ?? false;

    if (srcIsVault && tgtIsVault) return colors.vaultNodeAlpha18;
    if (!srcIsVault && !tgtIsVault) return colors.primaryAlpha18;
    return "rgba(255, 255, 255, 0.08)";
  },
  [colors],
);
```
The 3D variants follow the same `useCallback([...deps])` pattern but return hex-only strings (Three.js `Color` ignores `rgba()` alpha):
```typescript
const colorFn3D = useCallback(
  (node: any): string => {
    if (node.id === selectedNodeId) return "#ffffff";
    if (node.id === hoveredNodeId) return "#ffffff";
    if (selectedNodeId && !neighborIds.has(node.id)) return "#27272a"; // zinc-800 dim
    return isVaultNode(node) ? colors.vaultNode : colors.primary;
  },
  [selectedNodeId, hoveredNodeId, neighborIds, colors],
);

const nodeValFn3D = useCallback(
  (node: any): number => (node.id === selectedNodeId ? (node.val ?? 1) * 3 : (node.val ?? 1)),
  [selectedNodeId],
);

const linkColorFn3D = useCallback(
  (link: any): string => {
    const srcIsVault = typeof link.source === "string"
      ? link.source.startsWith("vault:")
      : link.source?.source?.startsWith("vault:") ?? false;
    const tgtIsVault = typeof link.target === "string"
      ? link.target.startsWith("vault:")
      : link.target?.source?.startsWith("vault:") ?? false;
    if (srcIsVault && tgtIsVault) return colors.vaultNode;   // hex only — alpha via linkOpacity
    if (!srcIsVault && !tgtIsVault) return colors.primary;   // hex only
    return "#94a3b8"; // muted-foreground neutral for cross-source
  },
  [colors],
);
```

**neighborIds** for the 3D `colorFn3D` dim logic — derive as a `useMemo` from `filteredData.links` and `selectedNodeId`, analogous to the existing `neighborNodes` memo at CodeVaultGraph.tsx lines 260–270:
```typescript
const neighborIds = useMemo(() => {
  if (!selectedNodeId) return new Set<string>();
  const ids = new Set<string>();
  filteredData.links.forEach((l) => {
    const srcId = typeof l.source === "string" ? l.source : (l.source as any)?.id;
    const tgtId = typeof l.target === "string" ? l.target : (l.target as any)?.id;
    if (srcId === selectedNodeId && tgtId) ids.add(tgtId);
    if (tgtId === selectedNodeId && srcId) ids.add(srcId);
  });
  return ids;
}, [filteredData, selectedNodeId]);
```

**hoveredNodeId** — add alongside `selectedNodeId` state:
```typescript
const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
```

**refresh() after simulation stops** (RESEARCH.md Pattern 4):
```typescript
useEffect(() => {
  if (renderMode !== "3d") return;
  fgRef3d.current?.refresh();
}, [selectedNodeId, hoveredNodeId, colors, renderMode]);
```

---

### idb-keyval render-mode persistence (inline effect in CodeVaultGraph.tsx)

**Analog:** `src/hooks/useKnowledgeGraph.ts` lines 1–2 and 120–151

**Import pattern** (useKnowledgeGraph.ts line 2):
```typescript
import { get as idbGet, set as idbSet } from "idb-keyval";
```
Add this import to `CodeVaultGraph.tsx` (already in `package.json` at `^6.2.4`).

**State declaration:**
```typescript
const [renderMode, setRenderMode] = useState<"2d" | "3d">("2d");
```

**Hydrate on mount** (mirrors useKnowledgeGraph.ts lines 121–142):
```typescript
useEffect(() => {
  let cancelled = false;
  idbGet("codepulse:render-mode").then((saved) => {
    if (!cancelled && saved === "3d") setRenderMode("3d");
  }).catch(() => { /* private browsing / IDB unavailable — stay on 2d */ });
  return () => { cancelled = true; };
}, []);
```

**Toggle handler with persist** (mirrors useKnowledgeGraph.ts lines 144–151):
```typescript
const handleModeToggle = (mode: "2d" | "3d") => {
  setRenderMode(mode);
  idbSet("codepulse:render-mode", mode).catch(() => { /* best effort */ });
};
```

**Validation:** Always coerce the IDB value — never `setRenderMode(saved)` without checking:
```typescript
if (!cancelled && saved === "3d") setRenderMode("3d");
// else stays "2d" default
```

---

### `src/components/graph/ForceGraph3D.test.tsx` (test)

**Analog:** `src/components/graph/CodeVaultGraph.test.tsx` (the full file)

**Test file structure** (CodeVaultGraph.test.tsx lines 20–124):
```typescript
import { describe, it, vi, beforeEach, expect, afterEach } from "vitest";
import { render as rtlRender, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

// -- Mock declarations before component import --

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("../../convex/_generated/api", () => ({ api: { ... } }));

// Render inside a Router
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });
```

**react-force-graph-3d mock pattern** (adapt ForceGraphCanvas mock, CodeVaultGraph.test.tsx lines 80–98):
```typescript
// Capture last props passed to ForceGraph3D for colorFn/nodeValFn assertions
let lastForceGraph3DProps: Record<string, any> = {};

vi.mock("react-force-graph-3d", () => ({
  default: (props: Record<string, any>) => {
    lastForceGraph3DProps = props;
    return (
      <div
        data-testid="force-graph-3d"
        data-node-count={props.graphData?.nodes?.length ?? 0}
      />
    );
  },
}));
```

**useThemeColors mock** (CodeVaultGraph.test.tsx lines 49–64 — reuse verbatim):
```typescript
vi.mock("../../hooks/useThemeColors", () => ({
  useThemeColors: () => ({
    primary: "#10b981",
    primaryAlpha18: "rgba(16, 185, 129, 0.18)",
    primaryAlpha55: "rgba(16, 185, 129, 0.55)",
    accent: "#059669",
    vaultNode: "#8b5cf6",
    vaultNodeAlpha18: "rgba(139, 92, 246, 0.18)",
    chartBar: "#10b981",
    chartBarAccent: "#059669",
    statusOk: "#10b981",
    statusWarn: "#f59e0b",
    statusError: "#ef4444",
    statusInfo: "#3b82f6",
  }),
}));
```

**idb-keyval mock** (needed because ForceGraph3D test exercises the 3D render path, which requires the persistence hook):
```typescript
vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
}));
```

**beforeEach/afterEach pattern** (CodeVaultGraph.test.tsx lines 128–134):
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  lastForceGraph3DProps = {};
});

afterEach(() => {
  cleanup();
});
```

**SC#5 color assertion pattern** (CodeVaultGraph.test.tsx lines 378–396):
```typescript
it("colorFn3D returns colors.primary for code nodes (hex) and colors.vaultNode for vault nodes (hex)", () => {
  // ... render ForceGraph3D with fixture ...
  const capturedColorFn = lastForceGraph3DProps.nodeColor;
  expect(typeof capturedColorFn).toBe("function");

  const codeNode = { source: "codepulse", id: "graphify:codepulse:src/a.ts" };
  expect(capturedColorFn(codeNode)).toBe("#10b981"); // mocked primary — hex, no alpha

  const vaultNode = { source: "vault", id: "vault:Note.md" };
  expect(capturedColorFn(vaultNode)).toBe("#8b5cf6"); // mocked vaultNode — hex
});
```

---

### `src/lib/graph-center.ts` (extend with `centerNode3DWhenReady`)

**Analog:** `src/lib/graph-center.ts` lines 30–61 — `centerNodeWhenReady`

**Existing pattern to mirror** (graph-center.ts lines 30–61):
```typescript
export function centerNodeWhenReady(
  fgRef: { current: CenterableHandle | null },
  node: { x?: number; y?: number } | null | undefined,
  opts: CenterWhenReadyOptions = {},
): () => void {
  const { ms = 800, zoom = 3, maxFrames = 90 } = opts;
  let cancelled = false;
  let frames = 0;

  const schedule: (cb: () => void) => void =
    typeof requestAnimationFrame === "function"
      ? (cb) => requestAnimationFrame(() => cb())
      : (cb) => { setTimeout(cb, 16); };

  const tick = () => {
    if (cancelled || !node) return;
    if (node.x != null && node.y != null) {
      fgRef.current?.centerAt(node.x, node.y, ms);
      fgRef.current?.zoom(zoom, ms);
      return;
    }
    if (frames++ < maxFrames) schedule(tick);
  };

  tick();
  return () => { cancelled = true; };
}
```

**New function signature** (add below existing, same file):
```typescript
export interface Centerable3DHandle {
  cameraPosition: (
    position: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number } | null,
    ms?: number
  ) => void;
  zoomToFit: (ms?: number, px?: number) => void;
}

export function centerNode3DWhenReady(
  fgRef: { current: Centerable3DHandle | null },
  node: { x?: number; y?: number; z?: number } | null | undefined,
  ms = 800,
  maxFrames = 90,
): () => void {
  let cancelled = false;
  let frames = 0;

  const schedule = typeof requestAnimationFrame === "function"
    ? (cb: () => void) => requestAnimationFrame(() => cb())
    : (cb: () => void) => setTimeout(cb, 16);

  const tick = () => {
    if (cancelled || !node) return;
    if (node.x != null && node.y != null) {
      fgRef.current?.cameraPosition(
        { x: node.x, y: node.y, z: (node.z ?? 0) + 150 }, // pull camera back from z
        { x: node.x, y: node.y, z: node.z ?? 0 },          // look AT the node
        ms
      );
      return;
    }
    if (frames++ < maxFrames) schedule(tick);
  };

  tick();
  return () => { cancelled = true; };
}
```

**Wiring in GraphContent** (mirrors useFocusParam onFocus wiring at CodeVaultGraph.tsx lines 152–160):
```typescript
const { fromParam } = useFocusParam({
  nodes: snapshot.nodes,
  getId: (n) => n.id,
  onFocus: (node) => {
    setSelectedNodeId(node.id);
    if (renderMode === "2d") {
      // Existing 2D path — unchanged
      centerNodeWhenReady(fgRef2d, node as { x?: number; y?: number });
    } else {
      // 3D branch — cameraPosition instead of centerAt/zoom
      centerNode3DWhenReady(fgRef3d, node as { x?: number; y?: number; z?: number });
    }
  },
});
```

---

## Shared Patterns

### Theme-Aware Colors
**Source:** `src/hooks/useThemeColors.ts` lines 86–106
**Apply to:** `ForceGraph3D.tsx` (via props from `GraphContent`), `CodeVaultGraph.tsx` color callbacks

```typescript
// Already wired in GraphContent; consume via props passed to ForceGraph3D
const colors = useThemeColors(); // line 120 of CodeVaultGraph.tsx

// ThemeColors interface (useThemeColors.ts lines 14–27):
// colors.primary        — hex string, code node color
// colors.vaultNode      — hex string, vault node color
// colors.primaryAlpha18 — rgba string (NOT safe for 3D nodeColor — rgba ignored by Three.js)
// colors.vaultNodeAlpha18 — rgba string (NOT safe for 3D nodeColor)
```

**Critical 3D constraint:** `colors.primary` and `colors.vaultNode` (hex fields) are safe for `nodeColor`/`linkColor`. The `alpha18`/`alpha55` variants are **NOT safe** — Three.js `Color` drops rgba alpha silently, producing black nodes. Use `linkOpacity={0.2}` for global link transparency instead.

### MutationObserver re-resolve pattern
**Source:** `src/hooks/useThemeColors.ts` lines 86–106
**Apply to:** No new hook needed — `GraphContent` already calls `useThemeColors()` once; theme changes retrigger `colorFn3D`/`linkColorFn3D` recomputation. Wire the `refresh()` effect (Pattern 4) to re-draw after `colors` changes.

### useCallback([colors]) re-creation on theme switch
**Source:** `src/components/graph/CodeVaultGraph.tsx` lines 125–128 and 133–147
**Apply to:** `colorFn3D`, `nodeValFn3D`, `linkColorFn3D` in `GraphContent`

```typescript
const colorFn = useCallback(
  (node: any): string => isVaultNode(node) ? colors.vaultNode : colors.primary,
  [colors],  // re-creates on every theme switch
);
```
All 3D color callbacks follow this same dep array: `[colors]`, `[selectedNodeId, hoveredNodeId, neighborIds, colors]`, etc.

### canvasClass / containerClass pattern
**Source:** `src/components/graph/CodeVaultGraph.tsx` lines 319–326
**Apply to:** The 3D render slot — use the SAME `canvasClass` string for the wrapper div around `<LazyForceGraph3D>` so fullscreen sizing applies identically to both modes.

```typescript
const canvasClass = fullscreen
  ? "relative w-full h-[calc(100vh-48px)] overflow-hidden bg-[#09090b]"
  : "relative w-full h-[600px] rounded-[var(--radius)] border border-primary/20 overflow-hidden bg-[#09090b]";
```

### Conditional Render Guard (renderMode state)
**Source:** No existing analog for `renderMode` — new state, but follows the same `useState` pattern used for `sourceFilter` (CodeVaultGraph.tsx line 113) and `fullscreen` (line 115).

```typescript
const [sourceFilter, setSourceFilter] = useState<SourceFilter>("both");
const [fullscreen, setFullscreen] = useState(false);
// New (Phase 91):
const [renderMode, setRenderMode] = useState<"2d" | "3d">("2d");
```

---

## No Analog Found

None. All files have a strong analog in the codebase. The `react-force-graph-3d` library API patterns (prop baseline, `cameraPosition`, `refresh()`) are covered by RESEARCH.md Patterns 1–8 where no codebase analog exists for the specific 3D imperative methods.

---

## Metadata

**Analog search scope:** `src/components/graph/`, `src/hooks/`, `src/lib/`, `src/App.tsx`, `src/components/graph/CodeVaultGraph.test.tsx`
**Files read:** 7 source files (ForceGraphCanvas.tsx, CodeVaultGraph.tsx, CodeVaultGraph.test.tsx, useThemeColors.ts, useKnowledgeGraph.ts, graph-center.ts, useFocusParam.ts, App.tsx)
**Pattern extraction date:** 2026-06-29
