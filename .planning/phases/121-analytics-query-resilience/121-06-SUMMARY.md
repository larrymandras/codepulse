---
phase: 121-analytics-query-resilience
plan: 06
subsystem: frontend
tags: [convex, react, analytics, rollup-migration, freshness-label]

# Dependency graph
requires:
  - phase: 121-analytics-query-resilience
    plan: 02
    provides: "the { rows, asOf, expectedBuckets, presentBuckets, rowsRead, truncated } object shape for api.llm.providerBreakdown / api.llm.costByModel"
provides:
  - "LlmAnalyticsPanel consuming the rollup-backed object shape (no more Object.entries(record) / bare-array reads)"
  - "One D-11 'as of HH:MM' freshness label that cannot overstate currency (older-of-two asOf, 'no data yet' on null, nothing while loading)"
  - "repo-wide npx tsc --noEmit back to 0 errors"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Freshness label sourced from the OLDER of two queries' asOf (epoch seconds), converted with asOf * 1000, never rendering a caveat-free number"

key-files:
  created: []
  modified:
    - src/components/LlmAnalyticsPanel.tsx
    - src/components/LlmAnalyticsPanel.test.tsx

key-decisions:
  - "Ran this plan out of wave order (Wave 3 -> immediately after 121-02) on the orchestrator's instruction, because 121-02 left tsc broken in this file on a shared checkout with a concurrent session active."
  - "Kept the plan's literal 'renders no `1970` text' acceptance wording as a comment/rationale but did NOT ship it as the actual assertion — the panel only ever renders HH:MM, never a year, so that literal check passes vacuously regardless of whether the seconds/millis bug is present (verified: it passed against a deliberately mutated component). Replaced it with a control that computes both the correct and the buggy (seconds-read-as-millis) label and asserts the DOM shows only the correct one, plus a sanity assertion that the buggy interpretation really does land in 1970 - this is a genuine discriminator (mutation-confirmed) and it still documents the same failure mode by name."
  - "Corrected a plan-authored acceptance criterion: 'grep -c costDerived.costBreakdown ... still returns 1' does not hold even against the pre-existing baseline file (git show HEAD had 2 occurrences before this plan touched anything - one in a comment, one in the useQuery call). The intent ('money column source unchanged') is satisfied; the literal count in the plan text was wrong from before this plan started."

requirements-completed: [DEBT-08]

# Metrics
duration: ~12min
completed: 2026-08-18
---

# Phase 121 Plan 06: LlmAnalyticsPanel Rollup Rewire + D-11 Freshness Label Summary

**Rewired the only `src/` consumer of `providerBreakdown`/`costByModel` onto the rollup object shape and shipped one honest `as of HH:MM` freshness label, closing the 4 `tsc` errors 121-02 deliberately left behind.**

## Why this ran early

Pulled forward from Wave 3 by the orchestrator: 121-02 changed both queries' return type from array/record to an object, which left `npx tsc --noEmit` reporting 4 errors confined to this file. A concurrent session shares this checkout, so leaving `master` type-broken while waiting for Wave 3 was not acceptable.

## Accomplishments

