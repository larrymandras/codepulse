# Phase 114: Workspace Map view - Research

**Researched:** 2026-08-13
**Domain:** React/Convex radial graph visualization on an existing force-graph canvas substrate
**Confidence:** HIGH

## Summary

Phase 114 is unusually pre-solved before research started: `114-CONTEXT.md` carries 18 measured,
`file:line`-anchored decisions, and `114-UI-SPEC.md` already resolves every item on
`CONTEXT.md`'s "Claude's Discretion" list — including the deterministic radial layout's exact ring
radii, angular sector formulas, node-size formulas, and the department color token mapping. This
research does **not** re-derive those numbers; it independently verifies them against the live
source, confirms every canonical `file:line` anchor CONTEXT.md cites still resolves (zero drift
found), and fills the gaps neither document covers: the rollup/memoization complexity budget, the
`fx`/`fy`-**plus**-`x`/`y` pitfall the UI-SPEC's layout description under-specifies, and a full
Validation Architecture mapped to D-16's fixture-per-flag + mutation-test requirement.

**Primary recommendation:** Build `src/lib/workspaceMapLayout.ts` as three pure functions
(`computeRollups`, `buildTree`, `layoutNodes`) exactly as `114-UI-SPEC.md` specifies, following the
`src/lib/skillVault.ts` / `computeVaultLayout` precedent line-for-line — including the one thing
that precedent does that neither CONTEXT.md nor UI-SPEC calls out: after computing `fx`/`fy`, also
mirror them onto plain `x`/`y` on the same node object (`skillVault.ts:385-386`,
`n.x = n.fx; n.y = n.fy;`), or the very first paint (before any simulation tick) renders nodes at
undefined/random positions even with `cooldownTicks={0}`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workspace snapshot storage/versioning | Database / Storage (Convex `workspaceSnapshots`/`workspaceDirs`) | — | Owned by Phase 115, complete. Phase 114 only reads it. |
| Snapshot fetch (`getWorkspaceMap`) | API / Backend (Convex `query`) | — | Existing, unmodified — `convex/workspace.ts:303`. |
| ARMS-presence probe (`listSnapshots.sources`) | API / Backend (Convex `query`) | — | One-field addition, `convex/graphSnapshots.ts:317-329` — D-13, this phase's only backend change. |
| Rollup computation, tree building, radial layout math | Browser / Client (pure `src/lib` functions) | — | D-04/D-08 mandate client-side, deterministic — no server round-trip. |
| Force-graph rendering (canvas paint, hover, zoom) | Browser / Client (`ForceGraphCanvas` + `react-force-graph-2d`) | — | Existing shared substrate; this phase adds one prop (`cooldownTicks`), no new render engine. |
| Lens state, privacy masking, theme resolution | Browser / Client (URL search param, `PrivacyContext`, `useThemeColors`) | — | All three are existing app-wide client contexts/hooks this phase consumes, not builds. |
| Coverage/honesty flags (`scannedRootsComplete`, `accessDerivationOk`, `localConfigStatus`) | Database / Storage (computed by Phase 115's scanner, stored on `workspaceSnapshots`) | Browser / Client (rendering the strip) | Phase 114 only renders flags Phase 115 already computes and stores — no new derivation logic in this phase. |

## Standard Stack

No new packages this phase. Confirmed by reading `package.json` and the full canonical-refs list in
`114-CONTEXT.md`/`114-UI-SPEC.md`: every dependency this phase needs (`react-force-graph-2d`,
`convex/react`, `react-router` `useSearchParams`, the 30 shadcn primitives, `lucide-react`) is already
installed and in use elsewhere in the repo (`ForceGraphCanvas.tsx`, `CodeVaultGraph.tsx`,
`useThemeColors.ts`, `PrivacyContext.tsx`). `[VERIFIED: package.json / live grep]`

### Package Legitimacy Audit

Not applicable — this phase installs zero external packages. Every consumed library is an existing,
already-audited dependency of this same codebase.

## Architecture Patterns

### System Architecture Diagram

```
Convex (self-hosted, single instance)
  workspaceSnapshots / workspaceDirs  (Phase 115, complete, unmodified)
  graphSnapshots.listSnapshots         (D-13: +1 field, `sources`)
        |
        | useQuery subscription, ~1.35 MB, 4,912 rows, pushes once/night
        v
useWorkspaceMap()  ──┐            useArmsProbe()
  (thin useQuery       │              (thin useQuery over listSnapshots,
   wrapper, follows     │               checks sources[].kind === "arms")
   useProjectGraph.ts   │
   pattern)             │
        |               |
        v               v
┌───────────────────────────────────────────────────────────────┐
│ WorkspaceMap page (/workspace-map)                             │
│  lens = useSearchParams().get("lens") ?? "workspace"  (D-12)   │
│                                                                  │
│  lens === "workspace":                                          │
│    payload.dirs (4,912 rows, stable ref until next nightly push)│
│      │                                                           │
│      ├─▶ computeRollups(dirs)   [pure, memoized on activeVersion]│
│      ├─▶ buildTree(dirs)        [pure, memoized on activeVersion]│
│      │        │                                                 │
│      │        ▼                                                 │
│      │   layoutNodes(tree, rollups, expandedSet)                │
│      │        [pure, recomputes on click — bounded by VISIBLE   │
│      │         node count via adjacency index, not full 4,912]  │
│      │        │                                                 │
│      │        ▼  {nodes: [...fx,fy,x,y], links: [...]}         │
│      │   WorkspaceMapCanvas → ForceGraphCanvas → react-force-   │
│      │   graph-2d (cooldownTicks=0, physics off, communityColorFn│
│      │   draws the D-06 access halo, colorFn draws department   │
│      │   fill from useThemeColors())                            │
│      │        │                                                 │
│      │        └─ onNodeClick → expandedSet.add/delete (D-03)    │
│      │                        + WorkspaceMapPanel (Sheet, D-09) │
│      └─▶ WorkspaceCoverageStrip reads meta fields directly off  │
│           payload (scannedRootsComplete, accessDerivationOk,    │
│           localConfigStatus, unclassifiedRootIds) — no rollup    │
│           needed, D-14                                          │
│                                                                  │
│  lens === "astridr":                                             │
│    useArmsProbe() result → AstridrLensEmptyState (D-10/D-11)    │
└───────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Per `114-UI-SPEC.md` § Component Inventory & Layout (verified against live conventions, not
re-derived here):

```
src/
├── pages/
│   └── WorkspaceMap.tsx                    # lazy-routed, lens URL param
├── hooks/
│   ├── useWorkspaceMap.ts                  # useQuery(api.workspace.getWorkspaceMap) ?? ... (3-state passthrough, mirrors useProjectGraph.ts)
│   └── useArmsProbe.ts                     # useQuery(api.graphSnapshots.listSnapshots), .some(kind==="arms")
├── lib/
│   └── workspaceMapLayout.ts               # computeRollups, buildTree, layoutNodes — PURE, no React/Convex import
└── components/workspace/
    ├── WorkspaceMapCanvas.tsx              # owns expandedSet, wraps ForceGraphCanvas
    ├── WorkspaceMapPanel.tsx               # Sheet, node detail (D-09)
    ├── WorkspaceCoverageStrip.tsx          # always-visible header strip (D-14)
    └── AstridrLensEmptyState.tsx           # D-10 honest empty state
```

### Pattern 1: Pure layout module, precedent-verified

**What:** `computeVaultLayout` in `src/lib/skillVault.ts:300-390` is the load-bearing precedent
CONTEXT.md cites for "physics off, fixed coordinates" — read directly, not just cited secondhand.
It is a pure function (`(model, options) => VaultGraphData`) with **zero** React/Convex imports,
tested by `src/lib/skillVault.test.ts` with plain Vitest `describe`/`it` blocks and no canvas mock
at all.

**When to use:** `workspaceMapLayout.ts`'s three functions should follow this exact shape —
`(dirs) => rollups`, `(dirs) => tree`, `(tree, rollups, expandedSet) => {nodes, links}` — so D-16's
"prove determinism" and "prove degraded-flag handling" requirements can be satisfied with plain
Vitest, no `react-force-graph-2d` mock, no jsdom canvas stub.

**The pitfall UI-SPEC doesn't call out — verify this exact detail during planning:**
```typescript
// Source: src/lib/skillVault.ts:240-247 (interface), :385-386 (assignment)
export interface VaultNode {
  fx: number;
  fy: number;
  fz: number;
  /** Initial position mirror of fx/fy/fz — set so nodes render with 0 sim ticks. */
  x?: number;
  y?: number;
  z?: number;
  // ...
}
// later, after all fx/fy/fz are computed for every node:
nodes.forEach((n) => {
  n.x = n.fx;
  n.y = n.fy;
  // (skillVault.ts also mirrors z — WorkspaceMap is 2D, so x/y only)
});
```
`114-UI-SPEC.md`'s `layoutNodes(...)` description says only "Returns nodes with `fx`/`fy` set (not
just `x`/`y` — both cooldownTicks=0 **and** explicit fixed coordinates are required...)" — this reads
as "set fx/fy instead of x/y," which is the SkillVault lesson CONTEXT.md cites (`cooldownTicks=0`
alone is insufficient without fixed coordinates), but the actual codebase precedent for a **2D**
canvas sets **both** `fx`/`fy` (pins the node so the simulation cannot move it) **and** the plain
`x`/`y` mirror (so the node's very first paint, before `react-force-graph-2d` has run any tick,
isn't at its default `undefined`/randomized position). `d3-force`'s convention is: `fx`/`fy` pin a
node once the simulation initializes it, but a node's initial `x`/`y` is still assigned by d3
internally on first tick unless already present. With `cooldownTicks={0}` there may be effectively
zero ticks to correct a missing initial `x`/`y` before paint — the mirror closes that gap. Flag this
for the plan: `layoutNodes` should set `x`/`y` alongside `fx`/`fy` on every returned node, matching
`skillVault.ts:385-386` exactly. `[VERIFIED: src/lib/skillVault.ts:240-247,300-390]`

### Pattern 2: `ForceGraphCanvas` prop contract — verified against source

`src/components/graph/ForceGraphCanvas.tsx` (read in full):

| Prop | Line | Confirms |
|---|---|---|
| `colorFn?: (node) => string` | `:43` | D-06 department fill mechanism |
| `paintNode?: (node, ctx, globalScale, {hovered, dimmed}) => void` | `:47-52` | Optional custom paint — UI-SPEC deliberately does NOT use this (reuses default paint) |
| `communityColorFn?: (node) => string \| null` | `:75-77`, drawn `:264-282` | **Confirmed**: draws a halo arc (`ctx.arc(node.x, node.y, size + 3, ...)`, `ctx.stroke()`) around each node where the callback returns non-null, sitting between fill and any selection ring. D-06's access halo is a direct, unmodified reuse of existing shared code — zero new render logic needed. |
| `focusSet?: Set<string> \| null` | `:59`, dimming logic `:216-219` | Not consumed by D-01..D-18 (no focus-param deep-link requirement this phase) — leave unset. |
| `ForceGraphHandle.centerAt/zoom/zoomToFit/d3Force/d3ReheatSimulation` | `:30-38`, wired `:145-151` | All five imperative methods exist and are wired through `useImperativeHandle`. `zoomToFit(ms, padding)` is what `onEngineStop` should call, per `CodeVaultGraph.tsx:667`'s existing pattern (`fgRef2d.current?.zoomToFit(400, 60)`). |
| `cooldownTicks` | **hardcoded `120` at `:326`, no prop to override** | **Confirmed gap** — `114-UI-SPEC.md` already flags this and specifies the fix: add an optional `cooldownTicks?: number` prop to `ForceGraphCanvasProps` (default `120`), pass `0` from `WorkspaceMapCanvas`. Verified: no existing prop threads through to the `cooldownTicks={120}` literal on the underlying `<ForceGraph2D>` element (`:326`) — every other consumer (`CodeVaultGraph`, presumably KG Explorer/Tool Galaxy) currently gets the physics-on default. This is additive and non-breaking as UI-SPEC states — confirmed by reading every prop destructured at `:92-113`, none of which is `cooldownTicks`. |
| `defaultNodeColor` / `defaultLinkColor` | `:78-85`, resolution `:115-140` | Theme-aware fallback when no `colorFn`/`linkColorFn` supplied — `WorkspaceMapCanvas` should still pass `colorFn` explicitly (department lookup) so these fallbacks never engage, matching `CodeVaultGraph.tsx:663-664`'s pattern of supplying both a `colorFn` and a `defaultNodeColor`/`defaultLinkColor` pair. |

`[VERIFIED: src/components/graph/ForceGraphCanvas.tsx full read]`

### Pattern 3: `CodeVaultGraph.tsx` — the closest analog, structure extracted

915 lines, confirmed by direct read (content ends at line 915, `export default CodeVaultGraph;`).
Reusable structural pieces, each independently verified:

- **Three-state branch on the query hook** (`:880-913`): `undefined` → loading pulse,
  `null` → explainer empty state, object → `<GraphContent snapshot={snapshot} />`. `useWorkspaceMap`
  should branch identically — `undefined`/`null`/payload — per UI-SPEC's States table.
- **Theme-aware `colorFn` wrapped in `useCallback([colors])`** (`:197-200`) — re-creates only on
  theme switch, not on every render. `WorkspaceMapCanvas`'s department-lookup `colorFn` should follow
  this exact pattern (`useThemeColors()` → `useCallback` closing over `colors`).
  `communityColorFn={(node) => communityColor(node.community)}` at `:670` is the direct precedent for
  D-06's `communityColorFn={(node) => node.access === "astridr-reachable" ? colors.statusInfo : null}`.
- **`onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}`** (`:667`) — exact call signature to
  reuse for post-expand reframing.
- **Fullscreen toggle** (`:129`, `:292-300` ESC handler, `:467-474` class swap, `:582-605` button) —
  UI-SPEC's "reused, not reinvented" claim is accurate; the whole pattern (state, ESC listener,
  Tooltip-wrapped icon button, two className strings for normal/fullscreen) is self-contained and
  copyable.
- **Detail panel derives from the CURRENTLY-FILTERED data, not raw snapshot** (`:337-340` comment
  "WR-02 ... a hidden node must not appear as a neighbor") — the analogous rule for
  `WorkspaceMapPanel` is: when a node is collapsed/removed from `expandedSet`, its side panel (if
  open on that node) should close or the panel must not reference now-invisible children — worth an
  explicit task-level check since D-09's "N more subdirectories, click to expand" line depends on the
  panel reading live `expandedSet` state, not a stale snapshot.
- **Tooltip tests exist separately**: `CodeVaultGraph.tooltip.test.tsx` — confirms UI-SPEC's claim
  that dedicated tooltip tests are "worth reading before writing new hover code," though this phase's
  UI-SPEC deliberately skips custom hover/tooltip treatment (no custom `paintNode`, no `labelFn`
  beyond the default `node.name ?? node.id`), so this precedent is lower-priority for 114 than for a
  phase that does build custom hover UI.

`[VERIFIED: src/components/graph/CodeVaultGraph.tsx full read]`

### Pattern 4: Rollup computation — complexity and memoization boundary (fills a CONTEXT.md/UI-SPEC gap)

Neither CONTEXT.md nor UI-SPEC specifies the algorithmic shape or the memoization key for
`computeRollups`/`buildTree`. Recommendation, sized against the measured 4,912-row / 8-level-deep
payload (`114-CONTEXT.md` § Specific Ideas):

**`buildTree(dirs)`** — O(n). Build a `Map<string, DirRow[]>` keyed by `${rootId}|${parentDirPath}`
in a single pass (parent path = `dirPath` with the last `/`-segment removed, or `""` for a root's
direct children). This gives O(1) child lookup for both `buildTree`'s own construction and
`layoutNodes`'s traversal — never scan the full `dirs` array to find a node's children.

**`computeRollups(dirs)`** — O(n), no recursion needed if driven by the adjacency map from
`buildTree` and processed **deepest-first**: since `depth` is derivable from `dirPath.split("/").length`
(`""` = depth 0, the root), sort keys by descending depth once, then for each directory add its own
`fileCount`/`totalSize`/`withheldCount` **plus** its already-computed children's rolled-up totals into
a `Map<string, {fileCount, totalSize, withheldCount}>` keyed by `${rootId}|${dirPath}`. This never
revisits a node twice — O(n) total, not O(n·depth).

**Memoization key — use `activeVersion`, not the array reference.** D-02 states "the subscription
re-pushes on every `activeVersion` flip, which is once a night" — `payload.activeVersion` is a stable
primitive extracted from the Convex response and is the correct `useMemo` dependency:

```typescript
const rollups = useMemo(
  () => computeRollups(payload.dirs),
  [payload?.activeVersion] // NOT payload.dirs — see below
);
```

Reasoning: whether `convex/react`'s `useQuery` returns a referentially-stable `dirs` array across
renders when the underlying data hasn't changed is not independently verified in this session
`[ASSUMED]` — if Convex's client re-creates the array on every render (even unchanged), memoizing on
`payload.dirs` would recompute the rollup on every render, defeating the memo. Memoizing on the
primitive `activeVersion` field is correct regardless of that Convex internal behavior, because
`activeVersion` is guaranteed to be a stable number that only changes on an actual nightly re-push
(D-02's own text). Recommend the planner add a one-line test asserting `computeRollups` is not
re-invoked across two renders with the same `activeVersion` (spy or render-count assertion) if this
matters for the phase's performance bar; otherwise this is a correctness-neutral, performance-only
recommendation.

**`layoutNodes(tree, rollups, expandedSet)` stays bounded by VISIBLE node count, not 4,912.** Because
`buildTree` already produced a parent→children adjacency map, `layoutNodes` should traverse
top-down from the center hub, only descending into a subtree when its key is present in
`expandedSet` — this naturally bounds the traversal to the current visible set (391 nodes at D-01's
first-load floor, growing only as the user expands). **Anti-pattern to avoid:** do not implement
`layoutNodes` as `dirs.filter((d) => isVisible(d, expandedSet))` over the flat 4,912-row array on
every click — even though 4,912 iterations is sub-millisecond in absolute terms and would not cause a
visible performance problem at this data size, it silently reintroduces an O(n) full-array scan on
every click that the adjacency-map traversal avoids for free, and it is the shape that would become a
real cost if the tree grows (Deferred Ideas already anticipates this: "a bounded/paged
`getWorkspaceMap` variant... becomes necessary if the tree outgrows a single fetch").

`[ASSUMED: Convex useQuery array-reference stability across renders — not verified this session,
recommend confirming empirically or memoizing on the primitive activeVersion field regardless, which
is correct either way]`

### Pattern 5: Theme tokens for departments — independently verified against `src/index.css`

`114-UI-SPEC.md` § Color already resolves this (new `--dept-personal`/`--dept-consulting`/
`--dept-work` tokens, Unclassified reuses `--muted-foreground`, rejecting `--chart-*` reuse). This
research independently confirms the reasoning is sound by reading the cited mechanism rather than
re-deriving new values:

- `useThemeColors.ts`'s `ThemeColors` interface (`:14-27`) currently has **12 fields**, of which 5
  are non-status/non-alpha tokens (`primary`, `accent`, `vaultNode`, `chartBar`, `chartBarAccent`) —
  CONTEXT.md's "five non-status tokens" claim is about that non-status/non-alpha subset specifically,
  confirmed accurate by direct read, not a miscount.
- `resolveThemeColors()` (`:41-75`) resolves every field via a fresh `getComputedStyle(...).trim()`
  call per field — **no caching of the `CSSStyleDeclaration`**, confirming the Pitfall-2 comment at
  `:37-39` is live in the current code (not stale documentation): each `get(token)` call inside
  `resolveThemeColors` does a fresh `style.getPropertyValue(token)`, so the same discipline applies
  automatically to any new fields the plan adds (`mutedForeground`, `deptPersonal`, `deptConsulting`,
  `deptWork`) — no separate mechanism needed, just add fields to the returned object using the
  existing `get()` helper.
- The `MutationObserver` re-resolves the whole object on `data-theme` change (`:92-103`) — new fields
  automatically participate in theme-switch re-resolution with zero additional wiring.

`[VERIFIED: src/hooks/useThemeColors.ts full read]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force-graph canvas rendering, hover, click-to-center, dimming | A new canvas/WebGL render loop | `ForceGraphCanvas` (`src/components/graph/ForceGraphCanvas.tsx`) with one additive prop (`cooldownTicks`) | It already owns hover state, click-to-center, dark glow container, and delegates all domain encoding to callbacks — exactly the shape D-06's fill+halo encoding needs. |
| Access-halo visual treatment | Custom `paintNode` drawing a second ring | `communityColorFn` (existing, `ForceGraphCanvas.tsx:264-282`) | Zero new render code — the halo arc mechanism is already built and tested by KG Explorer's community-color usage. |
| Fixed/deterministic layout math | A custom d3-force wrapper or a new physics engine | Plain pure-function coordinate math (`skillVault.ts` precedent) + `fx`/`fy` + `cooldownTicks={0}` | `react-force-graph-2d`/d3-force already supports pinned nodes via `fx`/`fy`; no alternative rendering library is needed for a deterministic layout. |
| Path/label privacy redaction | A bespoke masking rule for this map | `usePrivacyMask()`'s `redact()` (`:39-42`) — NOT `maskFilePath`/`maskPath`, which is structurally wrong for single-segment root names (see UI-SPEC's own analysis, verified above) | App-wide masking contract already exists; a bespoke Consulting-only rule was explicitly rejected in D-15. |
| Theme color resolution for canvas fill | Reading CSS vars directly in canvas paint code | `useThemeColors()` / `resolveThemeColors()` | Canvas APIs cannot read CSS custom properties natively — this is exactly why the hook exists, and it already handles the theme-switch re-resolution and hex/oklch guard. |

