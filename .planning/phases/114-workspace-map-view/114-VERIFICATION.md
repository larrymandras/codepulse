---
phase: 114-workspace-map-view
verified: 2026-08-14T13:00:00Z
status: passed
score: 18/18 decisions verified
overrides_applied: 0
---

# Phase 114: Workspace Map view Verification Report

**Phase Goal:** Larry can open `/workspace-map` and read the live workspace snapshot as a
deterministic radial map — center, four department hubs, roots, directories.

**Verified:** 2026-08-14
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

This is a design-doc-driven phase (per `114-CONTEXT.md`, following Phase 116's precedent). The
acceptance-bearing units are the 18 locked decisions D-01..D-18. Each was independently
re-derived against live source, not accepted from SUMMARY.md claims.

### Observable Truths (D-01..D-18)

| # | Decision | Status | Evidence |
|---|----------|--------|----------|
| D-01 | First load = 391 nodes (center+4 depts+53 roots+333 depth-1) | ✓ VERIFIED | `workspaceMapLayout.ts:431-692` `layoutNodes` unconditionally emits center, all departments, all roots, and calls `layoutDirChildren` unconditionally for every root's depth-1 children. Test `workspaceMapLayout.test.ts:260-262` asserts `nodes.length toBe(391)` and a kind/depth breakdown test at line 265. Ran live: 7/7 test files, 109/109 passed. Operator checkpoint confirmed live 4,912-row payload renders and expands with no network wait. |
| D-02 | Single `getWorkspaceMap` subscription, client-side expand | ✓ VERIFIED | `useWorkspaceMap.ts:29-34` — one `useQuery` call. `WorkspaceMapCanvas.tsx:142,219-255` — `expandedSet` is local React state, `handleNodeClick` mutates it with zero Convex calls. |
| D-03 | One level per click, at every depth | ✓ VERIFIED | `layoutDirChildren` (`workspaceMapLayout.ts:557-601`) recurses into a child only `if (expandedSet.has(key))` — never auto-expands a whole subtree. Collapse removes the node's key plus every descendant (`WorkspaceMapCanvas.tsx:228-233`, using `collectDescendantKeys`). Tests at `workspaceMapLayout.test.ts:302-350` cover depth-1 and depth-2 expansion and re-collapse round-trip. |
| D-04 | Collapsed rollup = subtree sum of direct counts | ✓ VERIFIED | `computeRollups` (`workspaceMapLayout.ts:167-200`) — deepest-first accumulation, non-mutating (comment + dedicated test `does not mutate the input dirs rows`). Tests at lines 188-226 independently sum a known root's descendants and assert equality for fileCount/totalSize/withheldCount, plus a degenerate leaf-node control. |
| D-05 | Radial geometry: center→departments→roots→directories | ✓ VERIFIED | `layoutNodes` builds `RING_RADIUS_DEPARTMENT=140`, `RING_RADIUS_ROOT=300`, `RING_RADIUS_DIR_BASE=460` (+step per depth) — center at origin, departments ring 1, roots ring 2, directories outward (`workspaceMapLayout.ts:259-262, 519-680`). |
| D-06 | Node fill = department; halo = astridr-reachable | ✓ VERIFIED | `WorkspaceMapCanvas.tsx:209-217` — `colorFn` returns `deptColor(node.department, colors)`; `communityColorFn` returns `colors.statusInfo` iff `access === "astridr-reachable"`, else `null`. Test `WorkspaceMapCanvas.test.tsx:219+` asserts halo present for astridr-reachable and absent for local-only via the mocked `react-force-graph-2d` prop capture. |
| D-07 | Node size = rolled-up file count, scaled to payload max | ✓ VERIFIED | `rootVal`/`dirVal` (`workspaceMapLayout.ts:458-465`) compute `sqrt(fileCount/maxRolledUpFiles)` against `maxRootRolledUpFiles`/`maxDirRolledUpFiles`, both derived from the full supplied data, never a hardcoded constant. Tests `workspaceMapLayout.test.ts:420-518` assert value ranges and monotonicity (largest rolled count → largest val) plus a zero-rollup degenerate case (no NaN). |
| D-08 | Fully deterministic, physics off | ✓ VERIFIED | `cooldownTicks={0}` passed to `ForceGraphCanvas` (`WorkspaceMapCanvas.tsx:326`). `layoutNodes`'s final pass sets `n.x = n.fx; n.y = n.fy` for every node (`workspaceMapLayout.ts:686-689`). Determinism tests (`workspaceMapLayout.test.ts:351-418`) assert byte-identical output across two calls and order-independence via a reversed `dirs` array, plus an x===fx/y===fy check and a NaN/undefined sweep at multiple expansion depths. |
| D-09 | Side panel: path/dept/access/mtime, direct+rolled counts, withheld line | ✓ VERIFIED | `WorkspaceMapPanel.tsx:144-197` renders department badge, access badge, direct FieldRow, rolled FieldRow, latest-activity FieldRow, and (`node.direct.withheldCount > 0`) a labeled withheld count plus the exact sentence "Classified sensitive by the local scanner config — never left this machine. Only the count is recorded, never the name." Operator checkpoint reproduced this verbatim live on a real deep directory with differing direct/rolled counts (9 vs 294 files). |
| D-10 | Lens switcher ships; Ástríðr = honest empty state | ✓ VERIFIED | `WorkspaceMap.tsx:76-105` — `Tabs` with `workspace`/`astridr` triggers; astridr branch renders `AstridrLensEmptyState`, never a blank canvas. |
| D-11 | Empty state driven by a live probe, not hardcoded | ✓ VERIFIED | `useArmsProbe.ts:25-35` — `useQuery(api.graphSnapshots.listSnapshots)`, returns `undefined`/`true`/`false` based on live `r.sources.some(s => s.kind === "arms")`. `AstridrLensEmptyState.tsx` branches on all three probe states, including a distinct `true` branch (not the "isn't mapped yet" copy) proving the probe result actually drives content rather than being decorative. |
| D-12 | Lens in `?lens=` URL param, closed-set default | ✓ VERIFIED | `WorkspaceMap.tsx:40-42` `deriveLens` returns `"astridr"` only on exact match, else `"workspace"`. Tests `WorkspaceMap.test.tsx:179-241` cover absent, `workspace`, `astridr`, and an unrecognized-garbage value falling back to workspace. |
| D-13 | `listSnapshots` gains `sources` field, other fields unchanged | ✓ VERIFIED | `convex/graphSnapshots.ts:328-344` — `sources` added to the return projection alongside the pre-existing `snapshotId, nodeCount, linkCount, generatedAt, updatedAt` fields (all present, none removed at line 344's block). `convex/graphSnapshots.test.ts` included in the 109-test run (all green). |
| D-14 | Always-visible coverage strip, warn only on degrade | ✓ VERIFIED | `WorkspaceCoverageStrip.tsx:176-199` — four chips always render in fixed order (scan time, roots covered, withheld, unclassified); degraded chips append at the end. `unclassifiedText` chip (line 174, 181) never carries `warn`. Operator checkpoint confirmed all four chips live, chip 4 never escalating. |
| D-15 | Privacy: `maskPaths` redacts labels, structure/counts/colors intact | ✓ VERIFIED (already independently mutation-proved by orchestrator; re-confirmed by reading) | `WorkspaceMapPanel.tsx:126` and `WorkspaceMapCanvas.tsx:140` both gate on `enabled && maskPaths` (not `enabled` alone). `displayLabel` in both files only swaps the `.name`/label field — `val`/`fx`/`fy`/colors read straight off the unmodified `layoutNodes` output. Operator checkpoint captured live masked screenshots: root labels as `{department} root {N}`, geometry/colors unchanged. |
| D-16 | Degraded states proven with fixture + mutation test | ✓ VERIFIED | `WorkspaceCoverageStrip.test.tsx` header comment explicitly documents the RED-before-GREEN mutation procedure; fixture presets for `scannedRootsComplete:false`, `accessDerivationOk:false`, `localConfigStatus:"absent"/"version-mismatch"` are exercised. All fixture root names are synthetic (`root-a`, etc. pattern per grep of test files — no real path observed). |
| D-17 | Staleness: warn past 36h since `generatedAt`, boundary-tested | ✓ VERIFIED | `isScanStale` (`WorkspaceCoverageStrip.tsx:52-55`) — strict `>` 36h in seconds, explicit `nowMs` injectable for tests (no internal `Date.now()` inside the pure predicate). Operator checkpoint observed `Scanned 7h ago` with no warn styling live. |
| D-18 | Chrome Issues tab observed and recorded verbatim | ✓ VERIFIED | `114-OPERATOR-CHECKPOINT.md` § 4 — control-paired (normal vs incognito), verbatim Issue text and console warning recorded, both attributed to Clerk (not workspace-map code), filed as `.planning/todos/pending/114-clerk-bounce-tracking-and-dev-keys.md`. Folded Phase 111 todo closed. |

**Score:** 18/18 decisions verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ------------ | ------ | ------- |
| `src/lib/workspaceMapLayout.ts` | Pure layout module: buildTree/computeRollups/layoutNodes | ✓ VERIFIED | 693 lines, zero React/Convex imports, all functions present and tested |
| `src/components/workspace/WorkspaceMapCanvas.tsx` | Radial canvas, D-01..D-08, D-15 | ✓ VERIFIED | 334 lines, wired to `ForceGraphCanvas`, three-state payload branch (incl. CR-01 fix) |
| `src/components/workspace/WorkspaceMapPanel.tsx` | Side panel, D-09, D-15 | ✓ VERIFIED | 209 lines, reads fields directly off `WorkspaceMapNode`, no recomputation |
| `src/components/workspace/WorkspaceCoverageStrip.tsx` | Coverage strip, D-14, D-16, D-17 | ✓ VERIFIED | 204 lines, 3-state (undefined/null/data), 4 chips + degraded appends |
| `src/components/workspace/AstridrLensEmptyState.tsx` | D-10, D-11 | ✓ VERIFIED | 85 lines, 3-branch on probe state |
| `src/pages/WorkspaceMap.tsx` | Page composition, D-12 | ✓ VERIFIED | 116 lines, composes canvas+panel+strip+lens, URL param derivation |
| `src/hooks/useWorkspaceMap.ts` | Thin `useQuery` wrapper | ✓ VERIFIED | 35 lines, single subscription, documented 3-state contract |
| `src/hooks/useArmsProbe.ts` | Live probe for D-11 | ✓ VERIFIED | 36 lines, queries `listSnapshots`, guards non-array `sources` |
| `convex/graphSnapshots.ts` (D-13 edit) | `sources` field on `listSnapshots` | ✓ VERIFIED | `sources` added at line 344 alongside pre-existing fields |
| `src/lib/navRegistry.ts` nav entry | GRAPHS group entry | ✓ VERIFIED | `iconComponents.radar` + `navGroups` item at line 154 |
| `src/App.tsx` route | `/workspace-map` route, lazy | ✓ VERIFIED | Lines 86, 184 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `WorkspaceMap.tsx` | `useWorkspaceMap` | direct call | WIRED | `payload = useWorkspaceMap()` at line 48, passed to both strip and canvas unmodified |
| `WorkspaceMap.tsx` | `useArmsProbe` | direct call | WIRED | `armsPresent = useArmsProbe()` at line 49, passed to `AstridrLensEmptyState` |
| `WorkspaceMapCanvas` | `WorkspaceMapPanel` (rootIndex ordering) | `onNodeSelect` callback → page state → prop | WIRED | Canvas computes `rootIndexByKey` once (`WorkspaceMapCanvas.tsx:177-195`), hands the index via `onNodeSelect(node, rootIndexByKey.get(key))`; `WorkspaceMap.tsx:66-70` stores it in `selectedRootIndex` state; `WorkspaceMapPanel` receives it as the `rootIndex` prop and never recomputes its own ordering (doc comment `WorkspaceMapPanel.tsx:36-42` states this explicitly and the code matches — single source of truth, no divergent second ordering) |
| `graphSnapshots.listSnapshots` | `useArmsProbe` | Convex query → `r.sources.some(kind==="arms")` | WIRED | Confirmed both ends: backend returns `sources`, hook reads it with an `Array.isArray` guard |
| `navRegistry.ts` | `App.tsx` route | nav entry → route path match | WIRED | `/workspace-map` in both nav entry (`navRegistry.ts:154`) and route (`App.tsx:184`) |
| `PrivacyContext` | Canvas/Panel masking | `usePrivacy()` → `enabled && maskPaths` gate | WIRED (mutation-proved by orchestrator) | Both surfaces gate correctly; weakening either gate to `enabled` alone turns the `maskPaths:false` discriminator test RED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `WorkspaceMapCanvas` | `payload.dirs` | `convex/workspace.ts:303` `getWorkspaceMap` | Live query returning 4,912 real rows (measured 2026-08-13, reconfirmed live by operator checkpoint 2026-08-14) | ✓ FLOWING |
| `useArmsProbe` | `rows[].sources` | `convex/graphSnapshots.ts` `listSnapshots` | Live query; returns real `sources` array per row (empty/absent today because no ARMS ingest exists yet — expected per D-10) | ✓ FLOWING |

### Behavioral Spot-Checks

Not run as a separate step — the equivalent evidence is the live operator checkpoint
(`114-OPERATOR-CHECKPOINT.md`), which exercised the actual running page against the live
self-hosted Convex backend and recorded verbatim UI output for every major decision. Treated as
superior to a scripted spot-check for this phase.

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` probes declared or referenced by this phase's PLAN/SUMMARY
files; not a migration/tooling phase.

### Requirements Coverage

None mapped — design-doc-driven phase per `114-CONTEXT.md` and ROADMAP.md's own note ("Requirements: none mapped"). All 18 decisions D-01..D-18 traced above in place of REQ-IDs, per Phase 116's precedent and Phase 115's application of it. No orphaned REQ-IDs to report.

### Anti-Patterns Found

None. Grepped all phase-touched files (`src/components/workspace/*`, `src/pages/WorkspaceMap.tsx`,
`src/lib/workspaceMapLayout.ts`, `src/hooks/useWorkspaceMap.ts`, `src/hooks/useArmsProbe.ts`,
`convex/graphSnapshots.ts`) for `TODO|FIXME|XXX|placeholder|not yet implemented|coming soon`. Every
hit is either the redaction-placeholder vocabulary (a legitimate design term, not a stub marker)
or the deliberate, honest "hasn't been built yet"/"queued for v29" copy in `AstridrLensEmptyState`,
which is D-10/D-11's whole point (a stated, honest empty state) rather than an unresolved debt
marker. No unreferenced `TBD`/`FIXME`/`XXX` found.

### Human Verification Required

None. All items requiring human/visual judgment (theme legibility across 4 themes + light, Chrome
DevTools Issues tab, live-data smoke) were already performed and recorded verbatim in
`114-OPERATOR-CHECKPOINT.md` (2026-08-14, operator: Larry) before this verification ran, satisfying
the phase's own Manual-Only Verifications table in `114-VALIDATION.md`.

### Gaps Summary

None. All 18 decisions have live, working implementing code (not just frontmatter mentions);
all 109 phase-specific tests pass; the full suite (4397 passed / 197 todo / 0 failed, per the
orchestrator's independently-verified gate) is green; `tsc --noEmit` is clean; the one code-review
Critical (CR-01, coverage strip loading-skeleton-forever bug) and one Info (IN-01, dead disjunct)
were both confirmed real and fixed, with the fix mutation-proved; the attended operator checkpoint
passed against live data with no Phase 114 defect found. The two DevTools findings (D-18) are both
attributed to Clerk with control-paired evidence and correctly filed against the owning integration
rather than fixed here, per D-18's explicit observe-and-record scope.

## What I checked hardest, and what I dropped

Spent the verification budget on: (1) independently re-deriving each of the 18 decisions against
live source rather than trusting `must_haves` frontmatter labels — all 18 had real implementing
code, none were name-only; (2) the rootIndex cross-plan integration (canvas→page→panel), confirmed
single-source-of-truth, no divergent second ordering; (3) re-running the full phase test suite
live (109/109 green) rather than trusting the SUMMARYs' reported numbers; (4) confirming D-13's
backend change didn't touch or worsen the known pre-existing `sweepGraphSnapshotVersions` defect
(reviewer's own claim, re-checked: `sweepGraphSnapshotVersions` at `graphSnapshots.ts:168-253`
reads only `meta.snapshotId` and version fields, never `sources` — confirmed by grep, no hit for
`sources` in that line range).

Dropped: a claim I considered and could not substantiate — that D-05's "four department hubs sit
on ring 1" (CONTEXT.md prose) might contradict D-05's plan wording ("center to departments to
roots to directories, on fixed concentric rings"). Read the actual radii
(`RING_RADIUS_DEPARTMENT=140` < `RING_RADIUS_ROOT=300` < `RING_RADIUS_DIR_BASE=460`) — they agree;
"ring 1" in the CONTEXT prose is informal numbering (department ring is the first non-center ring),
not a contradiction. Not reported as a gap.

---

_Verified: 2026-08-14_
_Verifier: Claude (gsd-verifier)_
