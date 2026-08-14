---
phase: 114-workspace-map-view
plan: 09
subsystem: ui
tags: [react, react-force-graph-2d, privacy, radial-layout, workspace-map]

# Dependency graph
requires:
  - phase: 114-01
    provides: "ForceGraphCanvas cooldownTicks prop (D-08 physics-off), communityColorFn halo mechanism"
  - phase: 114-03
    provides: "src/test/workspaceMapFixture.ts — synthetic getWorkspaceMap fixture"
  - phase: 114-07
    provides: "layoutNodes — the sole producer of ring/angle geometry, WorkspaceMapNode.dirCount"
  - phase: 114-08
    provides: "WorkspaceMapPanel — the D-09 side panel this canvas's onNodeSelect callback feeds, and the rootIndex ordering convention this canvas must reuse verbatim"
provides:
  - "WorkspaceMapCanvas — the D-01..D-08 radial canvas: owns expandedSet, drives buildTree/computeRollups/layoutNodes under two memo boundaries, mounts ForceGraphCanvas with physics off and no custom paint"
  - "D-15 privacy masking on canvas labels: enabled && maskPaths gate, root-index-based root labels shared with WorkspaceMapPanel's own convention"
  - "D-03 client-side expand/collapse: one level per click, descendant-pruning collapse, selection clears when the panel's current node is collapsed out of view"
  - "Corrected CLAUDE.md § Testing: src/test/setup.ts does not globally mock heavy render libraries; documents the real per-test-file vi.mock convention"
