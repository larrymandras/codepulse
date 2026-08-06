---
phase: 107-aggregates-rollup-sharding
plan: 07
subsystem: backend
tags: [convex, occ, aggregates, indexing, performance, measurement-methodology]

# Dependency graph
requires:
  - phase: 107-aggregates-rollup-sharding
    provides: "107-03's write-path sharding (shard field, one draw per ingest) and 107-06's FAIL verdict, which correctly diagnosed the read set as the unfixed half"
provides:
  - "Ingest read set narrowed from the whole bucket (101 rows) to a single row via a denormalised indexed dimension key + shard"
  - "OCC-01 SATISFIED: 0 aggregates OCC conflicts across 11.6 h / 176 ingests, against 51-428 expected under old-code rates"
  - "A test harness that can actually detect read-set width — the previous fake could not"
  - "A validated log-measurement method, replacing docker logs --since, calibrated against 107-06's published numbers"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Denormalise an unindexable v.any() field into an indexed string so a hot-path lookup can pin every field with eq() — read set goes from a bucket scan to a point read, which is what Convex OCC actually conflicts on"
    - "Before trusting a measurement instrument, run a positive control that reproduces a known-good published answer with it"

key-files:
  created:
    - convex/lib/aggregateDimensionKey.ts
    - .planning/phases/107-aggregates-rollup-sharding/107-07-PLAN.md
  modified:
    - convex/analyticsRollup.ts
    - convex/schema.ts
    - convex/lib/aggregateShard.ts
    - convex/analyticsRollup.test.ts
    - convex/events.test.ts
    - .planning/phases/107-aggregates-rollup-sharding/107-OCC-EVIDENCE.md

key-decisions:
  - "Chose the full narrowing (dimension key AND shard) over 107-06's stated shard-only lever. Shard-only would have taken the read set from ~101 rows to ~13 but still collided on same-shard/different-key writes — another partial lever, and this phase had already spent a full measurement cycle on one of those."
  - "AGGREGATE_SHARD_COUNT deliberately left at 8 so the cycle moves exactly one variable."
  - "by_type_period_bucket left untouched — 10 reader modules fold across it; a new index was added instead. Convex confirmed 'No indexes are deleted by this push'."
  - "Did NOT reuse 107-06's BASELINE_RETRIES_PER_1K (1188.5) as the baseline: it was measured on a different container instance, and a recreate is exactly the intervention that clears the degradation being measured."
  - "Verdict recorded as PASS with peak-load confirmation explicitly outstanding, rather than claimed as unconditionally closed."

patterns-established:
  - "A test fake that ignores index constraints makes read-set width untestable; assert on what the query PINNED and how many rows it RETURNED, not just on the write result."

requirements-completed: [OCC-01]

# Metrics
duration: ~3h across two sessions (implement + deploy 2026-08-05, measure 2026-08-06)
completed: 2026-08-06
---

# Phase 107 Plan 07: OCC-01 Gap Closure Summary

**The ingest read set went from 101 rows to 1, and aggregates OCC contention went to zero — 0 conflicts across 11.6 h and 176 ingests, against 51-428 expected under the old code's own observed rates, with the instrument proven live and correctness independently confirmed in the same capture.**

## What was wrong, and what this changed

107-03 sharded the WRITE target but left the READ set as the whole `(metric_type, period, bucket_start)` bucket: both increment helpers `.collect()`ed every row in the hour and matched the dimension in JS. Convex OCC conflicts on documents **read from or written to**, so every concurrent ingest in the same hour collided regardless of which row it wrote — and sharding made each bucket ~4.4x wider, which is why 107-06 measured retries per 1k RISING.

`dimensions` is `v.any()` and cannot be indexed. So it is denormalised into an indexed string by the new `convex/lib/aggregateDimensionKey.ts` — the single place a key is ever spelled, used by the live write path AND by the backfill's `insertBucketsBatch` so the two can never disagree — and the new `by_type_period_bucket_key_shard` index pins every field with `eq()`.

Larry chose this over 107-06's stated shard-only lever, which would have reached ~13 rows and still collided on same-shard/different-key writes. Given the phase had already burned a measurement cycle on a partial lever, the full narrowing was the right call.

## The load-bearing work was the test harness, not the fix

`makeStore()`'s fake `withIndex()` ignored **both** the index name and the filter callback and returned the entire table. Read-set width was therefore physically untestable: a point lookup and a whole-bucket scan produced identical results, so a wrong implementation would have stayed green — which is how this phase failed the first time.

The fake now applies eq/range constraints and records what each query pinned and how many rows it returned. Three new tests assert the read set directly and fail against the old implementation with `expected 9 to be less than or equal to 1`. Both required mutation proofs pass: removing either the `dimension_key` eq or the `shard` eq breaks them.

