---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 07
subsystem: ui
tags: [react, convex, shadcn, ui-cleanup, dedup, tdd]

# Dependency graph
requires:
  - phase: 96-01
    provides: "<PageHeader> shared component (F7 typography contract)"
provides:
  - "Shared <FactsTable> component (src/components/FactsTable.tsx) consumed by both Memory 'Durable Facts' and Dreaming 'Facts' tabs"
  - "FactsTable contract test (render/filter/empty-state)"
  - "Memory and Dreaming dead-UI removal (Import Conversations stub, Start Backfill stub, unused AnimatedNumber import)"
  - "Memory and Dreaming headers migrated to <PageHeader>"
affects: [memory, dreaming, ui-components]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational shared-component extraction: query + filter STATE stays page-scoped (useQuery, useState), only the render/filter markup + filtering logic moves into the shared component"

key-files:
  created:
    - src/components/FactsTable.tsx
    - src/components/__tests__/FactsTable.test.tsx
  modified:
    - src/pages/Memory.tsx
    - src/pages/Dreaming.tsx

key-decisions:
  - "FactsTable receives the RAW (unfiltered) facts array + search/category state and filters internally, rather than receiving an already-filtered list — this is required to correctly distinguish the two existing empty-state copies ('No durable facts extracted yet...' vs 'No facts match your search.'), which a pre-filtered-only prop could not reproduce."
  - "Fixed Memory's Imports-tab empty-state copy, which referenced the now-removed 'Import Conversations' button by name ('Use Import Conversations to bring in...') — corrected to describe the actual (unavailable) capability rather than a control that no longer exists (Rule 1: stale UI reference)."

patterns-established:
  - "Shared table components own their own filtering logic even when consumed by multiple pages with independently-owned filter state, so multi-state empty-copy behavior (raw-empty vs filtered-empty) is preserved without page-side duplication."

requirements-completed: [D-09, F9, D-10, F7]

# Metrics
duration: 25min
completed: 2026-07-13
---

# Phase 96 Plan 07: Shared FactsTable + Dead-UI Cleanup Summary

**Extracted the duplicated "facts table" block from Memory and Dreaming into one shared `<FactsTable>` component (D-09), removed two disabled dead-UI stubs (F9/D-10), and migrated both page headers to `<PageHeader>` (F7).**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-13T14:26:20Z (approx, wave 2 kickoff)
- **Completed:** 2026-07-13T14:49:47Z
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- New `src/components/FactsTable.tsx`: presentational, no `useQuery` inside, owns search/category filtering over a page-supplied raw facts array; preserves the exact existing empty-state and no-match copy from both host pages verbatim
- `src/components/__tests__/FactsTable.test.tsx`: 4 passing tests (row rendering + confidence formatting, empty-state copy, search callback, category-select callback) — RED confirmed before implementation, GREEN after
- `src/pages/Memory.tsx` "Durable Facts" tab and `src/pages/Dreaming.tsx` "Facts" tab both now render `<FactsTable>` instead of ~75-line duplicated blocks each; each page still owns its own `useQuery(api.dreaming.recentFacts, ...)` and filter state
- Removed Memory's permanently-disabled "Import Conversations" button (and its now-stale empty-state copy reference)
- Removed Dreaming's disabled "Start Backfill" button + its "UI-ready but requires an endpoint" note, and the unused `AnimatedNumber` import
- Both pages' `h1` replaced with `<PageHeader title="Memory">` / `<PageHeader title="Dreaming">`

## Task Commits

1. **Task 1: Build shared FactsTable + contract test** - `cba4d13` (test, RED) → `274f6f1` (feat, GREEN)
2. **Task 2: Consume FactsTable in Memory + Dreaming; remove dead UI; headers** - `d09defc` (feat)

**Plan metadata:** (this commit, pending)

## Files Created/Modified
- `src/components/FactsTable.tsx` - Shared presentational facts table: search Input + optional category `<select>` + Table (Fact/Category/Confidence/Created columns), wrapped in `SectionErrorBoundary`
- `src/components/__tests__/FactsTable.test.tsx` - Render/filter/empty-state contract test
- `src/pages/Memory.tsx` - "Durable Facts" tab now consumes `<FactsTable>`; dead "Import Conversations" stub removed; header migrated to `<PageHeader title="Memory">`; unused `Input` import and `filteredDurableFacts` computation removed
- `src/pages/Dreaming.tsx` - "Facts" tab now consumes `<FactsTable>`; dead "Start Backfill" stub removed; unused `AnimatedNumber`, `Input`, `Button` imports and `filteredFacts` computation removed; header migrated to `<PageHeader title="Dreaming">`

