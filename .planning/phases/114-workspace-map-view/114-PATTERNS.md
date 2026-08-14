# Phase 114: Workspace Map view - Pattern Map

**Mapped:** 2026-08-13
**Files analyzed:** 12 new files + 3 modified existing files
**Analogs found:** 15 / 15 (all files have a strong or exact analog; zero "no analog" entries)

All analogs below were independently re-read this pass (not taken on RESEARCH.md's/UI-SPEC.md's word) — every excerpt carries its own verified `file:line`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/pages/WorkspaceMap.tsx` | page (route) | request-response (lens branch + query render) | `src/pages/KnowledgeGraph.tsx` (URL lens param) + `src/components/graph/CodeVaultGraph.tsx` (3-state query branch) | role-match, composite |
| `src/hooks/useWorkspaceMap.ts` | hook | CRUD (read-only subscription) | `src/hooks/useProjectGraph.ts` | exact |
| `src/hooks/useArmsProbe.ts` | hook | CRUD (read-only subscription, derived boolean) | `src/hooks/useProjectGraph.ts` | exact (thinner — no snapshotId arg) |
| `src/lib/workspaceMapLayout.ts` | utility (pure) | transform | `src/lib/skillVault.ts` (`computeVaultLayout`, `:300-390`) | exact |
| `src/components/workspace/WorkspaceMapCanvas.tsx` | component | request-response (render + click events) | `src/components/graph/CodeVaultGraph.tsx` (`GraphContent`, canvas mount `:655-671`) | exact |
| `src/components/workspace/WorkspaceMapPanel.tsx` | component | request-response (click → detail render) | `src/components/graph/CodeVaultGraph.tsx` detail-panel section (`:337-340` filtered-data rule, `:860-876` panel body) | role-match |
| `src/components/workspace/WorkspaceCoverageStrip.tsx` | component | request-response (flag → styling) | New shape (no direct strip analog) — closest precedent is `hooks/skillScan.mjs`'s coverage-honest convention (referenced, not React) plus `CodeVaultGraph.tsx`'s loading/empty two-state branch for the "always renders, never blank" discipline. See "No Close Analog" note below. | partial |
| `src/components/workspace/AstridrLensEmptyState.tsx` | component | request-response (empty state) | `src/components/graph/CodeVaultGraph.tsx` `null`-state branch (`:894-909`) | role-match |
| `src/test/workspaceMapFixture.ts` | test fixture | transform (fixture factory) | `src/test/projectGraphFixture.ts` | exact |
| `src/lib/workspaceMapLayout.test.ts` | test (unit, pure) | transform | `src/lib/skillVault.test.ts` | exact |
| `src/components/workspace/WorkspaceMapCanvas.test.tsx` | test (component, mocked canvas) | request-response | `src/components/graph/ForceGraphCanvas.test.tsx` (`:1-40`) | exact |
| `src/hooks/useThemeColors.ts` (MODIFIED — add 4 fields) | hook | transform (CSS var → hex) | itself — additive, same file, same `get()` pattern | exact (in-place extension) |
| `src/components/graph/ForceGraphCanvas.tsx` (MODIFIED — add `cooldownTicks` prop) | component (shared substrate) | request-response | itself — additive prop, same file | exact (in-place extension) |
| `src/lib/navRegistry.ts` (MODIFIED — GRAPHS group) | config | CRUD (static registry insert) | itself, `:57-101` (`iconComponents`) + `:142-151` (GRAPHS group) | exact |
| `convex/graphSnapshots.ts` (MODIFIED — `listSnapshots`) | backend query | CRUD (read projection) | itself, `:317-329` | exact (in-place extension) |
| `src/App.tsx` (MODIFIED — new route) | route registration | request-response | itself — repeated `lazy()` + `<Route>` idiom, `:83`/`:179` (KnowledgeGraph entry) | exact |

## Pattern Assignments

### `src/hooks/useWorkspaceMap.ts` (hook, CRUD read)

**Analog:** `src/hooks/useProjectGraph.ts` (full file, 28 lines — read in full, no truncation)

```typescript
// Source: src/hooks/useProjectGraph.ts:1-28 (copy verbatim, adapt query + doc comment)
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Thin useQuery wrapper over api.workspace.getWorkspaceMap.
 *
 * Returns the RAW Convex result — three-state passthrough (do NOT coerce):
 *   undefined → Convex subscription still resolving (loading)
 *   null      → query resolved, no snapshot ingested yet (true-empty state)
 *   object    → live payload (meta + dirs[])
 */
export type WorkspaceMapData = NonNullable<
  ReturnType<typeof useQuery<typeof api.workspace.getWorkspaceMap>>
>;

