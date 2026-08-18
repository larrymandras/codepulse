---
phase: 121-analytics-query-resilience
plan: 01
subsystem: database
tags: [convex, aggregates, rollup, idempotency, backfill, self-hosted]

# Dependency graph
requires:
  - phase: 104-cost-fidelity
    provides: insertTokenSplitBuckets, backfillTokenSplit, the 4-segment dimension key convention
  - phase: 105-tool-usage-rollups
    provides: the per-metric-type independent idempotency guard pattern this plan extends
provides:
  - "metric_type: \"calls\" hourly aggregates rows, written by computeHourly and backfillTokenSplit through the shared insertTokenSplitBuckets helper"
  - "a de-latched backfillTokenSplit cursor (reset-on-completion + out-of-window clamp, mirroring COST-01's backfillDailyRollup)"
  - "convex/lib/fakeCtx.ts — the Convex handler fake-ctx test harness, now importable outside aggregates.test.ts, with a queriedTables call-order log"
affects: [121-02, 121-analytics-query-resilience]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared accumulate+guard+insert helper (insertTokenSplitBuckets) extended with a third metric type behind its own independent idempotency guard, rather than a shared one"
    - "Reset-on-completion cursor (never a terminal 'done' latch) with an out-of-window clamp — same shape as backfillDailyRollup's COST-01 fix, now also on backfillTokenSplit"
    - "Fake ctx.db test harness factored into convex/lib/ as a plain helper module (no vitest import, no Convex registration) so multiple *.test.ts files can import one shared harness"

key-files:
  created:
    - convex/lib/fakeCtx.ts
  modified:
    - convex/aggregates.ts
    - convex/aggregates.test.ts

key-decisions:
  - "D-05: calls accumulated in the same llmRows loop as tokens_prompt/tokens_completion, valued at row COUNT, behind its own insertMissing(\"calls\", …) guard — confirmed load-bearing by a mutation test (shared-guard mutation made calls insert 0 rows instead of 2, on both the first run and the twice-run check)."
  - "D-08: backfillTokenSplit's cursor now resets to the freshest completed hour on done instead of latching to the string \"done\", and clamps any cursor outside [retentionFloorHour, startingHour] back to a fresh start — otherwise Task 2's calls history would ride the same latch and become unreachable without hand-editing agentConfigs."
  - "Corrected a plan acceptance criterion in place rather than transcribing it: the criterion `grep -vn '^\\s*[/*]' convex/aggregates.ts | grep -c 'metric_type: \"calls\"'` expects a non-comment literal occurrence, but calls (like tokens_prompt/tokens_completion before it) is inserted via the shared insertMissing helper's `metric_type: metricType` variable assignment, never a literal `metric_type: \"calls\"` string — the same is true of the already-shipped tokens_prompt pattern (0 literal occurrences), so the grep's premise doesn't hold for the DRY pattern the plan itself mandated. The passing test asserting `r.metric_type === \"calls\"` against a live handler run is stronger evidence than the literal-string grep would have been."

patterns-established:
  - "Any new hourly rollup metric type sharing the {provider, model, billingType, goalId} dimension key should route through insertTokenSplitBuckets's insertMissing pattern, not a hand-rolled guard."

requirements-completed: [DEBT-08]

# Metrics
duration: 25min
completed: 2026-08-18
---

# Phase 121 Plan 01: Calls Rollup Metric + Backfill De-latch + Shared Test Harness Summary

