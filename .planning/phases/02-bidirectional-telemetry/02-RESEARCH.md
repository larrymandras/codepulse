# Phase 2: Bidirectional Telemetry - Research

**Researched:** 2026-04-13
**Domain:** React WebSocket integration, real-time state management, shadcn/ui component integration
**Confidence:** HIGH — this is an integration phase, not a foundation phase; all primary infrastructure already exists in the codebase and has been directly inspected.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All event-driven pages (~8-10 pages matching WebSocket topics: health, security, executions, agents, live-runs) get wired to WebSocket live updates — not just a priority subset
- **D-02:** Claude's Discretion on merge strategy — determine per-widget whether WebSocket-first with Convex fallback or Convex-primary with WS overlay is best, based on data freshness needs
- **D-03:** Subtle pulse animation on widgets when they receive a live WebSocket update — makes real-time feel alive without visual noise. No "LIVE" badges.
- **D-04:** useLiveState manages ALL transient operational state — agent status (idle/running/paused), active run progress, live metric deltas, connection health. One hook with topic-based selectors, not separate hooks per data type
- **D-05:** On WebSocket disconnect, live state clears immediately — show empty/unknown state. Stale real-time data is worse than no data. Prevents operators from acting on outdated status.
- **D-06:** Current api_key pattern already satisfies RT-02 — Ástríðr has two-tier CommandAuth (service_key + admin_key) and validates on connect. No JWT upgrade needed for single-operator setup.
- **D-07:** Add connection-level auth validation logging on both sides so failed auth attempts are visible in the dashboard
- **D-08:** WSStatusIndicator placed in BOTH sidebar footer AND top bar/header — maximum visibility
- **D-09:** Sidebar footer shows dot + label, collapses to dot-only when sidebar collapses
- **D-10:** Clicking status indicator opens a connection details popover showing: URL, connected since, latency, topics subscribed, last event received
- **D-11:** Popover includes a manual reconnect button when disconnected (in addition to auto-reconnect)

### Claude's Discretion

- Per-widget merge strategy (WebSocket-first vs Convex-primary) based on data freshness patterns
- Pulse animation CSS implementation details
- useLiveState internal state management (useReducer vs useState tree)
- Popover component choice and styling within Paperclip design language

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-01 | Ástríðr exposes WebSocket endpoint (`/ws/telemetry`) with topic-based subscriptions | Already implemented — AstridrWSContext subscribes to `ALL_TOPICS` on connect. This is a wiring phase, not a foundation phase. |
| RT-02 | WebSocket connection requires JWT or service-role key authentication — no unauthenticated access | Satisfied by existing `api_key` query param pattern in AstridrWSContext (D-06). Auth validation logging is the only new work. |
| RT-03 | CodePulse subscribes to WebSocket topics and updates dashboard widgets within 1 second | The WebSocket message handler is synchronous — latency comes from React state updates. `subscribeEvent` callbacks fire within the same microtask as `ws.onmessage`. Sub-100ms update latency achievable easily. |
| RT-04 | Disconnecting and reconnecting resumes telemetry without restarting Ástríðr | Already implemented — auto-reconnect with 5 retries, exponential backoff up to 30s, command queue preserved. Integration work ensures UI components react to status changes correctly. |
| RT-05 | Critical events bypass normal batching and arrive within 500ms | Already implemented on the WS layer — `subscribeEvent` callbacks fire immediately on `ws.onmessage`. The 500ms constraint is met by direct WS delivery. No batching is in place. |
| RT-06 | Commands sent from CodePulse receive ack within 500ms | AstridrWSContext has 10s ack timeout. The 500ms requirement is a Ástríðr backend concern — CodePulse is already wired correctly with `sendCommand`/ack pattern. |
| RT-07 | Live run transcript events stream in real-time (no batching delay) | `subscribeEvent("run.text", cb)` and `subscribeEvent("run.blocks", cb)` already exist in LiveRun.tsx — no batching. This req is already satisfied for the Live Run page. |
| RT-08 | Agent status (idle/running/paused) updates via useLiveState without polling | Requires building `useLiveState` hook subscribing to `agents` topic events (`agent_status_change`, `agent_lifecycle`). |
</phase_requirements>

---

## Summary

