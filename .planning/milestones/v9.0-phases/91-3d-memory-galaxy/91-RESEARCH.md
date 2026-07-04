# Phase 91: 3D Memory Galaxy — Research

**Researched:** 2026-06-29
**Domain:** react-force-graph-3d / Three.js / React lazy-loading / WebGL lifecycle
**Confidence:** HIGH — all prop signatures verified against live GitHub source; disposal chain
  traced through actual library source (`three-render-objects`); chunk isolation confirmed
  against Vite/Rollup code-splitting mechanics. Three.js is not yet in the project, which
  simplifies isolation guarantees.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 Full parity** — 3D mode swaps only the render surface inside the existing `GraphContent`
  shell. All surrounding chrome and interaction (detail panel, source filter, fullscreen, `?focus=`
  deep-link centering, KG cross-graph links, neighbor navigation) stays mounted and functional in
  both modes. Switching modes does not unmount or reset those surfaces.
- **D-01a** — "Full parity" applies to the interaction shell, not paint primitives. The 2D
  `paintNode` canvas ring + community halo does NOT translate. 3D encoding is library-native:
  `nodeColor`, `nodeVal`/`nodeRelSize` for size, selection emphasis via color/size.
- **D-01b** — Focus-param centering paths differ. The 3D path uses `cameraPosition()` /
  `zoomToFit()` with different signatures; the plan must wire a mode-conditional ref.
- **D-02 Spheres + hover-only labels** — Nodes render as 3D spheres colored by active theme.
  Labels appear on hover only via `nodeLabel` tooltip. No always-on text sprites.
- **D-02a** — Dark backdrop `#09090b` consistent with 2D surface.
- **D-03 Ship opt-in, no runtime fallback** — No auto-degradation path. ≥30 FPS gate is a manual
  benchmark checkpoint before shipping, not shipped UI.