The identical defect existed in `events.test.ts`, where `first()` returned the table's first row whatever was asked. It was always wrong and merely harmless while the write path re-matched in JS; narrowing the lookup surfaced it as 2 failures. A repo sweep found the correct pattern already in use in `forge`/`swarmTasks`/`subagentJobs`/`warRoom`/`v6Mutations`; `costBudgets.test.ts:315` shares the shape but feeds one row per test and asserts a post-query guard, so it is not a live false-green and was left alone and noted.

## Measurement — three instrument traps found before any number was believed

Documented in `107-OCC-EVIDENCE.md` § H.2. Any one could have manufactured a confident wrong answer:

1. **`docker logs --since` returns 0 lines for every window after container start.** Not clock skew — host, container and WSL clocks agree exactly and Docker's metadata timestamp matches the in-message timestamp. Root cause not established, deliberately not chased.
2. **A large `--tail` silently serves the ROTATED log file** — the previous container instance, with plausible timestamps and real content. `--tail 40000` is current; `--tail 80000` is stale.
3. **A gap exists between reachable segments.**

Replaced `--since` with in-message RFC3339 timestamp filtering plus two mandatory controls (capture coverage, and a positive control). **The method reproduces 107-06's published 368 total / 314 aggregates and its exact table breakdown byte-for-byte**, so 107-06's data is independently confirmed and the new method is calibrated against a known-good answer.

## The verdict and the controls behind it

```
PRE_RETRIES_PER_1K   : 113.9      AFTER_RETRIES_PER_1K : 0.0
OCC-01 VERDICT       : PASS
```

Every validity gate passed, including the strongest control this phase has had: **the same container instance spans both the pre-deploy baseline and the entire post-deploy period**, so there is no recreate confound.

Zero is also what a broken measurement looks like, so three controls were run:

- **Instrument liveness** — the same capture contains 15 OCC lines, on `forgeHosts` (10) and `sessions` (2), and **0** on `aggregates`. The pipeline detects conflicts; aggregates specifically is at zero.
- **Low traffic does not explain it** — under the old code the WORST normalized rate came at the LOWEST traffic (18:00Z: 70 ingest/hr, 184 conflicts, 2628.6/1k), and the whole 70-146 ingest/hr band produced 315-2628/1k. Applied to 176 post-deploy ingests that predicts 51-428 conflicts; 0 were observed.
- **Correctness** — `FINAL_READ_TOTALS: MATCH (20==20)` by 107-06's exact method, coverage guard PASS, and proven non-vacuous: 38 of 55 sampled logical keys are backed by multiple shard rows, hot keys across all 8 shards. A live row at `value: 2` further proves the point lookup finds and patches rather than silently inserting duplicates.

## Caveat, stated rather than buried

Post-deploy traffic ran at **32-62 ingest/hr**, below the lowest old-code sample (70/hr) and far below the pre-deploy fragment's 676/hr. So the fix is **measured** at low-to-moderate concurrency and **inferred** at peak. An hourly average is also a crude concurrency proxy — a burst can hide inside a quiet hour, which likely explains 18:00Z's 2628.6/1k at only 70 ingest/hr. The old-code control substantially mitigates this, but a confirming measurement after a heavy working session should be recorded before OCC-01 is considered closed beyond doubt.

## On 107-06

Its raw counts reproduce byte-for-byte and its diagnosis was correct. Its `+70.5%` figure sits inside the noise band identified in § H.5 (hourly counts swing 17x on identical code) and should not be quoted as a precise effect size — but the diagnosis it drove was right, and this plan is its direct consequence.

## Also corrected / found

- Two now-false comments fixed in the same commit (Stale Docs rule): `schema.ts` claimed a missing `shard` "reads as shard 0", contradicting 107-03's strict equality; `aggregateShard.ts` called `shard` "unindexed".
- **`aggregates` is absent from `retention.ts` entirely — it is never pruned and grows unbounded.** Out of scope here, but directly relevant to this phase's stated motivation (memory buildup). Recommended as a follow-up.
- `analyticsRollup.ts` embeds literal NUL bytes as Map-key separators, which makes ripgrep treat the file as binary and silently return zero matches — this defeated a repo-wide search during investigation. New code uses the ` ` escape instead. The same contamination was twice introduced into and then cleaned from the evidence file.

## Verification

Full suite **3459 passed / 0 failed**, `tsc --noEmit` exit 0, `npm run build` clean. Deployed `2026-08-05T23:06:55Z`; Convex confirmed no indexes deleted; container did not restart.

## Next

OCC-01 is satisfied. Recommended follow-ups, neither in scope: a peak-load confirming measurement, and bounding the unpruned `aggregates` table.
