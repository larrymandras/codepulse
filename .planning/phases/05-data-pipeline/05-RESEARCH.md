# Phase 5: Data Pipeline - Research

**Researched:** 2026-04-14
**Domain:** Convex database — aggregation crons, cursor pagination, soft-delete archival
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Aggregation strategy**
- D-01: Aggregate the core three metrics: LLM cost, event counts, and error rates
- D-02: Single unified `aggregates` table — columns: metric_type (cost/events/errors), period (hourly/daily), bucket_start, value, dimensions (provider, model, event_type as JSON)
- D-03: Hourly cron scans raw tables for the last hour, writes hourly aggregate rows. Daily cron rolls up 24 hourly rows into daily summary rows. Uses existing Convex cron interval pattern in `convex/crons.ts`
- D-04: Aggregate dimensions — cost by provider+model, event counts by event_type, error rates by error category

**Retention & archival**
- D-05: Soft delete with `archived: true` flag on event rows. Active queries filter on `archived !== true`. Data stays in Convex
- D-06: Retention covers high-volume tables only: events, runtime_events, llmMetrics, toolExecutions
- D-07: Retention threshold from Settings page, stored in a Convex config table, read by cron on each run. Default 30 days

**Pagination**
- D-08: Cursor-based infinite scroll with "Load more" trigger. No page numbers
- D-09: All list views get paginated: events, sessions, agents, executions, alerts, LLM calls, security events
- D-10: Default page size of 25 items

**Migration path**
- D-11: Incremental swap — add tables and crons first, then update Analytics page queries one at a time
- D-12: No backfill. Aggregates start fresh. Older periods fall back to raw table queries

### Claude's Discretion
- Exact schema for the unified aggregates table (field names, index design)
- Archival cron scheduling (daily at off-peak vs. hourly)
- Convex cursor implementation details (which indexes to add)
- Order of Analytics page query swaps
- Whether to create a shared `usePaginatedQuery` hook or use Convex's built-in pagination helpers

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DP-01 | Convex cron jobs compute hourly and daily aggregates for LLM cost, event counts, and error rates | Cron API verified: `crons.interval()` for hourly, `crons.daily()` for daily rollup; internal mutations query raw tables within time window |
| DP-02 | Historical dashboard views (Analytics page) query pre-computed aggregates instead of raw event tables | Aggregates table schema + query swap pattern documented; primary targets: `costByProvider`, `activityHeatmap`, `toolFlowSankey`, `tokenSunburst`, `errorRateTrend` |
| DP-03 | Data retention policy auto-archives events older than configurable threshold (default 30 days) | Soft-delete pattern with `archived` flag + archival cron; configKey stored in `agentConfigs` table (already in schema) |
| DP-04 | Dashboard list queries use server-side pagination with index-based cursors | Convex `paginationOptsValidator` + `.paginate()` + `usePaginatedQuery` verified; all existing indexes already support cursor pagination |
</phase_requirements>

---

## Summary

Phase 5 optimizes the CodePulse data layer beneath existing pages. It consists of four separable workstreams: (1) a new `aggregates` table + two cron jobs for hourly and daily rollups, (2) a query migration that swaps five Analytics page queries from raw-table full scans to aggregate lookups, (3) a soft-delete archival cron that marks stale rows in four high-volume tables, and (4) a systematic pagination upgrade across all list-view queries and their React hooks.

All four workstreams use patterns already established in the Convex codebase. The cron infrastructure exists in `convex/crons.ts` (one `interval` cron already registered). Convex's built-in `paginationOptsValidator` / `.paginate()` / `usePaginatedQuery` handle cursor pagination without custom code. The `agentConfigs` key-value table (already in schema) is the natural home for the retention threshold config. The only net-new schema element is the `aggregates` table.

**Primary recommendation:** Implement in four sequential waves — schema + crons, archival cron, Analytics query swaps, pagination upgrades — each independently deployable and testable.

---

## Project Constraints (from CLAUDE.md)

