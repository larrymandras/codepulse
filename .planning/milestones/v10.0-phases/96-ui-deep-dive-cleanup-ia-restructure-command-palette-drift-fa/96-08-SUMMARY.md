---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 08
subsystem: ui
tags: [react, meetingbot, skills, useRosterAgents, PageHeader, vitest]

# Dependency graph
requires:
  - phase: 96-01
    provides: "src/components/PageHeader.tsx (shared header component)"
provides:
  - "MeetingBot agent dropdown driven by useRosterAgents() live roster, replacing 6 hardcoded agent names"
  - "CategoryEditPopover delete button gated on canDelete (no dead disabled control in the create-category modal)"
  - "MeetingBot and Skills headers migrated to <PageHeader>"
affects: [meetingbot, skills, page-header-migration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Roster-driven <Select> dropdowns: agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>) sourced from useRosterAgents()"
    - "Conditional-render dead controls instead of disabling them (canDelete && <button>...</button>) when there is nothing to act on"

key-files:
  created:
    - src/pages/__tests__/MeetingBot.test.tsx
  modified:
    - src/pages/MeetingBot.tsx
    - src/pages/Skills.tsx
    - src/components/skills/CategoryEditPopover.tsx
    - src/components/skills/__tests__/CategoryEditPopover.test.tsx
    - src/pages/__tests__/Skills.test.tsx

key-decisions:
  - "MeetingBot's agentId state now initializes to empty string (was hardcoded 'freya'); Send Bot button additionally guards on !agentId to avoid submitting with no agent selected once the roster replaces the always-valid hardcoded default"
  - "CategoryEditPopover's delete button is removed from the DOM entirely when canDelete is false, rather than rendered disabled — applies uniformly whether reached via isNew or via canDelete=false on an existing category with skills"

patterns-established:
  - "Roster-driven Select pattern (WarRoom.tsx analog) now used by MeetingBot.tsx: import { useRosterAgents } from \"@/hooks/useRosterAgents\"; const { agents } = useRosterAgents();"

requirements-completed: [D-10, F9, F7]

# Metrics
duration: 25min
completed: 2026-07-13
---

# Phase 96 Plan 08: MeetingBot Live Roster + Skills Delete Affordance + Header Migration Summary

**MeetingBot's agent picker now reads the live Ástríðr roster via `useRosterAgents()` instead of 6 hardcoded names, and the Skills create-category modal no longer renders a permanently-disabled no-op delete button — both pages also adopt the shared `<PageHeader>`.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-13T14:26:20Z (approx, per plan wave start)
- **Completed:** 2026-07-13T14:47:44Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- MeetingBot's "Agent" `<Select>` is fully roster-driven (`agents.map(...)` from `useRosterAgents()`), removing the stale hardcoded freya/astrid/hervor/hildr/gondul/ragnhildr list (D-10/F9)
- `CategoryEditPopover`'s delete button is gated on `canDelete` and no longer renders at all when there's nothing to delete (D-10) — closes the dead no-op control in Skills' create-category modal
- MeetingBot and Skills both migrated from ad-hoc `<h1>` headers to `<PageHeader>` (F7)
- TDD RED→GREEN cycle: failing test written first against the hardcoded Select, then made to pass by wiring the live roster

## Task Commits

Each task was committed atomically:

