# Phase 04: KPI Panel Redesign - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The HeroStatsBar transforms from flat colored tiles to a premium panel with decorative SVG sparkline backgrounds (cubic Bézier, gradient-filled area), tone-based three-layer status styling (bg/text/border at tiered opacities), and animated count-up values. The outer container and responsive grid breakpoints are preserved. All 7 KPI tiles get the visual upgrade. No new Convex queries are added — sparkline data comes from existing `eventSparkline` and `costSparkline` arrays plus synthetic flat values for tiles without time-series data.

</domain>

<decisions>
## Implementation Decisions

### Sparkline Background Style
- **D-01:** Sparkline renders as a filled area with gradient beneath a smooth cubic Bézier curve. Gradient fills from accent color at bottom to transparent at top. Fill at 8% accent opacity, stroke at 20% accent opacity.
- **D-02:** Sparkline SVG is positioned absolute behind everything (layer 1). The existing Phase 03 radial gradient from `data-accent` sits on top (layer 2). Text content is layer 3. Two distinct visual layers — sparkline provides texture, radial gradient provides left-edge glow.
- **D-03:** Draw-in animation on mount — SVG stroke-dasharray/offset trick, curve draws left-to-right ~600ms ease-out, filled area fades in simultaneously. Respects `prefers-reduced-motion: reduce` (instant render, no animation).
- **D-04:** Live morph on data change — when `useHeroStats` polls new data (every 5s), the SVG path smoothly transitions to the new shape via CSS transition on `d` attribute or Motion animate. ~400ms ease-in-out. Fill gradient stays consistent.

### Tone-Based Status Styling
- **D-05:** New `thresholdTone()` utility function alongside existing `thresholdColor()`. Returns `'good' | 'warn' | 'danger' | 'default'` based on ThresholdConfig thresholds. The tone drives all three visual layers (bg/text/border) instead of just text color.
- **D-06:** Tone colors map to Phase 03 accent hues: good = 142° (accent-health green), warn = 80° (accent-cost amber), danger = 27° (accent-alerts red), default = per-tile accent hue. All at `oklch(0.70 chroma hue)` base with tiered opacity layers.
- **D-07:** Three-layer opacity values: bg at 8%, text at full accent, border at 15%. Warn tone bumps border to 20%, danger to 20%. These are CSS custom properties on the tile element, driven by a `data-tone` attribute or utility classes.
- **D-08:** Tiles without thresholds (Sessions, Alerts, Security) always use `'default'` tone — their assigned accent color (activity-blue, alerts-red) drives all three layers. No dynamic tone changes for these tiles.

### Sparkline Data Coverage
- **D-09:** All 7 tiles get sparkline backgrounds. Mapping: Sessions ← `eventSparkline` (real), Error Rate ← derived from `eventSparkline` (error% per bucket), Alerts ← flat line (single count), Security ← flat line (single count), Memory Hit Rate ← flat line (single value), Durable Facts ← flat line (single value), Advisor Savings ← `costSparkline` (real).
- **D-10:** Flat/synthetic sparklines get identical visual treatment to real sparklines — same gradient fill, same opacity. A flat sparkline is just a horizontal band. At 8% opacity the difference between real and flat data is subtle and maintains visual consistency.

### Tile Sizing & Layout
- **D-11:** Grid stays `grid-cols-2 sm:grid-cols-4 lg:grid-cols-7` (responsive breakpoints unchanged). Tiles get `min-h-[72px]` (up from auto ~48px) to give sparkline backgrounds room to breathe.
- **D-12:** Each tile gets `relative overflow-hidden rounded-lg` plus a subtle 1px border in tone color at 15% opacity. Default tone borders are barely visible (defines tile edge), warn/danger borders are slightly more prominent (20% opacity) for attention.
- **D-13:** Outer HeroStatsBar container stays unchanged (`bg-card border border-border rounded-xl p-4`). Only the individual tiles inside it are upgraded. Minimal blast radius.