- Backend: Convex only — all data access through mutations/queries, no direct DB
- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS 4 (dark theme)
- Test runner: Vitest + jsdom. Tests live alongside source (`src/**/*.test.tsx`, `convex/**/*.test.ts`)
- No component library — hand-rolled Tailwind components only
- `SectionErrorBoundary` wraps all widget groups
- Hooks pattern: thin wrappers around `useQuery` / `useMutation` in `src/hooks/`
- Single operator dashboard — no multi-tenant concerns
- Never commit `.env`, credentials, or secrets

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | 1.17.0 (pinned) / 1.35.1 (latest) | Database, queries, crons | Already in use; all Convex primitives available |
| convex/server | (same) | `paginationOptsValidator`, `cronJobs` | Official Convex server package |
| convex/react | (same) | `usePaginatedQuery` | Official React hooks |

[VERIFIED: npm registry — `npm view convex version` → 1.35.1; project pinned to ^1.17.0]

### No New Dependencies Required

All capabilities needed for this phase — cron scheduling, cursor pagination, soft-delete filtering — are built into the existing Convex SDK. No npm installs needed.

---

## Architecture Patterns

### Recommended File Changes

```
convex/
├── schema.ts           # Add aggregates table, add archived field to 4 tables
├── crons.ts            # Register 2-3 new cron jobs
├── aggregates.ts       # NEW: aggregate write mutations + read queries
├── archival.ts         # NEW: archival internal mutation
├── events.ts           # Upgrade listRecent → paginated version
├── llm.ts              # Upgrade recentCalls → paginated version
├── sessions.ts         # Add paginated list query
├── agents.ts           # Add paginated list query
└── [other domains]     # Add paginated list queries for alerts, executions, etc.

src/hooks/
├── useRecentEvents.ts  # Upgrade to usePaginatedQuery
├── useLlmMetrics.ts    # Upgrade to usePaginatedQuery
├── useSessions.ts      # Upgrade to usePaginatedQuery
└── [etc.]              # Other list hooks upgraded similarly
```

---

### Pattern 1: Aggregates Table Schema

**What:** Single unified table for all pre-computed metrics.

**Claude's recommendation for schema:**

```typescript
// convex/schema.ts addition
// Source: verified against Convex schema API + D-02 decision
aggregates: defineTable({
  metric_type: v.string(),      // "cost" | "events" | "errors"
  period: v.string(),           // "hourly" | "daily"
  bucket_start: v.float64(),    // Unix epoch seconds, truncated to hour/day
  value: v.float64(),           // numeric aggregate value
  dimensions: v.optional(v.any()), // { provider?, model?, event_type?, error_category? }
})
  .index("by_type_period_bucket", ["metric_type", "period", "bucket_start"])
  .index("by_period_bucket", ["period", "bucket_start"])
```

[VERIFIED: Convex schema API — `defineTable`, `v.string()`, `v.float64()`, `v.any()` — confirmed from codebase usage]

**Why this index design:** The primary read pattern is "give me all hourly cost rows ordered by bucket_start desc for the Analytics chart." The `by_type_period_bucket` index serves that query without a full table scan.

---

### Pattern 2: Cron Job Registration

**What:** Add aggregation and archival crons alongside the existing stale-alert cron.

```typescript
// convex/crons.ts
// Source: [CITED: docs.convex.dev/scheduling/cron-jobs]
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "auto-acknowledge stale alerts",
  { hours: 1 },
  internal.alerts.autoAcknowledgeStaleInternal
);

// New: hourly aggregation
crons.interval(
  "aggregate-hourly",
  { hours: 1 },
  internal.aggregates.computeHourly
);

// New: daily rollup (runs at 01:00 UTC)
crons.daily(
  "aggregate-daily",
  { hourUTC: 1, minuteUTC: 0 },
  internal.aggregates.rollupDaily
);

// New: archival (runs at 02:00 UTC, off-peak)
crons.daily(
  "archive-stale-events",
  { hourUTC: 2, minuteUTC: 0 },
  internal.archival.markStaleArchived
);

export default crons;
```

[CITED: docs.convex.dev/scheduling/cron-jobs — `crons.interval()`, `crons.daily()`, `internal.*` references confirmed]

**Key constraint:** At most one run of each cron can execute concurrently. If the previous run hasn't finished, the next scheduled run is skipped. This means aggregation mutations must complete within their period window — acceptable given Convex's mutation time limits (~4s budget, row budget configurable).

---

### Pattern 3: Hourly Aggregation Internal Mutation

**What:** Scans raw tables for the last completed hour, writes aggregate rows.

