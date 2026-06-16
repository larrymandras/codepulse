---
phase: 79-forge-ui-tab-read-only-render
plan: "01"
subsystem: forge-ui
tags: [hooks, components, badges, tdd, convex]
dependency_graph:
  requires: [convex/forge.ts, api.forge.listJobs]
  provides: [useForgeJobs, useForgeJobsRaw, ForgeJobRow, ForgeStatusBadge, ForgeHostBadge]
  affects: [79-02-PLAN.md, 79-03-PLAN.md]
tech_stack:
  added: []
  patterns: [useQuery-coalesce, tdd-red-green, port-and-reskin, convex-skip-idiom]
key_files:
  created:
    - src/hooks/useForge.ts
    - src/components/forge/ForgeStatusBadge.tsx
    - src/components/forge/ForgeStatusBadge.test.tsx
    - src/components/forge/ForgeHostBadge.tsx
  modified: []
decisions:
  - "JobStatus/JobMode defined inline in useForge.ts — not imported from forge @/types (CodePulse path isolation)"
  - "useForgeJobsRaw() exports pre-coalesce value so pages distinguish loading vs empty"
  - "SVGAnimatedString quirk in jsdom: test uses getAttribute('class') not .className for SVG elements"
  - "ForgeStatusBadge uses Tailwind token classes (not inline style={{}}); no inline hex remaining"
metrics:
  duration: "5m"
  completed_date: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 0
---

# Phase 79 Plan 01: Wave-1 Foundation (Hook + Badges) Summary

**One-liner:** Convex listJobs subscription with ForgeJobRow adapter, 6-status re-skinned CodePulse badge (SC#4 amber≠red preserved), and outline host chip — the typed foundation every downstream P79 component imports.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useForge hook + ForgeJobRow type + adapter | 20a85ef | src/hooks/useForge.ts |
| 2 | ForgeStatusBadge (re-skin) + ported test | cd2d963 | src/components/forge/ForgeStatusBadge.tsx, ForgeStatusBadge.test.tsx |
| 3 | ForgeHostBadge (outline host chip) | 9704f0e | src/components/forge/ForgeHostBadge.tsx |

## Verification Results

- `npx tsc --noEmit` exits 0 (whole repo, all 3 tasks).
- `npx vitest run src/components/forge/ForgeStatusBadge.test.tsx` — 20/20 tests pass.
- `useForge.ts` exports `useForgeJobs`, `useForgeJobsRaw`, `ForgeJobRow`; wraps `api.forge.listJobs` with `{}` (merged-list D-03); omits `logFile`.
- `ForgeStatusBadge.tsx` contains `data-status`, `data-color-scheme`, `bg-amber-900/60` (auth_failed), `bg-red-900/60` (failed) as distinct classes, `animate-spin` gated to running, `KeyRound` from lucide-react, no `style={{`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SVGAnimatedString className test assertion**
- **Found during:** Task 2 — GREEN test run (19/20 passed initially)
- **Issue:** Test used `icon?.className.toContain("animate-spin")` but in jsdom, SVG elements expose `className` as `SVGAnimatedString`, not a plain string. The `containsString` check fails even when the class is present.
- **Fix:** Changed to `icon?.getAttribute("class").toContain("animate-spin")` — accesses the raw string attribute directly, works correctly in jsdom.
- **Files modified:** src/components/forge/ForgeStatusBadge.test.tsx
- **Commit:** cd2d963 (folded into same Task 2 commit)

## Known Stubs

None — this plan creates typed infrastructure and leaf presentational components only. No data sources, no placeholder text, no wired-but-empty props. Downstream plans (79-02, 79-03) will compose these components.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All components render JSX text children only (no `dangerouslySetInnerHTML`, no `eval`). React default-escapes all job-sourced strings. T-79-01 mitigation confirmed.

## Self-Check: PASSED

- `src/hooks/useForge.ts` exists and exports `useForgeJobs`, `useForgeJobsRaw`, `ForgeJobRow`
- `src/components/forge/ForgeStatusBadge.tsx` exists and exports `ForgeStatusBadge`
- `src/components/forge/ForgeStatusBadge.test.tsx` exists with 20 passing tests
- `src/components/forge/ForgeHostBadge.tsx` exists and exports `ForgeHostBadge`
- Commits 20a85ef, cd2d963, 9704f0e exist in git log
- `convex/_generated/api.d.ts` modification left untouched (not staged in any commit)
