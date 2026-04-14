---
phase: 02-bidirectional-telemetry
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/components/ConnectionPopover.test.tsx
  - src/components/ConnectionPopover.tsx
  - src/components/WSStatusIndicator.tsx
  - src/components/ui/popover.tsx
  - src/contexts/AstridrWSContext.tsx
  - src/hooks/useLiveFlash.test.ts
  - src/hooks/useLiveFlash.ts
  - src/hooks/useLiveState.test.ts
  - src/hooks/useLiveState.ts
  - src/index.css
  - src/layouts/DashboardLayout.tsx
  - src/pages/Agents.tsx
  - src/pages/Chat.tsx
  - src/pages/ConfigEditor.tsx
  - src/pages/Dashboard.tsx
  - src/pages/Executions.tsx
  - src/pages/Inbox.tsx
  - src/pages/Infrastructure.tsx
  - src/pages/LiveRun.tsx
  - src/pages/Security.tsx
  - src/pages/SelfHealing.tsx
  - src/pages/Tasks.tsx
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This phase delivers the bidirectional WebSocket telemetry layer: `AstridrWSContext`, the `useLiveState` and `useLiveFlash` hooks, the `ConnectionPopover` and `WSStatusIndicator` components, and integration of live data into all major pages. The architecture is sound — one shared connection, stable `useRef`-based subscription maps, a per-command ack/timeout loop, and clean separation between topic-level and event-level routing.

Five warnings require attention before this ships. None are security vulnerabilities. The most significant correctness risks are: (1) the `handleApprove`/`handleReject` handlers in Inbox.tsx drop exceptions silently, leaving the user with no feedback on network failure; (2) Executions.tsx accumulates live deltas without a reset on disconnect/reconnect, causing stale counter drift after a reconnect; (3) a Tailwind v4 CSS property (`bg-(--status-error)/10`) is syntactically unsupported and will silently produce no background color. Five info-level items flag `any` casts, dead state, and a minor duplicated event-subscription pattern.

---

## Warnings

### WR-01: Inbox approval/reject handlers swallow network exceptions — user gets no failure feedback

**File:** `src/pages/Inbox.tsx:154-175` and `178-198`

**Issue:** `handleApprove` and `handleReject` both `await sendCommand(...)` without a `try/catch`. If the WebSocket times out or the command queue is full, `sendCommand` rejects with an `Error`. An uncaught rejection in an `async` callback will be swallowed silently (no toast, no state change). The user clicks "Approve" and nothing happens.

**Fix:**
```tsx
const handleApprove = useCallback(async (requestId: string) => {
  try {
    const ack = await sendCommand({
      type: "approval.respond",
      request_id_target: requestId,
      decision: "approve",
    });
    if (ack.status !== "ok") {
      toast.error(ack.error ?? "Approval failed");
      return;
    }
    toast.success("Approval sent.");
    setApprovalItems((prev) =>
      prev.map((item) =>
        item.requestId === requestId ? { ...item, read: true } : item
      )
    );
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Approval request failed");
  }
}, [sendCommand]);
```
Apply the same pattern to `handleReject`.

---

### WR-02: Execution delta counters (`wsRunningDelta`, `wsTotalDelta`, `wsFailedDelta`) are never reset on disconnect

**File:** `src/pages/Executions.tsx:26-29`, `58-81`

**Issue:** The three `useState` delta counters accumulate increments on `execution_start` / `execution_complete` / `execution_error` WebSocket events. When the WebSocket disconnects and reconnects, the counters are not cleared. On reconnect the user will see inflated numbers (e.g., Running = 3 when the real value is 0) until the Convex query next refreshes.

**Fix:** Add a `useEffect` that monitors `status` from `useAstridrWS()` and resets deltas on disconnect/reconnect:
```tsx
const { subscribeEvent, status } = useAstridrWS();

useEffect(() => {
  if (status !== "connected") {
    setWsRunningDelta(0);
    setWsFailedDelta(0);
    setWsTotalDelta(0);
  }
}, [status]);
```

---

### WR-03: Tailwind v4 opacity modifier on a CSS-variable color class will silently fail

**File:** `src/pages/ConfigEditor.tsx:282`

**Issue:** The class `bg-(--status-error)/10` uses Tailwind v4's arbitrary-property syntax combined with an opacity modifier. In Tailwind v4, the `/10` opacity modifier is only supported on named color utilities (e.g., `bg-red-500/10`) or `bg-[color]/10`, not on `bg-(--var)/10` CSS-variable shorthand. This will produce no background color at all — the validation error banner will lack its tinted background.

**Fix:** Use an inline style or a valid Tailwind expression:
```tsx
// Option A: inline style (explicit)
style={{ backgroundColor: "oklch(0.65 0.18 27 / 0.10)" }}

// Option B: use an explicit bg-[color/alpha] expression
className="... bg-[oklch(0.65_0.18_27_/_0.10)] ..."
```
Or define a semantic CSS utility in `index.css`:
```css
.bg-status-error-faint { background-color: oklch(0.65 0.18 27 / 0.10); }
```

---

### WR-04: `Agents.tsx` "Running" metric card ignores live WS data despite fetching it

**File:** `src/pages/Agents.tsx:338-343`

**Issue:** The "Running" `MetricCard` has a conditional that evaluates `isLive && liveState.agentStatus === "running" ? counts.running : counts.running` — both branches return the identical value `counts.running`. The live WS state is fetched and subscribed but never applied to the displayed metric, making the WS integration here a no-op.