- `LlmAnalyticsPanel.tsx` now reads `providerResult?.rows` / `modelResult?.rows` instead of a bare array and `Object.entries(record)`. The chart and table render identical content from the new shape.
- Added one D-11 freshness label rendered beside the "Provider Comparison" heading: `as of HH:MM` (24-hour local time, computed from `asOf * 1000` since `asOf` is epoch seconds), `no data yet` when both queries returned zero rows, and nothing while either query is still loading. The label always uses the OLDER of the two queries' `asOf` values, per D-10/D-11 ("never overstate freshness").
- Money column and its `costDerived.costBreakdown` source are untouched; a new comment states explicitly that the migrated queries carry no `cost` field to tempt a future edit into reading one.
- `presentBuckets`/`expectedBuckets`/`truncated` are carried in the payload but deliberately not rendered — commented as intentional (Phase 122 TOKEN-04's charter), matching D-11 and T-121-26's "accept, stated" disposition.
- Rewrote `LlmAnalyticsPanel.test.tsx` fixtures to the real object shape and added a `describe("freshness label (Phase 121 D-11)")` block covering all four states plus a `truncated: true` boundary case.
- Proved the freshness-label tests are load-bearing by mutation: reverted `asOf * 1000` to `asOf` in the component, confirmed 2 of 11 tests went RED, then reverted the mutation and confirmed the file is byte-identical to before (`diff` against a scratchpad backup, empty).
- `npx tsc --noEmit`: **0 errors repo-wide** (was 4, all in this file, per the orchestrator's baseline).

## Task Commits

1. **Task 1: Consume the rollup payload shape and render the D-11 freshness label** — `4ed92f9c` (feat)
2. **Task 2: Update the panel's test fixtures to the migrated shape and cover the freshness label** — `e9537537` (test)

`git show --stat HEAD` was read after each commit; only the intended file appeared each time — no foreign content swept in from the concurrent Phase 190 session.

## Deviations from Plan

### Auto-fixed / Corrected (plan-is-a-draft, Rule 1/2 territory)

**1. The plan's `1970`-text acceptance criterion is non-discriminating for this component's actual label format, and was strengthened rather than shipped as literally worded.**
- **Found during:** Task 2, while mutation-testing.
- **Issue:** The plan's acceptance criteria ask for "a test asserts the rendered text does not contain `1970`". The component's label is `as of HH:MM` — it never renders a year under any code path, correct or buggy. So `expect(screen.queryByText(/1970/)).toBeNull()` is true unconditionally: verified live by running it against the deliberately-mutated component (`new Date(asOf)` instead of `new Date(asOf * 1000)`) and watching it pass. A test that passes whether the bug is present or absent is not evidence (per CLAUDE.md's absence-proof-needs-a-control rule).
- **Fix:** Replaced the assertion with a genuine control: compute the label two ways (correct `asOf * 1000` and the buggy bare `asOf`), assert with a sanity check that the buggy interpretation's `Date` object really does land in 1970 (documenting what "1970" names) and that the two labels differ, then assert the DOM shows only the correct label. Mutation-confirmed: this version goes RED under the same mutation that left the literal-`1970` form green.
- **Files modified:** `src/components/LlmAnalyticsPanel.test.tsx`
- **Commit:** `e9537537`

**2. The plan's `costDerived.costBreakdown` grep-count acceptance criterion ("still returns 1") does not hold, and did not hold before this plan touched the file either.**
- **Found during:** Task 1, while running the literal acceptance-criteria greps.
- **Issue:** `git show HEAD:src/components/LlmAnalyticsPanel.tsx | grep -c "costDerived.costBreakdown"` on the pre-plan baseline returns **2** (one in an explanatory comment, one in the actual `useQuery` call) — the plan's stated baseline of 1 was wrong from before this plan started.
- **Fix:** Did not treat "returns 1" as a hard gate; verified instead that the actual `useQuery(api.costDerived.costBreakdown, ...)` call and its behaviour are byte-for-byte unchanged (the intent the criterion exists to protect). Reworded one of my own new comments to avoid inflating the count further than the pre-existing baseline's 2 (it currently reads 2, matching the untouched baseline).
- **Files modified:** none beyond the Task 1 edit itself.
- **Commit:** `4ed92f9c`

**Total deviations:** 2, both plan-text corrections per CLAUDE.md's "plan is a draft" / "stale docs" directives. No scope creep; no weakening of any real assertion.

## Test Results

- `npx tsc --noEmit`: **0 errors** (before: 4, all in `src/components/LlmAnalyticsPanel.tsx` — TS2339 `.map` on the new object type, TS7006 implicit-any, plus 2 TS18046 `'data' is of type 'unknown'` surfaced by the same root cause).
- `npx vitest run src/components/LlmAnalyticsPanel.test.tsx`: **11 passed (11)**, 0 failed (was 6 passed).
- `npm test -- --run` (full suite): **336 test files passed, 17 skipped (353); 4758 tests passed, 197 todo (4955); 0 failed.**
  - Orchestrator-measured baseline (HEAD before this plan): 336 files / 4753 passed, 197 todo, 0 failed.
  - Net **+5** passing tests, exactly matching this file's 6 -> 11 test count.

## Mutation Proof (freshness label tests are load-bearing)

```
# Mutated src/components/LlmAnalyticsPanel.tsx: `new Date(asOf * 1000)` -> `new Date(asOf)`
$ npx vitest run src/components/LlmAnalyticsPanel.test.tsx
  Test Files  1 failed (1)
       Tests  2 failed | 9 passed (11)
  # failing: "shows the OLDER of the two queries' asOf values, formatted HH:MM"
  #          "would render 1970 on a seconds/millis mix-up - the control for that bug"

# Reverted the mutation
$ diff <scratchpad-backup> src/components/LlmAnalyticsPanel.tsx
  (no output - byte-identical)

$ npx vitest run src/components/LlmAnalyticsPanel.test.tsx
  Test Files  1 passed (1)
       Tests  11 passed (11)
```

## `asOf` Unit Sanity Check

```
$ node -e "const asOf = Math.floor(Date.now()/1000); console.log(new Date(asOf * 1000).toString());"
Tue Aug 18 2026 11:35:26 GMT-0400 (Eastern Daylight Time)   # 2026, not 1970 - correct units confirmed
```

## Acceptance-Criteria Grep Evidence

```
$ grep -c "Object.entries(callsAndTokensByModel)" src/components/LlmAnalyticsPanel.tsx
0
$ grep -cE "providerResult\?\.rows|modelResult\?\.rows" src/components/LlmAnalyticsPanel.tsx
2
$ grep -c "as of" src/components/LlmAnalyticsPanel.tsx
2
$ grep -c "asOf \* 1000" src/components/LlmAnalyticsPanel.tsx
2
$ grep -c "costDerived.costBreakdown" src/components/LlmAnalyticsPanel.tsx
2   # baseline (pre-plan) was also 2, not 1 as the plan stated - see Deviations #2
$ grep -nE "formatCost\(\s*row\.cost\s*\)|\.cost\b" src/components/LlmAnalyticsPanel.tsx
23:  // `llmMetrics.cost` field (`grouped[key].cost += r.cost ?? 0`). D-01 is explicit
    # only hit is inside a historical comment describing the OLD bug - no live .cost read
$ grep -c "asOf" src/components/LlmAnalyticsPanel.test.tsx
18   # >= 4 required
```

## Issues Encountered

None outside the two documented deviations above.

## User Setup Required

None. No deploy was run (plan 121-07 owns the gated deploy, per `<do_not_deploy>`). No changes to STATE.md / ROADMAP.md / REQUIREMENTS.md (orchestrator-owned).

## Next Phase Readiness

- `LlmAnalyticsPanel.tsx` is fully migrated; no further work needed on it for this phase.
- `presentBuckets`/`expectedBuckets`/`truncated` remain unrendered by design, ready for Phase 122's TOKEN-04 six-state tile to consume from the same payload.
- No blockers for plan 121-07 (the gated deploy) as far as this plan's files are concerned.

## Self-Check: PASSED

- Files: `src/components/LlmAnalyticsPanel.tsx`, `src/components/LlmAnalyticsPanel.test.tsx` — both confirmed present on disk.
- Commits: `4ed92f9c`, `e9537537` — both confirmed present via `git log --oneline`.

---
*Phase: 121-analytics-query-resilience*
*Completed: 2026-08-18*