### Claude's Discretion
- Exact cubic Bézier control point algorithm for smoothing the sparkline polyline data
- Whether to use CSS `d` property transition or Motion's SVG path animation for the live morph
- The `data-tone` attribute name and whether to use utility classes or CSS custom property overrides
- Exact min-height value if 72px doesn't look right — tune during implementation
- Whether Error Rate sparkline derivation uses raw error counts per bucket or computed percentages

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS-v5.md` — KPI-01 through KPI-05 requirements for this phase, plus CC-01 through CC-05 cross-cutting requirements

### Design System & Tokens
- `src/index.css` — Current token definitions (`:root` and `.dark` blocks), accent hue tokens from Phase 03, glass tokens, effort tier tokens, animations, `prefers-reduced-motion` rules
- `src/components/MetricCard.tsx` — AnimatedNumber, ThresholdConfig, thresholdColor utility — the tone system builds on this

### Target Components
- `src/components/HeroStatsBar.tsx` — Primary edit target: KPI tile grid, KpiDef interface, threshold/color logic
- `src/components/Sparkline.tsx` — Existing sparkline component (80×24 inline polyline) — reference for data→SVG conversion, but the new background sparkline is a different component
- `src/hooks/useHeroStats.ts` — Data source: polls `heroStats.summary` every 5s, returns `eventSparkline` and `costSparkline` arrays
- `convex/heroStats.ts` — Convex query producing 12×5-min sparkline buckets for events and cost

### Claude OS Reference Patterns
- `C:\Users\mandr\Downloads\claude-operating-system-main\claude-operating-system-main\src\components\stat-card.tsx` — Tone-based StatCard coloring pattern (default/warn/danger/good)
- `C:\Users\mandr\Downloads\claude-operating-system-main\claude-operating-system-main\src\components\usage-panel.tsx` — Radial gradient background pattern on ServiceRow

### Prior Phase Context
- `.planning/phases/03-design-token-refresh/03-CONTEXT.md` — Phase 03 decisions (whisper-tint, accent hues, radial gradients, lift-on-hover) that this phase builds on

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **AnimatedNumber** (`MetricCard.tsx`): Motion spring animation with tabular-nums, already used in HeroStatsBar. KPI-03 is already satisfied.
- **thresholdColor** (`MetricCard.tsx`): Returns CSS var strings for ok/warn/error. The new `thresholdTone()` follows the same logic but returns tone strings instead.
- **Sparkline** (`Sparkline.tsx`): Memo-optimized SVG polyline. The new background sparkline is a separate component (full-tile, filled area, cubic Bézier) but can reference data→point conversion logic.
- **useHeroStats** (`hooks/useHeroStats.ts`): Already returns `eventSparkline` (12 buckets) and `costSparkline` (12 buckets). These are the real data sources.
- **KpiDef interface** (`HeroStatsBar.tsx`): Already has `accent`, `threshold`, `sparkline`, `onClick`, `color` fields. Needs `sparklineData` or similar for the background sparkline array.

### Established Patterns
- **OKLCH everywhere**: All tokens are OKLCH. Tone colors must use OKLCH with accent hues (142°, 80°, 27°).
- **CSS custom properties**: Components consume tokens via `var(--token-name)`. Tone layers should follow this convention.
- **data-accent attribute**: Already on KPI tiles (Phase 03). A `data-tone` attribute follows the same pattern.
- **prefers-reduced-motion**: All new animations must respect this media query — draw-in and morph animations disabled.
- **Phase comments in CSS**: New token groups commented with phase number (e.g., `/* Phase 04: tone tokens */`).

### Integration Points
- `src/index.css` `.dark {}` block — add tone-related CSS custom properties if needed
- `HeroStatsBar.tsx` tile JSX — add SVG sparkline background layer, tone classes/attributes, min-height
- `MetricCard.tsx` — add `thresholdTone()` export alongside `thresholdColor()`

</code_context>

<specifics>
## Specific Ideas

- Three-layer status pill pattern from Claude OS: `bg-{color}/10 text-{color} border-{color}/20` — directly referenced as the inspiration for KPI-02
- Sparkline fill opacity at 8% is deliberately subtle — the sparkline should be "felt" not "seen," adding texture without competing with the stat value
- Live morph creates a "breathing" effect as real-time data flows in every 5 seconds — premium operational dashboard feel
- The draw-in animation on mount gives each tile a staggered "boot up" sequence — consider staggering tile animations by ~100ms each for left-to-right reveal

</specifics>

<deferred>
## Deferred Ideas

- Ambient CSS animations (drift, starfield, pulse) beyond hover and mount effects — dedicated animation phase
- Sparkline click-to-expand showing detailed time-series chart — belongs in a drill-down phase
- Adding real sparkline data for all 7 KPIs (breaking KPI-05's no-new-queries constraint) — future enhancement if flat sparklines feel insufficient

</deferred>

---

*Phase: 04-KPI Panel Redesign*
*Context gathered: 2026-05-14*
