---
phase: 79-forge-ui-tab-read-only-render
plan: "03"
subsystem: forge-ui
tags: [page, routing, nav, master-detail, selection, error-boundary, tdd]
dependency_graph:
  requires:
    - src/hooks/useForge.ts
    - src/components/forge/ForgeJobList.tsx
    - src/components/forge/ForgeJobDetail.tsx
    - src/components/GlassPanel.tsx
    - src/components/SectionErrorBoundary.tsx
  provides:
    - ForgePage
    - /forge route
    - Forge CONSOLE nav entry
  affects:
    - src/App.tsx
    - src/layouts/DashboardLayout.tsx
tech_stack:
  added: []
  patterns:
    - lazy-route
    - master-detail-pair-selection
    - section-error-boundary
    - useForgeJobsRaw-loading-distinction
key_files:
  created:
    - src/pages/ForgePage.tsx
    - src/pages/ForgePage.test.tsx
  modified:
    - src/App.tsx
    - src/layouts/DashboardLayout.tsx
decisions:
  - "useForgeJobsRaw() drives the isLoading flag (undefined=loading, []=empty); useForgeJobs() coalesces to [] for the jobs list"
  - "selectedJob derived entirely from the already-loaded listJobs row — no getJob round-trip"
  - "GlassPanel wraps the master-detail body row (not the individual panels) with flex-1 flex overflow-hidden min-h-0"
  - "Flame icon chosen for Forge nav (confirmed present in lucide-react ^1.8.0; no collision with hammer/Build per D-06)"
metrics:
  duration: "12m"
  completed_date: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 79 Plan 03: ForgePage Assembly + Route + Nav Summary

**One-liner:** ForgePage master-detail layout assembled from Wave-2 components with pair-selection state and per-region SectionErrorBoundary; wired into App.tsx as a lazy /forge route and DashboardLayout.tsx with a Flame CONSOLE nav entry.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ForgePage master-detail layout + selection + error boundaries | cb46d96 | src/pages/ForgePage.tsx, src/pages/ForgePage.test.tsx |
| 2 | Register /forge route in App.tsx | e128cb7 | src/App.tsx |
| 3 | Forge nav entry + Flame icon in DashboardLayout.tsx | 037293c | src/layouts/DashboardLayout.tsx |

## Verification Results

- `npx vitest run src/pages/ForgePage.test.tsx` — 6/6 tests pass.
- `npx tsc --noEmit` — exits 0 after all three tasks (whole repo).
- `npx vitest run` (full suite) — 91 test files passed, 18 skipped (pre-existing), 0 failures. No regressions introduced.
- D-05/D-06 source proof: `DashboardLayout.tsx:148` contains `{ to: "/forge", label: "Forge", icon: "flame", group: "CONSOLE" }`; `iconComponents` at line 107 contains `flame: Flame`; `Flame` imported at line 62.
- `App.tsx:68` contains `lazy(() => import("./pages/ForgePage"))`; line 90 contains `path="/forge"` with "Loading Forge..." Suspense fallback.
- ForgePage: `export default` at top level; calls `useForgeJobsRaw`; renders `<ForgeJobList` and `<ForgeJobDetail` each inside `<SectionErrorBoundary`; list panel uses `w-[280px]`; `GlassPanel` wraps the master-detail row.
- No `getJob` / `useForgeJob` call in ForgePage (detail renders from the loaded list row).
- `convex/_generated/api.d.ts` pre-existing modification left untouched (not staged in any commit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.hoisted() temporal dead zone in ForgePage.test.tsx**
- **Found during:** Task 1 RED phase (first test run)
- **Issue:** The `vi.hoisted()` callback referenced `jobA`/`jobB` fixture constants that are initialized after the hoisted block runs — causing "Cannot access 'jobA' before initialization" at test startup.
- **Fix:** Changed the hoisted ref to hold `{ raw: undefined }` (a self-contained default value), then set `hookState.raw = [jobA, jobB]` in `beforeEach()` after fixtures are in scope. Pattern consistent with the ToolGalaxy.test.tsx `sources` ref idiom.
- **Files modified:** `src/pages/ForgePage.test.tsx`
- **Commit:** cb46d96 (same task commit; caught during RED before GREEN)

None other — plan executed exactly as written for Tasks 2 and 3.

## Known Stubs

None — ForgePage renders from live `useForgeJobsRaw()` / `useForgeJobs()` data via the Convex subscription established in Wave 1. No hardcoded empty values, no placeholder text, no unconnected data sources. The `useForge` hook wires directly to `api.forge.listJobs`.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `/forge` route is nested inside the existing `<AuthGuard>` + `<DashboardLayout>` block in App.tsx — it inherits the app's existing auth gating (T-79-06 accepted). The nav entry is a static label (T-79-08 accepted). No new packages installed (T-79-SC accepted). All XSS surface is in the Wave-2 components (T-79-07 mitigated there); ForgePage itself renders only static chrome (`<h1>Forge</h1>`) plus the child components.

## Self-Check: PASSED

- `src/pages/ForgePage.tsx` exists and exports `default ForgePage`
- `src/pages/ForgePage.test.tsx` exists with 6 passing tests
- `src/App.tsx` contains `lazy(() => import("./pages/ForgePage"))` and `path="/forge"`
- `src/layouts/DashboardLayout.tsx` contains `flame: Flame` and `to: "/forge"`
- Commits cb46d96, e128cb7, 037293c exist in git log
- `convex/_generated/api.d.ts` modification left untouched (not staged in any commit)
