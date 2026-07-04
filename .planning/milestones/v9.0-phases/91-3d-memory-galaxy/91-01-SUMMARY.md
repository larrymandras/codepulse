---
phase: 91-3d-memory-galaxy
plan: "01"
subsystem: graph
tags: [3d, react-force-graph-3d, three, tdd-red, wave-0]
dependency_graph:
  requires: []
  provides: [react-force-graph-3d-installed, ForceGraph3D-test-scaffold]
  affects: [src/components/graph/ForceGraph3D.test.tsx, package.json]
tech_stack:
  added: [react-force-graph-3d@^1.29.1, three@0.185.0 (transitive)]
  patterns: [vi.mock-prop-capture, Nyquist-RED-scaffold, TDD-RED-wave]
key_files:
  created:
    - src/components/graph/ForceGraph3D.test.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - "react-force-graph-3d installed as top-level dep; three comes transitively via 3d-force-graph (no separate npm install three)"
  - "Wave 0 RED scaffold uses prop-capture mock pattern from CodeVaultGraph.test.tsx; vi.mock('react-force-graph-3d') captures lastForceGraph3DProps for SC#5 colorFn assertions"
  - "All 3 tests fail at getByRole('button', { name: '3D' }) — clean assertion failure, not a Vite transform or tsc error; RED is the correct Wave 0 state"
metrics:
  duration_minutes: 8
  completed_date: "2026-06-29"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 91 Plan 01: 3D Memory Galaxy — Install + Wave 0 RED Scaffold Summary

Install `react-force-graph-3d` (three.js transitively) and author the Nyquist Wave 0 test scaffold covering SC#1 toggle-restore, SC#4 disposal-mock, and SC#5 colorFn hex — all RED pending the Plan 02-03 implementation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install react-force-graph-3d | c607e68 | package.json, package-lock.json |
| 2 | Author ForceGraph3D.test.tsx Wave 0 RED scaffold | ee17cba | src/components/graph/ForceGraph3D.test.tsx |

## What Was Built

**Task 1 — Package install:**
- `react-force-graph-3d@^1.29.1` added to `package.json` dependencies
- `three@0.185.0` installed transitively via `3d-force-graph` (no top-level `three` entry)
- `node -e "require.resolve('three')"` exits 0 (resolvable at `node_modules/three/build/three.cjs`)
- `npx tsc --noEmit` clean before and after

**Task 2 — Wave 0 RED test scaffold:**
- `src/components/graph/ForceGraph3D.test.tsx` created with 3 test cases (SC#1/SC#4/SC#5)
- `vi.mock("react-force-graph-3d")` prop-capture mock: default export stores all props in `lastForceGraph3DProps` and returns `<div data-testid="force-graph-3d" />` — same pattern as existing ForceGraphCanvas mock in CodeVaultGraph.test.tsx
- `vi.mock("idb-keyval")` stubs IndexedDB (wired by Plan 02 implementation)
- All support mocks mirrored verbatim from CodeVaultGraph.test.tsx: `convex/react`, `_generated/api`, `useThemeColors`, `useKnowledgeGraph`, `@/components/ui/tooltip`
- Tests RED-fail at `screen.getByRole("button", { name: "3D" })` — `TestingLibraryElementError: Unable to find an accessible element` — because the render-mode toggle UI does not exist until Plans 02-03

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | CLEAN |
| `package.json` has `react-force-graph-3d` | PASS |
| `package.json` has no top-level `three` | PASS |
| `require.resolve('three')` exits 0 | PASS |
| `ForceGraph3D.test.tsx` exists | PASS |
| Contains `vi.mock("react-force-graph-3d"` | PASS |
| Contains `vi.mock("idb-keyval"` | PASS |
| Contains exactly 3 `it(` cases (SC#1/SC#4/SC#5) | PASS |
| Tests RED-fail with running assertions (not transform error) | PASS (3/3 failed with TestingLibraryElementError) |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan is a test scaffold + package install only; no UI stubs introduced.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. The only new surface is a dependency install of two audited, postinstall-free packages (`react-force-graph-3d` + transitive `three`) — both `[OK]` per 91-RESEARCH.md §Package Legitimacy Audit. No threat flags.

## Self-Check: PASSED

- FOUND: `src/components/graph/ForceGraph3D.test.tsx`
- FOUND: commit `c607e68` (Task 1 — package install)
- FOUND: commit `ee17cba` (Task 2 — RED scaffold)
