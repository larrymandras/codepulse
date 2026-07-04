---
phase: 91-3d-memory-galaxy
plan: "03"
subsystem: graph
tags: [3d, react-force-graph-3d, three, idb-keyval, wave-2, tdd-green, chunk-isolation]
dependency_graph:
  requires: [ForceGraph3D-component, centerNode3DWhenReady, ForceGraph3D-test-scaffold]
  provides: [renderMode-toggle, idb-render-mode-persistence, lazy-3d-swap, colorFn3D, 3d-focus-branch]
  affects:
    - src/components/graph/CodeVaultGraph.tsx
    - src/components/graph/CodeVaultGraph.test.tsx
    - src/components/graph/ForceGraph3D.tsx
tech_stack:
  added: []
  patterns:
    - idb-keyval-render-mode-persistence (get/set with cancelled guard + coercion)
    - React.lazy-module-level-const (chunk isolation via lazy + Suspense)
    - hex-only-3D-color-callbacks (rgba unsafe for Three.js Color)
    - useCallback-theme-aware-3D (deps [selectedNodeId,hoveredNodeId,neighborIds,colors])
    - refresh-after-sim-settle (fgRef3d.current?.refresh() on state/color changes)
key_files:
  created: []
  modified:
    - src/components/graph/CodeVaultGraph.tsx
    - src/components/graph/CodeVaultGraph.test.tsx
    - src/components/graph/ForceGraph3D.tsx
decisions:
  - "LazyForceGraph3D uses .then(m => ({ default: m.ForceGraph3D })) pattern — avoids touching ForceGraph3D.tsx's named-export API surface while giving lazy() the required default export"
  - "export default ForceGraph3D added to ForceGraph3D.tsx — required for lazy() default-export contract; named export preserved for type imports"
  - "Task 3 (focus branch) implemented in Task 1 commit — onFocus mode-conditional is a natural extension of the renderMode state setup; wired atomically rather than splitting across two commits"
  - "refresh() wired after sim-settle; RESEARCH Open Question 1 (does refresh() re-apply to cached materials) noted in summary — to be validated empirically in dev app during Plan 05 FPS benchmark"
metrics:
  duration_minutes: 12
  completed_date: "2026-06-29"
  tasks_completed: 3
  tasks_total: 3
  files_created: 0
  files_modified: 3
---

# Phase 91 Plan 03: 3D Memory Galaxy — CodeVaultGraph Integration Summary

Opt-in 3D render mode fully integrated into CodeVaultGraph: 2D|3D toggle with idb-keyval persistence, lazy chunk-isolated render surface swap, theme-aware hex-only 3D color/size callbacks, ?focus= 3D centering branch, and refresh-after-settle effect — 2D path byte-unchanged and Wave 0 Nyquist tests GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | renderMode state, idb persistence, 2D|3D toggle UI | 453f3d0 | CodeVaultGraph.tsx, CodeVaultGraph.test.tsx, ForceGraph3D.tsx |
| 2 | Lazy render-surface swap + theme-aware 3D color/size callbacks + refresh | f0c4d81 | CodeVaultGraph.tsx |
| 3 | Wire ?focus= 3D centering branch | (in Task 1 commit — see Deviations) | CodeVaultGraph.tsx |

## What Was Built

