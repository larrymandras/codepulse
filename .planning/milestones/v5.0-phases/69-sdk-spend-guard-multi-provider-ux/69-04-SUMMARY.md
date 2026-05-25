---
phase: 69-sdk-spend-guard-multi-provider-ux
plan: "04"
subsystem: ui
tags: [react, typescript, convex, provider-badges, session-timeline, routing-decisions]

# Dependency graph
requires:
  - phase: 69-01
    provides: "PROVIDER_COLORS, PROVIDER_DISPLAY_NAMES in src/lib/providers.ts; toolExecutions.listBySession Convex query"
provides:
  - "SessionTimeline with PROVIDER_COLORS-styled Badge per tool call event (D-09)"
  - "SessionDetail querying toolExecutions.listBySession and passing to SessionTimeline"
  - "ActiveSessions with primary provider badge per session card (D-10)"
  - "RoutingDecisionsTable with fallback filter and inline Score column (D-13)"
  - "SessionTimeline.test.tsx with 4 real provider badge tests (GW-14)"
affects:
  - 69-sdk-spend-guard-multi-provider-ux
  - session-views
  - routing-decisions-ux

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "toolName:roundedTimestamp key pattern for matching events to toolExecutions"
    - "PROVIDER_COLORS Badge style injection via inline style (borderColor + color)"
    - "fallbackFilter state with pill buttons for All/Fallback-only filtering"

key-files:
  created: []
  modified:
    - src/components/SessionTimeline.tsx
    - src/components/SessionTimeline.test.tsx
    - src/pages/SessionDetail.tsx
    - src/components/ActiveSessions.tsx
    - src/components/RoutingDecisionsTable.tsx

key-decisions:
  - "toolName + Math.round(timestamp) as match key for event-to-toolExecution correlation (per RESEARCH.md A3 — same-second proximity)"
  - "IIFE in JSX used to call getEventProvider inline without introducing extra component"
  - "RoutingDecisionsTable empty state check moved to use filteredDecisions so fallback filter shows correct message"

patterns-established:
  - "Provider badge pattern: Badge variant=outline with PROVIDER_COLORS borderColor+color inline style"
  - "Filter pill pattern: text-xs px-2 py-1 font-mono with active/inactive color classes"

requirements-completed: [GW-14, GW-13]

# Metrics
duration: 15min
completed: 2026-05-23
---

# Phase 69 Plan 04: Provider Badges and RoutingDecisionsTable Upgrade Summary

**Provider attribution badges on session timeline events and session list rows, with fallback filter and inline Score column on RoutingDecisionsTable, and 4 real vitest tests for badge rendering**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-23T10:30:00Z
- **Completed:** 2026-05-23T10:45:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SessionTimeline accepts optional `toolExecutions` prop and renders PROVIDER_COLORS-styled Badge per tool call event using a `toolName:roundedTimestamp` lookup map
- SessionDetail queries `api.toolExecutions.listBySession` and passes results to SessionTimeline
- ActiveSessions renders primary provider badge inline with session ID when `session.provider` is set
- RoutingDecisionsTable upgraded with `fallbackFilter` state, All/Fallback-only pill buttons, `filteredDecisions` derived array, Score column (`finalScore?.toFixed(3)`), and colSpan updated from 5 to 6
- SessionTimeline.test.tsx: 4 real tests — badge render, empty toolExecutions, non-tool event (no badge), unknown provider fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add provider badges to SessionTimeline and SessionDetail + fill SessionTimeline.test.tsx** - `837303c` (feat)
2. **Task 2: Add provider badge to ActiveSessions + upgrade RoutingDecisionsTable** - `52571dd` (feat)

**Plan metadata:** (committed with SUMMARY)

## Files Created/Modified
- `src/components/SessionTimeline.tsx` - Added toolExecutions prop, useMemo provider map, PROVIDER_COLORS Badge per tool call event
- `src/components/SessionTimeline.test.tsx` - Replaced .todo stubs with 4 real provider badge tests
- `src/pages/SessionDetail.tsx` - Added toolExecutions query and passes to SessionTimeline
- `src/components/ActiveSessions.tsx` - Added provider badge with PROVIDER_COLORS in session header row
- `src/components/RoutingDecisionsTable.tsx` - Added fallbackFilter, filter pills, filteredDecisions, Score column, colSpan=6

## Decisions Made
- Used `toolName:Math.round(timestamp)` as the correlation key between events and toolExecutions — matches within same second per RESEARCH.md A3 guidance. Simple and deterministic without requiring a dedicated join.
- IIFE pattern in JSX to call `getEventProvider(e)` inline without introducing a sub-component for a small piece of conditional logic.
- RoutingDecisionsTable empty state check updated to use `filteredDecisions` so the empty message adapts to the active filter ("No fallback routing decisions found" vs the generic no-data message).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Provider badges are visible throughout session views (timeline events, session list, routing decisions table)
- SessionTimeline.test.tsx has real coverage for badge rendering behavior
- RoutingDecisionsTable supports fallback-only drill-down for operator investigation
- Phase 69 Plan 05 (if any) can build on this provider attribution foundation

## Self-Check
- [x] `src/components/SessionTimeline.tsx` exists with `toolExecutions?: any[]`, `PROVIDER_COLORS`, `toolExecProviderMap`, `Badge` import
- [x] `src/components/SessionTimeline.test.tsx` has 4 real tests (not .todo stubs)
- [x] `src/pages/SessionDetail.tsx` has `api.toolExecutions.listBySession` and `toolExecutions={toolExecutions}`
- [x] `src/components/ActiveSessions.tsx` has `PROVIDER_COLORS`, `session.provider` check, `Badge`
- [x] `src/components/RoutingDecisionsTable.tsx` has `fallbackFilter`, `"Fallback only"`, `filteredDecisions`, `<TableHead>Score</TableHead>`, `finalScore?.toFixed(3)`, `colSpan={6}`
- [x] All 4 vitest tests pass
- [x] `npx tsc --noEmit` exits clean
- [x] Commits 837303c and 52571dd exist

## Self-Check: PASSED

---
*Phase: 69-sdk-spend-guard-multi-provider-ux*
*Completed: 2026-05-23*
