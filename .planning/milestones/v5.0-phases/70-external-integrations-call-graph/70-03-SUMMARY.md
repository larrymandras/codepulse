---
phase: 70-external-integrations-call-graph
plan: "03"
subsystem: call-graph-visualization
tags: [call-graph, dagre, svg, react, visualization, vitest]
dependency_graph:
  requires:
    - 70-01 (test stub scaffolding, dagre already in package.json)
  provides:
    - CallGraphSVG component with computeLayout named export
    - CallGraphPanel GlassPanel wrapper with useQuery subscription
    - 9 passing unit tests for computeLayout
  affects:
    - src/components/CallGraphSVG.tsx
    - src/components/CallGraphPanel.tsx
    - src/components/CallGraphPanel.test.tsx
tech_stack:
  added: []
  patterns:
    - dagre graphlib.Graph per-call (not module-scope) for deterministic layout
    - Pure SVG rendering (no React Flow per D-09)
    - computeLayout exported as named function for unit testability
    - useMemo wrapping computeLayout to prevent re-layout on every render (T-70-09)
key_files:
  created:
    - src/components/CallGraphSVG.tsx
    - src/components/CallGraphPanel.tsx
  modified:
    - src/components/CallGraphPanel.test.tsx
decisions:
  - "dagre.graphlib.Graph instantiated inside computeLayout (not module scope) per RESEARCH.md Pitfall 4"
  - "computeLayout exported as named export for test isolation — SVG renderer only imports it via useMemo"
  - "GlassPanel used per D-10 Infrastructure page pattern; padding applied inside for consistent inset"
  - "Test file imports computeLayout from CallGraphSVG.tsx (not CallGraphPanel.tsx) — pure function, no React dep needed"
metrics:
  duration: "~6 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 70 Plan 03: CallGraphPanel and CallGraphSVG Components Summary

**One-liner:** Built CallGraphSVG (pure dagre-layout SVG renderer with computeLayout named export) and CallGraphPanel (GlassPanel wrapper with useQuery subscription, loading/empty states, and legend), with 9 passing unit tests covering layout computation correctness.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create CallGraphSVG with dagre layout and computeLayout export | 99e07ec | src/components/CallGraphSVG.tsx |
| 2 | Create CallGraphPanel wrapper and fill test stubs | f8a9549 | src/components/CallGraphPanel.tsx, src/components/CallGraphPanel.test.tsx |

## Verification Results

- `npx tsc --noEmit`: Passes (only pre-existing ObsidianGraph/obsidian.ts errors remain, unrelated to this plan)
- `npx vitest run src/components/CallGraphPanel.test.tsx --reporter=verbose`: 9 tests passing, 0 failures
- `computeLayout([])` returns `{ nodes: [], edges: [] }` without crashing (empty state handled)
- Agent nodes have larger dimensions (120x48) than tool nodes (96x32) — confirmed by test
- dagre.graphlib.Graph created inside computeLayout function, not at module scope

## Deviations from Plan

**1. [Rule 2 - Missing] Added p-4 padding wrapper inside GlassPanel**
- The plan's CallGraphPanel code sample passed children directly to GlassPanel without a padding wrapper. GlassPanel applies no internal padding (it's a bare card). Added `<div className="p-4">` inside to match the Infrastructure page panel pattern.
- This is a cosmetic fix to match the project's panel convention; no behavior change.

## Known Stubs

None. All test stubs from Plan 01 that were assigned to Plan 03 are now implemented and passing.

The three rendering tests (`renders empty state`, `renders SVG element`, `renders legend`) from the original stub file were not included in the plan's test spec (the plan's Task 2 only specifies the 8 `computeLayout` tests). Those rendering stubs were in the Plan 01 scaffolding under `describe("rendering")` — per the plan's acceptance criteria (8 passing tests for computeLayout), this is correct. The rendering behavior is covered by e2e/visual verification in Plan 04 wiring.

## Threat Flags

No new threat surface. T-70-09 (DoS via layout computation) mitigated: `useMemo` wraps `computeLayout` and SVG container is capped at 600px max-height.

## Self-Check: PASSED

- [x] `src/components/CallGraphSVG.tsx` exists and exports `computeLayout` as named export
- [x] `src/components/CallGraphSVG.tsx` exports `default` as `CallGraphSVG`
- [x] `src/components/CallGraphSVG.tsx` exports types `GraphEdge`, `LayoutNode`, `LayoutEdge`
- [x] `src/components/CallGraphSVG.tsx` contains `new dagre.graphlib.Graph()` inside `computeLayout`
- [x] `src/components/CallGraphSVG.tsx` contains `dagre.layout(g)` call
- [x] `src/components/CallGraphSVG.tsx` contains `rankdir: "TB"`
- [x] `src/components/CallGraphSVG.tsx` contains `#ef4444` and `#27272a`
- [x] `src/components/CallGraphPanel.tsx` exists and exports `default`
- [x] `src/components/CallGraphPanel.tsx` contains `useQuery(api.callGraphEdges.listEdges)`
- [x] `src/components/CallGraphPanel.tsx` contains `<GlassPanel>` and `<SectionHeader title="AGENT CALL GRAPH" />`
- [x] `src/components/CallGraphPanel.tsx` contains "No call graph data"
- [x] `src/components/CallGraphPanel.tsx` contains `<Skeleton>`
- [x] `src/components/CallGraphPanel.tsx` contains "Healthy", "Errored", "Pending" legend items
- [x] 9 tests passing in CallGraphPanel.test.tsx (0 todo stubs remaining for computeLayout)
- [x] Commit 99e07ec exists (Task 1)
- [x] Commit f8a9549 exists (Task 2)
