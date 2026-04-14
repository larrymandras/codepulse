---
phase: 05-data-pipeline
plan: 03
subsystem: database
tags: [convex, pagination, react, hooks, typescript]

# Dependency graph
requires:
  - phase: 05-01
    provides: archival.ts with setRetentionDays/getRetentionDays mutations consumed by Settings page
  - phase: 05-02
    provides: aggregates tables and queries; schema with by_timestamp/by_status indexes used by paginated queries
provides:
  - Convex paginated queries for events (listRecentPaginated), runtime_events (listRecentRuntimePaginated), llmMetrics (recentCallsPaginated), and sessions (listPaginated)
  - usePaginatedQuery-based hooks returning { events/calls, status, loadMore }
  - LoadMoreButton shared component with spinner and text-link styles
  - Data Retention section in Settings page with validated input (1-365 days) and inline save
  - useRecentEvents.test.ts filled with 5 real assertions (all passing)
affects: [ui-redesign, dashboard, analytics, settings, event-feed]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Convex .paginate() with paginationOptsValidator for server-side cursor pagination"
    - "usePaginatedQuery hook returning { results, status, loadMore } destructured to domain-specific names"
    - "LoadMoreButton component rendering null for Exhausted/LoadingFirstPage, spinner for LoadingMore, text button for CanLoadMore"

key-files:
  created:
    - src/components/LoadMoreButton.tsx
  modified:
    - convex/events.ts
    - convex/llm.ts
    - convex/sessions.ts
    - src/hooks/useRecentEvents.ts
    - src/hooks/useLlmMetrics.ts
    - src/hooks/useRecentEvents.test.ts
    - src/pages/Settings.tsx
    - src/components/EventFeed.tsx
    - src/pages/Dashboard.tsx
    - src/pages/Analytics.tsx
    - src/components/LlmProviderPanel.tsx

key-decisions:
  - "Existing non-paginated queries preserved for backward compatibility — paginated variants added alongside them"
  - "useRecentEvents return shape changed from Event[] to { events, status, loadMore } — all consumers updated in same commit"
  - "RetentionControl implemented as file-local component in Settings.tsx to keep retention logic co-located"
  - "Test file uses vi.mock for convex/react and generated API to avoid real Convex client dependency"

patterns-established:
  - "Pagination pattern: add paginationOptsValidator to args, call .paginate(args.paginationOpts), wrap in usePaginatedQuery on frontend"
  - "Consumer update pattern: destructure { domain, status, loadMore } from upgraded hook, add LoadMoreButton at end of list"

requirements-completed: [DP-04, DP-03]

# Metrics
duration: 25min
completed: 2026-04-14
---

# Phase 05 Plan 03: Pagination Infrastructure Summary

**Cursor-based pagination via Convex .paginate() for events, LLM metrics, and sessions, with LoadMoreButton component, upgraded hooks, and Settings data retention control**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-14T09:20:00Z
- **Completed:** 2026-04-14T09:45:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Added paginated query variants to convex/events.ts, convex/llm.ts, and convex/sessions.ts using paginationOptsValidator and .paginate()
- Upgraded useRecentEvents and useLlmMetrics hooks to usePaginatedQuery with 25-item default page size; updated all 4 consumers
- Created LoadMoreButton shared component per UI-SPEC (null on Exhausted/LoadingFirstPage, spinner on LoadingMore, text-link on CanLoadMore)
- Added Data Retention section to Settings page with validated number input (1-365 days), Update Retention button with inline spinner, and server sync via api.archival.setRetentionDays
- Filled useRecentEvents.test.ts with 5 real assertions — all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add paginated query variants to Convex backend** - `f673e35` (feat)
2. **Task 2: Create LoadMoreButton, upgrade hooks, fill tests, add Settings retention** - `a0d5fd0` (feat)

## Files Created/Modified
- `convex/events.ts` - Added listRecentPaginated and listRecentRuntimePaginated queries
- `convex/llm.ts` - Added recentCallsPaginated query
- `convex/sessions.ts` - Added listPaginated query using by_status index
- `src/components/LoadMoreButton.tsx` - New shared component per UI-SPEC
- `src/hooks/useRecentEvents.ts` - Upgraded to usePaginatedQuery returning { events, status, loadMore }
- `src/hooks/useLlmMetrics.ts` - Upgraded to usePaginatedQuery returning { calls, status, loadMore }
- `src/hooks/useRecentEvents.test.ts` - Filled 5 real assertions replacing test.todo stubs
- `src/pages/Settings.tsx` - Added RetentionControl component and Data Retention section
- `src/components/EventFeed.tsx` - Updated consumer to destructure hook + added LoadMoreButton
- `src/pages/Dashboard.tsx` - Updated consumer to destructure { events }
- `src/pages/Analytics.tsx` - Updated consumers to destructure { events } and { calls: llmCalls }
- `src/components/LlmProviderPanel.tsx` - Updated consumer to destructure { calls }

## Decisions Made
- Existing non-paginated queries preserved alongside new paginated variants for backward compatibility
- useRecentEvents/useLlmMetrics return shape changed in same commit as all consumer updates to keep the repo always-compilable
- RetentionControl placed as a file-local component in Settings.tsx (co-location over separate file for a settings-only component)
- Test mocks use vi.mock with MockedFunction typing to avoid require() and stay ESM-clean

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced require() in test with ESM-compatible MockedFunction pattern**
- **Found during:** Task 2 (fill test stubs)
- **Issue:** Plan's test template used `const { usePaginatedQuery } = require("convex/react")` which produces TS2580 in strict ESM context
- **Fix:** Imported usePaginatedQuery at top and cast as `MockedFunction<typeof usePaginatedQuery>` for typed spy access
- **Files modified:** src/hooks/useRecentEvents.test.ts
- **Verification:** tsc --noEmit clean, all 5 tests pass
- **Committed in:** a0d5fd0 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan's test template)
**Impact on plan:** Minor fix to test syntax only. No scope change.

## Issues Encountered
None beyond the require() ESM fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Paginated backend queries ready for consumption by additional UI views (Sessions, LLM pages)
- LoadMoreButton component available for all future paginated list views
- Settings retention control wired to archival.setRetentionDays from Plan 01
- Plan 04 (alert routing) and Plan 05 (intelligence layer) can proceed independently

## Known Stubs
None - all plan deliverables fully wired to real data.

## Threat Flags
No new security surface introduced beyond what was in the plan's threat model.

---
*Phase: 05-data-pipeline*
*Completed: 2026-04-14*