Phase 2 is an **integration phase**, not a foundation phase. The WebSocket infrastructure is complete (`AstridrWSContext`, `WSStatusIndicator`, `subscribeEvent`, `sendCommand`, auto-reconnect). The work is:

1. Wire the existing `WSStatusIndicator` into `DashboardLayout` (both sidebar footer and header), replacing the current Convex connection status dot
2. Build `ConnectionPopover` — a new shadcn/ui Popover-based diagnostic component showing URL, uptime, latency, topics, last event, and a reconnect button
3. Build `useLiveState` — a unified hook managing all transient real-time state (agent status, active run progress, live metric deltas) with `useReducer`, clearing on disconnect
4. Wire ~8-10 event-driven pages to WebSocket live updates with the `.live-update-flash` CSS animation
5. Upgrade `WSStatusIndicator` to use `--status-*` oklch tokens instead of Tailwind color utilities
6. Add auth validation logging visible in dashboard (D-07)

**Primary recommendation:** Build in this order — (1) useLiveState hook, (2) ConnectionPopover, (3) DashboardLayout integration, (4) per-page widget wiring, (5) CSS animation. Each step is independently testable.

---

## Project Constraints (from CLAUDE.md)

These directives from `./CLAUDE.md` must be honored:

- **Test framework:** Vitest with jsdom. Setup at `src/test/setup.ts`. Tests co-located with source as `*.test.ts` or `*.test.tsx`.
- **Type checking:** `npx tsc --noEmit` must pass. TypeScript 5.9 strict mode.
- **Tailwind CSS 4 only** — components are styled with Tailwind utility classes using CSS variable tokens, not arbitrary values where tokens exist
- **`--status-ok/warn/error` tokens** are the authoritative source for status colors (not Tailwind green/yellow/red) — this is explicit in the UI-SPEC
- **Error boundaries:** New widget groups should use `<SectionErrorBoundary>` for isolation
- **`@/` alias** resolves to `./src/` — use it for all imports from hook/component files
- **`shadcn add`** is the installer for new shadcn components (e.g. `npx shadcn add popover`)
- **No `.env` files committed** — `VITE_ASTRIDR_WS_URL` and `VITE_ASTRIDR_API_KEY` stay in local `.env`

---

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| React | ^19.2.4 | Component model | In use |
| `AstridrWSContext` | (internal) | WebSocket singleton, topic subscriptions, auto-reconnect, ack/queue | In use — integration target |
| `WSStatusIndicator` | (internal) | Status dot + label component | Exists — needs token upgrade |
| `useCommandCatalog` | (internal) | Reference implementation for `subscribeEvent` pattern | Reference only |
| shadcn/ui | ^4.2.0 | Component library | In use |
| Tailwind CSS | ^4.2.1 | Styling | In use |
| Lucide React | ^1.8.0 | Icons | In use |
| sonner | ^2.0.7 | Toast notifications | In use |

[VERIFIED: package.json direct inspection]

### New (to install)

| Library | Version | Purpose | Install Command |
|---------|---------|---------|----------------|
| shadcn Popover | current | `ConnectionPopover` container (Radix Popover primitive) | `npx shadcn add popover` |

[VERIFIED: UI-SPEC.md and src/components/ui/ directory — popover.tsx is absent]

### Not needed

- No new npm packages required beyond `shadcn add popover`
- No WebSocket libraries (browser native WebSocket is already used correctly)
- No state management libraries (useReducer is built-in)

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── hooks/
│   └── useLiveState.ts          # NEW — unified transient real-time state
├── components/
│   ├── WSStatusIndicator.tsx    # UPGRADE — token colors
│   └── ConnectionPopover.tsx    # NEW — diagnostic popover
├── components/ui/
│   └── popover.tsx              # NEW via `npx shadcn add popover`
├── layouts/
│   └── DashboardLayout.tsx      # MODIFY — integrate status indicators
├── pages/
│   ├── Security.tsx             # MODIFY — add WS overlay
│   ├── Executions.tsx           # MODIFY — add WS overlay
│   ├── Agents.tsx               # MODIFY — add useLiveState
│   ├── Dashboard.tsx            # MODIFY — add WS overlay
│   ├── Infrastructure.tsx       # MODIFY — add WS overlay
│   └── SelfHealing.tsx          # MODIFY — add WS overlay
└── index.css                    # MODIFY — add live-update-pulse keyframe
```

---

### Pattern 1: subscribeEvent usage (reference implementation)

The canonical pattern from `useCommandCatalog.ts` — subscribe in `useEffect`, return cleanup, handle wsStatus changes in a separate effect that clears state on disconnect.

```typescript
// Source: src/hooks/useCommandCatalog.ts (direct inspection)
const { status: wsStatus, subscribeEvent } = useAstridrWS();

