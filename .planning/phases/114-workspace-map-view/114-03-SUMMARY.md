---
phase: 114-workspace-map-view
plan: 03
subsystem: test-infrastructure
tags: [fixture, vitest, workspace-map, disclosure-guard]
dependency-graph:
  requires: []
  provides:
    - "src/test/workspaceMapFixture.ts (makeWorkspaceMapFixture, 4 degraded presets, mockGetWorkspaceMap, mockArmsProbe)"
  affects:
    - "All later 114-* plans that test WorkspaceMapCanvas, WorkspaceCoverageStrip, WorkspaceMapPanel, AstridrLensEmptyState, WorkspaceMap page"
tech-stack:
  added: []
  patterns:
    - "vi.mocked(useQuery).mockImplementation discriminating by query function reference (api.workspace.getWorkspaceMap vs api.graphSnapshots.listSnapshots)"
key-files:
  created:
    - src/test/workspaceMapFixture.ts
    - src/test/workspaceMapFixture.test.ts
  modified: []
decisions:
  - "unclassifiedRootIds stays [] in the healthy default even though one synthetic root (root-d) is department 'Unclassified' — the field tracks scan-time classification-failure, not the (legitimate) Unclassified department bucket; kept per the plan's explicit acceptance criterion and 114-VALIDATION.md's Wave 0 spec"
  - "Degraded presets implemented as named factory functions (makeScannedRootsIncompleteFixture, etc.) rather than bare override objects, so the coveredRoots-shortening that must accompany scannedRootsComplete:false can't be forgotten by a caller"
metrics:
  duration: "~25 min"
  completed: "2026-08-14"
---

# Phase 114 Plan 03: Workspace-Map Test Fixture Summary

Built the workspace-map equivalent of `src/test/projectGraphFixture.ts`: a synthetic-only fixture
factory mirroring `getWorkspaceMap`'s exact return shape, four single-flag degraded presets for
D-16's honesty-flag testing, and two query-discriminating mock helpers — proven correct by a
14-assertion self-test before any other Phase 114 plan starts trusting it.

## What Was Built

**`src/test/workspaceMapFixture.ts`** — exports:
- `makeWorkspaceMapFixture(overrides?)` — bare call returns the all-green D-16 healthy control:
  `scannedRootsComplete: true`, `accessDerivationOk: true`, `localConfigStatus: "merged"`,
  `unclassifiedRootIds: []`, `coveredRoots.length === rootCount`. `generatedAt` defaults to
  `Date.now() / 1000` (epoch seconds); a `staleGeneratedAt` override knob pins an exact value for
  D-17 boundary tests, mirroring `projectGraphFixture.ts:145-147`.