affects: [114-10-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two useMemo boundaries for a payload-driven layout pipeline: one keyed on a primitive version counter (never the array itself, per unverified referential-stability), one keyed on interaction state that legitimately changes every click"
    - "communityColorFn/colorFn on ForceGraphCanvas are internal — not forwarded to the underlying react-force-graph-2d component — so behavior is proven through the captured nodeCanvasObject (paint) callback's ctx.fillStyle/stroke, not through nonexistent captured props"
    - "Canvas-drawn labels come from each graphData node's own name field (ForceGraphCanvas's default paint reads node.name ?? node.id); privacy masking must therefore be baked into the node objects handed to graphData, not just into the labelFn/nodeLabel hover-tooltip prop"

key-files:
  created:
    - src/components/workspace/WorkspaceMapCanvas.tsx
    - src/components/workspace/WorkspaceMapCanvas.test.tsx
  modified:
    - CLAUDE.md

key-decisions:
  - "onNodeSelect callback fires synchronously inside handleNodeClick, computing collapse-invalidates-current-selection BEFORE updating state — not via a reactive useEffect watching the node list — so a click that both collapses a subtree AND is itself the new selection reports null-then-clicked-node in one deterministic sequence, matching 'always report the clicked node' without a stale intermediate render"
  - "rootIndexByKey is derived once per Boundary-A recompute (tree+rollups), not per Boundary-B (layoutNodes) recompute — root nodes and their rolled counts never change across expand/collapse, only the descendant subset does, so recomputing this index on every click would be pure waste"
  - "Two additional useMemo hooks beyond the plan's named two boundaries (rootIndexByKey, canvasNodes) — the plan's acceptance criterion asks for the EXISTENCE of the activeVersion-keyed and expandedSet-keyed boundaries, not an exclusivity cap; both extra memos are pure derived state with no independent recompute trigger of their own"

patterns-established:
  - "Privacy-masked canvas labels: WorkspaceMapCanvas.tsx's displayLabel() is a byte-for-byte parallel implementation of WorkspaceMapPanel.tsx's own (unexported) displayLabel() — duplicated rather than shared, since this plan's file list has no shared-module slot for it"

requirements-completed: []  # design-doc-driven phase — traced to D-01..D-18, not REQ-IDs

# Metrics
duration: ~55min
completed: 2026-08-14
---

# Phase 114 Plan 09: Workspace Map Radial Canvas Summary

**`WorkspaceMapCanvas` mounting `ForceGraphCanvas` with `cooldownTicks={0}` and zero custom paint — department fill + astridr-reachable halo come free from the shared default paint, one-level-per-click expand/collapse prunes descendant keys on collapse and clears an invalidated panel selection, and D-15 masking is baked into each node's own `name` field so the canvas-drawn label (not just the hover tooltip) actually redacts.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-14
- **Tasks:** 3 (Task 1 committed alone; Task 2 + Task 3 committed together per the plan's explicit instruction)
- **Files modified:** 3 (2 new, 1 modified)

## Accomplishments

- Built `WorkspaceMapCanvas.tsx`: owns `expandedSet: Set<string>` starting empty (the 391-node D-01 first-paint floor is baked into `layoutNodes` itself — depth-1 children render unconditionally — not into a pre-seeded set, matching the plan's own correction of the UI-SPEC's older "pre-populated as collapsed" phrasing). Drives `buildTree`/`computeRollups` under a memo keyed solely on `payload.activeVersion`, and `layoutNodes` under a separate memo keyed on `[tree, rollups, expandedSet]`. Mounts `ForceGraphCanvas` with `cooldownTicks={0}`, no custom paint callback, `colorFn` (department lookup, Unclassified/center both muted), and `communityColorFn` (the astridr-reachable halo, reusing the shared halo mechanism `ForceGraphCanvas` already draws).
- Implemented D-03 expand/collapse exactly: a click on a node with unexpanded children reveals one level; a click on an already-expanded node removes its own key plus every structural descendant key from `expandedSet` (so a later re-expand starts fresh at one level, never restoring a stale deep subtree); every click unconditionally reports itself to the page via `onNodeSelect`; and if the panel's currently-selected node falls inside a subtree just collapsed, the selection is cleared (`onNodeSelect(null, undefined)`) before the click's own node is reported.
- Implemented D-15 masking correctly at the mechanism level that actually matters for a canvas: `ForceGraphCanvas`'s default paint draws each node's on-canvas text from that node's own `name` field (`node.name ?? node.id`), not from the `labelFn`/`nodeLabel` hover-tooltip prop alone — so `canvasNodes` (the array actually handed to `graphData`) carries the masked `name` per node, and `labelFn` computes the identical value for the hover tooltip. Root labels mask to `"{department} root {index}"` using the same descending-rolled-file-count index `WorkspaceMapPanel` (114-08) already expects via its `rootIndex` prop — computed once from `tree.roots`/`rollups`, never a second divergent ordering.
- Wrote 10 tests (plan required ≥9), all built against the real `buildTree`/`computeRollups`/`layoutNodes` pipeline over `makeWorkspaceMapFixture()`, matching 114-08's established precedent of testing against genuinely-derived data rather than hand-authored node literals.
- Corrected CLAUDE.md § Testing in the same commit as the test file that demonstrates the correction: `src/test/setup.ts` does not globally mock Clerk/Recharts/Three.js/Globe/React Flow/Tone.js (verified false by a full read of the 139-line file — it installs jsdom polyfills plus one `livekit-client` mock); the real convention is per-test-file `vi.mock`, now documented with two live citations.

## Task Commits

1. **Task 1: Build WorkspaceMapCanvas** — `9013c4b5` (feat)
2. **Task 2 + Task 3: Test suite + CLAUDE.md correction** — `8629a376` (test) — committed together per the plan's explicit instruction: "Commit this edit together with Task 2's test file... the corrected claim and the code that demonstrates it land in one commit."

**Plan metadata commit:** pending (this SUMMARY.md — STATE.md/ROADMAP.md are owned by the orchestrator, not this executor, per the shared-artifact prohibition in this executor's dispatch).

## Files Created/Modified

- `src/components/workspace/WorkspaceMapCanvas.tsx` — the D-01..D-08 radial canvas. Exports `WorkspaceMapCanvas` and `WorkspaceMapNodeSelectHandler`. No hardcoded hex; all colors resolved via `useThemeColors()`.
- `src/components/workspace/WorkspaceMapCanvas.test.tsx` — 10 tests: `cooldownTicks` strict `toBe(0)`, halo both directions, department fill (4 distinct + Unclassified/center muted, folding in the "no custom paint" proof), D-15 masking in all three states (off / `maskPaths:true` / the `maskPaths:false` discriminator) with a geometry-unperturbed check, D-03 expand/collapse including the collapsed-out-selection-clears case, and the three-state payload branch.
- `CLAUDE.md` — § Testing corrected (stale global-mock claim removed, real per-test-file convention documented with two citations). No other section touched.

## Decisions Made

- **Testing `colorFn`/`communityColorFn` through the paint callback, not through nonexistent captured props.** The plan's Task 2 draft text says to "call the captured `h.props.communityColorFn`" and "`h.props.colorFn`" directly — but a full read of `ForceGraphCanvas.tsx`'s JSX return shows these are internal to the component and never forwarded to the underlying `<ForceGraph2D>` mock; only `nodeColor`/`nodeCanvasObject`/`nodeLabel`/etc. cross that boundary. `ForceGraphCanvas.test.tsx`'s own "community halo" suite (`:263-323`) is the real precedent: call the captured `nodeCanvasObject` (the `paint` function) with a recording `ctx` and assert on `ctx.fillStyle`/`ctx.stroke`/`ctx.strokeStyle`. Documented as a Rule 2 draft-correction deviation below.
- **`onNodeSelect` fires synchronously inside `handleNodeClick`, computing the collapse-invalidates-selection check from the pre-click `selectedKey` and a freshly-computed descendant set — not via a `useEffect` reacting to the node list.** An effect-based approach would race against the "always report the clicked node" rule: since a click always calls `setSelectedKey(clickedKey)`, an effect watching "is `selectedKey` still visible" would only ever see the JUST-CLICKED key (already valid), never the node that was selected *before* this click and is now being collapsed away. Computing the check synchronously against the pre-click `selectedKey`, before it gets overwritten, is what lets a single collapse-click emit both `onNodeSelect(null, undefined)` (clearing the stale selection) and `onNodeSelect(clickedNode, ...)` (reporting the click itself) in the correct order.
- **`deptColor`/`displayLabel` are duplicated from `WorkspaceMapPanel.tsx` rather than extracted to a shared module.** This plan's `files_modified` list has no shared-lib slot for it, both functions are small and pure, and introducing a new shared module this late in the phase for two ~10-line functions was judged not worth the coupling. If a future plan finds a third consumer, extraction becomes worthwhile.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Draft correction] Task 2's acceptance text describes capturing `h.props.communityColorFn`/`h.props.colorFn` directly, which do not exist as forwarded props**

- **Found during:** Task 2, while designing the halo/department-fill tests
- **Issue:** `ForceGraphCanvas.tsx`'s JSX return (read in full per the plan's own `<read_first>` instruction) never passes `communityColorFn` or `colorFn` through to the underlying `<ForceGraph2D>` component — they are consumed internally to build `nodeColor`/`nodeCanvasObject` (the `paint` callback). A test written against `h.props.communityColorFn` or `h.props.colorFn` would be calling `undefined`, not a function.
- **Fix:** Tested through the actual observable surface: `h.props.nodeCanvasObject` (the `paint` callback) invoked with a recording `ctx`, asserting `ctx.fillStyle` (department fill / colorFn) and `ctx.stroke`/`ctx.strokeStyle` (halo / communityColorFn) — exactly the pattern `ForceGraphCanvas.test.tsx`'s own "community halo via communityColorFn" describe block (`:263-323`) already established for this identical mechanism.
- **Files modified:** `src/components/workspace/WorkspaceMapCanvas.test.tsx` (test design only — no production-code impact)
- **Verification:** All 10 tests pass; the halo and department-fill tests genuinely exercise `WorkspaceMapCanvas`'s own `colorFn`/`communityColorFn` closures (confirmed by their distinct, correctly-attributed output values).
- **Committed in:** `8629a376`

**2. [Rule 2 - Draft correction] Task 1's acceptance criterion 2 (`grep -c 'maskFilePath\|maskPath'` returns 0) is self-contradictory against criterion 3 ("the file contains both `redact` and `maskPaths`") — identical to 114-08's own documented finding**

- **Found during:** Task 1 final verification (running the plan's acceptance-criteria greps)
- **Issue:** `maskPaths` contains `maskPath` as a literal substring, so any file satisfying the D-15 gate (which correctly destructures `usePrivacy().maskPaths`) necessarily has at least one line matching `maskFilePath\|maskPath`, making the literal grep unable to return 0. Confirmed: it returned 3.
- **Fix:** Read the actual matches — one doc-comment line naming the correct gate (`usePrivacy().enabled && maskPaths`) and two real uses of the `maskPaths` destructure/variable. Zero calls to the rejected `maskFilePath()`/`maskPath()` functions from `src/lib/privacy.ts` exist anywhere in the file — the plan's stated intent ("the structurally-wrong helper is not used") is satisfied; only the literal grep string is a draft error, exactly the same defect 114-08-SUMMARY.md already documented for its own file under the same acceptance-criteria template.
- **Files modified:** none (verification-only)
- **Verification:** `grep -n 'maskFilePath\|maskPath' src/components/workspace/WorkspaceMapCanvas.tsx` — all 3 hits inspected, none are calls to the rejected helper.
- **Committed in:** n/a (documentation of a verification finding, not a code change)

---

**Total deviations:** 2 (both Rule 2 draft-correction, no production-code impact)
**Impact on plan:** None on functionality. Both are documentation/verification corrections of the plan's own draft text; the underlying feature (halo/department-fill behavior, D-15 gate correctness) works exactly as specified and is proven by the actually-existing prop surface.

## Issues Encountered

None beyond the two draft-correction deviations documented above.

## Privacy / Disclosure Gate

- Ran `grep -F 'C:\Users\mandr' src/components/workspace/WorkspaceMapCanvas.tsx src/components/workspace/WorkspaceMapCanvas.test.tsx` → **zero matches** (exit code 1).
- Known-positive control: `grep -F 'C:\Users\mandr' CLAUDE.md` → matched (exit code 0), proving the fixed-string pattern actually discriminates rather than trivially returning empty.
- All root/directory/department names in both files are the established synthetic fixture values (`root-a`, `root-b`, `root-c`, `root-d`, `child-1`, `sub-1`, `leaf-1`, `Personal`/`Consulting`/`Work`/`Unclassified`) from `src/test/workspaceMapFixture.ts` (114-03) — never a real workspace name.

## D-15 Mutation Proof

Per this executor's dispatch, run against the ACTUAL D-15 gate line in `WorkspaceMapCanvas.tsx:140`:
`const masked = enabled && maskPaths;`

1. Mutated to `const masked = enabled;` (removing the `&& maskPaths` conjunct — the same weakening mutation the orchestrator ran against `WorkspaceMapPanel.tsx` at 114-08's close).
2. Ran `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx` against the mutation: **exactly one test went RED** — `"masking gate discriminator: enabled=true but maskPaths=false leaves labels UNMASKED..."` — with all other 9 tests, including the `maskPaths:true` masking test, still GREEN. Failure was the expected one: `expected 'Personal root 1' to be 'root-a'`.
3. This proves the discriminator test genuinely measures the `enabled && maskPaths` gate rather than passing identically either way — a `maskPaths:true`-only suite would have stayed green against this exact mutation, since `usePrivacyMask.ts`'s `redact()` gates on `enabled` alone.
4. Restored from a scratchpad copy (`cp`, never `git checkout --`) and verified byte-identical via a direct file diff (`diff` between the scratchpad backup and the restored file — no output, confirming exact match; `git diff --stat` was not usable for this check since the file was not yet committed at mutation time).

## Threat Flags

None. This plan's owned threats (T-114-01 canvas-label disclosure, T-114-15 `cooldownTicks` falsy-0 regression, T-114-17 stale-doc repudiation) are mitigated exactly per the plan's `<threat_model>`:
- T-114-01: `enabled && maskPaths` gate, proven by the three-state masking suite plus the mutation proof above.
- T-114-15: `toBe(0)` strict assertion (not a truthiness check) on the captured `cooldownTicks` prop.
- T-114-17: CLAUDE.md corrected in the same commit as the test file demonstrating the real convention.

No new security-relevant surface (network endpoint, auth path, file access pattern, schema change) was introduced — this plan reads an already-fetched payload prop and never calls Convex directly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `WorkspaceMapCanvas` is ready to be wired into the `/workspace-map` page (plan 114-10), which owns the `useWorkspaceMap()` subscription and passes its result straight through as the `payload` prop, plus owns the `WorkspaceMapPanel`'s open/selected-node state, updated via this canvas's `onNodeSelect` callback (which already supplies the correct `rootIndex` for root nodes).
- `rootIndexByKey`'s ordering (descending rolled-file-count within department, ascending `rootId` tiebreak) is computed identically to `WorkspaceMapPanel`'s own documented expectation — the page does not need to compute or reconcile a second ordering.
- No blockers.

## Self-Check: PASSED

- `npx tsc --noEmit` → clean (no output).
- `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx` → 10/10 passed.
- `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx -t "halo"` → 1 passed, 9 skipped (resolves).
- `npx vitest run src/components/workspace/WorkspaceMapCanvas.test.tsx -t "privacy"` → 2 passed, 8 skipped (resolves).
- `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` (shared-substrate control) → still GREEN, 15/15.
- Full suite: `npx vitest run` → 4389 passed | 197 todo | 0 failed across 322 test files (up from 321 at 114-08's close, the one new file added here).
- `git log --oneline -2` confirms both commits (`9013c4b5`, `8629a376`) exist on `master`.
- `[ -f src/components/workspace/WorkspaceMapCanvas.tsx ]` and `[ -f src/components/workspace/WorkspaceMapCanvas.test.tsx ]` → both FOUND.
- D-15 mutation proof (see section above) — RED on the exact discriminator, GREEN on restore.
- Disclosure grep — zero matches on new files, control matched on `CLAUDE.md` (see Privacy / Disclosure Gate section).
- `git show --stat HEAD` and `HEAD~1` both confirmed to touch only the intended files, no foreign sweep-in.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*