**Key insight:** every piece of new-looking functionality in this phase (halo rings, theme-aware
node fill, privacy masking, fixed layouts) already has a working, tested implementation elsewhere in
this codebase. The actual new code this phase writes is: the radial coordinate math itself (which is
pure arithmetic, not a hand-rolled rendering system), the rollup/tree pure functions, and the
React components that wire existing pieces together.

## Common Pitfalls

### Pitfall 1: `fx`/`fy` without the `x`/`y` mirror
**What goes wrong:** Nodes render at wrong/undefined positions on first paint, or briefly "pop" from
a wrong position to the pinned one, even with `cooldownTicks={0}`.
**Why it happens:** `fx`/`fy` pin a node's position for the simulation, but `d3-force` still assigns
an initial `x`/`y` internally unless one is already present on the node object. With zero cooldown
ticks there is no time for the simulation to visibly "correct" a missing initial position before the
first canvas paint.
**How to avoid:** `layoutNodes` must set both `fx`/`fy` **and** a plain `x`/`y` mirror on every node,
per `skillVault.ts:385-386`.
**Warning signs:** Nodes flash or briefly jump on load/expand; a screenshot test's first frame differs
from a later frame of the same layout.

### Pitfall 2: Recomputing rollups/tree on every expand click
**What goes wrong:** Unnecessary CPU work on every click; at 4,912 rows this is likely still fast in
absolute terms, but it is the wrong complexity shape and will not scale if the tree grows (Deferred
Ideas already names this risk for the data-fetch side; the same principle applies to the client-side
compute side).
**Why it happens:** `computeRollups`/`buildTree` depend only on `dirs` (stable except on nightly
re-push); `layoutNodes` depends on `expandedSet` (changes every click). Memoizing all three on the
same dependency array conflates a rarely-changing input with a frequently-changing one.
**How to avoid:** Two separate `useMemo` boundaries — `[payload?.activeVersion]` for
rollups/tree, `[tree, rollups, expandedSet]` for `layoutNodes`.
**Warning signs:** A profiler flame graph showing `computeRollups` re-running on every click.

