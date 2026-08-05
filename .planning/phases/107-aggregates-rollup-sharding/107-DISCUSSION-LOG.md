# Phase 107: Aggregates Rollup Sharding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-05
**Phase:** 107-Aggregates Rollup Sharding
**Areas discussed:** Shard key & count, Sharding scope, Existing row migration, Verification method

---

## Shard key & count

| Option | Description | Selected |
|--------|-------------|----------|
| Random 0..N-1 per write | Math.random() picks a shard on every increment call; simplest, evenly distributes load, no dependency on any field | ✓ |
| Hash of sessionId mod N | Deterministic per session, but a bursty single session doesn't get spread at all | |
| Hash of _creationTime/UUID mod N | Similar to random, no real advantage over Math.random() on Convex | |

| Option | Description | Selected |
|--------|-------------|----------|
| 8 shards | Cuts collision probability ~8x, cheap read-time fan-out (8 point-index lookups) | ✓ |
| 16 shards | Better collision reduction but doubles read-time fan-out across 9 reader files | |
| Adaptive/configurable | Store as one constant, tunable, but start fixed rather than runtime-adaptive | |

**User's choice:** Random 0..N-1 via Math.random(); 8 shards.
**Notes:** No follow-up questions — moved directly to next area.

---

## Sharding scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only events + sankey_edge | The two metric_types written inside events.ingest, proven contended by live OCC-retry logs; cost/tokens are cron-driven single-writer, never contended | ✓ |
| All four metric_types | Uniform shape but adds fanout to metric_types with no contention problem | |

| Option | Description | Selected |
|--------|-------------|----------|
| Shard only, leave 3 round-trips as-is | Scope discipline — round-trip consolidation is a separate, riskier ingest hot-path refactor | ✓ |
| Also batch the 3 writes into fewer round trips | More efficient end state but expands scope/risk on the hottest path in one pass | |

**User's choice:** Only events + sankey_edge; shard only, no round-trip consolidation.
**Notes:** No follow-up questions.

---

## Existing row migration

| Option | Description | Selected |
|--------|-------------|----------|
| Old rows implicitly = shard 0, no rewrite | Optional shard field, readers sum-across-shards treating missing as shard 0; zero migration risk, respects CLAUDE.md's no-bulk-patch rule | ✓ |
| Bulk-backfill existing rows with a shard value | Directly violates CLAUDE.md's no-bulk-patch rule — the exact 2026-07-22 tombstone-poisoning pattern | |

**User's choice:** No rewrite — shard is optional, missing = shard 0.
**Notes:** No follow-up questions.

---

## Verification method

| Option | Description | Selected |
|--------|-------------|----------|
| Live before/after OCC-retry log count | docker logs grep for occ/conflict/retry, same measurement used in every prior incident diagnosis, directly comparable to the 1135/24h baseline | ✓ |
| Synthetic concurrent-write test | Proves the mechanism in isolation, deterministic, but doesn't confirm real-world traffic patterns | |
| Both | Covers both angles but costs an extra plan/verification step | |

**User's choice:** Live before/after OCC-retry log count only.
**Notes:** No follow-up questions.

---

## Claude's Discretion

- Exact shape of the shard-summing helper (shared utility vs. inline reduce)
- Location of the `AGGREGATE_SHARD_COUNT` constant
- Whether `backfillHistorical`'s inserts assign a random shard or default to shard 0 (no correctness impact either way per D-04's read contract)

## Deferred Ideas

- Collapsing the 3 read-patch-or-insert round trips into fewer round trips (separate, riskier ingest hot-path refactor)
- Synthetic concurrent-write test as a future regression guard
- Sharding cost/tokens metric_types (only if they ever show contention in a future incident log)
