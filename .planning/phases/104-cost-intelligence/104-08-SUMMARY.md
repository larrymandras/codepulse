---
phase: 104-cost-intelligence
plan: 08
subsystem: ui
tags: [convex, react, cost-intelligence, budgets, spend-guard, forecast, settings]

# Dependency graph
requires:
  - phase: 104-04
    provides: "convex/costBudgets.ts CRUD/getByScope + seedFromLegacyCaps migration (global daily/monthly seed rows)"
  - phase: 104-05
    provides: "convex/costDerived.ts derivation layer (not directly consumed here — SDKSpendGuard/CostForecastPanel still read convex/aggregates.ts's costByPeriodByProvider/daily cost buckets)"
  - phase: 104-07
    provides: "Settings 'Cost & Budgets' tab (CostBudgetsAdmin + ModelPricingAdmin), useCostBudget(scope, scopeKey, period) hook with its undefined/null/row three-state contract"
provides:
  - "SDKSpendGuard reads its daily cap/warnFraction from the global/daily costBudgets row via useCostBudget — DAILY_CAP/ALERT_THRESHOLD constants removed"
  - "costForecast reads its monthly cap/warnFraction from the global/monthly costBudgets row via by_scope_key_period — agentConfigs[intelligence.budget_cap] no longer read on this path"
  - "CostForecastPanel renders an honest 'No monthly budget set' state (never a fabricated $0.00/0%/100% bar) and classifies against the row's own warnFraction"
  - "The legacy Settings budget-cap form (api.forecasts.getBudgetConfig/setBudgetCap) is retired; Settings' Tabs is now controlled so the replacement control can switch to the Cost & Budgets tab"
  - "One-cap-source proof: every DAILY_CAP/ALERT_THRESHOLD/intelligence.budget_cap grep hit under src/ and convex/ is classified (deprecated function, renamed legacy seed constant, or test-local fixture) — none remain on a live render path"