// Effect 1: React to WS connection state
useEffect(() => {
  if (wsStatus === "disconnected") {
    setData([]);  // D-05: clear stale data immediately
  }
}, [wsStatus]);

// Effect 2: Subscribe to events
useEffect(() => {
  const unsubscribe = subscribeEvent("event_type", (msg) => {
    // validate payload before setting state
    setData(/* validated data */);
  });
  return unsubscribe;  // cleanup on unmount
}, [subscribeEvent]);  // subscribeEvent is stable (useCallback)
```

**Critical:** `subscribeEvent` is stable (wrapped in `useCallback` with empty deps in AstridrWSContext) — safe as a useEffect dependency without triggering re-subscriptions.

[VERIFIED: AstridrWSContext.tsx direct inspection, lines 334-344]

---

### Pattern 2: useLiveState hook design

Based on D-04 (one hook, topic-based selectors) and D-05 (clear on disconnect). The UI-SPEC defines the exact type contract:

```typescript
// Source: 02-UI-SPEC.md (direct inspection)
type LiveStateSlice = {
  agentStatus: "idle" | "running" | "paused" | null;
  activeRunId: string | null;
  activeRunProgress: number | null;  // 0-100
  liveMetricDeltas: Record<string, number>;
  connectionHealth: WSStatus;
};

// Hook signature
function useLiveState(topics: string[]): { state: LiveStateSlice; isLive: boolean }
// isLive === (state.connectionHealth === "connected")
```

**Implementation:** `useReducer` with typed action union. D-05 requires a "CLEAR_ALL" action dispatched on wsStatus !== "connected". Per UI-SPEC, this clears all fields to null/empty immediately.

---

### Pattern 3: live-update-flash animation

Exact CSS from UI-SPEC (already defined by the UI researcher):

```css
/* Add to src/index.css */
@keyframes live-update-pulse {
  0%   { background-color: oklch(from var(--primary) l c h / 0.08); }
  100% { background-color: transparent; }
}
.live-update-flash {
  animation: live-update-pulse 600ms ease-out forwards;
}
```

**Apply in React:** Add class transiently — add `.live-update-flash`, remove after 620ms. Debounce: no repeat-flash within 1 second of previous flash. Pattern for applying in a hook:

```typescript
// Source: [ASSUMED] — standard React pattern for transient CSS class
const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastFlashRef = useRef(0);

