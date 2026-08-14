---
phase: 114-workspace-map-view
plan: 07
subsystem: ui
tags: [pure-function, layout, radial-geometry, workspace-map, vitest, determinism]

requires:
  - phase: 114-workspace-map-view (plan 05)
    provides: "buildTree/computeRollups/nodeKey and the shared WorkspaceMapNode/WorkspaceMapLink/RollupTotals/RollupMap/DirTree types this plan builds against"
provides:
  - "layoutNodes(tree, rollups, expandedSet, options?) — deterministic center->department->root->dir radial layout, physics off"
  - "391-node first-paint proof (D-01), one-level-per-click proof at multiple depths (D-03)"
  - "order-independence proof across reversed input (D-08), sqrt-scaled node-size proof with ordering (D-07)"
  - "department-hub dirCount/rolled aggregates — the sole producer plan 114-08's hub panel will read"
affects: ["114-08", "114-09"]

tech-stack:
  added: []
  patterns:
    - "Index-based collision stagger (+65 secondary radius) on per-node arc length, never force-based — keeps the layout reproducible/screenshot-testable"
    - "Every angular placement level sorts by a content-derived key (dirCount desc + id asc, or dirPath asc) rather than array/iteration order — the mechanism that makes D-08's order-independence provable"
    - "Water-filling sector allocation (allocateSectors) — proportional share with a floor, iteratively clamping and redistributing, shared by both the department ring (8deg floor) and the root ring (1.5deg floor)"
    - "Payload-relative size scalers (maxRootRolledUpFiles/maxDirRolledUpFiles) computed once from the WHOLE rollups map, never the currently-visible subset, so a node's size never shifts on an unrelated sibling's expand/collapse"

key-files:
  created: []
  modified:
    - src/lib/workspaceMapLayout.ts
    - src/lib/workspaceMapLayout.test.ts

key-decisions:
  - "The plan's mention of a carried `nodeKey` field is satisfied by the existing `id` field (already documented in 114-05's interface as \"the nodeKey\") rather than adding a new duplicate property — the WorkspaceMapNode interface was frozen by 114-05 and is consumed by plans 114-06/08/09, so it was not reopened"
  - "Hub aggregates (dirCount, rolled, maxLatestMtime) computed via a dedicated deepest-first pass (computeSubtreeMeta) separate from computeRollups — RollupMap has no dirCount field and departments have no natural rootId/dirPath to key into it, matching the plan's explicit instruction not to force department aggregates into RollupMap's key shape"
  - "allocateSectors falls back to an equal split when a ring's minimum-degree floors cannot all fit inside the available span (minDegrees*n >= totalDegrees) — a defensive branch not exercised by today's real distribution but reachable by a department with many small roots inside an already-narrow sector"

patterns-established:
  - "layoutNodes keeps the module's zero-React/zero-Convex/zero-.filter(dirs) contract from 114-05 while adding a third pure function to the file"

requirements-completed: []

duration: ~35min
completed: 2026-08-14
---

# Phase 114 Plan 07: Workspace-Map Layout — layoutNodes Summary

**`layoutNodes` completes the pure layout module with a deterministic center→department→root→directory radial assignment (fixed rings, water-filled angular sectors, index-based collision stagger, sqrt-scaled node size), proven with 28 Vitest cases including order-independence across a reversed input array.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 2 (both already existed from plan 114-05)

## Accomplishments

