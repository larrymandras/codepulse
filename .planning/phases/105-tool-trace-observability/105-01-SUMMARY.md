---
phase: 105-tool-trace-observability
plan: 01
subsystem: api
tags: [convex, toolExecutions, llmMetrics, trace-waterfall, dos-mitigation, read-caps]

requires: []
provides:
  - "Bounded, truncation-honest reads on convex/toolExecutions.ts (listBySession, successRate, avgDuration, recentExecutions) and convex/llm.ts (sessionCalls) — no unbounded .collect()"
  - "excludeByProvider() pure helper + excludeProvider arg wired through ToolExecutionPanel and PermissionDecisionsChart (D-15 zero-regression, D-02 scoping)"
  - "D-12 truncation banner in TraceWaterfall, token-driven, no fabricated total"
  - "convex/toolExecutions.test.ts (Wave 0 gap closed)"
affects: [105-02, 105-03, 105-04, 105-05, 105-06]

tech-stack:
  added: []
  patterns:
    - "Bounded-read-with-truncation-flag: { rows|tools, truncated, cap } instead of a bare array from .collect()"
    - "Exclude-filter (not include-filter) for provider scoping — never assume an optional field is always set"
    - "Cap hit keeps the MOST RECENT N rows: read descending + take(cap) + reverse, not order(asc) + take(cap)"

key-files:
  created:
    - convex/toolExecutions.test.ts
    - src/components/PermissionDecisionsChart.test.tsx
  modified:
    - convex/toolExecutions.ts
    - convex/llm.ts
    - src/pages/SessionDetail.tsx
    - src/components/TraceWaterfall.tsx
    - src/components/TraceWaterfall.test.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/PermissionDecisionsChart.tsx
    - convex/llm.test.ts

key-decisions:
  - "Fixed a plan-snippet defect: 'keep order(\"asc\")' on a capped read would silently drop the MOST RECENT rows, not the oldest — inverted to order(\"desc\").take(cap).reverse() for both sessionCalls and listBySession, matching 105-UI-SPEC.md's 'Showing the most recent {cap}' truncation copy"
  - "successRate/avgDuration truncation is computed from the RAW read count (before excludeByProvider), matching the plan's acceptance criteria point 5 — mutation-verified with an all-astridr cap-sized fixture"
  - "avgDuration bounded but left with zero consumers (F4) — flagged below as a Phase-106 dead-code candidate, not deleted (104-08 getBudgetConfig deploy-order precedent)"
  - "convex/ingest.ts:168 PostToolUseFailure's missing provider field (F6) left unfixed — out of scope, and touching it would alter the exact baseline the D-15 control test asserts against"

requirements-completed: [OBS-01, OBS-03]

duration: 40min
completed: 2026-08-03
---

# Phase 105 Plan 01: Bound Unbounded toolExecutions/llm Reads + D-15 Exclude-Filter Summary

**Four previously-unbounded `toolExecutions`/`llm` Convex queries now cap reads with an explicit exported constant and report `truncated` honestly; `ToolExecutionPanel`/`PermissionDecisionsChart` gained a D-15 exclude-filter (`excludeProvider: "astridr"`) proven byte-identical to today's output via a two-run control test; `TraceWaterfall` renders a token-driven truncation banner with no fabricated total.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-08-03T22:20:28Z
- **Completed:** 2026-08-03T22:55:16Z
- **Tasks:** 3 (all `type="auto"`, Tasks 1 and 3 `tdd="true"`)
- **Files modified:** 10 (8 modified, 2 created)

## Accomplishments

