---
quick_id: 260629-nnf
slug: graphs-hub-tile-index
description: Complete the Graphs Hub tile index — add Capabilities, 3D Memory Galaxy, and Hive/Swarm tiles
status: complete
date: 2026-06-29
mode: quick
---

# Quick Task 260629-nnf: Complete the Graphs Hub tile index

## Context

The `/graphs` page (`src/pages/GraphsHub.tsx`) was delivered by v8.0 (phases
83/84/85). It currently surfaces **3** summary `MetricCard` tiles — Tool
Galaxy, MCP Inventory, KG Explorer — above the Code/Vault snapshot hero. Since
v8.0, more graph surfaces have shipped (Capabilities, the Phase 91 3D Memory
Galaxy at `/memory`, and the Hive/Swarm graph at `/hive`) but the hub index was
never extended to point at them.

This task adds the 3 missing tiles, following the **exact existing tile
pattern** (small sub-component + Convex hook + `SectionErrorBoundary` +
`MetricCard` with `label`/`value`/`onClick→navigate`). Additive only — the hero
and the existing 3 tiles are untouched.

## Surfaces + data sources (verified against live code)

| New tile | Route | Stat source | Value |
|----------|-------|-------------|-------|
| CAPABILITIES | `/capabilities` | `useCapabilitySummary()` → `{skills, tools}` | `${skills} skills · ${tools} tools` |
| 3D MEMORY GALAXY | `/memory` | `useQuery(api.memory.overview)` → `{total, byAgent}` | `${total} events · ${agents} agents` |
| HIVE / SWARM | `/hive` | `useGoalList()` → `SwarmGoalRow[]` | `${goals.length} goals` |

## Tasks

### Task 1 — Add 3 tiles to GraphsHub
- **files:** `src/pages/GraphsHub.tsx`
- **action:** Add imports (`useQuery` from `convex/react`, `api`,
  `useCapabilitySummary`, `useGoalList`). Add 3 sub-components
  (`CapabilitiesTile`, `MemoryGalaxyTile`, `HiveSwarmTile`) mirroring the
  existing tile components. Render them in the summary grid, each wrapped in its
  own `SectionErrorBoundary`. Grid stays `md:grid-cols-3` (now 2 rows of 3).
- **verify:** `npx tsc --noEmit` clean; 6 tiles render.
- **done:** `/graphs` shows all 6 tiles; clicking each new tile navigates to its route.

### Task 2 — Extend tests
- **files:** `src/pages/GraphsHub.test.tsx`
- **action:** Add the new api paths to the mock (`registry.summary`,
  `memory.overview`, `swarmTasks.listGoals`). Assert all 6 tile labels render;
  add 3 navigation tests for the new tiles.
- **verify:** `npx vitest run src/pages/GraphsHub.test.tsx` green.
- **done:** Tests cover the 3 new tiles + nav; full suite stays green.

## Out of scope
- Hero behavior, existing tile behavior, new graph pages themselves.
- Deep-link / pre-filtered cross-navigation (a separate future enhancement).
