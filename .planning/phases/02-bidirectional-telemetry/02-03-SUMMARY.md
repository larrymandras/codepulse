---
phase: 02-bidirectional-telemetry
plan: "03"
subsystem: frontend-pages
tags:
  - websocket
  - live-updates
  - flash-animation
  - useLiveFlash
  - useLiveState
dependency_graph:
  requires:
    - 02-02 (useLiveState, AstridrWSContext, WSStatusIndicator)
    - src/index.css (live-update-pulse keyframe animation)
  provides:
    - useLiveFlash hook with 1s debounce
    - All 11 event-driven pages wired to WS live updates
    - Flash animation on all WS-updated containers
  affects:
    - src/pages/Security.tsx
    - src/pages/Executions.tsx
    - src/pages/Agents.tsx
    - src/pages/Dashboard.tsx
    - src/pages/Infrastructure.tsx
    - src/pages/SelfHealing.tsx
    - src/pages/Chat.tsx
    - src/pages/LiveRun.tsx
    - src/pages/Inbox.tsx
    - src/pages/Tasks.tsx
    - src/pages/ConfigEditor.tsx
tech_stack:
  added:
    - useLiveFlash hook (useRef + useCallback, 1s debounce, 620ms class removal)
  patterns:
    - Convex-primary + WS prepend (Security, SelfHealing)
    - Convex-primary + WS overlay counters (Executions, Dashboard)
    - useLiveState for transient status (Agents, Dashboard)
    - WS-only transient status (Infrastructure)
    - WS already wired, flash added (Chat, LiveRun, Inbox, Tasks, ConfigEditor)
key_files:
  created:
    - src/hooks/useLiveFlash.ts
    - src/hooks/useLiveFlash.test.ts
  modified:
    - src/pages/Security.tsx
    - src/pages/Executions.tsx
    - src/pages/Agents.tsx
    - src/pages/Dashboard.tsx
    - src/pages/Infrastructure.tsx
    - src/pages/SelfHealing.tsx
    - src/pages/Chat.tsx
    - src/pages/LiveRun.tsx
    - src/pages/Inbox.tsx
    - src/pages/Tasks.tsx
    - src/pages/ConfigEditor.tsx
decisions:
  - useLiveFlash uses wrapper div for flash ref when scroll ref already occupies the container (Chat, LiveRun) — avoids dual-ref complexity
  - Infrastructure WS events (docker_status, mcp_connection) flash the combined health section rather than individual panels — matches WS-only merge strategy
  - Dashboard subscribes to metric_delta, execution_start, agent_status_change for flash trigger — covers all hero stat update paths
  - SelfHealing wsEvents prepend counts toward Total Events MetricCard overlay immediately before Convex syncs
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-13"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 11
---

# Phase 02 Plan 03: Live Flash Animation and Full Page WS Wiring Summary

**One-liner:** useLiveFlash hook with 1s debounce wired to all 11 event-driven pages, completing Phase 2 bidirectional telemetry with per-widget WS merge strategy and pulse animation.

## What Was Built

### Task 1: useLiveFlash hook + 6 new WS pages (commit `7aa164a`)

**useLiveFlash hook** (`src/hooks/useLiveFlash.ts`):
- `triggerFlash()` adds `live-update-flash` CSS class to `flashRef.current`
- Class removed after 620ms via setTimeout
- 1-second debounce: calls within 1s of last flash are silently ignored (T-02-06 DoS mitigation)
- Force reflow via `el.offsetWidth` ensures animation restarts cleanly on re-trigger

**Test suite** (`src/hooks/useLiveFlash.test.ts`): 4 passing tests with `vi.useFakeTimers()` covering flash add, 620ms removal, debounce blocking, and re-flash after 1s window.

**6 pages wired to WS with per-widget merge strategy:**

| Page | Strategy | WS Events | Section Boundary |
|------|----------|-----------|------------------|
| Security | Convex-primary + WS prepend | security_event, secret_ref_event | "Security Events" |
| Executions | Convex-primary + WS counter overlay | execution_start, execution_complete, execution_error | "Execution Metrics" |
| Agents | useLiveState(['agents']) + Convex profiles | agent_status_change | "Agent Status" |
| Dashboard | useLiveState(['health','executions','agents']) | metric_delta, execution_start, agent_status_change | "Live Metrics" |
| Infrastructure | WS-only transient status | docker_status, mcp_connection | "Infrastructure Health" |
| SelfHealing | Convex-primary + WS prepend | self_healing | "Self-Healing Events" |

All 6 new WS sections wrapped with `SectionErrorBoundary`.

### Task 2: Flash animation for 5 already-wired pages (commit `a2a506d`)

| Page | Trigger | Flash Container |
|------|---------|-----------------|
| Chat | run.text event (existing subscription) | Message list wrapper div |
| LiveRun | run.blocks event (existing subscription) | Timeline scroll area wrapper |
| Inbox | approval_request event (existing subscription) | Card list container |
| Tasks | sendCommand ack (agent.send_task) | Kanban board container |
| ConfigEditor | sendCommand ack (config apply success) | Editor area div |

### Task 3: Visual verification checkpoint

**Status: AWAITING HUMAN VERIFICATION** — requires operator to run `npm run dev` and visually confirm status indicators, ConnectionPopover, and flash animations.

## Deviations from Plan

### Auto-adapted patterns

**1. [Rule 2 - Pattern] Wrapper div for dual-ref pages (Chat, LiveRun)**
- **Found during:** Task 2
- **Issue:** Chat and LiveRun both use `scrollContainerRef` for auto-scroll; assigning `flashRef` to the same element requires dual-ref management.
- **Fix:** Added a parent `div ref={flashRef}` wrapper with `overflow-hidden` around the scroll container. Flash animates the wrapper, scroll behavior unaffected.
- **Files modified:** src/pages/Chat.tsx, src/pages/LiveRun.tsx

None — plan executed as designed for all other aspects.

## Known Stubs

None. All WS subscriptions are wired to real event types. Counter overlays in Executions and Dashboard initialize at 0 and accumulate live deltas from actual WS events. The wsEvents arrays in Security and SelfHealing will be populated when Ástríðr sends matching events.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. All rendered event data uses React JSX auto-escaping (T-02-05 addressed). Flash debounce limits re-render frequency (T-02-06 addressed).

## Test Results

```
Test Files: 14 passed | 6 skipped (20)
Tests:      77 passed | 35 todo (112)
useLiveFlash: 4 passed
```

## Self-Check

- [x] src/hooks/useLiveFlash.ts exists with `export function useLiveFlash`, `live-update-flash`, `1000`
- [x] src/hooks/useLiveFlash.test.ts has 4 real `it(` tests
- [x] All 6 new pages contain `subscribeEvent` or `useLiveState`
- [x] All 6 new pages contain `SectionErrorBoundary`
- [x] All 5 already-wired pages contain `useLiveFlash`/`triggerFlash`
- [x] Commits 7aa164a and a2a506d exist
- [x] TypeScript: only pre-existing errors (useNavCounts.ts, Ideation.tsx) — no new errors
- [x] Full test suite: 77 passed

## Self-Check: PASSED
