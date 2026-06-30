---
quick_id: 260629-qaj
slug: close-crossnav
description: Close out cross-nav — back-chip labels for Hive/Memory + inbound agent→Hive deep-link
status: in-progress
date: 2026-06-29
mode: quick
---

# Quick Task 260629-qaj: Close out cross-graph nav

Two pieces to finish the cross-graph web.

## Task 1 — back-chip labels (cosmetic)
- **files:** `src/pages/ToolGalaxy.tsx`, `src/pages/KnowledgeGraph.tsx`,
  `src/components/graph/CodeVaultGraph.tsx`
- **action:** Add `/hive → "Hive"` and `/memory → "Memory"` to the 3 origin-label
  functions so the "← Back to X" chip reads the real surface name instead of the
  generic "previous graph".

## Task 2 — inbound agent → Hive
- **files:** `convex/swarmTasks.ts`, `src/pages/HivePage.tsx`,
  `src/pages/ToolGalaxy.tsx`
- **action:**
  - New Convex query `goalsByAgent(agentId)` → distinct goalIds the agent
    participated in (claimed/assigned), newest-first.
  - `HivePage` reads `?goal=` and preselects that goal (takes precedence over
    the auto-follow-newest).
  - Tool Galaxy agent panel gains an "N swarm goals → Hive" link →
    `/hive?goal=<newest>`.
- **verify:** `npx tsc --noEmit`; `npx vitest run`. Tests: ToolGalaxy shows the
  swarm-goal link for an agent; HivePage preselects `?goal=` and auto-follows
  without it.

## Result
Cross-graph web is fully bidirectional including Hive: Hive task → agent (Tool
Galaxy) → its tools AND its swarm goals → back to Hive (goal preselected).
Back-chips name their origin surface.

## Out of scope
Resolve-guard to hide agent links when an agent has no node anywhere (agents
reliably exist in Tool Galaxy, so not needed).
