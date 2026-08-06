---
phase: 104-cost-intelligence
plan: 03
subsystem: database
tags: [convex, cost-intelligence, aggregates, rollup, backfill, self-hosted-convex]

# Dependency graph
requires:
  - phase: 104-01
    provides: "convex/modelPricing.ts's resolveRate/priceTokens — the read-path consumer these token buckets exist to feed (not called by this plan)"
provides:
  - "convex/aggregates.ts computeHourly emitting tokens_prompt/tokens_completion hourly buckets on the existing {provider, model, billingType, goalId} dimension key"
  - "convex/aggregates.ts backfillTokenSplit — a manually-invoked, resumable, insert-only backfill of historical token-split buckets, batch-capped at maxHours (default 6)"
  - "insertTokenSplitBuckets/fetchLlmRowsForHour shared helpers (non-exported) so the live cron and the manual backfill cannot drift"
affects: [104-05, 104-08, 104-09, 104-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real mutation-handler testing via the exported function's ._handler escape hatch against a hand-rolled fake ctx.db (query/withIndex/filter/collect/first/paginate/insert only — patch/delete THROW), matching the convex-test-free convention from convex/modelPricing.test.ts"
    - "Insert-only cursor storage in agentConfigs (newest row by default collect() order wins) instead of ctx.db.patch, so a mutation that must never patch/delete an existing row stays insert-only end to end, including its own resume-state bookkeeping"

key-files:
  created: []
  modified:
    - convex/aggregates.ts
    - convex/aggregates.test.ts

key-decisions:
  - "Task 1 first inlined the two token-split accumulate+guard+insert blocks directly in computeHourly (structural copy of the existing 'tokens' block); Task 2 then factored that inlined logic into a shared insertTokenSplitBuckets helper and added backfillTokenSplit on top of it — matching the plan's own task boundaries (Task 2's action text explicitly assigns the extraction to Task 2)."
  - "Retention floor resolved from agentConfigs['retention_days'] (convex/archival.ts's disabled markStaleArchived cron's own config value, default 30, clamped 1-365) rather than convex/retention.ts's RETENTION_DAYS map — verified live that retention.ts's own comment excludes llmMetrics from its PRUNED_TABLES ('Aggregates, llmMetrics (cost history) ... are kept forever'), so it defines no retention window for this table at all. archival.ts is the sibling retention module that actually governs llmMetrics; reusing its existing config value (rather than hardcoding a second, independent retention number) is the only way to satisfy the plan's 'do not hardcode a second retention number' instruction given what the code actually contains."
  - "backfillTokenSplit's resume cursor is written via ctx.db.insert only, never ctx.db.patch — even though the plan's INSERT-ONLY rule text scopes explicitly to 'an existing aggregates row', the plan's own acceptance criteria (`grep -c 'db.delete|db.patch' convex/aggregates.ts` returns 0) and the required unit test ('the mutation issues no db.patch and no db.delete call on the fake ctx') check the whole file/mutation with no such scoping. Treated the stricter, literal, testable requirement as authoritative; the cursor is now an append-only log read by taking the most recently inserted row for its configKey."
  - "insertTokenSplitBuckets/fetchLlmRowsForHour live above computeHourly's own read pagination and below the cost/tokens insert loops it doesn't touch — computeHourly's Task-1-era inline pagination block (lines ~18-32) was left byte-identical throughout both tasks, per the plan's explicit 'do not change the existing costByDim/tokensByDim lines' instruction."

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-07-31
---

# Phase 104 Plan 03: Cost Intelligence Rollup Widening (Token Split + Backfill) Summary

**`computeHourly` now writes `tokens_prompt`/`tokens_completion` hourly buckets alongside the existing `cost`/`tokens` buckets on the same dimension key, and a new manually-invoked `backfillTokenSplit` mutation fills the same split for history — both insert-only, both batch-capped, neither on a cron — so a `modelPricing` rate correction can re-price every chart back to the configured retention floor at read time (D-04).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-31T13:38:00Z
- **Completed:** 2026-07-31T14:03:00Z
- **Tasks:** 2
- **Files modified:** 2 (`convex/aggregates.ts`, `convex/aggregates.test.ts`)

## Accomplishments

- `computeHourly` gained two new hourly aggregate buckets, `tokens_prompt` and `tokens_completion`, on the identical `{provider, model, billingType, goalId}` 4-segment dimension key the existing `cost`/`tokens` buckets already use — filled from the single already-fetched, already-paginated `llmRows` pass (no second scan over `llmMetrics`). Each new metric type has its own independent per-dimension-key idempotency guard, so a partially-completed cron re-run cannot double-count one split half while correctly skipping the other.
- `rollupDaily` needed zero code changes — it already groups generically by `metric_type` + `JSON.stringify(dimensions)`, so the two new metric types roll into daily buckets automatically. Added a comment recording that fact so a future reader doesn't "fix" it.
- Refactored the accumulate+guard+insert logic into a shared, non-exported `insertTokenSplitBuckets(ctx, hourStart, llmRows)` helper, used by both `computeHourly` (the live hourly cron) and the new `backfillTokenSplit` (below) — the two paths cannot drift from each other.
- Added `backfillTokenSplit`, a manually-invoked, resumable `internalMutation` (`npx convex run aggregates:backfillTokenSplit '{"maxHours": 6}'`, repeated until `done` is `true`) that walks backward one hour at a time from the most recent complete hour, filling the same `tokens_prompt`/`tokens_completion` split for historical hours. Hard-capped at `maxHours` (default 6) per invocation, paginated 500-row `llmMetrics` reads (same shape as `computeHourly`'s), fully insert-only (no `db.patch`/`db.delete` anywhere in the file — verified by grep and by a dedicated unit test against a fake ctx that throws if either is called), and deliberately **not** registered on a cron (`convex/crons.ts` unchanged — 0 matches).
- Resume position lives in `agentConfigs["phase104.tokenSplitBackfill.cursor"]`, itself written insert-only (the newest row for that `configKey`, by Convex's default ascending-`_creationTime` `collect()` order, is the live cursor) rather than patched — keeping the entire mutation insert-only end to end, including its own bookkeeping.
- 10 new unit tests exercise the real `computeHourly`/`backfillTokenSplit` handlers via `._handler` against a hand-rolled fake `ctx.db` (query/withIndex/filter/collect/first/paginate/insert; `patch`/`delete` throw) — covering dimension-key sharing with `cost`, dimension summation, goalId separation, the independent-guard re-run case, the `?? 0` NaN guard, the `maxHours` cap, `nextCursor` arithmetic, the retention-floor terminal sentinel, and the no-patch/no-delete invariant.
- Full repo suite: 3002/3002 tests passing (243 files), `npx tsc --noEmit` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Emit tokens_prompt and tokens_completion hourly buckets from computeHourly** — `e1a514a0` (feat)
2. **Task 2: Add a resumable, batch-capped backfill for the split token buckets** — `f700a85e` (feat)

_No plan-metadata commit yet — this SUMMARY + STATE/ROADMAP update lands in the final commit below._

## Files Created/Modified

- `convex/aggregates.ts` — `computeHourly` widened with two new hourly buckets; `insertTokenSplitBuckets`/`reconstructTokenSplitKey`/`fetchLlmRowsForHour` shared helpers added; `backfillTokenSplit` internalMutation added; `rollupDaily` gained an explanatory comment (no behavior change)
- `convex/aggregates.test.ts` — fake-ctx test harness (`makeAggregatesCtx`) + `currentHourStart()` helper added; `describe("token split")` (5 tests) and `describe("backfill")` (5 tests) added

## Decisions Made

- **Retention floor is `agentConfigs["retention_days"]`, not `convex/retention.ts`.** The plan's own `read_first` list frames `retention.ts` as "the file that defines how far back raw llmMetrics rows survive." Reading it live showed the opposite: `RETENTION_DAYS`/`PRUNED_TABLES` in that file explicitly excludes `llmMetrics` — its own header comment states "Aggregates, llmMetrics (cost history), sessions, alerts, and config/audit tables are kept forever." The retention window that actually governs `llmMetrics` specifically is the (currently-disabled) `markStaleArchived` cron's own config value in `convex/archival.ts` (`agentConfigs["retention_days"]`, default 30, clamped 1-365 by `setRetentionDays`). Using that existing, already-configurable value is the only way to honor the plan's "do not hardcode a second, independent retention number" instruction given what the code actually contains — CLAUDE.md's Stale Docs rule ("trust the code ... say so explicitly") applied here to the plan's own framing, not just a comment.
- **Cursor writes are insert-only, per the literal (not the prose-scoped) acceptance criteria.** The plan's action text scopes "INSERT-ONLY... never patches" to "an existing aggregates row," which would permit `ctx.db.patch` on the `agentConfigs` cursor row. But the plan's acceptance criteria (`grep -c 'db.delete|db.patch' convex/aggregates.ts` → 0) and the required unit test ("issues no db.patch and no db.delete call on the fake ctx") check the whole file/mutation, with no such scoping. Built the cursor as an append-only log instead (read: take the most recently inserted row for that `configKey`; write: always `insert`, never `patch`) so both the prose intent and the literal, testable requirement hold simultaneously.
- **Task boundary matched the plan's own task split, not "most efficient diff."** Task 1's action text describes inlining two structural copies of the existing `tokens` block directly in `computeHourly`, with no mention of factoring; Task 2's action text explicitly assigns "Factor the accumulate+guard+insert logic out of computeHourly into a shared non-exported helper" to itself. Implemented literally in that order (inline in Task 1's commit, refactored + extended in Task 2's commit) rather than writing the final refactored shape once and back-filling two commits from it — this keeps each commit's diff matching what its own task actually asked for.
- **`fetchLlmRowsForHour`'s pagination is a second copy of `computeHourly`'s inline pagination block, not a shared extraction.** The plan asks Task 2 to factor only "the accumulate+guard+insert logic," and separately instructs "do not change the existing costByDim/tokensByDim lines" in Task 1 — read together as: leave `computeHourly`'s own read path untouched, and give the backfill its own structurally-identical read function. `computeHourly`'s pagination block (lines ~14-32) is byte-identical to before this plan across both commits.

## Deviations from Plan

None — the two "Decisions Made" items above (retention-floor source, insert-only cursor scope) are documented interpretations of ambiguous/contradictory plan text applied consistently with the plan's own stated intent and literal acceptance criteria, not scope or behavior changes beyond what the plan asked for. No Rule 1-4 auto-fixes were needed.

## Issues Encountered

- A TypeScript `TS7022` self-referential-type error appeared in `fetchLlmRowsForHour` when the loop's paginated-page variable was named `page` and destructured inline (`const page = await ...; rows.push(...page.page); ...`) — TS's inference got confused by the `page.page` property access on an unannotated `any`-derived chain. Fixed by adding an explicit `{ page: ...; isDone: boolean; continueCursor: string }` type annotation and renaming the variable to `result` (Rule 3 — blocking issue, fixed inline, verified via a clean `npx tsc --noEmit` immediately after).

## User Setup Required

- **`backfillTokenSplit` has not been run against the live self-hosted deployment.** It must be invoked manually and repeatedly (`npx convex run aggregates:backfillTokenSplit '{"maxHours": 6}'`) until the returned `done` field is `true`, to backfill history back to the retention floor. Per the plan's `<output>` instruction:
  - **Retention floor:** with the default/unconfigured `agentConfigs["retention_days"]` value (30 days), the backfill reaches back **30 days × 24 hours = 720 hours**.
  - **Invocations needed:** at the default `maxHours: 6` per call, a full backfill to the retention floor takes **⌈720 / 6⌉ = 120 invocations**. (If an operator has configured a different `retention_days` value via `archival.setRetentionDays`, or passes a larger `maxHours`, the count scales accordingly — e.g. the 365-day maximum would be 8760 hours / 6 = 1460 invocations at the default batch size, or fewer at a larger `maxHours`.)
  - No plan-04+ surface (breakdown table, unpriced nudge) depends on the historical backfill having run yet to show CURRENT-hour data — only the "re-price all of history" half of D-04 depends on it.

## Next Phase Readiness

- `convex/aggregates.ts` now emits the exact `tokens_prompt`/`tokens_completion` interface contract 104-03-PLAN.md's frontmatter specifies (`period: "hourly"`, same 4-segment dimension key as `cost`/`tokens`) — plan 104-05's read-time-derivation query can consume these buckets unchanged.
- `rollupDaily` requires no further change for the daily-period equivalents of these two new metric types — they already roll up.
- The backfill is code-complete and unit-tested but not yet run live; that live invocation (120 calls at the default batch size, for the default 30-day retention window) is an operator/orchestrator action, not part of this plan's scope, matching the established pattern from 104-01's `seedDefaults` (also code-complete, not yet run live).

---
*Phase: 104-cost-intelligence*
*Completed: 2026-07-31*

## Self-Check: PASSED

Both modified files found on disk (`convex/aggregates.ts`, `convex/aggregates.test.ts`), plus this SUMMARY. Both commit hashes (`e1a514a0`, `f700a85e`) found in `git log --oneline --all`.
