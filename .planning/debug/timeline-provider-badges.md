---
status: diagnosed
trigger: "Provider Badges on Session Timeline — tool call events should show colored provider badges on session timeline but no provider badges visible on PostToolUse events"
created: 2026-05-23T00:00:00Z
updated: 2026-05-23T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — ingest.ts never passes `provider` to toolExecutions.insert for PostToolUse events, so all toolExecution records have provider=undefined, so toolExecProviderMap is always empty, so badges never render
test: Traced full data flow from hook dispatch through ingest to DB to frontend query to render
expecting: N/A — root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: Tool call events on the session timeline show colored provider badges (using PROVIDER_COLORS)
actual: No provider badges visible on PostToolUse events in Timeline tab
errors: None reported — visual absence, not a crash
reproduction: Open Timeline tab on any session detail page — PostToolUse events lack provider badges
started: After Phase 69 Plan 04 was supposed to add this feature

## Eliminated

- hypothesis: SessionDetail does not query toolExecutions or pass them to SessionTimeline
  evidence: SessionDetail.tsx line 33-36 queries api.toolExecutions.listBySession; line 141 passes toolExecutions={toolExecutions} to SessionTimeline
  timestamp: 2026-05-23

- hypothesis: SessionTimeline does not accept or use toolExecutions prop
  evidence: SessionTimeline.tsx line 8-12 defines toolExecutions as optional prop; line 29 destructures it; lines 46-70 build toolExecProviderMap and getEventProvider function; lines 136-150 render Badge
  timestamp: 2026-05-23

- hypothesis: listBySession query missing or broken
  evidence: convex/toolExecutions.ts line 91-100 defines listBySession query with by_session index, returns all records ordered by timestamp asc
  timestamp: 2026-05-23

- hypothesis: PROVIDER_COLORS or Badge not imported
  evidence: SessionTimeline.tsx line 5-6 imports Badge and PROVIDER_COLORS/PROVIDER_DISPLAY_NAMES correctly
  timestamp: 2026-05-23

## Evidence

- timestamp: 2026-05-23
  checked: codepulse-hook.mjs — the Claude Code hook dispatcher
  found: Hook builds ingestBody with sessionId, eventType, toolName, filePath, hookType, payload, timestamp — NO provider field. Claude Code hooks do not provide provider info in their payload.
  implication: The ingest endpoint never receives provider data from hooks

- timestamp: 2026-05-23
  checked: convex/ingest.ts lines 138-147 — PostToolUse handler
  found: toolExecutions.insert is called with sessionId, toolName, durationMs, success, decision, decisionSource, timestamp — NO provider arg passed. The `provider` field from the insert mutation args is never supplied.
  implication: Every toolExecution record created from PostToolUse events has provider=undefined

- timestamp: 2026-05-23
  checked: convex/ingest.ts lines 47-51 — session upsert
  found: Session upsert passes sessionId, cwd, model — NO provider. Sessions created from hook events also lack provider.
  implication: Even a fallback strategy of reading provider from the session would fail for hook-ingested sessions

- timestamp: 2026-05-23
  checked: convex/runtimeIngest.ts — Astridr runtime ingest path
  found: Gateway events (gateway.task_completed, tool_execution case) DO pass provider to toolExecutions.insert. But these are Astridr runtime events, not Claude Code PostToolUse events.
  implication: The provider population logic exists but only for the runtime path, not the build-time hook path

- timestamp: 2026-05-23
  checked: SessionTimeline.tsx lines 46-60 — toolExecProviderMap construction
  found: Map is built by iterating toolExecutions and checking `te.provider && te.toolName`. Since te.provider is always undefined for hook-ingested records, the map is always empty.
  implication: getEventProvider() always returns null, Badge never renders

- timestamp: 2026-05-23
  checked: Claude Code hook documentation (web search)
  found: PostToolUse hook payloads include tool_input, tool_response, session_id, tool_name, hook_event_name — no provider field. Provider is NOT a concept Claude Code hooks expose.
  implication: Provider must be determined by another mechanism — either from session context or from the CLI identity (claude-cli vs codex vs antigravity)

## Resolution

root_cause: The build-time ingest path in convex/ingest.ts never passes `provider` to the toolExecutions.insert mutation when handling PostToolUse events (lines 138-147). The hook dispatcher (codepulse-hook.mjs) also does not include provider in its payload because Claude Code hooks do not expose provider information. As a result, all toolExecution records created from PostToolUse events have provider=undefined, causing the toolExecProviderMap in SessionTimeline to be empty, and badges never render. The fix requires TWO changes: (1) determine the provider (likely from session.provider or a default based on the CLI source, e.g. "claude-cli"), and (2) pass it to the toolExecutions.insert call. Additionally, the session.upsert call in ingest.ts (line 47-51) also omits provider, so session-level provider must also be populated.
fix:
verification:
files_changed: []