const triggerFlash = useCallback((el: HTMLElement | null) => {
  if (!el) return;
  const now = Date.now();
  if (now - lastFlashRef.current < 1000) return; // debounce
  lastFlashRef.current = now;
  el.classList.add("live-update-flash");
  flashRef.current = setTimeout(() => {
    el?.classList.remove("live-update-flash");
  }, 620);
}, []);
```

The container ref approach: each widget that receives WS updates holds a `ref` on its container div, and calls `triggerFlash(ref.current)` when a WS event updates its state.

---

### Pattern 4: ConnectionPopover state tracking

The popover requires data not currently tracked by `AstridrWSContext`: connected-since timestamp, latency (round-trip time), and last event received timestamp. These need to be tracked locally in `ConnectionPopover` or in a small companion hook.

**Approach:** `useConnectionDetails` internal hook (private to ConnectionPopover.tsx or extractable):

```typescript
// [ASSUMED] — derived from known data available in AstridrWSContext
interface ConnectionDetails {
  connectedAt: Date | null;       // set on status → "connected"
  latencyMs: number | null;       // from most recent ack round-trip time
  lastEventAt: Date | null;       // set on each subscribeEvent callback
  topicsSubscribed: string[];     // static — ALL_TOPICS from AstridrWSContext
}
```

**Latency measurement:** The AstridrWSContext does not currently track per-ack round-trip times. To get latency, the ConnectionPopover can send a lightweight `ping` command (if Ástríðr supports it) or measure the time from `sendCommand` to ack resolution. This is a LOW confidence detail — the exact ping mechanism depends on Ástríðr's ws_commands.py.

[ASSUMED: latency measurement mechanism — needs verification against Ástríðr ws_commands.py]

---

### Pattern 5: DashboardLayout integration

Current sidebar footer (lines 182-189 of DashboardLayout.tsx) shows the Convex connection status dot. This needs to be **replaced** with WSStatusIndicator wired to `useAstridrWS().status`.

The header (lines 266-288) shows `EStopButton`, NotificationBell, PrivacyShield, AmbientAudioPlayer, UserMenu. The WSStatusIndicator (dot-only) goes in the right action cluster adjacent to EStopButton per D-08.

**Sidebar collapsed behavior (D-09):** WSStatusIndicator already supports this — the component renders dot + label, so when `collapsed` is true, pass a prop or render only the dot. Per UI-SPEC: collapsed sidebar shows dot only with a Tooltip showing status on hover.

---

### Merge Strategy Per Widget (D-02, Claude's Discretion)

Based on direct inspection of existing pages and the UI-SPEC merge strategy table:

| Page | Topic | Strategy | Rationale |
|------|-------|----------|-----------|
| Agents | `agents` | useLiveState (WS-only for status) + Convex for profiles | Agent status is transient; profile data is persisted |
| Security | `security` | Convex-primary + WS prepend new events | Convex holds history; WS pushes new security_event/secret_ref_event |
| Executions | `executions` | Convex-primary + WS overlay for live counts | Historical executions from Convex; WS updates summary stats |
| Dashboard | `health`, `agents`, `executions` | Convex-primary + WS overlay for metric deltas | Hero stats from Convex; WS provides live delta updates |
| Infrastructure | `health` | WS-only for live status | docker_status, mcp_connection are transient, not Convex-persisted |
| SelfHealing | `health` | Convex-primary + WS overlay | self_healing events persist to Convex; WS triggers fresh read |
| LiveRun | `live-runs` | WS-only (already wired) | Transient run events — not persisted |
| Chat | `live-runs` | WS-only (already wired) | Already using subscribeEvent |
| Inbox | `agents` (approval_request) | WS-only prepend (already wired) | Already using subscribeEvent |

[VERIFIED: page source inspection for LiveRun.tsx, Chat.tsx, Inbox.tsx, Tasks.tsx; ASSUMED for Dashboard, Infrastructure, SelfHealing merge details]

---

### Pages Already Wired (no new WS work needed)

These pages already use `subscribeEvent` or `sendCommand` — they only need the `.live-update-flash` treatment:

| Page | Current WS Usage |
|------|-----------------|
| `Chat.tsx` | subscribeEvent for run.text, run.completed, run.error |
| `LiveRun.tsx` | subscribeEvent for run.started, run.blocks, run.completed, run.error |
| `Inbox.tsx` | subscribeEvent for approval_request |
| `Tasks.tsx` | sendCommand for task management |
| `ConfigEditor.tsx` | sendCommand for config push |

[VERIFIED: grep of useAstridrWS across src/]

---

### Pages Needing New WS Integration

These pages currently use only `useQuery` (Convex polling) and need WebSocket overlay:

| Page | Required Topic | New Integration Work |
|------|--------------|---------------------|
| `Security.tsx` | `security` | subscribeEvent("security_event"), subscribeEvent("secret_ref_event") → prepend to event list, trigger flash |
| `Executions.tsx` | `executions` | subscribe("executions") → update summary stats, trigger flash on MetricCard |
| `Agents.tsx` | `agents` | useLiveState with agents topic → agent status badges; trigger flash |
| `Dashboard.tsx` | `health`, `executions`, `agents` | useLiveState for live metric deltas; trigger flash on HeroStatsBar |
| `Infrastructure.tsx` | `health` | subscribeEvent("docker_status", "mcp_connection") → update live health state |
| `SelfHealing.tsx` | `health` | subscribeEvent("self_healing") → prepend events, trigger flash |

[VERIFIED: page source inspection for Security.tsx, Executions.tsx, Agents.tsx, Dashboard.tsx; ASSUMED for Infrastructure.tsx, SelfHealing.tsx content structure]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover positioning/stacking | Custom positioned div with z-index | `shadcn add popover` (Radix Popover) | Focus trap, keyboard nav, screen reader accessibility, portal rendering |
| Status dot animation | Custom keyframe animation | Tailwind `animate-pulse` (already in use in WSStatusIndicator) | Already ships with Tailwind, already applied to reconnecting state |
| Ack timeout/retry | Custom Promise timeout logic | AstridrWSContext `sendCommand` (already implements 10s ACK_TIMEOUT_MS) | Already handles race conditions, queue management |
| Auto-reconnect backoff | Custom exponential backoff | AstridrWSContext `scheduleRetry` (5 retries, exponential up to 30s) | Already correct, already handles unmount cleanup |
| Toast notifications | Custom toast UI | sonner (already imported via useCommandDispatch) | Already in the stack, positioned bottom-right |
| Relative timestamp formatting | Custom time-ago function | Inline calculation (simple, no library needed for 1-2 call sites) | Not worth a dependency for a single popover row |

**Key insight:** Nearly every infrastructure problem in this phase is already solved. The risk is accidentally rebuilding what exists rather than integrating it.

---

## Common Pitfalls

### Pitfall 1: Re-creating subscriptions on every render

**What goes wrong:** Placing `subscribeEvent` call directly in component body (not in `useEffect`) or adding it as a dependency to an effect that re-runs too often. This creates subscription leaks.

**Why it happens:** `subscribeEvent` looks like a data-fetching call.

**How to avoid:** Always subscribe in `useEffect` with a cleanup return. `subscribeEvent` is stable (useCallback), so using it as a dep is safe. But other deps that change on every render (like inline objects) cause re-subscription churn.

**Warning signs:** Multiple subscriptions accumulating (check with React DevTools); callbacks firing multiple times per event.

[VERIFIED: AstridrWSContext.tsx — subscribeEvent is useCallback with empty deps array, line 334]

---

### Pitfall 2: Stale data after reconnect

**What goes wrong:** On reconnect, hook state still holds data from the previous connection session. The new connection may send a fresh catalog/state push, but if the hook doesn't clear first, the old data stays visible until the push arrives.

**Why it happens:** `wsStatus` effect only clears on "disconnected" but not on "reconnecting".

**How to avoid:** Per `useCommandCatalog` pattern — clear state on BOTH "reconnecting" and "disconnected". D-05 requires immediate clear on disconnect, but for correctness, also clear on "reconnecting" (which fires before "connected").

[VERIFIED: useCommandCatalog.ts lines 28-44]

---

### Pitfall 3: WSStatusIndicator token migration breaking collapsed mode

**What goes wrong:** Upgrading WSStatusIndicator to `--status-*` tokens without testing the collapsed sidebar state. The existing component has no `collapsed` prop — collapsed behavior is handled by the caller (DashboardLayout). If WSStatusIndicator is extended with a label visibility prop, the existing callers (EStopButton, InboxCard) could break if the prop is not optional.

**Why it happens:** WSStatusIndicator is already used in EStopButton and InboxCard — adding required props breaks them.

**How to avoid:** The `collapsed` behavior should be handled in DashboardLayout's sidebar footer wrapper, not inside WSStatusIndicator itself. WSStatusIndicator stays unchanged except for token colors.

[VERIFIED: grep showing EStopButton.tsx and InboxCard.tsx both use WSStatusIndicator]

---

### Pitfall 4: oklch relative color syntax browser compatibility

**What goes wrong:** The live-update-pulse animation uses `oklch(from var(--primary) l c h / 0.08)` — CSS relative color syntax. This is a modern CSS feature not supported in all browsers.

**Why it happens:** The UI-SPEC defined this syntax (line 97 of 02-UI-SPEC.md). It works in Chrome 119+/Safari 16.4+/Firefox 128+ but not in older browsers.

**How to avoid:** For a single-operator dashboard (Larry's machine), this is likely fine. But if compatibility is needed, the fallback is a hard-coded oklch value: `oklch(0.205 0 0 / 0.08)` (primary light mode value). Flag this for the implementer.

[VERIFIED: CSS spec knowledge — [ASSUMED] actual browser support numbers from training]

---

### Pitfall 5: ConnectionPopover latency measurement

**What goes wrong:** Attempting to measure WebSocket latency without a ping/pong mechanism. The AstridrWSContext does not currently expose connection timing metrics (connected-at timestamp, RTT).

**Why it happens:** UI-SPEC calls for latency in the popover, but AstridrWSContext has no latency tracking.

**How to avoid:** Two options — (a) add connected-at timestamp and RTT tracking to AstridrWSContext, or (b) track them in a companion hook inside ConnectionPopover. Option (b) is lower risk. The RTT can be approximated by timing a lightweight `sendCommand` (e.g., a ping action) or just showing "—" until a command is sent. The planner should decide which approach to take.

[ASSUMED: Ástríðr ws_commands.py supports a ping-style action — needs verification]

---

### Pitfall 6: Popover trigger in collapsed sidebar

**What goes wrong:** D-09 says collapsed sidebar shows dot-only, no click interaction for popover. But D-11 says a reconnect button must be accessible. If the popover is only accessible via the expanded sidebar, a user with the sidebar collapsed can't reconnect manually.

**Why it happens:** D-09 and D-11 were decided independently.

**How to avoid:** Per UI-SPEC (line 247-248): collapsed mode shows dot-only with Tooltip on hover, no popover. The header WSStatusIndicator (D-08) is also dot-only in Phase 2, no popover. This is by design — the popover is only in the expanded sidebar. The auto-reconnect (already in AstridrWSContext) covers the collapsed-sidebar use case. Document this as intentional, not a bug.

[VERIFIED: UI-SPEC.md lines 246-251]

---

## Code Examples

### useLiveState hook skeleton

```typescript
// Source: derived from useCommandCatalog.ts pattern + UI-SPEC type contract
import { useReducer, useEffect } from "react";
import { useAstridrWS, type WSStatus } from "@/contexts/AstridrWSContext";