### Pitfall 3: An unhandled `useQuery` throw blanking the whole page
**What goes wrong:** A Convex query error (network blip, malformed response) unmounts the entire
React tree, not just the failing widget.
**Why it happens:** Documented twice already in this repo — Phase 110's `/analytics` incident and the
`heroStats` incident (`CLAUDE.md` § Patterns). `useQuery` throws propagate to the nearest error
boundary, which by default is the app root if no local boundary exists.
**How to avoid:** Two independent `SectionErrorBoundary`s, exactly as UI-SPEC specifies — one around
the coverage strip, one around the canvas — so a fault in one doesn't blank the other.
**Warning signs:** A single flaky query taking down the entire `/workspace-map` page instead of just
one section.

### Pitfall 4: Testing the canvas directly instead of the pure layout math
**What goes wrong:** Slow, brittle tests that mock `react-force-graph-2d` just to assert on
coordinate values that a pure function could assert on directly.
**Why it happens:** The temptation to test "the whole component" rather than isolating the
deterministic math from the render layer.
**How to avoid:** `workspaceMapLayout.ts`'s functions take plain data in, return plain data out — no
Convex mock, no `react-force-graph-2d` mock needed for D-08's determinism proof or D-16's
fixture-per-flag proofs on the layout/rollup logic itself. Reserve the `react-force-graph-2d` mock
(per `ForceGraphCanvas.test.tsx`'s pattern) for the thin integration surface — e.g., confirming
`WorkspaceMapCanvas` passes `cooldownTicks={0}` and a `communityColorFn` — not for re-testing the
math.
**Warning signs:** A test file that needs to mock `react-force-graph-2d` just to check that two
directories with the same input produce the same `fx`/`fy`.

### Pitfall 5: `--chart-*` reuse for department fill (already rejected, but worth stating as a pitfall for anyone tempted to "simplify")
**What goes wrong:** Department 3 renders identically to a warning/error status color, or falls back
to unstyled light-mode gray under the `emerald` theme.
**Why it happens:** `[data-theme="aubergine"]` defines all five `--chart-*` slots as literal aliases
of primary/accent/status colors (verified by UI-SPEC's own citation, not re-verified independently
this session since it is UI-SPEC's domain, not RESEARCH's — but the reasoning is sound and matches
the pattern seen in every other theme block read during this research). `emerald` leaves
`--chart-3/4/5` undefined, falling through to `:root`'s light-mode oklch grays.
**How to avoid:** Three new dedicated `--dept-*` tokens, per D-06/UI-SPEC's Color section — do not
"simplify" by reusing `--chart-*` during implementation even though it looks like less new CSS.
**Warning signs:** A department reads as a warning color under `aubergine`, or as pale gray under
`emerald`.

## Code Examples

### Deterministic fixed layout with x/y mirror (pattern to copy)
```typescript
// Source: src/lib/skillVault.ts:300-390 (computeVaultLayout), adapted to 2D
export function layoutNodes(
  tree: DirTree,
  rollups: RollupMap,
  expandedSet: Set<string>,
): { nodes: WorkspaceMapNode[]; links: WorkspaceMapLink[] } {
  const nodes: WorkspaceMapNode[] = [];
  // ... ring/angle assignment per 114-UI-SPEC.md's Radial Layout Geometry table ...
  for (const n of nodes) {
    // Mirror fx/fy onto x/y so first paint (before any sim tick) is correct —
    // required in addition to fx/fy, not instead of it (skillVault.ts:385-386).
    n.x = n.fx;
    n.y = n.fy;
  }
  return { nodes, links };
}
```

### `communityColorFn` halo — direct reuse, zero new render code
```typescript
// Source: src/components/graph/CodeVaultGraph.tsx:670 (the existing precedent)
communityColorFn={(node: any) => communityColor(node.community)}

// D-06's equivalent for the access halo:
communityColorFn={(node: any) =>
  node.access === "astridr-reachable" ? colors.statusInfo : null
}
```

### `cooldownTicks` prop addition — the one substrate change this phase makes
```typescript
// Source: src/components/graph/ForceGraphCanvas.tsx:106-113 (existing destructure),
// :326 (the hardcoded literal to parameterize)
export interface ForceGraphCanvasProps {
  // ...existing props...
  /** Simulation cooldown ticks before onEngineStop fires. Default 120 (existing
   *  behavior, byte-identical for CodeVaultGraph/KG Explorer). Pass 0 for a
   *  fully deterministic, physics-off layout (D-08). */
  cooldownTicks?: number;
}
// destructure: const { ..., cooldownTicks = 120 } = props;
// pass through: <ForceGraph2D ... cooldownTicks={cooldownTicks} .../>
```

## Runtime State Inventory

Not applicable — this is a greenfield frontend build (new page, new components, one additive backend
field), not a rename/refactor/migration phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Convex `useQuery`'s returned `dirs` array reference stability across renders when data hasn't changed is not independently verified this session. | Architecture Patterns → Pattern 4 (Rollup computation) | Low — the recommended memoization key (`activeVersion`, a stable primitive) is correct regardless of whether this assumption holds, so the risk is purely "an extra wasted recompute on some renders," never a correctness bug. |
| A2 | `d3-force`'s internal behavior of assigning an initial `x`/`y` to a node lacking one, even under `cooldownTicks={0}`, is inferred from the `skillVault.ts` precedent's own comment ("set so nodes render with 0 sim ticks") rather than independently verified against `d3-force-3d`'s source or docs this session. | Architecture Patterns → Pattern 1 / Common Pitfalls → Pitfall 1 | Low-medium — if wrong, the mirror is simply unnecessary defensive code with no downside; if the pitfall is real and the mirror is skipped, nodes may flash/mis-position on first paint, a visible but non-blocking bug easily caught by the mutation/determinism tests recommended below. |

**If this table is empty:** N/A — two low-risk assumptions logged above; neither blocks planning.

## Open Questions

1. **Does `useThemeColors()` need a new `mutedForeground` field, or can Unclassified read
   `--muted-foreground` some other way?**
   - What we know: `ThemeColors` (`useThemeColors.ts:14-27`) does not currently expose
     `--muted-foreground` as a field; UI-SPEC's proposed extension adds it explicitly
     (`mutedForeground: string; // var(--muted-foreground)`).
   - What's unclear: whether reading `--muted-foreground` via a fresh one-off
     `getComputedStyle(...).getPropertyValue(...)` call inside `WorkspaceMapCanvas` (bypassing
     `useThemeColors()` for this one token) would be simpler than extending the shared hook —
     UI-SPEC already decided to extend the hook, and this research found no reason to disagree, but
     flags it as a two-line decision the planner should confirm rather than assume is uncontested.
   - Recommendation: extend `ThemeColors` as UI-SPEC specifies — consistent with the hook's own
     "Field names are STABLE... do not rename" comment (`:11-13`), which implies the intended pattern
     is to grow the interface, not read around it.

2. **Should `WorkspaceMapPanel` close automatically when its selected node is collapsed out of
   `expandedSet`?**
   - What we know: `CodeVaultGraph`'s detail panel derives from `filteredData`, never a stale
     snapshot (`CodeVaultGraph.tsx:337-340`, the WR-02 precedent).
   - What's unclear: neither CONTEXT.md nor UI-SPEC states the expected behavior when a user opens a
     node's panel, then clicks its parent to collapse it (removing the child from `expandedSet` and
     thus from the visible/positioned node set).
   - Recommendation: close the panel (or fall back to a "this node is currently collapsed" state)
     when the selected node's key leaves `expandedSet`, matching the WR-02 precedent's spirit — flag
     for the plan as a small explicit task rather than an assumed default.

