---
phase: 105-tool-trace-observability
plan: 04
subsystem: api
tags: [convex, aggregates, alerts, toolPolicyEvents, toolExecutions, cron-tail-append, webhookDelivery]

# Dependency graph
requires:
  - phase: 105-03
    provides: the toolPolicyEvents table (by_event index) and provider-tagged toolExecutions rows this plan's aggregates/evaluator read
  - phase: 105-01
    provides: the bounded-read-with-truncation-flag pattern this plan's fetchToolRowsForWindow mirrors
provides:
  - "convex/toolPolicyAlertEval.ts — evaluateToolPolicyAlerts, alerting on exactly the two fail-open toolPolicyEvents kinds (malformed_policy_boot=error, malformed_policy_reload_rejected=warning), zero new crons"
  - "convex/aggregates.ts — four hourly tool_calls/tool_failures/tool_duration_ms/tool_duration_samples buckets per {tool, provider} dimension, each independently idempotent"
  - "computeHourly gains a SECOND, separate try/catch tail-append (evaluateToolPolicyAlerts) after the existing evaluateBudgets tail — convex/crons.ts and rollupDaily both untouched"
affects: [105-06, 105-07, 105-09]

tech-stack:
  added: []
  patterns:
    - "Per-kind isolation inside a shared evaluator (mirrors costBudgetEval.ts's per-budget-row isolation): one kind's throw is caught and counted, never blocking the other kind or the caller's own tail try/catch"
    - "Completed-hour-boundary dedup key (details.windowStart) instead of a 5-minute bucket — the evaluator only ever runs once per hour by construction, so the coarser key is sufficient and matches evaluateBudgets's own (budgetId, level, periodStart) shape"
    - "Absent-is-not-zero bucket writing: tool_failures always writes (real 0 when none), tool_duration_ms/tool_duration_samples write only when at least one row reported a numeric durationMs"

key-files:
  created:
    - convex/toolPolicyAlertEval.ts
    - convex/toolPolicyAlertEval.test.ts
  modified:
    - convex/aggregates.ts
    - convex/aggregates.test.ts

key-decisions:
  - "field/error are only ever rendered as a parenthetical PAIR in buildToolPolicyAlertMessage — if either is undefined, the whole parenthetical is omitted rather than mixing a real value with a fallback placeholder for the missing half. Matches how astridr actually emits the two malformed_policy_* kinds (always together, per convex/schema.ts's own toolPolicyEvents doc comment), and guarantees the message never contains the literal string 'undefined'."
  - "'most recent row' for the alert's field/error is rows[rows.length-1] from an ascending-by-timestamp .take(cap) read (no explicit .order() call, matching fetchLlmRowsForWindow's own convention) — correct except in the theoretical case a single hour hits POLICY_EVENT_READ_CAP=200 malformed-policy events, where it would report the 200th-earliest row's detail instead of the true latest. Not fixed: 200 events of ONE kind in one hour is itself the F4 boot-crash-loop scenario this alert exists to catch, and 'a boot-loop is happening' is the correct signal regardless of which row's exact error string surfaces first."
  - "Comment-trips-own-grep collision (same class 105-01/105-02/105-03 each independently hit): the file's own header/guard comments named the literal string 'sendAlertWebhook' three times, tripping the plan's acceptance grep requiring exactly 1. Reworded the two comment occurrences to describe the call site without repeating the literal function-reference substring, keeping the call site itself as the sole match."
  - "Task 2's tail-append ordering test uses Vitest's global mock.invocationCallOrder (comparable across DIFFERENT vi.fn() mocks in one file) instead of a database-row-ordering proxy — a more direct, less brittle way to prove evaluateToolPolicyAlerts runs strictly after evaluateBudgets than seeding fixtures that make both evaluators fire and comparing insert order."

