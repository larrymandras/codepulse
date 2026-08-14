---
phase: 114-workspace-map-view
plan: 06
subsystem: ui
tags: [react, vitest, testing-library, lucide, shadcn, coverage-strip, mutation-testing]

# Dependency graph
requires:
  - phase: 114-workspace-map-view (plan 03)
    provides: "src/test/workspaceMapFixture.ts — the getWorkspaceMap fixture factory + four degraded presets"
  - phase: 114-workspace-map-view (plan 01)
    provides: "useThemeColors() extended with mutedForeground/deptPersonal/deptConsulting/deptWork; --dept-*/--status-warn CSS tokens"
provides:
  - "WorkspaceCoverageStrip component (D-14): always-visible four-chip header, degraded chips append at end"
  - "isScanStale(generatedAtSeconds, nowMs) — exported pure staleness predicate, D-17"
  - "D-16 recorded mutation proof for the healthy zero-warn assertion"
  - "D-17 two-sided 36h boundary suite with epoch-seconds unit-sanity check"
affects: ["114-08 (WorkspaceMap page — will mount this strip above the canvas)", "114-07 (WorkspaceMapCanvas, sibling consumer of the same fixture)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational component receiving the getWorkspaceMap payload (or undefined) as a prop, not calling useWorkspaceMap internally — testable with zero Convex mock, matching AstridrLensEmptyState's 114-04 precedent"
    - "Injectable now?: number prop threading through to a pure predicate (isScanStale) so no test needs to mock the system clock"
    - "D-16 mutation-proof shape: write healthy control -> run GREEN -> flip one fixture flag -> run RED, capture verbatim output -> revert -> write degraded tests"

key-files:
  created:
    - src/components/workspace/WorkspaceCoverageStrip.tsx
    - src/components/workspace/WorkspaceCoverageStrip.test.tsx
  modified: []

key-decisions:
  - "Threshold constant STALE_THRESHOLD_SECONDS is expressed in SECONDS (36*3600) and isScanStale converts nowMs down to seconds once, rather than converting generatedAt up to milliseconds — matches the acceptance criterion that the one literal 36 in the file is expressed in seconds against an epoch-seconds generatedAt"
  - "Lucide's AlertTriangle component renders CSS class lucide-triangle-alert, not lucide-alert-triangle — discovered via the Step-2 RED mutation's DOM dump, not assumed from the PascalCase component name"
  - "data prop type is WorkspaceMapData (NonNullable<...>, already exported by 114's useWorkspaceMap.ts) rather than a locally redeclared shape, keeping one source of truth for the payload type"

patterns-established:
  - "Pattern: D-16-style honesty-flag component gets a recorded RED mutation proof committed to the SUMMARY, never just a claim of coverage"

requirements-completed: []  # design-doc-driven phase — traced to D-14, D-16, D-17

# Metrics
duration: ~25min
completed: 2026-08-14
---

# Phase 114 Plan 06: Workspace Coverage Strip Summary

**Always-visible four-chip D-14 coverage strip with a recorded RED mutation proof for its zero-warn healthy assertion and a two-sided 36-hour staleness boundary (D-17).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 2 (both new)

## Accomplishments

- `WorkspaceCoverageStrip.tsx`: four healthy chips (scan time, roots covered, withheld count, unclassified count) always render in fixed order; up to three degraded chips append at the end without ever reordering the healthy four; chip 4 (unclassified) never escalates at any count.
- Exported pure `isScanStale(generatedAtSeconds, nowMs)` predicate — no internal `Date.now()` — driving the scan-time chip's "— overdue" escalation past exactly 36 hours.
- D-16's healthy zero-warn assertion was demonstrated able to fail (Task 2 Step 2), with the verbatim RED output recorded below, before any degraded-state test was written.
- Four independent degraded-state tests (one per honesty flag), each asserting its own copy present and the other three degraded strings absent, plus a loading-state test and a chip-4-never-escalates test.
- D-17's boundary pinned from both sides (exactly 36h not stale, 36h+1s stale, 35h59m59s not stale, 1 minute not stale) plus a UTC-year unit-sanity assertion and two render-level "overdue" tests.
- 14/14 tests green; `npx tsc --noEmit` clean; zero hex literals in the component; zero real root/directory names in either file (fixed-string-grep verified against a known-positive control).

## Task Commits

1. **Task 1: Build the coverage strip** - `fd357148` (feat)
2. **Task 2: The D-16 mutation proof** - `7f9495fe` (test)
3. **Task 3: The D-17 36-hour staleness boundary** - `77cac221` (test)

## Files Created/Modified

- `src/components/workspace/WorkspaceCoverageStrip.tsx` - the always-visible coverage strip, `isScanStale` pure predicate, chip rendering + degraded escalation logic
- `src/components/workspace/WorkspaceCoverageStrip.test.tsx` - 14 tests: healthy control (with D-16 mutation proof recorded below), 4 degraded-state tests, loading test, chip-4-never-escalates test, 5-case D-17 boundary suite + 2 render-level staleness tests

## D-16 Recorded RED Mutation Proof (Task 2, Step 2)

**Order of operations, as executed:**
1. Wrote only the healthy-control test (`makeWorkspaceMapFixture()`, zero-warn assertions). Ran `npx vitest run src/components/workspace/WorkspaceCoverageStrip.test.tsx` — GREEN (1/1 passed).
2. Temporarily flipped `scannedRootsComplete: false` in the fixture passed to that same test (no other change). Re-ran the exact same command.
3. Reverted the mutation. Re-ran — GREEN again (1/1 passed), confirmed before proceeding.
4. Only then wrote the four degraded-state tests.

**Verbatim RED output from step 2** (`npx vitest run src/components/workspace/WorkspaceCoverageStrip.test.tsx`):

```
 RUN  v4.1.9 C:/Users/mandr/codepulse

 ❯ src/components/workspace/WorkspaceCoverageStrip.test.tsx (1 test | 1 failed) 34ms
     × healthy control: zero warn treatment, no degraded copy, no AlertTriangle 33ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/components/workspace/WorkspaceCoverageStrip.test.tsx > WorkspaceCoverageStrip > healthy control: zero warn treatment, no degraded copy, no AlertTriangle
Error: expect(element).not.toBeInTheDocument()

expected document not to contain element, found <span
  class="inline-flex w-fit shrink-0 items-center justify-center overflow-hidden rounded-full border px-2 py-0.5 font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3 [a&]:hover:bg-accent [a&]:hover:text-accent-foreground gap-1 font-mono text-xs border-[var(--status-warn)] text-[var(--status-warn)] bg-[var(--status-warn)]/10"
  data-slot="badge"
  data-variant="outline"
>
  <svg
    aria-hidden="true"
    class="lucide lucide-triangle-alert h-3 w-3"
    fill="none"
    height="24"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
    />
    <path
      d="M12 9v4"
    />
    <path
      d="M12 17h.01"
    />
  </svg>
  4/4 roots covered — scan incomplete
</span> instead
 ❯ src/components/workspace/WorkspaceCoverageStrip.test.tsx:31:55
     29|     // None of the five degraded copy strings are present.
     30|     expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
     31|     expect(screen.queryByText(/scan incomplete/)).not.toBeInTheDocumen…
       |                                                       ^
     32|     expect(screen.queryByText(/Access data unreliable/)).not.toBeInThe…
     33|     expect(screen.queryByText(/No local classification config/)).not.t…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  09:21:25
   Duration  1.13s (transform 66ms, setup 81ms, import 285ms, tests 34ms, environment 609ms)
```

**A real defect this RED run caught, not just a proof-of-concept:** the failing element's DOM dump shows `class="lucide lucide-triangle-alert ..."` — Lucide's `AlertTriangle` component renders CSS class `lucide-triangle-alert`, not `lucide-alert-triangle` as the PascalCase component name would suggest. The healthy test's own icon-presence selector (`svg.lucide-alert-triangle`) was wrong at the time this mutation ran; it was corrected to `svg.lucide-triangle-alert` before Step 3's revert-and-confirm-GREEN pass, and every subsequent test in the file uses the corrected selector. Without the mutation step this selector bug would have silently made every "no AlertTriangle" assertion in the file vacuously true (a `querySelector` that never matches anything passes `not.toBeInTheDocument()` regardless of what actually rendered) — the exact "a check that passes by accident reads identically to one that passes correctly" failure this project's rules warn about.

## Decisions Made

- **Threshold constant expressed in seconds, not milliseconds.** `STALE_THRESHOLD_SECONDS = 36 * 60 * 60` and `isScanStale` converts `nowMs` down to seconds once (`nowMs / 1000`), rather than converting `generatedAtSeconds` up to milliseconds. This satisfies the plan's acceptance criterion that the file's one literal `36` sits in a threshold expressed in seconds against an epoch-seconds `generatedAt`, and keeps the "exactly one conversion, never neither" discipline the plan calls out.
- **`data` prop typed as `WorkspaceMapData`** (the `NonNullable<...>` type already exported by `src/hooks/useWorkspaceMap.ts`, built in an earlier 114 plan) rather than a locally redeclared interface — one source of truth for the payload shape, verified to match `convex/workspace.ts:303-347`'s actual return exactly.
- **Icon-presence assertions use `document.querySelector("svg.lucide-triangle-alert")`**, not `screen.getByRole` or a test id, because Lucide's rendered class differs from the component's PascalCase name (see mutation-proof note above) — this was verified empirically, not assumed.

## Deviations from Plan

None — plan executed as written. The Lucide class-name correction (`lucide-alert-triangle` -> `lucide-triangle-alert`) was found and fixed entirely within Task 2's own mandated mutation-testing procedure, not a deviation from it — it's the exact class of defect that procedure exists to catch.

## Issues Encountered

None beyond the Lucide class-name discovery documented above, which the plan's own D-16 mutation-proof procedure surfaced and required no scope change to fix.

## User Setup Required

None - no external service configuration required.

## Disclosure Gate

Fixed-string grep (`grep -F 'C:\Users\mandr'`) run against both changed files, paired with a known-positive control string (confirmed to match, exit 0) so the zero result on the real files (exit 1, no match) is proven to discriminate rather than being a broken pattern. No real root or directory name appears in either file — all fixture data is inherited from `src/test/workspaceMapFixture.ts`'s existing synthetic names (`root-a`, `root-b`, `root-c`, `root-d`).

## Next Phase Readiness

- `WorkspaceCoverageStrip` is ready to be mounted by the `/workspace-map` page plan (114-08 per the pattern map), which will pass it the real `useWorkspaceMap()` result.
- No blockers. `isScanStale` and the component's prop contract (`{ data: WorkspaceMapData | undefined; now?: number }`) are stable for that consumer.

---
*Phase: 114-workspace-map-view*
*Completed: 2026-08-14*

## Self-Check: PASSED

- FOUND: src/components/workspace/WorkspaceCoverageStrip.tsx
- FOUND: src/components/workspace/WorkspaceCoverageStrip.test.tsx
- FOUND: .planning/phases/114-workspace-map-view/114-06-SUMMARY.md
- FOUND commits: fd357148, 7f9495fe, 77cac221, 98d9367a
