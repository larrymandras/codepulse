---
phase: 91-3d-memory-galaxy
plan: "02"
subsystem: graph
tags: [3d, react-force-graph-3d, three, graph-center, tdd-green, wave-1]
dependency_graph:
  requires: [react-force-graph-3d-installed, ForceGraph3D-test-scaffold]
  provides: [ForceGraph3D-component, centerNode3DWhenReady, Centerable3DHandle]
  affects:
    - src/components/graph/ForceGraph3D.tsx
    - src/lib/graph-center.ts
    - src/lib/graph-center.test.ts
tech_stack:
  added: []
  patterns:
    - forwardRef-useImperativeHandle (ForceGraph3D handle wiring)
    - RAF-polling-cancel (centerNode3DWhenReady mirrors centerNodeWhenReady)
    - three-js-chunk-isolation (react-force-graph-3d confined to one lazy-boundary file)
key_files:
  created:
    - src/components/graph/ForceGraph3D.tsx
  modified:
    - src/lib/graph-center.ts
    - src/lib/graph-center.test.ts
decisions:
  - "ForceGraph3DLib aliased from react-force-graph-3d default export — this is the sole allowed import site for the library (SC#2 chunk isolation)"
  - "cooldownTicks=150 (not Infinity default) so onEngineStop fires and zoomToFit runs on settle"
  - "centerNode3DWhenReady appended to graph-center.ts without touching centerNodeWhenReady — 2D path byte-unchanged"
  - "lookAt passed as explicit node coords in cameraPosition call — prevents camera aiming at scene origin for off-center nodes (Pitfall 6)"
  - "useRef<any>(null) for fgRef3dInner — avoids importing library types while remaining MutableRefObject<any> assignable to MutableRefObject<ForceGraphMethods|undefined>"
metrics:
  duration_minutes: 5
  completed_date: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 91 Plan 02: 3D Memory Galaxy — ForceGraph3D Component + 3D Centering Helper Summary

ForceGraph3D.tsx lazy wrapper over react-force-graph-3d with typed imperative handle, plus centerNode3DWhenReady() 3D camera centering helper for `?focus=` deep-link branch — both typechecked and unit-tested.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ForceGraph3D.tsx lazy wrapper + handle | dc88769 | src/components/graph/ForceGraph3D.tsx |
| 2 (RED) | Add failing tests for centerNode3DWhenReady | d9c07f3 | src/lib/graph-center.test.ts |
| 2 (GREEN) | Implement centerNode3DWhenReady in graph-center.ts | 5cef47e | src/lib/graph-center.ts |

## What Was Built

**Task 1 — ForceGraph3D.tsx (new file, 145 lines):**
- `ForceGraph3DHandle` interface: 9 methods (`cameraPosition`, `zoomToFit`, `refresh`, `scene`, `renderer`, `d3Force`, `d3ReheatSimulation`, `pauseAnimation`, `resumeAnimation`) — all wired via `useImperativeHandle` to an internal `fgRef3dInner: useRef<any>(null)`
- `ForceGraph3DProps` interface mirrors `ForceGraphCanvasProps` for shared prop names (`data`, `colorFn`, `labelFn`, `linkColorFn`, `onNodeClick`, `onNodeHover`, `onBackgroundClick`, `onEngineStop`, `className`) plus `nodeValFn?: (node: any) => number` for selection size bump
- `forwardRef<ForceGraph3DHandle, ForceGraph3DProps>` component wrapping `<ForceGraph3DLib>` with the full prop baseline from UI-SPEC §3D Sphere Geometry Props: `nodeRelSize=4`, `nodeResolution=6`, `linkOpacity=0.2`, `linkWidth=0.6`, `backgroundColor="#09090b"`, `cooldownTicks=150`, `warmupTicks=0`, `d3VelocityDecay=0.3`
- Container shape mirrors ForceGraphCanvas.tsx: `<div className={className ?? "relative w-full h-[600px] ..."}>`; NO inner backdrop div (library owns canvas)
- This file is the **sole allowed importer** of `react-force-graph-3d` in the repo (verified: `grep -rl "react-force-graph-3d" src` returns only this file)

**Task 2 — graph-center.ts extension + tests (TDD):**
- `Centerable3DHandle` interface exported: `cameraPosition(position, lookAt?, ms?)` and `zoomToFit(ms?, px?)`
- `centerNode3DWhenReady(fgRef, node, ms=800, maxFrames=90)` mirrors `centerNodeWhenReady` structurally (same RAF `schedule`/`tick`/`cancelled`/`frames` pattern)
- `tick()` fires `cameraPosition({ x, y, z: (node.z??0)+150 }, { x, y, z: node.z??0 }, ms)` — explicit lookAt prevents camera aiming at scene origin for nodes far from (0,0,0)
- `centerNodeWhenReady` lines 30-61 are byte-unchanged (verified: only appended, no edits above)
- 4 new test cases in `graph-center.test.ts` cover all behaviors: immediate fire with z, z-undefined fallback, RAF retry, cancel()

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | CLEAN |
| `grep -rl "react-force-graph-3d" src` (non-test) | Only `ForceGraph3D.tsx` |
| `forwardRef<ForceGraph3DHandle` in ForceGraph3D.tsx | PASS |
| `cooldownTicks={150}` in ForceGraph3D.tsx | PASS |
| `nodeResolution={6}` in ForceGraph3D.tsx | PASS |
| `backgroundColor="#09090b"` in ForceGraph3D.tsx | PASS |
| `export function centerNode3DWhenReady` in graph-center.ts | PASS |
| `export interface Centerable3DHandle` in graph-center.ts | PASS |
| `npx vitest run src/lib/graph-center.test.ts` | 9/9 PASS (5 existing + 4 new) |
| ForceGraph3D.test.tsx (Wave 0) still RED | EXPECTED — toggle UI not until Plan 03 |

## Deviations from Plan

None — plan executed exactly as written.

## TDD Gate Compliance

- RED gate: `test(91-02)` commit `d9c07f3` exists ✓
- GREEN gate: `feat(91-02)` commit `5cef47e` exists after RED commit ✓

## Known Stubs

None. `ForceGraph3D.tsx` is a fully wired forwardRef component; `centerNode3DWhenReady` is a fully implemented polling helper. No placeholder data or UI stubs introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. All code is pure client-side render (ForceGraph3D.tsx) and a pure utility function (graph-center.ts). T-91-SC disposition confirmed: all `react-force-graph-3d`/`three` imports confined to the single lazy-boundary file `ForceGraph3D.tsx` as required.

## Self-Check: PASSED

- FOUND: `src/components/graph/ForceGraph3D.tsx`
- FOUND: commit `dc88769` (Task 1 — ForceGraph3D.tsx)
- FOUND: commit `d9c07f3` (Task 2 RED — failing tests)
- FOUND: commit `5cef47e` (Task 2 GREEN — implementation)
- FOUND: `centerNode3DWhenReady` exported from `src/lib/graph-center.ts`
- FOUND: `Centerable3DHandle` exported from `src/lib/graph-center.ts`
- FOUND: `ForceGraph3DHandle` exported from `src/components/graph/ForceGraph3D.tsx`
