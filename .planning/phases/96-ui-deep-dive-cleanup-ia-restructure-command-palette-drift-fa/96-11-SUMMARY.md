---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 11
subsystem: ui
tags: [react, pageheader, header-standardization, hr, dashboard]

# Dependency graph
requires:
  - phase: 96 (plan 01)
    provides: "src/components/PageHeader.tsx (title/icon/actions API)"
provides:
  - "11 pages migrated from bespoke <h1> headers to the shared <PageHeader> component"
affects: [96-full-header-sweep, future-ui-consistency-audits]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PageHeader actions prop absorbs right-aligned controls AND inline badges/toggles that previously sat next to the title (combined into one flex actions node)"

key-files:
  created: []
  modified:
    - src/pages/hr/Roster.tsx
    - src/pages/hr/Catalog.tsx
    - src/pages/hr/Onboarding.tsx
    - src/pages/hr/Teams.tsx
    - src/pages/hr/AgentAnalytics.tsx
    - src/pages/Dashboard.tsx
    - src/pages/Alerts.tsx
    - src/pages/Briefings.tsx
    - src/pages/Capabilities.tsx
    - src/pages/Settings.tsx
    - src/pages/SelfHealing.tsx

key-decisions:
  - "None of the hr/* pages actually had a leading Lucide icon (they used a decorative pulse-dot <span>, not an icon component) — passed a thematically-relevant already-imported icon (Users for Roster, UsersRound for Teams) where one existed, and omitted the icon prop for Catalog/AgentAnalytics where no icon was imported, preserving exact title text per plan instruction."
  - "Roster and Teams had stat badges positioned next to the title (not truly right-aligned). Combined the stat badge + action buttons into a single actions node so no information was lost, at the cost of the badge now rendering next to the buttons instead of next to the title."
  - "Dropped the mb-6/mb-0 className overrides considered during editing — using PageHeader's default mb-4 spacing everywhere keeps the standardization consistent instead of fighting Tailwind class-order specificity."

requirements-completed: [F7]

# Metrics
duration: 22min
completed: 2026-07-13
---

# Phase 96 Plan 11: Header sweep batch A (11 pages) Summary

**Migrated 11 pages (5 hr/* + Dashboard/Alerts/Briefings/Capabilities/Settings/SelfHealing) from bespoke `<h1>` headers to the shared `<PageHeader>` component, folding stat badges/toggles/search bars into its `actions` prop.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-13T14:28:00Z
- **Completed:** 2026-07-13T14:50:00Z
- **Tasks:** 2 completed
- **Files modified:** 11

## Accomplishments
- All 5 `hr/*` pages (Roster, Catalog, Onboarding, Teams, AgentAnalytics) now render titles via `<PageHeader>` — the uppercase-mono variants are gone and Onboarding gained a header it previously lacked entirely.
- All 6 top-level pages (Dashboard, Alerts, Briefings, Capabilities, Settings, SelfHealing) now render titles via `<PageHeader>` — the `text-2xl font-bold` (missing `text-foreground`) variants are standardized.
- Zero bespoke `<h1>` remains across these 11 files; every page-level right-side control (stat badges, time-window toggle, search input, action buttons) was preserved via the `actions` prop.

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate hr/* headers (5 pages)** - `9eed74d` (feat)
2. **Task 2: Migrate 6 top-level page headers** - `a522a9a` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/pages/hr/Roster.tsx` - PageHeader with `icon={Users}`, actions = stat badge + Import/Onboard buttons
- `src/pages/hr/Catalog.tsx` - PageHeader (no icon available), subtitle `<p>` kept as sibling
- `src/pages/hr/Onboarding.tsx` - Added `<PageHeader title="Onboarding" />` (page had no header before)
- `src/pages/hr/Teams.tsx` - PageHeader with `icon={UsersRound}`, actions = team-count badge + New Team button
- `src/pages/hr/AgentAnalytics.tsx` - PageHeader, actions = time-window `ToggleGroup`
- `src/pages/Dashboard.tsx` - PageHeader, no actions
- `src/pages/Alerts.tsx` - PageHeader, no actions
- `src/pages/Briefings.tsx` - PageHeader, no actions
- `src/pages/Capabilities.tsx` - PageHeader, actions = global search input
- `src/pages/Settings.tsx` - PageHeader, no actions
- `src/pages/SelfHealing.tsx` - PageHeader, no actions

## Decisions Made
- Used a thematically-matching, already-imported Lucide icon (`Users` for Roster, `UsersRound` for Teams) in place of the plan's "leading icon" description, since the actual code used a decorative pulse-dot span rather than any icon component. Catalog and AgentAnalytics had no icon imported for their headers, so the `icon` prop was omitted there — title text preserved exactly as specified either way.
- Combined title-adjacent stat badges with right-side action buttons into a single `actions` node (Roster, Teams) since `PageHeader` only supports left (title/icon) and right (actions) zones, not a third title-adjacent zone.

## Deviations from Plan

None requiring the Rule 1-4 framework — the only adjustments were interpretive choices around the "leading icon" language in the plan's `<interfaces>` section (documented above under Decisions Made), made necessary because the actual audited code didn't contain real Lucide icon components on these headers, only decorative pulse-dot spans.

## Issues Encountered

The plan's Task 1 verify script asserts `grep -rL 'font-mono tracking-wide.*uppercase' ... | wc -l` equals exactly 4 (all 4 mono-title files clean). In practice this exact grep still counts 4 file matches because `tracking-widest` (used on retained stat badges/toggle buttons, e.g. "3 active", time-window pills) contains `tracking-wide` as a substring, and those elements are NOT the migrated `<h1>` titles. Verified directly that no bespoke `<h1>` remains anywhere in `src/pages/hr/` (`grep -rn '<h1' src/pages/hr` returns zero matches) and that the only elements still matching the regex are non-title badges/pills/section `<h2>`s — the acceptance criterion ("title element no longer carries font-mono tracking-wide uppercase") is fully met.

## Next Phase Readiness
- 11 of the remaining ~24 header-standardization pages are done; the other half is planned in a sibling wave-2 plan.
- `npx tsc --noEmit` is clean and the full `npx vitest run` suite passes (170 files / 1712 tests, no failures) after this migration.
- No blockers for downstream plans depending on `PageHeader`.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: .planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-11-SUMMARY.md
- FOUND commit: 9eed74d (Task 1)
- FOUND commit: a522a9a (Task 2)
