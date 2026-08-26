---
phase: 121-analytics-query-resilience
plan: 02
subsystem: database
tags: [convex, aggregates, rollup, dos-mitigation, cost-fidelity]

# Dependency graph
requires:
  - phase: 121-analytics-query-resilience
    plan: 01
    provides: "metric_type: \"calls\" hourly aggregates rows, and convex/lib/fakeCtx.ts's queriedTables call-order log"
provides:
  - "api.llm.costByModel and api.llm.providerBreakdown reading only the aggregates rollups, bounded, with asOf/coverage/truncated metadata"
  - "deletion of api.llm.costByProvider, api.llm.latencyOverTime, and useLatencyOverTime — closing success criterion 2 for those two queries"
  - "evalScores.getJudgeDigestInternal's llmMetrics read capped at 200, matching its sibling events read"
  - "handler-level proof (queriedTables) that the migrated queries never read llmMetrics, with a control and a mutation test"
affects: [121-04, 121-06, 121-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-metric-type rollup join (calls + tokens) grouped by a shared dimension key, with asOf taking the OLDER of the two metric types' newest buckets so a freshness label can never overstate currency"
    - "Handler-level negative-read proof via makeAggregatesCtx's queriedTables, paired with an llmMetrics control fixture chosen to produce a recognisably different (never-matching) answer if the raw path were still live"

key-files:
  created: []
  modified:
    - convex/llm.ts
    - convex/llm.test.ts
    - convex/evalScores.ts
    - src/hooks/useAnalytics.ts
    - src/components/control-center/LlmStatusPanel.tsx

key-decisions:
  - "D-06/D-07 executed as deletion for costByProvider/latencyOverTime/useLatencyOverTime (zero src/ consumers, control-verified against useCapabilityGrowth) and migration for costByModel/providerBreakdown, exactly as CONTEXT.md specified."
  - "Dropped providerBreakdown's optional lookbackDays arg entirely (args: {} now, was { lookbackDays: v.optional(v.float64()) }). The plan's action text fixes ROLLUP_LOOKBACK_DAYS as a module constant with no caller override, and the only src/ consumer never passed lookbackDays — keeping a now-unused arg alongside a fixed window constant would be dead surface on an already-breaking-change query."
  - "Did not call assertAggregatePeriod in either migrated handler. The plan's own action text says to pass period through it 'if the handler accepts a period arg; if it does not, hardcode \"hourly\" and do not add the arg' — neither handler accepts a period arg, so there is no untrusted input for the guard to validate; calling it against a hardcoded literal would be dead code guarding against an impossible input."
  - "Fixed two stale comments that named the deleted costByProvider/STOPGAP text by string, in files outside this plan's declared files_modified (LlmStatusPanel.tsx, and the subscriptionUsage docstring in llm.ts itself) — Rule 1, caused directly by this plan's own deletions, not pre-existing repo defects."

patterns-established:
  - "A migrated rollup query that reads two metric types computes asOf as the OLDER of the two reads' newest bucket_start, never the newer — carried forward from D-10's 'never overstate freshness' rule into an explicit reusable pattern for any future multi-metric-type rollup query."

requirements-completed: [DEBT-08]

# Metrics
duration: 35min
completed: 2026-08-18
---

# Phase 121 Plan 02: Rollup-Backed Analytics Queries + Dead-Endpoint Deletion Summary

**Migrated `costByModel`/`providerBreakdown` onto bounded `aggregates` rollup reads with freshness metadata, deleted two unbounded public 30-day `.collect()` endpoints (`costByProvider`, `latencyOverTime`) that had zero consumers, and capped `evalScores`' one remaining unbounded `llmMetrics` read.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-18T11:05:00Z (approx.)
- **Completed:** 2026-08-18T11:19:00Z
- **Tasks:** 3
- **Files modified:** 5 (0 created, 5 modified)

## Accomplishments

- `costByModel` and `providerBreakdown` now read the `aggregates` rollups (`metric_type: "calls"`/`"tokens"`, hourly, via `by_type_period_bucket`) instead of scanning raw `llmMetrics`. Both are bounded by construction (`.order("desc").take(ROLLUP_READ_CAP)`, never `.collect()`), report `truncated`/`rowsRead` honestly, and carry `asOf` + `{expectedBuckets, presentBuckets}` freshness metadata derived entirely from rows already read.
- Deleted `costByProvider`, `latencyOverTime` (`convex/llm.ts`), `useLatencyOverTime` (`src/hooks/useAnalytics.ts`), and the Phase 104 STOPGAP comment block that named this fix — removing two public, uncredentialed, unbounded 30-day `.collect()` endpoints from the attack surface with zero `src/` consumers (control-verified against `useCapabilityGrowth`).
- Bounded `evalScores.getJudgeDigestInternal`'s `llmMetrics` read to `JUDGE_DIGEST_LLM_READ_CAP = 200` (descending order), matching its sibling `events` read's existing `.take(200)` in the same function.
- Added a 13-test handler-level proof block (`describe("rollup-backed reads (Phase 121 D-07)")` in `convex/llm.test.ts`) that both migrated queries read `aggregates` and never `llmMetrics`, using `makeAggregatesCtx`'s `queriedTables` log, an `llmMetrics` control fixture chosen to produce a recognisably different (non-matching) answer if the raw path were still live, and a harness-sanity case proving the tracking mechanism itself works.
- Performed and reverted a mutation test: temporarily pointed `providerBreakdown` back at `ctx.db.query("llmMetrics")`, confirmed the `not.toContain("llmMetrics")` assertion failed, then reverted and confirmed the file returned to byte-identical via `git diff`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete costByProvider, latencyOverTime, useLatencyOverTime and the Phase 104 STOPGAP note; bound the evalScores llmMetrics read** - `7cf179cd` (fix)
2. **Task 2: Rewrite costByModel and providerBreakdown to read the aggregates rollups, bounded, with asOf and coverage** - `4a116bb0` (feat)
3. **Task 3: Handler-level proof that the migrated queries read aggregates and never read llmMetrics** - `3f76c958` (test)

**Plan metadata:** this commit (docs: complete plan)

_No TDD-gated tasks in this plan (frontmatter carries no `tdd="true"` tasks); each task's tests were written and verified alongside its implementation change._

## Files Created/Modified

- `convex/llm.ts` — `costByProvider`/`latencyOverTime` deleted; the Phase 104 STOPGAP comment deleted; `costByModel`/`providerBreakdown` rewritten to read `aggregates` (bounded, `asOf`/coverage/`truncated`); a stale reference to the deleted STOPGAP note in `subscriptionUsage`'s docstring corrected.
- `convex/llm.test.ts` — new `describe("rollup-backed reads (Phase 121 D-07)")` block (13 tests: 6 for `providerBreakdown`, 6 for `costByModel`, 1 harness-sanity case).
- `convex/evalScores.ts` — `getJudgeDigestInternal`'s `llmMetrics` read capped at `JUDGE_DIGEST_LLM_READ_CAP = 200` (descending order).
- `src/hooks/useAnalytics.ts` — `useLatencyOverTime` deleted; `useSessionList`/`useCapabilityGrowth` untouched.
- `src/components/control-center/LlmStatusPanel.tsx` — a docstring comment that named `costByProvider` by string was corrected (deviation, see below).

## Decisions Made

See `key-decisions` in frontmatter. In brief: executed D-06 (delete) and D-07 (migrate) exactly as CONTEXT.md specified; dropped `providerBreakdown`'s now-pointless `lookbackDays` arg; skipped calling `assertAggregatePeriod` since neither handler accepts an untrusted `period` input to validate; fixed two stale comments this plan's own deletions orphaned.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale doc] Fixed a stale comment in `LlmStatusPanel.tsx` naming the deleted `costByProvider`**
- **Found during:** Task 1, immediately after deleting `costByProvider`
- **Issue:** `src/components/control-center/LlmStatusPanel.tsx:22`'s docstring said a chip-state field mirrors "the same field `llm.ts`'s `providerBreakdown`/`costByProvider` group by" — a claim that becomes false the moment `costByProvider` no longer exists.
- **Fix:** Reworded to reference only `providerBreakdown`.
- **Files modified:** `src/components/control-center/LlmStatusPanel.tsx`
- **Verification:** `git grep -nF "costByProvider" -- src convex` returns 0 hits after the fix.
- **Committed in:** `7cf179cd` (Task 1 commit)

