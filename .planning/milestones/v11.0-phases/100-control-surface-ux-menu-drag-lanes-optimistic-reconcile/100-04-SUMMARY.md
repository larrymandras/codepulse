---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
plan: 04
subsystem: ui

# Dependency graph
requires:
  - phase: 100-01
    provides: resolveScopeDrop / resolveLifecycleActions (src/lib/skills.ts) — the shared drag matrix
  - phase: 100-02
    provides: SkillControlSurfaceProvider / useSkillControlSurface / beginPending / clearPending (src/hooks/usePendingLifecycleMoves.ts)
  - phase: 100-03
    provides: ScopeRail presentational drop-target component (src/components/skills/ScopeRail.tsx)
provides:
  - Skills.tsx wired end-to-end — ScopeRail mounted below Categories, its own dropTargetScope state, handleDropOnScope dispatching through resolveScopeDrop
  - Page-level MoveToProjectDialog for drag-to-Project, wired to beginPending on confirm (never at drop time)
  - MoveToProjectDialog.onMoved widened to carry commandId
  - First integration drop tests over the whole control-surface wiring (6 cases)
affects: [v11.0 milestone close / Phase 100 human UAT (live Forge daemon drag verification remains outstanding)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page-level Skills default export renamed to SkillsBody, wrapped by a thin SkillControlSurfaceProvider-hosting default export (matches SkillLaunchProvider's existing wrap-at-page-root convention)"
    - "handleDropOnScope mirrors handleDropOnCategory's dataTransfer.getData(\"text/plain\") shape but dispatches through resolveScopeDrop instead of a single mutation — same event-handling shape, richer decision"
    - "Paint-before-await: beginPending() is called synchronously before the enqueueLifecycle() promise, with a .catch() that clearPending()s + toasts on a LAYER-1 synchronous refusal (no forgeCommands row is ever created for that case, so the async reconcile effect alone could never clear it)"

key-files:
  created: []
  modified:
    - src/pages/Skills.tsx
    - src/components/skills/MoveToProjectDialog.tsx
    - src/pages/__tests__/Skills.test.tsx

key-decisions:
  - "dropTargetScope is a fully independent useState from the category rail's dropTarget — never reused or shared (Pitfall 5); handleDropOnCategory and the category dropTarget state are untouched"
  - "The dialog branch never enqueues at drop time — setScopeMoveDialog opens the page-level MoveToProjectDialog, and the pending paint (beginPending) begins only in onMoved, fired from the dialog's own successful confirm (D-03, Pitfall 2/4)"
  - "Host resolved via the existing resolveHostId(useForgeHostsRaw() ?? [], undefined) export from SkillLifecycleMenu.tsx — no new host-resolution mechanism invented"
  - "Added data-testid=\"cold-storage-nav-toggle\" to the pre-existing left-rail Cold Storage toggle button — ScopeRail's own always-visible \"Cold Storage\" scope entry (Plan 03, fixed 3-entry rail) made 5 pre-existing Skills.test.tsx selectors (bare text/role queries for \"Cold Storage\") ambiguous the moment ScopeRail mounted; disambiguated by testid rather than changing either component's visible copy (Rule 1 auto-fix — a regression directly caused by this plan's own change, not scope creep)"
  - "MoveToProjectDialog stubbed to a marker div in Skills.test.tsx's integration suite (open/skillName/sourceOrigin data-attrs) rather than exercising its real Convex listWorkspaces query / Radix Select internals — its own behavior is already covered by MoveToProjectDialog.test.tsx"
  - "TDD gate closed per the 100-03 precedent for a plan where implementation necessarily lands before its own dedicated test task: handleDropOnScope was temporarily neutered (early return) to confirm a genuine RED (3/3 mutation-affected cases failed with the expected assertion errors), then restored byte-identical (diffed against a pre-mutation backup) and reconfirmed GREEN (27/27)"
  - "UX-02/UX-03 NOT marked complete in REQUIREMENTS.md — this is the last CODE plan of Phase 100, but the phase's own <verification> section still lists a manual, live-Forge-daemon drag check (archive/move/restore round-trip + honest rollback) as outstanding. Matches every prior phase's own established precedent in this project (98, 99) of deferring requirement completion to full human-verified end-to-end delivery, not per-plan code-completion."

requirements-completed: []

# Metrics
duration: ~8min
completed: 2026-07-24
---

# Phase 100 Plan 04: Control-Surface Wiring Summary

**Skills.tsx wired end-to-end: ScopeRail mounted with its own independent drop-target state, `handleDropOnScope` dispatching through `resolveScopeDrop` (no-op / visible reject / direct `enqueueLifecycle` with paint-before-await + `.catch()` rollback / open `MoveToProjectDialog`), and `MoveToProjectDialog.onMoved` widened to carry the `commandId` so the Project-lane pending paint begins only in the dialog's own confirm.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-24T09:20:00-04:00 (approx, tsc/test verification pass)
- **Completed:** 2026-07-24T09:27:00-04:00 (Task 3 commit)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `Skills.tsx` renamed its default export body to `SkillsBody`, now wrapped by a `SkillControlSurfaceProvider`-hosting `Skills()` default export. `ScopeRail` is mounted immediately below the `CategoryGrid` block with its own `dropTargetScope` state (never sharing the category rail's `dropTarget`).
- `handleDropOnScope` dispatches through `resolveScopeDrop`: `noop`/`reject` silently return (zero mutation — ScopeRail's own dragover already painted the reject hint), `dialog` opens a page-level `MoveToProjectDialog` (no enqueue at drop time), and `enqueue` calls `beginPending` synchronously before `enqueueLifecycle`, with a `.catch()` that `clearPending`s and toasts `lifecycleRefusalMessage` on a LAYER-1 synchronous refusal.
- `MoveToProjectDialog.onMoved` widened from `() => void` to `(commandId: string) => void`; `handleConfirm` now passes the already-generated `commandId` after a successful `enqueueLifecycle`, letting `Skills.tsx`'s page-level instance call `beginPending` from the dialog's own confirm rather than at drop time.
- 6 new integration drop tests in `Skills.test.tsx` cover the full matrix: active-global→Cold (enqueue archive), active-project→Global (enqueue move), active-global→Project (dialog opens, no enqueue), dormant→Project (reject), multi-scope→any (reject), active-global→Global (noop).

## Task Commits

Each task was committed atomically:

1. **Task 1: Skills.tsx — ScopeRail render, dropTargetScope, handleDropOnScope dispatch, provider wrap, page-level Project dialog** - `b44d35f` (feat)
2. **Task 2: Widen MoveToProjectDialog.onMoved to (commandId) and invoke it on successful move** - `999e2c1` (feat)
3. **Task 3 (TDD): Skills integration drop tests — enqueue / dialog / invalid no-op** - `4f83254` (test) — RED confirmed against a temporarily-neutered `handleDropOnScope` (3/3 mutation-affected cases failed), implementation restored byte-identical, GREEN reconfirmed (27/27).

**Plan metadata:** (this commit) `docs: complete plan 04`

## Files Created/Modified
- `src/pages/Skills.tsx` - `SkillControlSurfaceProvider` wrap, `ScopeRail` mount, `dropTargetScope`/`scopeMoveDialog` state, `handleDropOnScope`, page-level `MoveToProjectDialog`, `data-testid="cold-storage-nav-toggle"` on the pre-existing nav toggle
- `src/components/skills/MoveToProjectDialog.tsx` - `onMoved` widened to `(commandId: string) => void`, invoked after a successful `enqueueLifecycle`
- `src/pages/__tests__/Skills.test.tsx` - disambiguated 5 pre-existing Cold-Storage-toggle selectors + 6 new Scope-drag-matrix integration tests + `MoveToProjectDialog`/`enqueueLifecycle` mocks

## Decisions Made
See frontmatter `key-decisions`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 5 pre-existing Skills.test.tsx selectors became ambiguous once ScopeRail mounted**
- **Found during:** Task 1 verification (`npx vitest run src/pages/__tests__/Skills.test.tsx`)
- **Issue:** `ScopeRail`'s own always-visible "Cold Storage" scope entry (Plan 03's fixed 3-entry rail) collided with the pre-existing left-rail "Cold Storage" nav-toggle button — both are `role="button"` elements containing the text "Cold Storage", so `screen.getByRole("button", { name: /cold storage/i })` became ambiguous, and `screen.queryByText("Cold Storage")` could no longer assert absence (ScopeRail's entry is always rendered by design, regardless of dormant count).
- **Fix:** Added `data-testid="cold-storage-nav-toggle"` to the existing nav-toggle button; updated the 5 affected tests to query by that testid instead of the now-ambiguous role/text selectors.
- **Files modified:** `src/pages/Skills.tsx`, `src/pages/__tests__/Skills.test.tsx`
- **Verification:** All 5 previously-passing tests pass again; full suite green (2515 tests).
- **Committed in:** `b44d35f` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test-selector ambiguity directly caused by this plan's own change)
**Impact on plan:** Necessary to keep the existing suite green; no scope creep — no production behavior changed beyond the added testid.

## Issues Encountered

Task 1's own `tsc --noEmit`/test verification could not pass in isolation because `handleDropOnScope`'s `dialog` branch and the enqueue's exact args depend on `MoveToProjectDialog.onMoved`'s widened signature (Task 2). Resolved by applying both Tasks 1 and 2's code edits together before running verification, then committing each task's file(s) separately (`b44d35f` touches only `Skills.tsx`+test-selector fix, `999e2c1` touches only `MoveToProjectDialog.tsx`) — each commit stayed scoped to its own `files_modified` list per the plan frontmatter, even though verification necessarily ran across both.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 100 is now 5/5 plans code-complete (100-01 through 100-05). Remaining before the phase (and v11.0 milestone) can be marked fully complete:
- **Manual, live-Forge-daemon verification** (per this plan's own `<verification>` section): drag active→Cold, active-global→Project (pick workspace), cold→Global; confirm each reconciles to `done` and rolls back honestly on a forced failure/expiry. Same category as the Phase 98/99 outstanding live checks.
- **REQUIREMENTS.md UX-01..04 traceability table** still reads "Pending" — deferred to phase-close/human UAT per this project's established precedent (Phase 98/99 decisions), not a gap in this plan's delivery.
- No blockers for the human-verification step: the code path is complete, `tsc --noEmit` clean, full suite green (215 files / 2515 tests / 193 todo, 0 failures) as of this plan's completion.

---
*Phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: src/pages/Skills.tsx
- FOUND: src/components/skills/MoveToProjectDialog.tsx
- FOUND: src/pages/__tests__/Skills.test.tsx
- FOUND: .planning/phases/100-control-surface-ux-menu-drag-lanes-optimistic-reconcile/100-04-SUMMARY.md
- FOUND: b44d35f (Task 1 commit)
- FOUND: 999e2c1 (Task 2 commit)
- FOUND: 4f83254 (Task 3 commit)
