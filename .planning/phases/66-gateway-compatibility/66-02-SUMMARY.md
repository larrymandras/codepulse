---
phase: 66-gateway-compatibility
plan: 02
subsystem: api
tags: [otel, opentelemetry, gateway, provider, routing, convex, ingest]

# Dependency graph
requires:
  - phase: 66-01
    provides: provider field on toolExecutions.insert and sessions.upsert mutations

provides:
  - OTel provider default fallback fixed to 'unknown' (not 'anthropic') in otelLogs.ts and otelMetrics.ts
  - console.warn on missing provider attribute in all 3 OTel ingest locations
  - gateway.task_completed routing to toolExecutions with provider field in otelLogs.ts
  - gateway.task_failed routing to toolExecutions with success=false in otelLogs.ts
  - gateway.task_started routing to toolExecutions in otelLogs.ts
  - gateway.routing_decision routing to events.ingest in otelLogs.ts (Phase 68 placeholder)
  - All 4 gateway event types handled in runtimeIngest.ts (primary CLIGatewayTool data path)
  - 10 passing unit tests for GW-01, GW-02, GW-04 requirements

affects:
  - 66-03
  - 66-04
  - Phase 68 (routingDecisions table — receives gateway.routing_decision events)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gateway provider default: ?? 'unknown' not ?? 'anthropic' for non-attributed OTel events"
    - "console.warn on missing provider: fires at ingest time for observability of misattribution"
    - "gateway:${provider} toolName convention for gateway task events in toolExecutions"
    - "Dual-path routing: both OTel /v1/logs and /runtime-ingest handle gateway.* events"

key-files:
  created: []
  modified:
    - convex/otelLogs.ts
    - convex/otelMetrics.ts
    - convex/runtimeIngest.ts
    - convex/__tests__/otelLogs.test.ts

key-decisions:
  - "Default provider to 'unknown' not 'anthropic' — prevents silent misattribution of non-Claude events to Anthropic"
  - "Handle gateway.* in both otelLogs (OTel path) and runtimeIngest (direct HTTP path) — CLIGatewayTool uses t.send() which goes to /runtime-ingest"
  - "gateway.routing_decision routes to events.ingest with explicit eventType — Phase 68 will add routingDecisions table"
  - "toolName convention gateway:{provider} distinguishes gateway executions from native tool calls in toolExecutions table"

patterns-established:
  - "Provider default pattern: always default to 'unknown', never to a specific provider name"
  - "Dual-path routing: add new event types to both otelLogs and runtimeIngest for complete coverage"

requirements-completed: [GW-01, GW-02, GW-04]

# Metrics
duration: 15min
completed: 2026-05-21
---

# Phase 66 Plan 02: OTel Provider Default Fix + Gateway Event Routing Summary

**OTel provider misattribution eliminated and all 4 gateway event types routed to domain tables via both the OTel /v1/logs and /runtime-ingest data paths**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-21T22:06:00Z
- **Completed:** 2026-05-21T22:21:36Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Eliminated silent Anthropic misattribution: all 3 hardcoded `?? "anthropic"` defaults replaced with `?? "unknown"` plus console.warn
- Added gateway.task_completed, task_failed, task_started, routing_decision routing to otelLogs.ts (OTel path)
- Added the same 4 gateway event types to runtimeIngest.ts (the primary CLIGatewayTool t.send() data path)
- Converted 12 `it.todo` test stubs to 10 passing unit tests covering GW-01, GW-02, and GW-04

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix OTel provider defaults + gateway routing in otelLogs/otelMetrics** - `ad85cdd` (fix)
2. **Task 2: Gateway routing in runtimeIngest + passing OTel tests** - `4290a64` (feat)

## Files Created/Modified
- `convex/otelLogs.ts` - Fixed api_request provider default; added 4 gateway.* switch cases routing to toolExecutions/events.ingest
- `convex/otelMetrics.ts` - Fixed claude_code.cost.usage and claude_code.token.usage provider defaults; added console.warn for both
- `convex/runtimeIngest.ts` - Added 4 gateway.* switch cases (gateway.task_completed, task_failed, task_started, routing_decision)
- `convex/__tests__/otelLogs.test.ts` - Replaced 12 it.todo stubs with 10 passing unit tests

## Decisions Made
- Default provider to `'unknown'` not `'anthropic'` — prevents silent misattribution of non-Claude events to Anthropic (GW-01 core fix)
- Handle gateway events in both otelLogs and runtimeIngest — CLIGatewayTool uses t.send() which posts to /runtime-ingest, but OTel path must also handle them for completeness
- `gateway.routing_decision` routes to `events.ingest` with explicit `eventType: "gateway.routing_decision"` — Phase 68 will add a `routingDecisions` table
- toolName convention `gateway:${provider}` distinguishes gateway executions from native Claude tool calls in the toolExecutions table

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiled clean on first attempt, all 10 tests passed on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- GW-01 (provider default fix), GW-02 (gateway routing), and GW-04 (backward compatibility) requirements are now satisfied
- Both data paths (OTel and runtime-ingest) handle all 4 gateway event types
- Phase 66 Plan 03 can proceed: it builds on the provider field now flowing through toolExecutions
- gateway.routing_decision events are landing in events.ingest with correct eventType — Phase 68 routingDecisions table will pick these up

---
*Phase: 66-gateway-compatibility*
*Completed: 2026-05-21*