**2. [Rule 1 - Stale doc] Fixed a stale reference to the deleted STOPGAP note in `subscriptionUsage`'s docstring**
- **Found during:** Task 1, after deleting the STOPGAP comment block
- **Issue:** `subscriptionUsage`'s own docstring (a different query, not in this plan's `files_modified`) said "the better-supported mechanism is the one the `providerBreakdown` STOPGAP note below already documents" — a dangling forward-reference to text this task deletes, and it also contained the literal string `STOPGAP`, which the plan's own acceptance criterion (`grep -c "STOPGAP" convex/llm.ts` returns 0) requires to be gone from the whole file, not just the deleted block.
- **Fix:** Reworded to describe the mechanism (Analytics' ~10 concurrent queries tipping a memory-loaded instance over) without pointing at removed text or repeating the word "STOPGAP".
- **Files modified:** `convex/llm.ts`
- **Verification:** `grep -c "STOPGAP" convex/llm.ts` returns 0.
- **Committed in:** `7cf179cd` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — stale comments this plan's own deletions orphaned, in code outside the plan's declared `files_modified` list, per CLAUDE.md's "Stale Docs" directive: trust the code, update the doc in the same commit).
**Impact on plan:** Both fixes were required by the plan's own literal acceptance criteria (a `costByProvider`-free `src/`+`convex/` and a `STOPGAP`-free `convex/llm.ts`). No scope creep beyond fixing what this plan's deletions broke.

## Issues Encountered

**Plan-internal inconsistency, not fixed as code (flagging per CLAUDE.md's "plan is a draft" directive).** The plan's top-level `<verification>` block states "`npx tsc --noEmit` clean" with no scoping, but the `<interfaces>` section explicitly names `src/components/LlmAnalyticsPanel.tsx` as "the consumer this plan breaks on purpose (rewired in plan 121-06, not here)", and Task 2's own acceptance criteria scope tsc cleanliness to `convex/` only ("`npx tsc --noEmit` reports no errors in `convex/`"). These cannot both be literally true: `providerBreakdown`'s return type changed from an array to an object exactly as D-07 mandates, and `LlmAnalyticsPanel.tsx` calls `.map()` on it, so `npx tsc --noEmit` now reports 4 errors — all four confined to that one file, all pre-announced by the plan itself as deferred to 121-06. Treated Task 2's explicit, narrower acceptance criterion as authoritative (it matches the plan's own stated intent) rather than silently reshaping the return payload to keep the old array shape, which would have defeated D-07's entire point (dropping `cost`/`avgLatency`, adding `asOf`/coverage, moving off `llmMetrics`). **121-04/121-06 must land before the repo is `tsc`-clean again.**

## Test Results

- `npx tsc --noEmit`: 4 errors, all in `src/components/LlmAnalyticsPanel.tsx` (the known, plan-declared breaking consumer — see Issues Encountered). Zero errors in `convex/`.
- `npx vitest run convex/`: **84 test files passed, 2 skipped (86); 1667 tests passed, 102 todo (1769); 0 failed.** (Baseline before this plan's Task 3: 1654 passed; net +13, all from the new `rollup-backed reads` describe block.)
- `npx vitest run convex/llm.test.ts`: **1 file passed; 36 passed, 3 todo (39); 0 failed.**
- `npx vitest run src/components/LlmAnalyticsPanel.test.tsx`: **1 file passed; 6 passed (6); 0 failed** — the existing mock fixtures return literal shapes that satisfy `.map()` at runtime regardless of TS types, so this test stays green even though the real backend response would now be an object. 121-06 owns rewiring the component and its fixtures.
- Full suite `npm test -- --run`: **336 test files passed, 17 skipped (353); 4753 tests passed, 197 todo (4950); 0 failed.**
  - Orchestrator-measured baseline (HEAD before this wave): 336 files passed, 17 skipped; 4740 passed, 197 todo, 0 failed.
  - Net +13 passing tests, all attributable to this plan's Task 3 (`convex/llm.test.ts`'s new describe block: 6 + 6 + 1 = 13 `it()` cases).
- `git show --stat HEAD` inspected after each of the 3 commits: only the intended files appear each time (verified against `git diff --stat` before staging and `git commit --only <exact paths>` for every commit), no foreign content swept in from the concurrent Phase 190 session.

## Acceptance-Criteria Grep Evidence

Per the plan's own `<verification>` rule ("Every acceptance-criteria grep result is pasted into the SUMMARY with its command, not summarised as 'verified'"):

```
$ git grep -nF "costByProvider" -- src convex   # exit 1, 0 hits
$ git grep -nF "latencyOverTime" -- src convex  # exit 1, 0 hits
$ git grep -nF "useLatencyOverTime" -- src convex  # exit 1, 0 hits
$ git grep -clF "useCapabilityGrowth" -- .      # control — 4 files (>= 2 required)
.planning/phases/121-analytics-query-resilience/121-02-PLAN.md
.planning/phases/121-analytics-query-resilience/121-CONTEXT.md
src/components/CapabilityGrowthChart.tsx
src/hooks/useAnalytics.ts

$ git grep -nF "costByProvider" -- .   | wc -l  # 79 — all 79 in .planning/ (planning prose describing the deletion)
$ git grep -nF "latencyOverTime" -- .  | wc -l  # 45 — all 45 in .planning/
$ git grep -nF "useLatencyOverTime" -- . | wc -l # 17 — all 17 in .planning/

$ grep -c "STOPGAP" convex/llm.ts               # 0
$ grep -n "JUDGE_DIGEST_LLM_READ_CAP" convex/evalScores.ts
150:const JUDGE_DIGEST_LLM_READ_CAP = 200;
168:      .take(JUDGE_DIGEST_LLM_READ_CAP);

$ grep -n 'q.eq("metric_type", "calls")' convex/llm.ts
# (2 hits: costByModel's calls read, providerBreakdown's calls read)
$ grep -n 'q.eq("metric_type", "tokens")' convex/llm.ts
# (1 hit: costByModel's tokens read)

$ grep -n "avgLatency" convex/llm.ts            # 0 hits

$ grep -c 'not.toContain("llmMetrics")' convex/llm.test.ts  # 3
```

Remaining `llmMetrics` references in `convex/llm.ts` after Task 2 (none belong to the migrated handlers): `recordCall` (the insert path), `cacheStats`, `sessionCalls`, `recentCalls`, `recentCallsPaginated`, `rollupCosts`, `subscriptionUsage`, `backfillAgentId` — all pre-existing, already-bounded or insert-only reads, none touched by this plan.

## User Setup Required

None — no external service configuration required. No deploy was run (per the orchestrator's `<do_not_deploy>` instruction); the changes in this plan are local-only until plan 121-07's gated deploy.

## Next Phase Readiness

- **For plan 121-04** (rewires `src/hooks/useAnalytics.ts`'s remaining exports into the page): `useSessionList` and `useCapabilityGrowth` are unchanged; `useLatencyOverTime` no longer exists in this file at all.
- **For plan 121-06** (rewires `LlmAnalyticsPanel.tsx`): the exact new payload shapes, verbatim —
  - `providerBreakdown()` → `{ rows: Array<{ provider: string; calls: number }>, asOf: number | null, expectedBuckets: number, presentBuckets: number, rowsRead: number, truncated: boolean }`
  - `costByModel()` → `{ rows: Array<{ model: string; calls: number; tokens: number }>, asOf: number | null, expectedBuckets: number, presentBuckets: number, rowsRead: number, truncated: boolean }`
  - Both dropped `cost`/`avgLatency` entirely. `providerBreakdown` no longer accepts a `lookbackDays` arg (fixed at 30 days via `ROLLUP_LOOKBACK_DAYS`). Until 121-06 lands, `npx tsc --noEmit` will report 4 errors confined to `LlmAnalyticsPanel.tsx` and its existing test stays green only because its mocks are untyped at runtime (see Issues Encountered).
- **For plan 121-07** (the gated deploy): the 8000-row `ROLLUP_READ_CAP` sizing basis is a documented estimate, not a live measurement — the plan's own comment says the actual per-hour dimension-key cardinality should be measured live at that deploy gate, not assumed here.
- No blockers.

## Self-Check: PASSED

- Files: `convex/llm.ts`, `convex/llm.test.ts`, `convex/evalScores.ts`, `src/hooks/useAnalytics.ts`, `src/components/control-center/LlmStatusPanel.tsx`, and this SUMMARY — all confirmed present on disk.
- Commits: `7cf179cd`, `4a116bb0`, `3f76c958` — all confirmed present via `git log --oneline`.

---
*Phase: 121-analytics-query-resilience*
*Completed: 2026-08-18*