```typescript
// convex/aggregates.ts (new file)
// Source: [VERIFIED: from existing llm.ts rollupCosts pattern + Convex docs]
import { internalMutation } from "./_generated/server";

export const computeHourly = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const hourStart = Math.floor(now / 3600) * 3600 - 3600; // last completed hour
    const hourEnd = hourStart + 3600;

    // Query only non-archived rows in the hour window using by_timestamp index
    const llmRows = await ctx.db
      .query("llmMetrics")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", hourStart).lt("timestamp", hourEnd)
      )
      .filter((q) => q.neq(q.field("archived"), true))
      .collect();

    // Aggregate: cost by provider+model
    const costByDim: Record<string, number> = {};
    for (const r of llmRows) {
      const key = `${r.provider}::${r.model}`;
      costByDim[key] = (costByDim[key] ?? 0) + (r.cost ?? 0);
    }
    for (const [dim, value] of Object.entries(costByDim)) {
      const [provider, model] = dim.split("::");
      await ctx.db.insert("aggregates", {
        metric_type: "cost",
        period: "hourly",
        bucket_start: hourStart,
        value,
        dimensions: { provider, model },
      });
    }

    // Similar blocks for events (count by event_type) and errors (count by category)
    // ...
  },
});
```

[VERIFIED: Index range query pattern from Convex docs — `.withIndex("by_timestamp", q => q.gte(...).lt(...))` confirmed as correct Convex range query syntax]

---

### Pattern 4: Daily Rollup

**What:** Sums 24 hourly aggregate rows into one daily row. Does NOT re-scan raw tables.

```typescript
// convex/aggregates.ts
export const rollupDaily = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now() / 1000;
    const dayStart = Math.floor(now / 86400) * 86400 - 86400; // yesterday UTC midnight

    // Pull yesterday's hourly rows from aggregates table (not raw tables)
    const hourlyRows = await ctx.db
      .query("aggregates")
      .withIndex("by_period_bucket", (q) =>
        q.eq("period", "hourly")
          .gte("bucket_start", dayStart)
          .lt("bucket_start", dayStart + 86400)
      )
      .collect();

    // Sum by metric_type + dimensions key, write daily row
    // ...
  },
});
```

**Why:** Rolling up hourly rows rather than re-scanning raw tables keeps daily cron fast and independent of raw table size — important as data grows.

---

### Pattern 5: Soft-Delete Archival

**What:** Mark rows older than threshold as `archived: true`. Active queries filter them out.

**Schema change required — add `archived` optional field to 4 tables:**
```typescript
// convex/schema.ts — add to each high-volume table definition
archived: v.optional(v.boolean()),
```

Tables: `events`, `runtime_events`, `llmMetrics`, `toolExecutions`

**Note:** Adding an optional field to an existing Convex table requires no migration — existing rows simply have `undefined` for the new field, and `neq(archived, true)` correctly handles that (undefined !== true). [CITED: docs.convex.dev/database/indexes — filter behavior with optional fields confirmed]

**Archival mutation:**
```typescript
// convex/archival.ts (new file)
export const markStaleArchived = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Read threshold from agentConfigs table
    const config = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();
    const retentionDays = (config?.value as number) ?? 30;
    const cutoff = Date.now() / 1000 - retentionDays * 86400;

    // For each high-volume table: find rows older than cutoff that aren't archived yet
    for (const table of ["events", "runtime_events", "llmMetrics", "toolExecutions"] as const) {
      const stale = await ctx.db
        .query(table)
        .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoff))
        .filter((q) => q.neq(q.field("archived"), true))
        .take(500); // batch limit to avoid mutation time budget
      for (const row of stale) {
        await ctx.db.patch(row._id, { archived: true });
      }
    }
  },
});
```

**Batch limit rationale:** Convex mutations have a ~4-second CPU budget and a database bandwidth limit. Processing 500 rows per table per daily run is safe. If tables grow large, the cron catches up incrementally across daily runs. [ASSUMED — Convex mutation budget specifics not verified in this session; 500 is conservative]

---

### Pattern 6: Cursor-Based Pagination — Backend

**What:** Replace `.take(limit)` queries with `.paginate(paginationOpts)`.

