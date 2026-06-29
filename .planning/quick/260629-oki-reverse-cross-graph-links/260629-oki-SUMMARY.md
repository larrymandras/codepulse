---
quick_id: 260629-oki
slug: reverse-cross-graph-links
status: complete
date: 2026-06-29
code_commit: 6cffbae
---

# Quick Task 260629-oki — Summary

**Done:** Closed the GH-04 round-trip by adding the two reverse cross-graph
deep-links Phase 85 deferred (D-03), reusing the existing `focus-url` infra —
no `FocusTarget` or Ástríðr backend changes.

## Changes
- `src/pages/ToolGalaxy.tsx` — added `agentTools` memo (agent node → its tools
  via `agent-tool` edges filtered by `source`); generalized the "RELATED ACROSS
  GRAPHS" panel section to render the forward tool→agent link **or** the new
  reverse "N tools →" agent→tools link (jump-to-first, → `/tool-galaxy?focus=`).
- `src/components/kg/KGDetailsPanel.tsx` — added `onAgentNav` prop + an "Owning
  agent →" link row in the entity branch (reads `KgNode.agentId`); panel stays
  presentational (page builds the focus URL).
- `src/pages/KnowledgeGraph.tsx` — wired `onAgentNav` at both KGDetailsPanel
  render sites → `buildFocusUrl({surface:"graphs", nodeId: agentId}, <kg-from-url>)`.
- Tests: `KGDetailsPanel.test.tsx` (+2: renders/clicks owning-agent link; omits
  when no agentId), `ToolGalaxy.test.tsx` (+1: selecting an agent node shows the
  reverse "N tools →" link).

## Verification
- `npx tsc --noEmit` → exit 0.
- `npx vitest run` → **1489 passed, 0 failed** (187 todo, 18 skipped). +3 tests.

## Result
The chain is now fully bidirectional: tool ⇄ agent ⇄ KG entity. Back-nav ("←
Back to X") was already handled by `useFocusParam`'s `fromParam`.

## Out of scope (unchanged)
- Deep-links for Capabilities / Memory / Hive surfaces.
- Any Ástríðr backend change.
- Branch: `quick/260629-oki-reverse-cross-graph-links`.
