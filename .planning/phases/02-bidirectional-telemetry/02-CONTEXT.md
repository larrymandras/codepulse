# Phase 2: Bidirectional Telemetry - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing WebSocket infrastructure (AstridrWSContext from Phase 56/58) into all event-driven dashboard pages, add a useLiveState hook for transient operational state, place connection status indicators in sidebar and header with diagnostic popover, and add auth validation logging. The WebSocket singleton, topic subscriptions, command sender, and auto-reconnect already exist — this phase is about integration, not foundation.

</domain>

<decisions>
## Implementation Decisions

### Widget Real-Time Binding
- **D-01:** All event-driven pages (~8-10 pages matching WebSocket topics: health, security, executions, agents, live-runs) get wired to WebSocket live updates — not just a priority subset
- **D-02:** Claude's Discretion on merge strategy — determine per-widget whether WebSocket-first with Convex fallback or Convex-primary with WS overlay is best, based on data freshness needs
- **D-03:** Subtle pulse animation on widgets when they receive a live WebSocket update — makes real-time feel alive without visual noise. No "LIVE" badges.

### useLiveState Hook Design
- **D-04:** useLiveState manages ALL transient operational state — agent status (idle/running/paused), active run progress, live metric deltas, connection health. One hook with topic-based selectors, not separate hooks per data type
- **D-05:** On WebSocket disconnect, live state clears immediately — show empty/unknown state. Stale real-time data is worse than no data. Prevents operators from acting on outdated status.

### Auth Upgrade Strategy
- **D-06:** Current api_key pattern already satisfies RT-02 — Ástríðr has two-tier CommandAuth (service_key + admin_key) and validates on connect. No JWT upgrade needed for single-operator setup.
- **D-07:** Add connection-level auth validation logging on both sides so failed auth attempts are visible in the dashboard

### Connection Status Placement
- **D-08:** WSStatusIndicator placed in BOTH sidebar footer AND top bar/header — maximum visibility
- **D-09:** Sidebar footer shows dot + label, collapses to dot-only when sidebar collapses
- **D-10:** Clicking status indicator opens a connection details popover showing: URL, connected since, latency, topics subscribed, last event received
- **D-11:** Popover includes a manual reconnect button when disconnected (in addition to auto-reconnect)

### Claude's Discretion
- Per-widget merge strategy (WebSocket-first vs Convex-primary) based on data freshness patterns
- Pulse animation CSS implementation details
- useLiveState internal state management (useReducer vs useState tree)
- Popover component choice and styling within Paperclip design language

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### WebSocket Infrastructure (existing)
- `src/contexts/AstridrWSContext.tsx` — Singleton WebSocket provider with subscribe/subscribeEvent/sendCommand API, topic mapping, auto-reconnect, command queue
- `src/components/WSStatusIndicator.tsx` — 8px status dot component (connected/reconnecting/disconnected)
- `src/hooks/useCommandCatalog.ts` — Working pattern for subscribing to WebSocket events (reference implementation)
- `src/hooks/useCommandDispatch.ts` — Command dispatch hook pattern

### Ástríðr Backend
- `astridr/api/ws_commands.py` — WebSocket command dispatcher with two-tier CommandAuth
- `astridr/engine/bootstrap.py` — WebSocket telemetry initialization, ASTRIDR_WEB_API_KEY handling

### UI Foundation (Phase 1)
- `src/index.css` — oklch token layer, animation keyframes (extend with pulse animation)
- `src/layouts/DashboardLayout.tsx` — Sidebar layout (integration point for status indicator)
- `src/components/MetricCard.tsx` — MetricCard pattern (integration point for live updates)

### Project Context
- `.planning/PROJECT.md` — Project vision, cross-repo constraints
- `.planning/REQUIREMENTS.md` — RT-01 through RT-05 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AstridrWSContext` — Full WebSocket singleton with topic subscriptions, auto-reconnect (5 retries, exponential backoff up to 30s), command queue (max 50), ack timeout (10s)
- `WSStatusIndicator` — Ready to place, just needs import in DashboardLayout
- `useCommandCatalog` — Working pattern for `subscribeEvent` usage with state management and disconnect handling
- `useCommandDispatch` — Working pattern for `sendCommand` usage
- Phase 1 shadcn/ui components (Badge, Tooltip, Separator) — available for popover/status UI

### Established Patterns
- WebSocket event subscription: `subscribeEvent(eventType, callback)` returns cleanup function
- Topic subscription: `subscribe(topic, callback)` for broader topic-level events
- Command sending: `sendCommand({action, ...})` returns Promise<AckResponse>
- Status tracking: `WSStatus` type ("connected" | "reconnecting" | "disconnected")
- Event fan-out: `TOPIC_EVENT_MAP` maps topics to event types, reverse map for routing

### Integration Points
- `DashboardLayout.tsx` sidebar footer — place WSStatusIndicator
- `DashboardLayout.tsx` header area — place secondary status indicator
- All page components using Convex `useQuery` — candidates for WebSocket overlay/enhancement
- `src/hooks/useNavCounts.ts` — Could be enhanced with live count updates

</code_context>

<specifics>
## Specific Ideas

- Pulse animation should be subtle — brief highlight, not attention-grabbing. Similar to the `slide-in-entry` animation from Phase 1 activity feeds but for data updates.
- Connection popover should feel like a diagnostic tool — URL, uptime, latency, topics, last event. Power-user information density matching Paperclip aesthetic.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-bidirectional-telemetry*
*Context gathered: 2026-04-13*
