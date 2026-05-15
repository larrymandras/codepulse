---
phase: 04-kpi-panel-redesign
plan: 01
subsystem: ui
tags: [react, svg, motion, animation, css, tokens, sparkline, typescript]

# Dependency graph
requires:
  - phase: 03-design-token-refresh
    provides: OKLCH accent hue tokens and data-accent radial gradient pattern consumed here as model for tone tokens
provides:
  - Phase 04 CSS tone tokens (--tone-good/warn/danger) in :root and .dark with OKLCH values
  - data-tone attribute selectors setting --tile-tone CSS custom property
  - Tone type and thresholdTone() utility exported from MetricCard.tsx
  - BackgroundSparkline component with catmullRomPath, flatSparkline, draw-in animation, and live morph
  - Unit tests: MetricCard.test.tsx (8 tests), BackgroundSparkline.test.tsx (14 tests)
affects: [04-02, HeroStatsBar, any component using data-tone attribute or BackgroundSparkline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "catmullRomPath: centripetal Catmull-Rom (alpha=0.5) to SVG cubic Bezier path, Math.pow() instead of ** for esbuild compatibility"
    - "motion.path pathLength 0->1 for draw-in animation, tileIndex stagger"
    - "motion.path animate d prop for live morph (JS interpolation, cross-browser including Safari)"
    - "useId() for unique linearGradient IDs when multiple BackgroundSparkline instances co-exist"
    - "max - min || 1 guard for NaN-free flat/zero sparkline normalization"
    - "thresholdTone() mirrors thresholdColor() logic but returns semantic Tone strings"

key-files:
  created:
    - src/components/BackgroundSparkline.tsx
    - src/components/BackgroundSparkline.test.tsx
    - src/components/MetricCard.test.tsx
  modified:
    - src/index.css
    - src/components/MetricCard.tsx

key-decisions:
  - "04-01-D-01: Used Math.pow() instead of ** operator — esbuild (used by Vitest) does not support ** in this project config"
  - "04-01-D-02: catmullRomPath exported as named function for direct unit testing of path math"
  - "04-01-D-03: flatSparkline exported as utility for test harness and consumer convenience"

patterns-established:
  - "Pattern: motion.path for SVG path animations (draw-in + morph) — do not use CSS transition on d prop (Safari unsupported)"
  - "Pattern: data-tone attribute + --tile-tone CSS custom property mirrors the data-accent + --accent-* pattern from Phase 03"

requirements-completed: [KPI-01, KPI-02, KPI-05, CC-01, CC-02]

# Metrics
duration: 3min
completed: 2026-05-15
---

# Phase 04 Plan 01: KPI Panel Foundation Summary

**OKLCH tone tokens, data-tone CSS selectors, thresholdTone() utility, and BackgroundSparkline SVG component with cubic Bezier draw-in animation and live morph**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-15T07:42:25Z
- **Completed:** 2026-05-15T07:45:12Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Phase 04 tone tokens (good/warn/danger) added to both :root and .dark blocks in index.css with OKLCH values matching Phase 03 accent hues
- thresholdTone() exported from MetricCard.tsx — semantic tone strings for the three-layer styling system
- BackgroundSparkline component: centripetal Catmull-Rom cubic Bezier curve, gradient fill (8% opacity), stroke (20% opacity), draw-in via pathLength, live morph via animate d prop
- 22 total tests passing across both new test files

## Task Commits

Each task was committed atomically:

1. **Task 1: CSS tone tokens, data-tone selectors, and thresholdTone() utility** - `a7360e8` (feat)
2. **Task 2: BackgroundSparkline component with cubic Bezier curve, gradient fill, draw-in animation, and live morph** - `3129d9b` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified

- `src/index.css` - Added Phase 04 tone tokens to :root and .dark, plus data-tone attribute selectors
- `src/components/MetricCard.tsx` - Added Tone type and thresholdTone() export
- `src/components/MetricCard.test.tsx` - 8 tests covering both directions and boundary values for thresholdTone
- `src/components/BackgroundSparkline.tsx` - New component: catmullRomPath, flatSparkline, BackgroundSparkline with motion animations
- `src/components/BackgroundSparkline.test.tsx` - 14 tests: catmullRomPath correctness, flatSparkline, component smoke tests including flat/zero data NaN guard

## Decisions Made

- Used `Math.pow()` instead of `**` exponentiation operator throughout catmullRomPath — esbuild (used by Vitest's transform pipeline in this project) does not support the `**` syntax, causing a transform error at test time
- Exported `catmullRomPath` and `flatSparkline` as named functions to enable direct unit testing without rendering the component
- `thresholdTone()` does not handle the 'default' tone case — per plan spec, that logic lives in HeroStatsBar (Plan 02) where tiles without thresholds will apply 'default' directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced ** exponentiation operator with Math.pow()**
- **Found during:** Task 2 (BackgroundSparkline component creation, first test run)
- **Issue:** esbuild transform in Vitest's pipeline rejected the `**` operator: "Unexpected **" in BackgroundSparkline.tsx at catmullRomPath
- **Fix:** Replaced all `**` usages with `Math.pow()` calls; extracted squared values to named variables (d1sq, d2sq, d3sq) for clarity
- **Files modified:** src/components/BackgroundSparkline.tsx
- **Verification:** `npx vitest run src/components/BackgroundSparkline.test.tsx` — 14/14 pass
- **Committed in:** 3129d9b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was necessary for test execution. No scope creep, no behavioral change to the algorithm.

## Issues Encountered

None beyond the ** operator fix documented above.

## Known Stubs

None. BackgroundSparkline renders from its `data` prop directly — no hardcoded data. Token values are concrete OKLCH values, not placeholders.

## Next Phase Readiness

- All Phase 04 foundation pieces are ready for Plan 02 (HeroStatsBar wiring)
- `BackgroundSparkline` is exported and ready to be placed inside HeroStatsBar tiles
- `thresholdTone()` is exported from MetricCard.tsx, ready for HeroStatsBar to call and apply `data-tone` attribute
- `data-tone` selectors in index.css will activate automatically when HeroStatsBar sets the attribute

---
*Phase: 04-kpi-panel-redesign*
*Completed: 2026-05-15*
