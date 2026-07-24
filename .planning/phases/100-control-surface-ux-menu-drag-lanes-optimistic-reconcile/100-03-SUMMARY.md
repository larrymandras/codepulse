---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
plan: 03
subsystem: ui
tags: [react, drag-and-drop, lucide-react, skills, control-surface]

# Dependency graph
requires:
  - phase: 100-01
    provides: resolveScopeDrop (src/lib/skills.ts) — the complete drag matrix (D-02), enqueue/dialog/reject/noop decision
  - phase: 100-02
    provides: useDraggingSkill (src/hooks/usePendingLifecycleMoves.ts) — currently-dragged skill identity via SkillControlSurfaceProvider
provides:
  - ScopeRail component — 3 always-visible Global/Project/Cold Storage native HTML5 drop targets
  - Per-entry valid/invalid/idle/no-op visual states derived from resolveScopeDrop
  - Inline destructive reject hint rendered under the entry (no hover-tooltip reliance)
affects: [100-04 (Skills.tsx assembly — will mount ScopeRail below CategoryGrid and wire dropTargetScope/onDragOverScope/onDragLeaveScope/onDropOnScope + enqueueLifecycle/dialog dispatch)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ScopeRail mirrors CategoryGrid.tsx's row markup/hover/active/drop-target class branches verbatim, extended with a destructive invalid-drop branch"
    - "Presentational + event-forwarding component: reads useDraggingSkill() for validity, calls resolveScopeDrop() for per-entry decision, forwards raw drag/drop events to parent props — never calls a mutation itself"

key-files:
  created:
    - src/components/skills/ScopeRail.tsx
    - src/components/skills/ScopeRail.test.tsx
  modified: []

key-decisions:
  - "Fixed 3-entry SCOPE_ENTRIES constant (global/project/cold), never gated on a nonzero count — a user must be able to drag into an empty Cold Storage (UI-SPEC Empty state note)"
  - "Per-entry validity computed only for the entry currently equal to dropTargetScope (dropResult is null otherwise), avoiding calling resolveScopeDrop on every render for every entry"
  - "No-op (own-scope) drop treated identically to idle — no highlight branch added for it, since resolveScopeDrop's kind:'noop' simply fails both the isValid and isInvalid checks"
  - "data-scope attribute (not a class-based selector) used for test/DOM addressing, matching the existing data-testid convention on CategoryGrid's data-testid=\"category-nav-item\""

requirements-completed: [UX-02]

# Metrics
duration: 5min
completed: 2026-07-24
---

# Phase 100 Plan 03: ScopeRail Component Summary

**`ScopeRail.tsx` — 3 always-visible Global/Project/Cold Storage native HTML5 drop targets with per-entry valid/invalid/idle drag-over states computed from `resolveScopeDrop`, plus an inline destructive reject hint; presentational + event-forwarding only, calls no mutation.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-24T09:03:47-04:00 (RED test run)
- **Completed:** 2026-07-24T09:04:48-04:00 (GREEN commit)
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (both new)

## Accomplishments
- `ScopeRail` renders the "Scope" section header (identical style to "Categories") and three always-visible entries (Global/Project/Cold Storage) with `Globe`/`FolderGit2`/`Archive` icons matching `DestinationBadge`.
- Per-entry drag-over validity is computed from `useDraggingSkill().draggingSkill` via `resolveScopeDrop(draggingSkill, scope)`: `enqueue`/`dialog` results render the primary valid-drop highlight (`bg-primary/30 border-dashed border-primary shadow-[var(--glow-sm)]`), `reject` results render the destructive not-allowed highlight (`border-dashed border-destructive/40 bg-destructive/5 cursor-not-allowed`) plus the inline reject hint text, and `noop` (or no drag in progress) falls through to the idle branch — no fake highlight for a drop that does nothing.
- `onDragOver` calls `e.preventDefault()` before forwarding to `onDragOverScope(scope)` (required for `onDrop` to ever fire); `onDrop` calls `e.preventDefault()` before forwarding to `onDropOnScope(scope, e)`. The component calls no mutation — mirrors `CategoryGrid`'s division of responsibility exactly.

## Task Commits

TDD task, RED then GREEN:

1. **Task 1 (RED): failing test for ScopeRail** - `9126c6fa` (test) — 5 test cases, confirmed failing (`Failed to resolve import "./ScopeRail"`) before the implementation file existed.
2. **Task 1 (GREEN): ScopeRail implementation** - `d6534e91` (feat) — all 5 tests pass; `tsc --noEmit` clean.

**Plan metadata:** (this commit) `docs: complete plan 03`

## Files Created/Modified
- `src/components/skills/ScopeRail.tsx` - 3-entry droppable scope rail, valid/invalid/idle states, inline reject hint, event-forwarding only
- `src/components/skills/ScopeRail.test.tsx` - 5 test cases: always-visible entries, valid highlight, invalid highlight + hint, no-op honesty, event forwarding with preventDefault

## Decisions Made
See frontmatter `key-decisions`. No decisions required deviation from the plan's literal `<action>`/`<behavior>` spec.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Verified RED (test failed on missing import) before restoring the implementation and confirming GREEN, per the TDD gate-sequence requirement.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`ScopeRail` is ready to be mounted by Plan 100-04 (`Skills.tsx` assembly), which will:
- Render `<ScopeRail dropTargetScope={...} onDragOverScope={...} onDragLeaveScope={...} onDropOnScope={...} />` beneath `CategoryGrid` in the left rail.
- Wire `onDropOnScope` to call `resolveScopeDrop` again (or reuse the cached result) and dispatch the actual `enqueueLifecycle` mutation / `MoveToProjectDialog` per D-03, plus `beginPending`/`clearPending` from `usePendingLifecycleMoves` (100-02) for the optimistic pending-row overlay.
- No blockers. UX-02 requirement not yet marked complete in REQUIREMENTS.md — deferred to full end-to-end delivery across Plans 02-04, matching this project's established per-plan-vs-full-delivery precedent.

---
*Phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile*
*Completed: 2026-07-24*
