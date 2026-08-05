# Phase 107: Aggregates Rollup Sharding - Research

**Researched:** 2026-08-05
**Domain:** Convex OCC write-contention mitigation via counter sharding (internal backend refactor, no new external dependencies)
**Confidence:** HIGH (every structural claim below is a direct code read with file:line evidence; no package research, no external API research)

## Summary

This phase shards the `aggregates` rows written by `events.ingest` for `metric_type: "events"` and `metric_type: "sankey_edge"` from one row per `(metric_type, period, bucket_start, dimensions)` key to up to 8 rows (an added `shard` field, `0-7`), to spread OCC (optimistic-concurrency) retry contention across independent rows instead of serializing every concurrent write through one hot document.

**The single most important finding of this research reverses the framing in CONTEXT.md**: the three read-side fold functions in `convex/analyticsRollupQueries.ts` that CONTEXT.md flagged as "not yet verified... the single most important open question" are **all three already shard-safe as written**, verified by direct code read (not inference). None of them key on shard, none use `.find()`/`[0]`/first-match, and all three use `+=` / `(x ?? 0) + value` accumulation across every row that shares their existing group key. Two additional readers not named in CONTEXT.md's "confirmed clear" list (`convex/aggregates.ts`'s `eventCountsByPeriod` — CONTEXT.md's own reference implementation — and, newly found by this research, `rollupDaily`) are also already shard-safe. **This means the phase's actual code-change surface is smaller than CONTEXT.md implied**: no reader anywhere needs a new "sum across shards" helper. The entire correctness burden is on the **write path** (`convex/analyticsRollup.ts`) and the **test suite**, which currently calls `incrementEventBucket` with no shard control and will become non-deterministically flaky the moment `Math.random()` shard assignment lands inside it.

**Primary recommendation:** Make `shard` an explicit parameter passed into `incrementEventBucket`/`incrementSankeyBuckets`/`incrementSankeyEdge` (computed once per `events.ingest` call via `Math.floor(Math.random() * AGGREGATE_SHARD_COUNT)` at the call site in `convex/events.ts`), not a `Math.random()` call buried inside the helpers. This keeps the existing "collect the bucket rows for `(metric_type, period, bucket_start)`, then JS-match on dimensions" pattern (Pitfall 3) intact — just add `&& r.shard === shard` to each `.find()` predicate — requires **zero index changes** (shard is not added to the `by_type_period_bucket` index, exactly like `dimensions` today), and makes the write path deterministically testable. No reader-side code changes are required; only reader-side **tests** need new shard-spanning fixtures to prove (not just assume) the summing holds.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shard assignment (write) | API / Backend (Convex mutation) | — | `events.ingest` is the only write path for these two metric_types; shard choice must live where the write happens |
| Read-patch-or-insert per shard | API / Backend (Convex mutation) | — | `incrementEventBucket`/`incrementSankeyEdge` in `convex/analyticsRollup.ts` — unchanged tier, only the lookup key widens |
| Cross-shard summing (read) | API / Backend (Convex query) | — | `analyticsRollupQueries.ts` + `aggregates.ts` query handlers — already correct, no tier change |
| Daily rollup consolidation | API / Backend (Convex cron/internalMutation) | — | `rollupDaily` — generic metric_type+dimensions grouping, already shard-oblivious/safe |
| Schema field addition | Database / Storage | — | `convex/schema.ts` — additive optional field, no index tier change |
| OCC-retry measurement | API / Backend (Convex runtime logs) | Ops tooling (`docker logs`) | D-05's proof lives entirely in the Convex runtime's own log output, not in application code (confirmed below) |

## Priority Question — Read-Path Fold Safety (verified per-function)

**Answer: all three functions in `convex/analyticsRollupQueries.ts` are already shard-safe as written. No changes needed to any of them.**

### `heatmapFromAggregates` — SHARD-SAFE
`convex/analyticsRollupQueries.ts:38-45`:
```typescript
for (const b of buckets) {
    const d = new Date(b.bucket_start * 1000);
    const day = d.getDay();
    const hour = d.getHours();
    const key = `${day}-${hour}`;
    cells[key] = (cells[key] ?? 0) + b.value;   // line 43 — accumulates
```
Groups purely by derived `{day, hour}` from `bucket_start`. Never keys on `dimensions.event_type` or any shard field. Two rows with the same `(day, hour)` — regardless of `event_type` or, after this phase, regardless of `shard` — are summed via `(cells[key] ?? 0) + b.value`. **Already tested for multi-row summing into one cell**: `convex/analytics.test.ts:169-179` feeds two rows with the *same* `bucket_start` but *different* `event_type` and asserts the cell sums to `3 + 5 = 8` — structurally identical proof shape to "two shard rows summed," just exercised via a different dimension today.