requirements-completed: []  # OBS-01/02 NOT marked complete — this is plan 4/9 (aggregates + alert evaluator, Wave 3). Per this project's established "green suite/single-plan != live-verified end-to-end" convention (Phase 104 precedent, 105-01/105-03's own SUMMARYs), full requirement satisfaction is deferred until 105-09 confirms the whole pipe live against the running self-hosted instance — the four tool_* metric types and the fail-open alert path have never executed against real toolExecutions/toolPolicyEvents rows.

duration: 55min
completed: 2026-08-04
---

# Phase 105 Plan 04: Tool Usage Aggregates (D-04) + Fail-Open Policy Alert Evaluator (D-06) Summary

**Four new hourly `tool_calls`/`tool_failures`/`tool_duration_ms`/`tool_duration_samples` aggregate buckets per `{tool, provider}` dimension, plus a second `computeHourly` tail-append (`evaluateToolPolicyAlerts`) that alerts on exactly the two fail-open `toolPolicyEvents` kinds through Phase 104's existing insert-and-schedule path — zero new crons, `convex/crons.ts` and `rollupDaily` both untouched, nothing deployed.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 (both `type="auto"`, both `tdd="true"`)
- **Files modified:** 4 (2 created, 2 modified)
- **Completed:** 2026-08-04T00:10:59Z

## Accomplishments

