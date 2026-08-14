---
phase: 114-workspace-map-view
plan: 05
subsystem: ui
tags: [pure-function, layout, rollup, workspace-map, vitest]

requires:
  - phase: 114-workspace-map-view (plan 03)
    provides: "src/test/workspaceMapFixture.ts — the synthetic dirs payload this plan's tests assert against"
provides:
  - "buildTree(dirs) — O(n) parent->children adjacency map over the flat workspaceDirs payload, with orphan detection"
  - "computeRollups(tree) — O(n) deepest-first subtree-inclusive rollup of fileCount/totalSize/withheldCount"
  - "nodeKey(rootId, dirPath) — the canonical node-key helper every later plan's expandedSet must use"
  - "WorkspaceMapNode / WorkspaceMapLink / RollupTotals / RollupMap / DirTree — shared types plan 114-07 (layoutNodes) and 114-08 (side panel) build against"
affects: ["114-06", "114-07", "114-08", "114-09"]

tech-stack:
  added: []
  patterns:
    - "Deepest-first single-pass rollup (sort by descending depth, no recursion) over an adjacency map built in one prior O(n) pass — avoids the dirs.filter() full-array-scan anti-pattern named in 114-RESEARCH.md § Pattern 4"
    - "Orphan rows attach to their root and increment a countable orphanCount rather than being silently dropped — malformed-input visibility over silent shrinkage"

key-files:
  created:
    - src/lib/workspaceMapLayout.ts
    - src/lib/workspaceMapLayout.test.ts
  modified: []

key-decisions:
  - "Split the single-file implementation into two atomic commits (Task 1: types + buildTree; Task 2: computeRollups) matching the plan's task boundaries, rather than one combined commit, so the shared-checkout per-task commit protocol and git history both reflect the plan structure"

patterns-established:
  - "Pure layout module with zero React/Convex imports, following src/lib/skillVault.ts — keeps the test suite mock-free"

requirements-completed: []

duration: ~20min
completed: 2026-08-14
---

# Phase 114 Plan 05: Workspace-Map Layout — buildTree + computeRollups Summary

**Pure `buildTree`/`computeRollups` functions over the 4,912-row `workspaceDirs` payload: an O(n) parent→children adjacency map with orphan detection, and a deepest-first, non-mutating, order-independent subtree rollup proven against an independently-summed expected total.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 2 (both new)

## Accomplishments

- `buildTree(dirs)` builds a `Map<string, WorkspaceDirRow[]>` adjacency structure in one O(n) pass, with a `nodeKey` helper (`${rootId}|${dirPath}`) used everywhere in the module instead of six inlined copies. Orphaned rows (parent absent from the payload) attach to their root and increment an `orphanCount` rather than vanishing — proven by a dedicated test that injects a synthetic orphan row.
- `computeRollups(tree)` implements the deepest-first, no-recursion, single-pass algorithm from 114-RESEARCH.md § Pattern 4: sort node keys once by descending depth, then accumulate each node's own direct values plus its already-resolved children's totals. Proven against an **independently-derived** expected value (the test sums the flat `dirs` array by `rootId`, never calling `computeRollups` to produce the expectation) for `fileCount`, `totalSize`, and `withheldCount` — this is D-04's correctness requirement, not a cosmetic feature.
- No byte figure is ever derived for withheld files (grep-verified `0` matches for `withheldBytes`/`withheldSize`), honoring the schema's side-channel rule (`convex/schema.ts:2385-2389`).
- Declared the full shared-type surface (`RollupTotals`, `RollupMap`, `WorkspaceMapNode`, `WorkspaceMapLink`, `DirTree`) that plans 114-07 (`layoutNodes`) and 114-08 (side panel) build against, even though `layoutNodes` itself is out of this plan's scope — interface-first, per the plan's explicit instruction not to stub or pre-empt it.
- Module has zero React/Convex imports (grep-verified `0` matches), so its 11-case Vitest suite runs with no DOM/canvas mock, following `src/lib/skillVault.ts`'s precedent.

## Task Commits

Each task was committed atomically:

1. **Task 1: Module types plus buildTree** - `dd1ea1c5` (feat)
2. **Task 2: computeRollups, deepest-first, with the D-04 correctness proof** - `f72f92b9` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/workspaceMapLayout.ts` - `WorkspaceDirRow`/`DirTree`/`RollupTotals`/`RollupMap`/`WorkspaceMapNode`/`WorkspaceMapLink` types, `nodeKey`, `buildTree`, `computeRollups`. Zero React/Convex imports.
- `src/lib/workspaceMapLayout.test.ts` - 11 Vitest cases across `nodeKey`, `buildTree` (3 cases), and `computeRollups` (7 cases including the D-04 proof, leaf-node control, immutability, and order-independence).

## Decisions Made

- Split the plan's single-file build into two commits matching Task 1/Task 2 exactly, rather than writing the whole file once and committing it as one change — followed the executor's per-task atomic-commit protocol over convenience.
- Kept `computeRollups`'s `depthOf` helper local to the rollup section (rather than exporting it or sharing it with `buildTree`, which doesn't need depth) — `buildTree` derives parent-vs-orphan status from key presence, not depth, so no shared depth utility was warranted between the two functions.

## Deviations from Plan

None - plan executed exactly as written. The plan's inline code sketches (adjacency map shape, deepest-first sort) were used as designed; no factual claim in the plan or its `<interfaces>` block needed correction.

## Issues Encountered

None.

## Disclosure Probe

Per the executor's disclosure gate, ran a fixed-string grep (never hand-escaped backslashes, which silently return 0 on Windows paths) against both new files, paired with a known-positive control proving a zero result actually discriminates:

```
=== Probe: C:\Users\mandr in new files (expect 0) ===
src/lib/workspaceMapLayout.ts: 0
src/lib/workspaceMapLayout.test.ts: 0
=== Control: known-positive string in this repo (CLAUDE.md, expect >0) ===
2
```

No real root, directory, client name, or home path appears in either new file — both are pure-function code and synthetic-fixture-consuming tests only.

## Shared-Checkout Verification

After each commit, `git show --stat HEAD` confirmed the file list matched exactly what was staged for that task — no foreign files swept in from the shared checkout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `buildTree` and `computeRollups` are ready for plan 114-07 to consume: `layoutNodes(tree, rollups, expandedSet)` can now be built as a pure function that traverses `tree.childrenByParent` top-down, bounded by `expandedSet`, and reads `RollupTotals` from the `RollupMap` this plan produces.
- `WorkspaceMapNode`/`WorkspaceMapLink` are already exported with `layoutNodes`' full intended field set (`dirCount`, `direct`, `rolled`, `fx`/`fy`, optional `x`/`y`), so 114-07 and 114-08 build against one shared definition rather than drifting copies.
- No blockers.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*
