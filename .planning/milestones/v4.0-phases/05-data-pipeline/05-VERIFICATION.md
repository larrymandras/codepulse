---
phase: 05-data-pipeline
verified: 2026-04-14T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Trigger a Convex dev environment and check the aggregates table for rows after the hourly cron fires"
    expected: "Rows appear in the aggregates table with metric_type='cost', period='hourly', and a valid bucket_start timestamp"
    why_human: "Cannot invoke cron jobs or inspect live Convex database state programmatically in this environment"
  - test: "Insert a test event with a timestamp older than 30 days, wait for or manually invoke the archive-stale-events cron"
    expected: "The event row has archived=true after the cron runs"
    why_human: "Requires a live Convex deployment to verify the archival mutation actually patches rows"
  - test: "Open the Analytics page in a browser after at least one hourly cron has run"
    expected: "Total Cost MetricCard shows a non-zero value read from api.aggregates.costByPeriod (not from api.llm.costByProvider)"
    why_human: "Requires a browser and real aggregate data to visually confirm the swap is showing aggregate-sourced values"
  - test: "Open a list page (Agents, Alerts, Executions, or Security) with more than 25 items"
    expected: "Only 25 items are visible initially; a 'Load more (25)' text button appears at the bottom; clicking it loads the next page"
    why_human: "Requires a browser with live data exceeding 25 items to verify LoadMoreButton renders and triggers Convex pagination"
---

# Phase 5: Data Pipeline Verification Report

**Phase Goal:** Analytics queries run fast against pre-computed aggregates, old data auto-archives, and list views never load the full raw event table
**Verified:** 2026-04-14
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The Analytics page loads historical views by querying hourly/daily aggregate tables — not raw event tables | VERIFIED | `src/pages/Analytics.tsx` line 27: `useQuery(api.aggregates.costByPeriod, { period: "daily" })`; line 29: `api.aggregates.errorTrendByPeriod`; line 31: `api.aggregates.eventCountsByPeriod`. Total Cost and Total Events MetricCards render from aggregate data with D-12 fallback. |
| 2 | Convex cron jobs run on schedule and produce visible aggregate rows for cost, event counts, and error rates | VERIFIED (code) / HUMAN (runtime) | `convex/crons.ts` registers `aggregate-hourly` (interval 1h → computeHourly), `aggregate-daily` (01:00 UTC → rollupDaily), `archive-stale-events` (02:00 UTC → markStaleArchived). `convex/aggregates.ts` exports `computeHourly` and `rollupDaily` with full implementation. Runtime execution needs human verification. |
| 3 | Events older than the configured threshold (default 30 days) are automatically archived without manual intervention | VERIFIED (code) / HUMAN (runtime) | `convex/archival.ts:13` defaults to 30 days. `markStaleArchived` queries by_timestamp index with cutoff, filters out already-archived rows, patches 500-row batches across all four high-volume tables. Schema has `archived: v.optional(v.boolean())` on events, runtime_events, llmMetrics, toolExecutions (lines 14, 32, 255, 500). Runtime execution needs human verification. |
| 4 | Dashboard list views page through large result sets using server-side cursor pagination — no client-side filtering of full tables | VERIFIED | All seven domains paginated: events (convex/events.ts:130), llmMetrics (convex/llm.ts:44), sessions (convex/sessions.ts:95), agents (convex/agents.ts:79), alerts (convex/alerts.ts:65), commandExecutions (convex/commandExecutions.ts:98), securityEvents (convex/security.ts:47). All use paginationOptsValidator + .paginate(). LoadMoreButton wired in all four pages from Plan 04. |