export function useWorkspaceMap(snapshotId?: string) {
  return useQuery(
    api.workspace.getWorkspaceMap,
    snapshotId ? { snapshotId } : {},
  );
}
```

**The exact `getWorkspaceMap` return shape this hook's type must match** (verified live, `convex/workspace.ts:303-347`):

```typescript
// Source: convex/workspace.ts:303-347 — the query this hook wraps
export const getWorkspaceMap = query({
  args: { snapshotId: v.optional(v.string()) },
  handler: async (ctx, { snapshotId = WORKSPACE_SNAPSHOT_ID }) => {
    const meta = await ctx.db.query("workspaceSnapshots")
      .withIndex("by_snapshotId", (q) => q.eq("snapshotId", snapshotId))
      .unique();
    if (!meta) return null; // graceful-skip: no data yet
    const dirs = await ctx.db.query("workspaceDirs")
      .withIndex("by_snapshot_version", (q) =>
        q.eq("snapshotId", snapshotId).eq("version", meta.activeVersion))
      .collect();
    return {
      snapshotId: meta.snapshotId, activeVersion: meta.activeVersion,
      generatedAt: meta.generatedAt, receivedAt: meta.receivedAt,
      rootCount: meta.rootCount, coveredRoots: meta.coveredRoots,
      scannedRootsComplete: meta.scannedRootsComplete,
      unclassifiedRootIds: meta.unclassifiedRootIds,
      accessDerivationOk: meta.accessDerivationOk,
      localConfigStatus: meta.localConfigStatus,
      totalDirs: meta.totalDirs, totalFiles: meta.totalFiles,
      totalWithheldFiles: meta.totalWithheldFiles, totalBytes: meta.totalBytes,
      dirs: dirs.map((d) => ({
        rootId: d.rootId, dirPath: d.dirPath, department: d.department,
        access: d.access, fileCount: d.fileCount, totalSize: d.totalSize,
        latestMtime: d.latestMtime, withheldCount: d.withheldCount,
      })),
    };
  },
});
```

Note `coveredRoots` is an array of root ids (not a count) — the strip needs `coveredRoots.length`. `scannedRootsComplete`/`accessDerivationOk` are booleans; `localConfigStatus` is a bare string (`"merged" | "absent" | "version-mismatch"`, per `schema.ts:2411`), so D-16's fixture presets must use string literals, not an enum type.

---

### `src/hooks/useArmsProbe.ts` (hook, CRUD read, derived boolean)

**Analog:** same `useProjectGraph.ts` shape, plus the backend field it reads (D-13):

```typescript
// Pattern: thin useQuery wrapper + a pure derivation, no new Convex round-trip
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useArmsProbe() {
  const rows = useQuery(api.graphSnapshots.listSnapshots);
  if (rows === undefined) return undefined; // loading
  return rows.some((r) => r.sources.some((s) => s.kind === "arms"));
}
```

**The one backend edit (D-13)** — `convex/graphSnapshots.ts:317-329`, current shape (verified, full function read):

```typescript
// Source: convex/graphSnapshots.ts:317-329 (CURRENT — before the edit)
export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("graphSnapshots").collect();
    return rows.map((r) => ({
      snapshotId:  r.snapshotId,
      nodeCount:   r.nodeCount,
      linkCount:   r.linkCount,
      generatedAt: r.generatedAt,
      updatedAt:   r.updatedAt,
    }));
  },
});
```

The edit is a one-line addition to the `.map()` projection: add `sources: r.sources,`. The field already exists on the table (verified, `convex/schema.ts:1895-1903`):

```typescript
// Source: convex/schema.ts:1892-1903 — sources already stored on every graphSnapshots row
graphSnapshots: defineTable({
  snapshotId:       v.string(),
  activeVersion:    v.number(),
  sources:          v.array(v.object({
    source:             v.string(),
    kind:               v.string(),   // ← the field useArmsProbe filters on: kind === "arms"
    nodeCount:          v.float64(),
    linkCount:          v.float64(),
    emittedNodeCount:   v.float64(),
    emittedLinkCount:   v.float64(),
    truncated:          v.boolean(),
  })),
  // ...
```

No schema migration needed — this is a query-projection change only, matching D-13's own framing.

---

### `src/lib/workspaceMapLayout.ts` (pure utility, transform)

**Analog:** `src/lib/skillVault.ts:300-390` (`computeVaultLayout`) — read in full this pass, confirms RESEARCH.md's excerpt verbatim.

**The load-bearing pitfall excerpt — copy this pattern exactly, it is the highest-value excerpt in this map:**

```typescript
// Source: src/lib/skillVault.ts:240-247 (interface) — VaultNode carries BOTH fx/fy AND x/y
export interface VaultNode {
  id: string;
  // ...
  /** Fixed position — physics is disabled in the scene. */
  fx: number;
  fy: number;
  fz: number;
  /** Initial position mirror of fx/fy/fz — set so nodes render with 0 sim ticks. */
  x?: number;
  y?: number;
  z?: number;
  // ...
}

// Source: src/lib/skillVault.ts:382-388 — the mirror step, done AFTER every node's
// fx/fy is assigned, in a dedicated final pass over the whole nodes array:
// Mirror fixed positions into x/y/z so react-force-graph renders them even with
// 0 simulation ticks (fx/fy/fz alone only pin the sim, which never runs here).
for (const n of nodes) {
  n.x = n.fx;
  n.y = n.fy;
  n.z = n.fz;
}
```

`workspaceMapLayout.ts`'s `layoutNodes` must do the 2D equivalent (`n.x = n.fx; n.y = n.fy;`, no `z`) in its own final pass, per D-08 and the RESEARCH.md Pitfall-1 analysis. **Skipping this and setting only `fx`/`fy` is a partial implementation that will pass a casual visual check** (react-force-graph's simulation may correct it after enough ticks) but fails at `cooldownTicks=0`, where there is no tick budget for that self-correction.

**The overall function shape to copy** (deterministic ring assignment, golden-angle-style distribution replaced by D-08's own explicit ring/sector formulas from UI-SPEC.md, but the *scaffolding* below is the reusable part):

```typescript
// Source: src/lib/skillVault.ts:300-306, 380-397 — the outer function shape
export function computeVaultLayout(
  model: VaultModel,
  options: VaultLayoutOptions = {},
): VaultGraphData {
  const opts = { ...DEFAULTS, ...options };
  const nodes: VaultNode[] = [];
  const idToNode = new Map<string, VaultNode>();
  // ... per-container / per-cluster / per-skill fixed-position assignment ...

  // Mirror fixed positions into x/y (2D: drop z) — see excerpt above.
  for (const n of nodes) { n.x = n.fx; n.y = n.fy; }

  const links: VaultLink[] = model.shadowLinks.map((l) => ({
    source: l.fromId, target: l.toId, kind: "shadow" as const,
  }));
  return { nodes, links };
}
```

**Zero React/Convex imports** — confirmed by direct read of `skillVault.ts`'s import block (only type/model imports, no `react`/`convex` symbols), which is what makes `skillVault.test.ts` a plain Vitest suite with no canvas mock. `workspaceMapLayout.ts` must hold to the same discipline: `computeRollups`, `buildTree`, `layoutNodes` take plain data in, return plain data out.

---

### `src/lib/workspaceMapLayout.test.ts` (unit test, pure)

**Analog:** `src/lib/skillVault.test.ts` — plain `describe`/`it` blocks, no `vi.mock`, no jsdom canvas stub (confirmed by RESEARCH.md's direct read; not re-read this pass since the shape claim — "zero mocks" — is independently confirmed by `skillVault.ts` itself having zero React/Convex imports, which is the necessary condition for a mock-free test).

Structure to copy: call the pure function directly with synthetic fixture data, assert on the returned plain objects (`fx`/`fy`/`x`/`y`, `val`, counts) with `toEqual`/`toBe` — no `render()`, no `@testing-library/react`.

---

### `src/components/workspace/WorkspaceMapCanvas.tsx` (component, request-response)

**Analog:** `src/components/graph/CodeVaultGraph.tsx` — canvas mount site, full excerpt (`:655-671`, re-read this pass, matches RESEARCH.md verbatim):

```tsx
// Source: src/components/graph/CodeVaultGraph.tsx:655-671
{renderMode === "2d" ? (
  <ForceGraphCanvas
    ref={fgRef2d}
    data={filteredData}
    colorFn={colorFn}
    labelFn={labelFn}
    paintNode={paintNode}
    linkColorFn={linkColorFn}
    defaultNodeColor={colors.primary}
    defaultLinkColor={colors.primaryAlpha18}
    onNodeClick={(node: any) => setSelectedNodeId(node.id)}
    onBackgroundClick={() => setSelectedNodeId(null)}
    onEngineStop={() => fgRef2d.current?.zoomToFit(400, 60)}
    className={canvasClass}
    clusterForce={true}
    communityColorFn={(node: any) => communityColor(node.community)}
  />
) : ( /* 3D branch — WorkspaceMapCanvas has no 3D branch per UI-SPEC */ )}
```

**`WorkspaceMapCanvas`'s deviations from this exact call, both explicit in UI-SPEC/CONTEXT:**
- **No `paintNode`** — reuses `ForceGraphCanvas`'s default paint entirely (UI-SPEC "Claude's Discretion — resolved").
- **`cooldownTicks={0}`** — new prop, not present on this call today; see the `ForceGraphCanvas.tsx` edit below.
- **`clusterForce` omitted/`false`** — D-08 layout is fully deterministic via `fx`/`fy`, not d3 clustering; `clusterForce` is CodeVaultGraph's community-clustering mechanism and is orthogonal to (and would fight) a fixed layout.
- `communityColorFn` follows the same shape but on `node.access` not `node.community`:

```typescript
// Source: src/components/graph/CodeVaultGraph.tsx:670 (the existing precedent, halo)
communityColorFn={(node: any) => communityColor(node.community)}

// D-06's equivalent for WorkspaceMapCanvas:
communityColorFn={(node: any) =>
  node.access === "astridr-reachable" ? colors.statusInfo : null
}
```

**The `colorFn` `useCallback([colors])` pattern** to copy for department fill (`CodeVaultGraph.tsx:197-200`, re-read this pass):

```typescript
// Source: src/components/graph/CodeVaultGraph.tsx:190-200
// Canvas APIs cannot read CSS variables — useThemeColors() resolves them to
// hex/rgba at render time and re-resolves on data-theme switch.
const colors = useThemeColors();

const colorFn = useCallback(
  (node: any): string => isVaultNode(node) ? colors.vaultNode : colors.primary,
  [colors],
);
```

`WorkspaceMapCanvas`'s equivalent is a department lookup keyed on `node.department`, still `useCallback([colors])`.

**The full `ForceGraphCanvas` prop contract this component consumes** (full file read this pass, `ForceGraphCanvas.tsx:1-333`):

```typescript
// Source: src/components/graph/ForceGraphCanvas.tsx:30-86 — the exported interfaces
export interface ForceGraphHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
}

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
  onEngineStop?: () => void;
  nodeRelSize?: number;
  className?: string;
  backdrop?: boolean;
  clusterForce?: boolean;
  /** When supplied, draws a halo arc around each node where this returns non-null. */
  communityColorFn?: (node: any) => string | null;
  defaultNodeColor?: string;
  defaultLinkColor?: string;
  // ⬇ THE ADDITIVE PROP THIS PLAN MUST ADD — does not exist yet:
  // cooldownTicks?: number;
}
```

**Confirmed: `cooldownTicks` has no prop today** — `props` destructure at `ForceGraphCanvas.tsx:92-113` does not include it, and the literal is hardcoded at the JSX call site:

```tsx
// Source: src/components/graph/ForceGraphCanvas.tsx:298-329 — the underlying
// <ForceGraph2D> element. Line 326 is the ONLY place cooldownTicks is set.
<ForceGraph2D
  ref={fgRef}
  graphData={data}
  nodeId="id"
  nodeLabel={labelFn ?? ((n: any) => n.name ?? n.id)}
  nodeColor={(n: any) => color(n)}
  nodeRelSize={nodeRelSize}
  nodeCanvasObject={paint}
  linkColor={linkColorFn ?? (() => resolvedDefaultLinkColor)}
  linkWidth={linkWidthFn ?? (() => 0.6)}
  linkLineDash={linkLineDashFn ? (l: any) => linkLineDashFn(l) : undefined}
  linkDirectionalArrowLength={linkDirectionalArrow ? 3.5 : 0}
  linkDirectionalArrowRelPos={1}
  onNodeHover={(n: any) => { setHoverId(n?.id ?? null); onNodeHover?.(n ?? null); }}
  onNodeClick={(n: any) => {
    fgRef.current?.centerAt(n.x, n.y, 800);
    fgRef.current?.zoom(3, 800);
    onNodeClick?.(n);
  }}
  onBackgroundClick={() => onBackgroundClick?.()}
  onEngineStop={() => onEngineStop?.()}
  cooldownTicks={120}                 {/* ← hardcoded literal, line 326 */}
  d3VelocityDecay={0.3}
  backgroundColor="transparent"