## Environment Availability

Skipped — this phase has no new external dependencies. All tooling (Node/npm, Vitest, the self-hosted
Convex backend) is already running and verified live by CONTEXT.md's own measurements (4,912 rows
returned successfully from `getWorkspaceMap` on 2026-08-13).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (`package.json:89`), jsdom environment |
| Config file | `vitest.config.ts` (repo root) — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']` `[VERIFIED: vitest.config.ts:12-15]` |
| Quick run command | `npx vitest run src/lib/workspaceMapLayout.test.ts` (pure-function suite, no DOM/canvas needed — fastest feedback loop) |
| Full suite command | `npm test` (repo `package.json:11`, runs `vitest`) |

**Correction to a CLAUDE.md claim, found while researching this phase:** CLAUDE.md's Testing section
states `src/test/setup.ts` "mocks heavy externals (Clerk, Recharts, Three.js, Globe, React Flow,
Tone.js)." Reading `setup.ts` in full (139 lines) shows it does NOT globally mock any of those — it
installs jsdom polyfills for `SpeechRecognition`, `Audio`, `Worker`, `AudioWorkletNode`, and a
`livekit-client` mock. `react-force-graph-2d` (the library this phase's canvas depends on, and the
one CLAUDE.md's list most closely gestures at with "React Flow" — a different library, not present in
`src/` at all per a repo-wide check) is **not** mocked globally either. The actual, verified pattern
is **per-test-file `vi.mock("react-force-graph-2d", ...)`**, confirmed identically in both
`ForceGraphCanvas.test.tsx:15-26` and `CodeVaultGraph.test.tsx` (via its `vi.mock("convex/react", ...)`
+ theme-hook mocks, with the canvas mock inherited transitively through `ForceGraphCanvas`). Any new
`WorkspaceMapCanvas.test.tsx` should copy `ForceGraphCanvasProps`-capturing mock exactly:
```typescript
// Source: src/components/graph/ForceGraphCanvas.test.tsx:9-26 (the pattern to copy verbatim)
const h = vi.hoisted(() => ({ props: null as Record<string, any> | null }));
vi.mock("react-force-graph-2d", () => ({
  default: reactForwardRef((props, ref) => { h.props = props; return null; }),
}));
```
This is the mechanism for asserting `cooldownTicks={0}` and `communityColorFn` were actually passed
through, without a real canvas. `[VERIFIED: src/test/setup.ts full read + repo-wide grep control]`

