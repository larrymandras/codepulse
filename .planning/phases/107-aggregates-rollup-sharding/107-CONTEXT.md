# Phase 107: Aggregates Rollup Sharding - Context

**Gathered:** 2026-08-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate OCC (optimistic-concurrency) write contention on the `aggregates` table's `events` and `sankey_edge` buckets. `convex/events.ts`'s `ingest` mutation calls `incrementEventBucket`/`incrementSankeyEdge` (`convex/analyticsRollup.ts`) inside the same OCC transaction as every event write; those helpers do a **read-patch-or-insert on ONE shared row per `(metric_type, period, bucket_start, dimensions)` tuple**. Every concurrent Ástríðr agent session posting the same `eventType` within the same hour patches that identical document, and Convex's OCC layer serializes the collisions via retry.

This is not a new capability — the rollup itself (Phase 88) is out of scope; only its **write shape** changes, from one row per bucket to N sharded rows summed at read time. Nothing about what data is captured, retained, or displayed changes; the fix is purely internal to how the count reaches its final value.

**This phase does not touch:** the `cost` or `tokens`/`tokens_prompt`/`tokens_completion` metric_types (cron-driven, single-writer, never contended — see D-02), the ingest mutation's overall transaction shape (see D-03), or historical row data (see D-04).

</domain>

<decisions>
## Implementation Decisions

### Shard Key & Count