**Score:** 4/4 truths verified (code-level)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | aggregates table + archived fields on 4 tables | VERIFIED | aggregates table at line 817 with by_type_period_bucket and by_period_bucket indexes; archived field at lines 14, 32, 255, 500 |
| `convex/crons.ts` | 3 new cron registrations | VERIFIED | aggregate-hourly, aggregate-daily, archive-stale-events all registered with correct schedules and internal function references |
| `convex/aggregates.ts` | computeHourly, rollupDaily, costByPeriod, errorTrendByPeriod, eventCountsByPeriod | VERIFIED | All five exports present at lines 5, 93, 131, 157, 181 |
| `convex/archival.ts` | markStaleArchived, setRetentionDays, getRetentionDays | VERIFIED | All three exports present at lines 5, 31, 59 |
| `convex/aggregates.test.ts` | 8 real assertions (expect) for bucket logic, dimension grouping, rollup | VERIFIED | 8 test() calls with expect assertions; no test.todo stubs remain |
| `convex/archival.test.ts` | 9 real assertions for clamping, cutoff calculation, defaults | VERIFIED | 9 test() calls with expect assertions; no test.todo stubs remain |
| `convex/llm.ts` | archived filter on all 7 read functions | VERIFIED | 8 instances of q.neq(q.field("archived"), true) — all collect() and take() calls preceded by filter |
| `convex/analytics.ts` | archived filter on 6 read functions | VERIFIED | 6 instances confirmed; sessionDurations intentionally excluded per D-06 |
| `convex/events.ts` | archived filter on 9+ read functions | VERIFIED | 11 instances confirmed (includes listRecentPaginated and runtime_events functions added in Plan 03) |
| `src/pages/Analytics.tsx` | Uses api.aggregates.costByPeriod and api.aggregates.eventCountsByPeriod | VERIFIED | Lines 27, 29, 31 confirmed; aggregate data rendered in MetricCards with fallback per D-12 |
| `convex/events.ts` | listRecentPaginated export | VERIFIED | Line 130 |
| `convex/llm.ts` | recentCallsPaginated export | VERIFIED | Line 44 |
| `convex/sessions.ts` | listPaginated export | VERIFIED | Line 95 |
| `convex/agents.ts` | listAllPaginated export | VERIFIED | Line 79 |
| `convex/alerts.ts` | listAllPaginated export | VERIFIED | Line 65 |
| `convex/commandExecutions.ts` | listExecutionsPaginated export | VERIFIED | Line 98 |
| `convex/security.ts` | recentEventsPaginated export | VERIFIED | Line 47 |
| `src/hooks/useRecentEvents.ts` | usePaginatedQuery returning { events, status, loadMore } | VERIFIED | usePaginatedQuery at line 5 → api.events.listRecentPaginated; initialNumItems=25 |
| `src/hooks/useLlmMetrics.ts` | usePaginatedQuery returning { calls, status, loadMore } | VERIFIED | usePaginatedQuery at line 5 → api.llm.recentCallsPaginated; initialNumItems=25 |
| `src/hooks/useRecentEvents.test.ts` | 5 real assertions for paginated hook shape | VERIFIED | 5 test() calls with expect assertions |
| `src/components/LoadMoreButton.tsx` | Shared LoadMoreButton per UI-SPEC | VERIFIED | Renders null for Exhausted/LoadingFirstPage, Loader2 spinner for LoadingMore, text-link button for CanLoadMore; pageSize=25 default |
| `src/pages/Settings.tsx` | Data Retention section with RetentionControl | VERIFIED | RetentionControl at line 51; SectionErrorBoundary wrapper at line 520; wired to api.archival.setRetentionDays and getRetentionDays |
| `src/hooks/useAgentTopology.ts` | useAllAgentsPaginated hook | VERIFIED | Line 24; wired to api.agents.listAllPaginated |
| `src/hooks/useAlerts.ts` | useAllAlertsPaginated hook | VERIFIED | Line 20; wired to api.alerts.listAllPaginated |
| `src/hooks/useSecurityEvents.ts` | useSecurityEventsPaginated hook | VERIFIED | Line 12; wired to api.security.recentEventsPaginated |
| `src/pages/Agents.tsx` | useAllAgentsPaginated + LoadMoreButton | VERIFIED | Line 176 uses hook; LoadMoreButton at line 596 |
| `src/pages/Alerts.tsx` | useAllAlertsPaginated + LoadMoreButton | VERIFIED | Line 48 uses hook; LoadMoreButton at line 196 (when showAll toggle active) |
| `src/pages/Executions.tsx` | usePaginatedQuery(listExecutionsPaginated) + LoadMoreButton | VERIFIED | Line 36-38 uses direct usePaginatedQuery; LoadMoreButton at line 155 |
| `src/pages/Security.tsx` | useSecurityEventsPaginated + LoadMoreButton | VERIFIED | Line 46 uses hook; LoadMoreButton at line 135 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| convex/crons.ts | convex/aggregates.ts | internal.aggregates.computeHourly | WIRED | Line 17 confirmed |
| convex/crons.ts | convex/archival.ts | internal.archival.markStaleArchived | WIRED | Line 31 confirmed |
| convex/archival.ts | convex/schema.ts | agentConfigs retention_days configKey | WIRED | archival.ts queries agentConfigs.by_key with configKey="retention_days" |
| convex/analytics.ts | convex/schema.ts | archived filter on events/llmMetrics | WIRED | 6 q.neq(q.field("archived"), true) filters confirmed |
| convex/llm.ts | convex/schema.ts | archived filter on llmMetrics | WIRED | 8 q.neq(q.field("archived"), true) filters confirmed |
| src/pages/Analytics.tsx | convex/aggregates.ts | api.aggregates.costByPeriod, errorTrendByPeriod, eventCountsByPeriod | WIRED | Lines 27, 29, 31 confirmed |
| src/hooks/useRecentEvents.ts | convex/events.ts | usePaginatedQuery(api.events.listRecentPaginated) | WIRED | Line 6 confirmed |
| src/hooks/useLlmMetrics.ts | convex/llm.ts | usePaginatedQuery(api.llm.recentCallsPaginated) | WIRED | Line 6 confirmed |
| src/pages/Settings.tsx | convex/archival.ts | useMutation(api.archival.setRetentionDays) | WIRED | Line 53 confirmed |
| src/hooks/useAgentTopology.ts | convex/agents.ts | usePaginatedQuery(api.agents.listAllPaginated) | WIRED | Line 26 confirmed |
| src/hooks/useAlerts.ts | convex/alerts.ts | usePaginatedQuery(api.alerts.listAllPaginated) | WIRED | Line 22 confirmed |
| src/pages/Executions.tsx | convex/commandExecutions.ts | usePaginatedQuery(api.commandExecutions.listExecutionsPaginated) | WIRED | Lines 36-38 confirmed |
| src/hooks/useSecurityEvents.ts | convex/security.ts | usePaginatedQuery(api.security.recentEventsPaginated) | WIRED | Line 14 confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| src/pages/Analytics.tsx | costByProvider | api.aggregates.costByPeriod (aggregates table DB query by_type_period_bucket index) | Yes — DB index query in aggregates.ts:131 groups by provider | FLOWING |
| src/pages/Analytics.tsx | totalAggregateEvents | api.aggregates.eventCountsByPeriod (aggregates table DB query) | Yes — DB index query in aggregates.ts:181 groups by event_type | FLOWING (with D-12 fallback to events.length when aggregates empty) |
| src/pages/Settings.tsx (RetentionControl) | currentDays | api.archival.getRetentionDays (agentConfigs table DB query) | Yes — archival.ts:59 queries agentConfigs.by_key | FLOWING (defaults to 30 when no config) |
| src/hooks/useRecentEvents.ts | events | api.events.listRecentPaginated (events table DB query with by_timestamp index) | Yes — events.ts:130 uses .paginate() with archived filter | FLOWING |

