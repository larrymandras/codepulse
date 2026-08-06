---
phase: 104-cost-intelligence
plan: 05
subsystem: database
tags: [convex, cost-intelligence, cost-derivation, pricing, aggregates]

# Dependency graph
requires:
  - phase: 104-01
    provides: "convex/modelPricing.ts's buildRateIndex/resolveRate/priceTokens (D-03: no default-rate fallback)"
  - phase: 104-03
    provides: "convex/aggregates.ts computeHourly emitting tokens_prompt/tokens_completion hourly buckets on the {provider, model, billingType, goalId} dimension key"
provides:
  - "convex/costDerived.ts — the single read-time tokens-to-dollars function (deriveBucketDollars) plus costOverTime, costBreakdown, unpricedModels queries and the computePeriodSpend helper"
  - "convex/aggregates.ts costByGoalPeriod/llmByGoal now recompute dollars via deriveBucketDollars instead of trusting the ingested cost field (D-01, RESEARCH.md Open Question 1 resolved YES)"
  - "src/hooks/useCostByGoal.ts + src/components/CostBreakdown.tsx rewired onto the new derived shape, rendering an honest 'Unpriced' badge instead of $0.00"
affects: [104-06, 104-07, 104-09, 104-10, 104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex query handlers tested via the exported function's ._handler escape hatch against a hand-rolled fake ctx.db (no convex-test), matching convex/aggregates.test.ts/modelPricing.test.ts's established convention"
    - "A query-log-capturing fake ctx (queryLog: {table, predicates}[]) so a test can assert a specific index-range read was NOT issued, not just that a result was correct — used to prove computePeriodSpend skips the daily read entirely for a daily budget"

key-files:
  created:
    - convex/costDerived.ts
    - convex/costDerived.test.ts
  modified:
    - convex/aggregates.ts
    - convex/aggregates.test.ts
    - src/hooks/useCostByGoal.ts
    - src/hooks/useCostByGoal.test.ts
    - src/components/CostBreakdown.tsx
    - src/components/CostBreakdown.test.tsx

key-decisions:
  - "deriveBucketDollars has two honesty guards, both checked before any rate lookup matters: zero-token buckets are unpriced regardless of a resolved rate (D-18), and a resolveRate miss is unpriced with BOTH dollar fields strictly null, never 0 (D-03)"
  - "billedUsd and coveredUsd are never summed into one field anywhere in this plan's diff — costOverTime keeps three separate provider-keyed maps per bucket, costBreakdown keeps billedTotal/coveredTotal as two independent sums, computePeriodSpend only ever touches billedUsd"
  - "unpricedModels is a thin wrapper over the SAME costBreakdown derivation (not a second implementation) so the future nudge (104-09) and admin suggestion list (104-07) can never disagree on the count"
  - "computePeriodSpend's daily/hourly read windows are disjoint by construction (daily upper-bounded at todayStart, hourly lower-bounded at max(periodStart, todayStart)) and the daily read is skipped ENTIRELY for periodStart >= todayStart — verified by a test that inspects the fake ctx's recorded index-range predicates, not just the numeric result"
  - "RESEARCH.md Open Question 1 answered YES: costByGoalPeriod/llmByGoal (HivePage's CostBreakdown) now derive dollars the same way as every other cost surface. The ingested cost field survives only under explicitly evidence-named reportedTotal/reportedCost fields — no field named cost or totalCost remains on either query's return shape (grep-verified)"
  - "src/hooks/useCostByGoal.test.ts updated even though it wasn't in the plan's files_modified list — Rule 1 (broken by this task's own shape change, not pre-existing/unrelated)"

patterns-established:
  - "A doc comment that names a forbidden pattern (e.g. 'do not reintroduce totalCost') must reword the literal substring, because this plan's own acceptance criteria grep the whole file including comments — same convention 104-01/104-02's summaries recorded"

requirements-completed: [COST-01]

# Metrics
duration: 15min
completed: 2026-07-31
---

# Phase 104 Plan 05: Cost Derivation Layer Summary

**`convex/costDerived.ts` — the single place tokens become money (deriveBucketDollars + costOverTime/costBreakdown/unpricedModels/computePeriodSpend), with the goal-scoped HivePage breakdown (`costByGoalPeriod`/`llmByGoal`) now recomputing dollars through the same function instead of trusting Ástríðr's reported `cost` field.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-31T14:16:00Z
- **Completed:** 2026-07-31T14:31:00Z
- **Tasks:** 3
- **Files modified:** 8 (2 created: `costDerived.ts`/`costDerived.test.ts`; 6 edited: `aggregates.ts`, `aggregates.test.ts`, `useCostByGoal.ts`, `useCostByGoal.test.ts`, `CostBreakdown.tsx`, `CostBreakdown.test.tsx`)

## Accomplishments

- `convex/costDerived.ts` ships `deriveBucketDollars` — the one pure function every cost surface in the phase routes through — plus three bounded Convex queries and one plain async helper:
  - **`costOverTime({ period, lookbackHours })`** → `Array<{ bucket_start, billedByProvider, coveredByProvider, unpricedTokensByProvider }>`, ascending by bucket, joining `tokens_prompt`/`tokens_completion` aggregate rows on the shared 4-segment dimension key.
  - **`costBreakdown({ period, lookbackHours })`** → `{ rows: DerivedRow[], billedTotal, coveredTotal, unpricedModelCount, unpricedTokenTotal }`, one row per `(provider, model, billingType)` across the whole window, sorted `billedUsd` descending with unpriced rows last.
  - **`unpricedModels({ lookbackHours })`** → `{ count, models }` — a thin wrapper over `costBreakdown` restricted to `priced: false` rows, grouped by distinct `(provider, model)` pairs (not rows) with summed token counts.
  - **`computePeriodSpend(ctx, { scope, scopeKey, periodStart, nowSec })`** → `{ billedUsd, unpricedTokens }` — a plain exported async function (not a query) plan 104-06's budget evaluator calls directly from `computeHourly`'s mutation ctx. Reads a disjoint daily-then-hourly window (never 744 hourly buckets for a monthly budget) and filters to `billingType: "api"` only under every scope (D-07).
- `convex/aggregates.ts`'s `costByGoalPeriod`/`llmByGoal` — HivePage's goal-scoped `CostBreakdown` — now accumulate `promptTokens`/`completionTokens` per group and call `deriveBucketDollars` instead of summing the ingested `cost` field. This resolves RESEARCH.md's Open Question 1 (explicitly deferred by 104-CONTEXT.md's canonical_refs): the goal-scoped breakdown and the Analytics cost cluster can no longer disagree. The ingested figure survives as `reportedTotal`/`reportedCost` — evidence, never the rendered truth.
- `src/hooks/useCostByGoal.ts` and `src/components/CostBreakdown.tsx` rewired onto the new shape: the component now reads `billedUsd`/`billedTotal` and renders a token-driven "Unpriced" badge (`var(--status-warn)`) plus the row's real token counts for `priced: false` rows, never a fabricated `$0.00`. The hex-color remediation for this file's pre-existing violations is explicitly deferred to plan 104-10 per the plan's own scoping instruction.
- 20 new unit tests (13 in `costDerived.test.ts`, 3 in `aggregates.test.ts`'s new `"goal cost derivation"` describe block, 1 new + 10 updated in the two `CostBreakdown`/`useCostByGoal` test files) plus the full repo suite: 3034/3034 passing, `npx tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Derive billed and covered dollars per bucket, expose the over-time series and breakdown queries** — `c96d832f` (feat)
2. **Task 2: Add the unpriced-model inventory and the bounded period-spend helper** — `99c97fb0` (feat)
3. **Task 3: Move the goal-scoped cost queries onto the same derivation (RESEARCH Open Question 1)** — `82129f5c` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update lands in the final commit below._

## Files Created/Modified

- `convex/costDerived.ts` — `deriveBucketDollars`, `costOverTime`, `costBreakdown`, `unpricedModels`, `computePeriodSpend`, plus non-exported `dimsOf`/`fetchAggregateRows`/`loadRateIndex`/`deriveBreakdown` helpers
- `convex/costDerived.test.ts` — 13 unit tests (pure-function honesty guards, breakdown grouping + re-price regression guard, unpriced-pair counting, computePeriodSpend's disjoint-window/scope/subscription-exclusion behavior, over-time bucket separation)
- `convex/aggregates.ts` — `costByGoalPeriod`/`llmByGoal` rewired onto `deriveBucketDollars`; imports `buildRateIndex` from `modelPricing.ts` and `deriveBucketDollars` from the new `costDerived.ts`
- `convex/aggregates.test.ts` — new `describe("goal cost derivation")` block (3 tests) exercising the real handlers via `._handler`; `makeAggregatesCtx` extended with a `modelPricing` fixture table
- `src/hooks/useCostByGoal.ts` — `CostByGoalResult`/`LlmRow`/`DEFAULT_COST` widened to the derived shape; imports `DerivedRow` type from `costDerived.ts`
- `src/hooks/useCostByGoal.test.ts` — updated for the new shape (Rule 1 fix, not in the plan's `files_modified`)
- `src/components/CostBreakdown.tsx` — reads `billedUsd`/`billedTotal`; renders the token-driven "Unpriced" badge; data-source rewire only, hex remediation deferred
- `src/components/CostBreakdown.test.tsx` — updated mocks/fixtures for the new shape, plus a new test proving the unpriced row renders a badge (never `$0.00`) while the header total still reflects only the priced row

## Decisions Made

See frontmatter `key-decisions`. The most consequential: RESEARCH.md's Open Question 1 is resolved YES in this plan (not deferred) — the goal-scoped HivePage breakdown now shares the exact same derivation function as Analytics, closing the "two disagreeing totals" gap D-12 exists to prevent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `src/hooks/useCostByGoal.test.ts` for the changed hook shape**
- **Found during:** Task 3 (running the full repo suite after the hook/component rewire)
- **Issue:** This test file (not listed in the plan's `files_modified`) asserted the OLD `{ rows, totalCost }` / `{ agentId, model, cost }` shapes and broke immediately when `useCostByGoal.ts` was widened.
- **Fix:** Updated all five assertions to the new `{ rows, billedTotal, coveredTotal, unpricedModelCount, reportedTotal }` / `{ ..., promptTokens, completionTokens, billingType, billedUsd, reportedCost }` shapes.
- **Files modified:** `src/hooks/useCostByGoal.test.ts`
- **Verification:** `npx vitest run src/hooks/useCostByGoal.test.ts` — 9/9 passing; full repo suite subsequently re-run clean (3034/3034).
- **Committed in:** `82129f5c` (Task 3 commit)

**2. [Rule 1 - Bug] Reworded two doc comments to avoid the literal substring `totalCost`**
- **Found during:** Task 3 (running the plan's own grep-based acceptance criteria)
- **Issue:** A doc comment in `convex/aggregates.ts` and one in `src/hooks/useCostByGoal.ts` named the forbidden field (`` `cost`/`totalCost` ``) as prose explaining what NOT to reintroduce — but the plan's acceptance criterion (`grep -c 'totalCost'` → 0) checks the whole file, comments included, matching the same pattern 104-01/104-02's summaries already documented.
- **Fix:** Reworded both comments to describe the same constraint ("a bare `cost` field or a combined total-`cost` field") without the literal substring.
- **Files modified:** `convex/aggregates.ts`, `src/hooks/useCostByGoal.ts`
- **Verification:** `grep -c 'totalCost'` returns 0 for both files; `npx tsc --noEmit` clean.
- **Committed in:** `82129f5c` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs introduced by this plan's own shape change, not pre-existing/unrelated work).
**Impact on plan:** Both fixes were necessary to keep the suite green and the plan's own acceptance criteria honest; no scope creep beyond what Task 3's data-source rewire already required.

## Issues Encountered

- `computePeriodSpend`'s exported type signature (`ctx: { db: DatabaseReader }`) is stricter than the hand-rolled fake ctx used in tests, since it is called directly (not via the `._handler` escape hatch other tested Convex functions use). Cast the fake ctx with `as any` at each call site in `costDerived.test.ts` — the same escape hatch pattern the codebase already uses for `._handler`, just applied to a plain function instead of a query object.

## User Setup Required

None — this plan adds pure read-time derivation logic on top of tables/data already seeded or seedable by plans 104-01/104-03/104-04 (`modelPricing.seedDefaults`, `aggregates.backfillTokenSplit`). No new external service configuration.

## Next Phase Readiness

- `convex/costDerived.ts`'s exported interface (`DerivedRow`, `deriveBucketDollars`, `costOverTime`, `costBreakdown`, `unpricedModels`, `computePeriodSpend`) matches 104-05-PLAN.md's `<interfaces>` contract verbatim — plans 104-06 (budget evaluator, calls `computePeriodSpend` directly), 104-07 (pricing admin, reads `unpricedModels`), 104-09 (breakdown table + nudge, reads `costBreakdown`/`unpricedModels`), and 104-10 (over-time chart toggle, reads `costOverTime`) can consume these names unchanged without re-reading this file.
- **Response shapes for downstream plans to consume verbatim:**
  - `costOverTime` → `Array<{ bucket_start: number; billedByProvider: Record<string, number>; coveredByProvider: Record<string, number>; unpricedTokensByProvider: Record<string, number> }>`
  - `costBreakdown` → `{ rows: DerivedRow[]; billedTotal: number; coveredTotal: number; unpricedModelCount: number; unpricedTokenTotal: number }`
  - `unpricedModels` → `{ count: number; models: Array<{ provider: string; model: string; billingType: string; promptTokens: number; completionTokens: number }> }`
  - `computePeriodSpend(ctx, args)` → `Promise<{ billedUsd: number; unpricedTokens: number }>`
- HivePage's `CostBreakdown.tsx` and the Analytics cost cluster now derive from the identical function and rate table — no further reconciliation work needed for D-01/D-12 on this axis.
- Plan 104-10's hex-remediation pass on `CostBreakdown.tsx` (and `CostTrendChart.tsx`) can proceed independently — this plan's edit to `CostBreakdown.tsx` is confined to the data-source rewire, as instructed.

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 8 created/modified source files found on disk plus this SUMMARY. All 3 task commit hashes (`c96d832f`, `99c97fb0`, `82129f5c`) found in `git log --oneline --all`.