### `errorRateTrendFromAggregates` — SHARD-SAFE
`convex/analyticsRollupQueries.ts:71-76`:
```typescript
for (const b of buckets) {
    const eventType = (b.dimensions as { event_type?: string } | null)?.event_type;
    if (!eventType || !ERROR_EVENT_TYPES.has(eventType)) continue;
    const h = Math.floor((b.bucket_start - dayAgo) / 3600);
    if (h >= 0 && h < 24) counts[h] += b.value;   // line 75 — accumulates
```
Groups by derived hour-slot `h`, accumulates with `+=`. Never keys on shard. **Gap in existing test coverage** (not a defect, a coverage gap): `convex/analytics.test.ts:181-193` only ever supplies **one** row per hour slot per error type, so it never exercises the `counts[h] +=` accumulation path with two rows landing in the same slot. The code is correct (`+=`, not `=`), but this specific test would not have caught a regression to `=`. Flagged in "Common Pitfalls" and "Validation Architecture" below — recommend a new test with two same-hour, same-error-type rows.

### `sankeyFromAggregates` — SHARD-SAFE
`convex/analyticsRollupQueries.ts:107-108`:
```typescript
const key = `${source}::${target}`;
linkMap[key] = (linkMap[key] ?? 0) + b.value;   // line 108 — accumulates
```
Groups purely by `{source, target}` — `bucket_start` is not even part of the key (edges are summed across the entire 90-day window into one link weight). Never keys on shard. **Already directly tested for multi-row summing**: `convex/analytics.test.ts:195-215` feeds two rows with the same `{source, target}` at two different `bucket_start` values and asserts the link value is `3 + 2 = 5` (line 214) — again structurally identical to "sum across shards," just exercised via `bucket_start` variance rather than shard variance.

### Reference comparison confirmed
`convex/aggregates.ts:840-841`'s `eventCountsByPeriod` (CONTEXT.md's cited reference implementation) re-confirmed by direct read: `grouped[eventType] = (grouped[eventType] ?? 0) + r.value;` — identical accumulation shape. **This function is a live UI dependency**, not just a template: `src/pages/Analytics.tsx:73` calls `useQuery(api.aggregates.eventCountsByPeriod, { period: "daily" })` for the Analytics page's Total Events MetricCard — see "Additional reader found" below for why this makes `rollupDaily` load-bearing too.

## Additional Reader Found (not in CONTEXT.md's confirmed-clear list)

**`convex/aggregates.ts:423-472` `rollupDaily` reads `metric_type: "events"` and `metric_type: "sankey_edge"` rows and is already shard-safe** — this was not named anywhere in CONTEXT.md's "confirmed read-side call sites" list and must be verified independently rather than assumed clear.

`rollupDaily` queries `by_period_bucket` filtered only on `period: "hourly"` (line 429-434) — **not** filtered by `metric_type** — so it reads every hourly aggregate row for the day, including `events` and `sankey_edge` buckets written by ingest. It groups by `${row.metric_type}::${JSON.stringify(row.dimensions ?? {})}` (line 440) and accumulates `rollup[key].value += row.value` (line 444). Because `shard` is a **top-level field**, not part of `dimensions`, it is **not part of this grouping key either** — multiple shard-rows with identical `dimensions` collapse into one summed daily row exactly as multiple dimension-identical rows already do today. **No code change needed.** The daily row this writes carries no `shard` field at all (consistent with D-04's "missing shard reads as shard 0" contract).

**This reader is on the live UI critical path**: `rollupDaily` runs nightly at 01:00 UTC (`convex/crons.ts:21-25`) and its daily `events` output is exactly what `eventCountsByPeriod({period: "daily"})` returns to `Analytics.tsx`'s Total Events card. Existing test coverage: `convex/aggregates.test.ts:255-278` ("rollupDaily — summing logic") re-implements this grouping algorithm inline rather than calling the real exported function — see "Dangerous (false-green) tests" below.

## Standard Stack

No new external packages. This phase is a pure internal Convex schema + mutation + test change within the existing stack (`convex ^1.42.0`, confirmed live via `package.json`). No `npm install` is required.

### Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** Skipping the slopcheck/registry-verification protocol; nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
                     events.ingest (convex/events.ts:8-47)
                              │
                 ┌────────────┴─────────────┐
                 │ shard = Math.floor(       │   ← NEW: computed ONCE per
                 │   Math.random() * 8)      │      ingest call (D-01)
                 └────────────┬─────────────┘
                              │  shard passed as param (not re-rolled per call)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
incrementEventBucket   incrementSankeyEdge   incrementSankeyEdge
  (event bucket)         (edge A: cat→tool)    (edge B: tool→outcome)
        │                     │                     │
        ▼                     ▼                     ▼
  aggregates.by_type_period_bucket index lookup (metric_type, period, bucket_start)
        │            (UNCHANGED — shard is NOT indexed, same as `dimensions` today)
        ▼
  collect() all rows for that hour bucket → JS-match on {dimensions, shard} (Pitfall 3 extended)
        │
   found? patch value+1  :  insert new row {..., shard}
        │
        ▼
  ══════════════ read side (UNCHANGED — no code touches this) ══════════════
        │
  analytics.ts queries .collect() the SAME index range (metric_type, period, bucket_start≥cutoff)
        │  → now returns up to 8x rows per dimension key (one per shard that has fired)
        ▼
  analyticsRollupQueries.ts folds: group by {day,hour} / {source,target} / {hour-slot}
        │  (shard is invisible to every group key → rows collapse/sum automatically)
        ▼
  UI (Heatmap / Sankey / Error Trend / Total Events MetricCard)
```