## Decisions Made
- **FactsTable filters internally over a raw facts prop** (not a pre-filtered list) — see key-decisions above. This was a required interpretation call: the plan's task-2 action text said "passing facts={filteredFacts}" while the PATTERNS.md extraction shape and the UI-SPEC's mandate to preserve BOTH existing empty-state copies (raw-empty vs no-match) are only satisfiable if FactsTable can distinguish the two cases, which requires access to the raw list. Verified both host pages' empty/no-match behavior is unchanged after the refactor.
- **Corrected Memory's Imports-tab empty-state copy** to stop referencing the just-removed "Import Conversations" control by name (was required to satisfy the plan's own acceptance criterion of zero "Import Conversations" occurrences in Memory.tsx, and to avoid leaving user-facing copy that references dead UI).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Memory's Imports-tab empty-state copy referenced the removed "Import Conversations" button by name**
- **Found during:** Task 2 (dead-UI removal)
- **Issue:** After removing the disabled "Import Conversations" button, the adjacent empty-state text still read "No conversation imports yet. Use Import Conversations to bring in ChatGPT, Claude Code, or markdown exports." — instructing users to use a control that no longer exists. This also violated the task's own acceptance criterion (`grep -c 'Import Conversations' src/pages/Memory.tsx == 0`).
- **Fix:** Reworded to "No conversation imports yet. Importing ChatGPT, Claude Code, or markdown exports requires an Ástríðr endpoint that isn't available yet." — same "No {noun} yet. {concrete state}." shape from UI-SPEC's copywriting contract, describing the real limitation instead of a phantom control.
- **Files modified:** src/pages/Memory.tsx
- **Verification:** `grep -c 'Import Conversations' src/pages/Memory.tsx` → 0; `npx tsc --noEmit` clean
- **Committed in:** d09defc (Task 2 commit)

**2. [Rule 1 - Cleanup] Removed now-dead `filteredFacts`/`filteredDurableFacts` local computations and unused `Input`/`Button` imports**
- **Found during:** Task 2, after FactsTable extraction
- **Issue:** Once the inline table/filter markup moved into `<FactsTable>`, each page's local `filteredFacts`/`filteredDurableFacts` variable and the `Input` (Memory/Dreaming) and `Button` (Dreaming, post-backfill-removal) imports became dead code.
- **Fix:** Deleted the unused computations and imports in both pages.
- **Files modified:** src/pages/Memory.tsx, src/pages/Dreaming.tsx
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run src/components/__tests__/FactsTable.test.tsx` green
- **Committed in:** d09defc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug/stale-copy, 1 cleanup) — both Rule 1, directly caused by this task's own extraction/removal work
**Impact on plan:** No scope creep; both fixes were necessary to satisfy the plan's own acceptance criteria and keep the pages internally consistent after the refactor.

## Issues Encountered
None beyond the deviations above.

## TDD Gate Compliance

Task 1 was `tdd="true"`. Git log confirms the RED→GREEN sequence:
- `cba4d13` — `test(96-07): add failing test for shared FactsTable component` (RED — confirmed failing via `npx vitest run` before FactsTable.tsx existed)
- `274f6f1` — `feat(96-07): implement shared FactsTable component (D-09)` (GREEN — 4/4 tests passing)

No REFACTOR commit was needed (no cleanup pass required beyond the initial implementation).

## Known Stubs

None. Both dead-UI stubs targeted by this plan (Memory's "Import Conversations", Dreaming's "Start Backfill") were removed, not left in place.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `<FactsTable>` is now the single source of truth for facts-table rendering; any future change to fact display (e.g. new column) only needs to touch one file.
- Memory and Dreaming both use `<PageHeader>` now, consistent with the F7 migration already landed on other pages in wave 1/2.
- No blockers for subsequent 96-* plans.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: src/components/FactsTable.tsx
- FOUND: src/components/__tests__/FactsTable.test.tsx
- FOUND: .planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-07-SUMMARY.md
- FOUND commit: cba4d13 (test, RED)
- FOUND commit: 274f6f1 (feat, GREEN)
- FOUND commit: d09defc (feat, Task 2)
- FOUND commit: 6d7a6bb (docs, summary)
