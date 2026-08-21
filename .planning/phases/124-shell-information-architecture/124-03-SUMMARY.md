---
phase: 124-shell-information-architecture
plan: 03
subsystem: api
tags: [convex, alerts, query-bounding, dos-mitigation]

requires:
  - phase: 124-shell-information-architecture (plan 02)
    provides: "useAlertCounts() returns raw undefined while loading instead of a fabricated zeroed shape (D-12)"
provides:
  - "alerts.countBySeverity reads at most ALERT_COUNT_SCAN_CAP (2000) documents via .order(desc).take() on the existing by_acknowledged index, instead of an unbounded .collect()"
  - "countBySeverity's return shape extended with truncated: boolean, true when the take hit the cap"
  - "convex/alertsCountBounded.test.ts — recording-db test asserting on the recorded index/limit, not just returned counts, mutation-proven to fail when the bound is removed"
affects: [124-06, 124-08]

tech-stack:
  added: []
  patterns:
    - "Recording-db Convex handler test (makeRecordingDb + (fn as any)._handler({db}, {})), copied from convex/heroStats.test.ts, now has a second live instance"

key-files:
  created:
    - convex/alertsCountBounded.test.ts
  modified:
    - convex/alerts.ts
    - src/components/__tests__/AlertBanner.test.tsx

key-decisions:
  - "Cap set to 2000 (ALERT_COUNT_SCAN_CAP), matching the plan's chosen ceiling — ~20x the entire current alerts table (102 rows, 1 unacknowledged, measured live 2026-08-21)."
  - "Return shape extended, never narrowed: existing info/warning/error/critical keys unchanged, truncated added as a fifth key."
  - "No schema change: confirmed live that convex/schema.ts's alerts table has no [\"acknowledged\",\"severity\"] composite index, so a per-severity bucketed count is out of scope for this presentation-only phase, per the plan."

patterns-established:
  - "A public Convex aggregate-count query that cannot use a narrow index should cap via .take(N) plus an honest truncated flag rather than .collect(), following the same shape as heroStats's bounded reads."

requirements-completed: [SHELL-01, SHELL-02]

duration: 25min
completed: 2026-08-21
---

# Phase 124 Plan 03: Bound alerts.countBySeverity Summary

**`alerts.countBySeverity` now reads at most 2000 documents via `.order("desc").take(ALERT_COUNT_SCAN_CAP)` on the existing `by_acknowledged` index instead of an unbounded `.collect()`, and returns an honest `truncated: boolean` alongside its four existing severity keys, locked in by a recording-db test that fails when the bound is removed.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Replaced `countBySeverity`'s unbounded `.collect()` over unacknowledged alerts with `.order("desc").take(ALERT_COUNT_SCAN_CAP)` on the same `by_acknowledged` index, with `ALERT_COUNT_SCAN_CAP = 2000`.
- Extended the return shape with `truncated: boolean` (true exactly when the take returned the full cap), without renaming or removing `info`/`warning`/`error`/`critical`.
- Added a code comment recording the live population measurement, the index shape, why a bucketed count is out of scope, and why `truncated` exists (D-13, D-12 honesty rule).
- Created `convex/alertsCountBounded.test.ts` (153 lines): 5 tests, asserting on the recorded index/eq-bound/limit (not just returned counts), both sides of the cap boundary, and the pre-existing resolved-row exclusion rule.
- Mutation-proved the guard: reverted `.take()` to `.collect()`, confirmed the bound assertion fails with a genuine assertion error naming the null limit, reverted, confirmed green again, confirmed `git diff -- convex/alerts.ts` was empty afterward (verified against the Task 1 commit).
- Fixed a `tsc --noEmit` break in `src/components/__tests__/AlertBanner.test.tsx` caused directly by extending the return shape (Rule 3 — the mocked return type is inferred from Convex codegen, so the six existing `mockReturnValue({...4 keys...})` calls needed `truncated: false` added).

## Task Commits

Each task was committed atomically:

1. **Task 1: Bound the read and surface truncation** - `a6d3c26` (fix) — `convex/alerts.ts`, `src/components/__tests__/AlertBanner.test.tsx`
2. **Task 2: Recording-db test proving the read is bounded and truncation is honest** - `a35221a` (test) — `convex/alertsCountBounded.test.ts`

Both commits verified clean with `git show --stat HEAD` immediately after committing — each touched exactly the files intended, nothing swept in from a concurrent session.

## Files Created/Modified
- `convex/alerts.ts` — `countBySeverity` bounded; `ALERT_COUNT_SCAN_CAP` constant + comment added.
- `convex/alertsCountBounded.test.ts` — new recording-db test file (5 tests).
- `src/components/__tests__/AlertBanner.test.tsx` — added `truncated: false` to 6 existing `mockUseAlertCounts.mockReturnValue({...})` calls to satisfy the extended (Convex-codegen-inferred) return type.

## Consumer grep (acceptance criterion)

Full-repo grep for `countBySeverity` (already run above during context-gathering) and separately for `useAlertCounts`, re-run at execution time:

```
$ grep -rn "countBySeverity" src/ convex/
src\hooks\useAlerts.ts:25:  return useQuery(api.alerts.countBySeverity);
```

Only one call site: `src/hooks/useAlertCounts()` in `src/hooks/useAlerts.ts:25`, which returns the raw query result (per plan 124-02's D-12 fix — no destructuring, no default object). Its two real consumers:

- `src/components/AlertBanner.tsx:5,13,27,31,33,36,38` — accesses `counts.critical` and `counts.error` by name only. No `Object.keys`/`Object.entries`/spread-and-enumerate anywhere in the file.
- `src/pages/Alerts.tsx:141,143,166-169` — `const displayCounts = counts ?? {info:0,warning:0,error:0,critical:0}; ... displayCounts.critical / .error / .warning / .info`, all named access. The 4-key literal fallback used for the loading case is unaffected by extending the real result's shape.
- `src/components/__tests__/AlertBanner.test.tsx` — mocks the hook's return value directly (fixed, see above); not a runtime consumer.

No consumer enumerates the result's keys. The additive `truncated` field is safe for all three.

## Mutation proof (verbatim)

**Before mutation (Task 2's committed state), green:**
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

**After mutating `.take(ALERT_COUNT_SCAN_CAP)` back to `.collect()`:**
```
 ❯ |unit| convex/alertsCountBounded.test.ts (5 tests | 1 failed) 7ms
     × reads the alerts table via by_acknowledged with an eq(acknowledged, false) bound and a bounded, non-null limit 5ms

 FAIL  convex/alertsCountBounded.test.ts > ... > reads the alerts table via by_acknowledged with an eq(acknowledged, false) bound and a bounded, non-null limit
AssertionError: expected null not to be null
 ❯ convex/alertsCountBounded.test.ts:103:27
    101|     // The regression this test exists to catch: a surviving .collect(…
    102|     // record limit === null here.
    103|     expect(use.limit).not.toBeNull();

 Test Files  1 failed (1)
      Tests  1 failed | 4 passed (5)
```
A genuine assertion failure naming the null limit — not a module-resolution or type error.

**After reverting the mutation:**
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
`git diff -- convex/alerts.ts` after the revert was empty (compared against the Task 1 commit `a6d3c26`), confirming the file returned to exactly its intended state.

## Decisions Made
- `ALERT_COUNT_SCAN_CAP = 2000` as specified by the plan, documented in-code with the live population measurement and index-shape rationale.
- Confirmed live (this pass) that `convex/schema.ts:128-131`'s `alerts` table indexes are exactly `by_severity`, `by_acknowledged`, `by_source`, `by_status` — no `["acknowledged","severity"]` composite — so a bucketed per-severity count remains out of scope, matching the plan's `<interfaces>` claim.
- Extended (not narrowed) the return shape, verified safe via the consumer grep above before making the change, per the plan's acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed AlertBanner.test.tsx mocks broken by the extended return type**
- **Found during:** Task 1 (`npx tsc --noEmit` verification step)
- **Issue:** `mockUseAlertCounts.mockReturnValue({...})`'s type is inferred from `api.alerts.countBySeverity`'s Convex-codegen return type. Extending `countBySeverity`'s return shape with `truncated: boolean` made all 6 existing 4-key mock literals in `src/components/__tests__/AlertBanner.test.tsx` fail type-checking (`Property 'truncated' is missing`).
- **Fix:** Added `truncated: false` to each of the 6 `mockReturnValue({...})` calls. No behavioral or assertion change — `AlertBanner.tsx` never reads `truncated`.
- **Files modified:** `src/components/__tests__/AlertBanner.test.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run src/components/__tests__/AlertBanner.test.tsx` — 7/7 passed.
- **Committed in:** `a6d3c26` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary consequence of the plan's own required change (extend the return shape). No scope creep — no new consumer behavior added, only the mock literals updated to satisfy the now-stricter inferred type.

## Issues Encountered
None beyond the deviation above.

## No deploy

No `npx convex deploy`, `convex dev --once`, or any command with `--push`/`--prod` was run at any point in this plan. Verification was unit-test-only (`npx tsc --noEmit`, `npx vitest run convex/alertsCountBounded.test.ts`, `npx vitest run convex/`, `npx vitest run src/components/__tests__/AlertBanner.test.tsx`).

## STATE.md / ROADMAP.md

Not modified by this executor — per the orchestrator's `<shared_artifacts>` instruction, `.planning/STATE.md` and `.planning/ROADMAP.md` are owned centrally and updated after the wave.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `countBySeverity`'s bounded read and `truncated` flag are ready for plan 124-06 (sidebar Alerts badge) and plan 124-08 (system chip), both of which already reference this plan's output in their own `<interfaces>` sections.
- No blockers. `npx vitest run convex/` (85 files, 1672 tests) and `npx tsc --noEmit` both green after this plan's changes.

---
*Phase: 124-shell-information-architecture*
*Completed: 2026-08-21*
