---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 04
subsystem: ui
tags: [react, react-router, convex, dnd-kit, tasks, mission-control, page-header]

# Dependency graph
requires:
  - phase: 96-01
    provides: "<PageHeader> shared component (text-2xl font-bold text-foreground)"
provides:
  - "Merged Tasks board with By Status (default Kanban) / By Agent segmented views"
  - "?view=agent deep-link, query-param-synced via useSearchParams"
  - "/mission-control redirect to /tasks?view=agent; MissionControl page deleted"
  - "Profiles.tsx and Agents.tsx deleted (dead imports; routes already redirected to /hr/roster)"
  - "Tasks.tsx on typed api.tasks.* (F10); PageHeader migration (F7); max-h-[500px] cap removed (F7)"
affects: [command-palette-drift, ia-restructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "?view=-synced segmented control via useSearchParams, seated in PageHeader actions slot"
    - "Per-agent Convex module (convex/missionControl.ts) reused unchanged when its React page is deleted, avoiding codegen churn"

key-files:
  created:
    - src/pages/__tests__/Tasks.test.tsx
  modified:
    - src/pages/Tasks.tsx
    - src/App.tsx
    - src/pages/MissionControl.tsx (deleted)
    - src/pages/Profiles.tsx (deleted)
    - src/pages/Agents.tsx (deleted)

key-decisions:
  - "By Agent view logic ported verbatim from MissionControl.tsx (agentProfiles + FALLBACK_AGENTS + useRosterAgents role-derivation + useAvatars + reassign drag-drop) rather than redesigned, to minimize risk in the highest-complexity merge of the phase"
  - "convex/missionControl.ts left untouched — only the React page was deleted, per plan D-02, avoiding a Convex codegen/deploy step"
  - "View toggle implemented as a quiet two-button segmented control (not shadcn Tabs) per UI-SPEC's 'must not compete with the board' guidance — accent only on the active segment"

patterns-established:
  - "Segmented view toggle synced to a query param, living in PageHeader's actions slot"

requirements-completed: [F1, D-01, D-02, D-08, F5, F7, F10]

# Metrics
duration: ~25min
completed: 2026-07-13
---

# Phase 96 Plan 04: Merge Mission Control into Tasks Summary

**Merged Tasks + Mission Control into one board with a "By Status"/"By Agent" segmented control (deep-linkable via `?view=agent`), typed `api.tasks.*` (was `anyApi`), migrated to `<PageHeader>`, and deleted three orphaned pages (MissionControl, Profiles, Agents).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-13T10:40Z (approx.)
- **Completed:** 2026-07-13T14:52Z
- **Tasks:** 3 (RED test / merge implementation / orphan deletion + App.tsx wiring)
- **Files modified:** 6 (1 created, 2 modified, 3 deleted)

## Accomplishments
- Single Tasks board now serves both the original Kanban ("By Status", default) and the former Mission Control per-agent grouping ("By Agent"), toggled by a quiet segmented control synced to `?view=` and seated in `<PageHeader>`'s actions slot alongside the WS status indicator
- `Tasks.tsx` swapped from `anyApi.tasks.*` (untyped, `convex/server`) to typed `api.tasks.*` (F10/T-96-04-01) — payload/shape mismatches now fail at compile time instead of runtime
- `/mission-control` now redirects to `/tasks?view=agent`; `MissionControl.tsx`, `Profiles.tsx`, and `Agents.tsx` deleted (D-02/D-08) — `App.tsx`'s three orphan imports removed, `convex/missionControl.ts` left untouched (still consumed by the By Agent view)
- F10 token fix folded in: Analytics Suspense fallback `text-gray-500` → `text-muted-foreground`

## Task Commits

Each task was committed atomically:

1. **Task 1: RED test for merged Tasks board** - `6d54d04` (test)
2. **Task 2: Merge Mission Control into Tasks (view toggle, typed api, header, uncap)** - `6e31389` (feat)
3. **Task 3: Delete orphan pages + wire App.tsx redirects and token fix** - `cf804a3` (feat)

_No separate plan-metadata commit — SUMMARY.md is committed as part of this worktree's final commit per parallel-executor protocol; the orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified
- `src/pages/__tests__/Tasks.test.tsx` - RED→GREEN test encoding the By Status/By Agent contract, deep-link sync, toggle click, and PageHeader typography
- `src/pages/Tasks.tsx` - Merged board: view toggle, typed api, PageHeader, per-agent grouping folded in, height cap removed
- `src/App.tsx` - Removed 3 orphan imports (Profiles, Agents, MissionControl lazy); `/mission-control` now `<Navigate to="/tasks?view=agent" replace />`; Analytics fallback token fix
- `src/pages/MissionControl.tsx` - Deleted (D-02; logic migrated into Tasks.tsx, git history preserves it)
- `src/pages/Profiles.tsx` - Deleted (D-08; dead import, route already redirected to `/hr/roster`)
- `src/pages/Agents.tsx` - Deleted (D-08; dead import, route already redirected to `/hr/roster`)

## Decisions Made
- Ported the By Agent view's data/render logic from `MissionControl.tsx` essentially unchanged (agentProfiles + `FALLBACK_AGENTS` fallback, `useRosterAgents()` for role-string derivation, `useAvatars()`, optimistic drag-drop reassign with rollback) rather than redesigning it, since the plan's `<done>` criterion was "one board, two views" — not a UX rewrite of the agent-grouping behavior.
- Kept `convex/missionControl.ts` fully intact (queries the same `tasks` table) — only its React page was deleted, avoiding any Convex codegen/deploy step, per the plan's explicit instruction.
- Implemented the view toggle as two plain buttons in a quiet pill container (not shadcn `Tabs`) to match UI-SPEC's requirement that the toggle "must not compete with the board for attention" — active segment gets `bg-background text-foreground shadow-sm`, inactive stays `text-muted-foreground`.

## Deviations from Plan

None - plan executed exactly as written. (Two pre-existing dead imports — `Profiles` and `Agents` in `App.tsx` — were already unused before this plan, since both routes redirected to `/hr/roster` rather than rendering the imported components; their removal was already in scope per D-08/F5, not a new discovery.)

## Issues Encountered
- Initial RED test used `element.click()` directly instead of `fireEvent.click()`, which doesn't reliably flush React state updates synchronously in this test environment — switched to `fireEvent.click()` for the toggle-click assertion (test-only fix, no production code affected).
- The worktree had no `node_modules`; created an NTFS junction to the main repo's `node_modules` (`mklink /J`) rather than running a fresh `npm install`, to keep the dependency tree identical to the main checkout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `Tasks.tsx` is now the single source of truth for both status-based and agent-based task views; any future Tasks work (e.g. additional F7 pages migrating to `<PageHeader>`) can use this file as the reference for composing a view-toggle inside `PageHeader`'s `actions` slot.
- `convex/missionControl.ts` remains live and is now exclusively consumed by `Tasks.tsx` — no further Convex changes needed.
- Full test suite green (1716 passed, 0 regressions) and `tsc --noEmit` clean at hand-off.

## Self-Check: PASSED
- FOUND: src/pages/__tests__/Tasks.test.tsx
- FOUND: src/pages/Tasks.tsx (merged board content confirmed via grep: no anyApi, no max-h-[500px], PageHeader present, view=agent present)
- FOUND: src/App.tsx (`/mission-control` → `/tasks?view=agent`; 0 orphan-page references)
- MISSING (expected — deletion targets): src/pages/MissionControl.tsx, src/pages/Profiles.tsx, src/pages/Agents.tsx
- FOUND commit 6d54d04 in `git log --oneline --all`
- FOUND commit 6e31389 in `git log --oneline --all`
- FOUND commit cf804a3 in `git log --oneline --all`

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*