/>
```

**The exact additive edit** (destructure `cooldownTicks = 120` alongside the other defaulted props at `:106-113`, add to the interface at `:40-86`, pass through at `:326`):

```typescript
// ForceGraphCanvasProps addition:
/** Simulation cooldown ticks before onEngineStop fires. Default 120 (existing
 *  behavior, byte-identical for CodeVaultGraph/KG Explorer). Pass 0 for a
 *  fully deterministic, physics-off layout (D-08). */
cooldownTicks?: number;

// destructure (join the existing list at :92-113):
const { /* ...existing... */, cooldownTicks = 120 } = props;

// pass through (replace the literal at :326):
cooldownTicks={cooldownTicks}
```

This is additive and non-breaking — confirmed by direct read of the full destructure block (`:92-113`), which is unaffected by the new field, and every other consumer (`CodeVaultGraph`, KG Explorer via `KnowledgeGraph.tsx`) keeps the default `120` with zero code change.

**The `communityColorFn` halo mechanism — confirmed drawn exactly as documented**, `ForceGraphCanvas.tsx:264-282` (re-read this pass, full function):

```typescript
// Source: src/components/graph/ForceGraphCanvas.tsx:253-285 — full `paint` callback
const paint = useCallback(
  (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const dimmed = isDimmed(node.id);
    if (paintNode) {
      paintNode(node, ctx, globalScale, { hovered: node.id === hoverId, dimmed });
    } else {
      defaultPaint(node, ctx, globalScale);
    }
    // Community halo — drawn after the node fill/ring, before labels.
    if (communityColorFn) {
      const haloColor = communityColorFn(node);
      if (haloColor) {
        const size = Math.max(node.val ?? 3, 2);
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI, false);
        ctx.strokeStyle = haloColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = dimmed ? 0.08 : 0.7;
        ctx.shadowColor = haloColor;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }
  },
  [paintNode, defaultPaint, hoverId, isDimmed, communityColorFn],
);
```

`WorkspaceMapCanvas` with **no custom `paintNode`** gets this halo entirely for free — zero new render code, confirmed by reading the whole `paint` callback: the halo branch is unconditional on `paintNode` being supplied or not.

**Default node-size floor** (relevant to D-07's `val` range 2–6 for directories): `Math.max(node.val ?? 3, 2)` appears twice — in `defaultPaint` (`:226`) and in the halo-radius calc above (`:269`) — so a `val: 2` directory (the floor) still renders at radius 2, matching UI-SPEC's stated floor exactly.

---

### `src/components/workspace/WorkspaceMapPanel.tsx` (component, request-response)

**Analog:** `CodeVaultGraph.tsx`'s detail-panel section. Two load-bearing excerpts, both re-verified this pass:

**1. Panel derives from currently-visible/filtered data, never a stale snapshot** — the WR-02 precedent RESEARCH.md cites (`CodeVaultGraph.tsx:337-340`, comment only — not re-read verbatim this pass since RESEARCH.md's citation is a comment about a design rule, not executable logic to transcribe). The rule to apply in `WorkspaceMapCanvas`/`WorkspaceMapPanel`: when a node is collapsed out of `expandedSet`, the panel must not go on describing it as if still visible (RESEARCH.md's Open Question 2 flags this as unresolved by CONTEXT.md/UI-SPEC — recommend closing the panel or showing a "currently collapsed" fallback).

**2. Fallback panel body when nothing is selected** (`CodeVaultGraph.tsx:862-870`, re-read this pass):

```tsx
// Source: src/components/graph/CodeVaultGraph.tsx:862-870
) : fromParam ? (
  // Panel open due to ?from but no node resolved — show skeleton
  <Skeleton className="h-32 w-full rounded-[var(--radius)]" />
) : (
  <p className="text-sm font-mono text-muted-foreground text-center mt-8">
    Select a node to inspect
  </p>
)}
```

`WorkspaceMapPanel` is a `Sheet` (per UI-SPEC, not an always-mounted side column like `CodeVaultGraph`'s), so it opens/closes rather than showing this idle state — but the `Skeleton`-for-not-yet-resolved and plain-text-for-nothing-selected two-state shape is the pattern to copy for any moment the panel is open but its target node isn't in the current node set.

---

### `src/components/workspace/WorkspaceCoverageStrip.tsx` (component, request-response)

**No close analog exists in the codebase for an always-visible, multi-flag coverage/honesty header strip.** Control-paired search performed: grepped `SectionErrorBoundary` (49 hits) and `useSearchParams` (13 hits) across `src/` — both searches clearly work (they return real, on-topic hits for other patterns in this same map), which is the control proving a genuine zero here is not a broken search. Also checked `src/components/kg/KGSummaryCards.tsx` (imported by `KnowledgeGraph.tsx` at `:15`) as a candidate "summary chip row" analog — it exists and renders count-style chips, but was not read in full this pass since UI-SPEC.md already fully specifies the strip's four-chip-plus-degraded-chips shape and copy contract (Component Inventory → `WorkspaceCoverageStrip`, Copywriting Contract), leaving no open design question this analog would resolve. Recommend the planner treat UI-SPEC.md's own spec as authoritative here rather than reverse-engineering a fit from `KGSummaryCards`.

**The closest structural precedent for "always renders, graceful two/three-state branch"** is `CodeVaultGraph`'s own `undefined`/`null`/data branch (`:884-913`, excerpted below under `AstridrLensEmptyState`) — apply the same discipline (loading skeleton, never a blank div) to the strip's own `undefined` state per the States table ("Skeleton chip row (4 pill-shaped skeletons)").

**Badge styling tokens to reuse** — `--status-warn` for the degraded treatment is already a resolved `ThemeColors` field (`useThemeColors.ts:24`, `statusWarn`), so no new token is needed for the strip's warn chips — confirmed by direct read of the `ThemeColors` interface (excerpt below).

---

### `src/components/workspace/AstridrLensEmptyState.tsx` (component, request-response)

**Analog:** `CodeVaultGraph.tsx`'s `null`-state branch, full excerpt (`:894-909`, re-read this pass):

```tsx
// Source: src/components/graph/CodeVaultGraph.tsx:894-909
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
```

Directly matches the shape UI-SPEC.md specifies for `AstridrLensEmptyState` (icon + heading + body, `h-[600px]` sizing so lens-switching doesn't shift page layout — UI-SPEC's own instruction to keep the same footprint). Swap `Network` icon → whatever Lucide icon fits (UI-SPEC doesn't mandate one for this empty state — only `Radar` for the nav entry), and copy per UI-SPEC's Copywriting Contract table (heading "Ástríðr's world isn't mapped yet", body text, "View Larry's Workspace" action).

**The loading/`undefined` branch** (`CodeVaultGraph.tsx:883-892`, same read pass):

```tsx
// Source: src/components/graph/CodeVaultGraph.tsx:883-892
if (snapshot === undefined) {
  return (
    <div className="h-[600px] flex items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-card/50">
      <p className="text-primary/70 font-mono text-base animate-pulse">
        Loading graph snapshot…
      </p>
    </div>
  );
}
```

Note UI-SPEC's canvas loading state is a "skeleton radial placeholder (dashed concentric rings)", not this text-pulse — a deliberate departure UI-SPEC calls for, not an oversight; the `useArmsProbe` loading branch (a text skeleton block per the States table) is closer to this exact pattern.

---

### `src/test/workspaceMapFixture.ts` (test fixture, transform)

**Analog:** `src/test/projectGraphFixture.ts` (full file, 187 lines — read in full this pass).

**Factory + overrides shape to copy:**

```typescript
// Source: src/test/projectGraphFixture.ts:59-73 (signature shape) — adapt to
// makeWorkspaceMapFixture, whose base object is getWorkspaceMap's return shape
export function makeProjectGraphFixture(
  overrides: Partial<ProjectGraphFixture> & {
    truncated?: boolean;
    staleGeneratedAt?: number;
    storedNodeCountOverride?: number;
    storedLinkCountOverride?: number;
  } = {}
): ProjectGraphFixture {
  const { truncated = false, staleGeneratedAt, /* ... */, ...rest } = overrides;
  // ... build defaults, allowing named override knobs to shape specific fields ...
  return { /* defaults */, ...rest };
}
```

`makeWorkspaceMapFixture(overrides?)` should follow this exact shape: a base object with all four honesty flags green (`scannedRootsComplete: true`, `accessDerivationOk: true`, `localConfigStatus: "merged"`, `unclassifiedRootIds: []`) as the default/healthy-render control, plus four named override presets or a documented override pattern for D-16's degraded states, matching this file's `truncated`/`staleGeneratedAt` override-knob convention.

**Timestamp-unit precedent — directly relevant to D-17's staleness check:**

```typescript
// Source: src/test/projectGraphFixture.ts:145-147
// generatedAt is Unix SECONDS (float64) — multiply by 1000 before Date.now() comparison
const generatedAt =
  staleGeneratedAt !== undefined ? staleGeneratedAt : Date.now() / 1000;