### Behavioral Spot-Checks

Automated behavioral checks for cron execution and live database writes require a running Convex environment and cannot be performed without starting the dev server. Skipped per Step 7b constraints.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| aggregates.ts exports callable functions | `node -e "const m = require('./convex/aggregates.ts')"` | N/A — requires TypeScript compilation | SKIP (requires build) |
| Test files have real assertions (not todos) | grep -c "test(" on 3 test files | 8, 9, 5 tests respectively; 0 test.todo stubs found | PASS |
| crons.ts registers 3 new jobs | grep for aggregate-hourly, aggregate-daily, archive-stale-events in crons.ts | All 3 found with correct schedules | PASS |
| archived filter coverage | grep -c neq.*archived across llm.ts, analytics.ts, events.ts | 8, 6, 11 instances — all collect()/take() on high-volume tables preceded by filter | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DP-01 | 05-01-PLAN.md | Convex cron jobs compute hourly and daily aggregates for LLM cost, event counts, and error rates | SATISFIED | computeHourly and rollupDaily in convex/aggregates.ts; crons registered in crons.ts with hourly interval and daily schedule |
| DP-02 | 05-02-PLAN.md | Historical dashboard views (Analytics page) query pre-computed aggregates instead of raw event tables | SATISFIED | Analytics.tsx lines 27, 29, 31 use api.aggregates.*; primary MetricCards read from aggregate table |
| DP-03 | 05-01-PLAN.md, 05-02-PLAN.md, 05-03-PLAN.md | Data retention policy auto-archives events older than configurable threshold (default 30 days) | SATISFIED | markStaleArchived in archival.ts with 30-day default; Settings UI with 1-365 day clamping; archived filter on all read queries |
| DP-04 | 05-03-PLAN.md, 05-04-PLAN.md | Dashboard list queries use server-side pagination with index-based cursors (no client-side filtering of large result sets) | SATISFIED | All 7 list domains paginated with paginationOptsValidator + .paginate(); hooks return { domain, status, loadMore }; LoadMoreButton in all pages |

