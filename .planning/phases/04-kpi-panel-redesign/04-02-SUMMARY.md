---
phase: 04-kpi-panel-redesign
plan: 02
subsystem: ui
tags: [react, svg, motion, animation, css, tokens, sparkline, herostatsbar, typescript, testing]

# Dependency graph
requires:
  - phase: 04-01
    provides: BackgroundSparkline, flatSparkline, thresholdTone, Tone, data-tone CSS selectors, tone tokens
provides:
  - HeroStatsBar with BackgroundSparkline layer in all 7 KPI tiles
  - data-tone attribute on threshold tiles driving three-layer OKLCH tone styling
  - sparklineData wiring (real eventSparkline/costSparkline for Sessions/Advisor Savings; flatSparkline for others)
  - HeroStatsBar.test.tsx with 10 tests covering tone, sparkline, structure, and style assertions
affects: [04-03, Dashboard page, HeroStatsBar consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-tone spread: {...(tone !== 'default' ? { 'data-tone': tone } : {})} — omits attribute entirely for default tone (D-08)"
    - "Three-layer tile: BackgroundSparkline z-0 (absolute), data-accent CSS radial gradient (layer 2), content z-10 (relative)"
    - "color-mix(in oklch, var(--tone-X) 8%, transparent) for backgroundColor — tone-driven tile tint"
    - "color-mix(in oklch, var(--tone-X) N%, transparent) for borderColor — 15% good/default, 20% warn/danger"
    - "toneColor fallback: non-default → var(--tone-{tone}), default → var(--accent-{accent})"
    - "motion/react test mock: motion.span unwraps MotionValue children via .get() to avoid React child type error"

key-files:
  created:
    - src/components/HeroStatsBar.test.tsx
  modified:
    - src/components/HeroStatsBar.tsx

key-decisions:
  - "04-02-D-01: motion.span mock in HeroStatsBar.test.tsx must unwrap MotionValue children via .get() — AnimatedNumber passes a MotionValue as children to motion.span, not a renderable primitive"

patterns-established:
  - "Pattern: Three-layer KPI tile — sparkline (abs z-0), CSS radial gradient (data-accent, no JS), content (rel z-10)"
  - "Pattern: data-tone conditional spread — only applied when tone is not 'default', keeping non-threshold tiles clean"

requirements-completed: [KPI-01, KPI-02, KPI-03, KPI-04, KPI-05, CC-01, CC-02]

# Metrics
duration: 2min
completed: 2026-05-15
---

# Phase 04 Plan 02: HeroStatsBar Wiring Summary

**BackgroundSparkline and tone system wired into all 7 HeroStatsBar KPI tiles — real sparkline data for Sessions and Advisor Savings, synthetic flat sparklines for remaining 5 tiles, three-layer OKLCH tone styling via color-mix, and 10-test HeroStatsBar.test.tsx**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-15T12:13:00Z
- **Completed:** 2026-05-15T12:15:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All 7 HeroStatsBar tiles upgraded: BackgroundSparkline renders as layer 1 (absolute, z-0) behind tile content (relative, z-10)
- Sessions tile wired to real `stats.eventSparkline` (falls back to `flatSparkline(activeSessions)` when empty)
- Advisor Savings tile wired to real `stats.costSparkline` (falls back to `flatSparkline(advisorSavingsValue ?? 0)`)
- Remaining 5 tiles use `flatSparkline()` per D-09/D-10 (identical visual treatment to real sparklines)
- `data-tone` attribute set only on threshold tiles (Error Rate, Memory Hit Rate, Durable Facts, Advisor Savings) per D-08; Sessions/Alerts/Security have no data-tone attribute
- Inline `color-mix(in oklch, ...)` styles applied for `backgroundColor` (8% tint) and `borderColor` (15% good/default, 20% warn/danger) per D-07
- Tile className gains `relative overflow-hidden min-h-[72px] border` per D-11/D-12
- Outer container (`bg-card border border-border rounded-xl p-4`) unchanged per D-13
- 10 tests passing in HeroStatsBar.test.tsx; 32 total across plan-relevant test files; 513 across full suite; 0 regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire BackgroundSparkline and tone system into HeroStatsBar tiles** - `80b5bb4` (feat)
2. **Task 2: HeroStatsBar test file with data-tone and sparkline assertions** - `6712a6a` (feat)

**Plan metadata:** (see final commit)

## Files Created/Modified

- `src/components/HeroStatsBar.tsx` — Added BackgroundSparkline/flatSparkline/thresholdTone/Tone imports; added sparklineData field to KpiDef; wired sparklineData to all 7 tiles; replaced map block with three-layer tile structure (sparkline z-0, content z-10, data-tone, color-mix inline styles)
- `src/components/HeroStatsBar.test.tsx` — New: 10 tests covering 7 tiles, data-tone presence/absence, min-h/overflow-hidden, BackgroundSparkline SVGs, color-mix styles, outer container unchanged

## Decisions Made

- `motion.span` mock in HeroStatsBar.test.tsx requires unwrapping MotionValue children via `.get()` — `AnimatedNumber` passes `useTransform`'s return value directly as `children` to `motion.span`. The real `motion.span` subscribes to this MotionValue; the mock must extract the current value via `.get()` to avoid "Objects are not valid as a React child" error.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] motion.span mock needed to unwrap MotionValue children**
- **Found during:** Task 2 (first test run — all 10 tests failing)
- **Issue:** The plan's motion/react mock used `span: ({ children, ...rest }) => <span {...rest}>{children}</span>`. AnimatedNumber passes a MotionValue object as children to motion.span. React rejected the object as a child: "Objects are not valid as a React child (found: object with keys {get})".
- **Fix:** Updated the `motion.span` mock to duck-type the children: if `children` is an object with a `.get()` function, call `.get()` and stringify the result before rendering.
- **Files modified:** src/components/HeroStatsBar.test.tsx
- **Verification:** `npx vitest run src/components/HeroStatsBar.test.tsx` — 10/10 pass
- **Committed in:** 6712a6a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Fix was isolated to the test mock. No behavioral change to HeroStatsBar or BackgroundSparkline.

## Issues Encountered

None beyond the mock fix documented above.

## Known Stubs

None. All 7 tiles receive real or deterministic synthetic sparkline data. data-tone reflects live metric state from Convex queries. color-mix values are computed from design tokens, not hardcoded placeholders.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. Pure frontend rendering modification.

## Self-Check: PASSED

Files exist:
- `src/components/HeroStatsBar.tsx` — FOUND
- `src/components/HeroStatsBar.test.tsx` — FOUND

Commits exist:
- `80b5bb4` (Task 1 feat) — FOUND
- `6712a6a` (Task 2 feat) — FOUND

---
*Phase: 04-kpi-panel-redesign*
*Completed: 2026-05-15*
