---
phase: 124-shell-information-architecture
plan: 02
subsystem: ui
tags: [react, convex, useQuery, hooks, testing, vitest]

# Dependency graph
requires:
  - phase: 122-tokens-primitives-contrast-measurement
    provides: "the six-state MetricState vocabulary (TOKEN-04) and useMetricState's loading/empty/stale/ready classification that this plan's fix now composes correctly"
provides:
  - "An honest useAlertCounts() that returns undefined while loading instead of a fabricated all-zero shape"
  - "AlertBanner guarded against the undefined case before any arithmetic runs"
  - "Alerts.tsx with one alert-count subscription instead of two"
  - "A mutation-tested regression guard proving the loading case fails without the fix"
affects: [124-06 (shell inbox/alert badges — this plan removes what would have been the THIRD workaround site for the same defect)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A Convex-backed hook returns useQuery's raw undefined-while-loading result rather than defaulting it, per D-12 (122's TOKEN-04 extended to this hook); callers derive their own loading-safe display default locally, keeping the honesty at the hook boundary instead of re-fabricating it at each call site."

key-files:
  created: []
  modified:
    - src/hooks/useAlerts.ts
    - src/components/AlertBanner.tsx
    - src/pages/Alerts.tsx
    - src/components/__tests__/AlertBanner.test.tsx

key-decisions:
  - "D-12 (124-CONTEXT.md, amended 2026-08-21): fix useAlertCounts() at the hook, not at each call site — removes the defect class instead of adding a third workaround instance."

patterns-established:
  - "Pattern: when a Convex hook is made honest (undefined-while-loading), callers needing a concrete display value (e.g. a numeric MetricCard prop) derive a local `displayX = raw ?? <zeroed default>` next to the raw value, and pass the RAW value (not the defaulted one) into useMetricState so the loading truth still reaches the UI's state prop."

requirements-completed: [SHELL-01, SHELL-02]

# Metrics
duration: 6min
completed: 2026-08-21
---

# Phase 124 Plan 02: Fix useAlertCounts() Fabricated-Zero Defect Summary

**`useAlertCounts()` now returns Convex's raw `undefined`-while-loading result instead of `?? { info: 0, warning: 0, error: 0, critical: 0 }`; both real callers (AlertBanner, Alerts.tsx) were updated to guard on it, and Alerts.tsx's duplicate-query workaround for recovering the loading signal was collapsed into the single honest subscription.**

## Performance

- **Duration:** 6 min (10:37:17 → 10:41:54 UTC-04:00)
- **Started:** 2026-08-21T10:37:17-04:00
- **Completed:** 2026-08-21T10:41:54-04:00
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Removed the `?? { info: 0, ... }` fallback from `useAlertCounts()` — the hook's return type is now the honest `Query["_returnType"] | undefined`.
- `AlertBanner` returns `null` before any arithmetic runs on the counts, guarding the exact `counts.critical + counts.error` line that would otherwise throw.
- `Alerts.tsx` collapsed its two-subscription workaround (a duplicate raw `useQuery(api.alerts.countBySeverity)` that existed solely to recover the loading signal `useAlertCounts()` used to swallow) down to one subscription that feeds both `useMetricState`'s `state` and a locally-defaulted display object for the four `MetricCard` tiles.
- Added a mutation-tested regression test proving the loading guard is load-bearing: with the guard removed, the new test fails with `TypeError: Cannot read properties of undefined (reading 'critical')`; restored, all 7 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make useAlertCounts() honest and guard AlertBanner** - `3fdb9012` (fix)
2. **Task 2: Collapse the Alerts.tsx duplicate-query workaround** - `2534d016` (refactor)
3. **Task 3: Update the AlertBanner mock and assert the loading case** - `2d804aba` (test)

_No separate plan-metadata commit — this SUMMARY.md is the final commit for this plan._

## Files Created/Modified
- `src/hooks/useAlerts.ts` - `useAlertCounts()` returns `useQuery(...)` directly (no `??` default); added a docstring naming D-12
- `src/components/AlertBanner.tsx` - early `if (!counts) return null;` before the `urgentCount` computation
- `src/pages/Alerts.tsx` - single `useAlertCounts()` call feeds `useMetricState(counts, ...)` and a local `displayCounts` default for the four `MetricCard` tiles; deleted `countsRaw`
- `src/components/__tests__/AlertBanner.test.tsx` - new loading-case test (`mockReturnValue(undefined)` → no button, no text), with a comment distinguishing it from the pre-existing all-zero-resolved test

## Consumer Enumeration (success-criteria requirement)

