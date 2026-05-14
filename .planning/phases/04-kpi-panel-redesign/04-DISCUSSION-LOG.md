# Phase 04: KPI Panel Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 04-kpi-panel-redesign
**Areas discussed:** Sparkline background style, Tone-based status styling, Sparkline data coverage, Tile sizing & layout

---

## Sparkline Background Style

### Q1: How should the sparkline fill the tile background?

| Option | Description | Selected |
|--------|-------------|----------|
| Filled area with gradient | Smooth cubic Bézier curve with gradient-filled area beneath, fading from accent color at bottom to transparent at top | ✓ |
| Stroke-only path | Just the curve line as decorative stroke, no fill | |
| You decide | Let Claude pick best approach | |

**User's choice:** Filled area with gradient
**Notes:** 8% accent opacity for fill, 20% for stroke, cubic Bézier smoothing

### Q2: How should the sparkline interact with the existing radial gradient?

| Option | Description | Selected |
|--------|-------------|----------|
| Layer beneath the radial gradient | Sparkline SVG behind everything, radial gradient overlay on top, two distinct visual layers | ✓ |
| Replace the radial gradient | Sparkline fill IS the decorative background, remove Phase 03 radial gradient | |
| You decide | Let Claude determine | |

**User's choice:** Layer beneath the radial gradient
**Notes:** Sparkline = texture layer, radial gradient = glow layer, text on top

### Q3: Should the sparkline curve animate on initial render?

| Option | Description | Selected |
|--------|-------------|----------|
| Draw-in animation | stroke-dasharray/offset trick, ~600ms ease-out, fill fades in simultaneously | ✓ |
| Fade-in only | Opacity 0→final, ~300ms | |
| No animation | Immediate render | |

**User's choice:** Draw-in animation
**Notes:** Must respect prefers-reduced-motion

### Q4: Should sparklines update live when data changes?

| Option | Description | Selected |
|--------|-------------|----------|
| Live morph on data change | SVG path smoothly morphs to new shape, ~400ms ease-in-out | ✓ |
| Animate on mount only | Draw-in on first render, then static swaps | |
| You decide | Let Claude pick based on performance | |

**User's choice:** Live morph on data change
**Notes:** Data polls every 5s via useHeroStats

---

## Tone-Based Status Styling

### Q1: How should existing ThresholdConfig map to the tone system?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend thresholdColor to return tone | New thresholdTone() returning good/warn/danger/default, drives all three layers | ✓ |
| Keep thresholdColor, add tone to border/bg only | Two systems side by side | |
| You decide | Let Claude determine cleanest mapping | |

**User's choice:** Extend thresholdColor to return tone

### Q2: Should tone colors use accent hues or status tokens?

| Option | Description | Selected |
|--------|-------------|----------|
| Use accent hues mapped to tones | good=142° green, warn=80° amber, danger=27° red | ✓ |
| Use existing --status-ok/warn/error tokens | Reuse status tokens from index.css | |
| New dedicated tone tokens | Brand-new --tone-good/warn/danger tokens | |

**User's choice:** Use accent hues mapped to tones
**Notes:** All at oklch(0.70 chroma hue) base with /8, /15, /20 opacity layers

### Q3: When a tile has no threshold, what determines its tone?

| Option | Description | Selected |
|--------|-------------|----------|
| Always 'default' — use tile's accent color | Tiles without thresholds stay in their assigned accent hue | ✓ |
| Derive tone from value heuristics | Infer from value (0 alerts = good, >0 = danger) | |
| You decide | Let Claude pick per tile | |

**User's choice:** Always 'default'
**Notes:** Sessions → activity-blue, Alerts → alerts-red, Security → alerts-red — no dynamic tone

---

## Sparkline Data Coverage

### Q1: Which tiles should get sparkline backgrounds?

| Option | Description | Selected |
|--------|-------------|----------|
| Map existing sparklines + synthetic for rest | eventSparkline → Sessions, costSparkline → Advisor Savings, flat lines for other 5 | ✓ |
| Only tiles with real sparkline data | Sessions and Advisor Savings only | |
| Extend heroStats query for all tiles | Add sparkline arrays for every KPI (violates KPI-05) | |

**User's choice:** Map existing sparklines + synthetic for rest
**Notes:** Error Rate derived from eventSparkline buckets, remaining tiles get flat horizontal band

### Q2: Should flat sparklines look different from real ones?

| Option | Description | Selected |
|--------|-------------|----------|
| Same visual treatment, just flat | Identical gradient fill, just no curve variation | ✓ |
| Skip sparkline for flat-data tiles | Only render when data has variation | |
| You decide | Let Claude determine | |

**User's choice:** Same visual treatment
**Notes:** At 8% opacity the difference is subtle — visual consistency matters more

---

## Tile Sizing & Layout

### Q1: Should the tile grid layout change?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 7-col, add min-height | Keep grid-cols-7 at lg, add min-h-[72px] | ✓ |
| Reduce to 4-col + 3-col rows | Split into two rows for larger tiles | |
| You decide | Let Claude pick based on visual testing | |

**User's choice:** Keep 7-col, add min-height
**Notes:** Responsive breakpoints unchanged, ~72px gives sparkline room

### Q2: Should tiles get a visible border?

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle tone border | 1px border in tone color at 15% opacity, warn/danger at 20% | ✓ |
| Border on warn/danger only | No border in default/good states | |
| No border | Borderless, sparkline fill is enough | |

**User's choice:** Subtle tone border
**Notes:** Default barely visible, warn/danger slightly more prominent

### Q3: Should the outer container change?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current container, upgrade tiles only | bg-card border rounded-xl p-4 wrapper unchanged | ✓ |
| Remove outer container | Each tile becomes standalone card | |
| You decide | Let Claude determine | |

**User's choice:** Keep current container
**Notes:** Minimal blast radius — only individual tiles are upgraded

---

## Claude's Discretion

- Exact cubic Bézier control point algorithm for smoothing sparkline data
- Whether to use CSS `d` property transition or Motion's SVG path animation for live morph
- `data-tone` attribute naming and CSS implementation approach
- Exact min-height if 72px doesn't look right — tune during implementation
- Error Rate sparkline derivation method (raw counts vs computed percentages per bucket)
- Whether to stagger tile mount animations (~100ms each) for left-to-right reveal

## Deferred Ideas

- Ambient CSS animations (drift, starfield, pulse) — dedicated animation phase
- Sparkline click-to-expand for detailed time-series chart — drill-down phase
- Real sparkline data for all 7 KPIs (breaking KPI-05 constraint) — future enhancement
