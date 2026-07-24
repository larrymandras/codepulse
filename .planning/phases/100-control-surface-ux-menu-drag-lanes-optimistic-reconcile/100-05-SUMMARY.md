---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
plan: 05
subsystem: ui
tags: [react, tailwind, context, dnd, vitest]

# Dependency graph
requires:
  - phase: 100-02
    provides: usePendingMove/useDraggingSkill context readers (SkillControlSurfaceProvider)
  - phase: 100-03
    provides: ScopeRail (consumes useDraggingSkill to compute per-entry drop validity)
provides:
  - SkillRow optimistic pending overlay (opacity-70 + pulsing --status-info bar), distinct from dormant (opacity-50) and active/selected (--primary)
  - SkillRow onDragStart/onDragEnd reporting the dragged skill via setDraggingSkill, so ScopeRail can compute drop validity during a native drag
  - Confirmed audit: the scope-gated ⋯ SkillLifecycleMenu already renders identically across AllSkillsOverview/SkillsInCategory/ColdStorageView (shared via SkillRow), reconciled with QuickDeck's Run-default gesture
  - Confirmed audit: no /manage-skills terminal-instruction string survives anywhere in source (only the preserved negative test assertion)
affects: [100-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Context-read visual state (usePendingMove/useDraggingSkill) instead of prop-drilling through intermediary list components"
    - "Distinct-opacity visual-hierarchy rule: dormant=50%, pending=70%, active=--primary — never overlapping values so states can't be confused"

key-files:
  created:
    - src/components/skills/SkillsInCategory.test.tsx
    - .planning/phases/100-control-surface-ux-menu-drag-lanes-optimistic-reconcile/deferred-items.md
  modified:
    - src/components/skills/SkillRow.tsx
    - src/components/skills/SkillRow.test.tsx
    - src/components/skills/AllSkillsOverview.test.tsx

key-decisions:
  - "Pending overlay reads from context (usePendingMove(skill.name)), not a new prop — every existing SkillRow call site keeps compiling unchanged"
  - "Pending bar mirrors CategoryGrid's active glow-bar geometry (absolute left-0 top-0 bottom-0 w-1) but in --status-info, never --primary, per D-05's honesty requirement"
  - "Task 2 audit found NO code gaps — SkillRow (Phase 98) already always renders SkillLifecycleMenu, so all three row surfaces get the same menu by construction; only test coverage gaps existed (AllSkillsOverview had none, SkillsInCategory had no test file at all)"
  - "QuickDeck's Run-default click gesture (Phase 99 D-02/D-03) is accepted as the 'reconciled' state with the row ⋯ menu's own Run submenu, not a menu-identity requirement"

patterns-established:
  - "Menu-render assertion convention: getByRole('button', { name: 'Skill actions for <displayName>' }) as the standard audit check per row surface"

requirements-completed: [UX-01, UX-03, UX-04]

# Metrics
duration: 25min
completed: 2026-07-24
---

# Phase 100 Plan 05: SkillRow Pending Overlay + ⋯ Menu/Cold-Storage Audit Summary

**SkillRow now shows a token-driven, context-read optimistic-pending treatment (70% opacity + pulsing --status-info bar) and reports the dragged skill for ScopeRail; audit confirms the ⋯ lifecycle menu is already consistent across every row surface and no /manage-skills dead-end remains.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-24T09:07:00Z (approx)
- **Completed:** 2026-07-24T09:13:00Z (approx)
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- `SkillRow` renders a visually distinct "pending, unconfirmed" state (opacity-70 + pulsing `--status-info` left-edge bar) that can never be confused with dormant (opacity-50) or active/selected (`--primary`) — reads from the Plan 02 `SkillControlSurfaceProvider` context, no new required prop.
- `SkillRow.onDragStart`/`onDragEnd` now report the dragged skill via `setDraggingSkill`, closing the wiring gap `ScopeRail` (Plan 03) needed to compute per-entry drop validity.
- UX-01/UX-04 completeness audit performed and closed: confirmed (not assumed) that every row surface renders the same scope-gated ⋯ menu and that the Cold Storage restore path has zero `/manage-skills` terminal dead-ends remaining anywhere in source.

## Task Commits

Each task was committed atomically:

1. **Task 1: SkillRow pending overlay (context) + dragging-skill reporting + test** - `0651ceb` (feat)
2. **Task 2: UX-01 menu-consistency + UX-04 no-manage-skills completeness audit** - `6fbc569` (test)

_Note: Task 2 is verification-first per the plan (D-06) — it produced only test additions, no production-code change, because the audit found no real gap in production code._

## Files Created/Modified
- `src/components/skills/SkillRow.tsx` - Reads `usePendingMove`/`useDraggingSkill` from context; renders the pending opacity-70 + `--status-info` pulsing bar; reports drag state on dragStart/dragEnd
- `src/components/skills/SkillRow.test.tsx` - 4 new tests: pending overlay present/absent, dormant-vs-pending distinctness, drag-state reporting
- `src/components/skills/AllSkillsOverview.test.tsx` - Added the missing ⋯ menu-render assertion
- `src/components/skills/SkillsInCategory.test.tsx` - New file (none existed before this plan); menu-render assertion plus back/empty-state/reassign-drop coverage
- `.planning/phases/100-control-surface-ux-menu-drag-lanes-optimistic-reconcile/deferred-items.md` - New file; logs an out-of-scope tsc finding from a concurrent unrelated session

## Decisions Made
See frontmatter `key-decisions`. Summary: context-read (no prop-drilling), distinct-opacity visual hierarchy, and an audit outcome of "no code gaps, only test-coverage gaps" for Task 2.

## Deviations from Plan

None — plan executed exactly as written. Task 2's audit genuinely found no production-code gap (SkillRow already always renders `SkillLifecycleMenu` since Phase 98), matching the plan's explicit "if the audit finds NO gaps... record that explicitly... do not invent changes" instruction. The only additions were test-coverage gaps (AllSkillsOverview had no menu-render assertion; SkillsInCategory had no test file at all), which the plan's acceptance criteria required closing regardless of the production-code audit outcome.

## Issues Encountered

`npx tsc --noEmit` surfaced 4 pre-existing `TS7006` errors in `src/pages/Inbox.tsx`, caused by a concurrent unrelated session's in-progress edit to `src/components/InboxFilterBar.tsx` (visible in `git status` as modified but not staged/committed by this plan). Out of scope per the executor's scope-boundary rule (only issues directly caused by this plan's own changes are auto-fixed) — logged to `deferred-items.md`, left untouched, not staged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 100 now has 4/5 plans executed (100-01, 100-02, 100-03, 100-05); only 100-04 (wiring `ScopeRail`'s drop handlers + `Skills.tsx` mount + real `enqueueLifecycle` dispatch, per its `depends_on` on 100-03) remains to close out UX-02 and complete the phase end-to-end. `SkillRow`'s pending overlay and drag reporting built in this plan are exactly the pieces 100-04 needs to wire a real drag-drop lifecycle mutation with honest optimistic UI.

---
*Phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile*
*Completed: 2026-07-24*
