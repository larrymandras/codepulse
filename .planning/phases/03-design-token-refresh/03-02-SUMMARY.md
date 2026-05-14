---
phase: 03-design-token-refresh
plan: "02"
subsystem: design-tokens
tags: [css, design-tokens, components, accent-gradients, lift-on-hover]
dependency_graph:
  requires:
    - "03-01: data-accent CSS selectors and .lift-on-hover utility in src/index.css"
  provides:
    - "MetricCard with optional accent prop and lift-on-hover on interactive cards"
    - "GlassPanel with optional accent prop"
    - "HeroStatsBar tiles with per-category data-accent and lift-on-hover"
    - "Hardcoded hex colors replaced with CSS custom property references"
  affects:
    - "All pages consuming HeroStatsBar (dashboard home)"
    - "All components using MetricCard or GlassPanel that pass accent prop"
tech_stack:
  added: []
  patterns:
    - "data-accent attribute on tile/card divs driving radial gradient from CSS selectors"
    - "lift-on-hover utility class on interactive cards"
    - "CSS custom property var(--accent-*) in component color props"
key_files:
  created: []
  modified:
    - "src/components/MetricCard.tsx"
    - "src/components/GlassPanel.tsx"
    - "src/components/HeroStatsBar.tsx"
decisions:
  - "accent prop is optional on MetricCard and GlassPanel — additive, no breaking changes"
  - "HeroStatsBar tiles remove transition-colors hover:bg-gray-800/70 in favor of lift-on-hover utility"
  - "KPIs using thresholdColor still rely on threshold system for value color; data-accent drives tile gradient independently"
  - "Sparkline fallback changed from #6366f1 to var(--accent-activity) for token consistency"
metrics:
  duration: "2min"
  completed_date: "2026-05-14"
  tasks_completed: 2
  files_modified: 3
---

# Phase 03 Plan 02: Component Accent Wiring Summary

Additive accent prop migration: MetricCard, GlassPanel, and HeroStatsBar tiles now accept `data-accent` attributes wired to the CSS radial gradient selectors from Plan 01; interactive elements gain `.lift-on-hover`; all hardcoded hex colors replaced with CSS custom property references.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add accent prop to MetricCard and GlassPanel | c3ee5cf | src/components/MetricCard.tsx, src/components/GlassPanel.tsx |
| 2 | Wire accent gradients and lift-on-hover into HeroStatsBar tiles | 7dcaa89 | src/components/HeroStatsBar.tsx |

## What Was Built

### Task 1 — MetricCard and GlassPanel accent props

**MetricCard.tsx:**
- `MetricCardProps` interface gains `accent?: "cost" | "health" | "activity" | "memory" | "alerts"`
- `MetricCardInner` destructures `accent` from props
- Outer `<div>` spreads `data-accent={accent}` when provided (triggers radial gradient from index.css)
- Outer `<div>` gets `lift-on-hover cursor-pointer` Tailwind classes when `onClick` is provided (replaces old inline `style={{ cursor: "pointer" }}`)

**GlassPanel.tsx:**
- `GlassPanelProps` interface gains `accent?: "cost" | "health" | "activity" | "memory" | "alerts"`
- Component destructures `accent` from props
- `<motion.div>` spreads `data-accent={accent}` when provided

Both changes are purely additive — all existing consumers continue to work without modification.

### Task 2 — HeroStatsBar tile accent wiring

**KpiDef interface** gains `accent?: "cost" | "health" | "activity" | "memory" | "alerts"`.

**8 KPI entries** assigned category accents per the plan mapping:
- Sessions → activity (blue)
- Error Rate → alerts (red)
- Alerts → alerts (red)
- Security → alerts (red)
- Memory Hit Rate → memory (violet)
- Durable Facts → memory (violet)
- Advisor Savings → cost (amber)
- Startup Time → health (green)

**Tile div** updated:
- `data-accent={kpi.accent}` attribute added
- `lift-on-hover` class added
- `transition-colors hover:bg-gray-800/70` removed (redundant with lift-on-hover; gradient provides visual differentiation)

**Hardcoded hex colors replaced:**
- `#60a5fa` → `var(--accent-activity)` (Sessions color prop)
- `#f87171` → `var(--accent-alerts)` (Alerts critical state)
- `#fb923c` → `var(--status-warn)` (Alerts warn state, Security warn state)
- `#34d399` → `var(--accent-health)` (Alerts all-clear state, Security ok state)
- `#6366f1` → `var(--accent-activity)` (Sparkline fallback)

## Verification Results

```
npx tsc --noEmit: 0 errors ✓
npm run build: ✓ built in 7.51s
data-accent in HeroStatsBar: 1 ✓
data-accent in MetricCard: 1 ✓
data-accent in GlassPanel: 1 ✓
lift-on-hover in HeroStatsBar: 1 ✓
lift-on-hover in MetricCard: 1 ✓
No #60a5fa in HeroStatsBar: 0 occurrences ✓
No #f87171 in HeroStatsBar: 0 occurrences ✓
No #34d399 in HeroStatsBar: 0 occurrences ✓
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all accent values are wired to actual CSS custom properties defined in Plan 01.

## Threat Flags

No new security-relevant surface introduced. `data-accent` values are hardcoded string literals from source — no user input injection vector (T-03-02: accept per plan threat model).

## Self-Check: PASSED

- `src/components/MetricCard.tsx` modified and committed ✓
- `src/components/GlassPanel.tsx` modified and committed ✓
- `src/components/HeroStatsBar.tsx` modified and committed ✓
- Commit `c3ee5cf` exists (Task 1) ✓
- Commit `7dcaa89` exists (Task 2) ✓
- Build passes ✓
- TypeScript clean ✓