```

This is the exact unit convention `workspaceSnapshots.generatedAt` also uses (confirmed, `schema.ts:2400`: "epoch SECONDS — host scan time (graphSnapshots.ts convention)") — the fixture and any staleness-boundary test must divide by 1000, not compare raw `Date.now()` against `generatedAt` directly. This is precisely the class of bug the project's own LESSONS record ("Convex/telemetry timestamps are epoch SECONDS, not millis... a threshold check must print a SANITY line").

**Mock-helper shape to copy:**

```typescript
// Source: src/test/projectGraphFixture.ts:180-186
export function mockGetProjectGraph(
  value: ProjectGraphFixture | null | undefined
): void {
  const mockUseQuery = vi.mocked(useQuery);
  (mockUseQuery as any).mockReturnValue(value);
}
```

`mockGetWorkspaceMap(value)` / `mockArmsProbe(value)` should follow this verbatim — one `vi.mocked(useQuery).mockReturnValue(value)` call each. Note: if both hooks are exercised in the same test file, the mock needs to discriminate by which `api.*` function was called (this file's version doesn't need to, since only one query is faked per test suite) — check whether `vi.mocked(useQuery).mockImplementation((fn, ...) => ...)` branching is needed when a page test mocks both `getWorkspaceMap` and `listSnapshots` simultaneously.

---

### `src/components/workspace/WorkspaceMapCanvas.test.tsx` (component test, mocked canvas)

**Analog:** `src/components/graph/ForceGraphCanvas.test.tsx:1-40` (re-read this pass, confirms RESEARCH.md's excerpt verbatim):

```typescript
// Source: src/components/graph/ForceGraphCanvas.test.tsx:1-33 — the exact mock to copy
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { createRef, forwardRef as reactForwardRef } from "react";
import { ForceGraphCanvas, type ForceGraphHandle } from "./ForceGraphCanvas";