Full-repo grep for `useAlertCounts|countBySeverity` over `src/`, `convex/`, `e2e/` (re-run at execution time, matches the plan's `<interfaces>` claim exactly — no other consumer exists):

- `src/hooks/useAlerts.ts:16` — the definition (fixed, Task 1).
- `src/components/AlertBanner.tsx:2,5` — guarded before arithmetic (Task 1).
- `src/pages/Alerts.tsx:5,141` — updated, duplicate query collapsed (Task 2).
- `src/components/__tests__/AlertBanner.test.tsx:6,9,12` — mock updated with the new loading-case test (Task 3).
- `convex/alerts.ts:109` — the query definition itself (untouched; out of scope, no backend change required by D-12's amendment).
- `e2e/` — zero matches.

Every consumer was updated or verified safe. No consumer was missed.

## Decisions Made
- Followed D-12 (124-CONTEXT.md, amended 2026-08-21) exactly: fixed the hook, not the call sites, per Larry's ruling recorded in the context doc.
- In Task 2, named the local display-default variable `displayCounts` (plan left the name to the executor) — it holds the same zeroed shape the hook used to fabricate, but now applied explicitly and locally at the one place (`MetricCard`'s required `value` prop) that needs a concrete number, while `useMetricState` still receives the raw, possibly-`undefined` `counts` so the loading truth reaches the tile via `state`.
- Reworded the Task 2 explanatory comment to avoid the literal string `useAlertCounts` a third time in the file — the plan's acceptance criterion (`grep -c "useAlertCounts" src/pages/Alerts.tsx` returns 2) would otherwise have been violated by a comment referencing the hook by name; the comment now describes the hook's prior behavior without repeating its identifier.

## Deviations from Plan

None (Rule 1/2/3 auto-fixes) — one wording adjustment to satisfy the plan's own acceptance criterion, documented above under Decisions Made. No scope creep, no architectural changes, no auth gates encountered.

## Issues Encountered

- **Full-suite `npm test` timeout in an unrelated file, confirmed pre-existing/flaky.** The final `npm test` run (5091 tests, 365 files) showed one failure: `src/App.test.tsx > App lazy routes (Phase 106 Plan 04, DEBT-03) > resolves '/memory' past its lazy boundary and renders the page`, timing out at the 25000ms test timeout. This test has no relationship to this plan's files (it renders a lazy-loaded `/memory` route via React Router, unrelated to alerts/hooks touched here). Re-running `npx vitest run src/App.test.tsx` in isolation immediately after: **all 20 tests passed in 5.97s**, including the `/memory` case, well under its timeout — confirming the failure was resource contention under the full 5091-test/365-file parallel run, not a real regression. This exact failure class is already named and explicitly deferred by this phase's own `124-CONTEXT.md` (`<deferred>` → "Reviewed todos (not folded)" → `vitest-suite-nondeterministic-one-random-failure-per-run.md` — "test-infrastructure flakes, unrelated to chrome"). Per the executor's SCOPE BOUNDARY rule (only auto-fix issues directly caused by the current task's changes), this was left untouched and is recorded here rather than fixed. All targeted verification (Task-level `tsc`/`vitest` runs, and `npx vitest run src/pages src/components/__tests__/AlertBanner.test.tsx` for Task 2) was 100% green with no flakiness observed.

## Test Output (recorded per plan `<verification>` requirement)

**Task 1** — `npx tsc --noEmit && npx vitest run src/components/__tests__/AlertBanner.test.tsx`:
```
Test Files  1 passed (1)
     Tests  6 passed (6)
```
(tsc showed 11 errors in `src/pages/Alerts.tsx` at this point — exactly the unguarded consumer Task 2 exists to fix; not silenced, fixed in the next task.)

**Task 2** — `npx tsc --noEmit && npx vitest run src/pages src/components/__tests__/AlertBanner.test.tsx`:
```
tsc: exit 0, no output
Test Files  29 passed | 2 skipped (31)
     Tests  297 passed | 9 todo (306)
```

**Task 3** — mutation test, guard removed (`npx vitest run src/components/__tests__/AlertBanner.test.tsx`):
```
Test Files  1 failed (1)
     Tests  1 failed | 6 passed (7)
 FAIL  ...AlertBanner.test.tsx > AlertBanner > renders nothing while counts are still loading (undefined)
 TypeError: Cannot read properties of undefined (reading 'critical')
  ❯ AlertBanner src/components/AlertBanner.tsx:9:30
```
Guard restored (`git diff -- src/components/AlertBanner.tsx` against the Task 1 commit: empty), re-run:
```
Test Files  1 passed (1)
     Tests  7 passed (7)
```

**Final plan-level verification:**
- `npx tsc --noEmit` — exit 0, no output.
- `npm test` (full suite) — 347 passed | 1 failed (unrelated flake, see Issues Encountered) | 17 skipped (365 files); 4893 passed | 1 failed | 197 todo (5091 tests). Isolated re-run of the one failing file: 20/20 passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The `useAlertCounts()` defect class is fully removed at the hook. Plan 124-06 (shell inbox/alert badges) can call the hook directly and guard on `undefined` per D-12/D-10 without needing a fourth workaround — this was the explicit purpose named in the plan's `<objective>`.
- No blockers. `.planning/STATE.md` and `.planning/ROADMAP.md` were intentionally left untouched per the orchestrator's shared-artifacts instruction.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
