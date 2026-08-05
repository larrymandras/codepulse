---
phase: 107-aggregates-rollup-sharding
plan: 01
subsystem: testing
tags: [convex, vitest, tdd, occ, aggregates, sharding]

# Dependency graph
requires: []
provides:
  - "Wave-0 write-path shard contract (convex/analyticsRollup.test.ts): explicit-shard call sites, shard-split/legacy-unsharded assertions, pickShard range contract"
  - "Wave-0 ingest contract (convex/events.test.ts): one shard drawn per events.ingest call, shared by all three aggregate writes"
affects: [107-02, 107-03, 107-04, 107-05, 107-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic-import module guard (@vite-ignore, try/catch to null) for a not-yet-shipped module — extended to a second guard (shardLib / convex/lib/aggregateShard) alongside the existing rollup guard, same file"
    - "Local-per-file fake ctx (query/withIndex/collect/first/insert/patch) instead of a shared harness, when two test files exercise different callers"

key-files:
  created:
    - convex/events.test.ts
  modified:
    - convex/analyticsRollup.test.ts

key-decisions:
  - "Followed CONTEXT.md D-01 exactly: shard is an explicit parameter in tests (no Math.random() dependency in the test file itself); production code (107-03) draws it once per ingest and passes it down"
  - "D-04's strict-equality contract (r.shard === shard, not (r.shard ?? 0) === shard) encoded directly in the legacy-row test — a pre-existing unsharded row is retired, not patched, by a sharded write"

patterns-established:
  - "Wave-0 RED tests guard on `!rollup || typeof rollup.X !== 'function'` and THROW a descriptive error naming the plan that will implement it, so the suite REDs cleanly instead of erroring the file at import/collection time"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-08-05
---

# Phase 107 Plan 01: Aggregates Rollup Sharding — Wave-0 Write-Path Tests Summary

**Wave-0 TDD contract for aggregate sharding: six shard-aware tests in `analyticsRollup.test.ts` plus a new `events.test.ts` exercising the real `ingest` mutation — all RED for the right reasons, zero production files touched.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-05T14:20:00Z (approx, from STATE.md session marker)
- **Completed:** 2026-08-05T14:32:00Z
- **Tasks:** 3 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- Every existing `incrementEventBucket`/`incrementSankeyBuckets` call site in `analyticsRollup.test.ts` now passes an explicit shard (0, or 0/3/1/2/5 where the test needs a specific split) — no test in this file depends on an implicit `Math.random()` draw, so the "increment patch-or-insert" test can never flake once 107-03 lands
- A second dynamic-import guard (`shardLib`, mirroring the existing `rollup` guard) loads `./lib/aggregateShard` — degrades cleanly to `null` today since the module doesn't exist until 107-03
- Six new `describe("shard", ...)` tests encode the full write-path contract as executable assertions: same-shard patch, cross-shard split with a SUMMED-value assertion (not just row count), the D-04 legacy-unsharded-row non-patch guarantee (unchanged legacy value + correct cross-row sum), two-edges-per-sankey-call with the passed shard, cross-shard sankey edge totals, and `pickShard()`'s range contract across 200 draws (no distribution assertion — that would be flaky)
- New `convex/events.test.ts` proves, on the REAL registered `ingest` mutation (via `._handler`, this repo's established convention — no `convex-test` dependency), that one ingest call draws exactly one shard shared by all three aggregate writes, that the shard varies across calls (catching a hardcoded-shard regression the single-call test alone would miss), and that a deduplicated ingest still writes zero rows on the repeat call

## Task Commits

Each task was committed atomically:

1. **Task 1: Make every existing write-path call site shard-explicit** — `d3d6ca14` (test)
2. **Task 2: Shard-split and legacy-unsharded write-path tests (RED until 107-03)** — `f486fdd5` (test)
3. **Task 3: New convex/events.test.ts — one shard per ingest call, shared by all three writes** — `3b1f6241` (test)

_Task 2 rides on Task 1's file (`analyticsRollup.test.ts`) as a pure insertion — the plan-required RED status was verified independently at each commit boundary by temporarily removing/re-adding the new `describe("shard", ...)` block, so each commit's diff matches its task exactly._

## Files Created/Modified

- `convex/analyticsRollup.test.ts` — `RollupModule` type widened (4th `shard` param on `incrementEventBucket`, new `incrementSankeyBuckets` declaration); `ingestWithDedup` accepts an optional `shard` (default 0); a second `shardLib` dynamic-import guard added; the three pre-existing call sites pinned to explicit shard 0; new `describe("shard", ...)` block with 6 tests
- `convex/events.test.ts` (new) — local fake ctx (query/withIndex/collect/first/insert/patch) exercising the real `ingest` mutation via `(ingest as any)._handler(ctx, args)`; 3 tests (2 RED, 1 GREEN)

## Decisions Made

- Where the plan's task boundaries fell on non-overlapping insertions within the same file (Task 1 vs Task 2, both in `analyticsRollup.test.ts`), split the commits by temporarily removing the Task 2 block, committing Task 1's diff, then re-adding it and committing Task 2's diff — preserves per-task atomicity without a squashed multi-task commit
- Followed the plan's interface contract verbatim (no deviation from the documented `incrementEventBucket`/`incrementSankeyBuckets`/`pickShard` signatures) — the live `convex/analyticsRollup.ts` and `convex/events.ts` were read in full before writing any test to confirm the current (pre-107-03) behavior these tests describe the delta from

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria verified directly (grep counts, tsc, targeted vitest runs) rather than assumed; see Self-Check below.

## Issues Encountered

None. The plan's own stated expectation — tests 1&2 in `events.test.ts` and all 6 tests in the new `shard` describe block RED, with failure messages naming the missing shard parameter, missing `./lib/aggregateShard` module, or absent `shard` field (never a syntax/import error killing the file) — was verified to hold exactly as designed.

## Live Evidence Disclaimer (D-05 / T-107-02)

This plan produces **no live evidence**. All tests here are in-memory unit tests against a fake `ctx.db`; nothing was deployed, and no OCC-retry-rate measurement was taken. Proof that OCC contention actually dropped is owned exclusively by plans 107-04 and 107-06, per the plan's own truth D-05 and the phase's `107-VALIDATION.md` "Dangerous (False-Green) Assertions" list. Green tests here prove correctness of the write-path shard contract only.

## Next Phase Readiness

- Tests 1 and 2 in `events.test.ts` and all 6 tests in `analyticsRollup.test.ts`'s new `shard` describe block are confirmed RED for the correct reason (missing `shard` field / not-yet-implemented `incrementSankeyBuckets`/`pickShard`) — ready for plan 107-03 to turn them GREEN by landing the sharded production code (`convex/lib/aggregateShard.ts` with `AGGREGATE_SHARD_COUNT`/`pickShard`, the 4th/5th `shard` params on `incrementEventBucket`/`incrementSankeyBuckets`, and the `events.ts` `ingest` mutation drawing one shard per call)
- No blockers. `npx tsc --noEmit` clean; `git status --porcelain convex/analyticsRollup.ts convex/events.ts convex/schema.ts convex/lib` empty (zero production files touched)

## Self-Check: PASSED

All created files and all 4 commit hashes verified present.

---
*Phase: 107-aggregates-rollup-sharding*
*Completed: 2026-08-05*