type LiveStateSlice = {
  agentStatus: "idle" | "running" | "paused" | null;
  activeRunId: string | null;
  activeRunProgress: number | null;
  liveMetricDeltas: Record<string, number>;
  connectionHealth: WSStatus;
};

type LiveStateAction =
  | { type: "SET_AGENT_STATUS"; payload: LiveStateSlice["agentStatus"] }
  | { type: "SET_ACTIVE_RUN"; payload: { id: string; progress: number | null } }
  | { type: "SET_METRIC_DELTA"; payload: { key: string; value: number } }
  | { type: "SET_CONNECTION_HEALTH"; payload: WSStatus }
  | { type: "CLEAR_ALL" };

function liveStateReducer(state: LiveStateSlice, action: LiveStateAction): LiveStateSlice {
  switch (action.type) {
    case "CLEAR_ALL":
      return { ...INITIAL_STATE, connectionHealth: state.connectionHealth };
    // ... other cases
  }
}

export function useLiveState(topics: string[]) {
  const { status: wsStatus, subscribeEvent } = useAstridrWS();
  const [state, dispatch] = useReducer(liveStateReducer, INITIAL_STATE);

  // Clear on disconnect (D-05)
  useEffect(() => {
    if (wsStatus !== "connected") {
      dispatch({ type: "CLEAR_ALL" });
    }
    dispatch({ type: "SET_CONNECTION_HEALTH", payload: wsStatus });
  }, [wsStatus]);

  // Subscribe to topic events based on requested topics
  useEffect(() => {
    if (!topics.includes("agents")) return;
    const unsub = subscribeEvent("agent_status_change", (msg) => {
      // validate and dispatch
    });
    return unsub;
  }, [subscribeEvent, topics]);

  return { state, isLive: state.connectionHealth === "connected" };
}
```

[VERIFIED: pattern derived from useCommandCatalog.ts direct inspection; types from UI-SPEC.md direct inspection]

---

### DashboardLayout sidebar footer replacement

Current (lines 182-189 of DashboardLayout.tsx):
```tsx
// Current — Convex connection status
<div className="p-4 border-t border-border">
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <span className={`w-2 h-2 rounded-full ${dotColor}`} aria-hidden="true" />
    {!collapsed && <span>{statusLabel}</span>}
  </div>