- New `convex/toolPolicyAlertEval.ts`: `ALERTING_POLICY_KINDS` is exactly `["malformed_policy_boot", "malformed_policy_reload_rejected"]`; `policyAlertSeverity` never collapses the two (`"error"` for boot — degrades to a fully permissive policy, the worse case; `"warning"` for reload-rejected — fails safe, retains the last-known-good policy); `buildToolPolicyAlertMessage` truncates `error` at 200 chars with an explicit `[truncated]` marker and contains none of 8 forbidden enforcement-implying words, proven by a real test iterating the word list against both kinds' output
- `evaluateToolPolicyAlerts(ctx, nowSec)`: per-kind `try/catch` isolation (one malformed kind never blocks the other), a completed-hour-boundary dedup key stored in `details.windowStart` (real insurance against a boot-crash-loop emitting N events inside one hour firing N alerts instead of 1), inserts directly into `alerts` (never the public `alerts.create` mutation — Phase 104 D-17) and schedules `internal.webhookDelivery.sendAlertWebhook` as the ONLY thing this file ever schedules
- **D-06 isolation negative control** (the phase's own required proof): a window containing only `tool_call_leaked_as_text` and `execution_denied` events fires ZERO alerts and inserts nothing — proven by a dedicated test, and by mutation (temporarily adding `execution_denied` to `ALERTING_POLICY_KINDS` breaks the isolation test as required, then restored byte-identical)
- `convex/aggregates.ts` gained `fetchToolRowsForWindow` (a second bounded `toolExecutions` read, cap `TOOL_WINDOW_READ_CAP=4000`, same index-range-+-`.take()` shape as the existing `fetchLlmRowsForWindow` — never a paginate cursor loop) and `insertToolUsageBuckets`, writing all four metric types per `{tool, provider}` dimension, each behind its OWN idempotency guard
- Honesty invariants proven by test: `tool_failures` is written for EVERY `tool_calls` dimension including an all-success one (value `0`, not absent); `tool_duration_ms`/`tool_duration_samples` are written ONLY for dimensions where at least one row reported a numeric `durationMs` — a dimension that never reports a duration gets neither bucket, so the read path can render "n/a" instead of a fabricated `0ms`
- `computeHourly` gains a SECOND, separate `try/catch` tail-append (`evaluateToolPolicyAlerts`) immediately after the existing `evaluateBudgets` block — proven structurally separate via `sed`-extraction grep, and proven behaviorally via mock-spy tests: a rejection from either evaluator never suppresses the other, and `computeHourly` still resolves with its buckets intact
- `convex/crons.ts` and `rollupDaily` both confirmed untouched (`git diff --stat convex/crons.ts` empty; zero `rollupDaily` mentions in `aggregates.ts`'s diff) — D-04's generic `metric_type` + `JSON.stringify(dimensions)` grouping in `rollupDaily` already covers the four new metric types with no code change, matching Phase 104's own "do not add a metric-type-specific branch" warning
- 42 new test assertions (19 in `toolPolicyAlertEval.test.ts`, 23 in `aggregates.test.ts`) across every `<behavior>` bullet in both tasks; full suite 3305/3305 passing (up from 3263 pre-plan); `tsc --noEmit` and `npm run build` both clean

## Task Commits

Each task was committed atomically:

1. **Task 1: convex/toolPolicyAlertEval.ts — fail-open-only alerting** — `3a7ba659` (feat)
2. **Task 2: computeHourly — bounded tool read, four tool_* bucket types, and the evaluator tail** — `cde9f680` (feat)

## Files Created/Modified

- `convex/toolPolicyAlertEval.ts` — NEW. `ALERTING_POLICY_KINDS`, `POLICY_EVENT_READ_CAP=200`, `POLICY_ERROR_SNIPPET_LEN=200`, `policyAlertSeverity`, `buildToolPolicyAlertMessage`, `evaluateToolPolicyAlerts` — all exported
- `convex/toolPolicyAlertEval.test.ts` — NEW. 19 tests: kind list, severity mapping, message copy/truncation/forbidden-word gate, empty-window honesty, isolation negative control, N-events-one-alert, dedup, cross-kind escalation, per-kind throw isolation, severity/schedule shape, windowStart dedup key, cap-hit truncation flag, single-write guard
- `convex/aggregates.ts` — `TOOL_WINDOW_READ_CAP=4000` + `fetchToolRowsForWindow` (exported), `reconstructToolUsageKey`, `insertToolUsageBuckets`; `computeHourly` wired with the bounded tool read + a second, separate `try/catch` evaluator tail
- `convex/aggregates.test.ts` — pass-through `vi.mock` spies on `./costBudgetEval` and `./toolPolicyAlertEval` (mirroring the file's own established Task-3 convention from Phase 104 Plan 06); `makeAggregatesCtx` extended with `toolExecutions`/`costBudgets`/`toolPolicyEvents`/`alerts` fixtures and a `scheduler.runAfter` recorder (additive, all pre-existing tests unaffected); two new `describe` blocks: "tool usage buckets (Phase 105 D-04)" (7 tests) and "computeHourly — tool policy alert tail-append (D-06)" (5 tests)

## Decisions Made

See the `key-decisions` list in the frontmatter for the full text of each decision (the field/error parenthetical pairing rule, the "most recent row" read-order tradeoff and why it's acceptable, the comment-trips-own-grep fix, and the `invocationCallOrder`-based ordering proof).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `toolPolicyAlertEval.ts`'s own comments tripped its own acceptance-criteria grep**
- **Found during:** Task 1, running the acceptance-criteria greps before commit
- **Issue:** The file's header comment and the scheduler GUARD comment both named the literal string `sendAlertWebhook` in prose, making `grep -c "sendAlertWebhook" convex/toolPolicyAlertEval.ts` return 3 instead of the plan's required exactly-1 (the one real call site).
- **Fix:** Reworded both comments to describe the delivery function without repeating the literal substring — same explanation, no collision. Same class of fix 105-01/105-02/105-03 each independently hit (comment text explaining removed/added code trips the file's own acceptance grep).
- **Files modified:** convex/toolPolicyAlertEval.ts
- **Verification:** `grep -c "sendAlertWebhook" convex/toolPolicyAlertEval.ts` → `1`.
- **Committed in:** `3a7ba659`

---

**Total deviations:** 1 auto-fixed (Rule 1 — comment-text/acceptance-criteria collision introduced by this plan's own new code, same class three prior Phase 105 plans each independently hit). No production-behavior deviations from the plan's specified approach — both tasks implemented exactly as scoped, with the plan's own literal action text (interface shapes, dimension key format, metric type names) followed as written.

## Mutation Verification (required proof)

Every new/changed test was mutation-verified — production code temporarily broken, confirmed the corresponding test FAILS, then restored via a scratchpad byte-identical diff before re-running:

| Mutation | Target | Result |
|---|---|---|
| **Task 1's required proof:** temporarily added `"execution_denied"` to `ALERTING_POLICY_KINDS` | "ISOLATION CONTROL (D-06 negative control)" test | FAILED as required — `result.fired` was `1` instead of `0` (`expected 1 to be +0`). Restored, byte-identical (`diff` confirmed). |
| **Task 2's required proof:** `reconstructToolUsageKey`'s separator changed from `::` to `:` | "idempotency: re-running computeHourly for the same hour inserts nothing new for any of the four metric types" test | FAILED as required — a re-run doubled every bucket count (`{calls:2, failures:2, durationMs:2, durationSamples:2}` instead of all `1`s), proving the forward key (built in `insertToolUsageBuckets`) and the reconstruction key had silently diverged. Restored, byte-identical (`diff` confirmed). |

Both restores were confirmed via `diff <scratchpad-backup> <live-file>` printing no output before the final test run.

## Class-Closure Check (verification-discipline requirement)

The defect class this plan's own mutation proofs guard against — "a forward-built dimension key and its reconstruction-from-stored-row counterpart silently diverge, defeating the idempotency guard" — already has TWO other instances in this same file (`reconstructTokenSplitKey`/its forward key in `insertTokenSplitBuckets`, pre-existing from Phase 104) and this plan added a THIRD (`reconstructToolUsageKey`). Grepped `convex/aggregates.ts` for every `reconstruct*Key` function: exactly 2 exist (`reconstructTokenSplitKey`, `reconstructToolUsageKey`), each with its own dedicated idempotency test proving the pairing holds (the pre-existing "idempotency: running computeHourly twice over same goalId rows produces no new keys" test for the token-split key, and this plan's new mutation-verified test for the tool-usage key). No third, undiscovered forward/reconstruction pair exists in this file.

## Issues Encountered

None beyond the one documented deviation above.

## User Setup Required

None — no external service configuration required. **Nothing was deployed to the live self-hosted Convex instance in this plan**: no `npx convex deploy`, no `npx convex codegen` (neither `toolPolicyAlertEval.ts` nor the new `aggregates.ts` exports add a public Convex `query`/`mutation` — `fetchToolRowsForWindow`/`insertToolUsageBuckets`/`evaluateToolPolicyAlerts` are plain TypeScript functions called from inside the existing `computeHourly` internalMutation, so `convex/_generated/api.d.ts` needs no regeneration), no bulk delete/patch, no schema push. The live instance still runs pre-105-04 code; the four `tool_*` metric types and the fail-open alert path have never executed against real `toolExecutions`/`toolPolicyEvents` data. Deployment remains plan 105-09's step, per this project's CLAUDE.md self-hosted-Convex operational rules and the plan's own `<hard_constraints>`.

## Verification (raw output)

`npx tsc --noEmit` — clean, zero output, exit 0.

`npx vitest run` (full suite):
```
Test Files  267 passed | 17 skipped (284)
     Tests  3305 passed | 193 todo (3498)
```
(The "Not implemented: HTMLCanvasElement's getContext()" lines are pre-existing jsdom/canvas noise from unrelated WebGL-mocked test files — 0 failed tests.)

`npm run build` — succeeded (`✓ built in 1.24s`); pre-existing >500kB chunk-size warning, unrelated to this plan.

Targeted acceptance-criteria greps (all passed, final state):
- `grep -c "alerts.create" convex/toolPolicyAlertEval.ts` → `0`
- `grep -c "sendAlertWebhook" convex/toolPolicyAlertEval.ts` → `1`
- `grep -c 'gte("createdAt", windowStart)' convex/toolPolicyAlertEval.ts` → `1`
- `npx vitest run convex/toolPolicyAlertEval.test.ts` → 19 tests, exit 0, incl. one whose name contains `ISOLATION` and one whose name contains `dedup`
- `git diff --stat convex/crons.ts` → empty (F1 hard constraint, asserted not assumed)
- `git diff convex/aggregates.ts | grep -c "rollupDaily"` → `0`
- `grep -c "evaluateToolPolicyAlerts" convex/aggregates.ts` → `2` (import + call)
- `sed -n '/budget eval failed/,/tool policy alert eval failed/p' convex/aggregates.ts | grep -c "try {"` → `1` (separate try/catch, not merged)
- `grep -c "tool_duration_samples" convex/aggregates.ts` → `3`
- `npx vitest run convex/aggregates.test.ts` → 49 tests, exit 0 (34 pre-existing + baseline growth to 37 + 12 new tool-bucket/tail-append tests = 49; well above the plan's "at least 44" floor)
- `git diff --stat package.json package-lock.json` → empty (T-105-SC: zero packages installed)

## Added Read Cost Per Invocation (for plan 105-09's live timing check)

Per `computeHourly` invocation, the D-06 evaluator adds, at most:
- **2 `toolPolicyEvents` `by_event` index-range reads** (one per `ALERTING_POLICY_KINDS` entry), each capped at `POLICY_EVENT_READ_CAP=200` rows.
- **Up to 2 `alerts` `by_source` index reads** (dedup), one only for a kind that had ≥1 event in the window — bounded by however many prior alerts share that exact `tool-policy:{kind}` source string, which the per-completed-hour dedup key keeps to at most one per hour.
- **Up to 2 `alerts` inserts + 2 `sendAlertWebhook` schedules**, only when a kind both has events AND is not already deduped.

Separately, the D-04 tool-usage buckets add one bounded `toolExecutions` `by_timestamp` index-range read per hour, capped at `TOOL_WINDOW_READ_CAP=4000` (structurally identical to the existing `LLM_WINDOW_READ_CAP=4000` `llmMetrics` read `computeHourly` already performs), plus up to 4 `aggregates` `by_type_period_bucket` reads (one per metric type's idempotency guard) and up to 4×N inserts (N = distinct `{tool, provider}` dimensions observed that hour).

## Next Phase Readiness

- Plan 105-06 (Tools page) can now read the four `tool_*` hourly/daily aggregate buckets for "over time" charts that survive the 14-day `toolExecutions` prune, once 105-09 deploys and the cron has run at least one live hour.
- Plan 105-07 (policy feed UI) is unaffected by this plan (reads `toolPolicyEvents.recent`/`lastReceivedAt`/`countsByKind` directly, from 105-03) — this plan adds the ALERT path on top, not a read surface.
- **Nothing has been deployed.** The live self-hosted Convex instance still runs pre-105-04 code; `computeHourly`'s tool-usage buckets and the fail-open policy alert path have never executed against real data. D-06's alert path in particular needs a real `malformed_policy_boot`/`malformed_policy_reload_rejected` event (or an induced one, per D-07's "prove it live rather than ship into an unprovable empty view" decision) to be genuinely live-verified — this is explicitly plan 105-09's job.
- The "most recent row" read-order tradeoff (key-decisions) is a known, accepted, non-blocking limitation — flagged for awareness, not a defect requiring a follow-up plan.

---
*Phase: 105-tool-trace-observability*
*Completed: 2026-08-04*

## Self-Check: PASSED

All 4 key files confirmed present on disk (`convex/toolPolicyAlertEval.ts`, `convex/toolPolicyAlertEval.test.ts`,
`convex/aggregates.ts`, `convex/aggregates.test.ts`); both task commit hashes (`3a7ba659`, `cde9f680`)
confirmed present in `git log`.
