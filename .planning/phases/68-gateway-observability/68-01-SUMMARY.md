---
phase: 68-gateway-observability
plan: 01
subsystem: database
tags: [convex, typescript, vitest, cron, gateway, observability]

# Dependency graph
requires:
  - phase: 66-cli-gateway-telemetry
    provides: "Gateway telemetry pipeline writing task events from Astridr"
provides:
  - "gatewayTasks Convex table with upsert mutation, listPaginated query, providerStats query"
  - "gatewayQuotaSnapshots Convex table with 5-minute cron polling action and latestByProvider query"
  - "routingDecisions Convex table with insert mutation and listPaginated query"
  - "poll-gateway-quota cron registered for 5-minute interval"
  - "computeProviderStats and deduplicateByProvider pure helpers for testability"
affects:
  - "68-gateway-observability (plans 02+)"
  - "All Phase 68 UI components consuming gatewayTasks, gatewayQuota, routingDecisions"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure helper extraction: extract query grouping/dedup logic into exported pure functions for testability without Convex ctx"
    - "process.env for Convex action server-side env vars (not import.meta.env.VITE_)"
    - "internalAction + internalMutation pairing for cron-driven snapshot writes"

key-files:
  created:
    - convex/gatewayTasks.ts
    - convex/gatewayQuota.ts
    - convex/routingDecisions.ts
    - convex/gatewayTasks.test.ts
    - convex/gatewayQuota.test.ts
    - convex/routingDecisions.test.ts
  modified:
    - convex/schema.ts
    - convex/crons.ts

key-decisions:
  - "Export pure helpers computeProviderStats and deduplicateByProvider for unit testing without Convex ctx mocking"
  - "Use process.env.ASTRIDR_API_URL (not import.meta.env.VITE_) per Convex server-side env var pattern"
  - "T-68-01: Only log response status codes, never log API key value"
  - "latestByProvider takes top-100 rows newest-first then deduplicates — current-only, no history"

patterns-established:
  - "Pure helper extraction: computeProviderStats(rows) and deduplicateByProvider(rows) called by query handlers; tested directly in test files"

requirements-completed: [GW-08, GW-09, GW-10]

# Metrics
duration: 15min
completed: 2026-05-22
---

# Phase 68 Plan 01: Gateway Observability Backend Summary

**Three Convex tables (gatewayTasks, gatewayQuotaSnapshots, routingDecisions) with CRUD/query/action service files, a 5-minute quota-polling cron, and 15 passing unit tests via extracted pure helpers**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-22T11:00:00Z
- **Completed:** 2026-05-22T11:10:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added 3 new Convex table definitions to schema.ts with full index coverage (by_taskId, by_provider, by_status, by_fallback, by_timestamp)
- Created gatewayTasks.ts with upsert (merge lifecycle), listPaginated, and providerStats exports
- Created gatewayQuota.ts with pollAndStore internalAction (fetches /quota from Astridr), insertSnapshot internalMutation, and latestByProvider query
- Created routingDecisions.ts with insert mutation and listPaginated query
- Registered poll-gateway-quota cron (every 5 minutes) in crons.ts
- Wrote 15 unit tests across 3 test files testing pure logic helpers (all green)

## Task Commits

1. **Task 1: Schema tables + cron + backend service files** - `0d3c7db` (feat)
2. **Task 2: Wave 0 test stubs** - `55d0b5c` (test)

## Files Created/Modified
- `convex/schema.ts` - Added gatewayTasks, gatewayQuotaSnapshots, routingDecisions table definitions
- `convex/crons.ts` - Added poll-gateway-quota interval cron entry
- `convex/gatewayTasks.ts` - upsert mutation, listPaginated query, providerStats query + computeProviderStats helper
- `convex/gatewayQuota.ts` - pollAndStore internalAction, insertSnapshot internalMutation, latestByProvider query + deduplicateByProvider helper
- `convex/routingDecisions.ts` - insert mutation, listPaginated query
- `convex/gatewayTasks.test.ts` - 6 tests for upsert lifecycle and providerStats computation
- `convex/gatewayQuota.test.ts` - 5 tests for insertSnapshot args shape and deduplicateByProvider logic
- `convex/routingDecisions.test.ts` - 4 tests for insert args, boolean enforcement, ordering contract

## Decisions Made
- Extracted computeProviderStats and deduplicateByProvider as exported pure functions so tests can call them directly without Convex ctx mocking — follows the pattern established in convex/__tests__/otelLogs.test.ts
- Used process.env for Convex action env vars (ASTRIDR_API_URL, ASTRIDR_API_KEY) — import.meta.env.VITE_* vars are undefined in Convex action runtime
- T-68-01 enforced: pollAndStore logs only response status codes, never the API key value

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest needed to be run from the worktree directory (not the main codepulse repo root) since the worktree has its own working directory context — discovered during test verification, resolved immediately.

## User Setup Required
The gateway quota polling cron requires two Convex environment variables to be set before it can function:

```
npx convex env set ASTRIDR_API_URL http://localhost:8181
npx convex env set ASTRIDR_API_KEY <your-astridr-api-key>
```

Without these, pollAndStore logs a warning and returns early — no crash, no data written.

## Next Phase Readiness
- All 3 schema tables defined and indexed; backend service files export all required mutations/queries/actions
- Ready for Phase 68 Plan 02 UI components to consume gatewayTasks, gatewayQuota, and routingDecisions via Convex queries
- No blockers

---
*Phase: 68-gateway-observability*
*Completed: 2026-05-22*
