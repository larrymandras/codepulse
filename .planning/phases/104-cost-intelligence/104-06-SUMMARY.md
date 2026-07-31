---
phase: 104-cost-intelligence
plan: 06
subsystem: database
tags: [convex, cost-intelligence, budget-alerts, cron-tail-append, self-hosted-convex]

# Dependency graph
requires:
  - phase: 104-04
    provides: "convex/costBudgets.ts's periodStartFor/periodEndFor/periodHours UTC helpers and the costBudgets CRUD rows this evaluator reads"
  - phase: 104-05
    provides: "convex/costDerived.ts's computePeriodSpend — the bounded 'spend so far this period' helper this evaluator calls directly"
provides:
  - "convex/costBudgetEval.ts — projectPeriodEndSpend/classifyBudgetLevel/buildAlertMessage (pure, D-13/D-11/D-16) plus evaluateBudgets, the D-14 tail-append entry point that fires deduped budget alerts through the delivering alert path"
  - "convex/aggregates.ts computeHourly now calls evaluateBudgets at its tail inside a mandatory try/catch — no new cron, no new scheduled function"
affects: [104-07, 104-08, 104-09, 104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure, exported, ctx-free projection/classification/message functions (matches SDKSpendGuard.tsx / modelPricing.ts / costBudgets.ts convention) — unit-testable without convex-test"
    - "vi.mock(module, importOriginal) pass-through spy: wraps a module's real export in vi.fn() so a downstream consumer's exact call count/args/rejection behavior can be asserted, while every other test in the same file that imports the same export still exercises the real implementation unchanged"

key-files:
  created:
    - convex/costBudgetEval.ts
    - convex/costBudgetEval.test.ts
  modified:
    - convex/aggregates.ts

key-decisions:
  - "evaluateBudgets is invoked from computeHourly's tail via a plain function call against the mutation's own ctx.db/ctx.scheduler — never through ctx.runQuery/ctx.runMutation indirection — matching costDerived.ts's computePeriodSpend convention rather than evalScores.ts's DetectRegressionsCtx shape, since this file runs INSIDE the same mutation, not as a separately-invoked internalMutation"
  - "the D-16/forbidden-enforcement-word grep acceptance criterion is satisfied for generated alert message content (verified by a dedicated unit test) but not for the FORBIDDEN_WORDS array literal itself, which necessarily contains the words it guards against — documented as an intentional deviation, not a gap, since the actual constraint (no message the evaluator writes ever contains an enforcement word) is enforced in code and unit-tested"
  - "quota_pct spend is computed as 100 - remainingPct * 100, confirmed against three independent sources (gatewayQuota.ts's own doc comment, GatewayQuotaPanel.tsx's Math.round(remainingPct * 100) usage, and 68-PATTERNS.md's '// 0.0-1.0' schema comment) that remainingPct is a 0-1 fraction, not already a percentage"
  - "a quota budget with no live gatewayQuotaSnapshots row for its provider is skipped and counted under skippedNoData, never evaluated as 0% used — this return field exists alongside the plan's four-field interface contract (evaluated/fired/skippedDeduped/errors) because the plan's own action text requires it even though the <interfaces> block didn't enumerate it"

patterns-established:
  - "A cron-tail-appended evaluator gets a two-layer failure boundary: its own internal per-row try/catch (evaluateBudgets), plus an outer try/catch at the cron call site (computeHourly) — neither layer alone is sufficient, since the outer layer exists specifically to protect the load-bearing rollup from a failure the inner layer didn't anticipate (e.g. the initial costBudgets.collect() read itself throwing, before any per-row loop begins)"

requirements-completed: []

# Metrics
duration: 40min
completed: 2026-07-31
---

# Phase 104 Plan 06: Budget Alert Evaluator (Cron Tail-Append) Summary

**`convex/costBudgetEval.ts` generalizes SDKSpendGuard's burn-rate projection to any budget period, classifies warn/breach/spike into exactly two severities, and fires deduped alerts through the existing delivery path — evaluated entirely at the tail of the already-running `computeHourly` cron, with zero new scheduled functions and zero `convex/crons.ts` changes.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-07-31T14:14:00Z
- **Completed:** 2026-07-31T14:53:00Z
- **Tasks:** 3
- **Files modified:** 3 (2 created: `costBudgetEval.ts`/`costBudgetEval.test.ts`; 1 edited: `aggregates.ts`)

## Accomplishments

- `convex/costBudgetEval.ts` ships three pure, ctx-free functions (unit-testable without `convex-test`, matching `SDKSpendGuard.tsx`/`modelPricing.ts`/`costBudgets.ts`'s established convention):
  - **`projectPeriodEndSpend`** — `SDKSpendGuard.tsx`'s `projectDayEndSpend` (D-13's named algorithm) generalized from a fixed 24h/single-dollar-cap shape to any `periodHours`/`limitValue`/`periodStartSec`. A regression test proves it reproduces `projectDayEndSpend`'s exact numbers when `periodHours === 24` and the period start is a UTC day boundary — the generalization did not change daily behavior.
  - **`classifyBudgetLevel`** — D-11's exactly-two-firing-levels rule (`"error"` at the limit, `"warning"` at the warn fraction) plus the D-13 spike branch: a burn rate projected to breach the limit before period end still fires `"warning"`, even when actual spend hasn't reached the warn fraction yet. Breach takes precedence over a simultaneous spike signal.
  - **`buildAlertMessage`** — matches the UI-SPEC copywriting contract verbatim (`"{scope label} budget at {pct}% (${spend} of ${limit}) — projected to hit ${limit} by ~{time}."`), omits the projection clause entirely when no hit time was computed (never renders "unknown" as fact), renders `%`-only with no `$` for `quota_pct` budgets (D-07), appends an honesty clause when unpriced tokens were excluded from the total (D-03 applied to alerting), and is guarded against six enforcement-implying words (`throttle`, `swap`, `stop`, `block`, `disable`, `cap enforced`) via `containsForbiddenEnforcementWord`, asserted by a dedicated test across three representative generated messages.
- **`evaluateBudgets(ctx, nowSec)`** — the D-14 tail-append entry point. Reads `costBudgets` once (whole-table `.collect()`, low double digits by design), then per enabled budget: resolves spend via `computePeriodSpend` (usd, plan 104-05's disjoint daily/hourly bounded read) or a single bounded `gatewayQuotaSnapshots.by_provider` index read (`quota_pct`, D-07 — skips honestly under `skippedNoData` when no snapshot exists rather than treating absence as 0% used), projects and classifies, dedupes on `(budgetId, level, periodStart)` via the `alerts.by_source` index with **no status filter** (D-15 — an acknowledged/resolved prior alert still suppresses a re-fire; an escalation from `warning` to `error` within the same period still fires because the source string differs), then inserts directly into `alerts` (`webhookStatus: "pending"`) and schedules `internal.webhookDelivery.sendAlertWebhook` — **never** the public `alerts.create` (D-17). Every budget row is evaluated inside its own `try/catch`, so one malformed row cannot block the rest.
- `convex/aggregates.ts`'s `computeHourly` calls `evaluateBudgets(ctx, now)` at the very end of its handler, passing the handler's own already-computed `now` (not a second `Date.now()` call), wrapped in a mandatory outer `try/catch` that logs and swallows any failure — a throw here would fail the whole hourly rollup and re-enter the exact retry-backoff storm D-14 exists to avoid. **No entry was added to `convex/crons.ts`** — `git diff --stat convex/crons.ts` shows zero changed lines, and the disabled `evaluate-alert-rules` block stays commented out, untouched.
- 28 unit tests across the three tasks (14 pure-function tests, 11 dedup/fire/isolation tests against a hand-rolled fake `ctx.db`+`ctx.scheduler`, 3 cron-tail-append tests exercising the real `computeHourly` handler via a `vi.mock` pass-through spy on `costBudgetEval`). Full repo suite 3062/3062 passing; `tsc --noEmit` clean.

## Added Read Cost Per Invocation (for plan 104-11's live timing check)

Every read `evaluateBudgets` performs, stated so 104-11 knows exactly what to measure against the self-hosted instance's syscall budget:

| Read | Bound | Notes |
|------|-------|-------|
| `costBudgets.collect()` | Whole table, low double digits by design (D-09) | Same "small table, full scan is fine" assumption `costBudgets.list`/`modelPricing.list` already make. One read total per `computeHourly` invocation, not per budget. |
| Per `"usd"`-unit budget: `computePeriodSpend` | ≤~31 daily bucket-sets (0 for a same-day budget — the daily read is skipped entirely) + the current day's hourly bucket-sets, both index-range-bounded on `aggregates.by_type_period_bucket` | Plan 104-05's existing disjoint-window helper; never touches `llmMetrics`. |
| Per `"quota_pct"`-unit budget: `gatewayQuotaSnapshots.by_provider` | Single-row read (`.order("desc").take(1)`) | Bounded regardless of table size. |
| Per budget that reaches a non-null classification: `alerts.by_source` dedup read | Bounded by however many prior alerts share the exact `cost-budget:{budgetId}:{level}` source string | D-15's per-period dedup keeps this small in practice — at most a handful of rows per budget/level pair. |
| Per firing budget: one `alerts` insert + one `scheduler.runAfter` schedule | O(1) | The only write this file ever performs. |

No read in this file ever queries `llmMetrics` directly (`grep -c 'query("llmMetrics")' convex/costBudgetEval.ts` → 0). The concrete new cost added to `computeHourly` is therefore: one small whole-table read, plus a handful of index-bounded reads per enabled budget row (realistically single/low-double-digit count, per D-09's scope) — a small, bounded addition, not "adds nothing." Live execution timing against the self-hosted instance remains deferred to plan 104-11 per this plan's own `<verification>` section — this table is what that plan should measure against.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generalize the projection and classification math to any period** — `e9247b44` (feat)
2. **Task 2: Implement evaluateBudgets with per-period dedup and the fire-and-deliver path** — `53e1005c` (feat)
3. **Task 3: Append the evaluation to the existing hourly cron (D-14)** — `21bc11c9` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update lands in the final commit below._

## Files Created/Modified

- `convex/costBudgetEval.ts` — `projectPeriodEndSpend`, `classifyBudgetLevel`, `buildAlertMessage`, `containsForbiddenEnforcementWord`, `evaluateBudgets`
- `convex/costBudgetEval.test.ts` — 28 unit tests (pure math, dedup/fire/isolation against a fake ctx, cron tail-append against the real `computeHourly` handler)
- `convex/aggregates.ts` — imports `evaluateBudgets`; `computeHourly` calls it at the tail inside a mandatory try/catch, passing the handler's own `now`

## Decisions Made

See frontmatter `key-decisions`. The most consequential: `evaluateBudgets` is called as a **plain function** against `computeHourly`'s own mutation `ctx` (direct `ctx.db`/`ctx.scheduler` access), not through the `ctx.runQuery`/`ctx.runMutation`/internal-function indirection `evalScores.ts`'s `detectRegressionsForPersona` uses — that indirection exists there because the regression detector is invoked as its own top-level scheduled action calling into internal queries/mutations across a `runAfter` boundary; `evaluateBudgets` instead runs *inside* the same `computeHourly` mutation execution, so it shares that mutation's transactional `ctx` directly, exactly like `costDerived.ts`'s `computePeriodSpend` already does for the same reason.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs or missing critical functionality discovered.

### Documented Deviations (not auto-fixed, judgment calls)

**1. The literal `grep -cE 'throttle|swap|disable' convex/costBudgetEval.ts` acceptance criterion cannot read 0 while `containsForbiddenEnforcementWord`'s guard exists as code.**
- **Where:** `FORBIDDEN_WORDS = ["throttle", "swap", "stop", "block", "disable", "cap enforced"]` (one line, executable, not a comment).
- **Why:** The plan's D-16 guard requires a function that can programmatically detect these words in generated alert copy — that function necessarily contains the words it's checking for, the same way a profanity filter's word list contains profanity. The plan's own acceptance grep (`outside comments explaining D-16`) implicitly assumed the guard would live only in prose, not in an enforceable, testable array.
- **Resolution:** Kept the array (testable, defensible) rather than obfuscating it into an unreadable form purely to satisfy a literal grep. The actual behavioral constraint — no message `buildAlertMessage` ever produces contains an enforcement word — is enforced in code and unit-tested (`buildAlertMessage` → "never contains any of the forbidden enforcement words" test, 3 representative messages) and additionally the constraint that `containsForbiddenEnforcementWord` correctly detects all 6 words is itself tested. The two file-level `DAILY_CAP` literal-substring occurrences (a separate acceptance criterion) *were* fixed by rewording, since those were pure prose with no functional need for the literal string.

**2. `evaluateBudgets`'s return type carries a fifth field (`skippedNoData`) beyond the four the plan's `<interfaces>` block lists.**
- **Why:** Task 2's action text explicitly requires counting quota budgets skipped for missing snapshot data "under a new `skippedNoData` return counter," but the `<interfaces>` contract block (written before Task 2's prose) only enumerates `evaluated/fired/skippedDeduped/errors`. The two are in tension; the more specific, later instruction (Task 2's own action text, plus its own test list explicitly asserting on `skippedNoData`) governs.
- **Resolution:** Kept `skippedNoData` as an additional field. No downstream consumer depends on the return shape being exactly four fields (nothing in plans 104-07/104-08/104-09 reads `evaluateBudgets`'s return value directly per their own summaries), so this is additive and non-breaking.

**Total deviations:** 2 documented (both judgment calls on ambiguous/contradictory plan wording, neither a bug or missing functionality). No Rule 1/2/3 auto-fixes were needed.

## Issues Encountered

- `convex/_generated/api.js`'s `anyApi` (`internal`/`api`) is a Proxy that returns a **fresh, non-`===`-stable object on every property access** and throws on any attempt to coerce it to a primitive (confirmed via a throwaway probe script: `String(internal.webhookDelivery.sendAlertWebhook)` throws `"Cannot convert object to primitive value"`). An initial test draft asserting `schedulerCalls[0].fn === internal.webhookDelivery.sendAlertWebhook` therefore failed unpredictably with a `PrettyFormatPluginError` during vitest's failure-diff formatting rather than a clean assertion failure. Fixed by following `convex/evalScores.test.ts`'s own established convention exactly: assert on the scheduled call's `delay` and `args` shape, never the function reference's identity.

## User Setup Required

None — this plan is pure evaluation logic riding tables and helpers plans 104-01/104-04/104-05 already created/seeded. The evaluator will only produce alerts once an operator has (a) run `costBudgets:seedFromLegacyCaps` (104-04, not yet run against the live deployment per that plan's own summary) or created budget rows via the future admin UI (104-08), and (b) run `modelPricing:seedDefaults` (104-01, also not yet run live) so `computePeriodSpend` can resolve rates. Both are pre-existing, already-documented operator actions from earlier plans in this phase — this plan adds no new one.

## Next Phase Readiness

- `convex/costBudgetEval.ts`'s exported interface (`projectPeriodEndSpend`, `classifyBudgetLevel`, `buildAlertMessage`, `evaluateBudgets`) matches the plan's `<interfaces>` contract (plus the additive `skippedNoData` field documented above) — no downstream plan in this phase currently reads it directly (104-07/104-08/104-09 build UI on top of `costBudgets`/`costDerived`/`gatewayQuota`, not on this evaluator's return shape).
- Plan 104-11's live timing check has a concrete table to measure against (see "Added Read Cost Per Invocation" above) rather than needing to re-derive the bound from source.
- The evaluator will not observably fire against the live self-hosted instance until an operator runs the two pending seed migrations noted under "User Setup Required" — this is expected and matches the pattern already established by plans 104-01/104-04 (seeds are manually operator-triggered, never a cron, per `CLAUDE.md`'s self-hosted Convex rules).

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

All 3 created/modified source files found on disk (`convex/costBudgetEval.ts`, `convex/costBudgetEval.test.ts`, `convex/aggregates.ts`) plus this SUMMARY. All 3 task commit hashes (`e9247b44`, `53e1005c`, `21bc11c9`) found in `git log --oneline --all`.
