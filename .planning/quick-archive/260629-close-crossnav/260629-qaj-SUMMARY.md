---
quick_id: 260629-qaj
slug: close-crossnav
status: complete
date: 2026-06-29
code_commit: b0253b3
---

# Quick Task 260629-qaj — Summary

**Done:** Closed out the cross-graph navigation web with two finishers.

## 1. Back-chip labels
Added `/hive → "Hive"` and `/memory → "Memory"` to the three origin-label
functions (`ToolGalaxy.surfaceLabel`, `KnowledgeGraph.originLabel`,
`CodeVaultGraph.returnLabel`). The "← Back to X" chip now names the real origin
surface instead of the generic "previous graph".

## 2. Inbound agent → Hive
- `convex/swarmTasks.ts` — new `goalsByAgent(agentId)` query: distinct goalIds
  an agent participated in (claimed or assigned), newest-first by latest task.
  (Deployed to the dev backend via `npx convex codegen`.)
- `src/pages/HivePage.tsx` — reads `?goal=` and preselects that goal; the
  auto-follow-newest effect now defers to the param (fixed an on-mount race
  where it clobbered the deep-link).
- `src/pages/ToolGalaxy.tsx` — agent panel gains an "N swarm goals → Hive" link
  (alongside the existing "N tools →"), navigating to `/hive?goal=<newest>`.

## Tests
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → **1496 passed, 0 failed** (+3): ToolGalaxy shows the
  swarm-goal link for an agent; new `HivePage.test.tsx` asserts `?goal=`
  preselect + auto-follow fallback.

## Result
The cross-graph web is now fully bidirectional including Hive:
**Hive task → agent (Tool Galaxy) → its tools AND its swarm goals → back to
Hive (goal preselected)**, with correctly-named back chips throughout.

## Out of scope
- Resolve-guard to hide agent links when an agent has no node anywhere — not
  needed (agents reliably exist in Tool Galaxy).
- Branch: `quick/260629-close-crossnav`.
