# Phase 88: Analytics Rollup - Context

**Gathered:** 2026-06-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every analytics query read **pre-aggregated rollup buckets** instead of scanning raw event documents, eliminating the Convex 16 MiB/exec read-limit risk permanently. Convex-only — no UI surface.

In scope (AR-01..03):
- Maintain rollup buckets (reusing/extending the existing `aggregates` table) so `analytics.ts` queries read O(buckets) instead of O(events).
- Make rollups correct under real ingest: idempotent on at-least-once retries, archival/retention-consistent, with a one-time historical backfill.
- Remove all `.take()` count caps from `analytics.ts` once rollups are authoritative; restore full data fidelity (heatmap/sankey/error-trend no longer bounded by the quick-unblock caps).

Affected queries: `activityHeatmap`, `toolFlowSankey`, `errorRateTrend`, `tokenSunburst`, `tokenWaterfall` (`convex/analytics.ts`).

Out of scope: any UI/frontend change; new analytics visualizations; cross-repo work beyond the tracked emitter follow-up below.
</domain>

<decisions>
## Implementation Decisions

### Rollup write trigger — Hybrid
- **D-01:** Use a **hybrid** write model. **Ingest-time increments** for the hot analytics metrics (per-eventType hourly event-count buckets + sankey edge buckets), maintained inside `ingest.ts` / `runtimeIngest.ts` as events arrive. **Retain the existing cron** (`aggregates.computeHourly` / `rollupDaily`) for cost and daily rollups.
- **D-02:** Move the per-eventType **hourly event-count aggregation off the cron and into ingest-time** so the cron no longer `.collect()`s raw `events` (that cron scan is the current latent 16 MiB risk). Remove the event-count branch from `computeHourly` to avoid double-writing the same buckets.
- **D-03:** Whatever aggregation **remains in the cron** (cost from `llmMetrics`, daily rollup) must be made read-safe. `llmMetrics` rows are slim (lower risk than fat `events.payload`), but the cron should **paginate raw reads defensively** rather than unbounded `.collect()` so it can never exceed 16 MiB at high volume. (Planner detail — flag, don't over-spec.)

### Idempotency — producer key, deduped at raw insert, CodePulse-first
- **D-04:** Add an **optional `idempotencyKey`** field to the events ingest schema + a **`by_idempotencyKey` index**. Dedup happens at the **raw event insert**, inside **one Convex mutation** (lookup-by-key → skip-or-insert+increment), so OCC makes the check-then-write atomic — two racing at-least-once retries can't both insert (one hits a write conflict, retries, sees the other's row, skips). This guarantees no double-count for both raw events AND rollups in a single transaction.
- **D-05:** **Rollout = CodePulse-first, key-optional.** When `event_id` is present, use it as the authoritative dedup key. When **absent (legacy/transition events), treat the event as unique (count once)** — do **NOT** apply a lossy consumer hash, because a hash of `sessionId+timestamp+eventType+toolName` can silently **drop** two genuine identical events. Bounded transitional duplicates on a telemetry dashboard are acceptable; dropped events are silent corruption.
- **D-06:** Phase 88 ships **entirely in Convex** with no hard cross-repo dependency. The `astridr-repo` emitter change (stamp a stable `event_id` on every emitted event, resent unchanged on retry) is a **committed follow-up** that closes the dedup window — see Deferred Ideas. The phase is "done" without it; the guarantee tightens automatically once it lands.

### Rollup dimensions — Minimal (reuse + derive)
- **D-07:** **Heatmap** derives at query time from the ingest-time **hourly event-count buckets** (sum across eventTypes, map absolute hour buckets → day-of-week × hour). No dedicated heatmap metric_type.
- **D-08:** **Error-trend** derives from the same hourly event-count buckets, filtered to error eventTypes (`Error`, `ToolError`, `PostToolUseFailure`). No dedicated error metric_type.
- **D-09:** The **only new dimensional data** is **Sankey edge buckets** (`category→tool` and `tool→outcome` edge counts per hour). New `metric_type` on the `aggregates` table; rows are tiny but cardinality scales with distinct tools per hour (acceptable — slim rows).
- **D-10:** **`tokenSunburst`** (30-day provider/model breakdown) reads the **existing cost `aggregates`** (provider/model dimensions already present) instead of scanning `llmMetrics`.

### Backfill — Full history, paginated
- **D-11:** One-time historical backfill is a **paginated action** (cursor batches) over ALL existing events/llmMetrics, so the backfill itself never hits the 16 MiB read limit. Complete fidelity from day one; slower one-time run is acceptable.

### Retention / archival consistency
- **D-12:** Rollups are **immutable historical buckets, decoupled from the raw event lifecycle**. `dataRetention.purgeOldTelemetryEvents` hard-deletes raw events but must **never touch `aggregates`**. Re-running aggregation must not recompute deleted buckets (the existing "skip already-aggregated bucket key" idempotency already provides this for the cron path; ingest-time increments are inherently append-forward). This satisfies AR-02 archival-consistency by construction.