1. **Task 1: RED test — MeetingBot dropdown reflects live roster** - `de125a4` (test)
2. **Task 2: Wire live roster + guard Skills delete affordance + headers** - `938244b` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/pages/__tests__/MeetingBot.test.tsx` - New test mocking `useRosterAgents` with a controllable roster; asserts roster-driven options and absence of hardcoded names (both populated and empty-roster cases)
- `src/pages/MeetingBot.tsx` - Imports `useRosterAgents`; replaces static `SelectItem`s with `agents.map(...)`; `agentId` now starts empty and Send Bot is guarded on `!agentId`; header migrated to `<PageHeader title="Meeting Bot" />`
- `src/components/skills/CategoryEditPopover.tsx` - Delete `<button>` wrapped in `{canDelete && (...)}` instead of `disabled={!canDelete}`
- `src/pages/Skills.tsx` - Terminal-style `<h1>` micro-header replaced with `<PageHeader title="Skills" className="mb-6" />`
- `src/components/skills/__tests__/CategoryEditPopover.test.tsx` - Updated "Delete button is disabled when canDelete is false" test to assert the button is not rendered at all (was: disabled)
- `src/pages/__tests__/Skills.test.tsx` - Updated page-title assertion from "Skills Database" to "Skills" to match the new `PageHeader`

## Decisions Made
- `agentId` default changed from a hardcoded `"freya"` to `""`; added a companion guard (`if (!agentId) { ... return; }` in `handleSendBot`, plus `disabled={... || !agentId}` on the Send Bot button) since the live roster may not resolve an agent synchronously and an empty selection must not silently submit (Rule 2 — missing validation this change would otherwise introduce)
- Existing tests that hardcoded assertions against the previous UI text/behavior (`"Skills Database"` header text, "Delete button is disabled") were updated in the same commit since they directly encode the exact UI surface this plan intentionally changes (in-scope fix, not deferred)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Guarded MeetingBot Send Bot against empty agentId**
- **Found during:** Task 2 (wiring live roster)
- **Issue:** Replacing the hardcoded, always-valid `agentId` default ("freya") with an empty string means the Send Bot flow could submit with no agent selected if the roster hasn't loaded yet or is empty
- **Fix:** Added an explicit `!agentId` check in `handleSendBot` (surfacing "Select an agent to send") and disabled the Send Bot button when `!agentId`
- **Files modified:** src/pages/MeetingBot.tsx
- **Verification:** `npx tsc --noEmit` clean; existing MeetingBot test suite unaffected (button/handler logic not exercised by the roster-focused new tests)
- **Committed in:** 938244b (Task 2 commit)

**2. [Rule 1 - Bug/test breakage from direct change] Updated Skills.test.tsx and CategoryEditPopover.test.tsx to match the intentional UI changes**
- **Found during:** Task 2 verification (`npx vitest run`)
- **Issue:** `Skills.test.tsx` asserted the literal old header text "Skills Database"; `CategoryEditPopover.test.tsx` asserted the delete button was rendered-but-disabled when `canDelete` is false — both are direct consequences of this plan's own changes (PageHeader migration, delete-button gating), not unrelated pre-existing tests
- **Fix:** Updated the title assertion to "Skills"; updated the delete-button test to assert `queryByText("Delete")` is absent instead of `toBeDisabled()`
- **Files modified:** src/pages/__tests__/Skills.test.tsx, src/components/skills/__tests__/CategoryEditPopover.test.tsx
- **Verification:** `npx vitest run` on both files passes
- **Committed in:** 938244b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 direct test update for in-scope UI change)
**Impact on plan:** Both changes were necessary consequences of the plan's own scope (roster wiring correctness; test assertions on the exact UI this plan changes). No scope creep beyond the plan's stated files.

## Issues Encountered
None beyond the deviations documented above.

## TDD Gate Compliance

Plan-level tasks used per-task `tdd="true"` (Task 1) rather than a plan-level `type: tdd`. Gate sequence verified in git log:
- RED: `de125a4 test(96-08): add failing test for MeetingBot live-roster dropdown` — confirmed both tests failed against the hardcoded Select before the fix (see Task 1 verification output)
- GREEN: `938244b feat(96-08): wire MeetingBot to live roster + guard Skills delete affordance + PageHeader (D-10/F9/F7)` — confirmed both tests pass after wiring `useRosterAgents()`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- MeetingBot, Skills, CategoryEditPopover are all committed and green (`npx vitest run` + `npx tsc --noEmit` clean)
- No stubs introduced; roster data comes from the same trusted `useRosterAgents()` source already used by WarRoom (no new Convex read path)
- No blockers for subsequent Phase 96 plans

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

All created/modified files verified present; both task commits (`de125a4`, `938244b`) verified in git log.
