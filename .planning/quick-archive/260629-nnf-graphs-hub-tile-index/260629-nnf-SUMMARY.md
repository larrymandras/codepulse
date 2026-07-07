---
quick_id: 260629-nnf
slug: graphs-hub-tile-index
status: complete
date: 2026-06-29
code_commit: 2d9df13
---

# Quick Task 260629-nnf — Summary

**Done:** Completed the `/graphs` Unified Graph Hub tile index by adding the 3
graph surfaces that had shipped since v8.0 but were never linked from the hub.

## Changes

- `src/pages/GraphsHub.tsx` — added 3 tile sub-components + rendered them in the
  summary grid (now 6 tiles, `md:grid-cols-3` → 2 rows of 3), each wrapped in
  its own `SectionErrorBoundary`. Added imports for `useQuery`, `api`,
  `useCapabilitySummary`, `useGoalList`. Header docstring updated (three → six).
- `src/pages/GraphsHub.test.tsx` — added api mock paths (`registry.summary`,
  `memory.overview`, `swarmTasks.listGoals`); render test now asserts all 6
  labels; +3 navigation tests for the new tiles.

## New tiles

| Tile | Route | Stat source |
|------|-------|-------------|
| CAPABILITIES | `/capabilities` | `useCapabilitySummary()` → `${skills} skills · ${tools} tools` |
| 3D MEMORY GALAXY | `/memory` | `api.memory.overview` → `${total} events · ${agents} agents` |
| HIVE / SWARM | `/hive` | `useGoalList()` → `${goals.length} goals` |

## Verification

- `npx tsc --noEmit` → exit 0.
- `npx vitest run src/pages/GraphsHub.test.tsx` → 7/7 passed (was 4).
- Full suite `npx vitest run` → **1486 passed, 0 failed** (187 todo, 18 skipped).

## Notes / out of scope

- Additive only — hero and existing 3 tiles untouched.
- Deep-link / pre-filtered cross-navigation between surfaces remains a future
  enhancement (was the original HUB-03 stretch goal; tracked separately).
- Branch: `quick/260629-nnf-graphs-hub-tile-index`. Also carries the standalone
  ROADMAP Phase-76 reconciliation commit (`7601ba6`).
