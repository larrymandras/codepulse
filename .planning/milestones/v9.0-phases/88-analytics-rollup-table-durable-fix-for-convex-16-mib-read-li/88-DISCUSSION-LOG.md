# Phase 88: Analytics Rollup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 88-analytics-rollup
**Areas discussed:** Write trigger, Idempotency, Rollup dimensions, Backfill, Cross-repo rollout

---

## Write trigger (where rollup counts get written)

| Option | Description | Selected |
|--------|-------------|----------|
| Ingest-time increment | Increment buckets inside ingest as each event arrives. O(buckets) reads, no scan. Adds write-amplification + idempotency to hot path. | |
| Harden the existing cron | Keep cron aggregation but paginate raw reads so cron never exceeds 16 MiB. Simplest, reuses idempotency; but lags up to 1h, contradicts AR-01 wording. | |
| Hybrid | Ingest-time for hot metrics (heatmap/sankey/error); keep cron for cost/daily. Best fidelity + lowest lag, most surface to build/test. | ✓ |

**User's choice:** Hybrid
**Notes:** Key code finding driving this — the existing cron (`aggregates.computeHourly`) still `.collect()`s raw events hourly, so the cron is itself the live read-limit risk, not just the queries. Hybrid moves per-eventType event-count aggregation to ingest-time; cron retains cost/daily but must paginate defensively.

---

## Idempotency (no double-count on at-least-once retries; no dedup key exists today)

| Option | Description | Selected |
|--------|-------------|----------|
| Add ingest idempotency key | Producer sends stable event_id; ingest dedupes before insert+increment. Fixes raw duplication too; needs astridr-repo emitter change. | ✓ |
| Bucket-key skip (cron-style) | Reuse existing "skip already-aggregated dimension key" pattern. Proven, no cross-repo change; only works for batch/cron, not per-event. | |
| Derive from event _id | Recompute buckets from inserted rows (idempotent by construction). No new key/cross-repo, but still reads rows (must paginate). | |

**User's choice:** Add ingest idempotency key
**Notes:** Rollout shape decided in a follow-up question (see Cross-repo rollout below).

---

## Rollup dimensions (existing aggregates holds cost/events/errors; sankey+heatmap need new shapes)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — reuse + derive | Heatmap & error-trend derive from existing hourly event-count buckets; only add Sankey edge buckets. Smallest schema change, lowest write cost. | ✓ |
| Full per-query rollups | Dedicated metric_types for every analytics query. More buckets/writes, but each query reads exactly its shape. | |

**User's choice:** Minimal — reuse + derive
**Notes:** tokenSunburst additionally reads existing cost aggregates (provider/model dims already present).

---

## Backfill scope (one-time historical backfill action, AR-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Full history, paginated | Backfill from ALL existing events via paginated/cursor action so backfill never hits 16 MiB. Complete fidelity; slower one-time run. | ✓ |
| Bounded window (e.g. 90d) | Backfill only the trailing window the queries display. Faster; older events age out via retention anyway. | |

**User's choice:** Full history, paginated

---

## Cross-repo rollout (idempotency key — phase scoped Convex-only)

| Option | Description | Selected |
|--------|-------------|----------|
| CodePulse-first, key-optional | Optional idempotencyKey + index; dedup at raw insert in ONE mutation (OCC = airtight). event_id used when present; absent = treat as unique (NO lossy hash). Ship in Convex now; astridr-repo emitter is committed follow-up. | ✓ |
| Coordinated both-repos | event_id required end-to-end before phase done; emitter change in-scope. Strongest day-one, but hard cross-repo dependency + second repo to deploy. | |
| Derive key in ingest only | Consumer hash of sessionId+timestamp+eventType+toolName. Zero astridr-repo change, but collision risk silently DROPS genuine identical events. Least robust. | |

**User's choice:** CodePulse-first, key-optional (Recommended)
**Notes:** Larry asked for the most robust solution for the stack. Recommendation rationale (locked): (1) Convex OCC makes lookup→skip-or-insert+increment in one mutation atomic — airtight no-double-count; (2) producer UUID > consumer hash because only a UUID distinguishes two byte-identical events, and a hash can silently drop real events; (3) dedup at raw insert keeps raw + rollups consistent and fixes pre-existing raw duplication; (4) key-optional fallback "count un-keyed as unique" keeps Phase 88 a no-hard-dependency Convex-only phase, with the astridr-repo emitter change as a committed follow-up that closes the window.

---

## Claude's Discretion

- Exact new `metric_type` / `dimensions` naming and `aggregates` indexes.
- The mutation refactor folding dedup-check + insert + rollup increment into one transaction.
- `tokenWaterfall` stays a raw, bounded 30-min `llmMetrics` time-series — not a rollup candidate.
- Pagination batch sizes (backfill + hardened cost cron).

## Deferred Ideas

- `astridr-repo` emitter `event_id` stamp — committed cross-repo follow-up; upgrades dedup to airtight. Not a Phase 88 blocker.
- Premature removal of `tokenWaterfall`/`tokenSunburst` defensive `.take()` caps — only after rollups prove authoritative.
