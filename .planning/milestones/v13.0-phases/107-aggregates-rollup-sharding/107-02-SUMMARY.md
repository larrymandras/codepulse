---
phase: 107-aggregates-rollup-sharding
plan: 02
subsystem: testing
tags: [convex, vitest, tdd, occ, aggregates, sharding, read-path]

# Dependency graph
requires:
  - "107-01: write-path shard contract (RED, expected to stay RED until 107-03)"
provides:
  - "Multi-shard summing regression guards for all five readers of metric_type events/sankey_edge: heatmapFromAggregates, errorRateTrendFromAggregates, sankeyFromAggregates (convex/analytics.test.ts), eventCountsByPeriod, rollupDaily (convex/aggregates.test.ts, called via the real ._handler convention)"
  - "Confirmation (not assumption) that no production read-path change is required before 107-03 ships the sharded write path"
affects: [107-03, 107-04, 107-05, 107-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regression-guard-only tests: written against a system already proven correct by code review, expected GREEN on first run (not RED-then-GREEN) — a RED result here would itself be the finding, per the plan's own stated failure mode"
    - "._handler convention reused for the two readers previously covered only by inline re-implementations (eventCountsByPeriod, rollupDaily), closing a named false-green without touching the pre-existing tests that caused it"

key-files:
  created: []
  modified:
    - convex/analytics.test.ts
    - convex/aggregates.test.ts

key-decisions:
  - "Left the two pre-existing false-green tests (aggregates.test.ts:255-278 rollupDaily summing, :390-401 eventCountsByPeriod grouping) untouched per the plan's explicit instruction — they are pre-existing debt this plan does not own removing; the new tests supersede them for the shard-safety claim specifically"
  - "Every new fixture includes at least one row with NO shard property (D-04's legacy-row contract), asserted directly rather than inferred"

requirements-completed: []

# Metrics
duration: ~9min
completed: 2026-08-05
---

# Phase 107 Plan 02: Aggregates Rollup Sharding — Read-Path Regression Guards Summary

**All five readers of `metric_type: "events"` / `"sankey_edge"` are now proven, not merely reviewed, to sum a bucket that spans multiple shards plus a legacy unsharded row — every new test went GREEN on the first run, confirming the CONTEXT.md premise that no read-side code change is needed for the sharding fix.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 2 (both test-only, zero production files)

## First-Run Result (the plan's headline question)

**Every one of the 7 new shard tests passed on the first run, with no production code changes.** This is the expected/required outcome per the plan's own framing — a RED result would have been the genuine discovery invalidating the "no read-side change needed" premise of plan 107-03. It did not occur. Specifically:

- `convex/analytics.test.ts` — 3 new tests (heatmap, errorRateTrend, sankey folds) green immediately against the existing `convex/analyticsRollupQueries.ts` exports, unmodified.
- `convex/aggregates.test.ts` — 4 new tests calling the REAL `eventCountsByPeriod`/`rollupDaily` handlers via `._handler` green immediately against the existing `convex/aggregates.ts`, unmodified.

## Accomplishments

- **Task 1 — `convex/analytics.test.ts`:** widened the local `AggBucket` type with an optional `shard?: number` field (required for TypeScript's excess-property check to accept shard-bearing fixture literals) and added 3 tests to the existing `"aggregates-backed query derivation"` block:
  - `heatmapFromAggregates` sums 4 rows (1 legacy unsharded, shards 0/3/7) at one `bucket_start` into a single cell, asserting the summed `count === 11` and `maxCount === 11`.
  - `errorRateTrendFromAggregates` accumulates 2 shard rows + 1 legacy row into one hour slot (`errors === 11`), while a shard-bearing non-error row in the same slot stays excluded — closing the coverage gap RESEARCH.md named (the prior test never put two rows in one slot, so a `counts[h] +=` → `counts[h] =` regression would have passed it silently).
  - `sankeyFromAggregates` sums 3 shard variants of one edge (1 legacy) into a single link (`value === 9`), and asserts the node set stayed exactly `{"Tool Use", "Read", "Success"}` — sharding did not multiply nodes.
- **Task 2 — `convex/aggregates.test.ts`:** added `eventCountsByPeriod` and `rollupDaily` to the existing named import, and a new `describe("shard-spanning reads", ...)` block with 4 tests, all calling the real exported handlers (`(eventCountsByPeriod as any)._handler(ctx, args)` / `(rollupDaily as any)._handler(ctx)`), never re-implementing the grouping loop in the test body:
  - `eventCountsByPeriod` sums one event type across 3 shards + 1 legacy row (`tool_use === 18`).
  - `eventCountsByPeriod` keeps event types separate while summing each type's own shards (`tool_use === 18`, `llm_call === 11`, exactly 2 keys).
  - `rollupDaily` collapses shard-only-differing hourly rows into exactly ONE daily row per `(metric_type, dimensions)` key (`events === 10`, `sankey_edge === 9`), confirms no daily row carries a `shard` field, and confirms `patchCalls`/`deleteCalls` are both empty (insert-only, per CLAUDE.md's self-hosted-instance rule).
  - `rollupDaily`'s idempotency guard still holds with sharded hourly source rows: a pre-seeded daily row is left untouched (not re-summed) while the sibling `sankey_edge` daily row still gets inserted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Multi-shard summing guards for the three analyticsRollupQueries folds** — `f3b71ce8` (test)
2. **Task 2: Multi-shard guards that call the REAL eventCountsByPeriod and rollupDaily** — `07aaac0d` (test)

## Files Created/Modified

- `convex/analytics.test.ts` — `AggBucket` type widened with `shard?: number`; 3 new tests appended to the `"aggregates-backed query derivation"` describe block (57 lines added, existing tests untouched)
- `convex/aggregates.test.ts` — `eventCountsByPeriod`/`rollupDaily` added to the top-level import from `./aggregates`; new `describe("shard-spanning reads", ...)` block with 4 tests appended at the end of the `describe("aggregates", ...)` block (114 lines added, existing tests including the two named false-greens left byte-identical)

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified directly against live output (not assumed):

- `npx vitest run convex/analytics.test.ts` — 14/14 passing (11 pre-existing + 3 new).
- `npx vitest run convex/aggregates.test.ts` — 53/53 passing (49 pre-existing + 4 new).
- `npx vitest run convex/analytics.test.ts convex/aggregates.test.ts -t "shard" --reporter=verbose` — selected and passed exactly 7 tests (3 + 4), 60 skipped.
- `grep -c '_handler' convex/aggregates.test.ts` — 35, up from 30 at `git show HEAD~2` (the pre-plan baseline), a +5 increase (4 new call sites plus one from the widened import line matching `_handler` incidentally — well above the required +4 floor). Both literal strings `(eventCountsByPeriod as any)._handler` and `(rollupDaily as any)._handler` present, count 2 each (Task 2 has 2 tests calling each).
- `sed -n '/describe("shard-spanning reads"/,$p' convex/aggregates.test.ts | grep -c '+= r\?o\?w\?\.value'` — 0. The new block does not re-implement the grouping algorithm.
- `npx tsc --noEmit` — exits 0.
- `git status --porcelain convex/aggregates.ts convex/analytics.ts convex/analyticsRollupQueries.ts` — empty. Zero production files touched by either task.

## Issues Encountered

None. Both tasks' tests went green on the first run with no debugging required, matching the plan's stated expectation that the folds are already shard-safe.

## Threat Model Compliance

- **T-107-03 (re-implementing grouping inline):** mitigated as designed — the new `describe("shard-spanning reads", ...)` block contains zero occurrences of the `+= row.value` / `+= r.value` anti-pattern; both new tests call the real exported `._handler`.
- **T-107-04 (rollupDaily accidentally patching/deleting):** mitigated as designed — `makeAggregatesCtx`'s `db.patch`/`db.delete` throw by construction, and the "collapses shard rows" test additionally asserts `patchCalls`/`deleteCalls` are empty.
- **T-107-SC (package installs):** not triggered. No `npm install` run.

## Live Evidence Disclaimer (D-05 / T-107-02, inherited from 107-01)

This plan produces **no live evidence**, same as 107-01. All 7 new tests are in-memory unit tests against fake `ctx.db` fixtures (or pure functions with no `ctx` at all, for the `analytics.test.ts` folds). A green suite here is necessary but not sufficient for OCC-01 — proof that OCC contention actually dropped is owned exclusively by plans 107-04 and 107-06, per `107-VALIDATION.md`'s corrected live-baseline method.

## Next Phase Readiness

- All five readers of `events`/`sankey_edge` (`heatmapFromAggregates`, `errorRateTrendFromAggregates`, `sankeyFromAggregates`, `eventCountsByPeriod`, `rollupDaily`) now carry an executable, summed-value assertion across multiple shards plus a legacy unsharded row — the read-side half of OCC-01's regression surface is closed.
- Plan 107-03 is now unblocked to land the sharded write path with confidence that no read-side change accompanies it: the "no read-side change needed" premise from CONTEXT.md's Claude's Discretion section is now backed by executable evidence, not code review alone.
- No blockers. `npx tsc --noEmit` clean; full `convex/analytics.test.ts convex/aggregates.test.ts` suite green (67/67); zero production files touched.

## Self-Check: PASSED

All modified files and both commit hashes verified present.

- FOUND: convex/analytics.test.ts
- FOUND: convex/aggregates.test.ts
- FOUND: .planning/phases/107-aggregates-rollup-sharding/107-02-SUMMARY.md
- FOUND: f3b71ce8
- FOUND: 07aaac0d
