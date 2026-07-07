---
quick_id: 260629-pcy
slug: hive-task-agent-link
description: Wire Hive into the cross-graph web — swarm task → owning agent deep-link
status: complete
date: 2026-06-29
mode: quick
---

# Quick Task 260629-pcy: Hive task → agent cross-graph link

## Context
Earlier I deferred a Hive deep-link as "no consumer." With real swarm data
present (a goal + agent-claimed tasks), the consumer exists: the
`SwarmTaskDetail` panel already resolves `agent = task.agentId || claimedBy`.
This makes that agent a deep-link into the Code/Vault graph — the same
pattern as KG-entity→agent and tool→agent. Hive joins the cross-graph web as
a **source**; no `FocusTarget` change, no `?goal=` param, no speculative infra.

## Task
- **files:** `src/components/SwarmTaskDetail.tsx`, `src/pages/HivePage.tsx`,
  `src/components/SwarmTaskDetail.test.tsx`
- **action:** Add `onAgentNav?: (agent) => void` to SwarmTaskDetail; render the
  "Agent" tile value as a clickable button (with ExternalLink) when provided.
  HivePage injects `onAgentNav` →
  `navigate(buildFocusUrl({surface:"graphs", nodeId: agent}, "/hive"))`.
- **verify:** `npx tsc --noEmit`; `npx vitest run`. Tests: agent click calls
  onAgentNav; plain text (no button) when onAgentNav absent.
- **done:** Click a swarm task → click its agent → focus that agent on the
  Code/Vault graph, with a "← Back" chip.

## Out of scope
- Inbound agent → Hive (`/hive?goal=`) — the bigger, more speculative half;
  deferred unless a use case appears.
