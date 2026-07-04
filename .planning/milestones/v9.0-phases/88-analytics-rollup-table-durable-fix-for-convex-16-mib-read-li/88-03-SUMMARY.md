---
phase: 88-analytics-rollup
plan: 03
subsystem: backend
tags: [convex, rollup, aggregates, backfill, retention, archival-consistency, gap-closure, incident]

# Dependency graph
requires:
  - phase: 88-02
    provides: "backfillHistorical action + ingest-time bucket write path (deployed)"
  - phase: 88-01
    provides: "aggregates.test.ts Phase-88 dataRetention regression scaffold"
provides:
  - "convex/dataRetention.ts — D-12 clarifying comment confirming aggregates are never touched by purge (verify-only)"
  - "Passing dataRetention archival-consistency regression test (purge deletes 0 aggregates rows)"
  - "Historical aggregates buckets populated for all pre-rollup events (operator backfill run, prod tidy-whale-981)"
  - "convex/analyticsRollup.ts — backfillHistorical REWRITTEN: amplification-free in-memory aggregation, self-clearing, re-runnable (gap-closure)"
affects: [88-04 (read-path reads these now-correct buckets), analytics-rollup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backfill via in-memory aggregation (Map<hour|dims, count>) → write each bucket once with pure inserts — zero per-event DB reads (eliminates read amplification)"
    - "Current-hour cutoff: backfill rebuilds completed past hours only; live ingest owns the current hour → no post-deploy double-count window"
    - "Self-clearing + re-runnable backfill: each run clears the historical range then rebuilds, so a failure leaves no partial state"

key-files:
  created: []
  modified:
    - convex/dataRetention.ts
    - convex/analyticsRollup.ts
    - convex/analyticsRollup.test.ts

key-decisions:
  - "D-12 confirmed by source + regression test: purgeOldTelemetryEvents deletes only from events/heartbeatAlerts/episodicEvents, never aggregates (immutable historical buckets)."
  - "GAP-CLOSURE: the original per-event read-patch-or-insert backfill amplified reads (12k+ docs/page) and timed out at ~272k events, leaving partial/inflated buckets on prod. Rewrote it to aggregate in memory and write once; added clearHistoricalBucketsPage + insertBucketsBatch internal mutations."
  - "Backfill skips events at/after the current-hour boundary (cutoffHour) so it never collides with the live current-hour ingest bucket."

requirements-completed: [AR-02]

# Metrics
duration: incident + fix (~1 session)
completed: 2026-06-24
---

# Phase 88 Plan 03: Backfill + Archival-Consistency Summary

**Locked D-12 archival consistency (dataRetention never touches aggregates, source + regression test), then ran the one-time historical backfill against prod — which surfaced a read-amplification failure in the Plan-02 backfill that was diagnosed, rewritten amplification-free, redeployed, and re-run to a clean, verified rebuild.**

## Accomplishments

### Task 1 — Archival consistency (D-12)
- Added a clarifying comment above `purgeOldTelemetryEvents` documenting that the purge deletes only raw `events` (+ heartbeatAlerts/episodicEvents) and that `aggregates` rollups are immutable historical buckets, intentionally never read/patched/deleted. **Comment-only — zero logic change.**
- The "Phase 88" dataRetention regression test in `convex/aggregates.test.ts` asserts the purge's delete-target set contains no `"aggregates"` entry — GREEN.
- Committed `8c4646f`.

### Task 2 — Historical backfill (with gap-closure)
- **Incident:** the first run of the Plan-02 `backfillHistorical` (operator-triggered on prod `tidy-whale-981`) **failed** after ~478 s, having committed dozens of independent `incrementBatch` mutations — leaving ~271,960 partial/inflated increments in the `"events"` buckets.
- **Root cause (diagnosed from prod logs):** the backfill did read-patch-or-insert *per event*, and each call `.collect()`d every bucket row for that hour. As buckets filled, per-page reads grew (one logged page read **12,094 documents**), eventually exhausting the action time budget. The design was also non-idempotent (no cursor checkpoint) and had no deploy cutoff (would double-count post-deploy events).
- **Fix (gap-closure, commit `a5fdc10`):** rewrote `backfillHistorical` to
  1. aggregate counts **in memory** across the scan (extracted pure `accumulateEvent`, unit-tested) — **zero per-event DB reads**;
  2. clear the stale historical bucket range once (`clearHistoricalBucketsPage`, idempotent);
  3. write each bucket exactly once via batched pure inserts (`insertBucketsBatch`);
  4. skip events ≥ the current-hour boundary so live ingest's current-hour bucket is never double-counted.
  The action is now **safe to re-run** (each run re-clears then rebuilds).
- **Clean re-run result (prod):** `{ cleared: 10989, processed: 130834, eventBuckets: 1964, sankeyBuckets: 8988 }`, no read-limit error.

## Task Commits
1. **Task 1: D-12 archival-consistency comment + regression test** — `8c4646f` (chore)
2. **STATE note: Task 1 done / Task 2 pending operator** — `e917d38` (docs)
3. **Gap-closure: rewrite backfillHistorical amplification-free + re-runnable** — `a5fdc10` (fix)

## Verification
- **Fidelity (AR-02 rollup count == raw count):** independent re-query of the rebuilt `"events"` buckets sums to **130,853**, matching `processed` (130,834) + 19 live-ingest events into the current hour. The whole-table match proves both count fidelity AND **no duplicate buckets** (sum is not inflated). The pre-fix inflated 271,960 is gone.
- **dataRetention invariant:** `convex/aggregates.test.ts` Phase-88 block GREEN; `grep aggregates convex/dataRetention.ts` returns only the explanatory comment (zero table access).
- **Unit tests:** `convex/analyticsRollup.test.ts` 9/9 GREEN (3 new `accumulateEvent` cases: count-equality, skip-at-cutoff, two-edges-per-event). `npx tsc --noEmit` exits 0.
- Full `convex/` suite: 503 passed; the only 2 failures are the **Plan-04 read-path RED tests** (`*FromAggregates`), expected-RED until Wave 3 — not regressions.
- No read-limit / 16 MiB error on deploy or backfill run.

## Deviations from Plan
- **[Major — gap-closure] Plan 02's backfill was not production-viable.** The plan assumed a single operator run would succeed; instead the read-amplification design failed mid-run on real data volume. Per the user's explicit choice ("rewrite backfill properly"), the backfill was reimplemented (commit `a5fdc10`), redeployed, and re-run to a verified clean state. This is a fix to Plan 02/03's backfill, not a scope change to the phase goal.

## Requirements Status
- **AR-02 — COMPLETE.** Rollups are correct under real ingest: idempotent dedup (Plan 02), archival-consistent (D-12 source + test, this plan), and the one-time historical backfill populated all pre-rollup buckets with verified count fidelity (this plan, hardened).

## User Setup Required
- Operator deployed the corrected functions (`npx convex deploy --yes`) and ran `npx convex run analyticsRollup:backfillHistorical` once on prod `tidy-whale-981`. Complete. The backfill is now re-runnable if ever needed.

## Next Phase Readiness
- **Plan 04** can now rewrite `analytics.ts` to read the rebuilt, correct `"events"`/`"sankey_edge"` buckets and turn the 2 remaining Plan-04 RED tests GREEN, then deploy + operator UI-verify.

## Self-Check: PASSED
- FOUND: convex/dataRetention.ts D-12 comment; zero aggregates table access
- FOUND: convex/analyticsRollup.ts backfillHistorical (in-memory aggregation, clearHistoricalBucketsPage, insertBucketsBatch, accumulateEvent)
- FOUND commit: 8c4646f (Task 1), a5fdc10 (gap-closure fix)
- Prod backfill clean: cleared 10989, processed 130834, eventBuckets 1964, sankeyBuckets 8988; bucket sum 130,853 ≈ processed + live drift
- tsc --noEmit exits 0; analyticsRollup.test.ts 9/9 + aggregates.test.ts 24/24 GREEN

---
*Phase: 88-analytics-rollup-table-durable-fix-for-convex-16-mib-read-li*
*Completed: 2026-06-24*
