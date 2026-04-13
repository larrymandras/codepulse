---
status: partial
phase: 02-bidirectional-telemetry
source: [02-VERIFICATION.md]
started: 2026-04-13T00:00:00Z
updated: 2026-04-13T15:31:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. RT-01 — Dashboard widgets update within 1s of Astrid events
expected: When Astrid emits agent_status_change, metric_delta, or execution_start events, Dashboard hero stat cards update within 1 second
result: [pending]

### 2. RT-05 — Critical events arrive within 500ms
expected: Critical security or system events from Astrid arrive and display on the Security/SelfHealing pages within 500ms of emission
result: [pending]

### 3. RT-07 — Live run transcript streams without batching delay
expected: During an active agent run, the LiveRun page streams transcript lines in real-time without visible batching or chunking delay
result: [pending]

### 4. Sidebar footer status indicator
expected: Colored status dot + "Connected"/"Disconnected" label visible in sidebar footer. Click opens ConnectionPopover with CONNECTION DETAILS (URL, Status, Uptime, Latency, Topics, Last event)
result: passed (2026-04-13) — popover opens with all fields: URL, Status, Uptime, Latency, Topics, Last event. Reconnect button present.

### 5. Header status indicator
expected: Small colored status dot visible near E-Stop button in header
result: [pending]

### 6. Collapsed sidebar behavior
expected: When sidebar is collapsed, status shows as dot-only. Hover shows tooltip with connection status
result: [pending]

### 7. Disconnected state
expected: When Astrid is NOT running — red/salmon dot, "Disconnected" label, "Reconnect" button appears in popover
result: passed (2026-04-13) — red dot visible, "Reconnecting..." shown during attempt, falls back to "Disconnected" when Astrid not running. Reconnect button functional.

### 8. Flash animation on WS events
expected: When Astrid IS running, navigate to Agents, Security, Dashboard — subtle pulse animation fires on incoming WS events
result: [pending]

### 9. All 11 pages wired
expected: Security, Executions, Agents, Dashboard, Infrastructure, SelfHealing, Chat, LiveRun, Inbox, Tasks, ConfigEditor all respond to relevant WS events with flash animation
result: [pending]

## Summary

total: 9
passed: 2
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