### Recommended write-path shape (Task-level guidance for the planner)

```typescript
// convex/analyticsRollup.ts — signature change, D-03-compatible (same 3 round trips)
export async function incrementEventBucket(
  ctx: MutationCtx,
  eventType: string,
  timestamp: number,
  shard: number,          // NEW — caller-supplied, not Math.random() inside the helper
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;
  const bucketRows = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) =>
      q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
    )
    .collect();
  const existing = bucketRows.find((r) => {
    const dims = r.dimensions as { event_type?: string } | null;
    return dims?.event_type === eventType && r.shard === shard;   // ADDED: shard equality
  });
  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "events", period: "hourly", bucket_start: hourStart,
      value: 1, dimensions: { event_type: eventType }, shard,      // ADDED: shard field
    });
  }
}
```

```typescript
// convex/events.ts — ingest, D-01: shard chosen ONCE per ingest call
export const AGGREGATE_SHARD_COUNT = 8; // exported constant, imported by every write+read site that needs it (read sites don't need it today — see Priority Question)

// inside ingest handler, after the events.insert:
const shard = Math.floor(Math.random() * AGGREGATE_SHARD_COUNT);
await incrementEventBucket(ctx, args.eventType, args.timestamp, shard);
await incrementSankeyBuckets(ctx, args.eventType, args.toolName, args.timestamp, shard);
```

**Design note not covered explicitly by D-01/D-03 — flagged for the planner's decision:** D-01 says "shard assignment is `Math.floor(Math.random()*8)` per write," which is ambiguous between "per `events.ingest` call" (1 random draw, reused for all 3 sub-writes) and "per individual read-patch-or-insert" (3 independent draws). **Recommendation: one draw per `ingest` call.** The contention this phase fixes is *between concurrent `ingest` calls* hitting the same row — the 3 sub-writes within a single call are sequential awaits inside one transaction and never OCC-collide with each other regardless of whether they share a shard value. One draw is simpler, cheaper (1 `Math.random()` vs 3), and equally effective at spreading cross-call contention. This does not change D-01's outcome, only its mechanics, so it should not require a CONTEXT.md amendment — but the planner should state the choice explicitly in the plan since D-01's wording permits either reading.

### Read-side helper — Claude's Discretion item resolved by this research

CONTEXT.md's discretion note ("a shared `sumAcrossShards(rows)` utility vs. inline `.reduce()` at each call site... prefer one shared helper given 3+ call sites need the identical fold") **does not apply as stated** — this research found there is no new summing operation needed anywhere on the read side (see Priority Question above). Every one of the "3+ call sites" already performs the identical fold it always has; shard rows fall into existing group keys for free. **No new helper is required for correctness.** If the planner wants a helper regardless (e.g., for documentation/auditability), it would be purely cosmetic, not load-bearing — note this explicitly in the plan so it isn't miscounted as a correctness task.

### Anti-Patterns to Avoid
- **Adding `shard` to the `by_type_period_bucket` index.** Unnecessary and against this codebase's own established convention (`dimensions` is deliberately NOT indexed — Pitfall 3 comment in `analyticsRollup.ts:9-12` — collected and JS-matched instead). Indexing shard would also be the kind of index change CLAUDE.md's operational rules flag for extra scrutiny on the live self-hosted instance; the additive-optional-field-only approach avoids that risk entirely.
- **Calling `Math.random()` inside the shared increment helpers.** Makes `convex/analyticsRollup.test.ts`'s existing patch-vs-insert test (lines 193-208) genuinely flaky (7/8 chance of failing) the moment this ships — see "Dangerous tests" below. Pass shard as a parameter instead.
- **Writing a new `sumAcrossShards` read helper "to be safe."** Not wrong, but not needed — see above. Don't let the planner budget correctness risk to a task that doesn't reduce any actual risk.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| N/A for this phase | — | — | This phase deliberately keeps the existing hand-rolled read-patch-or-insert pattern (D-01/D-03 lock this in) rather than adopting Convex's official sharded-counter component — see "Convex-native prior art" below for why that swap is out of scope. |