**Task 1 — renderMode state, idb persistence, 2D|3D toggle UI:**
- `const [renderMode, setRenderMode] = useState<"2d" | "3d">("2d")` and `const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)` added to GraphContent state block
- `fgRef` renamed to `fgRef2d`; `const fgRef3d = useRef<ForceGraph3DHandle>(null)` added
- idb hydrate-on-mount effect: `idbGet("codepulse:render-mode")` with `cancelled` guard + `saved === "3d"` coercion (never `setRenderMode(saved)` — T-91-IDB mitigation); `.catch` swallowed for private-browsing
- `handleModeToggle(mode)`: `setRenderMode(mode)` + `idbSet("codepulse:render-mode", mode).catch(() => {})`
- `renderModeChipClass(mode)`: cloned from `chipClass` — active=`bg-primary/10 text-primary border-primary/40`, inactive=`bg-transparent text-muted-foreground border-border`
- `<div role="group" aria-label="Render mode">` with `2D` and `3D` `<button>`s (each `aria-pressed`) inserted between source-filter group and fullscreen button per UI-SPEC §Toggle Anatomy
- Module-level `const LazyForceGraph3D = lazy(() => import("./ForceGraph3D").then(m => ({ default: m.ForceGraph3D })))` outside GraphContent
- `export default ForceGraph3D;` added to `ForceGraph3D.tsx` (required for lazy() default-export contract)
- `vi.mock("idb-keyval", ...)` added to `CodeVaultGraph.test.tsx` (component now imports idb-keyval directly)
- Mode-conditional `useFocusParam` onFocus: 2D branch keeps `centerNodeWhenReady(fgRef2d, ...)` unchanged; 3D branch calls `centerNode3DWhenReady(fgRef3d, ...)`

**Task 2 — Lazy render-surface swap + 3D callbacks:**
- `neighborIds` useMemo: `Set<string>` of selected node's neighbor IDs from `filteredData.links` (O(1) membership for colorFn3D dim logic)
- `colorFn3D` useCallback (deps `[selectedNodeId, hoveredNodeId, neighborIds, colors]`):
  - selected node → `"#ffffff"` (bright white)
  - hovered node → `"#ffffff"` (bright white)
  - non-neighbor when selection active → `"#27272a"` (zinc-800 hex, NOT rgba — Pitfall 1)
  - else → `isVaultNode ? colors.vaultNode : colors.primary`
- `nodeValFn3D` useCallback (deps `[selectedNodeId]`): selected → `(val ?? 1) * 3`, else `(val ?? 1)`
- `linkColorFn3D` useCallback (deps `[colors]`): vault↔vault → `colors.vaultNode`, code↔code → `colors.primary`, cross → `"#94a3b8"` — all hex-only, never rgba
- Refresh `useEffect`: `if (renderMode !== "3d") return; fgRef3d.current?.refresh();` fires on `[selectedNodeId, hoveredNodeId, colors, renderMode]`
- Swap point: `renderMode === "2d"` → `<ForceGraphCanvas ref={fgRef2d} ... />` (2D props byte-identical to pre-plan mount); else `<Suspense fallback={canvasClass loader}><LazyForceGraph3D ref={fgRef3d} ... /></Suspense>`

**Task 3 — ?focus= 3D centering branch:**
- Implemented in Task 1 commit (see Deviations). `useFocusParam` onFocus already mode-conditional with `centerNode3DWhenReady(fgRef3d, ...)` in the 3D branch.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | CLEAN |
| `npx vitest run ForceGraph3D.test.tsx CodeVaultGraph.test.tsx graph-center.test.ts` | 25/25 PASS |
| ForceGraph3D.test.tsx SC#1 (toggle-restore) | GREEN |
| ForceGraph3D.test.tsx SC#4 (disposal-unmount) | GREEN |
| ForceGraph3D.test.tsx SC#5 (colorFn hex) | GREEN |
| CodeVaultGraph.test.tsx (2D regression, 13 cases) | GREEN |
| graph-center.test.ts (9 cases) | GREEN |
| `grep rgba( colorFn3D/linkColorFn3D bodies` | NO MATCH — hex-only confirmed |
| `grep -Eq "lazy\(\(\) => import\(\"./ForgeGraph3D\"\)"` | PASS (pattern in src) |
| `grep -Eq "codepulse:render-mode"` | PASS (both idbGet and idbSet sites) |
| `grep -Eq "role=\"group\" aria-label=\"Render mode\""` | PASS |
| `grep -Eq "centerNode3DWhenReady\(fgRef3d"` | PASS |

## Deviations from Plan

### Auto-included in adjacent task