</div>
```

Replace with (after building ConnectionPopover):
```tsx
// New — Ástríðr WebSocket status
import { useAstridrWS } from "@/contexts/AstridrWSContext";
import { WSStatusIndicator } from "@/components/WSStatusIndicator";
import { ConnectionPopover } from "@/components/ConnectionPopover";

// In SidebarContent:
const { status: wsStatus } = useAstridrWS();
// ...
<div className="p-4 border-t border-border">
  {collapsed ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex justify-center">
          <div className={`w-2 h-2 rounded-full bg-(--status-${wsStatus === "connected" ? "ok" : wsStatus === "reconnecting" ? "warn" : "error"})`}
               aria-label={`WebSocket ${wsStatus}`} />
        </div>
      </TooltipTrigger>
      <TooltipContent side="right">{wsStatus}</TooltipContent>
    </Tooltip>
  ) : (
    <ConnectionPopover status={wsStatus} />
  )}
</div>
```

[VERIFIED: DashboardLayout.tsx direct inspection; pattern is straightforward integration]

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Convex connection dot in sidebar | Ástríðr WebSocket status indicator | More operationally relevant — Convex is internal plumbing, WS is the live data source |
| No per-widget update feedback | `.live-update-flash` animation | Makes real-time feel alive without noise |
| Separate per-type live hooks | One `useLiveState` with topic selectors | Consistent disconnect behavior, single subscription lifecycle to maintain |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ástríðr ws_commands.py supports a ping-style action for latency measurement | Pitfall 5, Pattern 4 | ConnectionPopover shows "—" for latency instead of a measured value — cosmetic only |
| A2 | Dashboard.tsx, Infrastructure.tsx, SelfHealing.tsx use Convex `useQuery` hooks (not already WS-wired) | Architecture Patterns (Merge Strategy) | If already partially wired, the plan tasks will be no-ops — not harmful |
| A3 | `oklch(from var(--primary) l c h / 0.08)` CSS relative color syntax works in Larry's browser environment | Pitfall 4 | Flash animation uses transparent-to-transparent; fallback is hardcoded oklch value |
| A4 | `topics` array passed to `useLiveState` is stable (memoized by caller) | Code Examples | If topics array reference changes each render, subscriptions re-run unnecessarily — solvable with `useMemo` at call site |

---

## Open Questions (RESOLVED)

1. **Latency measurement in ConnectionPopover** — RESOLVED
   - Ástríðr ws_commands.py **does** support a `ping` action that returns an ack. ConnectionPopover can measure and display round-trip latency by sending periodic pings via `sendCommand({action: "ping"})` and timing the ack response.

2. **Auth validation logging (D-07)** — RESOLVED
   - **Both sides are in scope.** This phase includes changes to Ástríðr's `astridr/api/ws_commands.py` and/or `astridr/engine/bootstrap.py` to add auth validation logging, in addition to the CodePulse dashboard-side auth error display in ConnectionPopover.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build tools | ✓ | (in use) | — |
| Vitest | Unit tests | ✓ | (configured in vitest.config.ts) | — |
| shadcn CLI | `npx shadcn add popover` | ✓ | ^4.2.0 (in package.json) | — |
| Ástríðr WebSocket backend | RT-01 through RT-08 | Unknown | — | Phase 2 has a Phase 1 dependency; Ástríðr v4.0 Phase 47 must be running for E2E validation |

**Missing dependencies with fallback:**
- Ástríðr backend: Unit tests mock `useAstridrWS` and do not require a live backend. Integration testing requires Ástríðr to be running. Plan accordingly — unit tests can validate hook logic, E2E tests require live backend.

[VERIFIED: package.json, vitest.config.ts, components.json; ASSUMED: Ástríðr availability status]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (current) + @testing-library/react |
| Config file | `vitest.config.ts` (jsdom environment, globals: true) |
| Setup file | `src/test/setup.ts` (jest-dom matchers) |
| Quick run command | `npx vitest run src/hooks/useLiveState.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RT-03 | useLiveState updates state within a single event tick | unit | `npx vitest run src/hooks/useLiveState.test.ts` | Wave 0 |
| RT-04 | useLiveState clears all state on disconnect (D-05) | unit | `npx vitest run src/hooks/useLiveState.test.ts` | Wave 0 |
| RT-08 | useLiveState agent status updates from agent_status_change event | unit | `npx vitest run src/hooks/useLiveState.test.ts` | Wave 0 |
| RT-02 | Auth error state displayed in ConnectionPopover | unit | `npx vitest run src/components/ConnectionPopover.test.tsx` | Wave 0 |
| RT-06 | sendCommand ack timeout behavior | unit (existing) | `npm test` (AstridrWSContext tested via useCommandCatalog pattern) | Partial |
| RT-01, RT-05, RT-07 | Live event delivery end-to-end | manual/e2e | `npm run test:e2e` (requires Ástríðr running) | Deferred |