// Mock react-force-graph-2d with a stub that captures the props the canvas
// computes, so assertions run without a real <canvas>.
const h = vi.hoisted(() => ({
  props: null as Record<string, any> | null,
  fgRef: null as Record<string, any> | null,
}));

// Use forwardRef so React properly sets fgRef.current to the mock's imperative handle.
vi.mock("react-force-graph-2d", () => ({
  default: reactForwardRef((props: Record<string, any>, ref: any) => {
    h.props = props;
    if (ref && typeof ref === "object" && "current" in ref) {
      ref.current = h.fgRef;
    } else if (typeof ref === "function") {
      ref(h.fgRef);
    }
    return null;
  }),
}));

// Mock d3-force-3d so tests don't need the real simulation.
vi.mock("d3-force-3d", () => ({
  forceX: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceY: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
  forceCollide: vi.fn(() => ({ strength: vi.fn().mockReturnThis() })),
}));
```

Use this mock to assert `WorkspaceMapCanvas` passes `cooldownTicks={0}` and the correct `communityColorFn` through to `ForceGraphCanvas` — read `h.props.cooldownTicks` / call `h.props.communityColorFn(fixtureNode)` after render, exactly the technique RESEARCH.md's Validation Architecture section describes (Pitfall 4). **Confirms a stale CLAUDE.md claim, independently re-verified this pass is unnecessary since RESEARCH.md already did the full-file read of `src/test/setup.ts`** — the corrected fact stands: `setup.ts` does NOT globally mock `react-force-graph-2d`; every consumer file mocks it per-file exactly as above.

---

### `src/pages/WorkspaceMap.tsx` (page)

**Analog 1 — lazy route registration**, `App.tsx` idiom (grep-confirmed pattern, 44 existing `lazy()` calls + matching `<Route>` entries):

```tsx
// Source: src/App.tsx:83, 179 — the exact pattern (KnowledgeGraph as the nearest sibling)
const KnowledgeGraph = lazy(() => import("./pages/KnowledgeGraph"));
// ...
<Route path="/knowledge-graph" element={
  <Suspense fallback={<div className="text-muted-foreground text-base p-8 text-center">Loading KG Explorer...</div>}>
    <KnowledgeGraph />
  </Suspense>
} />
```

`WorkspaceMap` gets: `const WorkspaceMap = lazy(() => import("./pages/WorkspaceMap"));` placed alongside the other GRAPHS-group lazy imports, and a `<Route path="/workspace-map" element={<Suspense fallback={...}><WorkspaceMap /></Suspense>} />` inside the `<Route element={<DashboardLayout />}>` block, matching the fallback-text convention ("Loading {Label}...") exactly.

**Analog 2 — URL search-param lens state** (D-12), confirmed live in `KnowledgeGraph.tsx:882-885` (read this pass; the surrounding 1800-line file is NOT a structural analog for WorkspaceMap's much simpler composition — only this fragment is relevant):

```typescript
// Source: src/pages/KnowledgeGraph.tsx:882-885
const [searchParams] = useSearchParams();
const focusEntity = searchParams.get("focus");
const lensParam = searchParams.get("lens");
const hopsParam = searchParams.get("hops");
```

`WorkspaceMap.tsx`'s equivalent: `const [searchParams] = useSearchParams(); const lens = searchParams.get("lens") === "astridr" ? "astridr" : "workspace";` — a closed-set default per RESEARCH.md's V5 Input Validation note (any other value silently falls back to `"workspace"`, never trusted verbatim).

**Analog 3 — two independent `SectionErrorBoundary`s**, confirmed by grep (49 files use it) and one concrete multi-instance example, `GraphsHub.tsx:162-183`:

```tsx
// Source: src/pages/GraphsHub.tsx:162, 183 (two of several sibling boundaries in one page)
<SectionErrorBoundary name="Tool Galaxy tile">
  {/* ... */}
