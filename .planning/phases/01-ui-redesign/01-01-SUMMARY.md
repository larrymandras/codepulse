---
phase: 01-ui-redesign
plan: 01
subsystem: ui
tags: [shadcn, tailwind, oklch, design-tokens, lucide]

requires:
  - phase: 01-00
    provides: test stubs for MetricCard and theme validation
provides:
  - oklch design token layer (sole color source)
  - shadcn/ui New York style initialization
  - cn() utility helper
  - separator, badge, tooltip, button primitives
  - borderless tabular-nums MetricCard with Lucide trend icons
  - slide-in animation keyframe for activity feed
affects: [01-02, 01-03]

tech-stack:
  added: [shadcn/ui separator, shadcn/ui badge, shadcn/ui tooltip]
  patterns: [oklch CSS variables, operational status tokens, tabular-nums for metrics]

key-files:
  created:
    - src/components/ui/separator.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/tooltip.tsx
  modified:
    - src/index.css
    - src/components/MetricCard.tsx
    - components.json

key-decisions:
  - "Changed components.json style from radix-nova to new-york per plan spec"
  - "Preserved dark mode border/input as oklch(0.269 0 0) instead of original alpha values for consistency"

patterns-established:
  - "oklch tokens: all colors via CSS custom properties, no hex/rgb anywhere"
  - "Operational status colors: --status-ok, --status-error, --status-warn"
  - "Borderless metric display: p-4 padding only, tabular-nums for values"
  - "--radius: 0rem globally — sharp corners everywhere"

requirements-completed: [UI-01, UI-02]

duration: 3min
completed: 2026-04-13
---

# Plan 01-01: Design Token Layer Summary

**oklch design token layer with shadcn/ui New York primitives and borderless tabular-nums MetricCard**

## Performance

- **Duration:** 3 min
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced entire index.css with oklch token layer — 72 oklch values as sole color source
- Removed CRT overlay and Cinzel font (per D-01, D-02 decisions)
- Preserved privacy modes and eq-bar equalizer animations verbatim
- Added operational status tokens (--status-ok, --status-error, --status-warn) and chart-bar tokens
- Set --radius: 0rem globally for sharp-corner aesthetic
- Added slide-in-entry animation keyframe for activity feed (UI-07)
- Installed shadcn/ui separator, badge, tooltip primitives (button already existed)
- Changed components.json style to new-york
- Redesigned MetricCard: removed bg/border/rounding, added tabular-nums, replaced ASCII arrows with Lucide TrendingUp/TrendingDown icons using oklch status tokens

## Task Commits

1. **Task 1: Initialize shadcn/ui and replace index.css token layer** - `4a26787` (feat)
2. **Task 2: Redesign MetricCard to borderless tabular-nums pattern** - `2873090` (feat)

## Files Created/Modified
- `src/index.css` - Full oklch token layer, privacy/eq-bar preserved, CRT/Cinzel removed
- `components.json` - Style changed to new-york
- `src/components/ui/separator.tsx` - shadcn separator primitive
- `src/components/ui/badge.tsx` - shadcn badge primitive
- `src/components/ui/tooltip.tsx` - shadcn tooltip primitive
- `src/components/MetricCard.tsx` - Borderless tabular-nums with Lucide trend icons

## Decisions Made
- Changed components.json style from radix-nova to new-york per plan spec
- Dark mode border/input tokens use solid oklch values instead of original alpha-based values for consistency with the token system

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Token layer ready for all subsequent component plans
- shadcn/ui primitives available for FlexBarChart, EntityRow, SectionHeader, StatusBadge
- MetricCard API unchanged — 9 page consumers require no modifications

---
*Phase: 01-ui-redesign*
*Completed: 2026-04-13*
