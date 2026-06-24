---
phase: 89
plan: "03"
subsystem: frontend-theming
tags: [theming, css-tokens, glow-migration, category-a, TH-01]
dependency_graph:
  requires: [89-02]
  provides: [glow-token-migration-complete]
  affects: [src/components]
tech_stack:
  added: []
  patterns:
    - "shadow-[var(--glow-xs|sm|md|lg)] Tailwind arbitrary value with CSS variable"
    - "Background color=var(--primary) for ReactFlow canvas grid"
key_files:
  created: []
  modified:
    - src/components/ActiveSessions.tsx
    - src/components/AgentTopology.tsx
    - src/components/AlertRulesEngine.tsx
    - src/components/DockerPanel.tsx
    - src/components/DriftTimeline.tsx
    - src/components/EventFeed.tsx
    - src/components/GitActivityWidget.tsx
    - src/components/HeroStatsBar.tsx
    - src/components/OperatorScoreCard.tsx
    - src/components/SwarmTaskNode.tsx
    - src/components/ToolExecutionPanel.tsx
    - src/components/ToolBreakdown.tsx
    - src/components/WarRoomKanbanColumn.tsx
    - src/components/WarRoomTaskCard.tsx
decisions:
  - "SwarmTaskNode verifying/failed/verify_rejected state glows (violet, red) kept as state identity colors — exempt per migration rules"
  - "ToolExecutionPanel success/fail indicator dot glows kept as data-driven status colors (exec.success keyed)"
  - "AgentTopology ReactFlow Background color prop migrated from #10b981 to var(--primary) — chrome accent, not identity"
  - "AlertRulesEngine inset active-filter shadow migrated to shadow-[var(--glow-xs)] — removing inset aspect is acceptable for theme-awareness"
  - "OperatorScoreCard var(--primary, #10b981) token-with-fallback preserved per Pitfall 6"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-24T18:43:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 14
---

# Phase 89 Plan 03: Glow/Shadow Token Migration (Category A, 14 Components) Summary

Migrated all hardcoded Tailwind arbitrary glow/shadow literals in 14 top-level `src/components/*.tsx` files to `var(--glow-*)` CSS variable tokens. Glow is now theme-aware: `none` in Readable Dark, plum in Aubergine, cyan/emerald in existing themes.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate 7 dashboard/agent/alert/docker components | 8c82e76 | ActiveSessions, AgentTopology, AlertRulesEngine, DockerPanel, DriftTimeline, EventFeed, GitActivityWidget |
| 2 | Migrate 7 hero/score/swarm/tool/war-room components | d7cde54 | HeroStatsBar, OperatorScoreCard, SwarmTaskNode, ToolExecutionPanel, ToolBreakdown, WarRoomKanbanColumn, WarRoomTaskCard |
| 3 | Build + leftover-scan gate | ac1c5d1 | (verification only — no files) |

## Migration Summary

**Pattern applied across all 14 files:**

| Before | After | Rule |
|--------|-------|------|
| `shadow-[0_0_15px_rgba(16,185,129,0.05)]` | `shadow-[var(--glow-xs)]` | xs (low opacity ~0.05) |
| `hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]` | `hover:shadow-[var(--glow-sm)]` | sm (medium opacity ~0.2) |
| `hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]` | `hover:shadow-[var(--glow-sm)]` | sm |
| `shadow-[0_0_30px_rgba(16,185,129,0.2)]` | `shadow-[var(--glow-md)]` | md (drop-target emphasis) |
| `shadow-[0_4px_24px_rgba(6,182,212,0.25)]` | `shadow-[var(--glow-md)]` | md (running state) |
| `shadow-[0_0_8px_rgba(16,185,129,0.4)]` | `shadow-[var(--glow-xs)]` | xs |
| `shadow-[0_0_15px_rgba(16,185,129,0.3)]` | `shadow-[var(--glow-sm)]` | sm |
| `drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]` | `drop-shadow-[var(--glow-sm)]` | sm |
| `shadow-[inset_0_0_10px_rgba(16,185,129,0.2)]` | `shadow-[var(--glow-xs)]` | xs (inset dropped, theme-aware preserved) |

**ReactFlow Background dot:** `color="#10b981"` → `color="var(--primary)"` in AgentTopology.tsx.

## Exempt Remainders (Documented Identity Colors)

| File | Line | Value | Reason |
|------|------|-------|--------|
| `src/components/ToolExecutionPanel.tsx` | 248 | `rgba(16,185,129,0.8)` / `rgba(239,68,68,0.8)` | Data-driven: success=green, failure=red — keyed to `exec.success` boolean |
| `src/components/SwarmTaskNode.tsx` | 66 | `rgba(139,92,246,0.25)` | State identity: `verifying` uses violet — semantic state color |
| `src/components/SwarmTaskNode.tsx` | 68–69 | `rgba(239,68,68,0.25)` | State identity: `failed`/`verify_rejected` use red — semantic state color |

## Deviations from Plan

None — plan executed exactly as written. The three documented exempt remainders were anticipated by the plan's migration rules (data-driven/identity hex exemption).

## Verification Results

- `npx tsc --noEmit`: only pre-existing `Settings.tsx` errors (ScrollArea import missing — not introduced by this plan)
- `npm run build`: exits 0 in 11.57s; Tailwind JIT generates `shadow-[var(--glow-*)]` utilities; `box-shadow: none` resolves cleanly when `--glow-xs: none` (Pitfall 4 confirmed safe)
- grep across all 14 files: zero unmitigated `rgba(6,182,212,...)` or `rgba(16,185,129,...)` glow literals

## Known Stubs

None — this plan is purely mechanical string migrations; no data flows or UI stubs introduced.

## Threat Flags

None — only `className` string changes; no network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- All 14 modified files confirmed in git log (commits 8c82e76, d7cde54)
- Build gate commit ac1c5d1 confirms npm run build exits 0
- Zero chrome-glow leftovers confirmed by grep