**Added a `metric_type: "calls"` hourly aggregates rollup (the call-count metric PC-3 proved missing), de-latched `backfillTokenSplit`'s terminal "done" cursor so 30 days of history stays reachable, and extracted the Convex fake-ctx test harness into `convex/lib/fakeCtx.ts` with call-order tracking.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-18T14:12:00Z (approx.)
- **Completed:** 2026-08-18T14:37:43Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- `insertTokenSplitBuckets` now writes `metric_type: "calls"` hourly buckets alongside `tokens_prompt`/`tokens_completion`, keyed identically, valued at per-dimension row count, behind its own separate idempotency guard — proven by a twice-run test AND a reverted mutation test showing the guard is load-bearing (a shared guard made the metric fail to write at all, not just double-count).
- `backfillTokenSplit`'s cursor no longer latches on `"done"` forever; a completed sweep resets to the freshest completed hour (mirroring `backfillDailyRollup`'s COST-01 fix) and an out-of-window cursor (too new or too old) is clamped back to a fresh start instead of either walking unreachable hours or short-circuiting to zero work.
- `makeAggregatesCtx` (the fake `ctx.db` handler-test harness) moved out of `aggregates.test.ts` into `convex/lib/fakeCtx.ts`, gaining a `queriedTables` array that records every table name passed to `ctx.db.query()` — the mechanism Plan 121-02 needs to prove `costByModel`/`providerBreakdown` read `aggregates` and never `llmMetrics`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract fake ctx harness into convex/lib/fakeCtx.ts + queriedTables** - `c9368732` (refactor)
2. **Task 2: Add metric_type "calls" to insertTokenSplitBuckets, own idempotency guard** - `46b55760` (feat)
3. **Task 3: De-latch backfillTokenSplit's cursor** - `ce143d10` (fix)

**Plan metadata:** this commit (docs: complete plan)

_No TDD-gated tasks in this plan (plan frontmatter carries no `tdd="true"` tasks); each task's tests were written and verified alongside its implementation change, not as a separate RED/GREEN pair._

## Files Created/Modified
- `convex/lib/fakeCtx.ts` - New home for `makeAggregatesCtx`/`FakeDoc`, with a `queriedTables` call-order log added to `ctx.db.query()`.
- `convex/aggregates.ts` - `insertTokenSplitBuckets` gained a `callsByDim` accumulator + `insertMissing("calls", …)` call; `backfillTokenSplit`'s cursor resolution/clamp/reset rewritten; doc comments updated on both.
- `convex/aggregates.test.ts` - Removed the moved harness, added an import; added a `describe("calls metric (Phase 121 D-05)")` block (3 tests); rewrote/added `describe("backfill")` tests for the de-latch and clamp behavior (net +7 tests in this file: 71 → 78).

## Decisions Made
- Kept `computeHourly`'s call to `insertTokenSplitBuckets` discarding its return value, exactly as the plan specified — only `backfillTokenSplit`'s call site was updated to sum `promptInserted + completionInserted + callsInserted` into `rowsInserted`.
- Did not touch `convex/schema.ts` or `convex/crons.ts` — confirmed empty via `git diff --stat` after every task, matching the plan's hard constraint and the threat-model's T-121-02 disposition (`backfillTokenSplit` stays operator-driven, never a cron).
- See `key-decisions` in frontmatter for the two acceptance-criteria-shaping decisions (D-05 mutation-test result, D-08 reset-vs-latch).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a self-introduced double-count in the Task 2 doc comment, caught by its own acceptance criterion**
- **Found during:** Task 2, running the acceptance-criteria greps
- **Issue:** My first draft of the `insertTokenSplitBuckets` doc comment quoted the literal string `` insertMissing("calls", …) `` in prose, which made `grep -c 'insertMissing("calls"' convex/aggregates.ts` return 2 instead of the plan's expected 1 (one real call site + one comment mention).
- **Fix:** Reworded the comment to describe the guard without repeating the exact call-site string.
- **Files modified:** `convex/aggregates.ts`
- **Verification:** Grep returns 1; `npx vitest run convex/aggregates.test.ts` still 74/74 at that point.
- **Committed in:** `46b55760` (Task 2 commit)

**2. [Rule 1 - Bug] Rewrote a pre-existing test that the Task 3 behavior change made definitionally false**
- **Found during:** Task 3, first `npx vitest run` after the de-latch/clamp change
- **Issue:** The pre-existing test `"reaching the retention floor returns done: true and writes the terminal cursor sentinel"` asserted `result.nextCursor === "done"` and that the last cursor row's value was the string `"done"` — both are the exact latching behavior Task 3 removes. It also relied on a cursor that was numerically far in the past, which the plan's own new out-of-window clamp now treats as "restart from a fresh hour" rather than "already past the floor", so the fixture no longer exercised "reaching the floor" at all once the clamp existed.
- **Fix:** Rewrote it to force the retention floor mid-walk (a short `retention_days: 1` config row plus a generous `maxHours: 30`) so the test still proves "done: true when the floor is reached", updated its assertions to the reset behavior (`nextCursor === hourStart`, last cursor row value `=== hourStart`), and added a separate test proving the old fixture's stale-cursor value is now clamped to a fresh start rather than short-circuiting to zero work.
- **Files modified:** `convex/aggregates.test.ts`
- **Verification:** `npx vitest run convex/aggregates.test.ts` — 78/78 passing after the rewrite; `npm test -- --run` — full suite 0 failures.
- **Committed in:** `ce143d10` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs introduced/exposed during this plan's own execution, not pre-existing repo defects).
**Impact on plan:** Both fixes were needed for the plan's own acceptance criteria and test suite to be internally consistent. No scope creep — no file outside the plan's declared `files_modified` list was touched.

