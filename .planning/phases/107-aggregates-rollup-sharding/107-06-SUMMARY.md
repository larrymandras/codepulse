---
phase: 107-aggregates-rollup-sharding
plan: 06
subsystem: infra
tags: [convex, occ, aggregates, live-evidence, verdict, contention]

# Dependency graph
requires:
  - "107-04: 107-OCC-BASELINE.md — WINDOW_HOURS=2, BASELINE_AGGREGATES_COUNT=290, BASELINE_RATE_PER_HOUR=145.0, BASELINE_INGEST_VOLUME=244, and the exact command shapes both halves must share"
  - "107-05: 107-OCC-EVIDENCE.md sections D and E — DEPLOY_UTC=2026-08-05T16:26:33Z, State.StartedAt for the recreate check, SHARD_PRESENCE already OBSERVED"
provides:
  - "107-OCC-EVIDENCE.md sections F0, F and G: after-window gate, equal-window OCC measurement, traffic-normalized comparison, final read-total check, and the OCC-01 verdict"
  - "OCC-01 VERDICT: FAIL — recorded with the rule that fired, no rollback, next lever named"
  - "Evidence-backed diagnosis that the write set was sharded but the READ set was not, with file:line citations"
affects: [gap-closure phase for OCC-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A correctness check is only accepted once a control proves it could have failed: FINAL_READ_TOTALS MATCH was paired with a count showing 20 of 23 logical keys in the measured bucket are split across 2-4 shard rows, so the fold genuinely had to sum multiple rows."
    - "Traffic normalization is bidirectional. It was written to stop a quiet period reading as a fix; here it caught the mirror case — traffic fell 36.5% so the raw +8.3% understated a +70.5% normalized regression."
    - "A plan's own suggested next lever is a hypothesis, not a finding. Raising AGGREGATE_SHARD_COUNT was named in the plan text and the measurement argues against it; that reversal is recorded rather than silently followed."

key-files:
  created:
    - .planning/phases/107-aggregates-rollup-sharding/107-06-SUMMARY.md
  modified:
    - .planning/phases/107-aggregates-rollup-sharding/107-OCC-EVIDENCE.md

key-decisions:
  - "Executed INLINE in the main session rather than via a gsd-executor subagent. Task 1 is a blocking human-verify gate whose inputs are Larry's live observation of the running dashboard and his traffic characterization; that approval is native to the main session and relaying it second-hand to a subagent is the documented failure mode where an executor correctly refuses."
  - "Recorded FAIL rather than PARTIAL. PARTIAL requires that the rate fell; it rose (145.0 to 157.0 per hour). The hot-document collapse from 66.9% to 6.4% is a real and substantial win, but it is not the metric OCC-01 is written against, and letting it carry a PARTIAL would have been exactly the round-up the plan forbids."
  - "Recorded FAIL rather than INCONCLUSIVE. Every INCONCLUSIVE trigger was checked and none applied: all three window validity gates passed, both ingest volumes are non-zero so the normalized figure is defined, and Larry characterized traffic as normal rather than unusually quiet. INCONCLUSIVE would have been the softer and less honest answer."
  - "Kept the raw-line-count basis (314 vs 290) for the headline metric even after discovering each OCC occurrence emits two lines (157 ERROR + 157 WARN). Section A defined the metric that way; changing the basis mid-comparison is the drift this method refuses, and the 2:1 factor cancels in every ratio anyway. The structure is recorded as a note."
  - "Diagnosed the residual contention by reading the write path rather than speculating, and stated the result at its true confidence. The read-set hypothesis is backed by analyticsRollup.ts:43-54 and :101-111 plus the Convex OCC semantics quoted in the error text itself, but it was NOT isolated by a controlled experiment, so it is labelled a strong hypothesis and verifying it is named as the follow-up's first task."
  - "Did not fix and did not roll back, per the plan's explicit instruction. A rollback would re-create the single hot document behind two multi-day incidents, and the read path is demonstrably correct under sharding."
  - "Contradicted the plan's own leading next-lever suggestion. Raising AGGREGATE_SHARD_COUNT beyond 8 would, under the measured mechanism, widen each bucket's .collect() further and likely worsen contention; it only becomes useful after the read set is narrowed. Recorded explicitly because the suggestion pointed the wrong way."
  - "Corrected a claim in convex/lib/aggregateShard.ts's header. Its 'needs no schema or index change' note is accurate for raising the shard COUNT, but is exactly why the recommended lever (indexing shard and range-bounding the lookup) DOES require an index addition. Noted so a future editor does not read the comment as covering that change."

requirements-completed: []

# Metrics
tasks: 2
commits: 2
duration: ~20 min
---

# Plan 107-06 — After-window OCC measurement and the OCC-01 verdict

```
OCC-01 VERDICT: FAIL
```

**Rule that fired:** *"`FAIL` if the traffic-normalized rate did not fall."*

```
BASELINE_RETRIES_PER_1K: 1188.5      = 290 / (244 / 1000)
AFTER_RETRIES_PER_1K:    2025.8      = 314 / (155 / 1000)      +70.5%

FINAL_READ_TOTALS: MATCH             (FINAL_BUCKET_TOTAL 113 == FINAL_RAW_EVENT_COUNT 113)
```

**No rollback was performed, and none is recommended.**

## The comparison

| Metric | Baseline | After | Change |
|---|---|---|---|
| OCC count, `aggregates`-scoped | 290 | 314 | +8.3% |
| Rate per hour | 145.0 | 157.0 | +8.3% |
| Ingest volume (same 2 h window) | 244 | 155 | −36.5% |
| **Retries per 1,000 events** | **1188.5** | **2025.8** | **+70.5%** |
| Hottest-document share | 66.9% (194/290) | 6.4% (20/314) | −90.5% |

Traffic normalization earned its keep in the opposite direction from the one it
was written to guard against. It exists to stop a quiet period reading as a fix;
here traffic fell 36.5% while OCC rose, so the raw +8.3% *understated* the
regression. The honest figure is +70.5%.

All three window validity gates passed: identical 2 h window, container uptime
7 h with `State.StartedAt` unchanged to the nanosecond across baseline, deploy
and measurement, and a window starting 17:26:36Z — a full hour after
`DEPLOY_UTC` — so every counted line came from the sharded code path.

## What the change did achieve

Sharding works as a write-distribution mechanism, and this is not a small result:

- All 8 shard values are in use, and the one-draw-per-ingest contract holds in
  live production data.
- The hot document is gone. One row absorbed **66.9%** of all OCC lines before;
  the busiest row now takes **6.4%**, with contention spread across **55 distinct
  documents**.
- The read path is correct under sharding, proven against real mixed data rather
  than fixtures. `FINAL_READ_TOTALS: MATCH` was paired with a control confirming
  the check could have failed: **20 of 23** logical keys in the measured hour are
  backed by 2–4 shard rows apiece (101 rows across the bucket), and the readers
  still fold them to exactly the raw event count.

So this is a clean contention failure with **correctness fully intact** — not the
"lower count paired with a silently broken fold" outcome the method was built to
catch.

## Why it still failed

All 157 retries are `Udf(events.js:ingest)`, and the contended documents were
looked up in the live table: they are the **sharded rows themselves**
(`metric_type: "events"` / `"sankey_edge"`, carrying `shard: 5`, `shard: 3`),
not some unsharded metric type the change missed.

**Strong hypothesis — the read set was never sharded.** Convex OCC conflicts on
documents *read from **or** written to*. Both write helpers open the bucket with
a `.collect()` over the whole `(metric_type, period, bucket_start)` tuple and
match dimension and shard in JS:

- `convex/analyticsRollup.ts:43-54` — `incrementEventBucket`
- `convex/analyticsRollup.ts:101-111` — `incrementSankeyEdge`

107-03 narrowed the **write target** to one shard row but left the **read set**
as the entire bucket — all 8 shards and every dimension key in it. Any concurrent
`events.ingest` patching *any* row in that bucket invalidates the read set and
forces a retry, regardless of which shard was written. This also explains the
modest *increase*: sharding made each bucket ~8× wider, so every `.collect()` now
reads more rows that can invalidate it.

Stated at its true confidence: the measurements are facts; this mechanism is a
strong hypothesis consistent with the code above and with the OCC semantics
quoted in Convex's own error text, but it has **not** been isolated by a
controlled experiment. Verifying it is the follow-up's first task, not an
assumption to build on.

## Recommended next lever — for gap closure

1. **Narrow the read set to one shard.** Index `shard` and range-bound the bucket
   lookup to the caller's shard, so a mutation reads only its own shard's rows.
   Follows directly from the mechanism above.
   *Note:* `convex/lib/aggregateShard.ts` says widening the shard range "needs no
   schema or index change" — true for raising the *count*, and exactly why *this*
   lever does require an index addition.
2. **Collapse the deferred `events.ingest` round-trip.** Fewer read-patch cycles
   per ingest means a smaller read set and a shorter conflict window.
3. **Raising `AGGREGATE_SHARD_COUNT` beyond 8 — explicitly NOT first.** The plan
   named it as the leading candidate; the evidence argues against it. A higher
   count makes each bucket's `.collect()` read *more* rows and would likely worsen
   contention until lever 1 lands.

## Closing state

```
OCC-01: OPEN — FAIL recorded, no rollback, next lever named for gap closure.
```

`git status --porcelain convex src` empty throughout; no source file modified and
no in-code retry counter added (it could not reach `docker logs` anyway —
`console.log` inside a UDF does not surface in the container log on self-hosted
Convex). Final `State.StartedAt` re-check unchanged from section D.
