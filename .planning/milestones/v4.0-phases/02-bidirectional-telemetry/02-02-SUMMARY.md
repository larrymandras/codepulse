---
phase: 02-bidirectional-telemetry
plan: 02
subsystem: frontend
tags:
  - websocket
  - real-time
  - hooks
  - ui-components
  - design-system
dependency_graph:
  requires:
    - 02-01
  provides:
    - useLiveState hook (topic-based real-time state management)
    - ConnectionPopover component (diagnostic connection details)
    - WSStatusIndicator (design system token upgrade)
    - AstridrWSContext reconnect method
  affects:
    - src/layouts/DashboardLayout.tsx
    - src/contexts/AstridrWSContext.tsx
tech_stack:
  added:
    - useReducer pattern for transient WS state
    - performance.now() for ping RTT measurement
  patterns:
    - Topic-based subscription via subscribeEvent
    - CLEAR_ALL on disconnect/reconnecting (D-05, T-02-03)
    - Payload validation before dispatch (T-02-01)
    - Base-URL-only display (T-02-02)
key_files:
  created:
    - src/hooks/useLiveState.ts
    - src/components/ConnectionPopover.tsx
  modified:
    - src/contexts/AstridrWSContext.tsx
    - src/components/WSStatusIndicator.tsx
    - src/hooks/useLiveState.test.ts
    - src/components/ConnectionPopover.test.tsx
    - src/layouts/DashboardLayout.tsx
decisions:
  - Use forceAuthError prop for auth error testing rather than detecting 2-second disconnect heuristic in tests
  - sendCommand({ type: "ping" }) for RTT measurement — error ack still gives valid round-trip time
  - fireEvent (not userEvent) for popover tests since @testing-library/user-event not installed
metrics:
  duration: ~15 minutes
  completed: 2026-04-13
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 5
---

# Phase 02 Plan 02: Core WebSocket State Layer Summary

**One-liner:** useReducer-based useLiveState hook with topic subscriptions, CLEAR_ALL on disconnect, and ConnectionPopover with ping-based RTT latency and design-system token upgrade.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | useLiveState hook + AstridrWSContext reconnect | 7727e2e | src/hooks/useLiveState.ts, src/contexts/AstridrWSContext.tsx |
| 2 | WSStatusIndicator upgrade + ConnectionPopover + DashboardLayout | 3d60366 | src/components/ConnectionPopover.tsx, src/layouts/DashboardLayout.tsx |

## What Was Built

### Task 1: useLiveState hook + reconnect method

**`src/hooks/useLiveState.ts`** — Unified real-time state hook using `useReducer`. Actions: `SET_AGENT_STATUS`, `SET_ACTIVE_RUN`, `SET_METRIC_DELTA`, `SET_CONNECTION_HEALTH`, `CLEAR_ALL`. Topic-based subscription activation: pass `topics: ["agents", "health", "live-runs"]` to enable relevant subscriptions. Stale-data protection: `CLEAR_ALL` dispatched on both "disconnected" and "reconnecting" transitions. Payload validation rejects malformed events before dispatch.

**`src/contexts/AstridrWSContext.tsx`** — Added `reconnect(): void` to `AstridrWSContextValue` interface and Provider value. Implementation closes existing WS (suppressing scheduleRetry), clears retry timer, resets retry count, sets status to "reconnecting", calls `connect()`.

### Task 2: Visual layer + DashboardLayout

**`src/components/WSStatusIndicator.tsx`** — Replaced `bg-green-500`/`bg-yellow-500`/`bg-red-500` with `bg-(--status-ok)`/`bg-(--status-warn)`/`bg-(--status-error)` design system tokens. Label updated from `text-gray-400` to `text-muted-foreground`.

**`src/components/ConnectionPopover.tsx`** — 280px diagnostic popover with 6 rows (URL, Status, Uptime, Latency, Topics, Last event). Ping-based RTT via `sendCommand({ type: "ping" })` with `performance.now()` measurement. Fires on connect and every 30 seconds. Reconnect button visible only when not connected. Auth error display via `forceAuthError` prop. Base URL only displayed (T-02-02 — no api_key leak).

**`src/layouts/DashboardLayout.tsx`** — Sidebar footer: `ConnectionPopover` when expanded, tooltip dot when collapsed. Header: WS status dot adjacent to EStopButton. `useConvexConnectionState` import removed (no longer used for sidebar dot). Both use `--status-ok/warn/error` tokens with `aria-label` attributes.

## Test Results

- `src/hooks/useLiveState.test.ts` — 8/8 tests pass
- `src/components/ConnectionPopover.test.tsx` — 6/6 tests pass
- Total: 14/14 tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @testing-library/user-event not installed**
- **Found during:** Task 2 test implementation
- **Issue:** ConnectionPopover.test.tsx used `userEvent.click()` but the package was not in devDependencies
- **Fix:** Replaced `userEvent.click()` with `fireEvent.click()` from `@testing-library/react` (already installed)
- **Files modified:** src/components/ConnectionPopover.test.tsx

**2. [Rule 1 - Bug] Multiple "Disconnected" text elements**
- **Found during:** Task 2 test run
- **Issue:** `getByText("Disconnected")` threw "found multiple elements" because WSStatusIndicator in the trigger and the status row inside the popover both render "Disconnected"
- **Fix:** Changed to `getAllByText("Disconnected").length >= 1` assertion
- **Files modified:** src/components/ConnectionPopover.test.tsx

## Known Stubs

None — all plan functionality is wired. The `forceAuthError` prop is an explicit testing escape hatch, not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced beyond what the plan's threat model covers. Threat mitigations applied:
- T-02-01: Payload validation in useLiveState before dispatch
- T-02-02: Base URL only in ConnectionPopover (no api_key display)
- T-02-03: CLEAR_ALL on both "disconnected" and "reconnecting"
- T-02-04: Auth error message surfaced via `forceAuthError` prop

## Self-Check

**Files exist:**
- src/hooks/useLiveState.ts — FOUND
- src/components/ConnectionPopover.tsx — FOUND
- src/contexts/AstridrWSContext.tsx — FOUND (reconnect added)
- src/components/WSStatusIndicator.tsx — FOUND (tokens upgraded)
- src/layouts/DashboardLayout.tsx — FOUND (integrated)

**Commits exist:**
- 7727e2e — Task 1 commit
- 3d60366 — Task 2 commit

## Self-Check: PASSED
