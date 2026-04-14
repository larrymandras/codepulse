# Phase 5: Data Pipeline - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Analytics queries run fast against pre-computed aggregates, old data auto-archives, and list views never load the full raw event table. No new dashboard pages — this phase optimizes the data layer underneath existing pages.

</domain>

<decisions>
## Implementation Decisions

### Aggregation strategy
- **D-01:** Aggregate the core three metrics: LLM cost, event counts, and error rates — matches DP-01 requirements exactly
- **D-02:** Single unified `aggregates` table with columns: metric_type (cost/events/errors), period (hourly/daily), bucket_start, value, dimensions (provider, model, event_type as JSON). One table, one cron per period granularity
- **D-03:** Hourly cron scans raw tables for the last hour and writes hourly aggregate rows. Daily cron rolls up 24 hourly rows into daily summary rows. Follows existing Convex cron interval pattern in `convex/crons.ts`
- **D-04:** Aggregate dimensions include key breakdowns: cost by provider+model, event counts by event_type, error rates by error category. Enables drill-down on Analytics page without hitting raw tables

### Retention & archival
- **D-05:** Soft delete with `archived: true` flag on event rows. Archival cron marks old rows as archived. Active queries filter on `archived !== true`. Data stays in Convex but doesn't pollute active queries
- **D-06:** Retention policy covers high-volume tables only: events, runtime_events, llmMetrics, toolExecutions. Other tables (agents, sessions, configs) are small and kept indefinitely
- **D-07:** Retention threshold configurable from the Settings page, stored in a Convex config table. Cron reads it on each run. Default 30 days per DP-03

### Pagination approach
- **D-08:** Cursor-based infinite scroll using Convex index-based cursors with "Load more" trigger. No page numbers — continuous loading matches the information-dense Paperclip UX and infinite scroll pattern from Phase 1
- **D-09:** All list views get paginated: events, sessions, agents, executions, alerts, LLM calls, security events — any page with a scrollable list. Systematic approach
- **D-10:** Default page size of 25 items. Can be overridden per-component if needed

### Migration path
- **D-11:** Incremental swap — add aggregate tables and cron jobs first, then update Analytics page queries one at a time to read from aggregates. Each query swap is a small, testable change. Old queries stay as fallback until aggregates have data
- **D-12:** Aggregates start fresh from when cron jobs begin running. No backfill of historical data. Historical views for older periods fall back to raw table queries (per PROJECT.md: "New aggregation tables start fresh")

### Claude's Discretion
- Exact schema for the unified aggregates table (field names, index design)
- Archival cron scheduling (daily at off-peak vs. hourly alongside aggregation)
- Convex cursor implementation details (which indexes to add for cursor-based pagination)
- Order of Analytics page query swaps (which components migrate to aggregates first)
- Whether to create a shared `usePaginatedQuery` hook or use Convex's built-in pagination helpers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data layer (current state — what gets replaced/upgraded)
- `convex/schema.ts` — All 40+ table definitions. New aggregates table will be added here. High-volume tables to archive: events, runtime_events, llmMetrics, toolExecutions
- `convex/events.ts` — Event ingest mutation and listRecent query (uses `.take(limit)`, no pagination)
- `convex/llm.ts` — LLM metrics recording and queries. `costByProvider` does `.collect()` on entire table — primary aggregation target
- `convex/analytics.ts` — Activity heatmap and Sankey flow queries. `activityHeatmap` pulls `.take(5000)` from raw events — primary migration target
- `convex/crons.ts` — Existing cron infrastructure (hourly stale alert auto-acknowledge). New aggregation and archival crons register here

### Frontend (pages that consume data pipeline)
- `src/pages/Analytics.tsx` — Analytics page importing 15+ chart/panel components. Reads from raw event and LLM tables. Primary consumer of aggregate data post-migration
- `src/hooks/useRecentEvents.ts` — Hook used by Analytics page to load events (needs pagination)
- `src/hooks/useLlmMetrics.ts` — Hook used by Analytics page for LLM data (needs pagination)

### Configuration
- `src/pages/Settings.tsx` — Settings page where retention threshold control will be added

### Project context
- `.planning/PROJECT.md` — "Historical data migration" listed as out of scope; "New aggregation tables start fresh"
- `.planning/REQUIREMENTS.md` — DP-01 through DP-04 define exact acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `convex/crons.ts`: Existing cron registration pattern — add aggregation and archival crons alongside stale alert cron
- `convex/events.ts:listRecent`: Query pattern with `.withIndex("by_timestamp").order("desc").take(limit)` — upgrade to cursor-based pagination
- Convex's built-in `paginationOptsValidator` and `.paginate()` API — available for cursor-based queries

### Established Patterns
- All data persistence through Convex mutations/queries — no direct DB access
- Index-based ordering: most tables already have `by_timestamp` index
- Hooks pattern: `useRecentEvents`, `useLlmMetrics` wrap Convex `useQuery` — will need pagination-aware equivalents

### Integration Points
- `convex/schema.ts` — New `aggregates` table definition, `archived` field additions to event tables
- `convex/crons.ts` — New cron job registrations for hourly aggregation, daily rollup, and archival
- `src/pages/Analytics.tsx` — Query swaps from raw tables to aggregate table
- `src/pages/Settings.tsx` — New retention threshold configuration control
- Every list page (Events, Sessions, Agents, Executions, Alerts, etc.) — pagination hook integration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User chose recommended options across all areas, indicating preference for conventional, well-tested patterns over novel approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-data-pipeline*
*Context gathered: 2026-04-14*
