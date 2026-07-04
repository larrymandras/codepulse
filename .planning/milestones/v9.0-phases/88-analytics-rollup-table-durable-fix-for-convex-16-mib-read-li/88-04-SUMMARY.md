---
phase: 88-analytics-rollup
plan: 04
subsystem: backend
tags: [convex, analytics, aggregates, read-path, sankey, heatmap, sunburst, tokens, cap-removal, gap-closure]

# Dependency graph
requires:
  - phase: 88-02
    provides: "ingest-time events/sankey_edge buckets + cost cron"
  - phase: 88-03
    provides: "historical events/sankey buckets backfilled (correct, verified)"
  - phase: 88-01
    provides: "convex/lib/sankeyClassify.ts (read-time node reconstruction)"
provides:
  - "convex/analytics.ts — activityHeatmap, toolFlowSankey, errorRateTrend, tokenSunburst read aggregates buckets via by_type_period_bucket; all .take count caps removed"
  - "convex/analyticsRollupQueries.ts — pure read-folds (heatmap/errorTrend/sankey/sunburst), unit-tested"
  - "tokens rollup (gap-closure): computeHourly writes metric_type 'tokens'; backfillTokenRollup action; tokenSunburst renders real token counts"
affects: [analytics-page, analytics-rollup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read path reads slim index-bounded aggregates buckets (no .take cap); pure JS folding extracted to analyticsRollupQueries.ts for unit-testability"
    - "tokens rollup mirrors the cost rollup: cron hourly write (per-key idempotency) + amplification-free self-clearing backfill"

key-files:
  created:
    - convex/analyticsRollupQueries.ts
  modified:
    - convex/analytics.ts
    - convex/analytics.test.ts
    - convex/aggregates.ts
    - convex/analyticsRollup.ts
    - convex/analyticsRollup.test.ts

key-decisions:
  - "Four heavy queries now read aggregates via by_type_period_bucket (events / sankey_edge / cost / events) — O(buckets), permanently under 16 MiB. tokenWaterfall stays raw 30-min llmMetrics with its single .take(30000); sessionDurations .take(200) untouched (out of scope)."
  - "GAP-CLOSURE (token fidelity): D-10 had tokenSunburst read cost buckets (no token counts) → Total Tokens 0, and the tree never set provider.value/model.value the UI renders. Added a 'tokens' rollup (cron write + backfillTokenRollup) and fixed sunburstFromAggregates to emit provider.value/model.value = tokens + real totalTokens, matching TokenSunburst.tsx."

requirements-completed: [AR-01, AR-02, AR-03]

# Metrics
completed: 2026-06-24
---

# Phase 88 Plan 04: Analytics Read-Path Rewrite + Token Fidelity

**Rewrote the four heavy analytics queries to read pre-aggregated buckets and removed every count cap (reads now O(buckets), permanently under 16 MiB), then closed a token-fidelity gap so the Token Distribution widget shows real per-provider/model token counts.**

## Accomplishments

### Tasks 1-2 — read-path rewrite (caps removed)
- `activityHeatmap` reads `"events"` buckets (UTC mapping preserved, Pitfall 4); `.take(1000)` removed.
- `errorRateTrend` reads the same `"events"` buckets, 24 slots init-to-0 (Pitfall 7); 3× `.take(300)` removed.
- `toolFlowSankey` reads `"sankey_edge"` buckets, reconstructs nodes from edge endpoints via the shared `sankeyClassify` classifier (Pitfall 2); `.take(1000)` removed.
- `tokenSunburst` reads `"cost"` buckets; `.take(30000)` removed. `tokenWaterfall` kept raw with its single `.take(30000)` (Pitfall 5); `sessionDurations` `.take(200)` untouched.
- Pure folds extracted to `convex/analyticsRollupQueries.ts` (unit-tested) — flipped the 2 Plan-04 `*FromAggregates` RED tests GREEN.

### Task 3 — operator UI verification (passed)
- All four widgets render full-fidelity against the live ~131k-event prod dataset with **no 16 MiB read-limit error** (operator-confirmed via screenshots + programmatic query checks: heatmap cells populated, sankey 73 nodes/142 links connected, errorTrend 24 slots, sunburst cost $573).

### Gap-closure — token fidelity
- `computeHourly` now also writes `metric_type: "tokens"` hourly buckets (per provider/model/billingType/goalId, per-key idempotency guard) in the same llmMetrics pass that builds cost.
- `analyticsRollup.ts` adds `accumulateLlmTokens` (pure), `clearTokenBucketsPage`, and `backfillTokenRollup` (amplification-free, self-clearing, re-runnable; scans `api.llm.recentCallsPaginated`).
- `sunburstFromAggregates(costBuckets, tokenBuckets)` now sets `provider.value`/`model.value` = real token sums and a true `totalTokens` — matching the `TokenSunburst.tsx` contract (the old tree never set those, so every row read 0).
- Operator-verified on prod: backfill `{ processed: 7686, tokenBuckets: 569 }`; `tokenSunburst` returns **totalTokens 240,305,124** with correct per-provider/model breakdown (was 0).

## Task Commits
1. **Tasks 1-2: rewrite 4 analytics queries; remove .take caps** — `3077b76` (feat)
2. **STATE note: Tasks 1-2 done, Task 3 pending** — `9547df2` (docs)
3. **Gap-closure: materialize tokens rollup (cron + backfill)** — `1f8e6a1` (feat)
4. **Gap-closure: tokenSunburst renders real token counts** — `896034f` (fix)

## Verification
- `npx tsc --noEmit` exits 0.
- Grep gates (convex/analytics.ts): `.take(1000)` 0, `.take(300)` 0, real `.take(30000)` exactly 1 (tokenWaterfall), `by_type_period_bucket` in 4 queries.
- `npx vitest run convex/` GREEN (512 passed; the prior 2 Plan-04 REDs flipped). analytics.test.ts 11/11, analyticsRollup.test.ts 12/12.
- Prod programmatic checks: all 4 queries return full-fidelity data, no read-limit error; token sunburst totalTokens 240,305,124.

## Deviations from Plan
- **[Major — gap-closure] Token fidelity.** Plan 04 as written (D-10) left `tokenSunburst` showing 0 tokens because cost buckets carry no token counts AND the tree omitted the values the UI renders. Per the user's explicit choice ("fix tokens properly now"), a `tokens` rollup (cron write + backfill) was added and the sunburst tree shape corrected. Additive; does not change the phase goal.

## Requirements Status
- **AR-01 COMPLETE** — analytics queries read O(buckets) from aggregates, not O(events) raw scans.
- **AR-02 COMPLETE** — rollups correct under real ingest (idempotent dedup, archival-consistent, historical backfill verified) — see 88-03-SUMMARY.
- **AR-03 COMPLETE** — all count caps removed from the four heavy queries; full fidelity restored; every analytics query reads well under 16 MiB at any volume (operator-verified on prod).

## User Setup Required
- Operator deployed the read-path + tokens rollup (`npx convex deploy --yes`) and ran `npx convex run analyticsRollup:backfillTokenRollup` once on prod `tidy-whale-981`. Complete. The token backfill is re-runnable.

## Self-Check: PASSED
- FOUND: convex/analytics.ts 4 queries read by_type_period_bucket; caps removed (grep gates pass)
- FOUND: convex/analyticsRollupQueries.ts pure folds (heatmap/errorTrend/sankey/sunburst)
- FOUND: convex/aggregates.ts computeHourly writes metric_type "tokens"
- FOUND: convex/analyticsRollup.ts backfillTokenRollup + accumulateLlmTokens + clearTokenBucketsPage
- FOUND commits: 3077b76, 1f8e6a1, 896034f
- Prod: 4 queries full-fidelity, no 16 MiB error; tokenSunburst totalTokens 240,305,124
- tsc 0; convex/ suite GREEN

---
*Phase: 88-analytics-rollup-table-durable-fix-for-convex-16-mib-read-li*
*Completed: 2026-06-24*