- `layoutNodes(tree, rollups, expandedSet, options?)` implements the full radial geometry from `114-UI-SPEC.md` § "Radial Layout Geometry": ring 0 (center, r=0) → ring 1 (4 department hubs, r=140) → ring 2 (53 root hubs, r=300) → ring 3+ (directories, r=460+130×(depth−1)). Department sectors are proportional to directory count (8° floor), root sub-sectors within their department proportional to √(directory count) (1.5° floor), and directory children at any depth split their parent's sector evenly.
- Collision handling is index-based and fully deterministic: when a node's own per-sibling arc length would fall below ~14 force-space units, odd-indexed siblings stagger onto a secondary radius (+65) while even-indexed siblings stay primary — never force-based.
- Every angular placement level (departments, roots-within-department, dir-children-within-parent) sorts by a content-derived key (`dirCount` descending + id ascending, or `dirPath` ascending) rather than array/iteration order — this is the specific mechanism that makes D-08's order-independence provable rather than merely observed: `tree.roots`' own array order mirrors the input `dirs` order, so placement code that read it directly would produce a different picture for a reversed payload even though every individual node's assigned angle is content-determined.
- Node size (`val`) is sqrt-scaled from rolled-up file count, with `maxRootRolledUpFiles`/`maxDirRolledUpFiles` computed once from the whole supplied `rollups` map (never the currently-visible subset) so a node's size never shifts just because an unrelated sibling was expanded or collapsed. Divide-by-zero is guarded to the floor value (5 for roots, 2 for directories).
- Hub aggregates (`dirCount`, `rolled` `RollupTotals`, and a `maxLatestMtime` used for `latestMtime`) are produced by a dedicated deepest-first single pass (`computeSubtreeMeta`, mirroring `computeRollups`' algorithm shape) and are the figure the angular allocation itself reuses — computed once, read in both places, per the plan's explicit single-producer instruction. Department hubs and the center hub carry aggregates over their full subtree, including collapsed depth-2+ rows never rendered on first paint.
- Every node carries both `fx`/`fy` and a plain `x`/`y` mirror, assigned in one dedicated final pass over the whole nodes array (`n.x = n.fx; n.y = n.fy;`), exactly the `skillVault.ts:382-388` precedent — proven on the output (not just the source) by a dedicated determinism-suite test.
- Zero `Math.random`/`Date.now`, zero `.filter(` calls anywhere in `layoutNodes`, zero React/Convex/component imports (all grep-verified).

## Task Commits

Each task was committed atomically:

1. **Task 1: layoutNodes — rings, angular sectors, and the fx/fy plus x/y mirror** - `3cbaf07f` (feat)
2. **Task 2: Prove D-01's 391-node first paint and D-03's one-level-per-click** - `09bf56c1` (test)
3. **Task 3: Prove D-08 determinism across array order, and D-07 sizing** - `c7dc8002` (test)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/workspaceMapLayout.ts` - added `layoutNodes` plus its private helpers (`allocateSectors`, `placeWithCollision`, `computeSubtreeMeta`, `polarToXY`, `degToRad`, `zeroTotals`) and geometry/size constants. `buildTree`/`computeRollups`/`nodeKey` from plan 114-05 untouched.
- `src/lib/workspaceMapLayout.test.ts` - added a scaled synthetic fixture generator (53 roots / 333 depth-1 children / one root with depth-2+depth-3 descendants, invented names only) and four new describe suites (28 new test cases total, all passing) covering D-01, D-03, D-08, and D-07/D-05.

## Decisions Made

- Kept the existing `WorkspaceMapNode.id` field as the sole node-identity carrier rather than adding a separate `nodeKey` property the plan's prose mentions — the interface was frozen by the already-committed 114-05 plan and is a shared contract with 114-08/114-09; `id`'s doc comment already states "the nodeKey."
- Used a shared `allocateSectors` (water-filling proportional-with-floor) function for both the department ring (8° floor) and root ring (1.5° floor) rather than two separate implementations, since the algorithm is identical modulo the floor constant and the caller-supplied weight array.
- Computed `dirCount`/`maxLatestMtime` via a new `computeSubtreeMeta` pass distinct from `computeRollups`, since `RollupMap` has no `dirCount` field and department/center nodes have no natural `rootId`/`dirPath` to key into it — matches the plan's explicit "do not try to key these aggregates into RollupMap" instruction.

## Deviations from Plan

None — plan executed exactly as written, modulo the `nodeKey`-field interpretation noted above under Decisions Made (a clarification of an already-satisfied requirement, not a change in behavior).

## Issues Encountered

None. All 28 new tests passed on first run against the implementation as written; `npx tsc --noEmit` was clean on the first check.

## Disclosure Probe

Per the executor's disclosure gate, ran a fixed-string grep (never hand-escaped backslashes, which silently return 0 on Windows paths) against both changed files, paired with a known-positive control proving a zero result actually discriminates:

```
=== Probe: C:\Users\mandr in changed files (expect 0) ===
src/lib/workspaceMapLayout.ts: 0
src/lib/workspaceMapLayout.test.ts: 0
=== Control: known-positive string in this repo (CLAUDE.md, expect >0) ===
2
```

No real workspace root, directory, or home path appears in either file. The scaled synthetic fixture uses only invented names (`root-00`…`root-52`, `dir-0`…`dir-N`, `sub-a`, `leaf-a`).

## Shared-Checkout Verification

After each of the three task commits, `git show --stat HEAD` confirmed the file list matched exactly what was staged for that task — no foreign files were swept in from the shared checkout. No `git commit --amend`, no `git stash`, and every `git add` named explicit file paths.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `layoutNodes` is ready for plan 114-08 (side panel) and 114-09 (canvas) to consume: `WorkspaceMapCanvas` can call `layoutNodes(tree, rollups, expandedSet)` on every `expandedSet` change (cheap — pure function over already-in-memory data, no Convex round-trip, per D-02) and pass the result straight to `ForceGraphCanvas` with `cooldownTicks={0}`.
- Plan 114-08's hub panel can read `node.dirCount` and `node.rolled.fileCount` directly off department/center nodes without recomputing anything — both are now proven correct against independently-summed expected values.
- `src/lib/workspaceMapLayout.ts` still has zero React/Convex imports and zero `.filter(` calls over the flat `dirs`/`dirs`-derived arrays inside `layoutNodes`, so the file remains a pure, Convex-mock-free Vitest target for any future additions.
- No blockers.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*

## Self-Check: PASSED

- `FOUND: src/lib/workspaceMapLayout.ts` (layoutNodes exported)
- `FOUND: src/lib/workspaceMapLayout.test.ts` (28/28 tests passing)
- `FOUND: 3cbaf07f` (Task 1 commit)
- `FOUND: 09bf56c1` (Task 2 commit)
- `FOUND: c7dc8002` (Task 3 commit)