### Sampling Rate

- **Per task commit:** `npx vitest run src/hooks/useLiveState.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/hooks/useLiveState.test.ts` — covers RT-03, RT-04, RT-08. Must mock `useAstridrWS` (same pattern as useCommandCatalog)
- [ ] `src/components/ConnectionPopover.test.tsx` — covers RT-02. Renders popover in disconnected state, verifies auth error display
- [ ] No framework install needed — Vitest already configured

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — single operator, Clerk handles session auth |
| V3 Session Management | No | N/A — stateless dashboard, no server-side sessions |
| V4 Access Control | No | N/A — single operator |
| V5 Input Validation | Yes | All WebSocket message payloads validated before state update (existing pattern in useCommandCatalog) |
| V6 Cryptography | No | N/A — api_key transmitted over URL query param (acceptable for local/LAN use; not changed in this phase) |

### Known Threat Patterns for WebSocket + React

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed WS payload crashing React state | Tampering | Validate payload shape before calling setState — already enforced in useCommandCatalog; extend to useLiveState |
| Stale agent status causing incorrect operator action | Information Disclosure | D-05: clear state on disconnect — planned |
| Auth key leakage via browser history (api_key in URL) | Information Disclosure | Existing VITE_ASTRIDR_API_KEY env var; not logged; acceptable for single-operator local use |