### Claude's Discretion
- Exact new `metric_type` / `dimensions` naming and index definitions on `aggregates`.
- The precise mutation refactor that folds dedup-check + insert + rollup increment into one transaction (likely consolidating/extending `api.events.insert`).
- `tokenWaterfall` is a deliberately **raw 30-minute time-series** of slim `llmMetrics` rows (already capped at 30000); leave it raw-but-bounded rather than forcing it into rollups — it is not a rollup candidate. Confirm the cap is safe; do not invent a waterfall rollup.
- Pagination batch sizes for backfill and the hardened cost cron.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 88 goal + 4 success criteria (verbatim acceptance bar).
- `.planning/REQUIREMENTS.md` — AR-01, AR-02, AR-03 (full requirement text).

### Code to modify / reuse (full paths)
- `convex/analytics.ts` — the 5 queries to convert; remove `.take()` caps (lines 15, 48, 159/166/173, 106, 239).
- `convex/aggregates.ts` — existing `aggregates` table writer (`computeHourly`, `rollupDaily`); idempotency "skip existing dimension key" pattern to reuse; move event-count branch to ingest-time.
- `convex/crons.ts` — `aggregate-hourly` / `aggregate-daily` cron wiring (`computeHourly`, `rollupDaily`).
- `convex/ingest.ts` — build-time event dispatch; ingest-time increment + dedup hooks land here.
- `convex/runtimeIngest.ts` — runtime event dispatch (llm/docker/profile); ingest-time increment hooks for runtime metrics.
- `convex/events.ts` — raw event insert (`:18`); add `idempotencyKey` dedup here.
- `convex/schema.ts` — `aggregates` table (`:883`) `{metric_type, period, bucket_start, value, dimensions}` + indexes; `events` table (add `idempotencyKey` + index).
- `convex/dataRetention.ts` — `purgeOldTelemetryEvents` hard-deletes raw events; verify it never mutates `aggregates`.

No external ADRs/specs for this phase — decisions fully captured above.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`aggregates` table** (`convex/schema.ts:883`): `{metric_type, period, bucket_start, value, dimensions}` with `by_type_period_bucket` and `by_period_bucket` indexes — already the rollup store. Extend, don't replace.
- **Idempotency pattern** (`convex/aggregates.ts:34-58`): "collect existing rows for this bucket → reconstruct dimension keys → skip already-aggregated keys" — directly reusable for the cron-retained metrics; informs the ingest-time dedup design.
- **Existing cost dimensions** (`aggregates.ts` cost rows: provider/model/billingType/goalId) — `tokenSunburst` can read these directly (D-10).

### Established Patterns
- Ingest dispatches by `eventType` via `ctx.runMutation(api.domain.insert, ...)` from an httpAction (`ingest.ts`). httpActions are **not** transactional — dedup + increment must be folded into the called **mutation** to get OCC atomicity (D-04).
- Convex has no upsert; rollup increment = read bucket row → `patch` value (or insert if absent), all in one mutation.
- Retention currently **hard-deletes** (`ctx.db.delete`) rather than using the `archived` flag for telemetry events (`dataRetention.ts:17`).

### Integration Points
- Ingest-time increments hook into `ingest.ts` / `runtimeIngest.ts` per-eventType branches.
- Analytics queries (`analytics.ts`) switch from raw-event scans to `aggregates` index reads via `by_type_period_bucket`.
- Cross-repo: `astridr-repo` event emitter (follow-up `event_id` stamp).
</code_context>

<specifics>
## Specific Ideas

- Larry's robustness rationale (locked): producer-generated key > consumer hash because only a UUID distinguishes two byte-identical events; a hash risks silently dropping real events. Dedup at raw insert (not just rollup) keeps raw + rollups consistent and fixes pre-existing raw duplication as a bonus. Atomicity comes from doing it all in one Convex mutation (OCC).
</specifics>

<deferred>
## Deferred Ideas

- **`astridr-repo` emitter `event_id` change** — stamp a stable UUID on every emitted event, resent unchanged on at-least-once retry. Committed cross-repo follow-up that upgrades D-05 from "count un-keyed events as unique" to airtight dedup. NOT a Phase 88 blocker. Track as a cross-repo task / `astridr-repo` issue.
- **Retire `.take()` defensive caps on `tokenWaterfall` / `tokenSunburst`** only after rollups prove authoritative — already covered by AR-03, noted to avoid premature cap removal before buckets exist.

None of the above expands Phase 88 scope — they are downstream/cross-repo follow-ups.
</deferred>

---

*Phase: 88-analytics-rollup*
*Context gathered: 2026-06-23*