affects: [104-09, 104-10, 104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-state honesty rendering (undefined=loading, null=no-budget-configured, row=real data) applied to a spend gauge and a forecast panel, mirroring D-03's unpriced-model pattern applied to a budget cap"
    - "useThemeColors() used to resolve a non-CSS-var consumer (Sparkline's SVG stroke prop) instead of a hardcoded hex ternary"
    - "Controlled shadcn Tabs (value/onValueChange) so a child component can request a tab switch via a passed-down callback, replacing an uncontrolled defaultValue Tabs"

key-files:
  created:
    - src/components/CostForecastPanel.test.tsx
  modified:
    - src/components/SDKSpendGuard.tsx
    - src/components/SDKSpendGuard.test.tsx
    - src/components/SDKSpendCapGauge.tsx
    - src/components/SDKSpendCapGauge.test.tsx
    - src/components/CostForecastPanel.tsx
    - convex/forecasts.ts
    - convex/forecasts.test.ts
    - convex/seedGateway.ts
    - src/pages/Settings.tsx
    - convex/costBudgetEval.test.ts

key-decisions:
  - "projectDayEndSpend's signature changed to (todaySpend, elapsedHours, cap) — cap is now always caller-supplied, never a closed-over module constant. convex/costBudgetEval.ts's projectPeriodEndSpend already generalized this same algorithm; this plan just removes the last hardcoded input to the original."
  - "classifyBudgetStatus (forecasts.ts) gained a third warnFraction parameter defaulting to 0.8, preserving every pre-existing two-argument call site's behavior exactly (back-compat, not a breaking change)."
  - "getBudgetConfig/setBudgetCap (forecasts.ts) are marked DEPRECATED in a doc comment but left deployed and functional (still read/write agentConfigs) rather than deleted — deleting an exported Convex function while a deployed client bundle may still reference it is a deploy-order hazard (T-104-36, accepted risk: an authenticated but now-inert write)."
  - "seedGateway.ts's DAILY_CAP/ALERT_THRESHOLD were renamed to LEGACY_SEED_DAILY_CAP/LEGACY_SEED_ALERT_THRESHOLD rather than rewired onto costBudgets — they seed an unrelated alertRuleCustom threshold rule (a different concept, evaluated only client-side while the Alerts page is open, per convex/crons.ts's disabled evaluateInternal note), not a spend cap."
  - "convex/alerts.test.ts's local DAILY_CAP/ALERT_THRESHOLD declarations are left as-is — test-local arithmetic fixtures, not a product cap (explicit exemption from the one-cap-source gate, decided per the plan's Task 3 instruction)."
  - "convex/costBudgets.ts's seedFromLegacyCaps (from plan 104-04) still reads agentConfigs['intelligence.budget_cap'] once, by design — it is the one-time migration mechanism that reads the legacy value in order to retire it, not a second live cap source. Left untouched; out of this plan's file scope."

patterns-established:
  - "A comment documenting a retired/renamed constant must reword around the literal grep-checked substring (e.g. 'the two now-DEPRECATED forecasts.ts budget functions' instead of naming getBudgetConfig/setBudgetCap directly) — same convention 104-05's SUMMARY already recorded, reapplied twice more in this plan (forecasts.ts's own deprecation comments, Settings.tsx's retirement comment)."

requirements-completed: [COST-02]

# Metrics
duration: ~50min
completed: 2026-07-31
---

# Phase 104 Plan 08: Cap Source Consolidation (D-12/D-19) Summary

**Collapsed four independent spend-cap sources (SDKSpendGuard's hardcoded $5/day, forecasts.ts's `agentConfigs["intelligence.budget_cap"]` monthly cap, and a fourth undiscovered legacy form in Settings) down to one: the `costBudgets` table, with both panels degrading honestly (no fabricated $0/0%/100%) when no budget row exists yet.**

## Performance

- **Tasks:** 3
- **Files modified:** 10 (1 created: `CostForecastPanel.test.tsx`; 9 edited)
- **Completed:** 2026-07-31

## Accomplishments

- `SDKSpendGuard.tsx` (D-12): reads `useCostBudget("global", "", "daily")` instead of module constants. Three distinct states — loading skeleton (`undefined`), an honest no-budget copy with a link to Settings → Cost & Budgets (`null`, no gauge/percentage/projection), and the real gauge/projection once a row exists, now classified against that row's `limit`/`warnFraction` instead of `5.00`/`0.8`. The sparkline's stroke color reads `useThemeColors()` (statusOk/Warn/Error) instead of a hardcoded hex ternary. `DAILY_CAP`/`ALERT_THRESHOLD` no longer exist anywhere in the file; `projectDayEndSpend`'s cap is now a required third parameter.
- `SDKSpendCapGauge.tsx` (the backward-compat re-export shim) updated in lockstep — re-exports `classifyCapStatus` only, drops the two removed constants. Its own test file's two constant assertions removed.
- `convex/forecasts.ts` (D-19): `costForecast` reads the global/monthly `costBudgets` row via the `by_scope_key_period` index instead of `agentConfigs["intelligence.budget_cap"]`, and now returns `warnFraction` alongside `budgetCap` so the panel can classify against the row's real warn threshold instead of an assumed 80%. `classifyBudgetStatus` gained a `warnFraction = 0.8` third parameter (back-compat default). `getBudgetConfig`/`setBudgetCap` are marked DEPRECATED (still deployed, still functional, still authenticated) — nothing reads their output anymore.
- `CostForecastPanel.tsx`: zero layout/typography diff (verified via the plan's own `git diff | grep` gate). The null-budgetCap state's copy changed from "No budget cap configured" to "No monthly budget set. [Set one in Settings → Cost & Budgets]" — still renders no progress bar and no status label, never a fabricated $0.00/0%/100%.
- `src/pages/Settings.tsx` (Task 3 — the fourth cap source RESEARCH.md/CONTEXT.md never named): `IntelligenceSettings`'s legacy budget-cap form (`api.forecasts.getBudgetConfig`/`setBudgetCap`, its own input/save button/validation) is fully removed — not disabled — replaced by a one-line notice plus a button that switches the tab to "Cost & Budgets". `Tabs` converted from uncontrolled (`defaultValue`) to controlled (`value`/`onValueChange`) so that switch is possible.
- `convex/seedGateway.ts`: `DAILY_CAP`/`ALERT_THRESHOLD` renamed to `LEGACY_SEED_DAILY_CAP`/`LEGACY_SEED_ALERT_THRESHOLD` with a comment explaining they seed an unrelated `alertRuleCustom` rule (not the product's spend cap), so the one-cap-source grep gate has exactly one classified, legitimate hit here instead of an indistinguishable second cap source.
- 8 new/updated test cases across `SDKSpendGuard.test.tsx` (loading/no-budget/configured-budget/sparkline-color render tests, `projectDayEndSpend`'s cap-parameter tests), 3 new `costForecast` tests in `forecasts.test.ts` (fixture-sourced cap, null-cap honesty, and an explicit `queryLog`-based proof that no `agentConfigs` read occurs), and a new `CostForecastPanel.test.tsx` (3 tests: loading, configured, null-cap honesty). Full repo suite: 3102 passed, 193 todo, 17 skipped test files (all pre-existing) — `npm run build` and `npx tsc --noEmit` both exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire SDKSpendGuard onto the global daily budget row and move its sparkline onto theme tokens** - `18d7cec1` (feat)
2. **Task 2: Rewire costForecast and CostForecastPanel onto the global monthly budget row (D-19)** - `7afe23bd` (feat)
3. **Task 3: Retire the last legacy cap-editing surfaces and prove exactly one cap source remains** - `3a9d9853` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update lands in the final commit below._

## Files Created/Modified

- `src/components/SDKSpendGuard.tsx` - D-12 rewire onto `costBudgets`, theme-token sparkline color
- `src/components/SDKSpendGuard.test.tsx` - rewritten: cap-as-parameter tests + 5 new render tests
- `src/components/SDKSpendCapGauge.tsx` - re-export shim updated (constants dropped)
- `src/components/SDKSpendCapGauge.test.tsx` - constant assertions removed
- `src/components/CostForecastPanel.tsx` - D-19 rewire, honest null-budget copy, no layout change
- `src/components/CostForecastPanel.test.tsx` - NEW: 3 tests (loading, configured, null-cap honesty)
- `convex/forecasts.ts` - `costForecast` reads `costBudgets`; `classifyBudgetStatus` generalized; `getBudgetConfig`/`setBudgetCap` marked DEPRECATED
- `convex/forecasts.test.ts` - 3 new `costForecast` tests + 2 new `classifyBudgetStatus` warnFraction tests
- `convex/seedGateway.ts` - `DAILY_CAP`/`ALERT_THRESHOLD` renamed to `LEGACY_SEED_*` with a scoping comment
- `src/pages/Settings.tsx` - legacy budget-cap form removed; controlled `Tabs`; "Go to Cost & Budgets" replacement control
- `convex/costBudgetEval.test.ts` - Rule 1 fix: updated for `projectDayEndSpend`'s new cap parameter (not in plan's file list — see Deviations)

## Decisions Made

See frontmatter `key-decisions`. Most consequential: `getBudgetConfig`/`setBudgetCap` are deprecated-in-place rather than deleted (deploy-order safety), and `seedGateway.ts`'s constants are renamed rather than rewired, because they seed a structurally different concept (a static `alertRuleCustom` threshold rule, not a `costBudgets` row).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated `convex/costBudgetEval.test.ts` for `projectDayEndSpend`'s new signature**
- **Found during:** Task 1 (running the full acceptance-criteria test set after removing `DAILY_CAP`)
- **Issue:** This file (not listed in the plan's `files_modified`) imported `projectDayEndSpend` and `DAILY_CAP` from `SDKSpendGuard.tsx` to reproduce its legacy numbers as a regression check against `costBudgetEval.ts`'s generalized `projectPeriodEndSpend`. Removing `DAILY_CAP` and adding a required third `cap` parameter to `projectDayEndSpend` broke this import and call site immediately.
- **Fix:** Removed the `DAILY_CAP` import; added a local test-only `const DAILY_CAP = 5.0` fixture (documented as such) and passed it as `projectDayEndSpend`'s new third argument.
- **Files modified:** `convex/costBudgetEval.test.ts`
- **Verification:** `npx vitest run convex/costBudgetEval.test.ts` — all tests passing; confirmed as part of the full-suite run (3102 passed).
- **Committed in:** `18d7cec1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, caused by this plan's own signature change — not pre-existing/unrelated).
**Impact on plan:** Necessary to keep the suite green; no scope creep beyond what Task 1's signature change already required. Matches the precedent 104-05's SUMMARY recorded for the same class of fix.

## Issues Encountered

None beyond the deviation above.

## One-Cap-Source Proof (D-12/D-19 gate)

Command run: `grep -rn "DAILY_CAP\|ALERT_THRESHOLD\|intelligence.budget_cap" src/ convex/ --include=*.ts --include=*.tsx | grep -v node_modules`

Full classified output (every surviving hit):

**(a) `convex/forecasts.ts`'s two DEPRECATED functions (`getBudgetConfig`/`setBudgetCap`) — 3 hits:**
- `forecasts.ts:155` — `getBudgetConfig`'s `agentConfigs` `by_key` read
- `forecasts.ts:182` — `setBudgetCap`'s existing-row `by_key` read
- `forecasts.ts:193` — `setBudgetCap`'s insert `configKey` field

**(b) `convex/seedGateway.ts`'s renamed `LEGACY_SEED_*` constants — 4 hits:**
- `seedGateway.ts:11` — doc comment naming the old identifiers being renamed off of
- `seedGateway.ts:15`, `:16` — the two renamed constant declarations
- `seedGateway.ts:43` — their use in the `alertRuleCustom` threshold seed

**(c) `convex/alerts.test.ts`'s test-local fixtures — 3 hits:**
- `alerts.test.ts:9`, `:10`, `:11` — local `DAILY_CAP`/`ALERT_THRESHOLD` consts and their product, used purely as arithmetic fixtures for a threshold-comparison unit test

**Additional hits — all test-only or the pre-existing (104-04, out-of-scope) migration mutation, none on a render path:**
- `src/components/SDKSpendGuard.test.tsx:94` — comment describing what a *reintroduced* module constant would break (cautionary test comment, not a usage)
- `convex/costBudgetEval.test.ts:22,26,55,56` — this plan's Rule 1 fix: a local test-only `DAILY_CAP` fixture (see Deviations above)
- `convex/costBudgets.test.ts:246,283,294` — pre-existing (104-04) test fixtures for `seedFromLegacyCaps`'s migration-source read; these test the migration mechanism itself, not a live cap source
- `convex/costBudgets.ts:26,325,349,366,385` — pre-existing (104-04) `seedFromLegacyCaps` internalMutation: a one-time, manually-invoked migration that reads the legacy `agentConfigs` row *in order to retire it* into `costBudgets`. Not a second live cap source, not a render path, and out of this plan's file scope (files_modified: `SDKSpendGuard.tsx`/`.test.tsx`, `SDKSpendCapGauge.tsx`/`.test.tsx`, `CostForecastPanel.tsx`/`.test.tsx`, `forecasts.ts`/`.test.ts`, `seedGateway.ts`, `Settings.tsx`)
- `convex/forecasts.test.ts:15,181,202` — this plan's own new test code, asserting the *absence* of an `agentConfigs` read (proves the fix, does not use the legacy key on any live path)

**Verdict: zero hits under `src/` outside test files/comments; zero hits on any component, hook, or non-deprecated Convex query anywhere.** Every render path in the app now reads exactly one cap source: `costBudgets`.

## Replacement-Control Coverage Confirmation

Per `<deletion_discipline>`: the removed legacy Settings budget-cap form (a monthly-dollar-cap input + save button, writing `agentConfigs["intelligence.budget_cap"]` via `setBudgetCap`) is fully covered by 104-07's "Cost & Budgets" tab (`CostBudgetsAdmin`), which lets an operator create/edit/delete a `scope: "global", period: "monthly"` budget row with both a `limit` and a `warnFraction` — a strict superset of the old form's single-field capability (the old form had no warn-fraction control at all). `costForecast` now reads that same row, so an operator's edit there is what `CostForecastPanel` displays — the old form's edits had no live consumer at all.

## User Setup Required

None - no external service configuration required. **Operator note (repeated from 104-04/104-07, now load-bearing for this plan's honest-empty-state):** `npx convex run costBudgets:seedFromLegacyCaps '{}'` has not yet been run against the live self-hosted deployment. Until it is:
- `SDKSpendGuard` will render its "No daily budget set" state (todaySpend + sparkline only, no gauge).
- `CostForecastPanel` will render its "No monthly budget set" state (projections only, no progress bar) — and per the live finding recorded in 104-04's SUMMARY, the monthly axis will stay empty even after the seed runs, because the live deployment currently has **no** `agentConfigs["intelligence.budget_cap"]` row to migrate. An operator must set a monthly budget explicitly via the Cost & Budgets tab (`CostBudgetsAdmin`) if a monthly threshold is wanted.
- Live confirmation that both panels render real numbers once a budget exists is explicitly deferred to plan 104-11 per this plan's own `<verification>` section.

## Next Phase Readiness

- Every spend-cap source in the app now resolves to the `costBudgets` table; no known second cap source remains anywhere in `src/` or a live Convex query.
- `CostBudgetsAdmin` (104-07) is still deliberately not showing a live progress bar per its own documented decision ("Threshold set — progress shown on Analytics") — this plan's rewire is what makes that bar theoretically wireable in a future plan, but wiring it there was out of this plan's scope.
- Plan 104-11 should: (1) run `seedFromLegacyCaps` against the live deployment, (2) verify `SDKSpendGuard`/`CostForecastPanel` render real numbers, (3) set a monthly budget via `CostBudgetsAdmin` since no legacy value exists to migrate, and (4) confirm `REQUIREMENTS.md`'s COST-02 checkbox once live-verified (not marked complete by this plan, consistent with 104-04/104-07's precedent of deferring the checkbox to live confirmation).
- No blockers for 104-09/104-10 (breakdown table, unpriced nudge, over-time chart toggle) — none of their files overlap this plan's.

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All modified/created source files found on disk (`src/components/SDKSpendGuard.tsx`, `src/components/CostForecastPanel.test.tsx`, `convex/forecasts.ts`, plus this SUMMARY). All 3 task commit hashes (`18d7cec1`, `7afe23bd`, `3a9d9853`) found in `git log --oneline --all`.