## Issues Encountered

**Acceptance criterion mismatch, not fixed as code (see key-decisions).** The Task 2 acceptance criterion `grep -vn '^\s*[/*]' convex/aggregates.ts | grep -c 'metric_type: "calls"'` (expected non-zero, "the string is not introduced only in a comment") returns 0 with the implementation as built, because the shared `insertMissing` helper the plan's own `<action>` text mandates reusing writes `metric_type: metricType` via variable interpolation, never the literal string `metric_type: "calls"`. The same is true today of `tokens_prompt` (0 literal occurrences of `metric_type: "tokens_prompt"` in the file) — confirmed by grep for comparison — so this is a plan defect (the criterion assumed a different code shape than the plan's own action text specifies), not a implementation gap. Left uncorrected in the criterion text since editing PLAN.md is out of this executor's scope; the underlying property (calls metric written, provable at runtime) is covered by the passing `describe("calls metric (Phase 121 D-05)")` tests instead.

## Test Results

- `npx vitest run convex/aggregates.test.ts`: **78 passed (78)**, 0 failed. (71 baseline in this file → 74 after Task 2 → 78 after Task 3.)
- `npx tsc --noEmit`: clean, no errors, after every task.
- Full suite `npm test -- --run`: **336 test files passed, 17 skipped (353); 4740 tests passed, 197 todo (4937); 0 failed.**
  - Baseline (orchestrator-measured at `a24fdf72`, immediately before this wave): 336 files passed, 17 skipped; 4728 passed, 197 todo, 0 failed.
  - Net +12 passing tests. This plan alone added +7 to `convex/aggregates.test.ts` (71→78). The remaining +5 is attributable to the concurrent Phase 190 session actively committing to this same shared checkout during this plan's execution (`db9dced6`, `a24fdf72`→newer KG-related commits landed on `src/hooks/useKnowledgeGraph.ts`/`useSavedViews.ts` mid-session, per the orchestrator's shared-checkout-hazard warning) — not attributable to this plan. 0 failures either way.
- `git diff --stat convex/schema.ts convex/crons.ts`: empty after every task, as required.
- `git show --stat HEAD` inspected after each of the 3 commits: only the intended files appear each time, no foreign content swept in from the concurrent session.

## User Setup Required

None - no external service configuration required. `backfillTokenSplit` remains an operator-invoked `internalMutation` (`npx convex run aggregates:backfillTokenSplit '{"maxHours": 6}'`), not registered in `convex/crons.ts`; running the actual 30-day history backfill against the live self-hosted instance is an operator action outside this plan's scope (this plan only fixes the mutation so that backfill is *possible*).

## Next Phase Readiness

- Plan 121-02 (`costByModel`/`providerBreakdown` migration to rollups, D-06/D-07/D-09) can now read a real `calls` metric and can prove its "reads aggregates, never llmMetrics" claim using `convex/lib/fakeCtx.ts`'s new `queriedTables` array.
- No blockers. The one open item is operational, not code: the live self-hosted instance's `phase104.tokenSplitBackfill.cursor` row may currently hold a legacy `"done"` value from a prior run — this plan's de-latch makes the next invocation of `backfillTokenSplit` automatically reset and reprocess history (including retroactively filling `calls` for the backfill window), but that invocation itself is an attended operator action per D-08/the plan's Claude's Discretion note, not something this plan runs.

---
*Phase: 121-analytics-query-resilience*
*Completed: 2026-08-18*