- **D-03a** — WebGL context disposal on 2D↔3D toggle is mandatory (SC#4), independent of D-03.
- **D-04 Segmented `2D | 3D` control** — Adjacent to fullscreen button, styled to match the
  `chipClass` source-filter pattern (`aria-pressed`, `role="group"`).
- **Library locked:** `react-force-graph-3d` + `three` (NOT R3F / `@react-three/fiber`).
- **Lazy-loading locked:** `React.lazy` / `Suspense` so three.js never appears in the 2D bundle.
- **Persistence locked:** `idb-keyval`, key `"codepulse:render-mode"`, value `"2d" | "3d"`,
  default `"2d"`.
- **Color locked:** 3D node/link colors via `useThemeColors()` — no hardcoded hex (SC#5).
- **No Convex change this phase** — reuses existing `ProjectGraphData` / `useProjectGraph`.
- **2D path unchanged** — SC#1 regression gate; `ForceGraphCanvas.tsx` untouched.

### Claude's Discretion

- Exact prop tuning (`cooldownTicks`, `warmupTicks`, `nodeResolution`, `linkOpacity`, sphere
  radius) to hit ≥30 FPS — researcher/planner to determine empirically against the live snapshot.
- Internal structure of the render-surface swap (e.g., how `renderMode` state lifts into
  `GraphContent`, where the `React.lazy` declaration lives).
- Where exactly the `idb-keyval` read/write of toggle state is wired (hook vs inline effect).

### Deferred Ideas (OUT OF SCOPE)

- R3F (`@react-three/fiber` + `@react-three/drei`) render path.
- 3D post-processing (bloom/glow).
- 3D community-cluster bubbles + node-size-by-degree.
- A dedicated immersive 3D page/route.
- Runtime performance auto-degradation / low-FPS warning.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| G3D-01 | Opt-in 3D render mode toggle on `CodeVaultGraph`, backed by `react-force-graph-3d` + `three`, lazy-loaded so the 2D default path never bundles three.js; reuses `ProjectGraphData` / `useProjectGraph` (no Convex change); toggle state persists to `idb-keyval`. | §Standard Stack covers the library; §Vite lazy chunk isolation covers SC#2; §idb-keyval covers persistence pattern. |
| G3D-02 | 3D mode renders the ~4,038-node production graph at ≥30 FPS; disposes the WebGL context cleanly on 2D↔3D toggle (no leak); colors nodes via `useThemeColors()` so 3D is theme-aware. The 2D render path is unchanged. | §FPS levers covers the prop baseline; §WebGL disposal covers the teardown chain; §Theme color re-resolution covers SC#5. |

</phase_requirements>

---

## Summary

Phase 91 adds `react-force-graph-3d` (version 1.29.1, the same version number as the already-installed `react-force-graph-2d`) as a lazy-loaded alternative render surface inside the existing `CodeVaultGraph` / `GraphContent` shell. The library wraps `3d-force-graph` which in turn depends on `three >=0.179 <1`; the latest compatible three.js is `0.185.0` (released 2026-06-25). Both packages are `[OK]` per slopcheck.

**The most consequential research findings are:**

1. `react-force-graph-3d` handles WebGL disposal automatically on React unmount — unmounting `<ForceGraph3D>` is sufficient; no manual `_destructor` call needed.
2. `three` will be isolated to the lazy chunk automatically because it is not currently in the project's dependency tree and is only reachable through the lazy-loaded component.
3. After the simulation settles (`onEngineStop`), the animation loop stops. Any subsequent state change that affects `nodeColor` or `nodeVal` (selection, hover, theme switch) requires an explicit `fgRef3d.current?.refresh()` call to redraw.
4. Three.js `Color` does NOT parse `rgba()` strings — all 3D node/link color values must be plain hex. The `primaryAlpha18` / `vaultNodeAlpha18` alpha variants from `useThemeColors()` must NOT be used for `nodeColor` or `linkColor`; use `colors.primary` / `colors.vaultNode` hex values instead, and rely on `linkOpacity={0.2}` for global link transparency.
5. `cooldownTicks` defaults to `Infinity` in `react-force-graph-3d` — unlike 2D which also defaults to `Infinity` but the existing `ForceGraphCanvas` hardcodes `cooldownTicks={120}`. For 3D at 4k nodes, setting `cooldownTicks={150}` is the most important single FPS lever alongside `nodeResolution={6}`.

**Primary recommendation:** The planner should scope to four implementation tasks: (1) install + lazy-wrap, (2) toggle UI + idb persistence, (3) 3D render surface with correct nodeColor/nodeVal/refresh wiring, (4) FPS gate checkpoint. The codebase patterns (chipClass, useCallback[colors], useFocusParam, idb-keyval) are all directly reusable.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 3D graph rendering | Browser / Client | — | WebGL canvas runs in the browser; Three.js never leaves the client |
| Toggle state (`renderMode`) | Browser / Client | — | `useState` + `idb-keyval` — client-side only, no server |
| Graph data (`filteredData`) | Browser / Client | API/Backend (Convex) | `useProjectGraph()` reads from Convex `graphSnapshots` table; filtering is client-side |
| Theme color resolution | Browser / Client | — | `useThemeColors()` reads CSSOM via `getComputedStyle` — browser only |
| `?focus=` centering | Browser / Client | — | URL param → `useFocusParam` → graph ref calls; all client |
| WebGL disposal | Browser / Client | — | `renderer.dispose()` happens in the browser on React unmount |
| Vite chunk isolation | Build / CDN | — | Rollup code splitting at build time; serves lazy chunk from CDN/static |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-force-graph-3d` | `^1.29.1` | 3D force-directed graph render surface | Maintained by the same author as `react-force-graph-2d` already in the project; same React prop API surface; ~99 published versions since 2018 |
| `three` | `>=0.179 <1` (latest: `0.185.0`) | WebGL renderer (transitively required by `3d-force-graph`) | Three.js is the standard WebGL library; the version constraint is owned by `3d-force-graph`'s dependency declaration |
| `idb-keyval` | `^6.2.4` (already installed) | Toggle state persistence | Already in `package.json`; minimal API (`get`/`set`) |
| `react` `lazy` / `Suspense` | (React 19 — already installed) | Code-split three.js out of the main bundle | Standard React pattern; already used in `App.tsx` for Agents/Analytics/etc. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useThemeColors` (internal) | Phase 89 hook | Resolve CSS custom properties to hex for Three.js | Used inside `colorFn3D` and `linkColorFn3D`; same as 2D |
| `centerNodeWhenReady` (internal) | Phase 85 helper | Poll for node x/y/z coords before centering camera | For 3D: needs a separate branch using `cameraPosition()` instead of `centerAt()` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-force-graph-3d` | `@react-three/fiber` + custom force graph | R3F would give post-processing but requires ~300 KB more and a full `<Canvas>`/`useFrame` rewrite — explicitly deferred |
| Lazy-load wrapper component | Dynamic `import()` inside an effect | Effect-based import is harder to integrate with Suspense and harder to test |

**Installation:**

```bash
npm install react-force-graph-3d
```

Note: `three` is installed transitively as a dependency of `3d-force-graph` (which `react-force-graph-3d` depends on). No separate `npm install three` is needed. [VERIFIED: npm registry — `3d-force-graph@1.80.0` lists `three: >=0.179 <1` as a direct dependency]

**Version verification:**

```bash
npm view react-force-graph-3d version   # 1.29.1 [VERIFIED: npm registry]
npm view three version                  # 0.185.0 [VERIFIED: npm registry, 2026-06-25]
npm view 3d-force-graph version         # 1.80.0 [VERIFIED: npm registry]
```

---

## Package Legitimacy Audit

> slopcheck run 2026-06-29. Both packages passed.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `react-force-graph-3d` | npm | ~8 yrs (created 2018-10-09) | High (established OSS) | github.com/vasturiano/react-force-graph | [OK] | Approved |
| `three` | npm | ~14 yrs (created 2012-12-07) | Extremely high (standard WebGL lib) | github.com/mrdoob/three.js | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Postinstall scripts:** Neither package has a `postinstall` script. [VERIFIED: npm view]

---

## Architecture Patterns

### System Architecture Diagram

```
URL ?focus= param
        │
        ▼
useFocusParam()  ──────────────────────────────────────────────┐
        │                                                       │
        ▼                                                       │
renderMode state ("2d" | "3d")                                 │
  ┌─────┴──────┐                                               │
  │            │                                               │
  ▼            ▼                                               │
<ForceGraph   React.lazy(<ForceGraph3D>)                       │
 Canvas>       │                                               │
  │            │  Suspense fallback: "Loading 3D render…"      │
  │            ▼                                               │
  │     three.js WebGL canvas                                  │
  │            │                                               │
  └─────┬──────┘                                               │
        │ onNodeClick / onNodeHover / onBackgroundClick         │
        ▼                                                       │
  setSelectedNodeId / setHoveredNodeId ◄──────────────────────┘
        │
        ▼
  Detail panel + neighbor nav + KG cross-links (JSX, unchanged)
        │
        ▼
 idb-keyval write on toggle
        │
        ▼
 "codepulse:render-mode" stored in IndexedDB
```

Data flow into both render surfaces:

```
useProjectGraph() → graphSnapshots Convex table
        │
        ▼
filteredData (client-side source filter memo)
        │
   ┌────┴────┐
   │         │
  2D         3D
  data prop  graphData prop (same shape: {nodes, links})
```

### Recommended Project Structure

```
src/
├── components/
│   └── graph/
│       ├── CodeVaultGraph.tsx       # host surface — adds renderMode state + toggle UI
│       ├── ForceGraphCanvas.tsx     # 2D path — UNCHANGED
│       └── ForceGraph3D.tsx         # NEW — thin wrapper over react-force-graph-3d
├── hooks/
│   └── useThemeColors.ts            # already exists (Phase 89) — no change
├── lib/
│   └── graph-center.ts              # already exists — add centerNode3DWhenReady or
│                                    # extend centerNodeWhenReady with a 3D branch
```

**`ForceGraph3D.tsx` role:** A thin lazy-boundary wrapper. Its sole job is to:
1. Import from `react-force-graph-3d` (so the dynamic import boundary isolates three.js)
2. Expose a `ForwardRefExoticComponent` with a `ForceGraph3DHandle` interface
3. Forward all graph-relevant props received from `GraphContent`

**`React.lazy` declaration:** Placed at the module level of `CodeVaultGraph.tsx` (outside `GraphContent`) to avoid the "lazy inside component" React warning:

```typescript
// At top of CodeVaultGraph.tsx — outside GraphContent
const LazyForceGraph3D = React.lazy(() => import("./ForceGraph3D"));
```

### Pattern 1: Lazy boundary wrapping

**What:** Declare the lazy import outside any component, wrap in Suspense where rendered.

**When to use:** Any time a heavy dependency (three.js ~800KB) must be excluded from the main bundle.

```typescript
// Source: existing App.tsx pattern (Agents, Analytics, WarRoom, etc.)
// Module level — OUTSIDE GraphContent
const LazyForceGraph3D = React.lazy(() => import("./ForceGraph3D"));

// Inside GraphContent render:
{renderMode === "3d" && (
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
)}
```

### Pattern 2: ForceGraph3D prop baseline

**What:** Starting prop values calibrated for ≥30 FPS at ~4,038 nodes.

```typescript
// Source: react-force-graph README (https://github.com/vasturiano/react-force-graph)
// plus UI-SPEC §"3D Sphere Geometry Props"
<ForceGraph3D
  ref={fgRef3d}
  graphData={filteredData}          // {nodes, links} — same shape as 2D data
  nodeId="id"
  nodeLabel={labelFn}               // hover-only tooltip; NO always-on sprites
  nodeColor={colorFn3D}             // hex string only — no rgba (Three.js Color ignores alpha)
  nodeVal={nodeValFn3D}             // selected node val*3 for size bump
  nodeRelSize={4}                   // sphere radius = nodeRelSize * ∛(nodeVal)
  nodeResolution={6}                // FPS lever: 6 vs default 8 cuts triangles ~44%
  linkColor={linkColorFn3D}         // hex string only
  linkOpacity={0.2}                 // global link transparency (replaces per-link alpha)
  linkWidth={0.6}                   // matches 2D linkWidthFn ?? (() => 0.6)
  backgroundColor="#09090b"         // dark space backdrop (hardcoded — not a theme token)
  cooldownTicks={150}               // simulation stops after 150 frames; ~2.5s at 60fps
  warmupTicks={0}                   // render immediately; layout settles visually
  d3VelocityDecay={0.3}             // matches 2D d3VelocityDecay={0.3}
  onNodeClick={(node: any) => setSelectedNodeId(node.id)}
  onNodeHover={(node: any | null) => setHoveredNodeId(node?.id ?? null)}
  onBackgroundClick={() => setSelectedNodeId(null)}
  onEngineStop={() => fgRef3d.current?.zoomToFit(400, 60)}
/>
```

### Pattern 3: `colorFn3D` — hex only, state-dependent

The 2D `paintNode` receives canvas context and can draw with `ctx.globalAlpha`. Three.js `Color`
does NOT parse `rgba()` strings — alpha is dropped. Dimming is achieved by substituting a dark
solid neutral.

```typescript
// Source: UI-SPEC §"Node State Encoding Table"
// Depends on: selectedNodeId, hoveredNodeId, neighborIds Set, colors (ThemeColors)
const colorFn3D = useCallback(
  (node: any): string => {
    if (node.id === selectedNodeId) return "#ffffff";
    if (node.id === hoveredNodeId) return "#ffffff";
    if (selectedNodeId && !neighborIds.has(node.id)) return "#27272a"; // zinc-800 dim
    return isVaultNode(node) ? colors.vaultNode : colors.primary;
  },
  [selectedNodeId, hoveredNodeId, neighborIds, colors]
);

const nodeValFn3D = useCallback(
  (node: any): number => (node.id === selectedNodeId ? (node.val ?? 1) * 3 : (node.val ?? 1)),
  [selectedNodeId]
);

// linkColorFn3D — hex strings only (no alpha variants)
const linkColorFn3D = useCallback(
  (link: any): string => {
    const srcIsVault = typeof link.source === "string"
      ? link.source.startsWith("vault:")
      : link.source?.source?.startsWith("vault:") ?? false;
    const tgtIsVault = typeof link.target === "string"
      ? link.target.startsWith("vault:")
      : link.target?.source?.startsWith("vault:") ?? false;
    if (srcIsVault && tgtIsVault) return colors.vaultNode;   // hex — alpha via linkOpacity
    if (!srcIsVault && !tgtIsVault) return colors.primary;   // hex — alpha via linkOpacity
    return "#94a3b8"; // muted neutral for cross-source (hex)
  },
  [colors]
);
```

### Pattern 4: `refresh()` after simulation stops

Once `onEngineStop` fires, the Three.js render loop stops. Subsequent state changes (selection,
hover, theme) must trigger a `refresh()` call to redraw. [VERIFIED: react-force-graph README
`refresh()` docs — "Redraws all nodes/links"]

```typescript
// Source: react-force-graph imperative API
// Must fire whenever colorFn3D deps change AND 3D is active
useEffect(() => {
  if (renderMode !== "3d") return;
  fgRef3d.current?.refresh();
}, [selectedNodeId, hoveredNodeId, colors, renderMode]);
```

### Pattern 5: 3D focus centering

The 2D `centerNodeWhenReady` uses `centerAt(x, y, ms)` + `zoom(k, ms)`. The 3D equivalent uses
`cameraPosition({x, y, z}, lookAt, ms)`. [VERIFIED: react-force-graph README imperative methods]

```typescript
// Source: react-force-graph README §"Imperative methods" + UI-SPEC §"Interaction Parity Contract"
// Called from useFocusParam onFocus when renderMode === "3d"
function centerNode3DWhenReady(
  fgRef: { current: ForceGraph3DHandle | null },
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

### Pattern 6: WebGL disposal

The library's disposal chain is automatic. Unmounting `<ForceGraph3D>` is sufficient:

1. React unmount → `react-kapsule`'s `useEffectOnce` cleanup fires `comp._destructor()`
2. `_destructor` delegates to `three-render-objects._destructor`
3. `three-render-objects._destructor` calls:
   - `emptyObject(state.scene)` — removes all Three.js objects from the scene
   - `state.controls?.dispose()` — releases camera controls
   - `state.renderer?.dispose()` — releases WebGL context, programs, textures, and buffers
   - `state.postProcessingComposer?.dispose()`

[VERIFIED: three-render-objects GitHub source — `_destructor` function inspected directly]

**No manual call needed.** The UI-SPEC's suggestion of `graphRef.current?._destructor?.()` in a
`useEffect` cleanup is correct as a defensive measure but is redundant — `renderer.dispose()` is
idempotent so calling it twice is harmless.

### Pattern 7: idb-keyval persistence

Mirrors the existing `useKnowledgeGraph.ts` pattern. [VERIFIED: src/hooks/useKnowledgeGraph.ts]

```typescript
// Source: existing idb-keyval usage in src/hooks/useKnowledgeGraph.ts (Phase 87)
import { get as idbGet, set as idbSet } from "idb-keyval";

const [renderMode, setRenderMode] = useState<"2d" | "3d">("2d");

// Hydrate from IDB on mount — async, resolves before first graph render
useEffect(() => {
  idbGet("codepulse:render-mode").then((saved) => {
    if (saved === "3d") setRenderMode("3d");
  }).catch(() => { /* private browsing / IDB unavailable — stay on 2d */ });
}, []);

// Persist on toggle
const handleModeToggle = (mode: "2d" | "3d") => {
  setRenderMode(mode);
  idbSet("codepulse:render-mode", mode).catch(() => { /* best effort */ });
};
```

**No flash risk:** The graph snapshot loads from Convex asynchronously. By the time
`GraphContent` renders the graph, the IDB read has already resolved. If user persisted "3d" and
reloads, the flow is: mount (state="2d") → IDB resolves to "3d" → lazy chunk loads →
Suspense fallback shows "Loading 3D render…" → Three.js chunk loads → 3D renders. This is
correct and matches the UI-SPEC state machine.

### Pattern 8: ForceGraph3DHandle interface

Define a local handle interface (do not import from `react-force-graph-3d` types — the library
uses `any`-typed internals):

```typescript
// Source: react-force-graph README §"Imperative methods"
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

### Anti-Patterns to Avoid

- **`rgba()` colors in `nodeColor` / `linkColor`:** Three.js `Color` ignores alpha. Use hex
  strings and `linkOpacity` for global transparency. Using `colors.primaryAlpha18` in
  `nodeColor` will result in unparseable input and fallback to black nodes.
- **Always-on `nodeLabel` text sprites at 4k nodes:** The `nodeLabel` tooltip is rendered as
  an HTML overlay on hover only — no Three.js `TextGeometry` sprites. Switching to sprites
  (e.g., `nodeThreeObject`) for all 4k nodes would murder FPS.
- **Importing from `react-force-graph-3d` outside the lazy component:** Any static import of
  `react-force-graph-3d` (or `three`) from files reachable via the main entry will break SC#2
  by pulling three.js into the main bundle.
- **Calling `refresh()` before `onEngineStop`:** During simulation, the animation loop already
  renders every frame; calling `refresh()` during simulation is harmless but wasteful. Only call
  it after the simulation stops.
- **Re-declaring `React.lazy` inside `GraphContent`:** Must be at module level to avoid React's
  "lazy inside a component" warning that causes unnecessary remounts.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 3D force-directed layout | Custom Three.js scene + d3-force | `react-force-graph-3d` | Library already wires Three.js + d3-force-3d + camera controls + interaction |
| WebGL context cleanup | Manual renderer teardown sequence | Rely on library's `_destructor` (automatic on unmount) | Library already calls `renderer.dispose()`, `emptyObject(scene)`, `controls.dispose()` in sequence |
| Toggle state persistence | Custom localStorage JSON | `idb-keyval` (already installed) | IDB survives private browsing in more contexts; already used in KG hook |
| Lazy chunk isolation | Webpack `splitChunks` config | `React.lazy` + `Suspense` | Vite/Rollup handles it automatically at dynamic import boundaries |
| 3D hover tooltip | Custom HTML overlay | `nodeLabel` prop | Library renders tooltip HTML automatically on hover |

**Key insight:** react-force-graph-3d eliminates ~500 lines of Three.js boilerplate (scene setup, camera, lighting, animation loop, raycasting, resize observer). The FPS and disposal complexity is already handled.

---

## Common Pitfalls

### Pitfall 1: rgba colors silently produce black nodes

**What goes wrong:** `nodeColor` returns `rgba(16, 185, 129, 0.18)`. Three.js `Color` constructor parses the string, finds it starts with "rgba", falls back to black (#000000) or throws. All nodes render black on the dark backdrop and are invisible.

**Why it happens:** Three.js `Color` supports hex strings and CSS named colors but does NOT support `rgba(r, g, b, a)` format. Alpha is handled at the Material level, not the Color level.

**How to avoid:** Use the hex fields from `useThemeColors()` (`colors.primary`, `colors.vaultNode`) for `nodeColor`. Use `linkOpacity={0.2}` for global link transparency instead of per-link alpha strings.

**Warning signs:** Graph renders with zero visible nodes, or all nodes appear as black spheres.

### Pitfall 2: three.js imported statically → main bundle bloat (SC#2 failure)

**What goes wrong:** A developer imports a utility from `three` or from `react-force-graph-3d` directly in a file that is statically imported from `CodeVaultGraph.tsx` or the main entry. Vite's tree-shaker sees the static reference and includes three.js in the main bundle.

**Why it happens:** Vite's chunk splitting only creates a lazy boundary at dynamic import (`import()`) boundaries. Any static `import ... from "three"` in a non-lazy file pulls three.js into the main chunk.

**How to avoid:** All references to `three`, `react-force-graph-3d`, and `3d-force-graph` must exist ONLY inside `ForceGraph3D.tsx` — the file that is dynamically imported via `React.lazy`.

**Warning signs:** `vite build` output shows the main `index-[hash].js` chunk is larger than expected (>2MB); `grep -c "three"` on `dist/assets/index-*.js` returns non-zero.

### Pitfall 3: `cooldownTicks={Infinity}` — simulation never stops

**What goes wrong:** `cooldownTicks` defaults to `Infinity`. If left at default, the simulation runs forever, consuming CPU on every animation frame indefinitely. `onEngineStop` never fires so `zoomToFit(400, 60)` is never called.

**Why it happens:** The react-force-graph-3d default for `cooldownTicks` is `Infinity` (unlike 2D which also defaults to `Infinity` but the existing `ForceGraphCanvas` overrides to 120). [VERIFIED: react-force-graph README]

**How to avoid:** Always set `cooldownTicks={150}` (or similar finite value) on the 3D component. Confirm `onEngineStop` fires by logging during development.

**Warning signs:** CPU stays high after the graph layout visually settles; `zoomToFit` never runs; fan noise.

### Pitfall 4: colors don't update after theme switch

**What goes wrong:** The operator switches from Electric Cyan to Matrix Emerald. The 3D graph continues to show the old theme colors because `refresh()` was not called after the theme change.

**Why it happens:** After `onEngineStop`, the Three.js render loop stops. Prop changes to `nodeColor` update the kapsule internal state but don't trigger a new render frame without an explicit `refresh()`.

**How to avoid:** Add `useEffect(() => { if (renderMode !== "3d") return; fgRef3d.current?.refresh(); }, [colors, renderMode])` so a theme switch in 3D mode triggers a redraw.

**Warning signs:** Node colors don't change after using the theme switcher in 3D mode.

### Pitfall 5: `nodeVal` not wrapped in `useCallback` — spurious refreshes

**What goes wrong:** `nodeValFn3D` is declared inline as `(node) => node.id === selectedNodeId ? ...`. Every render creates a new function reference, causing the library to update all sphere sizes on every render, even unrelated re-renders.

**Why it happens:** React passes a new function reference to the kapsule setter, which triggers internal state changes and potentially a redraw.

**How to avoid:** Wrap `nodeValFn3D` and `colorFn3D` in `useCallback([selectedNodeId, hoveredNodeId, neighborIds, colors])` just like the 2D `colorFn` and `linkColorFn`.

### Pitfall 6: `cameraPosition` lookAt origin ignores node coords

**What goes wrong:** `fgRef3d.current?.cameraPosition({x: node.x, y: node.y, z: 100}, null, 800)` moves the camera but doesn't point it AT the node — the camera looks at `{x:0, y:0, z:0}` by default (the scene origin). For nodes far from the origin, the camera focuses on empty space.

**Why it happens:** The second argument to `cameraPosition` is the `lookAt` point. Passing `null` keeps whatever the previous lookAt was.

**How to avoid:** Pass the node coordinates as the lookAt: `cameraPosition({x, y, z: zCamera}, {x, y, z}, ms)` where `zCamera` is the node's z plus a pull-back offset (e.g., `node.z + 150`).

### Pitfall 7: idb-keyval restores "3d" but chunk is not yet loaded

**What goes wrong:** Page reloads with IDB value "3d". The component sets `renderMode = "3d"`, causing `<LazyForceGraph3D>` to mount. The `Suspense` fallback shows "Loading 3D render…" briefly. This is CORRECT behavior and expected per the UI-SPEC state machine — not a bug.

**Why it "happens":** The lazy chunk must be fetched from the CDN/server. This is a one-time ~800KB download on the first 3D session; subsequent reloads use the browser cache.

**How to avoid:** N/A — this is correct behavior per the UI-SPEC toggle state machine.

---

## Runtime State Inventory

> This phase adds new state (idb-keyval key) and a new lazy chunk. No renaming/refactoring involved.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | New: `"codepulse:render-mode"` key in IndexedDB, written by this phase | Code write — this phase creates it; no migration of existing data |
| Live service config | None — no Convex change this phase | None |
| OS-registered state | None | None |
| Secrets/env vars | None — no new env vars | None |
| Build artifacts | New lazy chunk `ForceGraph3D-[hash].js` in `dist/assets/` after build | SC#2 verification: confirm chunk exists and is separate from `index-[hash].js` |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + jsdom |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| SC# | Behavior | Test Type | Automated Command | Notes |
|-----|----------|-----------|-------------------|-------|
| SC#1 | 2D render path unchanged; toggle switches render surface; switching back to 2D restores `ForceGraphCanvas` | Unit (jsdom) | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` | Mock `react-force-graph-3d`; assert `ForceGraphCanvas` re-appears after toggling 2D→3D→2D |
| SC#2 | `three` isolated to lazy chunk; main bundle has no three.js | Build manifest check | `npm run build && ls dist/assets/*.js` — check no `three` in `index-*.js` | Manual or CI step; grep for `SphereGeometry` or `WebGLRenderer` in main chunk |
| SC#3 | ≥30 FPS at live ~4,038-node snapshot | Manual benchmark | N/A — manual FPS benchmark with Chrome DevTools Performance panel against live `graphSnapshots` data | Plan must include a gate/checkpoint task with explicit pass/fail criteria |
| SC#4 | WebGL context disposed cleanly; idb-keyval persists mode | Unit (disposal) + Manual (leak) | `npx vitest run src/components/graph/ForceGraph3D.test.tsx` (disposal mock check) | DevTools Memory snapshot after 3+ toggles — no orphaned WebGLRenderingContext |
| SC#5 | 3D node colors respect active theme; no hardcoded hex | Unit (jsdom) | `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` | Assert `colorFn3D` returns `colors.primary` / `colors.vaultNode` for code/vault nodes |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/graph/` (covers CodeVaultGraph + ForceGraph3D tests)
- **Per wave merge:** `npm test` (full Vitest suite)
- **Phase gate:** Full suite green + SC#2 build manifest check + SC#3 manual FPS gate before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/graph/ForceGraph3D.test.tsx` — covers SC#1 (toggle), SC#4 (disposal mock), SC#5 (colorFn hex check)
- [ ] `react-force-graph-3d` vi.mock needed in test file (mirrors `ForceGraphCanvas` mock pattern in existing `CodeVaultGraph.test.tsx`)

*(No new test framework or shared fixtures needed — existing Vitest setup, `useThemeColors` mock pattern, and `ForceGraphCanvas` mock pattern are directly reusable)*

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-roll Three.js + custom force layout | `react-force-graph-3d` | 2018+ | Eliminates ~500 LOC of scene boilerplate |
| R3F (`@react-three/fiber`) for graph 3D | `react-force-graph-3d` (explicit decision D-03) | Phase 91 decision | Avoids ~300KB additional bundle + useFrame rewrite |
| `renderer.forceContextLoss()` for WebGL cleanup | `renderer.dispose()` (standard) | Three.js r100+ | `dispose()` is sufficient and idempotent; `forceContextLoss` is for testing only |
| Always-on text sprites | `nodeLabel` tooltip (hover-only) | Documented best practice | Sprites for 4k nodes are the #1 FPS killer; tooltips are HTML overlays with zero GPU cost |

**Deprecated/outdated:**
- `nodeThreeObject` with `TextGeometry` per-node: Correct API but wrong use case for large graphs — use `nodeLabel` prop instead.
- `cooldownTicks: Infinity` (default): Must override to a finite value for production use so simulation terminates.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `renderer.dispose()` is idempotent — calling it twice (once via react-kapsule, once via optional manual useEffect cleanup) is harmless | §WebGL disposal | Low: if not idempotent, double-dispose could throw a Three.js error at toggle time |
| A2 | After `onEngineStop`, `refresh()` triggers a full redraw of existing nodes with updated color function | §Pattern 4 | Medium: if refresh() is insufficient, colors won't update after theme switch in frozen simulation — needs empirical verification during implementation |
| A3 | The `nodeColor` function is called per-node on refresh (not cached per-render) | §colorFn3D pattern | Medium: if the library caches node material colors after initial creation, per-node `nodeColor` changes won't apply without `nodeThreeObject` override — verify empirically |
| A4 | `cameraPosition` with a `lookAt` argument correctly orients the camera to face the target node | §Pattern 5 | Low: well-documented API; worst case is camera ends up mis-aimed, fixable by adjusting coordinates |

---

## Open Questions

1. **Does `refresh()` re-apply `nodeColor` to existing spheres?**
   - What we know: `refresh()` is documented as "redraws all nodes/links" — this should trigger the `nodeColor` function for each node.
   - What's unclear: Whether Three.js sphere material colors are re-read from the accessor on each `refresh()` call or only on initial node creation.
   - Recommendation: Verify empirically in Wave 1 implementation. If `refresh()` is insufficient, fall back to `nodeThreeObject` for selected/hovered state encoding via material color mutation.

2. **`nodeVal` for selection bump — does prop change trigger sphere resize?**
   - What we know: `nodeVal` accepts a function. When `selectedNodeId` changes, `nodeValFn3D` recreates (new useCallback reference) and the new value is passed to the library setter.
   - What's unclear: Whether the kapsule setter triggers geometry update (sphere resize) or only affects new nodes.
   - Recommendation: Verify in Wave 1. If sphere resize doesn't work automatically, use `nodeThreeObjectExtend` with a material opacity/emissive approach for selection instead.

3. **`forceEngine` interaction with `d3VelocityDecay`**
   - The 3D version defaults to `d3VelocityDecay: 0.4`, the 2D version uses `0.3`. The UI-SPEC sets `d3VelocityDecay={0.3}` for 3D. At 4k nodes, lower decay may cause the simulation to run longer before settling. If `cooldownTicks={150}` is hit before the layout looks good, increase `warmupTicks` instead of `cooldownTicks`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Package install | ✓ | (project uses npm already) | — |
| Vite 7 | Chunk isolation (SC#2) | ✓ | `^7.3.1` | — |
| Convex `graphSnapshots` (live data) | SC#3 FPS gate | ✓ (live deployment) | current | Use saved JSON snapshot as fallback for FPS testing |
| Chrome DevTools | SC#3 FPS benchmark, SC#4 memory check | ✓ | (operator machine) | Firefox DevTools as fallback |
| `idb-keyval` | Toggle persistence | ✓ already installed | `^6.2.4` | — |
| `react-force-graph-3d` | 3D render | ✗ not yet installed | 1.29.1 (latest) | — |
| `three` (transitively) | 3D render | ✗ not yet installed | ≥0.179 via 3d-force-graph | — |

**Missing dependencies with no fallback:**
- `react-force-graph-3d` — must be installed (Wave 0 task)

---

## Security Domain

> Phase 91 adds no authentication, input validation, or cryptographic operations. The toggle
> state (`"2d" | "3d"`) is written to IndexedDB with no PII. Three.js runs entirely in the
> browser — no network calls from the 3D library.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | partial | idb-keyval read — coerce to `"2d" \| "3d"` with default fallback |
| V6 Cryptography | no | — |

The only security-adjacent concern: `idb-keyval` read result should be coerced:
```typescript
const saved = await idbGet("codepulse:render-mode");
if (saved === "3d") setRenderMode("3d");
// else stays "2d" — do NOT setRenderMode(saved) without validation
```

---

## Sources

### Primary (HIGH confidence)

- react-force-graph GitHub README (`vasturiano/react-force-graph`) — all prop names, types, defaults, and imperative method signatures [VERIFIED via WebFetch]
- react-kapsule source (`vasturiano/react-kapsule`) — confirmed `_destructor` lifecycle pattern for unmount cleanup [VERIFIED via WebFetch]
- three-render-objects source (`vasturiano/three-render-objects`) — confirmed `_destructor` calls `renderer.dispose()` / `controls.dispose()` / `emptyObject(scene)` [VERIFIED via WebFetch]
- npm registry — `react-force-graph-3d@1.29.1`, `three@0.185.0`, `3d-force-graph@1.80.0`, `three: >=0.179 <1` peer dep constraint [VERIFIED: npm view]
- slopcheck 0.6.1 — both packages [OK] [VERIFIED: ran locally 2026-06-29]

### Secondary (MEDIUM confidence)

- `src/components/graph/CodeVaultGraph.tsx` — live code audit for integration points (header right cluster ~L380-430, ForceGraphCanvas mount ~L478-494, chipClass pattern ~L329-332) [VERIFIED: Read tool]
- `src/components/graph/ForceGraphCanvas.tsx` — ForceGraphHandle interface, `centerAt`/`zoom`/`zoomToFit`/`d3Force`, cooldownTicks=120, d3VelocityDecay=0.3 [VERIFIED: Read tool]
- `src/lib/graph-center.ts` — centerNodeWhenReady pattern for 3D branch design [VERIFIED: Read tool]
- `src/hooks/useThemeColors.ts` — ThemeColors interface, MutationObserver re-resolve pattern [VERIFIED: Read tool]
- `src/hooks/useFocusParam.ts` — ref-agnostic onFocus pattern [VERIFIED: Read tool]
- `src/test/setup.ts` — global mocks (no Three.js global mock — per-file mock needed) [VERIFIED: Read tool]
- `src/components/graph/CodeVaultGraph.test.tsx` — ForceGraphCanvas mock pattern reusable for ForceGraph3D [VERIFIED: Read tool]

### Tertiary (LOW confidence)

- `nodeColor` / `nodeVal` prop changes triggering automatic redraw after simulation stop — not explicitly documented; inferred from kapsule state propagation model. [A2, A3 — verify empirically]

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard stack (react-force-graph-3d props) | HIGH | Verified against live GitHub README via WebFetch |
| WebGL disposal chain | HIGH | Traced through actual source of three-render-objects |
| Vite lazy chunk isolation | HIGH | Confirmed three.js is not in current package.json; dynamic import boundary is well-understood |
| FPS levers (nodeResolution, cooldownTicks) | MEDIUM | Starting values from UI-SPEC; empirical tuning required at gate checkpoint |
| `refresh()` behavior after simulation stop | MEDIUM | Documented API; interaction with frozen simulation loop needs empirical verification |
| `nodeColor` re-apply after prop change | LOW | Not explicitly documented; inferred from kapsule model (A2, A3) |

**Research date:** 2026-06-29
**Valid until:** 2026-07-30 (stable library — react-force-graph-3d publishes infrequently)