</SectionErrorBoundary>
{/* ... */}
<SectionErrorBoundary name="Code/Vault Graph">
  {/* ... */}
</SectionErrorBoundary>
```

`SectionErrorBoundary`'s own implementation (full file, 65 lines, read this pass) — a class component with `getDerivedStateFromError` + `componentDidCatch` (console.error only) + a Retry button that resets local state:

```tsx
// Source: src/components/SectionErrorBoundary.tsx:19-33 — the mechanism
static getDerivedStateFromError(error: Error): State {
  return { hasError: true, error };
}
componentDidCatch(error: Error, info: ErrorInfo) {
  console.error(`SectionErrorBoundary [${this.props.name ?? "unknown"}] caught:`, error, info);
}
handleRetry = () => { this.setState({ hasError: false, error: null }); };
```

`WorkspaceMap.tsx` wraps `<SectionErrorBoundary name="Workspace Coverage Strip">` and `<SectionErrorBoundary name="Workspace Map Canvas">` **separately**, per CONTEXT.md's explicit requirement — confirmed this is the established multi-boundary-per-page idiom, not a one-off.

---

### `src/hooks/useThemeColors.ts` (MODIFIED — additive fields)

**The file itself is its own analog for the edit** — full file read this pass (107 lines), confirms RESEARCH.md's claims verbatim:

```typescript
// Source: src/hooks/useThemeColors.ts:14-27 — CURRENT interface (12 fields)
export interface ThemeColors {
  primary: string; primaryAlpha18: string; primaryAlpha55: string;
  accent: string; vaultNode: string; vaultNodeAlpha18: string;
  chartBar: string; chartBarAccent: string;
  statusOk: string; statusWarn: string; statusError: string; statusInfo: string;
}
```

```typescript
// Source: src/hooks/useThemeColors.ts:41-75 — resolveThemeColors, the resolution
// pattern EVERY new field must follow (fresh get() call, no caching)
export function resolveThemeColors(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (token: string): string => style.getPropertyValue(token).trim();
  const primary = get("--primary");
  // ... dev-mode oklch guard ...
  return {
    primary,
    primaryAlpha18: hexToRgba(primary, 0.18),
    // ... every field via get(token) or a derived hexToRgba() call ...
    statusInfo: get("--status-info"),
  };
}
```

The four new fields (`mutedForeground`, `deptPersonal`, `deptConsulting`, `deptWork`) are added to the interface (`:14-27`) and to the returned object in `resolveThemeColors` (`:61-74`) using the identical `get("--token")` call — **confirmed the Pitfall-2 "no CSSStyleDeclaration caching" comment is live, not stale**: `style` is captured once per `resolveThemeColors()` invocation (not once per app lifetime), and `resolveThemeColors()` itself is called fresh both on mount (`useState` lazy initializer, `:90`) and on every `data-theme` `MutationObserver` firing (`:92-103`) — so new fields automatically participate in theme-switch re-resolution with zero additional wiring, exactly as RESEARCH.md states.

```typescript
// Source: src/hooks/useThemeColors.ts:86-106 — the hook itself, unmodified by this edit
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(resolveThemeColors);
  useEffect(() => {
    const observer = new MutationObserver(() => { setColors(resolveThemeColors()); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}
```

---

### `src/lib/navRegistry.ts` (MODIFIED — GRAPHS group entry)

**The file itself is the analog** — `iconComponents` map (`:57-101`) and `navGroups` GRAPHS section (`:142-153`), both re-read this pass:

```typescript
// Source: src/lib/navRegistry.ts:88-100 — recent icon additions, the pattern to copy
terminal: Terminal,
network: Network,
boxes: Boxes,
"share-2": Share2,
flame: Flame,
hexagon: Hexagon,   // Phase 149 — Hive page
"message-square-text": MessageSquareText,
gauge: Gauge,   // Phase 93 — Quality page
wrench: Wrench,   // Phase 105 — Tools page
sparkles: Sparkles,   // Phase 116 — Galdr page
"link-2": Link2,   // Phase 117 — Bifröst page
waypoints: Waypoints,   // Phase 119 — Loom page
// ⬇ new: radar: Radar,   // Phase 114 — Workspace Map page
```

```typescript
// Source: src/lib/navRegistry.ts:141-152 — the GRAPHS group, insertion point confirmed
{
  group: "GRAPHS",
  items: [
    { to: "/graphs", label: "Graphs Hub", icon: "network", group: "GRAPHS" },
    { to: "/loom", label: "Loom", icon: "waypoints", group: "GRAPHS" },
    { to: "/tool-galaxy", label: "Tool Galaxy", icon: "boxes", group: "GRAPHS" },
    { to: "/mcp-inventory", label: "MCP Inventory", icon: "server", group: "GRAPHS" },
    { to: "/knowledge-graph", label: "KG Explorer", icon: "share-2", group: "GRAPHS" },
    { to: "/capabilities", label: "Capabilities", icon: "cpu", group: "GRAPHS" },
    // ⬇ new, appended last per UI-SPEC's "placed after /capabilities" instruction:
    // { to: "/workspace-map", label: "Workspace Map", icon: "radar", group: "GRAPHS" },
  ],
},
```

Both `iconComponents` and each `navGroups[].items` entry follow the identical two-touch-point shape every prior phase's nav addition used (confirmed by the inline `// Phase NNN` comments already present for 5 of the last 6 additions) — this is not a one-off but the repo's standing convention for adding a nav entry. Per CLAUDE.md, this is the ONLY place the entry goes — `DashboardLayout.tsx` only consumes the registry, never define nav items there.

---

## Shared Patterns

### `SectionErrorBoundary` (error handling)
**Source:** `src/components/SectionErrorBoundary.tsx` (full file, 65 lines)
**Apply to:** `WorkspaceMap.tsx` — two independent instances (coverage strip, canvas), per CONTEXT.md's explicit rule and the repo's own incident history (Phase 110 `/analytics`, `heroStats` — both cited in `CLAUDE.md` § Patterns).
```tsx
<SectionErrorBoundary name="Workspace Coverage Strip">
  <WorkspaceCoverageStrip />
</SectionErrorBoundary>
<SectionErrorBoundary name="Workspace Map Canvas">
  <WorkspaceMapCanvas />
</SectionErrorBoundary>
```

### Theme-aware canvas fill (`useThemeColors` + `useCallback`)
**Source:** `src/components/graph/CodeVaultGraph.tsx:190-200`
**Apply to:** `WorkspaceMapCanvas`'s `colorFn` and `communityColorFn` — both must be `useCallback([colors])`-wrapped so canvas fill re-resolves on theme switch without re-creating on every render.

### Privacy masking (`usePrivacyMask`, NOT `maskFilePath`)
**Source:** `src/hooks/usePrivacyMask.ts` (full file, 46 lines) + `src/lib/privacy.ts` (full file, 63 lines)
**Apply to:** every root/directory label rendered on the canvas and in `WorkspaceMapPanel`.

```typescript
// Source: src/hooks/usePrivacyMask.ts:38-42 — the mechanism D-15 specifies (redact, not maskFilePath)
const redact = useCallback(
  (text: string, placeholder = "••••••") => (enabled ? placeholder : text),
  [enabled]
);
```

**Why `maskFilePath`/`maskPath` is structurally wrong here — confirmed by direct read** (`src/lib/privacy.ts:9-17`):
```typescript
// Source: src/lib/privacy.ts:9-17
export function maskPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  if (parts.length <= 2) return path;   // ← single-segment input returned UNCHANGED
  const first = parts[0] || "/";        // ← first segment always kept unmasked
  const last = parts[parts.length - 1];
  const masked = parts.slice(1, -1).map(() => "***");
  return [first, ...masked, last].join("/");
}
```
Confirmed: `maskPath("acme-client")` (a bare root name, one segment) hits `parts.length <= 2` and returns the input **completely unchanged** — a silent no-op for exactly the case D-15 needs masked. This independently re-verifies UI-SPEC's own analysis of this pitfall; use `redact()` from `usePrivacyMask()` for every root/directory label instead, gated identically:
```typescript
// Source: src/hooks/usePrivacyMask.ts:6-11 — the gating pattern every consumer uses
const { enabled, maskPaths, maskEmails, maskKeys, maskIps } = usePrivacy();
const mp = useCallback(
  (path: string) => (enabled && maskPaths ? maskPath(path) : path),
  [enabled, maskPaths]
);
```
`WorkspaceMapCanvas`/`WorkspaceMapPanel`'s label-masking callback follows this exact `enabled && maskPaths` gate shape, substituting `redact(rootLabel)` / the department-indexed root-label formula for `maskPath`.

### Query hook 3-state passthrough (loading/empty/data)
**Source:** `src/hooks/useProjectGraph.ts` (doc comment, `:6-14`) + `src/components/graph/CodeVaultGraph.tsx:883-913` (the consuming branch)
**Apply to:** `useWorkspaceMap` (hook) and `WorkspaceMap.tsx`/`WorkspaceMapCanvas` (the branch that consumes it) — `undefined` = loading, `null` = true-empty (no snapshot), object = live data. Never coerce with `?? []` or similar at the hook level; branch explicitly at the consumer.

### Fixed force-graph layout (`fx`/`fy` + `x`/`y` mirror + `cooldownTicks=0`)
**Source:** `src/lib/skillVault.ts:240-247, 382-388`
**Apply to:** `workspaceMapLayout.ts`'s `layoutNodes` output and `WorkspaceMapCanvas`'s `cooldownTicks={0}` prop pass-through. See the full excerpt under `workspaceMapLayout.ts` above — this is the single most load-bearing pattern in the phase (RESEARCH.md's own framing, independently confirmed this pass).

### `react-force-graph-2d` per-file mock (testing)
**Source:** `src/components/graph/ForceGraphCanvas.test.tsx:1-33`
**Apply to:** any test file that mounts `WorkspaceMapCanvas` (or `ForceGraphCanvas` directly). Confirmed NOT globally mocked in `src/test/setup.ts` — every consumer supplies its own `vi.mock("react-force-graph-2d", ...)`.

---

## No Analog Found

None. Every file in this phase has at least a role-match analog; the weakest match (`WorkspaceCoverageStrip.tsx`, "partial") still has a documented control-paired search (see its entry above) proving the absence of a closer match is real, not a missed search — and UI-SPEC.md already fully specifies its behavior, so the planner does not need a codebase analog to build it correctly.

## Metadata

**Analog search scope:** `src/pages/`, `src/components/graph/`, `src/components/skills/vault/`, `src/hooks/`, `src/lib/`, `src/contexts/`, `src/test/`, `convex/` (workspace.ts, graphSnapshots.ts, schema.ts), `src/lib/navRegistry.ts`, `src/App.tsx`.
**Files scanned (full or targeted read this pass):** `ForceGraphCanvas.tsx` (full, 333 lines), `ForceGraphCanvas.test.tsx` (lines 1-40), `CodeVaultGraph.tsx` (targeted: 190-205, 655-676, 860-913), `skillVault.ts` (lines 220-394), `SkillVaultScene.tsx` (lines 1-80), `useThemeColors.ts` (full, 107 lines), `PrivacyContext.tsx` (full, 102 lines), `usePrivacyMask.ts` (full, 46 lines), `privacy.ts` (full, 63 lines), `useProjectGraph.ts` (full, 28 lines), `projectGraphFixture.ts` (full, 187 lines), `navRegistry.ts` (lines 50-155), `graphSnapshots.ts` (lines 295-330), `workspace.ts` (lines 290-348), `schema.ts` (lines 1880-1910, 2375-2442), `App.tsx` (grep, lines 17-190), `SectionErrorBoundary.tsx` (full, 65 lines), `KnowledgeGraph.tsx` (targeted: lines 1-1210, of which only 493-500/882-885 are load-bearing for this map — the rest of the file is a much more complex sibling page, not itself a structural analog).
**Pattern extraction date:** 2026-08-13
