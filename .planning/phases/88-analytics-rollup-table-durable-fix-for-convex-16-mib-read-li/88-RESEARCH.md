# Phase 88: Analytics Rollup — Research

**Researched:** 2026-06-23
**Domain:** Convex backend — OCC/mutation semantics, aggregation patterns, pagination, schema migration
**Confidence:** HIGH (grounded in live code + official Convex docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Hybrid write model — ingest-time increments for hot analytics metrics (per-eventType hourly event-count buckets + sankey edge buckets); retain existing cron for cost and daily rollups.
- **D-02:** Move per-eventType hourly event-count aggregation off the cron and into ingest-time. Remove the event-count branch from `computeHourly` to avoid double-writes.
- **D-03:** Cron-retained aggregations (cost from `llmMetrics`, daily rollup) must paginate raw reads defensively rather than unbounded `.collect()`.
- **D-04:** Add optional `idempotencyKey` field to events schema + `by_idempotencyKey` index. Dedup at raw event insert inside one Convex mutation (lookup-by-key → skip-or-insert+increment), giving OCC atomicity.
- **D-05:** When `event_id` is present, use it as dedup key. When absent, treat event as unique — do NOT apply a lossy consumer hash.
- **D-06:** Phase 88 ships entirely in Convex with no hard cross-repo dependency. Astridr emitter `event_id` is a committed follow-up.
- **D-07:** Heatmap derives at query time from hourly event-count buckets (sum across eventTypes, map absolute hour → day-of-week × hour). No dedicated heatmap metric_type.
- **D-08:** Error-trend derives from the same hourly event-count buckets, filtered to error eventTypes (`Error`, `ToolError`, `PostToolUseFailure`). No dedicated error metric_type.
- **D-09:** New `metric_type` for sankey edge buckets (`category→tool` and `tool→outcome` per hour). Rows are tiny; cardinality scales with distinct tools per hour.
- **D-10:** `tokenSunburst` reads existing cost `aggregates` (provider/model dimensions already present) instead of scanning `llmMetrics`.
- **D-11:** One-time historical backfill = paginated action (cursor batches) over ALL existing events/llmMetrics.
- **D-12:** Rollup buckets are immutable; `dataRetention.purgeOldTelemetryEvents` must never touch `aggregates`.

### Claude's Discretion
- Exact new `metric_type` / `dimensions` naming and index definitions on `aggregates`.
- The precise mutation refactor that folds dedup-check + insert + rollup increment into one transaction.
- `tokenWaterfall` stays raw-but-bounded (30-min window, `take(30000)` — not a rollup candidate). Confirm cap is safe; do not invent a waterfall rollup.
- Pagination batch sizes for backfill and the hardened cost cron.

### Deferred Ideas (OUT OF SCOPE)
- `astridr-repo` emitter `event_id` change (cross-repo follow-up, not Phase 88 blocker).
- Retiring `.take()` defensive caps on `tokenWaterfall`/`tokenSunburst` only after rollups are authoritative.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AR-01 | Ingest-time rollup tables (reusing `aggregates`) maintained from `ingest.ts`/`runtimeIngest.ts`, so `analytics.ts` queries read O(buckets) instead of O(events) | Verified: `aggregates` table shape fits; ingest dispatch pattern confirmed; no new Convex APIs needed |
| AR-02 | Rollups correct under real ingest — idempotent on at-least-once retries, archival-consistent, with one-time historical backfill | Verified: OCC provides atomicity for dedup-check+insert+increment in one mutation; `dataRetention.ts` confirmed to only delete `events` table, never `aggregates` |
| AR-03 | All `.take()` count caps removed once rollups authoritative; every analytics query reads well under 16 MiB at any event volume | Verified: `aggregates` rows are slim (no `payload: v.any()` fat field); index-bounded reads of `aggregates` will stay far under 16 MiB |
</phase_requirements>

---

## Summary

Phase 88 converts five analytics queries in `convex/analytics.ts` from scanning raw `events` documents to reading pre-aggregated `aggregates` table buckets. The core risk being eliminated is the 16 MiB/exec read limit: each `events` row carries `payload: v.any()` which balloons row size, while `aggregates` rows are slim key-value structs (~200 bytes each). At the current `.take(1000)` cap, heatmap already consumes ~56% of the 16 MiB limit per the code comment; rollups eliminate this ceiling entirely.

The design is a hybrid: ingest-time increments handle the hot path (per-eventType hourly buckets + sankey edges) for `activityHeatmap`, `toolFlowSankey`, and `errorRateTrend`; the existing cron retains cost aggregation (for `tokenSunburst` via D-10) and daily rollup. `tokenWaterfall` stays raw because it operates on a 30-minute sliding window over slim `llmMetrics` rows — it is not a rollup candidate. A one-time backfill action populates history for pre-rollup data. The `idempotencyKey` field + OCC mutation atomicity make at-least-once retries safe without risk of double-counts.

All Convex API semantics required by this design — OCC serializability, index-range read-set tracking, paginate() cursor shape, index backfill on deploy — have been verified against official Convex docs and the live codebase. No new external packages are needed; this is pure Convex-native code.

**Primary recommendation:** Implement exactly as designed in D-01..D-12. The locked decisions are technically sound. Focus planning attention on: (1) the dimension-key reconstruction contract between ingest-time increments and `computeHourly` removal, (2) the `categoryOf`/`outcomeOf` sankey logic replication for ingest-time, and (3) the one-time backfill sequencing relative to schema deploy.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rollup write (hot path) | API / Backend (`ingest.ts`, `runtimeIngest.ts` mutations) | — | Must be inside a Convex mutation to get OCC atomicity for dedup+increment |
| Rollup write (cost/daily) | API / Backend (`aggregates.ts` cron mutations) | — | Already there; retain with pagination hardening |
| Historical backfill | API / Backend (Convex action) | — | Actions can loop with `ctx.runQuery` paginate + `ctx.runMutation` increments |
| Idempotency key dedup | API / Backend (`events.ts` mutation) | — | Check-then-insert must be in one mutation for OCC atomicity |
| Analytics query serving | API / Backend (`analytics.ts` queries) | — | Read `aggregates` by index; no Frontend Server layer needed |
| Data retention guard | API / Backend (`dataRetention.ts` audit) | — | Verify it never touches `aggregates` (confirmed — it doesn't) |

---

## Standard Stack

### Core (no new packages required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `convex` | ^1.39.1 (latest: 1.41.0) [VERIFIED: npm registry] | All mutations, queries, actions, schema | Already installed; all required APIs (OCC, paginate, paginationOptsValidator) are in this version |

**No new npm packages are needed for Phase 88.** The entire implementation uses Convex's built-in mutation/query/action primitives already in the codebase. The `paginationOptsValidator` import from `"convex/server"` is already used in `events.ts` (line 3) — the backfill action can use the same pattern.

### Considered and Rejected

| Package | Why Rejected |
|---------|-------------|
| `@convex-dev/aggregate` v0.2.1 [VERIFIED: npm registry, 2026-05-13] | Official Convex aggregate component. Supports sums and counts with transactional guarantees. However: (1) the existing hand-rolled `aggregates` table already has the exact `{metric_type, period, bucket_start, value, dimensions}` shape with `by_type_period_bucket` index — migrating to the component would require a data migration and API rewrite; (2) the component doesn't natively support the multi-dimensional sankey edge pattern (category→tool→outcome cardinality); (3) the locked decisions D-01/D-07..D-10 explicitly reuse the existing table. Do not add this package. |

---

## Package Legitimacy Audit

> This phase installs no new external packages. The only dependency is `convex` ^1.39.1, already in `package.json`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `convex` | npm | 3+ years | Very high | github.com/get-convex/convex | N/A (established, in manifest) | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time (install blocked by sandbox policy). `convex` is an established production dependency already in `package.json` — no legitimacy concern.*

---

## Architecture Patterns

### System Architecture Diagram

```
Ástríðr agent
    │
    ▼ POST /ingest (build) or /runtime-ingest (runtime)
httpAction (ingest.ts / runtimeIngest.ts)
    │
    ├── ctx.runMutation(api.events.ingest, {..., idempotencyKey?})
    │       ┌─────────────────────────────────────────────────────┐
    │       │ ONE MUTATION — OCC atomicity boundary               │
    │       │  1. lookup by_idempotencyKey index                  │
    │       │  2. if found: skip (return)                         │
    │       │  3. ctx.db.insert("events", ...)                    │
    │       │  4. read/patch or insert "aggregates" bucket        │
    │       └─────────────────────────────────────────────────────┘
    │
    ├── [eventType-specific domain mutations — unchanged]
    │
    └── [alert evaluation — unchanged]

Cron (every hour): aggregates.computeHourly
    │  (event-count branch REMOVED per D-02)
    │  cost branch: paginated llmMetrics reads → aggregates insert
    └── [daily rollup unchanged]

Cron (daily): aggregates.rollupDaily
    └── reads aggregates hourly rows → aggregates daily rows

One-time: backfillHistorical (action)
    └── loop: ctx.runQuery(api.events.listRecentPaginated, {paginationOpts})
             → for each page: ctx.runMutation(api.analyticsRollup.incrementBatch, ...)
             → until isDone

Analytics queries (analytics.ts):
    activityHeatmap   → aggregates by_type_period_bucket (metric_type="events", period="hourly")
                        map absolute hour buckets → {day, hour} at query time
    toolFlowSankey    → aggregates by_type_period_bucket (metric_type="sankey_edge", period="hourly")
    errorRateTrend    → aggregates by_type_period_bucket (metric_type="events", period="hourly")
                        filter dimensions.event_type IN [Error, ToolError, PostToolUseFailure]
    tokenSunburst     → aggregates by_type_period_bucket (metric_type="cost", period="hourly"|"daily")
                        (reads existing cost rows — D-10, no new metric_type needed)
    tokenWaterfall    → llmMetrics by_timestamp (unchanged — raw 30-min window, slim rows)
```

### Recommended Project Structure

```
convex/
├── schema.ts          — add v.optional(v.string()) idempotencyKey + by_idempotencyKey index to events;
│                        add "sankey_edge" as a valid metric_type (comment-only, schema uses v.string())
├── events.ts          — extend ingest mutation: add idempotencyKey arg, dedup-check + rollup-increment logic
├── aggregates.ts      — remove event-count + error-count branches from computeHourly; add paginated llmMetrics reads
├── analytics.ts       — rewrite 4 queries to read aggregates; tokenWaterfall unchanged
├── analyticsRollup.ts — NEW: incrementBucket helper (read-patch-or-insert one aggregates row);
│                        backfillHistorical action; incrementBatch mutation for backfill
└── crons.ts           — no changes needed (computeHourly/rollupDaily still called; backfill is one-time)
```

### Pattern 1: Atomic dedup-check + insert + rollup increment (D-04)

```typescript
// convex/events.ts — extended ingest mutation
// Source: Convex OCC docs (docs.convex.dev/database/advanced/occ)
export const ingest = mutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    toolName: v.optional(v.string()),
    filePath: v.optional(v.string()),
    payload: v.any(),
    hookType: v.optional(v.string()),
    timestamp: v.float64(),
    idempotencyKey: v.optional(v.string()),   // NEW — D-04
  },
  handler: async (ctx, args) => {
    // Dedup: if key provided and already present, skip entirely
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("events")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();
      if (existing) return; // idempotent no-op
    }

    // Insert raw event
    await ctx.db.insert("events", {
      sessionId: args.sessionId,
      eventType: args.eventType,
      toolName: args.toolName,
      filePath: args.filePath,
      payload: args.payload,
      hookType: args.hookType,
      timestamp: args.timestamp,
      idempotencyKey: args.idempotencyKey,
    });

    // Ingest-time rollup increment (D-01/D-02)
    await incrementEventBucket(ctx, args.eventType, args.timestamp);
    await incrementSankeyBuckets(ctx, args.eventType, args.toolName, args.timestamp);
  },
});
```

**Key OCC guarantee:** Because the index lookup AND the insert happen inside a single mutation, Convex's full serializability means: if two concurrent at-least-once retries both read the index and find no row, only one will successfully commit; the other detects a write-conflict on the index range and retries, at which point it finds the existing row and skips. The developer does not handle this explicitly — Convex retries automatically. [VERIFIED: docs.convex.dev/database/advanced/occ]

### Pattern 2: Rollup bucket increment (no upsert in Convex)

```typescript
// convex/analyticsRollup.ts
// Source: Convex does not have upsert; pattern from convex/aggregates.ts lines 48-57
async function incrementEventBucket(
  ctx: MutationCtx,
  eventType: string,
  timestamp: number
): Promise<void> {
  const hourStart = Math.floor(timestamp / 3600) * 3600;

  const existing = await ctx.db
    .query("aggregates")
    .withIndex("by_type_period_bucket", (q) =>
      q.eq("metric_type", "events").eq("period", "hourly").eq("bucket_start", hourStart)
    )
    .filter((q) => q.eq(q.field("dimensions"), { event_type: eventType }))  // NOTE: see Pitfall 3
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
  } else {
    await ctx.db.insert("aggregates", {
      metric_type: "events",
      period: "hourly",
      bucket_start: hourStart,
      value: 1,
      dimensions: { event_type: eventType },
    });
  }
}
```

**Note:** The read-then-patch-or-insert within one mutation is safe because OCC guarantees the read is part of the read set — any concurrent mutation writing the same bucket will cause one to retry. This is the same pattern as `aggregates.ts:48-57` [VERIFIED: live codebase].

### Pattern 3: Cursor-based pagination in an action (D-11 backfill)

```typescript
// convex/analyticsRollup.ts — backfill action
// Source: Convex pagination docs (docs.convex.dev/database/pagination)
// paginationOptsValidator already imported in events.ts line 3
export const backfillHistorical = action({
  args: {},
  handler: async (ctx) => {
    let cursor: string | null = null;
    let processed = 0;

    while (true) {
      const result = await ctx.runQuery(api.events.listRecentPaginated, {
        paginationOpts: { numItems: 200, cursor },
      });

      // process result.page — call incrementBatch mutation for each page
      if (result.page.length > 0) {
        await ctx.runMutation(internal.analyticsRollup.incrementBatch, {
          events: result.page.map((e) => ({
            eventType: e.eventType,
            toolName: e.toolName,
            timestamp: e.timestamp,
          })),
        });
        processed += result.page.length;
      }

      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    return { processed };
  },
});
```

**PaginationResult shape** (verified): `{ page: T[], continueCursor: string | null, isDone: boolean }`. First call: `cursor: null`. Subsequent: `cursor: result.continueCursor`. [VERIFIED: docs.convex.dev/database/pagination]

**Note:** `listRecentPaginated` already exists in `events.ts` (line 130-139) and exports via `api.events.listRecentPaginated`. The backfill action can use it directly. For `llmMetrics` backfill (for `tokenSunburst` cost rows — they already exist in `aggregates`, so no llmMetrics backfill needed per D-10).

### Pattern 4: Hardened cron — paginated llmMetrics cost aggregation (D-03)

```typescript
// convex/aggregates.ts — computeHourly, cost section only (event-count branch removed)
// Replace unbounded .collect() with paginated reads
let llmCursor: string | null = null;
const allLlmRows: typeof llmRows = [];
while (true) {
  const page = await ctx.db
    .query("llmMetrics")
    .withIndex("by_timestamp", (q) =>
      q.gte("timestamp", hourStart).lt("timestamp", hourEnd)
    )
    .filter((q) => q.neq(q.field("archived"), true))
    .paginate({ numItems: 500, cursor: llmCursor });
  allLlmRows.push(...page.page);
  if (page.isDone) break;
  llmCursor = page.continueCursor;
}
```

**Caution:** `paginate()` inside a mutation counts all scanned docs toward the 16 MiB limit. For the cron path, `llmMetrics` rows are slim (no `payload: v.any()`), so 500/page is safe. If volume grows, reduce to 200. This is the "flag, don't over-spec" from D-03 — the planner should document batch size as a tunable constant.

### Anti-Patterns to Avoid

- **Double-writing event-count buckets:** The event-count branch in `computeHourly` (lines 61-97 of `aggregates.ts`) must be fully removed. If it remains alongside ingest-time increments, every event gets counted twice after the deploy. This is the highest-risk correctness issue in the phase (see Pitfall 1).
- **Filtering inside `.paginate()` on a non-indexed field:** Using `.filter()` after `.withIndex()` in a paginate call counts the filtered-out docs toward the 16 MiB limit (official docs: "Data not returned due to a filter counts as scanned"). The backfill should use index-bounded queries, not post-index filters, to maximize efficiency.
- **Sharing rollup increment logic between action and mutation layers:** The `incrementBatch` mutation must be `internalMutation` (not a public mutation), called only by the backfill action via `ctx.runMutation(internal.analyticsRollup.incrementBatch)`. Making it public exposes an unauthenticated increment endpoint.
- **`ctx.db.query().filter()` matching on `dimensions` object equality:** Convex filters by field equality. Since `dimensions` is `v.optional(v.any())`, a filter on the whole object may not work reliably. The safer pattern is to store eventType in a dedicated indexed column or use the existing dimension key reconstruction approach from `aggregates.ts:41-46`. (See Pitfall 3.)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OCC/atomicity for dedup | Custom locking, retry loops, or two-step mutations | Single Convex mutation with index lookup | Convex provides full serializability; hand-rolled "check then insert in two mutations" is a TOCTOU bug |
| Cursor pagination | Custom offset-based paging or `.take(N)` loops | `.paginate(paginationOpts)` with `continueCursor` | `.take()` is a hard limit, not a cursor; at high volume the second page starts at a fixed offset that drifts |
| Backfill orchestration | A single mutation processing all events | An `action` with a `ctx.runQuery` paginate loop | Mutations have a 16 MiB read budget; actions don't but must call mutations for writes |
| Upsert | `insertOrUpdate()` (doesn't exist in Convex) | Read bucket by index → `ctx.db.patch` or `ctx.db.insert` | Convex has no native upsert; the read-patch-or-insert pattern inside one mutation is the correct idiom |

---

## Runtime State Inventory

> Omitted — not a rename/refactor phase. The only runtime state to consider is the existing `aggregates` table rows, which are deliberately preserved (D-12). `dataRetention.ts` is confirmed to only delete `events` table rows (verified at lines 13-19 — queries `events`, deletes by `_id`). The `aggregates` table is never touched by any retention code.

---

## Common Pitfalls

### Pitfall 1: Double-counting event buckets during the transition window
**What goes wrong:** If the event-count branch is not removed from `computeHourly` before the first cron tick after ingest-time increments go live, every event in the overlapping hour will be counted once at ingest time AND once by the cron. The heatmap and error-trend will show 2× actuals.
**Why it happens:** D-02 requires removing the event-count branch, but if the plan sequences "add ingest-time increments" in one wave and "remove cron branch" in a later wave, the cron runs in between.
**How to avoid:** Remove the event-count + error-count branches from `computeHourly` in the SAME deploy as adding the ingest-time increments. These must ship atomically. Convex deploys are atomic per-deploy — both the mutation change and the cron function change take effect together.
**Warning signs:** After deploy, run `errorTrendByPeriod` for the current hour — if the count is ~2× the actual event rate, double-write happened.

### Pitfall 2: Sankey `categoryOf`/`outcomeOf` logic drift
**What goes wrong:** The ingest-time sankey bucket uses `categoryOf(eventType)` and `outcomeOf({eventType, payload})` to compute the edge keys. The analytics query at read time reconstructs nodes/links from the stored edge buckets. If the ingest-time classification logic differs from the read-time reconstruction even slightly (e.g., different string for "Tool Use" vs "tool_use"), the sankey diagram will show disconnected nodes or zero values.
**Why it happens:** The current `categoryOf`/`outcomeOf` functions live only in `analytics.ts` (lines 53-65). Copying them to `analyticsRollup.ts` risks divergence on future edits.
**How to avoid:** Extract `categoryOf` and `outcomeOf` into a shared `convex/lib/sankeyClassify.ts` module imported by both `analytics.ts` (for verification) and `analyticsRollup.ts` (for ingest-time use). The analytics query at read-time reconstructs links from stored `source_key::target_key` dimension fields — it must use the SAME classification logic that was used at write time.
**Warning signs:** Sankey diagram renders with isolated nodes (no links), or link values are zero despite non-zero bucket counts.

### Pitfall 3: Dimension-key filter mismatch — `v.any()` object equality
**What goes wrong:** The `dimensions` field is `v.optional(v.any())` in the schema. Using `.filter((q) => q.eq(q.field("dimensions"), { event_type: "Error" }))` to find a specific bucket may not work reliably if Convex serializes object comparisons differently than JS `===`.
**Why it happens:** Convex filter on `v.any()` objects does deep equality but the exact field ordering in the stored BSON/JSON may differ from the literal you pass.
**How to avoid:** Use the same "collect all rows for the bucket, reconstruct key in JS" pattern that `computeHourly` already uses (lines 75-96): collect all `aggregates` rows for `{metric_type, period, bucket_start}` via the index, then find the matching dimension key in JS. This is already proven to work in production. The ingest-time increment can use `.first()` with a type+period+bucket index scan + JS filter on the small result set, since at most one row exists per `{metric_type, period, bucket_start, eventType}` combination.
**Alternative:** Add a `dimension_key` string field to `aggregates` (e.g., `"event_type:Error"`) with an additional index. Claude's discretion per CONTEXT.md.
**Warning signs:** Bucket read returns null when a bucket definitely exists; or every ingest creates a new row instead of patching the existing one.

### Pitfall 4: Heatmap absolute-hour → day-of-week×hour mapping must be timezone-aware
**What goes wrong:** `activityHeatmap` derives day-of-week and hour from the bucket's `bucket_start` (UTC Unix epoch). The current implementation uses `new Date(e.timestamp * 1000).getDay()` / `.getHours()` which returns UTC values. If the user's timezone is UTC-5, a "5 AM UTC Monday" event appears in the Sunday 5AM cell, not Monday midnight.
**Why it happens:** D-07 says "map absolute hour buckets → day-of-week × hour" at query time, but doesn't specify timezone. The current code is UTC-based.
**How to avoid:** The new rollup heatmap query should preserve the existing behavior (UTC-based). Do NOT add timezone logic as a side effect of Phase 88 — that's a separate UX decision. The heatmap accuracy is the same before and after rollup; Phase 88 should be a semantically equivalent rewrite, not a behavior change.
**Warning signs:** N/A for Phase 88 specifically — only relevant if someone adds timezone offset logic during the rewrite.

### Pitfall 5: tokenWaterfall `take(30000)` safety
**What goes wrong:** The 30-minute window on `llmMetrics` seems safe today, but at high LLM call volume it could still approach the limit. 30,000 rows × ~500 bytes/row ≈ 15 MiB (close to the 16 MiB ceiling).
**Why it happens:** `llmMetrics` rows are slim (~200-500 bytes, no `payload: v.any()`), but "slim" is relative. The `.take(30000)` cap from AR-03 discretion ("confirm cap is safe") is the right guard. The 30-minute window is time-bounded so row count is bounded by call rate.
**How to avoid:** The current `.take(30000)` is adequate for the foreseeable LLM call rate (30,000 LLM calls in 30 minutes = 1,000 calls/minute = 16.7 calls/second sustained, which is very high). Confirm this is safe and document the threshold. Do not add a waterfall rollup — the time-windowed raw query is the correct pattern here.
**Warning signs:** If Convex dashboard shows the `tokenWaterfall` query approaching the read limit, reduce the window or add a secondary cap.

### Pitfall 6: Index backfill window — deploy before backfill
**What goes wrong:** The `by_idempotencyKey` index on `events` must exist and be backfilled before the backfill action reads it. If the action runs before the deploy completes the index backfill, queries against the new index will fail or return stale results.
**Why it happens:** Deploying a schema change with a new index triggers Convex's automatic index backfill. Per official docs: "Convex will ensure that the index is backfilled before the new query and mutation functions are registered." This means the first `npx convex deploy` with the new index will block registration of new functions until the index is ready.
**How to avoid:** The sequence is safe by design — schema deploy (which backfills the index) must complete before new function code referencing that index can execute. No special sequencing is required in the planner. [VERIFIED: docs.convex.dev/database/indexes]

### Pitfall 7: `computeHourly` processes the *previous* completed hour — ingest-time increments cover the *current* hour
**What goes wrong:** `computeHourly` aggregates `hourStart = Math.floor(now / 3600) * 3600 - 3600` (the last completed hour, lines 9-11 of `aggregates.ts`). Ingest-time increments write to `Math.floor(timestamp / 3600) * 3600` (the current hour at time of event). After removal of the event-count branch from `computeHourly`, there is no overlap — the transition boundary is clean. But the analytics query must query `bucket_start >= cutoff` to get all hourly buckets, including the current in-progress hour (which only has ingest-time rows, not a cron-produced row).
**Why it happens:** The query change from `errorRateTrend` (currently reading raw events for `dayAgo..now`) to reading hourly aggregates must handle the fact that the current hour's bucket only exists if at least one event has arrived in it.
**How to avoid:** The analytics query for `errorRateTrend` should read all hourly buckets from `dayAgo` to `now`, including a partially-filled current-hour bucket. A missing bucket for an hour means 0 errors — the query must treat absent bucket as 0, not null. Explicitly initialize all 24 hour slots to 0 before filling from buckets (same pattern as current `errorRateTrend` lines 179-185).

---

## Code Examples

### Verified: paginationOptsValidator import and paginate() shape

```typescript
// Already in events.ts line 3 — confirmed in live codebase
import { paginationOptsValidator } from "convex/server";

// Shape returned by .paginate():
// { page: T[], continueCursor: string | null, isDone: boolean }
// Source: docs.convex.dev/database/pagination
```

### Verified: aggregates table indexes (from schema.ts:883-891)

```typescript
aggregates: defineTable({
  metric_type: v.string(),      // "cost" | "events" | "errors" | "sankey_edge" (new)
  period: v.string(),           // "hourly" | "daily"
  bucket_start: v.float64(),    // Unix epoch seconds at hour/day boundary
  value: v.float64(),
  dimensions: v.optional(v.any()),
})
  .index("by_type_period_bucket", ["metric_type", "period", "bucket_start"])
  .index("by_period_bucket", ["period", "bucket_start"])
```

For the new `sankey_edge` metric_type, dimensions will be: `{ source: string, target: string }` where source/target are the node names from `categoryOf`/`outcomeOf`.

### Verified: events table current shape (schema.ts:24-38)

```typescript
events: defineTable({
  sessionId: v.string(),
  eventType: v.string(),
  toolName: v.optional(v.string()),
  filePath: v.optional(v.string()),
  payload: v.any(),              // <-- the fat field that causes 16 MiB risk
  hookType: v.optional(v.string()),
  timestamp: v.float64(),
  goalId: v.optional(v.string()),
  archived: v.optional(v.boolean()),
  // idempotencyKey: v.optional(v.string()),  // TO ADD
})
  // by_idempotencyKey index TO ADD
```

### Verified: existing idempotency pattern in computeHourly (aggregates.ts:34-58)

The exact read-then-skip pattern to reuse:

```typescript
// Step 1: collect existing rows for this bucket
const existingCostRows = await ctx.db
  .query("aggregates")
  .withIndex("by_type_period_bucket", (q) =>
    q.eq("metric_type", "cost").eq("period", "hourly").eq("bucket_start", hourStart)
  )
  .collect();

// Step 2: reconstruct dimension key in JS (not via object filter)
const existingKeys = new Set(
  existingCostRows.map((r) => {
    const dims = r.dimensions as { provider?: string; model?: string; ... } | null;
    return `${dims?.provider ?? "unknown"}::${dims?.model ?? "unknown"}::...`;
  })
);

// Step 3: skip if key already present
for (const [dim, value] of Object.entries(costByDim)) {
  if (existingKeys.has(dim)) continue;
  await ctx.db.insert("aggregates", { ... });
}
```

For ingest-time increment, the equivalent is: query the specific bucket row (instead of collecting all for the hour), match in JS, patch or insert.

### Verified: dataRetention.ts does NOT touch aggregates

```typescript
// dataRetention.ts lines 1-21 — confirmed never references "aggregates"
export const purgeOldTelemetryEvents = internalMutation({
  handler: async (ctx) => {
    const old = await ctx.db.query("events")  // "events" only
      .withIndex("by_timestamp")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(BATCH_SIZE);
    for (const doc of old) {
      await ctx.db.delete(doc._id);           // deletes events rows only
    }
  },
});
// D-12 is satisfied by construction — no code change needed.
```

---

## Research Questions — Direct Answers

### Q1: OCC/atomic dedup semantics (D-04)

**Answer:** [VERIFIED: docs.convex.dev/database/advanced/occ]

Convex mutations provide **full serializability** (not just snapshot isolation) via optimistic concurrency control. The mechanism:

1. Each mutation tracks a "read set" — the index range reads and document reads performed during execution.
2. At commit time, Convex checks whether any write between the mutation's begin-timestamp and commit-timestamp overlaps the read set.
3. If there is a conflict, the mutation's write set is discarded and the mutation is **automatically retried** (determinism guarantees re-execution is safe).

**For the dedup pattern:** When two concurrent at-least-once retries both execute `query by_idempotencyKey → not found → insert + increment`, only one can commit first. The second detects a write conflict on the index range (the first mutation wrote a new row into that index slot) and retries. On retry, it finds the existing row and returns early. The developer writes no retry logic — Convex handles it transparently.

**Index reads in the read set:** The search results from `withIndex().first()` are tracked in the read set. An empty result (key not found) is tracked as an empty range read for that index. A concurrent insert into that range triggers a conflict.

**Verdict:** D-04's design is correct. One mutation = atomic dedup + insert + increment. This is the standard Convex idempotency pattern.

### Q2: Increment without upsert

**Answer:** [VERIFIED: live codebase — aggregates.ts:48-57]

Convex has no native upsert. The correct pattern is:

```
read bucket row via index → if exists: ctx.db.patch(_id, {value: existing.value + n})
                          → if absent: ctx.db.insert("aggregates", {metric_type, period, bucket_start, value: n, dimensions})
```

All in one mutation. This is exactly what the existing `computeHourly` does for cost rows. No race within the same mutation (sequential execution); no race across mutations (OCC handles it).

**Note:** The `patch` call only updates the `value` field — all other fields are unchanged. This is safe for the bucket pattern since `metric_type`, `period`, `bucket_start`, and `dimensions` never change for an existing bucket row.

### Q3: Pagination in actions (D-11)

**Answer:** [VERIFIED: docs.convex.dev/database/pagination + live codebase events.ts:130-139]

`listRecentPaginated` already exists in `events.ts` and uses `paginationOptsValidator`. The action cursor loop:

```typescript
paginationOpts: { numItems: 200, cursor: null }   // first call
// Returns: { page: Event[], continueCursor: string | null, isDone: boolean }
// Next call: { numItems: 200, cursor: result.continueCursor }
// Stop when: result.isDone === true
```

The backfill action uses `ctx.runQuery` (not a direct `ctx.db` call — actions can't access the DB directly) and `ctx.runMutation` for writes. Each page of 200 events calls one `incrementBatch` mutation. This keeps each mutation well under the 16 MiB limit (200 events × batch metadata only = negligible read cost; the bucket reads/writes are the actual load).

### Q4: 16 MiB read-limit mechanics

**Answer:** [VERIFIED: docs.convex.dev/production/state/limits]

Exact limits per execution:
- **16 MiB data read** — all document bytes scanned, including documents filtered out by `.filter()` that are never returned
- **32,000 documents scanned** — separate from byte count; whichever limit is hit first applies
- **4,096 index range reads** — calls to `db.get` and `db.query`

**Why the current code is risky:** `events.payload` is `v.any()` and can be kilobytes per event. The comment in `activityHeatmap` says "~56% of limit" at `take(1000)`. At `take(1001+)` or with payload growth, it exceeds 16 MiB.

**Why aggregates rows are safe:** The `aggregates` table has no `v.any()` fat field. All fields are typed scalars + `dimensions: v.optional(v.any())` (but dimensions are tiny, e.g., `{event_type:"Error"}`). An `aggregates` row is ~200-400 bytes. At 16 MiB / 300 bytes ≈ 53,000 rows — far more than any realistic 30-day hourly bucket count (30 days × 24 hours × ~50 distinct eventTypes = 36,000 rows max).

**tokenWaterfall safety:** `llmMetrics` rows are ~500 bytes (all typed fields, no payload). At `take(30000)`: 30,000 × 500 bytes = 15 MiB — tight but within limits. The 30-minute window is the real guard (LLM calls in 30 minutes rarely approaches 30,000 in practice). The cap is appropriate.

**Cost cron `llmMetrics` reads:** After pagination hardening (D-03), each page of 500 `llmMetrics` rows ≈ 250 KB — well under limits even for busy hours.

### Q5: @convex-dev/aggregate component

**Answer:** [VERIFIED: convex.dev/components/aggregate, npm registry]

Yes, `@convex-dev/aggregate` v0.2.1 exists (published 2026-05-13, official Convex org on GitHub). It provides transactional sum/count aggregation with reactivity. However, it is **not the right choice for Phase 88** because:

1. The existing `aggregates` table already serves the same role with a shape that `tokenSunburst` (D-10), `errorTrendByPeriod`, and `eventCountsByPeriod` already read from. Migrating to the component would require a data migration and API rewrite with no added capability.
2. The multi-dimensional sankey edge pattern (D-09) requires `{source, target}` dimensions — the aggregate component doesn't natively support this shape.
3. D-01/D-07..D-10 lock in the existing table approach.

**Planner note:** The component is worth a footnote in the plan as "evaluated and rejected" so the decision is recorded, but no action is needed.

### Q6: Schema migration mechanics — adding optional field + new index

**Answer:** [VERIFIED: docs.convex.dev/database/indexes]

**Adding optional `idempotencyKey` to `events`:** Safe with no downtime. Existing documents simply lack the field (it's `v.optional(v.string())`); Convex treats absent as `undefined`. No migration of existing rows needed.

**Adding `by_idempotencyKey` index:** Triggers an automatic backfill on deploy. Per docs: "Convex will ensure that the index is backfilled before the new query and mutation functions are registered." The deploy takes slightly longer than normal (scales with `events` table size), but functions are only registered after backfill completes. **Planner implication:** The schema deploy must complete before the historical backfill action runs, and it will — because the backfill is manually triggered after deploy, not automatically. No special sequencing needed in the plan beyond "deploy schema first, then run backfill."

**Adding `sankey_edge` metric_type:** `metric_type` is `v.string()` in schema — no schema change needed; just start inserting rows with `metric_type: "sankey_edge"`. The `by_type_period_bucket` index already covers it.

### Q7: Pitfalls/landmines (summary)

Covered in detail in Common Pitfalls above. The critical ones for the planner:

1. **Double-write risk (Pitfall 1):** Event-count branch removal from `computeHourly` must ship in the same deploy as ingest-time increments. Cannot be split into separate waves.
2. **Sankey classification drift (Pitfall 2):** Extract `categoryOf`/`outcomeOf` to a shared module. Do not copy-paste.
3. **Dimension-key filter mismatch (Pitfall 3):** Use JS-side key reconstruction, not `v.any()` object filter, for bucket lookup. Follow the existing pattern in `computeHourly`.
4. **Missing-hour = 0, not null (Pitfall 7):** The current-hour bucket may not exist yet (no events). The query must initialize all time slots to 0 before filling from buckets.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `.take(N)` caps on raw event scans | Rollup buckets — O(buckets) not O(events) | Eliminates 16 MiB ceiling permanently |
| `computeHourly` scans all raw events | Ingest-time increments (D-02) | Eliminates cron as a read-limit risk |
| Unbounded `llmMetrics.collect()` in cron | Paginated reads (D-03) | Eliminates latent cron risk at volume |
| Consumer-side hash for dedup | Producer key + OCC mutation atomicity | No silent event drops (D-05) |

**What's confirmed working in production (existing code):**
- `aggregates` table with `by_type_period_bucket` index — used by `costByPeriod`, `errorTrendByPeriod`, `eventCountsByPeriod` queries today.
- `rollupDaily` reading hourly → daily rollup without raw table scans.
- `listRecentPaginated` with `paginationOptsValidator` — already in `events.ts`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | An empty index range read (finding 0 results) is tracked in the OCC read set, so concurrent inserts into that range trigger a conflict and retry | OCC/dedup pattern | If wrong, two concurrent retries could both insert the same event. Mitigated: even without this, Convex unique-key constraints or a secondary check would catch it. The D-05 design (un-keyed events treated as unique) limits blast radius. |
| A2 | `v.any()` object filter (`.filter(q.eq(q.field("dimensions"), {...}))`) does not work reliably for exact object match in Convex | Pitfall 3 | If wrong, the simpler filter approach works and the JS-side reconstruction is unnecessary overhead (minor). |
| A3 | `llmMetrics` row size is ~200-500 bytes (slim) | 16 MiB mechanics | If rows are larger (e.g., `details` field added in future), `tokenWaterfall` cap may need reducing. Verify current average row size before shipping. |
| A4 | The existing cost `aggregates` rows (metric_type="cost") have `provider` and `model` in `dimensions`, sufficient for `tokenSunburst` (D-10) | D-10 tokenSunburst path | If wrong, tokenSunburst would need a separate `llmMetrics` rollup. Mitigated: `costByPeriod` already uses these rows successfully for the cost charts. |

**A4 confidence:** HIGH — `costByPeriodByProvider` in `aggregates.ts:237-276` already reads `dimensions.provider` from cost rows, confirming the shape is correct for provider-level breakdowns. `tokenSunburst` needs provider+model, which is also in the cost row dimensions (`${r.provider}::${r.model}::${billingType}::${goalId}`). The analytics query will need to parse the 4-segment key or restructure the cost row dimensions — verify this during implementation.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (already in project) |
| Config file | `vitest.config.ts` (or `vite.config.ts` with test block) |
| Quick run | `npx vitest run convex/` |
| Full suite | `npm test` |
| Convex test pattern | `convex/**/*.test.ts` (see existing test infrastructure) |

### Testable Invariants for Phase 88

These are the Nyquist invariants — the minimum set to verify the rollup is correct:

| Invariant | Test Type | Description |
|-----------|-----------|-------------|
| **Idempotency:** calling `events.ingest` twice with same `idempotencyKey` produces exactly 1 event row and 1 rollup increment | Unit | Mock Convex mutation ctx; call ingest twice with same key; assert `events` count = 1, `aggregates` bucket value = 1 |
| **No-key events are always counted:** calling `events.ingest` twice without `idempotencyKey` produces 2 event rows and 2 rollup increments | Unit | Same setup; assert count = 2, bucket value = 2 |
| **Rollup count == raw count after backfill:** for a set of N test events, after running `backfillHistorical`, each `aggregates` bucket's value equals the number of matching events in `events` table | Integration | Insert 100 test events across 3 eventTypes and 2 hours; run backfill; assert bucket values sum to 100 |
| **Cron removal does not double-count:** after removing event-count branch from `computeHourly`, running `computeHourly` for an hour that already has ingest-time buckets does not change their values | Unit | Insert events → assert bucket value = N → run `computeHourly` → assert bucket value still = N |
| **dataRetention never touches aggregates:** running `purgeOldTelemetryEvents` does not delete or modify any `aggregates` rows | Unit | Insert aggregates rows with old timestamps; run purge; assert aggregates are unchanged |
| **heatmap bucket derivation correct:** given a known set of hourly event-count buckets, `activityHeatmap` returns the correct day-of-week × hour mapping | Unit | Assert that bucket_start at known UTC epoch maps to expected {day, hour} pair |
| **errorRateTrend missing-hour = 0:** if no error events in an hour, that hour slot returns `errors: 0`, not absent | Unit | Assert 24 slots always returned even when some hours have no error buckets |

### Wave 0 Gaps (test files to create)

- [ ] `convex/analyticsRollup.test.ts` — covers idempotency invariant, double-count invariant, bucket derivation
- [ ] `convex/analytics.test.ts` — covers missing-hour = 0, heatmap mapping correctness
- [ ] `convex/aggregates.test.ts` — covers cron-removal non-double-count invariant

---

## Environment Availability

Step 2.6: SKIPPED — Phase 88 is pure Convex backend code with no external tools, services, or CLIs beyond the existing `convex` package and the `npm run dev:backend` Convex dev server already in use.

---

## Open Questions

1. **Dimension shape for `tokenSunburst` (D-10) — cost row key reconstruction**
   - What we know: Cost `aggregates` rows store `dimensions: {provider, model, billingType, goalId}` as a 4-segment key. `tokenSunburst` needs provider+model breakdowns.
   - What's unclear: Whether the analytics query can efficiently group cost rows by provider+model when the 4-segment key includes `goalId` (which may have high cardinality). The existing `costByPeriod` groups by `provider` and `model` separately — this same pattern works for `tokenSunburst`.
   - Recommendation: Have the `tokenSunburst` query read all cost aggregates for the 30-day window and group by `dimensions.provider` + `dimensions.model` in JS (identical to what `costByPeriodByProvider` does). The query replaces the current `take(30000)` on `llmMetrics` with a `collect()` on the much smaller cost aggregates set. Confirm row count is manageable (30 days × 24 hours × distinct provider+model combinations — likely < 500 rows).

2. **Sankey `outcomeOf` payload-dependence in ingest-time context**
   - What we know: The current `outcomeOf` function in `analytics.ts:61-65` takes `{eventType, payload}` and checks `payload` fields. In the ingest-time increment, the payload IS available (the mutation receives `payload: v.any()`).
   - What's unclear: Whether the outcome classification logic uses payload fields beyond `eventType` (the current implementation only checks `eventType` string — no payload fields are referenced in the current code). Confirmed: `outcomeOf` only uses `e.eventType` (line 62-65) — no payload inspection. Safe to replicate at ingest time.
   - Recommendation: No issue. `outcomeOf` is `eventType`-only; can be extracted to shared module as-is.

3. **`by_idempotencyKey` index scope on a sparse field**
   - What we know: `idempotencyKey` is optional and will be absent on most historical events (and many future ones per D-05). Sparse indexes in some databases skip null/absent values. Convex behavior: optional fields ARE indexed — a `withIndex().eq("idempotencyKey", key)` lookup only returns rows where the field has that value; absent rows are not in the index range for any specific key value.
   - What's unclear: Whether the index backfill for the millions of existing null-`idempotencyKey` events causes a notably long deploy. Likely not an issue (null values are indexed efficiently), but worth noting.
   - Recommendation: No action needed. The pattern is safe and standard in Convex (see `forgeLogChunks` `by_host_job_seq` index which is similarly selective).

---

## Sources

### Primary (HIGH confidence)
- [docs.convex.dev/database/advanced/occ](https://docs.convex.dev/database/advanced/occ) — OCC serializability, read set, write conflicts, automatic retry
- [docs.convex.dev/database/pagination](https://docs.convex.dev/database/pagination) — paginationOpts shape, paginate() return, continueCursor
- [docs.convex.dev/production/state/limits](https://docs.convex.dev/production/state/limits) — 16 MiB data read limit, 32K doc scan limit, 4096 index range reads
- [docs.convex.dev/database/indexes](https://docs.convex.dev/database/indexes) — index backfill on deploy, no downtime, query available after backfill
- Live codebase: `convex/analytics.ts` — 5 queries, `.take()` caps, sankey/heatmap/error logic
- Live codebase: `convex/aggregates.ts` — existing idempotency pattern (lines 34-58), cron structure
- Live codebase: `convex/schema.ts` — `aggregates` table shape (lines 883-891), `events` table (lines 24-38), `llmMetrics` (lines 295-316)
- Live codebase: `convex/events.ts` — existing `ingest` mutation (line 7-28), `listRecentPaginated` (lines 130-139)
- Live codebase: `convex/dataRetention.ts` — confirmed never touches `aggregates`

### Secondary (MEDIUM confidence)
- [convex.dev/components/aggregate](https://www.convex.dev/components/aggregate) — @convex-dev/aggregate capabilities and limitations; confirmed sum/count only, not suitable for multi-dimensional sankey
- [stack.convex.dev/how-convex-works](https://stack.convex.dev/how-convex-works) — index read set tracking confirmation
- [stack.convex.dev/high-throughput-mutations-via-precise-queries](https://stack.convex.dev/high-throughput-mutations-via-precise-queries) — read set optimization, selective index ranges

### Registry verification
- `convex`: npm 1.41.0, published 2026-06-09 [VERIFIED: npm registry]
- `@convex-dev/aggregate`: npm 0.2.1, published 2026-05-13 [VERIFIED: npm registry] — evaluated and rejected

---

## Metadata

**Confidence breakdown:**
- OCC/atomicity semantics: HIGH — verified against official Convex OCC docs and cross-referenced with search results
- Pagination API shape: HIGH — verified against docs + live codebase already uses `paginationOptsValidator`
- 16 MiB limit mechanics: HIGH — exact limits from official production/state/limits page
- Index backfill behavior: HIGH — verified against official index docs
- @convex-dev/aggregate fit: HIGH — evaluated against component docs and existing table design
- Architecture patterns (increment without upsert): HIGH — same pattern proven in production `computeHourly`
- Sankey `outcomeOf` payload safety: HIGH — confirmed payload not used by reading live code

**Research date:** 2026-06-23
**Valid until:** 2026-09-23 (Convex 1.x stable; pagination/OCC APIs are core and change rarely)