**Fix:** Decide on the intended behavior and implement it. If the intent is to show a live overlay when the WS reports the agent is running, use the WS status to highlight or annotate the card rather than having a dead conditional:
```tsx
<MetricCard
  label="Running"
  value={counts.running}
  highlight={isLive && liveState.agentStatus === "running"}
/>
```
Or remove the `isLive` / `liveState` imports from this page if the running count already comes from Convex and the WS overlay adds no value here.

---

### WR-05: `ConnectionPopover` uptime timer runs unconditionally — never paused when disconnected

**File:** `src/components/ConnectionPopover.tsx:124-131`

**Issue:** The uptime/relative-timestamp ticker fires `setTick` every second regardless of connection state. When disconnected, `connectedAt` is `null` so `formatUptime` returns `"--"`, but the component still re-renders every second unnecessarily. In a tab left open for hours this is 3,600 wasted re-renders per hour on an already-disconnected component.

This is a minor correctness issue: the reconnect-state uptime display resets correctly, but the always-on timer means `formatRelative(lastEventAt)` keeps updating even when no new events can arrive. If `lastEventAt` shows "2m ago" while disconnected, it will tick forward to "3m ago", "4m ago" etc., implying fresh staleness data is being computed when the connection is down.

**Fix:** Make the interval conditional on having something to show:
```tsx
useEffect(() => {
  uptimeTimerRef.current = setInterval(() => {
    setTick((t) => t + 1);
  }, 1000);
  return () => {
    if (uptimeTimerRef.current) clearInterval(uptimeTimerRef.current);
  };
}, []);
```
This is already the current code — the fix is to gate it: start the ticker only when `status === "connected" || lastEventAt !== null`. When both are false there is nothing time-sensitive to display.

---

## Info

### IN-01: `any` cast used for Convex id in `markNotificationRead`

**File:** `src/pages/Inbox.tsx:208`

**Issue:** `void markNotificationRead({ id: id as any })` explicitly escapes the type system to call a Convex mutation with an unvalidated id. If `id` is an approval or alert id (not a Convex `notifications` id), the Convex function will reject it at runtime, which is correctly caught and ignored — but the `any` cast sidesteps static safety checks. A comment acknowledges this, but the cast is wider than needed.

**Fix:** Either narrow to `Id<"notifications">` using a guard, or use `as Id<"notifications">` which at least documents intent while still not coercing a mismatched id at runtime:
```tsx
void markNotificationRead({ id: id as Id<"notifications"> });
```
Import `Id` from `convex/values` or the generated types.

---

### IN-02: `Security.tsx` uses `any` in two places for typed data

**File:** `src/pages/Security.tsx:53`, `284`

**Issue:** `filteredEvents` is typed via `(e: any) => e.severity === severityFilter` and the violations map iterates `(v: any, i: number)`. The WS event type `WsSecurityEvent` is already defined on line 31. The Convex violation records should also have a known shape from the query result.

**Fix:** Replace `any` with the defined types. For `filteredEvents`, the union of `WsSecurityEvent` and the Convex events should be narrowed or a shared interface defined. For violations, inspect the Convex table type and use it directly.

---

### IN-03: `_lastDockerStatus` and `_lastMcpStatus` in Infrastructure.tsx are set but never read

**File:** `src/pages/Infrastructure.tsx:34-35`

**Issue:** Both state variables are prefixed with `_` to suppress lint warnings about unused values, but they are accumulated from WS events and never used in the render path. The comment says they are a "transient overlay" but no overlay is rendered. This is dead state — the `setLastDockerStatus` / `setLastMcpStatus` calls cause unnecessary re-renders without surfacing any data.

**Fix:** Either remove the state entirely (keep only `triggerFlash()`) or implement the intended overlay display. If these are placeholder-for-future-use, comment that explicitly and remove the `useState` calls until they are needed.

---

### IN-04: `void prev` in ConnectionPopover suppresses a real unused variable

**File:** `src/components/ConnectionPopover.tsx:87`

**Issue:** `void prev;` is used to suppress an "unused variable" warning for the previous status value captured in the `useEffect` dependency. If `prev` is never needed in the effect body, the pattern of capturing it via destructuring just to suppress a warning is misleading — it suggests the previous status was intentionally stored for comparison but then discarded.

**Fix:** Since the effect only needs to react to the current `status` value, restructure to not capture `prevStatusRef.current` into a local variable:
```tsx
useEffect(() => {
  prevStatusRef.current = status;
  if (status === "connected") {
    // ...
  } else {
    // ...
  }
}, [status]);
```

---

### IN-05: Duplicate event subscriptions for the same events across components

**File:** `src/pages/Dashboard.tsx:37-41`, `src/pages/Agents.tsx:189-193`

**Issue:** Both `Dashboard.tsx` and `Agents.tsx` independently subscribe to `agent_status_change` events (Dashboard for flash triggering, Agents for flash triggering). Each component mounting will register two separate callbacks for the same event, which is correct behavior — but the pattern of re-subscribing to the same event types that `useLiveState` already handles (with its own `agent_status_change` subscription on line 100 of `useLiveState.ts`) means the same event triggers three separate callbacks: the `useLiveState` reducer dispatch, the Dashboard flash, and the Agents flash.

This is not a bug, but it adds up. If more pages follow this pattern, each page will register its own flash subscription in addition to the shared `useLiveState` subscription.

**Fix (suggestion):** Consider exposing a `onEvent` callback from `useLiveState` or integrating flash triggering into the hook so pages don't need to maintain a separate `subscribeEvent` call just to trigger a flash alongside what `useLiveState` is already doing.

---

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