```typescript
// convex/events.ts — upgraded listRecent
// Source: [CITED: docs.convex.dev/database/pagination]
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

export const listRecentPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .withIndex("by_timestamp")
      .order("desc")
      .filter((q) => q.neq(q.field("archived"), true))
      .paginate(args.paginationOpts);
  },
});
```

Returns: `{ page: Doc<"events">[], continueCursor: string, isDone: boolean }` [CITED: docs.convex.dev/database/pagination]

---

### Pattern 7: Cursor-Based Pagination — Frontend Hook

**What:** Replace `useQuery` hooks with `usePaginatedQuery`. Returns `loadMore()` for infinite scroll.

```typescript
// src/hooks/useRecentEvents.ts — upgraded
// Source: [CITED: docs.convex.dev/database/pagination]
import { usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useRecentEvents(initialNumItems = 25) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.events.listRecentPaginated,
    {},
    { initialNumItems }
  );
  return { events: results, status, loadMore };
}
```

**Status values:** `"LoadingFirstPage"` | `"CanLoadMore"` | `"LoadingMore"` | `"Exhausted"` [CITED: docs.convex.dev/database/pagination]

**"Load more" UI trigger:**
```tsx
{status === "CanLoadMore" && (
  <button onClick={() => loadMore(25)}>Load more</button>
)}
```

---

### Pattern 8: Retention Config Storage

**What:** Store retention threshold in existing `agentConfigs` table (already in schema).

```typescript
// Convex mutation to upsert the config
export const setRetentionDays = mutation({
  args: { days: v.float64() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentConfigs")
      .withIndex("by_key", (q) => q.eq("configKey", "retention_days"))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.days, updatedAt: Date.now() / 1000 });
    } else {
      await ctx.db.insert("agentConfigs", {
        configKey: "retention_days",
        value: args.days,
        source: "runtime",
        updatedAt: Date.now() / 1000,
      });
    }
  },
});
```

**No new table needed** — `agentConfigs` is already the project's generic key-value config store. [VERIFIED: schema.ts line 198-204]

---

### Anti-Patterns to Avoid

- **`.collect()` on large tables:** `costByProvider`, `costByModel`, `tokenSunburst`, and `errorRateTrend` all call `.collect()` on the full `llmMetrics` table today. Replace with aggregate table reads post-migration.
- **Client-side pagination:** Never fetch all rows and slice in the component. Use `.paginate()` server-side.
- **Scanning archived rows on every query:** Add `.filter((q) => q.neq(q.field("archived"), true))` to all active queries touching the four high-volume tables.
- **Re-scanning raw tables in the daily rollup:** Roll up from hourly aggregate rows, not from `llmMetrics` again.
- **Patching thousands of rows in one mutation:** Convex mutations have a budget. Batch archival to ~500 rows per table per cron run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor pagination | Custom offset/limit pagination | `paginationOptsValidator` + `.paginate()` + `usePaginatedQuery` | Convex cursors are reactive and handle concurrent data changes automatically |
| Cron scheduling | External scheduler, custom timer loop | `cronJobs()` with `.interval()` / `.daily()` | Built into Convex, visible in dashboard, single-run guarantee |
| Config key-value store | New config table | Existing `agentConfigs` table | Already in schema, already has `by_key` index |
| Aggregate rollup storage | Per-metric tables (costAggregates, eventAggregates) | Single `aggregates` table with `metric_type` discriminator | Per D-02 decision; fewer schema changes, one index to maintain |

---

## Common Pitfalls

### Pitfall 1: Timestamp Units Mismatch

**What goes wrong:** CodePulse stores `timestamp` as Unix epoch **seconds** (float64), but `Date.now()` returns milliseconds. Crons that compute `Date.now() / 1000` correctly are fine, but a single raw `Date.now()` comparison against a stored timestamp will be off by 1000x.

**Why it happens:** The codebase uses seconds throughout (see `events.ts`, `llm.ts`, `crons.ts`), but JavaScript defaults to milliseconds.

**How to avoid:** Always use `Date.now() / 1000` in Convex functions. Never use `Date.now()` bare for timestamp comparisons.

**Warning signs:** Archival cron marks everything or nothing archived; aggregate buckets land in wrong hour.

---

### Pitfall 2: Forgetting `archived` Filter on Existing Queries