**Note on REQUIREMENTS.md traceability table:** The traceability table in `.planning/REQUIREMENTS.md` (lines 88-91) maps DP-01 through DP-04 to "Phase 3". The actual implementing phase is Phase 5. This is a stale traceability mapping — the requirement text, the plans, and the codebase all consistently point to Phase 5. The table column likely reflects an earlier roadmap numbering. This is informational only and does not affect whether the requirements are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/pages/Analytics.tsx | 38 | `void errorTrend;` — error trend aggregate query result is intentionally suppressed | Info | Per 05-02-SUMMARY.md, this is a deliberate pattern: the query is wired (preventing unused warning) but the child ErrorRateTrend component still fetches its own data internally. Logged as a future swap candidate. Not a blocker. |
| src/pages/Alerts.tsx | 196 | `{showAll && <LoadMoreButton ... />}` — LoadMoreButton only renders when showAll toggle is active | Info | A conditional LoadMoreButton is acceptable for a toggle-driven view. The paginated query is active regardless. Not a stub. |

No blockers or substantive warnings found.

### Human Verification Required

#### 1. Cron Job Produces Real Aggregate Rows

**Test:** Deploy to a Convex dev environment. Wait at least 1 hour (or manually invoke `internal.aggregates.computeHourly` via the Convex dashboard Functions runner), then query the `aggregates` table.
**Expected:** Rows exist with `metric_type` in ["cost", "events", "errors"], `period="hourly"`, `bucket_start` aligned to an hour boundary (value % 3600 === 0), and a non-zero `value`.
**Why human:** Cannot invoke Convex internal mutations or inspect live database state without a running deployment.

#### 2. Archival Cron Marks Old Rows Archived

**Test:** In a dev environment, insert a row in the events table with `timestamp` set to 31 days ago. Invoke `internal.archival.markStaleArchived` via the Convex dashboard. Query the row.
**Expected:** The row's `archived` field is `true`.
**Why human:** Requires live Convex database with writable state and cron execution capability.

#### 3. Analytics Page Renders Aggregate Data After Cron Runs

**Test:** After at least one `aggregate-hourly` cron run in a dev/prod deployment, open the Analytics page in a browser.
**Expected:** Total Cost MetricCard shows a value sourced from the aggregates table (not from api.llm.costByProvider). Network tab confirms the query is `aggregates:costByPeriod`, not `llm:costByProvider`.
**Why human:** Requires browser, live data, and at least one completed cron cycle.

#### 4. Load More Button Appears and Works on List Pages

**Test:** Open any of Agents, Alerts, Executions, or Security in a browser when the dataset exceeds 25 items.
**Expected:** Only 25 items render initially. A "Load more (25)" text-link button appears below the list. Clicking it appends the next 25 items without a full page reload. Button disappears when all items are loaded.
**Why human:** Requires a browser with live Convex data exceeding the 25-item page size threshold.

### Gaps Summary

No code-level gaps found. All four success criteria are satisfied at the artifact and wiring level:
- Aggregate pipeline (schema, crons, mutations, read queries): fully implemented and wired
- Archived filters: applied to all read queries on all four high-volume tables (25 filter instances total)
- Analytics page: primary MetricCards consume aggregate queries with D-12 fallback
- Pagination: all seven list domains use server-side cursor pagination with 25-item pages and LoadMoreButton

Four human verification items remain to confirm runtime behavior (cron execution, actual archival of rows, aggregate data rendering in browser, Load More button interaction). These cannot be verified through static code analysis.

---

_Verified: 2026-04-14_
_Verifier: Claude (gsd-verifier)_
