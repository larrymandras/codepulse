---
phase: 94-trace-waterfall
plan: 04
subsystem: ui
tags: [react, react-router, useSearchParams, convex, pagination, trace, deep-link]

# Dependency graph
requires:
  - phase: 94-trace-waterfall (plan 03)
    provides: "TraceWaterfall component: Gantt-styled per-turn LLM call-chain visualization for a single session"
provides:
  - "SessionDetail 'Trace' tab rendering TraceWaterfall for the current session, deep-linkable via ?tab=trace"
  - "Analytics 'Recent LLM Calls' table (bounded, paginated via useLlmMetrics) with per-row 'View Trace' cross-link"
  - "Dead LangfuseTraceLink component and its Analytics usage site fully removed"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First useSearchParams deep-link on SessionDetail: initialize useState from the URL param directly (not a post-mount effect) since the tab is user-togglable client state; validate against the Tab union, silent fallback to 'overview' on absent/invalid"
    - "traceHref(sessionId) mirrors KGDetailsPanel's provenanceHref: null-guard + encodeURIComponent, never raw string interpolation into a route"
    - "Three-state cache badge (undefined/no-data vs 0/miss vs >0/hit) rendered via shadcn Badge + var(--status-ok)/var(--status-warn) token styling, mirroring the ActiveSessions.tsx Badge+style pattern"

key-files:
  created: []
  modified:
    - src/pages/SessionDetail.tsx
    - src/pages/Analytics.tsx

key-decisions:
  - "No test file existed for either LangfuseTraceLink.tsx or its usage sites, so deletion required no test cleanup beyond the component file itself"
  - "Recent LLM Calls table keyed on call._id ?? i since _id is optional on the LlmCallRow-shaped row type"
  - "Load more button only rendered when llmStatus === 'CanLoadMore' — Exhausted/LoadingMore/LoadingFirstPage states render no button, keeping the table honestly bounded per D-12 (no fake unbounded render)"

requirements-completed: [TRACE-02]

# Metrics
duration: 6min
completed: 2026-07-06
---

# Phase 94 Plan 04: Trace Waterfall Entry Points Summary

**SessionDetail gains a `?tab=trace`-deep-linkable "Trace" tab rendering `TraceWaterfall`; Analytics gains a bounded, paginated "Recent LLM Calls" table whose rows deep-link to that trace via a token-styled "View Trace" link; the dead `LangfuseTraceLink.tsx` Langfuse-dashboard link is deleted with zero remaining references.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-06T14:25:26-04:00 (base commit)
- **Completed:** 2026-07-06T14:31:06-04:00
- **Tasks:** 3/3
- **Files modified:** 3 (`SessionDetail.tsx`, `Analytics.tsx` modified; `LangfuseTraceLink.tsx` deleted)

## Accomplishments