### Phase Requirements → Test Map

No REQ-IDs this phase (design-doc-driven, D-01..D-18 traced instead). Mapping D-decisions to tests:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-01 | First load renders exactly 391 nodes (center+4 depts+53 roots+333 depth-1) | unit (pure) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "391 nodes"` | ❌ Wave 0 |
| D-02/D-03 | Expansion adds exactly one level's children per click, never a whole subtree | unit (pure) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "one level per click"` | ❌ Wave 0 |
| D-04 | Collapsed node's rolled-up total equals the sum of its full subtree's direct counts | unit (pure) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "rollup"` | ❌ Wave 0 |
| D-06 | `communityColorFn` returns non-null only for `access === "astridr-reachable"` | unit (component, mocked canvas) | `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx -t "halo"` | ❌ Wave 0 |
| D-08 | Same input `dirs` array (any order) → byte-identical `fx`/`fy` output, twice in a row | unit (pure, determinism) | `npx vitest run src/lib/workspaceMapLayout.test.ts -t "determinism"` | ❌ Wave 0 |
| D-09 | Withheld-files notice line renders iff `withheldCount > 0`; both direct and rolled-up counts shown, labeled | unit (component) | `npx vitest run src/components/workspace/WorkspaceMapPanel.test.tsx` | ❌ Wave 0 |
| D-10/D-11 | Ástríðr lens shows the empty-state copy, driven live by `useArmsProbe`, not hardcoded | unit (component, mocked `listSnapshots`) | `npx vitest run src/components/workspace/AstridrLensEmptyState.test.tsx` | ❌ Wave 0 |
| D-12 | Lens survives via `?lens=` URL param, default `workspace` when absent | unit (component, `MemoryRouter`) | `npx vitest run src/pages/WorkspaceMap.test.tsx -t "lens param"` | ❌ Wave 0 |
| D-14/D-16 | Coverage strip: healthy render passes with all 4 flags green; each of the 4 degraded flags independently flips the strip to warn styling; a mutation test proves a healthy fixture FAILS the "no warn chip" assertion when one flag is flipped | unit (component, fixture-per-flag + mutation) | `npx vitest run src/components/workspace/WorkspaceCoverageStrip.test.tsx` | ❌ Wave 0 |
| D-15 | `maskPaths` on: root labels → `"{department} root {index}"`; directory labels → `redact()` placeholder. Off (default): unmasked. | unit (component, `PrivacyContext` wrapper) | `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx -t "privacy"` | ❌ Wave 0 |
| D-17 | Strip shows "overdue" / warn styling only when `now - generatedAt > 36h`; boundary-tested at exactly 36h and 36h+1s | unit (pure or component) | `npx vitest run src/components/workspace/WorkspaceCoverageStrip.test.tsx -t "staleness"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>` (fast, targeted)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/workspaceMapLayout.test.ts` — covers D-01, D-02, D-03, D-04, D-08 (pure-function, no
  mocks, follows `src/lib/skillVault.test.ts`'s structure directly)
- [ ] `src/test/workspaceMapFixture.ts` — the workspace-map equivalent of
  `src/test/projectGraphFixture.ts`, per CONTEXT.md's explicit instruction. Must expose:
  - `makeWorkspaceMapFixture(overrides?)` returning a payload matching `getWorkspaceMap`'s exact
    return shape (`convex/workspace.ts:320-345`), with **all four honesty flags green by default**
    (`scannedRootsComplete: true`, `accessDerivationOk: true`, `localConfigStatus: "merged"`, and an
    empty `unclassifiedRootIds`), so a plain `makeWorkspaceMapFixture()` call is the healthy-render
    control.
  - Four named override presets (or a documented override pattern) for D-16's degraded states:
    `scannedRootsComplete: false`, `accessDerivationOk: false`,
    `localConfigStatus: "absent"`, `localConfigStatus: "version-mismatch"`.
  - **Synthetic root/directory names only** — e.g. `"acme-client"`, `"root-a"`, `"root-b"` — never a
    real name from Larry's live tree (Phase 115 D-17, carried forward by 114's D-16 and States table).
    This binds the fixture file itself, any test asserting against it, and any screenshot taken during
    manual QA.
  - `mockGetWorkspaceMap(value)` / `mockArmsProbe(value)` mock-configuration helpers, mirroring
    `mockGetProjectGraph`'s shape (`src/test/projectGraphFixture.ts:180-186`).
