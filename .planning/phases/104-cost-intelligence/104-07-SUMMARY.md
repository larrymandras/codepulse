---
phase: 104-cost-intelligence
plan: 07
subsystem: ui
tags: [react, convex, shadcn, cost-intelligence, pricing, budgets, settings]

# Dependency graph
requires:
  - phase: 104-01
    provides: "convex/modelPricing.ts CRUD (create/update/remove/list/get) + Clerk auth gate"
  - phase: 104-04
    provides: "convex/costBudgets.ts CRUD (create/update/remove/list/get/getByScope) + Clerk auth gate + UTC period helpers"
  - phase: 104-05
    provides: "convex/costDerived.ts unpricedModels query (single source for the unpriced-model set)"
provides:
  - "src/hooks/useModelPricing.ts, src/hooks/useCostBudgets.ts — useQuery(...) ?? DEFAULT wrapper hooks"
  - "src/components/ModelPricingAdmin.tsx — Sheet-based CRUD for the modelPricing rate table"
  - "src/components/CostBudgetsAdmin.tsx — Sheet-based CRUD for the costBudgets table, all 4 scopes"
  - "Settings 'Cost & Budgets' tab hosting both admin surfaces"
affects: [104-08, 104-09, 104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sheet-based CRUD admin form (dirty tracking, toast.success/toast.error, delete-confirm Dialog) mirrored from AlertRuleForm.tsx"
    - "Single named per-Mtok<->per-token conversion helper (perTokenToMtok/mtokToPerToken), exported for direct unit-test reuse"
    - "Radix Select interaction in jsdom tests mocked via a name-prop-keyed @/components/ui/select swap, matching IntakeModal.test.tsx's established precedent"

key-files:
  created:
    - src/hooks/useModelPricing.ts
    - src/hooks/useCostBudgets.ts
    - src/components/ModelPricingAdmin.tsx
    - src/components/ModelPricingAdmin.test.tsx
    - src/components/CostBudgetsAdmin.tsx
    - src/components/CostBudgetsAdmin.test.tsx
  modified:
    - src/pages/Settings.tsx
    - convex/_generated/api.d.ts

key-decisions:
  - "CostBudgetsAdmin renders NO fabricated progress bar for any row (including global scope) — every row shows its configured threshold plus 'Threshold set — progress shown on Analytics'. costDerived.costBreakdown has no exact per-budget-scope/period figure without client-side re-derivation, and SDKSpendGuard/CostForecastPanel are not yet rewired onto costBudgets (plan 104-08's job) — sourcing a bar from either today risks this admin surface disagreeing with the row it displays, the exact D-12 failure mode."
  - "Query-failure error state ('Couldn't load pricing rates/budgets. [Retry]') is delegated to the wrapping <SectionErrorBoundary> added in Task 3, not duplicated as a second local error boundary inside either admin component — a Convex query either resolves or throws (caught by the boundary), there is no third 'error' value useQuery itself returns."
  - "Regenerated convex/_generated/api.d.ts (npx convex codegen) — it had never picked up modelPricing/costBudgets/costDerived/costBudgetEval from plans 104-01/04/05/06, so `api.modelPricing.*`/`api.costBudgets.*`/`api.costDerived.*` calls failed tsc until this ran. Treated as a Rule 3 blocking fix."

patterns-established:
  - "Icon-only row-action buttons use Button size='icon' with a size-11 (44px) className override to meet the touch-target exception without a separate padding wrapper."

requirements-completed: [COST-01, COST-02]

# Metrics
duration: 55min
completed: 2026-07-31
---

# Phase 104 Plan 07: Cost & Budgets Admin UI Summary

**Settings "Cost & Budgets" tab with a budget-threshold admin (all 4 costBudgets scopes, one form) above a model-pricing admin (per-Mtok display, per-token storage, live unpriced-model nudge) — the first place an operator can configure Ástríðr cost rates and alert thresholds without a code change.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-31T14:28:00Z
- **Completed:** 2026-07-31T15:16:34Z
- **Tasks:** 3
- **Files modified:** 8 (6 created: 2 hooks, 2 components, 2 test files; 2 edited: Settings.tsx, convex/_generated/api.d.ts)

## Accomplishments
- `src/hooks/useModelPricing.ts` / `useCostBudgets.ts` ship the `useQuery(...) ?? DEFAULT` wrapper convention exactly matching `useCostByGoal.ts`. `useCostBudget(scope, scopeKey, period)` deliberately returns the raw `getByScope` result — including `undefined` while loading — so plan 104-08's panels can tell "still loading" apart from "no budget configured," per the plan's explicit requirement.
- `ModelPricingAdmin.tsx`: an operator can list, add, edit and remove pricing rates from a `Table` that displays per-Mtok and stores per-token, converted through one named helper in each direction (`perTokenToMtok`/`mtokToPerToken`) — a round-trip unit test asserts a per-Mtok input of `5` reaches `api.modelPricing.create` as `0.000005`. An "Unpriced models" section reads the exact same `api.costDerived.unpricedModels` query the Analytics nudge (plan 104-09) will read, with an inline "Add rate" action pre-filling the create Sheet (including `shadowForProvider` for subscription rows). Shadow rows render an `--info`-token `Badge` with the D-05 tooltip copy. Every icon-only row action carries an explicit `aria-label`. Zero hardcoded hex.
- `CostBudgetsAdmin.tsx`: one Sheet-based form creates/edits/deletes budgets across all four scopes (global/model/provider/quota — D-09/D-07 folded in). The limit field's label, prefix/suffix and validation range switch on scope (`Limit (% of quota)` capped at 100, vs `Limit (USD)` capped at 1,000,000) — the unit itself is never a form field, matching the backend's server-derived `unit`. The warn-fraction helper text recomputes live ("Warn at $X — breach at $Y"). Editing an existing row renders scope/scope-key/period as disabled controls with an explanatory note (the backend rejects changes to them). A fixed disclaimer ("Budgets raise alerts. They don't stop work.") sits under the form, and a unit test asserts no enforcement-implying word (`throttle`/`swap`/`cap enforced`) appears anywhere else in the rendered output.
- `Settings.tsx` gained a "Cost & Budgets" `TabsTrigger`/`TabsContent` (positioned after LLM Providers, before Notifications) hosting `CostBudgetsAdmin` above `ModelPricingAdmin`, each independently wrapped in its own `<SectionErrorBoundary>` — one throwing query can no longer blank the whole tab. No new route; `App.tsx`/`DashboardLayout.tsx` are untouched (verified via `git diff --stat`, zero lines).
- 14 new component tests (6 `ModelPricingAdmin`, 8 `CostBudgetsAdmin`) plus the existing full suite (3078 tests) all pass; `tsc --noEmit` and `npm run build` both exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the two read hooks and build the model pricing admin surface** - `2a45ebab` (feat)
2. **Task 2: Build the budget threshold admin surface** - `155081ee` (feat)
3. **Task 3: Add the Cost and Budgets tab to Settings** - `b4199577` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update lands in the final commit below._

## Files Created/Modified
- `src/hooks/useModelPricing.ts` - `useModelPricing()` hook
- `src/hooks/useCostBudgets.ts` - `useCostBudgets()` + `useCostBudget()` hooks
- `src/components/ModelPricingAdmin.tsx` - pricing rate list + Sheet CRUD form + unpriced-models nudge
- `src/components/ModelPricingAdmin.test.tsx` - 6 tests (Mtok round-trip, unpriced-list prefill, a11y, validation, no-hex)
- `src/components/CostBudgetsAdmin.tsx` - budget list + Sheet CRUD form across all 4 scopes
- `src/components/CostBudgetsAdmin.test.tsx` - 8 tests (scope-driven unit switching, immutability on edit, warn recompute, D-16 word guard, no-hex)
- `src/pages/Settings.tsx` - new "Cost & Budgets" tab, error-isolated
- `convex/_generated/api.d.ts` - regenerated to include `modelPricing`/`costBudgets`/`costDerived`/`costBudgetEval` (previously stale since plans 104-01/04/05/06)

## Decisions Made

- **Task 2's progress-bar choice:** no fabricated bar anywhere in `CostBudgetsAdmin`, including global-scope rows. The plan explicitly permitted skipping a bar unless `costBreakdown` gives an exact per-scope figure "without additional client-side re-derivation" — it doesn't (it returns a lookback-window breakdown, not a figure scoped to a specific budget row's own period boundary), and `SDKSpendGuard`/`CostForecastPanel` are still reading their pre-104-08 legacy sources, so borrowing their numbers here risks a transient disagreement between this admin surface and the row it displays — exactly the two-caps-disagree pattern D-12 exists to prevent. Every row instead states its configured threshold plus "Threshold set — progress shown on Analytics."
- Delegated the UI-SPEC's "Couldn't load pricing rates/budgets. [Retry]" query-failure copy to the `<SectionErrorBoundary>` wrapping added in Task 3, rather than duplicating a second local error-handling path inside each admin component — `useQuery` either resolves (loading/data) or throws (caught by the boundary); there's no third state to render locally.
- Followed the plan's literal interface contract for both hooks (`useModelPricing`, `useCostBudgets`, `useCostBudget`) since plan 104-08 is expected to consume `useCostBudget`'s loading/`null` distinction unchanged.
- Regenerated `convex/_generated/api.d.ts` — required for `api.modelPricing.*`/`api.costBudgets.*`/`api.costDerived.*` to typecheck; it had drifted since plan 104-01.
- **COST-01/COST-02 NOT marked satisfied in REQUIREMENTS.md this plan**, matching 104-01/104-04/104-06's established precedent. COST-01 also names "chart + table" breakdown display, which lands in plans 104-09/104-10; COST-02's admin surface is now code-complete but this project's "green suite is not accepted as proof of a live fix" convention defers the checkbox to plan 104-11's live confirmation against the running self-hosted instance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated stale Convex codegen bindings**
- **Found during:** Task 1 (first `npx tsc --noEmit` run after adding the hooks)
- **Issue:** `convex/_generated/api.d.ts` had never been regenerated since plans 104-01/104-04/104-05/104-06 added `modelPricing.ts`/`costBudgets.ts`/`costDerived.ts`/`costBudgetEval.ts` — every `api.modelPricing.*`/`api.costBudgets.*`/`api.costDerived.*` reference failed with "Property does not exist."
- **Fix:** Ran `npx convex codegen` (its own internal typecheck step failed on an unrelated pre-existing `@/lib/utils` path-alias resolution issue in its bundler context, but the TypeScript binding generation itself completed before that step and updated `api.d.ts` correctly).
- **Files modified:** `convex/_generated/api.d.ts`
- **Verification:** `npx tsc --noEmit` exits 0 afterward; full test suite (3078 tests) passes.
- **Committed in:** `2a45ebab` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock typechecking; no scope creep — no application code changed as part of this fix.

## Issues Encountered

None beyond the codegen staleness above.

## User Setup Required

None - no external service configuration required. Operator note (inherited from plans 104-01/104-04): `modelPricing:seedDefaults` and `costBudgets:seedFromLegacyCaps` still need to be run manually against the live deployment before this admin UI has anything to show; that remains outside this plan's scope.

## Next Phase Readiness

- `useCostBudget(scope, scopeKey, period)`'s loading-vs-null distinction is ready for plan 104-08 to consume when rewiring `SDKSpendGuard`/`CostForecastPanel` onto `costBudgets`.
- `ModelPricingAdmin`'s unpriced-models section and plan 104-09's Analytics nudge both read `api.costDerived.unpricedModels` — no risk of the two disagreeing.
- CostBudgetsAdmin's "no fabricated progress bar" decision means plan 104-08's rewire is what will eventually let this admin surface (or a future revision of it) show a real percentage; until then the honest label stands.
- No blockers for plan 104-08.

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 8 created/modified files found on disk (src/hooks/useModelPricing.ts, src/hooks/useCostBudgets.ts, src/components/ModelPricingAdmin.tsx, src/components/ModelPricingAdmin.test.tsx, src/components/CostBudgetsAdmin.tsx, src/components/CostBudgetsAdmin.test.tsx, src/pages/Settings.tsx, convex/_generated/api.d.ts). All 3 commit hashes (2a45ebab, 155081ee, b4199577) found in `git log --oneline --all`.
