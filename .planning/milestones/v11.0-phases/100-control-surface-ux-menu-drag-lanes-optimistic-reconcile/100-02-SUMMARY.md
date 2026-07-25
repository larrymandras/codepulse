---
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
plan: 02
subsystem: ui
tags: [react, hooks, context, convex, optimistic-ui, skills]

# Dependency graph
requires:
  - phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
    provides: "resolveLifecycleActions/resolveScopeDrop shared drag-matrix predicate (100-01, src/lib/skills.ts)"
  - phase: 98-skill-lifecycle-mutations
    provides: "useLifecycleCommands()/lifecycleRefusalMessage (src/hooks/useLifecycle.ts), enqueueLifecycle Convex mutation"
provides:
  - "usePendingLifecycleMoves(): commandId-correlated pending map + status-aware reconcile against server truth"
  - "SkillControlSurfaceProvider + reader hooks (useSkillControlSurface/usePendingMove/useDraggingSkill)"
affects: ["100-03 (ScopeRail drop handler)", "100-04 (enqueueLifecycle wiring + LAYER-1 catch)", "100-05 (SkillRow drag source + dragging identity)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "commandId-keyed reconcile effect (ported from useIntakeFeed.ts:95-100), made status-aware instead of pure dedupe"
    - "React context with safe out-of-provider defaults (no-op setters, empty/null state) so consumers render harmlessly in isolation"

key-files:
  created:
    - src/hooks/usePendingLifecycleMoves.ts
    - src/hooks/usePendingLifecycleMoves.test.ts
  modified: []

key-decisions:
  - "Both tasks (pending-map hook + provider/reader hooks) landed in one feat commit — they share the same file by design (plan keeps client-surface state colocated) and the test file already covered both tasks' acceptance criteria together."
  - "Provider/context code uses React.createElement instead of JSX so the file could stay a plain .ts (matching the plan's literal file list) rather than requiring a .tsx extension."
  - "Reconcile effect depends only on useLifecycleCommands() (mirrors useIntakeFeed's [serverCommands] discipline) — beginPending/clearPending read/write via the setState updater form so they never need to be effect dependencies themselves."

patterns-established:
  - "Status-aware reconcile: done clears silently, failed/expired clear + toast (real refusal copy / reused literal expiry copy), queued/executing left alone — the template other optimistic-command hooks in this phase should follow."

requirements-completed: [UX-03]

# Metrics
duration: 15min
completed: 2026-07-24
---

# Phase 100 Plan 02: Pending Lifecycle Moves + Control-Surface Context Summary

**Client-only optimistic pending-move map correlated by commandId (not skillName) with status-aware reconcile against `useLifecycleCommands()`, exposed alongside a transient dragging-skill identity via one `SkillControlSurfaceProvider` context.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-24T12:53:00Z (approx.)
- **Completed:** 2026-07-24T12:58:47Z
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `usePendingLifecycleMoves()` — a `Record<skillName, PendingMove>` map keyed by skillName but correlated by `commandId`, with a reconcile effect that clears silently on `done`, clears + toasts on `failed` (via `lifecycleRefusalMessage`) and `expired` (reused literal copy), and leaves `queued`/`executing` entries untouched.
- `clearPending` exposes the LAYER-1 synchronous-rejection `.catch()` path (Pitfall 3) — no reliance on a `forgeCommands` row that never gets created.
- `SkillControlSurfaceProvider` hosts the pending map plus a transient `draggingSkill` identity behind one context; `usePendingMove`/`useDraggingSkill`/`useSkillControlSurface` reader hooks degrade to safe no-op defaults outside a provider.
- 10/10 tests green (7 reconcile cases + 2 provider/context cases, including the no-provider-safe-default case), full suite (212 files / 2480 tests) green, `tsc --noEmit` clean.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **RED — failing tests for both tasks** - `0506693` (test)
2. **GREEN — hook + provider implementation** - `40768d0` (feat) — covers both Task 1 (pending map + reconcile) and Task 2 (provider + reader hooks); both tasks share the same file by design and the RED commit already tested both.

_TDD gate sequence confirmed: `test(100-02)` commit precedes `feat(100-02)` commit in git log; no regressions introduced._

## Files Created/Modified
- `src/hooks/usePendingLifecycleMoves.ts` - `usePendingLifecycleMoves()` hook (pending map, beginPending/clearPending, status-aware reconcile), `SkillControlSurfaceProvider`, and reader hooks `useSkillControlSurface`/`usePendingMove`/`useDraggingSkill`.
- `src/hooks/usePendingLifecycleMoves.test.ts` - renderHook coverage: beginPending, done/queued/executing/failed/expired reconcile, commandId-precision (Pitfall 1), clearPending LAYER-1 path, plus provider/consumer + no-provider-default context cases.

## Decisions Made
- Landed Task 1 and Task 2 in a single GREEN commit since they target the identical file (the plan explicitly keeps this state colocated) and the RED test commit already exercised both tasks' acceptance criteria together — splitting the implementation commit would have required an artificial partial-file checkpoint with no test-verifiable intermediate state.
- Used `React.createElement` instead of JSX in both the implementation and test files so `usePendingLifecycleMoves.ts`/`.test.ts` could stay `.ts` (matching the plan's literal `files_modified` list) rather than requiring a `.tsx` extension purely for the Provider component and one test harness component.
- Kept the reconcile-effect dependency array to `[lifecycleCommands]` only (mirrors `useIntakeFeed.ts`'s `[serverCommands]` discipline) — `beginPending`/`clearPending` read the latest `pending` state via the `setState` updater form, so they never need to appear in the effect's own dependency list.

## Deviations from Plan

None - plan executed exactly as written. One implementation-detail correction during self-verification: an early comment referenced the literal string `latestLifecycleForSkill` (explaining why reconciliation avoids it), which caused the acceptance-criteria grep (`grep -c "latestLifecycleForSkill" ... returns 0`) to fail at 1. Reworded the comment to describe the same fact without repeating the literal helper name — no behavior change, verified the grep now returns 0 and all 10 tests still pass.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `usePendingLifecycleMoves`/`SkillControlSurfaceProvider` are ready for Plan 03 (ScopeRail drop handler, which will call `resolveScopeDrop` from 100-01 and then `beginPending`/`clearPending` here), Plan 04 (wiring `enqueueLifecycle` + the LAYER-1 `.catch()` path to `clearPending`), and Plan 05 (`SkillRow.onDragStart`/`onDragEnd` wiring `setDraggingSkill`).
- No blockers. Codepulse-only, frontend-focused — no daemon/Convex mutation was needed for this plan, matching the plan's own scope note.

---
*Phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile*
*Completed: 2026-07-24*
