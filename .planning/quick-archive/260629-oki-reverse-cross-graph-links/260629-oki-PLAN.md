---
quick_id: 260629-oki
slug: reverse-cross-graph-links
description: Add reverse/bidirectional cross-graph deep-links (agent→tools, KG entity→owning agent) to complete Phase 85's round-trip
status: complete
date: 2026-06-29
mode: quick
---

# Quick Task 260629-oki: Reverse cross-graph deep-links

## Context
Phase 85 (GH-04) shipped the forward chain **tool → agent → KG entity** via
`src/lib/focus-url.ts` (`buildFocusUrl`, `FocusTarget`) + `useFocusParam`, wired
into CodeVaultGraph, ToolGalaxy, KnowledgeGraph. The reverse direction was
explicitly deferred (Phase 85 D-03). This adds the two reverse links to close
the round-trip, **reusing the existing infra** (no `FocusTarget` or backend
changes — both targets `graphs`/`tool-galaxy` already exist; the data is
already present client-side).

## Feasibility (verified)
- **agent → tools:** `agent-tool` edges already exist; forward link filters by
  `target===tool`, reverse filters by `source===agent`. Same `graph.links`.
- **KG entity → owning agent:** normalized `KgNode.agentId` (kg-graph.ts:43,
  passthrough :182) carries the owning agent. No Ástríðr change.

## Tasks

### Task 1 — agent → tools (ToolGalaxy)
- **files:** `src/pages/ToolGalaxy.tsx`
- **action:** Add an `agentTools` memo (when `selectedNode.kind === "agent"`,
  filter `agent-tool` links by `source===selectedNode.id`, resolve to tool
  nodes, sort by name). Generalize the "RELATED ACROSS GRAPHS" panel section to
  render for `ownerMatch || firstTool`; add an "N tools →" link-row (jump-to-
  first, mirroring the forward "Owning agent" button) navigating via
  `buildFocusUrl({surface:"tool-galaxy", nodeId: firstTool.id}, fromGalaxyUrl)`.
- **verify:** tsc clean; agent node panel shows the tools link.

### Task 2 — KG entity → owning agent (KnowledgeGraph + KGDetailsPanel)
- **files:** `src/components/kg/KGDetailsPanel.tsx`, `src/pages/KnowledgeGraph.tsx`
- **action:** Add `onAgentNav?: (agentId, entityName) => void` to KGDetailsPanel;
  in the entity branch render a "Related across graphs" section with an "Owning
  agent →" button when `node.agentId && onAgentNav`. Wire `onAgentNav` at both
  KnowledgeGraph render sites (725, 971) to
  `navigate(buildFocusUrl({surface:"graphs", nodeId: agentId}, "/knowledge-graph?focus=<entity>&lens=entity&hops=1"))`.
- **verify:** tsc clean; entity panel with agentId shows the owning-agent link.

### Task 3 — Tests
- **files:** `src/components/kg/KGDetailsPanel.test.tsx`, `src/pages/ToolGalaxy.test.tsx`
- **action:** KGDetailsPanel: entity with `agentId` renders the link and clicking
  calls `onAgentNav(agentId, name)`. ToolGalaxy: selecting an agent node (via the
  captured force-graph `onNodeClick`) shows the "N tools →" reverse link.
- **verify:** `npx vitest run` green; `npx tsc --noEmit` clean.

## Out of scope
- Extending deep-links to Capabilities / Memory / Hive surfaces.
- Any Ástríðr backend change. The return ("← Back") chip is already handled by
  `useFocusParam`'s `fromParam`.
