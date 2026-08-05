/**
 * Aggregate write-path shard cardinality.
 * Single source of truth for how many shards an "events" / "sankey_edge"
 * aggregates bucket is split across (Phase 107, D-01). Both `events.ts`'s
 * `ingest` mutation and `analyticsRollup.ts`'s increment helpers import from
 * here — never hardcode the shard count at a call site.
 *
 * Raising this count later needs no schema or index change: `shard` is an
 * unindexed optional integer field on `aggregates` (see schema.ts), so
 * widening the range is a one-line change here.
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