**What goes wrong:** After the archival cron runs, old queries that don't filter `archived !== true` will start returning archived rows — or worse, queries like `costByProvider` that call `.collect()` will collect archived rows and inflate totals.

**Why it happens:** The soft-delete field is optional, so existing queries won't error — they'll silently include stale data.

**How to avoid:** When adding `archived` to schema, simultaneously audit every query that touches events, runtime_events, llmMetrics, toolExecutions and add the filter. The migration plan should treat the filter update as part of the archival workstream, not a separate cleanup step.

**Warning signs:** Cost totals increase after archival cron runs; "recent" event lists show timestamps older than retention threshold.

---

### Pitfall 3: Analytics Page Uses Raw Queries During Transition

**What goes wrong:** D-11 says query swaps are incremental. If Analytics page has a mix of aggregate-backed and raw-backed queries, aggregate queries will show less data (no history) while raw queries show full history — inconsistent charts on the same page.

**Why it happens:** No-backfill policy (D-12) means aggregates are empty until the first cron run.

**How to avoid:** Per D-12, this is expected and accepted. The fallback is intentional. Document which components are migrated and which still fall back. The planner should sequence the query swaps from lowest-priority charts to highest so the most important charts are migrated first.

**Warning signs:** Activity heatmap shows more data than cost chart on the same day.

---

### Pitfall 4: Convex Mutation Row Budget in Archival Cron

**What goes wrong:** Archival cron tries to patch 10,000 old rows in one mutation and hits the database bandwidth limit or CPU budget, causing the cron to fail silently (subsequent runs skipped if previous run is stuck).

**How to avoid:** Use `.take(500)` as a batch cap per table per cron run. The daily cron will incrementally catch up over time as long as write rate < 2000 new stale rows/day.

**Warning signs:** `cronExecutions` table shows the archival job logging errors or taking >3 seconds.

---

### Pitfall 5: Index Required for Paginated Queries

**What goes wrong:** Using `.paginate()` without `.withIndex()` causes Convex to reject the query — pagination requires a defined index.

**Why it happens:** Convex enforces index use for pagination to prevent full table scans.

**How to avoid:** All four high-volume tables already have `by_timestamp` indexes. Use `.withIndex("by_timestamp").order("desc").paginate(...)` pattern.