- Replaced every `.collect()` in `convex/toolExecutions.ts` with a `.take(CAP)` bounded read; `listBySession`, `successRate`, and `avgDuration` now return `{ rows|tools, truncated, cap }` instead of a bare array
- `convex/llm.ts`'s `sessionCalls` bounded to `SESSION_CALLS_READ_CAP = 1000`, same `{ rows, truncated, cap }` contract
- Added `excludeByProvider()` — an EXCLUDE filter (never an include filter) that is provably a no-op regression for today's two consumer panels
- `TraceWaterfall` renders a `var(--status-warn)`-tinted truncation banner only when the cap was hit, with the UI-SPEC's honest wording (no `{total}` clause — F2)
- Closed the Wave 0 gap: `convex/toolExecutions.test.ts` now exists (11 tests) alongside 5 new `convex/llm.test.ts` cases, a new `PermissionDecisionsChart.test.tsx`, and 2 new `TraceWaterfall.test.tsx` cases — 18 new assertions total
- Every new/changed test mutation-verified against real production code (see Deviations/Verification below)

## Task Commits

Each task was committed atomically:

1. **Task 1: Bound the four unbounded toolExecutions/llm reads and add excludeProvider** - `355130a8` (feat)
2. **Task 2: Update the four consumers and render the D-12 truncation notice** - `9b894be8` (feat)
3. **Task 3: Tests — caps, truncation, and the D-15 zero-regression CONTROL** - `802ac520` (test)

## Files Created/Modified

- `convex/toolExecutions.ts` - `excludeByProvider()`, `SESSION_TOOLS_READ_CAP`/`TOOL_WINDOW_READ_CAP`/`RECENT_SCAN_CAP` exported constants; `listBySession`/`successRate`/`avgDuration`/`recentExecutions` bounded
- `convex/llm.ts` - `SESSION_CALLS_READ_CAP` exported constant; `sessionCalls` bounded, returns `{ rows, truncated, cap }`
- `convex/toolExecutions.test.ts` - NEW. `excludeByProvider` unit tests, D-15 control + negative control, cap/truncation boundary tests using the real imported constants
- `src/pages/SessionDetail.tsx` - reads `listBySession(...).rows`; `SectionErrorBoundary name="Trace"` mount left byte-unchanged (F3)
- `src/components/TraceWaterfall.tsx` - destructures `{ rows, truncated, cap }`; renders the D-12 truncation banner
- `src/components/TraceWaterfall.test.tsx` - updated pre-existing mocks to the new object shape; added 2 truncation-banner tests
- `src/components/ToolExecutionPanel.tsx` - `excludeProvider: "astridr"` on both queries; `successRate` read via `.tools`
- `src/components/PermissionDecisionsChart.tsx` - `excludeProvider: "astridr"` on `recentExecutions`
- `src/components/PermissionDecisionsChart.test.tsx` - NEW. Asserts the `excludeProvider` arg is passed
- `convex/llm.test.ts` - `sessionCallsLogic` mirror extended to the new shape + boundary/most-recent-kept tests

## Decisions Made