**Key insight:** the one thing worth flagging is the inverse of the usual "don't hand-roll" guidance — this phase is explicitly choosing to keep the hand-rolled pattern rather than migrate to a purpose-built component, and that choice is already locked by D-01/D-02/D-03/D-04. The research below documents why that's a reasonable choice for this specific table shape, not a gap.

## Convex-Native Prior Art (informational only — NOT a proposal to adopt)

Convex ships an official `@convex-dev/sharded-counter` component (`get-convex/sharded-counter` on GitHub, listed at `convex.dev/components/sharded-counter`) `[CITED: convex.dev/components, github.com/get-convex — official Convex domains, not independently verified via Context7 in this session]`. Design summary at MEDIUM confidence (WebSearch, cross-referenced against the official `convex.dev`/`github.com/get-convex` domains, not verified via Context7 or `npm view` in this session):

- It is a **string-key → number** counter store (`shards: { beans: 10, users: 3 }`-style per-key shard-count configuration), isolated inside Convex's Components sandboxing.
- Explicitly documented tradeoff: **reading the count on every write loses the sharding benefit** — the same tradeoff this phase's D-03 (3 round trips per ingest, still reading-before-patching) already lives with, so adopting the component would not remove that cost.
- **Why it doesn't fit this phase without a rewrite**: the `aggregates` table is not a flat string→number counter — each row carries a rich `dimensions: v.any()` payload (`event_type`, or `{source, target}`) plus `metric_type`/`period`/`bucket_start`, and is read by multiple existing consumers (`analytics.ts`, `aggregates.ts` `eventCountsByPeriod`/`rollupDaily`) that all expect the current row shape. Migrating would mean a genuine data-model rewrite (new component storage, new read APIs, a data migration for ~1.94M rows) — exactly the class of work D-04 explicitly rules out for this phase ("no bulk rewrite of the existing rows"). This matches this repo's own prior conclusion on the identical question: `88-RESEARCH.md:555` (Phase 88) already evaluated and rejected adopting a dedicated aggregation component for this same table, for the same reason (no added capability, real migration cost).
- **The component's "missing shard" semantics differ from D-04's contract**: the component has no analog to "a row with no shard value reads as shard 0" — every key is componentized from creation. D-04's contract is specific to this table's incremental/optional-field rollout and has no direct precedent in the component's design.

**Conclusion for the planner:** this is confirmation, not a course change — the hand-rolled sharding D-01/D-02/D-03/D-04 already locked in is the right-sized fix for this table shape and this constraint set. No action needed beyond awareness.

## Write-Path Mechanics (detailed answer to scope item 3)

`convex/analyticsRollup.ts:26-107` and `convex/events.ts:8-47` read and confirmed:

- **`incrementEventBucket`** (`analyticsRollup.ts:26-57`): 1 read-patch-or-insert. Index lookup is `by_type_period_bucket.eq(metric_type).eq(period).eq(bucket_start)` (line 35-37) — an **exact** `bucket_start` equality, not a range — then `.collect()`s ALL rows for that single hour (across every `event_type` already, today) and JS-matches on `dimensions.event_type` (line 41-44).
- **`incrementSankeyBuckets`** (`analyticsRollup.ts:62-75`): calls `incrementSankeyEdge` twice (category→tool, tool→outcome) — 2 more read-patch-or-inserts, same index shape, same `.collect()`+JS-match pattern (line 84-94) on `{source, target}`.
- **Total: 3 round trips per `events.ingest` call**, unchanged by this phase (D-03).

**The index question, answered concretely**: `by_type_period_bucket` is `["metric_type", "period", "bucket_start"]` (`schema.ts:960`) — it does **not** include `dimensions` today, and per D-01/D-04 will **not** include `shard` either. This means the "find my shard's row" lookup does **not** become a fan-out across 8 separate index queries — it stays exactly one index-bounded `.collect()` call (same as today), with an additional equality check (`r.shard === shard`) added to the same JS `.find()` predicate that already checks `dimensions`. **This is the single most important mechanical fact for the planner**: sharding does not change the query shape or add index reads — it only adds one more field to an already-JS-side match.

**What DOES change, and should be flagged as a measurable but accepted cost**: the `.collect()` for a given `(metric_type, period, bucket_start)` today returns N rows (one per distinct `event_type` or `{source,target}` pair seen that hour). After sharding, it can return up to 8×N rows (each dimension-key now has up to 8 shard-variants). This is a real read-amplification increase on the ingest hot path — bounded, since `aggregates` rows carry no payload (`v.any()` optional, typically empty) per the file's own header comment (`analyticsRollup.ts:9-12`), but it is a change in the number of rows scanned per ingest call and should be watched post-deploy (see Common Pitfalls). This is also the exact mechanism referenced by D-01's own text choosing 8 over 16 "to keep read-time fan-out... cheap."

