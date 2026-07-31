---
phase: 104-cost-intelligence
plan: 04
subsystem: database
tags: [convex, cost-intelligence, budgets, clerk-auth, utc-time]

# Dependency graph
requires:
  - phase: 104-01
    provides: "convex/schema.ts costBudgets table (scope/scopeKey/period/limit/warnFraction/unit/enabled) with by_enabled + by_scope_key_period indexes"
provides:
  - "convex/costBudgets.ts: pure UTC period-boundary helpers (periodStartFor/periodEndFor/periodHours) for daily/weekly/monthly"
  - "Clerk-gated CRUD (create/update/remove) with D-07/D-09/D-11 validation and immutable scope/scopeKey/period after creation"
  - "Unauthenticated list/get/getByScope reads"
  - "seedFromLegacyCaps internalMutation migrating SDKSpendGuard's DAILY_CAP/ALERT_THRESHOLD (D-12) and agentConfigs[intelligence.budget_cap] (D-19) into seed rows, idempotent and additive-only"
affects: [104-06, 104-07, 104-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, exported, ctx-free UTC period-boundary helpers (periodStartFor/periodEndFor/periodHours), unit-testable without convex-test — matches SDKSpendGuard.tsx / modelPricing.ts convention"
    - "Convex mutation()/query()/internalMutation() handlers tested via the exported function's ._handler escape hatch (no convex-test), matching convex/modelPricing.test.ts's established convention"

key-files:
  created:
    - convex/costBudgets.ts
    - convex/costBudgets.test.ts
  modified: []

key-decisions:
  - "unit ('usd' | 'quota_pct') is derived server-side from scope inside create — never accepted as a caller argument (D-07)"
  - "scope/scopeKey/period are immutable after creation; update explicitly rejects any attempt to change them rather than silently ignoring the fields, to protect plan 104-06's (budgetId, level, periodStart) alert dedup key"
  - "seedFromLegacyCaps is idempotent and additive-only, invoked manually via `npx convex run costBudgets:seedFromLegacyCaps`, not registered as a cron — no bulk mutation runs unattended against the self-hosted instance"
  - "the monthly seed is skipped honestly (monthlySkippedReason set, no row inserted) when no positive-number agentConfigs['intelligence.budget_cap'] row exists — never invents a fictional threshold"

patterns-established:
  - "Monday-anchored weekly UTC boundary via a documented 345600s (epoch-Thursday) offset constant — do not simplify without re-deriving"
  - "Monthly boundaries computed via Date.UTC(year, month[+1], 1), never by adding a fixed day count, so period end always lands on the real calendar month edge"

requirements-completed: [COST-02]

# Metrics
duration: 25min
completed: 2026-07-31
---

# Phase 104 Plan 04: Cost Budget Persistence & Legacy Cap Migration Summary

**Convex `costBudgets` CRUD with UTC-anchored daily/weekly/monthly period-boundary math and a Clerk identity gate, plus an idempotent migration folding SDKSpendGuard's hardcoded $5/day cap and the legacy `agentConfigs["intelligence.budget_cap"]` monthly cap into seed rows.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-31T14:03:00Z
- **Completed:** 2026-07-31T14:28:00Z
- **Tasks:** 2
- **Files modified:** 2 (both new: convex/costBudgets.ts, convex/costBudgets.test.ts)

## Accomplishments
- `convex/costBudgets.ts` implements `periodStartFor`/`periodEndFor`/`periodHours` — all UTC-anchored (D-10), matching `convex/crons.ts`'s `hourUTC` cron, `rollupDaily`'s `Math.floor(now/86400)*86400` day math, and `SDKSpendGuard.projectDayEndSpend`'s identical floor. Weekly boundaries land on Monday 00:00 UTC via a documented epoch-Thursday offset; monthly boundaries use `Date.UTC(year, month[+1], 1)`, never a fixed day-count add, so they land on the real calendar edge even across leap-year and December→January rollovers.
- `create`/`update`/`remove` mutations open with the Clerk identity gate reproduced verbatim from `convex/alertRuleCustom.ts:46-48` (T-104-13). `create` validates scope/period membership, enforces global-scope-implies-empty-scopeKey (and vice versa for non-global), derives `unit` server-side from `scope` so a caller can never force a fictional dollar into a quota budget (D-07), range-checks `limit` per unit and `warnFraction` to `(0,1)`, and rejects a duplicate `(scope, scopeKey, period)` via the `by_scope_key_period` index. `update` explicitly rejects any attempt to change `scope`/`scopeKey`/`period`, protecting the `(budgetId, level, periodStart)` alert dedup key plan 104-06 will store.
- `list`/`get`/`getByScope` are unauthenticated reads matching the sibling convention; `list` does a small, intentional full-table scan (D-09: this table stays in the low double digits by design).
- `seedFromLegacyCaps` (internalMutation) idempotently seeds a global/daily row from `SDKSpendGuard`'s `DAILY_CAP = 5.00` / `ALERT_THRESHOLD = 0.8` (D-12) and a global/monthly row from `agentConfigs["intelligence.budget_cap"]` when a positive-number legacy value exists (D-19). When no legacy monthly value exists, it skips honestly (`seededMonthly: false`, non-empty `monthlySkippedReason`, no row inserted) rather than inventing a threshold. Never patches or deletes; the legacy `agentConfigs` row is left in place for reference.
- 15 unit tests: 3 UTC boundary-math tests (weekly Monday-anchor across 3 probes, monthly boundaries across a 31-day month/28-day month/Dec→Jan rollover, `periodHours` = 744/672), 6 `create` validation tests, 1 `update` immutability test, 5 `seedFromLegacyCaps` tests (idempotency, seed values, honest skip, migrated value, no `db.delete`/`db.patch` calls). Full repo suite (3017 tests) passes; `tsc --noEmit` clean.

**Live-verification note (per this plan's `<output>` requirement):** queried the live self-hosted deployment via `npx convex run forecasts:getBudgetConfig '{}'` → `{ "budgetCap": null }`. **The live `agentConfigs["intelligence.budget_cap"]` row does NOT currently exist.** When an operator runs `seedFromLegacyCaps` against the live deployment today, it will seed the global/daily row ($5.00/0.8) but will skip the global/monthly row honestly (no legacy value to migrate) — plan 104-08 should expect `CostForecastPanel` to render its "no budget configured" state for the monthly axis until an operator sets one via the new `costBudgets` admin surface (or the legacy `forecasts:setBudgetCap` is called before the seed runs).

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the UTC period-boundary helpers and the costBudgets CRUD surface** - `4fc6b1e9` (feat)
2. **Task 2: Migrate the three legacy cap sources into seed budget rows** - `cec27907` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update lands in the final commit below._

## Files Created/Modified
- `convex/costBudgets.ts` - UTC period-boundary helpers, Clerk-gated CRUD, unauthenticated reads, `seedFromLegacyCaps` migration
- `convex/costBudgets.test.ts` - 15 unit tests (boundary math, validation, auth gate, immutability, migration idempotency/honesty)

## Decisions Made
- Followed the plan's explicit interface contract verbatim (`BudgetScope`, `BudgetPeriod`, `BudgetRow`, all exported function/mutation/query names) since plans 104-06/07/08 consume these exact names.
- `update`'s args schema accepts optional `scope`/`scopeKey`/`period` purely so a caller attempting to set them gets this file's explicit "immutable" `ConvexError` rather than Convex's generic unknown-argument rejection — the handler always throws before any patch is applied if any of the three is present.
- `seedFromLegacyCaps` reads `legacyConfig.value` and treats anything that is not a positive `number` (including `undefined`, `0`, or a non-numeric type) as "no legacy value to migrate", matching D-19's requirement to never invent a fictional threshold.
- **COST-02 NOT marked complete in REQUIREMENTS.md** — same precedent as plan 104-01's COST-01/COST-02 note. This plan ships only the persistence layer (backend CRUD + migration); COST-02's full scope (an operator-facing budget-configuration surface) lands in a later plan (104-07/104-08 per the roadmap's wave sequencing). REQUIREMENTS.md has no per-plan checkbox for this requirement to partially tick — it will be marked once the configuring UI exists.

## Deviations from Plan

None - plan executed exactly as written. All acceptance-criteria greps (`getUserIdentity` ×3, `ConvexError("Unauthenticated")` ×3, `345600` ×1, `quota_pct` ×7 in Task 1; `intelligence.budget_cap` ×4, zero `db.delete`/`db.patch` calls outside `remove`/`update`, `seedFromLegacyCaps` absent from `convex/crons.ts` in Task 2) verified directly against the file, not inferred.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Operator note: `npx convex run costBudgets:seedFromLegacyCaps '{}'` must be run manually against the live deployment before plan 104-08 rewires `SDKSpendGuard`/`CostForecastPanel` onto `costBudgets` rows, or both panels will render "no budget configured". As recorded above, the live deployment currently has no `agentConfigs["intelligence.budget_cap"]` row, so that manual run will seed only the daily budget — an operator will need to set a monthly budget explicitly (via the future `costBudgets` admin UI, plan 104-08/104-09) if a monthly threshold is wanted.

## Next Phase Readiness
- `convex/costBudgets.ts`'s exported interface (`BudgetScope`, `BudgetPeriod`, `BudgetRow`, `periodStartFor`, `periodEndFor`, `periodHours`, `create`, `update`, `remove`, `list`, `get`, `getByScope`, `seedFromLegacyCaps`) is ready for plan 104-06 (evaluator) and plans 104-07/104-08 (read/edit) to consume unchanged.
- The seed has not yet been run against the live self-hosted instance (operator action, same category as plan 104-01's un-run `modelPricing:seedDefaults`) — until it is, `costBudgets.list` returns an empty table on the running deployment.
- No blockers for plan 104-05 (which per the wave 2 dependency graph does not depend on this plan) or plan 104-06 (which does).

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All created files found on disk (convex/costBudgets.ts, convex/costBudgets.test.ts, this SUMMARY). Both commit hashes (4fc6b1e9, cec27907) found in `git log --oneline --all`.