- **D-01:** Shard assignment is **`Math.floor(Math.random() * 8)`** per write — no dependency on `sessionId` or any other field. Convex mutations may call `Math.random()` freely (this isn't a deterministic-replay-constrained backend). A hash-of-sessionId scheme was considered and rejected: it doesn't spread a single bursty session's own writes across shards, which is exactly the case that needs spreading.
- Shard count is **8**, defined as a single exported constant (e.g. `AGGREGATE_SHARD_COUNT` in `analyticsRollup.ts`) that every write and read site imports — never hardcoded at each call site. Chosen over 16 to keep read-time fan-out (point-index lookups per shard) cheap for the 9 downstream reader files; can be raised later without a schema change since `shard` is just an integer field.

### Sharding Scope

- **D-02:** Shard **only** `metric_type: "events"` and `metric_type: "sankey_edge"` — the two ingest-time, request-concurrent writes in `analyticsRollup.ts`. `cost` and `tokens`/`tokens_prompt`/`tokens_completion` are written by `convex/aggregates.ts`'s `computeHourly`/`rollupDaily` (cron-driven, single invocation at a time) and have never shown OCC contention in any incident log — sharding them adds read fan-out to every consumer for zero benefit. **Verified via grep**: `costDerived.ts` (`tokens_prompt`/`tokens_completion` only), `alerts.ts` and `briefings.ts` (`cost` only), `anomalyDetection.ts` (`errors`/`cost` only), `toolAnalytics.ts` (a separate `tool_usage`-family metric_type from Phase 105) — none of these read `events` or `sankey_edge`, so none of these files need any shard-aware read logic.
- **D-03:** The write path stays at **3 read-patch-or-insert round trips per `events.ingest` call** (1 for `incrementEventBucket`, 2 for the two `incrementSankeyEdge` calls in `incrementSankeyBuckets`) — only the shard key changes, not the round-trip count. Collapsing these into fewer round trips is a separate, riskier refactor of the ingest hot path (a failure here rolls back the whole ingest transaction per `CLAUDE.md`) and is out of scope for this phase (see `<deferred>`).

### Existing Row Migration

- **D-04:** **No bulk rewrite of the ~1.94M existing unsharded rows.** Add `shard` as an **optional** field on the `aggregates` schema. New writes always set a real `0-7` value; every reader sums across shards treating a missing/undefined `shard` as if it were shard 0 (i.e., readers never filter or branch on shard — they just collect all matching `(metric_type, period, bucket_start, dimensions)` rows regardless of shard value and sum `.value`). This fully respects `CLAUDE.md`'s "Self-Hosted Convex — Operational Rules": never bulk-patch or bulk-delete a large table on the live instance (the exact pattern that caused the 2026-07-21/22 tombstone-poisoning index-rot incident). Historical hours are finished, cooling data — no longer concurrently written, so they carry no contention risk regardless of shard shape.

### Verification Method

- **D-05:** Proof of fix is a **live before/after OCC-retry log count**: `docker logs convex-backend --since <window>h | grep -Ei 'occ|conflict|retry' | wc -l`, measured over a comparable live-traffic window immediately before deploy and again a comparable window after, using the same command already used in every prior incident diagnosis (`retention-health.log`, `convex-selfhosted-setup` memory) — directly comparable to the 2026-08-05 baseline of **1135 retries in 24h**. `console.log` inside a UDF does **not** reach `docker logs` on self-hosted Convex (confirmed 2026-07-30) — this is why an in-code counter/log statement cannot be the evidence; the OCC error itself is emitted by the Convex runtime, not application code, and does reach `docker logs`. A synthetic concurrent-write test was discussed and **not** required for this phase (see `<deferred>`) — the live log comparison was judged sufficient given it's the same measurement that diagnosed the problem in the first place.

### Claude's Discretion

- ~~Exact TypeScript shape of the shard-summing helper (e.g. a shared `sumAcrossShards(rows)` utility vs. inline `.reduce()` at each call site) — planner's call, but prefer one shared helper given 3+ call sites need the identical fold.~~ **RESOLVED / MOOT (2026-08-05, post-research, verified against live code):** no read-side summing helper is needed anywhere. Every reader already accumulates across all rows sharing its group key, so there are zero call sites for such a helper. Building one would be a no-op abstraction — do not create it.
- Whether `AGGREGATE_SHARD_COUNT` lives in `analyticsRollup.ts` (where it's written) or a shared `convex/lib/` constants file (where reads also need it) — planner's call.
- Whether `analyticsRollup.ts`'s `backfillHistorical` action (which does pure inserts of one row per `(hour, dims)` when rebuilding historical buckets) should also randomly assign a shard on those inserts for consistency, or write shard `0` since it's a single-writer batch process with no concurrency to spread — not discussed live; either is compatible with D-04's "missing/undefined shard = shard 0" read contract, so this has no correctness impact either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project conventions that constrain this phase
- `CLAUDE.md` §"Self-Hosted Convex — Operational Rules" — the governing constraint on D-04: never `--replace-all`, never bulk-delete/patch a large table on the live instance; a dashboard-wide "no data" is index rot or memory starvation until proven otherwise.
- `CLAUDE.md` §"Ástríðr API Integration" — not directly touched by this phase (no new `/api/*` fetches), noted for completeness since `convex/events.ts`'s `ingest` mutation is the write path being modified.

### The exact contention mechanism (read these first)
- `convex/analyticsRollup.ts:26-107` — `incrementEventBucket` (single hot row per `(events, hourly, hourStart, event_type)`) and `incrementSankeyEdge`/`incrementSankeyBuckets` (single hot row per `(sankey_edge, hourly, hourStart, source, target)`) — the exact read-patch-or-insert pattern to shard.
- `convex/events.ts:8-47` — `ingest` mutation; calls both increment helpers inside the same OCC transaction as the event insert (lines 45-46).
- `convex/schema.ts:953-961` — `aggregates` table definition: `metric_type`, `period`, `bucket_start`, `value`, `dimensions` (optional `v.any()`), indexed `by_type_period_bucket` and `by_period_bucket`. D-01/D-04 add an optional `shard: v.optional(v.float64())` field here.
- `diagnosis-2026-08-05-0530.md` (`C:\Users\mandr\convex-selfhost\`) — the incident report that root-caused this: live `docker logs` evidence of `Caught occ error ... aggregates ... td7avhe8g014v45mtekpaw43y18bwfgv` firing repeatedly, 1135+ OCC/retry log lines in 24h, memory climbing 19.5→45.95GiB over 6 days with flat DB size (confirms retained MVCC version churn, not data growth), and `events` table index-head queries timing out ("index rot") as the eventual symptom.
- Claude memory `convex-selfhosted-setup` (`.claude-alt/projects/C--Users-mandr/memory/convex-selfhosted-setup.md`) — full incident history including the 2026-07-30 occurrence of the identical mechanism, and the 2026-07-21/22 tombstone-poisoning precedent that motivates D-04's no-bulk-rewrite rule.

### Confirmed reader call sites (D-02's scope grep)
- `convex/analytics.ts:17-33` — `activityHeatmap` reads `metric_type: "events"`, delegates folding to `heatmapFromAggregates` in `convex/analyticsRollupQueries.ts`.
- `convex/analytics.ts:35-55` — `toolFlowSankey` reads `metric_type: "sankey_edge"`, delegates to `sankeyFromAggregates`.
- `convex/analytics.ts:88-109` — `errorRateTrend` reads `metric_type: "events"`, delegates to `errorRateTrendFromAggregates`.
- `convex/analyticsRollupQueries.ts` — this is where the actual per-bucket fold/grouping logic lives for all three functions above. **OPEN QUESTION RESOLVED (2026-08-05, by Phase 107 research + independently re-verified against live code):** all three folds are **already shard-safe as written** — `heatmapFromAggregates:43` (`cells[key] = (cells[key] ?? 0) + b.value`), `errorRateTrendFromAggregates:75` (`counts[h] += b.value`), `sankeyFromAggregates:108` (`linkMap[key] = (linkMap[key] ?? 0) + b.value`). None keys on shard, none overwrites on collision, all accumulate across every row sharing their existing group key. **This file needs no changes.** See `107-RESEARCH.md`.
- `convex/aggregates.ts:423-472` — `rollupDaily`, a **fourth reader this CONTEXT originally missed** (found by Phase 107 research, re-verified live). It reads ALL hourly `aggregates` rows filtered only on `period` (not `metric_type`), so it sees the sharded rows too. Already shard-safe: it groups by `metric_type::JSON.stringify(dimensions)` and does `rollup[key].value += row.value` — `shard` is a top-level field and is not part of `dimensions`, so the 8 shard rows collapse into one key and sum correctly. No change needed, but it is on the live UI critical path (feeds Analytics' Total Events card via `eventCountsByPeriod`), so it belongs in the regression surface.
- `convex/aggregates.ts:821-845` — `eventCountsByPeriod` already groups by `event_type` and accumulates `grouped[eventType] += r.value` across ALL matching rows — this reader is **already shard-safe**, confirmed by direct code read. No change needed here.
- `convex/analyticsRollup.ts:293-362` — `backfillHistorical` action: reads raw `events` rows (not `aggregates`) and writes fresh `aggregates` buckets via `insertBucketsBatch` (pure inserts, one row per `(hour, dims)` today). See Claude's Discretion above re: whether these inserts should assign a random shard.
- Confirmed **NOT** affected (grepped, no `events`/`sankey_edge` metric_type usage): `convex/costDerived.ts`, `convex/alerts.ts`, `convex/briefings.ts`, `convex/anomalyDetection.ts`, `convex/toolAnalytics.ts`.

### Test files likely needing updates
- `convex/analyticsRollup.test.ts` (asserts on `metric_type === "events"` bucket shapes, lines 59/227) and `convex/aggregates.test.ts` (line 261 constructs an `events` bucket fixture) — both will need shard-aware fixtures/assertions once the write shape changes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convex/analyticsRollup.ts`'s existing "JS-side dimension match" pattern (never an object-equality filter on `dimensions`, per its own header comment "Pitfall 3") — the shard-summing read helper should follow the same convention: collect candidate rows via the index, match/group in JS.
- `convex/aggregates.ts:821-845`'s `eventCountsByPeriod` is a working reference implementation of shard-safe summing (groups by key, accumulates `.value`) — use its shape as the template for updating `analyticsRollupQueries.ts` if that file turns out not to already sum correctly.

### Established Patterns
- Insert-only, never patch-or-delete, for anything touching the live self-hosted instance at scale (per `CLAUDE.md` and `convex/analyticsRollup.ts`'s own backfill comments).
- Every existing rollup reader is already index-bounded (`by_type_period_bucket`, range on `bucket_start`) — the shard fix must preserve this; shards are an equality/collect expansion within an already-bounded query, not a new unbounded scan.

### Integration Points
- `convex/events.ts:8-47` `ingest` — where the shard value is chosen and passed through to both increment helpers.
- `convex/analyticsRollup.ts` `incrementEventBucket`/`incrementSankeyEdge`/`incrementSankeyBuckets` — where the shard field is added to the read-patch-or-insert lookup and the inserted document.
- `convex/schema.ts:953-961` — schema change (additive, optional field).
- `convex/analytics.ts` + `convex/analyticsRollupQueries.ts` + `convex/aggregates.ts:eventCountsByPeriod` — the confirmed read-side call sites needing shard-aware summing (or verification that they already are).

</code_context>

<specifics>
## Specific Ideas

- The fix must be measured the same way the problem was diagnosed: `docker logs convex-backend --since Xh | grep -Ei 'occ|conflict|retry' | wc -l` is the established, already-trusted metric across every incident to date (2026-07-30, 2026-08-05) — reuse it rather than inventing a new success metric.
- This is the second time this exact mechanism has caused a multi-day incident (07-30, 08-05); it was flagged as "a deliberate design tradeoff, worth watching if ingest volume grows" on 2026-07-30 and never actually fixed. This phase closes that specific open item.

</specifics>

<deferred>
## Deferred Ideas

- **Collapsing the 3 read-patch-or-insert round trips per `events.ingest` call into fewer round trips** (D-03) — a genuine efficiency win but a separate, riskier refactor of the ingest hot path. Candidate for a future phase once sharding is live and its effect is measured.
- **Synthetic concurrent-write test** for the sharding mechanism in isolation — discussed and not required for this phase; the live before/after log comparison (D-05) was judged sufficient. Could be added later as a regression guard if the contention ever recurs.
- **Sharding `cost`/`tokens` metric_types** — explicitly out of scope (D-02); revisit only if those ever show OCC contention in a future incident log (none to date).

</deferred>

---

*Phase: 107-Aggregates Rollup Sharding*
*Context gathered: 2026-08-05*
