---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 05
subsystem: ui
tags: [react, navigation, command-palette]

# Dependency graph
requires: [96-02]
provides:
  - CommandPalette Pages group sourced from the single navItems registry (no more hardcoded NAV_PAGES)
  - Stale /agents and /profiles deep links removed from CommandPalette and HeroStatsBar
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Circular import A (DashboardLayout) -> B (CommandPalette) -> A resolves safely because both sides only read the shared bindings (navItems/iconComponents) inside component render bodies, never at module top level"
    - "Icon string-key resolution: `iconComponents[item.icon] ?? LayoutDashboard` mirrors DashboardLayout's own sidebar fallback"

key-files:
  created: []
  modified:
    - src/components/CommandPalette.tsx
    - src/components/HeroStatsBar.tsx
    - src/components/__tests__/CommandPalette.test.tsx

key-decisions:
  - "Captured `item.to` into a local `const to = item.to` after the `if (!item.to) return null` guard — TypeScript's control-flow narrowing does not persist across the nested `select(() => navigate(item.to))` closure, so tsc rejected `string | undefined` without the local const"
  - "Test suite adds a `vi.mock('react-router-dom', ...)` partial mock replacing only `useNavigate` with a spy (keeping the real `MemoryRouter`), enabling assertions on exact navigation targets (e.g. `/hr/roster`, never `/agents`) rather than only DOM-presence checks"

requirements-completed: [F2]

# Metrics
duration: 6min
completed: 2026-07-13
---

# Phase 96 Plan 05: Command Palette Registry Sourcing Summary

**CommandPalette now imports `navItems`/`iconComponents` from DashboardLayout instead of maintaining a hardcoded, ~15-routes-stale `NAV_PAGES` array, and the stale `/agents`/`/profiles` deep links in CommandPalette and HeroStatsBar now point at `/hr/roster`.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-13T10:40:00-04:00
- **Completed:** 2026-07-13T10:46:16-04:00
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- Deleted the hardcoded `NAV_PAGES` array (26 entries, missing ~15 real routes such as `/forge`, `/hive`, `/skills`, `/quality`, `/doc-comments`, `/channels/whatsapp`, `/graphs`, `/tool-galaxy`, `/mcp-inventory`, `/knowledge-graph`, `/hr/*`) and replaced the Pages `CommandGroup` render with a map over the imported `navItems`, resolving each item's string icon key via `iconComponents[item.icon] ?? LayoutDashboard`
- Removed 20 now-unused lucide icon imports that existed solely to back `NAV_PAGES`
- Fixed the stale `navigate("/agents")` in CommandPalette's Agents entity group and HeroStatsBar's Sessions KPI click handler — both now navigate to `/hr/roster`
- Extended `CommandPalette.test.tsx` with 4 new tests: previously-missing routes now render (`/forge`, `/graphs`, `/hr/roster`), no palette item navigates to stale `/agents`/`/profiles` (verified via a `useNavigate` spy, not just DOM text), icon svg presence per Pages item (Pitfall 1 regression guard), and exact-target navigation assertion for a registry-sourced item

## Task Commits

Each task was committed atomically:

1. **Task 1: Source CommandPalette pages from navItems + iconComponents; fix stale links** - `d0ff45f` (feat)
2. **Task 2: Extend CommandPalette test — coverage + no stale links** - `707606d` (test)

**Plan metadata:** (this commit, per worktree mode — orchestrator merges STATE.md/ROADMAP.md updates)

## Files Created/Modified

- `src/components/CommandPalette.tsx` - Deleted `NAV_PAGES`; imports `{ navItems, iconComponents }` from `../layouts/DashboardLayout`; Pages group maps `navItems` resolving icons via the shared map with `LayoutDashboard` fallback; Agents-group `navigate("/agents")` → `navigate("/hr/roster")`
- `src/components/HeroStatsBar.tsx` - Sessions KPI `onClick: () => navigate("/agents")` → `navigate("/hr/roster")`
- `src/components/__tests__/CommandPalette.test.tsx` - Added `useNavigate` spy mock (partial `react-router-dom` mock preserving real `MemoryRouter`) and 4 new tests per the plan's `<behavior>` spec

## Decisions Made

- TypeScript's control-flow narrowing on `item.to` (after `if (!item.to) return null`) does not survive into the nested `select(() => navigate(item.to))` closure — `npx tsc --noEmit` initially failed with `string | undefined` not assignable to `To`. Fixed by binding `const to = item.to;` immediately after the guard and using `to` in both the `key` and the closure.
- The circular import (`DashboardLayout.tsx` imports `CommandPalette` at line 16; `CommandPalette.tsx` now imports `navItems`/`iconComponents` back from `DashboardLayout`) resolves safely under Vite/Vitest because both consumption sites are inside component render bodies (never at module top level) — by the time either component actually renders, the full module graph has finished evaluating. Verified empirically: all 8 pre-existing tests passed unchanged before the new tests were added, and `npx tsc --noEmit` is clean.
- Test assertions for "no stale link" use a `useNavigate` spy rather than only checking absent DOM text, since a stale link could theoretically exist without a visible "Agents"/"Profiles" label (e.g. an entity-group item still wired to the old route). Clicking the mocked agent entity item and asserting `mockNavigate` was called with `/hr/roster` (and never `/agents`/`/profiles`) closes that gap.

## Deviations from Plan

None — plan executed exactly as written. The `const to = item.to` narrowing fix and the `useNavigate` spy mock are implementation details within the plan's own interface guidance, not scope changes.

## Issues Encountered

None blocking. `npx tsc --noEmit` clean; `npx vitest run src/components/__tests__/CommandPalette.test.tsx` — 12/12 passing (8 pre-existing + 4 new).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CommandPalette and HeroStatsBar no longer reference the stale `/agents` or `/profiles` routes anywhere in this plan's files.
- The Pages group is now a pure derivative of `navItems`/`iconComponents` — any future sidebar route addition/removal (via `navGroups` in `DashboardLayout.tsx`) automatically propagates to the palette with zero manual sync.
- No blockers for dependent plans in this wave.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: src/components/CommandPalette.tsx
- FOUND: src/components/HeroStatsBar.tsx
- FOUND: src/components/__tests__/CommandPalette.test.tsx
- FOUND: .planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-05-SUMMARY.md
- FOUND: d0ff45f (Task 1 commit)
- FOUND: 707606d (Task 2 commit)