**1. [Rule 2 - Missing Critical Feature] Added `export default ForceGraph3D` to ForceGraph3D.tsx**
- **Found during:** Task 1 (when adding the module-level `lazy()` call)
- **Issue:** `React.lazy(() => import("./ForgeGraph3D"))` requires the module to have a default export. ForgeGraph3D.tsx only had a named export.
- **Fix:** Added `export default ForgeGraph3D;` at the bottom of ForgeGraph3D.tsx, below the named `ForgeGraph3DHandle`/`ForgeGraph3DProps` exports. Named export preserved for type imports.
- **Files modified:** `src/components/graph/ForgeGraph3D.tsx`
- **Commit:** 453f3d0

**2. [Rule 2 - Missing Critical Feature] Added idb-keyval mock to CodeVaultGraph.test.tsx**
- **Found during:** Task 1 (when adding the idb import to CodeVaultGraph.tsx)
- **Issue:** CodeVaultGraph.tsx now directly imports and calls idb-keyval (not hidden behind the useKnowledgeGraph mock). jsdom has no real IndexedDB; without a mock the hydrate effect would reject silently (swallowed .catch) but caused test warnings.
- **Fix:** Added `vi.mock("idb-keyval", () => ({ get: vi.fn().mockResolvedValue(undefined), set: vi.fn().mockResolvedValue(undefined) }))` before the component import in CodeVaultGraph.test.tsx — same pattern as ForgeGraph3D.test.tsx.
- **Files modified:** `src/components/graph/CodeVaultGraph.test.tsx`
- **Commit:** 453f3d0

**3. Tasks 1 and 3 combined in same commit**
- Task 3's implementation (mode-conditional onFocus with `centerNode3DWhenReady`) was a natural extension of the Task 1 state setup — `renderMode`, `fgRef3d`, and the focus-param callback are all declared in the same block. Wiring the 3D branch atomically (rather than leaving a broken 2D-only onFocus) avoids an intermediate state where `renderMode` exists but the 3D focus path is disconnected. Documented as merged-tasks deviation, not skipped.

### RESEARCH Open Question 1 (deferred to Plan 05)
- RESEARCH.md noted low-confidence questions: does `refresh()` re-apply nodeColor to cached Three.js materials? Does `nodeVal` resize spheres without a full sim restart?
- Not resolved empirically in this plan (no dev app run performed — automated tests only). **To be verified during Plan 05 FPS benchmark session** against the live `graphSnapshots` dataset (~4,038 nodes). If refresh() does not re-apply colors, fallback is `nodeThreeObject` material-mutation approach noted in RESEARCH Open Questions.

## Known Stubs

None. All wiring is functional:
- Toggle UI renders and updates `renderMode` state
- idb persistence hydrates on mount and persists on toggle
- Lazy swap renders ForgeGraph3D with live data props
- 3D color callbacks use real `useThemeColors()` hex values
- Focus branch uses real `centerNode3DWhenReady` polling function

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. One trust boundary used: IndexedDB → app state (T-91-IDB). Mitigation applied: `saved === "3d"` coercion closes the tampering vector — only the literal string `"3d"` flips to 3D mode, anything else (tampered/garbage/missing) defaults to `"2d"`. Impact is cosmetic only (which renderer mounts). No HIGH-severity threats.

## Self-Check: PASSED

- FOUND: `src/components/graph/CodeVaultGraph.tsx` — contains `renderMode`, `codepulse:render-mode`, `role="group" aria-label="Render mode"`, `LazyForceGraph3D`, `colorFn3D`, `refresh()`, `centerNode3DWhenReady`
- FOUND: `src/components/graph/ForgeGraph3D.tsx` — contains `export default ForgeGraph3D`
- FOUND: commit `453f3d0` (Task 1 — toggle, idb, focus branch)
- FOUND: commit `f0c4d81` (Task 2 — lazy swap, 3D callbacks, refresh)
- ForgeGraph3D.test.tsx: 3/3 GREEN (SC#1, SC#4, SC#5)
- CodeVaultGraph.test.tsx: 13/13 GREEN (2D regression suite)
- graph-center.test.ts: 9/9 GREEN
- tsc --noEmit: CLEAN
- No rgba() in 3D color callbacks