## Schema Change (scope item 4)

`convex/schema.ts:953-961` read and confirmed:
```typescript
aggregates: defineTable({
    metric_type: v.string(),
    period: v.string(),
    bucket_start: v.float64(),
    value: v.float64(),
    dimensions: v.optional(v.any()),
  })
    .index("by_type_period_bucket", ["metric_type", "period", "bucket_start"])
    .index("by_period_bucket", ["period", "bucket_start"]),
```
Adding `shard: v.optional(v.float64())` is a **pure additive optional field** — no index touches it (neither existing index needs to change, and per the Architecture Patterns section above, no new index is needed). Convex schema pushes that only add an optional field to an existing table require no backfill and do not delete or rebuild any index. `unverified` claim to flag explicitly: this research did not run `npx convex deploy` (read-only constraint on this research task) to observe the actual push output for this specific change — the "no index deleted" expectation is based on Convex's documented additive-schema-change semantics plus this repo's own precedent (see below), not a live-tested confirmation for this exact diff.

**Correct deploy invocation for the self-hosted backend** (established, repeatedly-used pattern in THIS repo, not the older "bare npx convex hits cloud" caution from before the self-hosted migration): `npx convex deploy --yes`, then **verify the printed target line reads `http://127.0.0.1:3210`** before trusting the result, and **verify the output contains `✔ No indexes are deleted by this push`**. This exact two-part verification has been performed and recorded live in this repo at least 5 times across Phases 103-105 (`.planning/STATE.md:439`, `103-02-SUMMARY.md:64-71`, `104-11-SUMMARY.md:100`, `104-VALIDATION.md:88-112`, `105-09-PLAN.md:63-150`) — `package.json`'s `deploy` script (`npx convex deploy && npx vite build`) and the repo's `.env.local` (not readable by this research per the env-file-guard rule) already resolve to the self-hosted target for this project as of the 2026-07-13 migration. The planner should have the implementer print and confirm the target line as the first line of evidence for any deploy step, per this repo's established pattern — do not skip that confirmation just because it "usually" targets self-hosted.

## Common Pitfalls

### Pitfall 1: Shard chosen inside the shared helper breaks existing test determinism
**What goes wrong:** If `Math.random()` is called inside `incrementEventBucket`/`incrementSankeyEdge` rather than passed in as a parameter, `convex/analyticsRollup.test.ts:194-207` ("first call inserts (value 1); second call for same {eventType, hour} patches to 2") becomes non-deterministic: the two calls in that test have a 7/8 chance of landing on different random shards, which would make the second call INSERT a new row instead of PATCH, failing the `toHaveLength(1)` assertion most of the time (and passing by luck 1/8 of the time — a genuinely dangerous flaky-pass).
**Why it happens:** the test calls `rollup.incrementEventBucket(ctx, eventType, timestamp)` twice with no shard control, expecting patch semantics.
**How to avoid:** make `shard` an explicit required parameter on every write-path function (see Code Examples above); update the test to pass a fixed shard (e.g. `0`) for both calls, and add a NEW test asserting that two calls with *different* explicit shard values for the same `{eventType, hour}` produce two separate rows.
**Warning signs:** any CI run of this suite showing an intermittent (not 100% reproducible) failure on this specific test after the shard change ships.