[CITED: docs.convex.dev/database/pagination — pagination requires withIndex]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.collect()` on entire table | `.paginate()` with cursor | This phase | Eliminates full table scans; list views handle 10k+ rows safely |
| Raw event queries for Analytics | Aggregate table reads | This phase (incremental) | Query time drops from O(all records) to O(aggregate rows) |
| No retention policy | Soft-delete archival cron | This phase | Active query sets stay bounded as Ástríðr generates events indefinitely |

**Currently problematic (to fix in this phase):**
- `llm.ts:costByProvider` — `.collect()` on entire `llmMetrics`
- `llm.ts:costByModel` — `.collect()` on entire `llmMetrics`
- `analytics.ts:activityHeatmap` — `.take(5000)` from raw events
- `analytics.ts:toolFlowSankey` — `.take(2000)` from raw events
- `analytics.ts:tokenSunburst` — `.collect()` on entire `llmMetrics`
- `events.ts:listErrors` — `.collect()` then client-side filter
- `events.ts:listPrompts` — `.collect()` then client-side filter
- `events.ts:countByType` — `.collect()` on entire `runtime_events`

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (from package.json — `npm test` / `npx vitest run`) |
| Config file | `vite.config.ts` (Vitest config co-located with Vite) |
| Quick run command | `npx vitest run src/hooks/ convex/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DP-01 | `computeHourly` writes correct aggregate rows for known llmMetrics input | unit | `npx vitest run convex/aggregates.test.ts` | Wave 0 |
| DP-01 | `rollupDaily` sums 24 hourly rows correctly | unit | `npx vitest run convex/aggregates.test.ts` | Wave 0 |
| DP-02 | Analytics page queries read from aggregates table (query function returns aggregate data, not raw) | unit | `npx vitest run convex/aggregates.test.ts` | Wave 0 |
| DP-03 | `markStaleArchived` marks rows older than threshold, skips newer rows | unit | `npx vitest run convex/archival.test.ts` | Wave 0 |
| DP-03 | Retention threshold read from `agentConfigs` correctly, defaults to 30 days | unit | `npx vitest run convex/archival.test.ts` | Wave 0 |
| DP-04 | `listRecentPaginated` returns `page`, `continueCursor`, `isDone` shape | unit | `npx vitest run convex/events.test.ts` | Wave 0 |
| DP-04 | `useRecentEvents` hook returns `{ events, status, loadMore }` | unit | `npx vitest run src/hooks/useRecentEvents.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run convex/aggregates.test.ts convex/archival.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `convex/aggregates.test.ts` — covers DP-01, DP-02
- [ ] `convex/archival.test.ts` — covers DP-03
- [ ] `src/hooks/useRecentEvents.test.ts` — covers DP-04 (hook shape)

*(Existing `convex/events.test.ts` may partially exist — check before creating)*

---

## Environment Availability

Phase 5 is backend/frontend code changes with no new external service dependencies. All required tools are the existing Convex dev environment.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex CLI | Schema deploy, cron registration | Yes | 1.32.0 (local) | — |
| Node.js | Build, tests | Yes | (existing) | — |
| Convex backend (deployed) | Cron execution, live testing | Yes | (existing deployment) | — |

No missing dependencies.

---

## Security Domain

This phase has no authentication, secret handling, or user-facing input beyond the retention days number field (a simple integer). ASVS categories V2, V3, V4, V6 do not apply.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | Yes (retention days input) | Validate with `v.float64()` in Convex args validator; add min/max bounds (1-365 days) in mutation handler |
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | Single-operator dashboard |
| V6 Cryptography | No | — |

**Threat patterns:**

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Retention set to 0 → archive everything | Tampering | Clamp retention_days to minimum 1 in mutation handler |
| Retention set to 9999 → never archives | Tampering | Clamp retention_days to maximum 365 in mutation handler |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Convex mutation batch cap of ~500 rows per run is safe for daily archival | Pattern 5 (archival mutation) | If budget is tighter, batch must be smaller; if larger, can process more rows faster |
| A2 | Daily archival cron at 02:00 UTC is "off-peak" for this deployment | Crons pattern | If Ástríðr is active 24/7, there is no off-peak; schedule is cosmetic but harmless |

---

## Open Questions

1. **Convex mutation row budget for archival**
   - What we know: Convex has CPU and bandwidth budgets per mutation; 500 rows is conservative
   - What's unclear: Exact row patch budget per mutation in Convex 1.17-1.35
   - Recommendation: Start with 500, monitor `cronExecutions` table for errors/duration; tune up if safe

2. **Analytics page query priority order for D-11 incremental swap**
   - What we know: Aggregates start empty; swaps are incremental
   - What's unclear: Which Analytics chart is most impactful to migrate first
   - Recommendation: Start with `costByProvider` (highest-frequency user query, hits entire `llmMetrics` table on every render); then `errorRateTrend`; then `activityHeatmap`

---

## Sources

### Primary (HIGH confidence)
- `convex/schema.ts` — Verified all table definitions, existing indexes, `agentConfigs` structure
- `convex/crons.ts` — Verified existing cron registration pattern
- `convex/events.ts`, `convex/llm.ts`, `convex/analytics.ts` — Verified all problematic `.collect()` and `.take(5000)` queries
- `src/hooks/useRecentEvents.ts`, `src/hooks/useLlmMetrics.ts` — Verified current hook patterns
- [CITED: docs.convex.dev/database/pagination] — Pagination API: `paginationOptsValidator`, `.paginate()`, `usePaginatedQuery`, status values
- [CITED: docs.convex.dev/scheduling/cron-jobs] — Cron API: `cronJobs()`, `.interval()`, `.daily()`, `internal.*`, single-run guarantee
- [CITED: docs.convex.dev/database/indexes] — Index range queries, filter with optional fields behavior

### Secondary (MEDIUM confidence)
- `npm view convex version` → 1.35.1 latest; project on ^1.17.0 — pagination API stable across this range

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all Convex APIs verified from official docs and codebase
- Architecture: HIGH — patterns derived directly from existing code and verified Convex docs
- Pitfalls: HIGH — all identified from direct code inspection (the problematic queries are in the repo)

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (Convex APIs are stable; 30-day window)
