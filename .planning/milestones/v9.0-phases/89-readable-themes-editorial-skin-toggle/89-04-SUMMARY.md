---
phase: 89
plan: 04
subsystem: theme-tokens
tags: [TH-01, glow-migration, hr-components, skills-components, pages]
dependency_graph:
  requires: [89-03]
  provides: [TH-01-complete-component-side]
  affects: [src/components/hr, src/components/skills, src/pages]
tech_stack:
  added: []
  patterns: [tailwind-css-var-arbitrary-values, glow-token-migration]
key_files:
  modified:
    - src/components/hr/CatalogCard.tsx
    - src/components/hr/TeamEditor.tsx
    - src/components/hr/TeamCard.tsx
    - src/components/hr/WizardShell.tsx
    - src/components/hr/detail/DetailConfigTab.tsx
    - src/components/hr/AgentDetailSheet.tsx
    - src/components/hr/AgentCard.tsx
    - src/components/skills/NewSkillsBanner.tsx
    - src/components/skills/CategoryGrid.tsx
    - src/pages/Alerts.tsx
    - src/pages/Dashboard.tsx
    - src/pages/Skills.tsx
    - src/pages/hr/AgentAnalytics.tsx
    - src/pages/hr/Roster.tsx
    - src/pages/hr/Teams.tsx
    - src/pages/hr/Catalog.tsx
decisions:
  - AgentCard amber pending shadow preserved as identity/status color (rgba(245,158,11,...) = --status-warn, not chrome)
  - CategoryGrid COLOR_HEX map left byte-unchanged (EXEMPT identity colors per plan)
  - Analytics.tsx build failure logged as pre-existing (not introduced by this plan); blocked build noted
metrics:
  duration: ~15min
  completed: 2026-06-24
  tasks_completed: 3
  files_modified: 16
---

# Phase 89 Plan 04: HR + Skills Glow/Shadow Token Migration Summary

Completed the Category A glow/shadow migration (TH-01) across 16 HR components, skills components, and page files. All `shadow-[...rgba(16,185,129/6,182,212...)]` chrome glow/shadow literals replaced with `var(--glow-xs|sm|md)` tokens. No data-driven identity colors touched.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate glow/shadow in 7 HR components | b7c9ed0 | CatalogCard, TeamEditor, TeamCard, WizardShell, DetailConfigTab, AgentDetailSheet, AgentCard |
| 2 | Migrate glow/shadow in skills + 7 pages | 6589698 | NewSkillsBanner, CategoryGrid, Alerts, Dashboard, Skills, AgentAnalytics, Roster, Teams, Catalog |
| 3 | Build + leftover-scan gate | a0509d2 | (scan only) |

## Migration Sites by File

**HR Components (Task 1):**
- `CatalogCard.tsx` — 4 sites: card hover shadow, button shadow/hover-shadow, blank card hover shadow, Plus icon drop-shadow
- `TeamEditor.tsx` — 2 sites: available-agents panel hover shadow, team-members inset shadow + hover
- `TeamCard.tsx` — 2 sites: card hover shadow, Launch button shadow/hover-shadow
- `WizardShell.tsx` — 3 sites: pulse dot, Deploy button shadow/hover, Next button shadow/hover
- `DetailConfigTab.tsx` — 3 sites: SectionHeader pulse dot, Save button shadow, Edit Config button shadow/hover
- `AgentDetailSheet.tsx` — 9 sites: SheetContent lateral shadow, 2 action button hover-shadows, 6 TabsTrigger active state shadows
- `AgentCard.tsx` — 1 site: hover shadow on non-pending state (amber pending shadow preserved)

**Skills Components + Pages (Task 2):**
- `NewSkillsBanner.tsx` — 2 sites: banner shadow, pulse dot
- `CategoryGrid.tsx` — 3 sites: active item inset shadow, drop-target inset shadow, active indicator bar shadow; COLOR_HEX EXEMPT
- `Alerts.tsx` — 4 sites: empty-state outer shadow, circle shadow, checkmark drop-shadow, text drop-shadow
- `Dashboard.tsx` — 2 sites: activity chart panel shadow + hover-shadow
- `Skills.tsx` — 2 sites: search input inset shadow, category header pulse dot
- `AgentAnalytics.tsx` — 2 sites: pulse dot, toggle group inset shadow (removed inert zero-opacity form)
- `Roster.tsx` — 3 sites: pulse dot, Onboard Agent button shadow/hover, active-count drop-shadow
- `Teams.tsx` — 2 sites: pulse dot, New Team button shadow/hover
- `Catalog.tsx` — 1 site: pulse dot

## Leftover Scan Results

grep for `rgba(16,185,129` and `rgba(6,182,212` across all 16 files: **zero hits**. Migration complete.

## Deviations from Plan

### Pre-existing Issue (out of scope)

**Analytics.tsx build blocker (pre-existing, not introduced by this plan)**
- `src/pages/Analytics.tsx` line 342 has a syntax error (`Unexpected ")"`) — present in the working tree before this plan executed (file was already modified at `git status` time, 343 lines vs 317 at HEAD)
- `npm run build` fails due to this file, but it is NOT one of the 16 files in this plan
- `tsc --noEmit` also surfaces a pre-existing TS1128 on the same file
- None of our 16 target files contribute any tsc or build errors
- Logged to deferred-items for the operator to fix

### Auto-preserved (by decision)

- `AgentCard.tsx` amber pending shadow `rgba(245,158,11,0.1)` preserved — this is the amber status identity color (`--status-warn`), not emerald/cyan chrome
- `CategoryGrid.tsx` `COLOR_HEX` map (lines 20–25) left byte-unchanged per plan's EXEMPT clause

## Known Stubs

None — this plan is purely className token swaps with no data flow or UI rendering stubs.

## Threat Flags

None — only Tailwind utility strings changed; no data, props, or executable paths altered (T-89-07 accepted, T-89-08 mitigated by leftover scan confirming no `var(--glow-*): none` build failures on our files).

## Self-Check: PASSED

- SUMMARY.md: FOUND at .planning/phases/89-readable-themes-editorial-skin-toggle/89-04-SUMMARY.md
- Task 1 commit b7c9ed0: FOUND
- Task 2 commit 6589698: FOUND
- Task 3 commit a0509d2: FOUND
- Leftover grep across 16 files: zero hits