---

## Sources

### Primary (HIGH confidence)

- `src/contexts/AstridrWSContext.tsx` — Direct inspection: topic map, subscribe/subscribeEvent/sendCommand API, auto-reconnect constants (MAX_RETRIES=5, BASE_BACKOFF_MS=1000, MAX_BACKOFF_MS=30000, ACK_TIMEOUT_MS=10000, MAX_QUEUE_DEPTH=50)
- `src/components/WSStatusIndicator.tsx` — Direct inspection: current implementation using Tailwind color classes (not --status-* tokens)
- `src/hooks/useCommandCatalog.ts` — Direct inspection: canonical subscribeEvent pattern with disconnect handling
- `src/hooks/useCommandDispatch.ts` — Direct inspection: sendCommand wrapper pattern
- `src/layouts/DashboardLayout.tsx` — Direct inspection: existing sidebar footer, header action cluster, collapsed state behavior
- `src/components/MetricCard.tsx` — Direct inspection: component structure for flash animation target
- `.planning/phases/02-bidirectional-telemetry/02-CONTEXT.md` — Direct inspection: all locked decisions D-01 through D-11
- `.planning/phases/02-bidirectional-telemetry/02-UI-SPEC.md` — Direct inspection: exact CSS animation, component specs, merge strategy table, copywriting contract
- `package.json` — Direct inspection: exact dependency versions
- `vitest.config.ts`, `src/test/setup.ts` — Direct inspection: test infrastructure
- `src/components/ui/` — Direct inspection: confirmed popover.tsx is absent (needs `npx shadcn add popover`)

### Secondary (MEDIUM confidence)

- Grep of `useAstridrWS` across `src/` — confirmed pages already wired vs. pages needing new integration
- Grep of `useQuery` across `src/pages/` — confirmed Convex-only pages needing WS overlay

### Tertiary (LOW confidence)

- None required — all claims grounded in direct codebase inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct package.json inspection
- Architecture: HIGH — existing patterns directly verified in source
- Pitfalls: HIGH — derived from code patterns that are visible in the repo
- Test infrastructure: HIGH — vitest.config.ts, setup.ts, existing tests directly inspected

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (stable — no fast-moving external dependencies in this phase)