### Pitfall 2: Read amplification is real but easy to miss in review
**What goes wrong:** the ingest-time `.collect()` for a given hour bucket already scans every `event_type`/`{source,target}` seen that hour (unindexed dimension match, Pitfall 3 in the source file); after sharding it scans up to 8x that many rows. A reviewer scanning only the write-path diff might not notice this multiplies existing read cost rather than adding a new read.
**Why it happens:** shard is intentionally NOT part of the index (correctly, per Architecture Patterns above) — so its cost shows up as more rows returned from an unchanged query shape, not as a new query.
**How to avoid:** call this out explicitly in the plan's task description so a reviewer checks it; it's the same tradeoff D-01 already named for shard count 8 vs 16 (`analyticsRollup.ts` comment header + D-01's own text).
**Warning signs:** post-deploy, watch ingest mutation latency alongside the OCC-retry count (D-05) — a fix that trades OCC retries for meaningfully higher per-call latency is still worth knowing about even though it isn't a blocking concern at 8 shards.

### Pitfall 3: `rollupDaily` is a silent, non-obvious shard-relevant reader
**What goes wrong:** because `rollupDaily` filters only on `period: "hourly"` (not `metric_type`), it is easy to miss when enumerating "readers of `events`/`sankey_edge`" by grepping for `metric_type.*"events"` — it never mentions those literal strings.
**Why it happens:** the function is deliberately generic across all metric types (documented at `aggregates.ts:418-422`: "any metric_type... rolls into daily buckets automatically... do not fix this by adding a [metric-type]-specific branch").
**How to avoid:** this research already confirmed it's shard-safe (see "Additional Reader Found" above) — no fix needed, but the planner should list it explicitly as a verified-safe reader in the plan's audit trail rather than let it go unmentioned the way CONTEXT.md's original list did.
**Warning signs:** n/a — already verified safe; flagging so a future editor doesn't have to re-derive this.

### Pitfall 4: `backfillHistorical`'s pure inserts (Claude's Discretion item) — recommendation
**What goes wrong:** nothing, correctness-wise, either way (CONTEXT.md's own Claude's Discretion note already confirms this — "either is compatible with D-04's... read contract, so this has no correctness impact either way").
**Recommendation for the planner:** write shard `0` (or omit the field) on `backfillHistorical`'s inserts, not a random shard. It is a single-writer batch action with zero concurrency to spread (its own header comment confirms this: "amplification-free... in-memory aggregation... pure inserts"), so randomizing its shard adds code complexity for zero benefit and would be inconsistent with every other historical-data code path in this table treating "no shard" as the default.

## Code Examples

### Verified shard-safe accumulation pattern (already in production, template for any NEW code this phase adds)
```typescript
// Source: convex/aggregates.ts:840-841 (eventCountsByPeriod, confirmed shard-safe)
for (const r of rows) {
  const eventType = (r.dimensions as { event_type?: string } | null)?.event_type ?? "unknown";
  grouped[eventType] = (grouped[eventType] ?? 0) + r.value;
}
```

### Verified existing multi-row summing test (proves the pattern above is already regression-tested for the "2 rows, same group key" shape)
```typescript
// Source: convex/analytics.test.ts:195-214 (sankeyFromAggregates)
const { nodes, links } = analytics!.sankeyFromAggregates!([
  { bucket_start: 1_700_000_000, value: 3, dimensions: { source: "Tool Use", target: "Read" } },
  { bucket_start: 1_700_003_600, value: 2, dimensions: { source: "Tool Use", target: "Read" } },
  { bucket_start: 1_700_000_000, value: 4, dimensions: { source: "Read", target: "Success" } },
]);
// ...
expect(tuRead?.value).toBe(5); // 3 + 2 — proves cross-row summing on identical dimension key
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 1 row per `(metric_type, period, bucket_start, dimensions)` key, OCC-serialized writes | Up to 8 rows per key (`+shard`), summed at read time | This phase (107) | Spreads concurrent-write contention across up to 8 independent documents; read cost per bucket grows up to 8x, bounded by slim `v.any()` rows |

**Deprecated/outdated:** none — this is additive, not a replacement of any prior mechanism. Phase 88's original rollup design (single row per key) is left in place for `cost`/`tokens`/`tokens_prompt`/`tokens_completion`/`tool_*` metric types (D-02, cron-driven, never contended).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Convex additive-optional-field schema pushes never touch or rebuild existing indexes (used to justify "no index deletion risk" for the `shard` field) | Schema Change | LOW — this is documented, stable Convex behavior and matches this repo's own precedent for prior optional-field additions (e.g. `idempotencyKey` on `events`, `traceId`/`round` on `toolExecutions`/`llmMetrics` per Phase 105 history); if wrong, the deploy step's own printed "No indexes are deleted" check (already part of this repo's established verification ritual) catches it before any damage |
| A2 | The `@convex-dev/sharded-counter` component's design summary (shard-count-per-key, read-loses-sharding-benefit tradeoff) | Convex-Native Prior Art | LOW — this section is explicitly informational only, not used to justify any implementation decision; D-01/D-02/D-03/D-04 are locked regardless of this component's exact design |
| A3 | `.env.local`'s `CONVEX_SELF_HOSTED_URL`/`CONVEX_SELF_HOSTED_ADMIN_KEY` currently resolve `npx convex deploy --yes` to `http://127.0.0.1:3210` by default | Schema Change / Deploy invocation | LOW-MEDIUM — this research could not read `.env.local` (env-file-guard blocks it); the claim is inferred from 5+ independent prior-phase SUMMARY/VALIDATION docs in this same repo all showing that exact target resolving without extra flags, not from reading the env file directly. If the env file has since changed, the implementer's own required "verify the printed target line" step (already mandated above) catches it before any live write. |

## Open Questions

1. **Should shard be drawn once per `events.ingest` call, or once per each of the 3 sub-writes?**
   - What we know: D-01's "per write" wording is compatible with either reading; correctness and contention-spreading are identical either way since the 3 sub-writes never OCC-collide with each other (single transaction, sequential awaits).
   - What's unclear: whether "Claude's Discretion" implicitly covers this (CONTEXT.md doesn't list it explicitly under that heading).
   - Recommendation: one draw per `ingest` call, passed as a parameter to both helpers (see Architecture Patterns above). Simpler, cheaper, no correctness difference. Planner should state this choice explicitly in the plan rather than leave it implicit.

2. **Does the live self-hosted schema push for this exact diff actually print "No indexes are deleted"?**
   - What we know: Convex's documented semantics say additive optional fields never touch indexes; this repo has 5+ precedents of similar additive-field pushes confirming exactly that output.
   - What's unclear: this research did not run the actual deploy (out of scope — read-only constraint), so this is a strong expectation, not a live-observed fact for this specific diff.
   - Recommendation: the plan's deploy task must capture and assert the literal `✔ No indexes are deleted by this push` string in its own verification step, matching this repo's established pattern — do not assume it silently.

## Environment Availability

Not applicable in the "external tool/service" sense this section normally covers — this phase's only "environment dependency" is the live self-hosted Convex instance itself, which is already the deployment target for every other phase in this milestone. No new external dependency is introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Self-hosted Convex backend (`convex-backend`, `http://127.0.0.1:3210`) | Schema push, D-05 measurement | ✓ (per repeated recent-phase precedent, not re-probed live by this research) | convex ^1.42.0 client | none — this IS the target system |
| `docker logs convex-backend` | D-05 measurement | ✓ (established tooling, used in every prior incident diagnosis per `convex-selfhosted-setup` memory) | — | none |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.9 (jsdom environment; Convex tests use an in-memory fake `ctx.db`, see `analyticsRollup.test.ts:25-53`'s `makeStore()`) |
| Config file | `vitest.config.ts` (repo root, not modified by this phase) |
| Quick run command | `npx vitest run convex/analyticsRollup.test.ts convex/aggregates.test.ts convex/analytics.test.ts convex/events.test.ts` |
| Full suite command | `npm test` (Vitest, no `run` flag needed for CI-mode single pass: `npx vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OCC-01 | Shard assignment spreads writes across 0-7 (unit-testable distribution/shape, NOT contention itself) | unit | `npx vitest run convex/analyticsRollup.test.ts -t "shard"` | ❌ Wave 0 — new tests needed, see gaps below |
| OCC-01 | Read-patch-or-insert respects shard: same shard patches, different shard inserts a new row | unit | `npx vitest run convex/analyticsRollup.test.ts -t "increment patch-or-insert"` | ⚠️ Exists (`analyticsRollup.test.ts:193-208`) but must be rewritten to pass explicit shard params — see Pitfall 1 |
| OCC-01 | Cross-shard summing: N rows with same dimension key but different shard values sum correctly at read time | unit | `npx vitest run convex/analyticsRollup.test.ts convex/analytics.test.ts convex/aggregates.test.ts -t "shard"` | ❌ Wave 0 — new tests needed, see gaps below |
| OCC-01 | Missing/undefined `shard` (pre-existing unsharded rows) reads as shard 0 / participates in summing normally | unit | new test in `analyticsRollup.test.ts` or `aggregates.test.ts` | ❌ Wave 0 |
| OCC-01 | Live OCC-retry count drops post-deploy vs. the 1135/24h 2026-08-05 baseline (D-05) | **live measurement only — cannot be unit-tested** | `docker logs convex-backend --since <window>h \| grep -Ei 'occ\|conflict\|retry' \| wc -l` | n/a — not a test file, an operational measurement (see below) |

### Sampling Rate
- **Per task commit:** `npx vitest run convex/analyticsRollup.test.ts convex/aggregates.test.ts convex/analytics.test.ts` (scoped to touched files)
- **Per wave merge:** `npm test` (full suite) + `npx tsc --noEmit`
- **Phase gate:** full suite green, `tsc --noEmit` clean, AND the D-05 live before/after log comparison (see below) — the phase is NOT done on green tests alone; D-05 requires live evidence.

### Wave 0 Gaps
- [ ] `convex/analyticsRollup.test.ts` — rewrite the "increment patch-or-insert" test (lines 193-208) to pass explicit `shard` values; it will otherwise become non-deterministically flaky (Pitfall 1). This is a MODIFICATION to an existing test, not a new file.
- [ ] `convex/analyticsRollup.test.ts` — new test: two `incrementEventBucket` calls with the same `eventType`/hour but *different* explicit shard values produce **two** separate rows (proves the shard split actually happens, not just that shard doesn't break the old case).
- [ ] `convex/aggregates.test.ts` and/or `convex/analytics.test.ts` — new test: seed 2+ `aggregates` rows with identical `dimensions` but different `shard` values (simulating post-fix live data) and assert `eventCountsByPeriod`/`heatmapFromAggregates`/`sankeyFromAggregates`/`errorRateTrendFromAggregates` each return the FULL summed value, not just one shard's contribution. **This is the actual regression guard the priority question was asking for** — without it, nothing in the suite proves the fold sums across a real multi-shard fixture, even though the code inspection above shows it should.
- [ ] `convex/analytics.test.ts` — strengthen `errorRateTrendFromAggregates`'s test (currently lines 181-193) with a second same-hour, same-error-type row to actually exercise the `counts[h] +=` accumulation path (see Priority Question's per-function note — this is the one function whose existing test doesn't already prove multi-row summing into the same slot).
- [ ] No new test framework/config install needed — Vitest is already fully wired.

### Dangerous (false-green) tests — explicitly named per this phase's instructions

1. **`convex/aggregates.test.ts:255-278` ("rollupDaily — summing logic") and `convex/aggregates.test.ts:390-401` ("eventCountsByPeriod groups by event_type")**: both **re-implement the grouping algorithm inline inside the test** (`const rollup: Record<...> = {}; ... rollup[key].value += row.value;`) rather than importing and calling the real exported `rollupDaily`/`eventCountsByPeriod` functions. **These tests will continue to pass unconditionally even if the real production code is later broken** (e.g., someone "optimizes" `rollupDaily` to `.first()` per key instead of accumulating) — they only prove the *algorithm shape* is correct in the abstract, not that the shipped code implements it. This is a **pre-existing weakness, not introduced by this phase**, but this phase's own correctness claim ("rollupDaily is shard-safe") rests partly on code review of the real function, not on these tests, precisely because these tests don't exercise the real function. The new Wave-0 tests above (calling the real exported functions with real fake-`ctx.db` fixtures, matching `analyticsRollup.test.ts`'s `makeStore()` pattern) are what actually closes this gap for the shard-safety claim specifically.
2. **Any test that asserts on total row *count* after a sharded write, without also asserting on summed *value*.** A test that only checks "`store.aggregates.length` increased" after an ingest call would pass regardless of whether the summing logic is broken — count and correctness are orthogonal once there are multiple rows per logical bucket. Every new shard test must assert on the folded/summed value, not merely on row presence.
3. **A live "OCC retries went down" observation without also confirming the read-side totals are still correct.** It is possible to "fix" OCC contention by accident while silently breaking a fold (e.g., a bad merge that drops the `+=` in one function) — a lower retry count alone does not prove OCC-01 is correctly implemented, only that contention dropped. The plan should pair the D-05 live measurement with a live spot-check: compare a recent hour's `eventCountsByPeriod` total against a manual count of raw `events` rows for that hour (the exact technique `88-03-PLAN.md:99` already used to validate the original non-sharded rollup — "pick 1-2 recent hours and compare... They should match").

### D-05 Measurement Procedure (scope item 7)

**Exact commands, established and already trusted per CONTEXT.md D-05 and the `convex-selfhosted-setup` memory (2026-07-30, 2026-08-05 incidents both diagnosed this way):**

```bash
# BEFORE deploy — capture a baseline window immediately before the shard fix ships.
# Use the SAME window length both times (e.g. 24h) for a valid comparison.
docker logs convex-backend --since 24h 2>&1 | grep -Ei 'occ|conflict|retry' | wc -l
# Record this number AND the exact timestamp the command was run — the "before" number
# is worthless without knowing precisely what window it covers, since traffic is not
# uniform (bursty Ástríðr agent sessions).
```

```bash
# Deploy the shard fix (npx convex deploy --yes — verify target + "No indexes deleted" per Schema Change section).
```

```bash
# AFTER deploy — wait a COMPARABLE live-traffic window (the same 24h, or whatever window
# was used before), then run the identical command:
docker logs convex-backend --since 24h 2>&1 | grep -Ei 'occ|conflict|retry' | wc -l
```

**Window discipline — explicitly required for validity, not optional:**
- Both windows must be the same LENGTH (D-05 specifies the 2026-08-05 baseline is 1135/24h — match 24h for the after-window too, not a shorter "looks fixed already" spot check).
- Both windows should cover comparable traffic (same rough time-of-day mix if usage is diurnal) — note in the plan/summary if the after-window's traffic volume looked meaningfully different (e.g., from `events` row counts for that window) so the comparison's validity can be judged honestly rather than assumed.
- **`console.log` inside a Convex UDF does NOT reach `docker logs` on self-hosted Convex** (confirmed 2026-07-30, `convex-selfhosted-setup` memory) — this means an in-code retry counter added to `incrementEventBucket` etc. CANNOT be the evidence; do not attempt to add one. The OCC error string (`Caught occ error`) is emitted by the Convex runtime itself, which does reach `docker logs` — this is the only valid source for D-05.
- **Do not run a synthetic concurrent-write load test as the D-05 evidence** — CONTEXT.md's `<deferred>` section explicitly rules this out for this phase; the live before/after comparison is the sole required evidence.