- [ ] Mutation test for D-16, concretely: render `WorkspaceCoverageStrip` with the healthy fixture,
  assert **zero** elements carry the warn/`--status-warn` styling class or `AlertTriangle` icon; then
  render with each of the four degraded overrides in turn and assert the corresponding warn chip
  **is** present. The mutation direction that must be proven, per the project's standing rule ("a gate
  that can skip itself must be shown to have evaluated something"): take the healthy-fixture test,
  flip exactly one flag in the fixture, and confirm the **existing "no warn chip" assertion fails**
  before the corresponding degraded-state assertion is written — i.e., write the healthy assertion
  first, prove it can fail (temporarily hardcode a flipped flag, watch it go red), then write the
  degraded-state test as the fix. This is the same shape as `115-03-PLAN.md`'s dry-run gate mutation
  proof (`.planning/phases/115-workspace-scanner/` — RED 7/17 then GREEN 24/24, cited in ROADMAP.md
  line 945).
- [ ] Determinism test for D-08, concretely: call `layoutNodes(tree, rollups, expandedSet)` twice with
  the identical fixture inputs (same object references or deep-equal reconstructions) and assert
  `toEqual` on the full returned `{nodes, links}` — including `fx`/`fy`/`x`/`y` on every node. Also
  call it once with `dirs` in forward order and once with `dirs.slice().reverse()` fed through
  `buildTree`/`computeRollups` first, asserting the same output — proving the layout is a function of
  the DATA, not of array iteration order (a stronger determinism claim than merely "same reference
  twice → same output").
- [ ] Framework install: none — Vitest is already configured and used identically by
  `skillVault.test.ts`, `ForceGraphCanvas.test.tsx`, and `CodeVaultGraph.test.tsx`.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (confirmed by direct read — the file
contains only a `workflow` key) — absent means enabled per the governing convention, but this phase's
actual attack surface is minimal and already governed by an existing, explicit repo decision.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase adds no auth surface — read-only page, no login/session concept. |
| V3 Session Management | No | No new session state beyond the existing app shell. |
| V4 Access Control | Yes — inherited, not newly introduced | D-13 adds a field to an existing **public** Convex query (`listSnapshots`). Per `CLAUDE.md`'s already-established, already-decided rule (SEED-008): every public Convex function is callable with no credential by anything that can route to the host; the tailnet + LAN firewall block is the auth boundary, not per-function gating. This phase does not reopen that decision — it is explicitly out of scope per D-13's own reasoning (a new dedicated query was rejected specifically because "a new public function is not free"). No new action needed beyond what D-13 already specifies: add the field, don't add new auth. |
| V5 Input Validation | No new input this phase | `getWorkspaceMap`/`listSnapshots` take no new client-supplied arguments (`getWorkspaceMap` already accepts an optional `snapshotId` string, unchanged this phase). The URL `?lens=` param (D-12) should be validated client-side to a closed set (`"workspace" | "astridr"`, default `"workspace"` for anything else) rather than trusted verbatim — a defensive default, not a security boundary, since it only ever drives which local React branch renders. |
| V6 Cryptography | No | Not applicable — no crypto surface this phase touches. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Directory/root names disclosed in a screenshot or shared link | Information Disclosure | D-15's `PrivacyContext`/`usePrivacyMask` masking — already the app-wide pattern, this phase's specific application verified above (Pattern 5 / `usePrivacyMask.ts`). |
| Synthetic-vs-real names leaking into fixtures, tests, or committed screenshots | Information Disclosure | D-16's explicit "synthetic root names only" rule, carried from Phase 115's D-17 public-repo disclosure rule — enforced by the Wave 0 fixture file using invented names exclusively (see Validation Architecture above). |
| Malformed `?lens=` value used to construct a DOM string or query directly | Tampering (low severity here) | Closed-set validation on the client (see V5 row above) — the value never reaches a Convex query argument or is interpolated into rendered HTML unescaped (React's default JSX text-node escaping already covers this if the value is only ever rendered as plain text, which it is per UI-SPEC's copy contract). |

## Sources

### Primary (HIGH confidence — direct source reads this session)
- `C:\Users\mandr\codepulse\src\components\graph\ForceGraphCanvas.tsx` — full read, prop contract and `cooldownTicks` gap
- `C:\Users\mandr\codepulse\src\components\graph\CodeVaultGraph.tsx` — full read, 915 lines confirmed
- `C:\Users\mandr\codepulse\src\hooks\useThemeColors.ts` — full read, `ThemeColors` interface and Pitfall-2 discipline confirmed live
- `C:\Users\mandr\codepulse\src\lib\skillVault.ts` (lines 220-390) + `skillVault.test.ts` — the `fx`/`fy`/`x`/`y` mirror precedent
- `C:\Users\mandr\codepulse\src\contexts\PrivacyContext.tsx` — full read, `maskPaths`/`usePrivacy` line anchors
- `C:\Users\mandr\codepulse\src\hooks\usePrivacyMask.ts` + `src\lib\privacy.ts` — `redact()` vs `maskFilePath` mechanism
- `C:\Users\mandr\codepulse\convex\workspace.ts` — full read, `getWorkspaceMap`/`WORKSPACE_SNAPSHOT_ID` anchors, payload shape
- `C:\Users\mandr\codepulse\convex\schema.ts` (lines 1885-1909, 2375-2442) — `workspaceSnapshots`/`workspaceDirs`/`graphSnapshots.sources` field definitions
- `C:\Users\mandr\codepulse\convex\graphSnapshots.ts` (lines 300-330) — `listSnapshots` current shape
- `C:\Users\mandr\codepulse\src\lib\navRegistry.ts` (lines 1-160) — GRAPHS group, icon collision check
- `C:\Users\mandr\codepulse\src\test\setup.ts` — full read, corrects a stale CLAUDE.md claim
- `C:\Users\mandr\codepulse\vitest.config.ts` (lines 12-15) — test environment config
- `C:\Users\mandr\Mandras\02-projects\agentic-os-second-brain.md` (lines 1-60) — dependency graph line 48, C1/C2 bullets
- `C:\Users\mandr\astridr-repo\.planning\STATE.md`/`ROADMAP.md` — live grep confirming milestone v28.0, zero "arms"/v29 hits
- `C:\Users\mandr\codepulse\src\test\projectGraphFixture.ts` — full read, fixture/mock pattern to mirror
- `C:\Users\mandr\codepulse\src\components\graph\ForceGraphCanvas.test.tsx` (lines 1-90) — `react-force-graph-2d` per-file mock pattern

### Secondary (MEDIUM confidence)
- `C:\Users\mandr\codepulse\src\components\graph\CodeVaultGraph.test.tsx` (lines 1-50) — test file structure, spot-checked not exhaustively read

### Tertiary (LOW confidence)
- None — this phase's research surface was entirely internal-codebase verification; no external library API claims required Context7/WebSearch lookup.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages, every dependency already live and grep-confirmed in use.
- Architecture: HIGH — every prop/function/line cited was read directly this session, not inherited from CONTEXT.md/UI-SPEC without verification.
- Pitfalls: HIGH for the `fx`/`fy`/`x`/`y` mirror (direct precedent read) and rollup memoization (derived from stated D-02 facts); MEDIUM for the Convex `useQuery` reference-stability assumption (A1), explicitly flagged.

**Research date:** 2026-08-13
**Valid until:** 30 days (stable internal codebase; no fast-moving external dependency in this phase's critical path) — re-verify the live payload counts in CONTEXT.md § Specific Ideas if the nightly scan has run many times since, per that section's own instruction.
