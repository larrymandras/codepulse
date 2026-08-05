/**
 * Aggregate write-path shard cardinality.
 * Single source of truth for how many shards an "events" / "sankey_edge"
 * aggregates bucket is split across (Phase 107, D-01). Both `events.ts`'s
 * `ingest` mutation and `analyticsRollup.ts`'s increment helpers import from
 * here — never hardcode the shard count at a call site.
 *
 * Raising this count later still needs no schema or index change — widening the
 * range stays a one-line change here. (Corrected plan 107-07: `shard` is no
 * longer "an unindexed optional integer field" as this header used to say. It is
 * now the last field of `by_type_period_bucket_key_shard`, which the write path
 * pins with eq() so an ingest reads one row instead of the whole bucket. A wider
 * range simply means more distinct index values, not a migration.)
 *
 * Sequencing note carried forward from 107-06: do NOT raise this count as a
 * contention lever while the read set is wide. A higher count widens each bucket,
 * and 107-06 measured exactly that effect — sharding alone took retries per 1k
 * events from 1188.5 to 2025.8 (+70.5%) because the read set was never narrowed.
 * Narrow the read set first (plan 107-07 does), then re-measure before touching
 * this number, so each cycle moves one variable.
 */

export const AGGREGATE_SHARD_COUNT: number = 8;

// Returns an integer in [0, AGGREGATE_SHARD_COUNT). Call this ONCE per
// logical ingest and pass the result down explicitly to every increment
// helper that write shares it. Calling it INSIDE a shared increment helper
// instead would make the write path non-deterministic across the helper's
// own multiple call sites (e.g. incrementSankeyBuckets's two edges) and
// would flake analyticsRollup.test.ts's patch-vs-insert assertions ~7 times
// in 8, since two draws would land on different shards most of the time.
export function pickShard(): number {
  return Math.floor(Math.random() * AGGREGATE_SHARD_COUNT);
}