- Default `dirs` payload: 4 synthetic roots (`root-a`..`root-d`) spanning all 4 departments
  (Personal, Consulting, Work, Unclassified — exceeds the plan's "at least 3" requirement).
  `root-a` carries a depth-1 → depth-2 → depth-3 chain so D-03/D-04's per-level expansion and
  rollup math have real structure to chew on. Includes at least one `astridr-reachable` dir, one
  `local-only` dir, one `withheldCount > 0` dir, one `fileCount: 0, withheldCount: 0` dir (pure
  structure), and one `fileCount: 0, withheldCount > 0` dir (everything withheld) — the two facts
  114-CONTEXT.md's § Specific Ideas explicitly says the map must not conflate.
- Four named degraded-preset factories, one per honesty flag: `makeScannedRootsIncompleteFixture`
  (also shortens `coveredRoots` below `rootCount` to match — bundled into the factory so a caller
  can't apply one half of the signal and forget the other), `makeAccessDerivationFailedFixture`,
  `makeLocalConfigAbsentFixture`, `makeLocalConfigVersionMismatchFixture`. Each flips exactly one
  signal; the other three stay green (asserted in the self-test, not just claimed).
- `mockGetWorkspaceMap(value)` / `mockArmsProbe(value)` — both install one shared
  `vi.mocked(useQuery).mockImplementation` that discriminates by comparing the query function
  argument against `api.workspace.getWorkspaceMap` / `api.graphSnapshots.listSnapshots`. This
  means a page test can mock both `getWorkspaceMap` (the map data) and `listSnapshots` (D-11's arms
  probe) in the same file without one silently overwriting the other's mock — the failure mode the
  plan flagged as producing "a green test that measured the wrong thing."
- No `withheldBytes`/`withheldSize` field — grep-verified `0` matches, per `schema.ts`'s
  side-channel rule that a byte total on withheld files is a higher-resolution disclosure than a
  count.
- Header comment states the Phase 115 D-17 public-repo disclosure rule so a future reader does not
  "improve" the fixture with real names.

**`src/test/workspaceMapFixture.test.ts`** — 14 assertions across 6 describe blocks, zero mocks
(pure factory calls):
1. Healthy default is all-green (2 tests).
2. Each of the 4 degraded presets flips exactly one signal, asserting all four signals every time
   (not just the flipped one) — proves a preset that quietly degrades two signals would be caught.
3. Timestamp unit sanity: `generatedAt < Date.now()` and `new Date(generatedAt * 1000).getUTCFullYear() > 2000`
   — the exact check this project's LESSONS record as necessary to catch a `/1000` unit error that
   would otherwise make D-17's staleness check pass vacuously. Plus a second test proving the
   `staleGeneratedAt` override pins an exact value.
4. Structural coverage: astridr-reachable + local-only both present, `withheldCount > 0` present,
   the two `fileCount: 0` variants distinguished, depth ≥ 3 present, ≥ 3 departments present.
5. Disclosure-guard tripwire against the two names already public at HEAD (`codepulse`,
   `astridr-repo`), commented as a tripwire not a proof.

All 14 pass: `npx vitest run src/test/workspaceMapFixture.test.ts` → `Test Files 1 passed (1)`,
`Tests 14 passed (14)`.

## Verification

- `npx tsc --noEmit` — clean, run twice (after each task).
- `npx vitest run src/test/workspaceMapFixture.test.ts` — 14/14 green.
- `grep -c 'withheldBytes\|withheldSize' src/test/workspaceMapFixture.ts` → `0`.
- `grep -c 'mockImplementation' src/test/workspaceMapFixture.ts` → `2` (not a bare `mockReturnValue`
  as the only mechanism).
- `git show --stat HEAD` after each commit confirmed exactly one intended file per commit — no
  foreign files swept in from the shared checkout.

## Disclosure Probe (required by the executor's disclosure gate)

Ran a fixed-string grep (never hand-escaped backslashes, which silently return 0 on Windows paths
per this project's LESSONS) against both new files, paired with a known-positive control to prove
a zero result actually discriminates:

```
=== Probe: C:\Users\mandr in new files (expect 0) ===
src/test/workspaceMapFixture.ts:0
src/test/workspaceMapFixture.test.ts:0
=== Control: known-positive string in this same repo (CLAUDE.md, expect >0) ===
2
=== Probe: mandras (surname) in new files ===
src/test/workspaceMapFixture.ts:1
src/test/workspaceMapFixture.test.ts:0
=== Probe: mandrasle (email) in new files (expect 0) ===
src/test/workspaceMapFixture.ts:0
src/test/workspaceMapFixture.test.ts:0
```

The one `mandras` hit was investigated (`grep -Fin 'mandras' src/test/workspaceMapFixture.ts` →
line 21, `` `larrymandras/codepulse` is a PUBLIC repo ``, inside the file's own header comment
describing the disclosure rule). Verified this is the repo's own public GitHub org/repo handle,
already tracked at HEAD in 11 other files including `README.md`, `.github/dependabot.yml`, and
`src/components/GithubActionsPanel.tsx` (`git grep -F -c 'larrymandras'`). Not a disclosure — no
real root, directory, client name, or home path appears anywhere in either new file.

## Deviations from Plan

None — plan executed as written. One clarification worth recording: the plan's Task 1 action text
allowed "named factories or documented named override objects" for the four degraded presets; named
factory functions were chosen so the `coveredRoots`-shortening that must accompany
`scannedRootsComplete: false` is bundled into the factory itself rather than left as a manual
pairing a caller could forget.

## Known Stubs

None. This plan produces test-only infrastructure with no UI or data-flow stubs.

## Threat Flags

None. This plan's only surface (`src/test/workspaceMapFixture.ts`,
`src/test/workspaceMapFixture.test.ts`) is test-only code, never shipped to the browser bundle, and
its one identified threat (T-114-01, disclosure) was the subject of the dedicated probe above.

## Self-Check: PASSED

- `FOUND: src/test/workspaceMapFixture.ts`
- `FOUND: src/test/workspaceMapFixture.test.ts`
- `FOUND: 919dacd7` (Task 1 commit)
- `FOUND: 5b30acdc` (Task 2 commit)