- `SessionDetail.tsx`: extended `Tab` union with `"trace"`, appended `{ key: "trace", label: "Trace" }` to `TABS`; added the page's first `useSearchParams` wiring, initializing `activeTab` state from `?tab=` validated against the `Tab` union with silent fallback to `"overview"` (T-94-07 mitigation); the Trace panel renders `<TraceWaterfall sessionId={id} />` wrapped in `<SectionErrorBoundary name="Trace">`
- `Analytics.tsx`: removed the `LangfuseTraceLink` import and its single header JSX usage, preserving `TokenSavingsIndicator` and the wrapping div; deleted `src/components/LangfuseTraceLink.tsx` entirely
- `Analytics.tsx`: added a new "Recent LLM Calls" section (`SectionErrorBoundary` + `GlassPanel` + `SectionHeader`, placed after "Prompt Cache by Model") — a shadcn `Table` with columns Time/Model/Cost/Latency/Cache/Trace, sourced from `useLlmMetrics()`'s widened destructure (`calls`, `status`, `loadMore`); bounded pagination via a "Load more" button shown only when `status === "CanLoadMore"`; empty state "No LLM calls recorded yet." when zero rows
- Cache column implements a genuine three-state per D-13 (mirroring `TraceWaterfall`'s `cacheBadge` contract): `undefined` → "—" (no badge, legacy row), `> 0` → `Badge` styled `var(--status-ok)` labeled "cached", `=== 0` → `Badge` styled `var(--status-warn)` labeled "miss" — never collapsed together
- `traceHref(sessionId)` null-guards and `encodeURIComponent`s the sessionId before building `/sessions/:id?tab=trace` (T-94-08 mitigation), mirroring `KGDetailsPanel`'s `provenanceHref` pattern; the "View Trace" `Link` renders only when the helper returns non-null, styled with the reserved `var(--primary)` accent token per UI-SPEC
- `npx tsc --noEmit` exits 0 and `npm run build` succeeds after every task; zero remaining `LangfuseTraceLink` references anywhere in `src/`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the Trace tab + ?tab=trace deep-link to SessionDetail** - `a683c51` (feat)
2. **Task 2: Delete LangfuseTraceLink and its Analytics usage site** - `43050ca` (chore)
3. **Task 3: Add the 'Recent LLM Calls' table with per-row 'View Trace' deep-link** - `9030fb8` (feat)

## Files Created/Modified

- `src/pages/SessionDetail.tsx` - Adds the "trace" tab entry, `useSearchParams`-driven initial-tab deep-link, and the `TraceWaterfall`-rendering panel wrapped in `SectionErrorBoundary`
- `src/pages/Analytics.tsx` - Removes `LangfuseTraceLink`; adds the bounded, paginated "Recent LLM Calls" table with `traceHref()` and the "View Trace" cross-link
- `src/components/LangfuseTraceLink.tsx` - Deleted (dead Langfuse-dashboard external link, replaced by the in-product "View Trace" cross-nav)

## Decisions Made

- Initialized `activeTab` state directly from the `?tab=` search param (not via a post-mount `useEffect`) since the tab is ordinary user-togglable client state, not an inbound-precedence async load like `HivePage`'s `?goal=` pattern — this keeps the first render already correct instead of flashing "Overview" before an effect fires.
- Cache badges use the shadcn `Badge` primitive with `variant="outline"` + inline `style` color override (mirrors the existing `ActiveSessions.tsx` provider-badge pattern) rather than `TraceWaterfall`'s raw styled `<span>` — both approaches read the same three-state contract, but the plan explicitly requested `<Badge>` for this new table.
- Table rows are keyed on `call._id ?? i` since `_id` is optional on the row shape returned by `api.llm.recentCallsPaginated`.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria (tab entry, `useSearchParams` presence, `<TraceWaterfall>` wrapped by `SectionErrorBoundary`, zero `LangfuseTraceLink` references, `TokenSavingsIndicator` preserved, "Recent LLM Calls" + "View Trace" + `?tab=trace` + `encodeURIComponent` + `loadMore` all present, no new hardcoded hex) verified via `rg` and pass; `npx tsc --noEmit` and `npm run build` are green after every task.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Every rendered value in the new Trace tab and Recent LLM Calls table derives from real `TraceWaterfall`/`useLlmMetrics()` data; the "—" cells for missing cost/cache/sessionId are honest D-13/D-14 no-fabrication states, not stubs standing in for missing wiring.

## Threat Flags

None. T-94-07 (invalid `?tab=` value) is mitigated via the `Tab`-union validation with silent fallback. T-94-08 (sessionId injection into the View-Trace href) is mitigated via `encodeURIComponent` + null guard in `traceHref`, and the href is a same-origin route, not raw HTML. T-94-10 (XSS via untrusted model/timestamp/badge text) is mitigated — all row values render as plain JSX children, no `dangerouslySetInnerHTML` anywhere in the modified files. No new network endpoints, auth paths, or schema changes were introduced.

## Next Phase Readiness

TRACE-02 is fully wired end-to-end: an operator can now reach the trace waterfall either from the SessionDetail Trace tab directly or via the Analytics Recent LLM Calls table's "View Trace" cross-link, and the dead Langfuse external-dashboard link is gone. This is the last plan in Phase 94's wave 3 (depends_on: [94-03]) — no blockers for phase closeout.

## Self-Check: PASSED

- FOUND: `src/pages/SessionDetail.tsx`
- FOUND: `src/pages/Analytics.tsx`
- FOUND: `src/components/LangfuseTraceLink.tsx` correctly deleted
- FOUND: `.planning/phases/94-trace-waterfall/94-04-SUMMARY.md`
- FOUND commit: `a683c51` (Task 1)
- FOUND commit: `43050ca` (Task 2)
- FOUND commit: `9030fb8` (Task 3)
- FOUND commit: `8af1c8b` (this summary)

---
*Phase: 94-trace-waterfall*
*Completed: 2026-07-06*
