---
quick_id: 260629-pcy
slug: hive-task-agent-link
status: complete
date: 2026-06-29
code_commit: b7b8e84
---

# Quick Task 260629-pcy — Summary

**Done:** Wired Hive into the cross-graph web. A swarm task's agent now
deep-links to that agent on the Code/Vault graph — the previously-deferred
"Hive has no consumer" gap is closed (the task panel IS the consumer/source).

## Changes
- `src/components/SwarmTaskDetail.tsx` — added `onAgentNav?: (agent) => void`;
  the "Agent" tile renders as a clickable button (with ExternalLink) when the
  handler is present, else plain text. Reads the existing
  `agent = agentId || claimedBy`.
- `src/pages/HivePage.tsx` — injects `onAgentNav` →
  `navigate(buildFocusUrl({surface:"graphs", nodeId: agent}, "/hive"))`.
- `src/components/SwarmTaskDetail.test.tsx` — +2: agent click calls onAgentNav;
  plain text (no button) when handler absent.

## Verification
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → **1493 passed, 0 failed** (+2).

## Result
Click a swarm task → click its agent → focus that agent on the Code/Vault
graph, with a "← Back" chip. Hive is now a source in the cross-graph web with
zero new infra (reuses `buildFocusUrl` + the existing `graphs` FocusTarget).

## Out of scope / deferred
- Inbound **agent → Hive** (`/hive?goal=` focus) — the bigger, speculative
  half; deferred unless a use case appears.
- Branch: `quick/260629-hive-task-agent-link`.
