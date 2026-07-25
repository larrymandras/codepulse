---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
plan: 01
subsystem: ui
tags: [react, typescript, skills, drag-and-drop, refactor, vitest]

# Dependency graph
requires:
  - phase: 98-skill-lifecycle-mutations
    provides: enqueueLifecycle mutation, SkillLifecycleMenu with the inline scope predicate this plan extracts
provides:
  - resolveLifecycleActions — single shared predicate for a skill row's scope-state (dormant/shadowed/multiScope/activeOrigin/moveDestinationIsProject)
  - resolveScopeDrop — pure discriminated-union decision encoding the complete drag matrix (noop/reject/dialog/enqueue), including the multi-scope reject case and the lane="cold" dormant+shadowed case
  - SkillLifecycleMenu refactored to consume resolveLifecycleActions instead of its own inline block
affects: [100-02, 100-03, 100-04, 100-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared pure predicate consumed by both the ⋯ menu and (in a later plan) the scope-rail drop handler, so the two paths cannot structurally diverge (D-02)"
    - "Discriminated-union return type (kind: noop|reject|dialog|enqueue) for a decision function, letting callers switch exhaustively without stringly-typed branching"

key-files:
  created: []
  modified:
    - src/lib/skills.ts
    - src/lib/skills.test.ts
    - src/components/skills/SkillLifecycleMenu.tsx
    - src/components/skills/SkillLifecycleMenu.test.tsx

key-decisions:
  - "resolveScopeDrop takes an optional lane param (default 'active') mirroring resolveLifecycleActions' own signature, so a drag originating from the Cold Storage rail can pass lane='cold' to reach the dormant+shadowed matrix cell — the only way that cell is reachable given isDormant/isShadowing are mutually exclusive on real origins data"
  - "Cold-target drops always noop regardless of shadow status (already cold) — the shadow-block only gates the global/project targets, not cold itself"
  - "Fixed the test file's isShadowing mock factory to also re-derive resolveLifecycleActions().shadowed through the same spy, since ESM same-module calls (resolveLifecycleActions -> isShadowing, both in skills.ts) are not intercepted by mocking only the module's isShadowing export"

patterns-established:
  - "Pattern: Extract a shared pure predicate/decision function BEFORE two independent code paths (menu, drag) need the same logic, rather than duplicating and hoping they stay in sync"

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 6min
completed: 2026-07-24
---

# Phase 100 Plan 01: Shared Scope Predicate + Drag Matrix Summary

**Extracted `resolveLifecycleActions` + added `resolveScopeDrop` (the full drag matrix) to `src/lib/skills.ts`, and refactored `SkillLifecycleMenu` to consume the former — making "menu and drag agree" a structural guarantee instead of a convention.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-24T08:44:00-04:00 (approx.)
- **Completed:** 2026-07-24T08:50:06-04:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `resolveLifecycleActions(skill, lane)` reproduces `SkillLifecycleMenu.tsx`'s former inline predicate exactly, exported with its `LifecycleActionState` result type
- `resolveScopeDrop(skill, targetScope, lane)` encodes the complete drag matrix (active-global, active-project, dormant, dormant+shadowed, multi-scope) as a pure discriminated union — delete is structurally impossible to return (D-04)
- `SkillLifecycleMenu.tsx` now derives its scope-state from a single call to `resolveLifecycleActions`, deleting the duplicated inline block
- 24 new unit tests (6 parity fixtures against the 5 canonical `SkillLifecycleMenu.test.tsx` shapes + 18 drag-matrix cells); existing 30-test `SkillLifecycleMenu.test.tsx` suite passes unmodified in its assertions
- Full suite verified green: 2470 tests passed, 0 failed; `tsc --noEmit` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add resolveLifecycleActions + resolveScopeDrop to src/lib/skills.ts with parity + matrix tests** - `f2845cf` (feat)
2. **Task 2: Refactor SkillLifecycleMenu to consume resolveLifecycleActions (behavior-preserving)** - `4399533` (refactor)

## Files Created/Modified
- `src/lib/skills.ts` - Added `resolveLifecycleActions` + `resolveScopeDrop` (+ their `LifecycleActionState`/`ScopeDropResult` types)
- `src/lib/skills.test.ts` - Added parity tests (5 fixtures) + full drag-matrix cell tests (18 cases across 5 source-state groups)
- `src/components/skills/SkillLifecycleMenu.tsx` - Replaced the inline scope predicate with a call to `resolveLifecycleActions`
- `src/components/skills/SkillLifecycleMenu.test.tsx` - Updated the `isShadowing` mock factory to also re-derive `resolveLifecycleActions().shadowed` through the same spy (see Deviations)

## Decisions Made
- `resolveScopeDrop` accepts an optional `lane` parameter (default `"active"`) so a future Cold Storage drag caller can pass `lane="cold"` — this is the only way the "dormant && shadowed" matrix cell is reachable, since `isDormant`/`isShadowing` are mutually exclusive on real (non-lane-forced) origins data, mirroring the existing WR-04 convention in `SkillLifecycleMenu.tsx`.
- Cold-target drops always resolve to `noop` regardless of shadow status (a row already in cold storage has nowhere shorter to go); the shadow-block only applies to the global/project targets.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock plumbing broke after the refactor; fixed the mock, not the assertions**
- **Found during:** Task 2 (SkillLifecycleMenu refactor)
- **Issue:** `SkillLifecycleMenu.test.tsx` mocks `@/lib/skills` and spies on `isShadowing` to fake a `shadowed=true` state for a plain dormant fixture (since real data can't naturally produce dormant+shadowed under the default lane). Before this plan, `SkillLifecycleMenu.tsx` called `isShadowing` directly, so the mocked export was hit. After the refactor, the menu calls `resolveLifecycleActions`, which internally calls the REAL (unmocked) `isShadowing` — ESM same-module function-to-function calls are not routed through an externally-mocked export, so the spy's `mockReturnValue(true)` had no effect and 2 tests failed (Restore rendered enabled instead of disabled+tooltip).
- **Fix:** Updated the mock factory to also override `resolveLifecycleActions` so its returned `shadowed` field is re-derived from the same `isShadowing` spy, while every other field still comes from the real implementation. No test assertions were changed — only the mock's internal wiring.
- **Files modified:** `src/components/skills/SkillLifecycleMenu.test.tsx`
- **Verification:** `npx vitest run src/components/skills/SkillLifecycleMenu.test.tsx` — 30/30 passing, assertions byte-identical to before this plan.
- **Committed in:** `4399533` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — test mock plumbing)
**Impact on plan:** Necessary to satisfy the plan's own acceptance criterion ("existing test suite passes with ZERO changes to the test file's assertions"). No scope creep — no production behavior changed, only test scaffolding.

## Issues Encountered
- Initial `resolveScopeDrop` implementation checked `shadowed` before `targetScope === "cold"`, causing the dormant+shadowed→cold cell to incorrectly return `reject` instead of `noop`. Caught by the plan's own matrix-cell unit tests during Task 1 (before commit) — reordered the `cold`-target short-circuit ahead of the shadow check, per the plan's explicit spec ("dormant && shadowed: ... →cold = noop").

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `resolveLifecycleActions` and `resolveScopeDrop` are exported and unit-tested, ready for Plan 100-02+ (the scope-rail drop handler, pending-state reconciliation) to import and call directly — no duplication needed.
- `resolveScopeDrop`'s `lane` parameter is ready for the Cold Storage rail's drag caller in a later plan.
- No blockers.

## Self-Check: PASSED

- FOUND: src/lib/skills.ts
- FOUND: src/components/skills/SkillLifecycleMenu.tsx
- FOUND: .planning/phases/100-control-surface-ux-menu-drag-lanes-optimistic-reconcile/100-01-SUMMARY.md
- FOUND: f2845cf (Task 1 commit)
- FOUND: 4399533 (Task 2 commit)
- FOUND: 3377e4f (Summary commit)

---
*Phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile*
*Completed: 2026-07-24*