- **Read direction fix (Rule 1 bug, not in the plan's literal snippet):** The plan's Task 1 action text said to keep `sessionCalls`'s existing `.order("asc")` while adding `.take(cap)`. Verified live against 105-UI-SPEC.md's Copywriting Contract ("Showing the most recent {cap}...") that this would be backwards — capping an ascending-ordered scan keeps the OLDEST rows and silently drops the newest ones, the opposite of "most recent". Fixed both `sessionCalls` and `listBySession` to read in descending order, `.take(cap)`, then reverse back to ascending before returning — preserves the existing ascending consumer contract while making the truncation banner's copy literally true. Mutation-verified: reverting the mirror's `truncated` computation broke the "keeps the MOST RECENT cap rows" test (see Verification).
- **`successRate`/`avgDuration` truncation computed from the raw read, before `excludeByProvider`** — matches acceptance criteria point 5 exactly; a fixture of `TOOL_WINDOW_READ_CAP` all-astridr rows returns `truncated: true` with `tools: []`, proving the cap was hit at the read layer, not silently swallowed by the filter.
- **`avgDuration` bounded despite zero live consumers (F4)** — grepped `src/` again post-change, confirmed still zero call sites of `api.toolExecutions.avgDuration`. Left deployed (not deleted) per the established 104-08 `getBudgetConfig` deploy-order precedent. **Flagged as a Phase-106 dead-code candidate.**
- **`convex/ingest.ts:168`'s `PostToolUseFailure` case still omits `provider` (F6)** — confirmed still true, left unfixed by direction. This is precisely the row shape the D-15 control test's fixture exercises (a `provider: undefined` row), so fixing it here would have invalidated the very baseline the control proves against.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the plan's literal read-direction snippet, which would have inverted the truncation semantics**
- **Found during:** Task 1 (bounding `sessionCalls`/`listBySession`)
- **Issue:** Plan text said "keep the existing `by_session` index, `.order("asc")`" while adding `.take(cap)`. On an ascending-ordered index, `.take(cap)` returns the FIRST cap rows chronologically (the oldest), not the most recent — contradicting 105-UI-SPEC.md's truncation-banner copy ("Showing the most recent {cap}") and D-12's stated honesty goal.
- **Fix:** Both queries now read in `order("desc")`, `.take(cap)`, then `.slice().reverse()` before returning — the caller still receives ascending-ordered rows, but a cap hit now drops the OLDEST rows instead of the newest.
- **Files modified:** convex/llm.ts, convex/toolExecutions.ts
- **Verification:** New tests assert `Math.min(...timestamps)` equals the count of dropped rows (i.e., the oldest N were dropped, not the newest); mutation-verified by forcing `truncated = false` in the mirror function — both new boundary tests failed as expected, then restored.
- **Committed in:** `355130a8` (Task 1 commit), test coverage in `802ac520` (Task 3 commit)

**2. [Rule 1 - Bug] Comment text tripped the file's own acceptance-criteria grep**
- **Found during:** Task 1, self-check before commit
- **Issue:** Doc comments explaining "the previous unbounded `.collect()`" contained the literal substring `.collect()`, which the plan's own acceptance criterion (`grep -n "\.collect()" convex/toolExecutions.ts` → zero matches) would then flag as a false positive.
- **Fix:** Reworded both comments to describe the old shape in prose ("an unbounded full-table read") without the literal pattern.
- **Files modified:** convex/toolExecutions.ts, convex/llm.ts
- **Verification:** `grep -n "\.collect()" convex/toolExecutions.ts` returns zero matches; `sed -n '119,152p' convex/llm.ts | grep -c "collect()"` returns 0.
- **Committed in:** `355130a8` (Task 1 commit)

**3. [Rule 1 - Bug] Updated pre-existing `TraceWaterfall.test.tsx` mocks to the new query shape**
- **Found during:** Task 2, running the test file per the task's own `<verify>` step
- **Issue:** Three pre-existing tests called `mockUseQuery.mockReturnValue(rows)` (a bare array) against a component that now expects `{ rows, truncated, cap }`. Without updating them, Task 2's own verify step (`npx vitest run src/components/TraceWaterfall.test.tsx`) would fail.
- **Fix:** Updated all three `mockReturnValue` calls to `{ rows, truncated: false, cap: 1000 }`.
- **Files modified:** src/components/TraceWaterfall.test.tsx
- **Verification:** `npx vitest run src/components/TraceWaterfall.test.tsx` — 20/20 passing (later 22/22 after Task 3's additions).
- **Committed in:** `9b894be8` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs introduced or exposed by this plan's own change, none scope creep).
**Impact on plan:** All three fixes were necessary for correctness; #1 in particular corrects a real behavioral inversion that would have shipped a truncation banner claiming to show "the most recent N" while actually showing the oldest N.

## Issues Encountered

- **Mutation-testing `SESSION_CALLS_READ_CAP` directly was a confound.** Initially mutated the constant's value (1000→2000) expecting the new boundary tests to fail; they didn't, because the tests import the same constant to build their fixtures (a self-scaling, relative-boundary design — legitimate, not a bug). Switched to mutating the mirror function's own truncation-computation logic instead, which correctly failed under mutation. Documented for future executors touching this file.
- Otherwise none — plan executed with the corrections noted above.

## User Setup Required

None - no external service configuration required. This plan touches only Convex queries and their React consumers; no new environment variables, no deploy required for the unit-test verification performed here (the plan's own `<verification>` section lists `npm run build` and `npx vitest run`, both run and green — it does not require a live `npx convex deploy`).

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0.

`npx vitest run` (full suite):
```
Test Files  258 passed | 17 skipped (275)
     Tests  3176 passed | 193 todo (3369)
```

`npm run build` — succeeded (`✓ built in 1.29s`); pre-existing >500kB chunk-size warning unrelated to this plan.

Targeted acceptance-criteria greps (all passed):
- `grep -n "\.collect()" convex/toolExecutions.ts` → zero matches
- `sed -n '119,152p' convex/llm.ts | grep -c "collect()"` → `0`
- `grep -c "excludeProvider" convex/toolExecutions.ts` → `11` (≥4 required)
- `grep -c 'excludeProvider: "astridr"' src/components/ToolExecutionPanel.tsx` → `2`
- `grep -c 'excludeProvider: "astridr"' src/components/PermissionDecisionsChart.tsx` → `1`
- `grep -n 'SectionErrorBoundary name="Trace"' src/pages/SessionDetail.tsx` → still matches (unchanged mount, F3)
- `grep -Ei '#[0-9a-f]{3,8}' src/components/TraceWaterfall.tsx | grep -v '^\s*//'` → zero matches (no hardcoded hex)
- `grep -c "older calls in this session aren't loaded" src/components/TraceWaterfall.tsx` → `1`
- `grep -c 'from "./toolExecutions"' convex/toolExecutions.test.ts` → `1`

## Mutation Verification (per the plan's own mandate)

Every new/changed test was mutation-verified — production code temporarily broken, confirmed the corresponding test FAILS, then restored (via `git checkout --` on already-committed files, or a scratchpad backup/restore for uncommitted `convex/llm.test.ts` at the time):

1. **`excludeByProvider` made a no-op** (`return rows;` unconditionally) → 5 tests in `convex/toolExecutions.test.ts` failed (both `excludeByProvider` provider-filtering tests, the D-15 control, the raw-count truncation test, `recentExecutions` never-returns-astridr test). Restored via `git checkout -- convex/toolExecutions.ts`.
2. **`sessionCallsLogic`'s `truncated` hardcoded to `false`** in `convex/llm.test.ts` → both new cap-boundary tests failed. Restored from a scratchpad backup (file had uncommitted Task 3 edits at mutation time).
3. **`TraceWaterfall`'s truncation banner conditionally disabled** (`{false && truncated && (...)}`)→ the "renders the exact Task-2 truncation banner copy" test failed (`getByText` threw, element not found). Restored via `git checkout -- src/components/TraceWaterfall.tsx`.
4. **`PermissionDecisionsChart`'s `excludeProvider` arg removed** from the query call → the "passes excludeProvider: 'astridr'" test failed with the exact expected-vs-received diff. Restored via `git checkout -- src/components/PermissionDecisionsChart.tsx`.

All four mutations produced the expected failure and were confirmed non-vacuous before being restored.

## Next Phase Readiness

- The D-12 bounded-read guard is in place before 105-02's ingest volume lands, as intended by this plan running first (Wave 1).
- `avgDuration`'s zero-consumer status carries forward as an explicit Phase-106 dead-code candidate (see key-decisions).
- `convex/ingest.ts:168`'s missing `provider` on `PostToolUseFailure` remains an open, tracked, deliberately-unfixed provenance gap (F6) — any future plan touching that file should be aware the D-15 control test's fixture depends on this exact shape.
- No blockers for 105-02 (ingest prerequisites) or subsequent Phase 105 plans.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-03*

## Self-Check: PASSED

All 10 key files confirmed present on disk; all 3 task commit hashes (355130a8, 9b894be8, 802ac520) confirmed present in git log.
