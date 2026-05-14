# Phase 04: KPI Panel Redesign - Research

**Researched:** 2026-05-14
**Domain:** SVG sparkline animation, tone-based CSS styling, Motion for React v12 SVG APIs
**Confidence:** HIGH

---

## Summary

This phase upgrades the `HeroStatsBar` from flat colored tiles to a premium panel. The core work is three independent tracks: (1) a new `BackgroundSparkline` SVG component with cubic Bézier curve, gradient-filled area, and draw-in animation; (2) a `thresholdTone()` utility driving three-layer OKLCH tone styling via `data-tone` attribute; and (3) wiring sparkline data arrays (real + synthetic flat) to all 7 KPI tiles.

All three tracks are self-contained and can be planned as separate waves. The existing `AnimatedNumber`, `thresholdColor`, `useHeroStats`, and Phase 03 CSS tokens are reused without modification. No new Convex queries are added.

The biggest technical decision Claude needs to make is **how to animate the live path morph** (every 5s data update). CSS `d` property transitions are now broadly supported in Chrome/Edge/Firefox (97+) but Safari is still unsupported as of mid-2026. Motion for React v12's `animate={{ d: "..." }}` on `<motion.path>` is the cross-browser-safe choice — it handles the interpolation in JS and falls back correctly. The draw-in animation on mount should use Motion's `pathLength` abstraction (not raw `stroke-dasharray` math) — it eliminates manual `getTotalLength()` calls and works on `path`, `polyline`, and `rect` elements identically.

**Primary recommendation:** Use `<motion.path>` with `pathLength` for draw-in and `animate={{ d }}` for live morph. Implement cubic Bézier smoothing via the centripetal Catmull-Rom algorithm (inline utility function, ~30 lines, no library needed). Use `color-mix(in oklch, ...)` for three-layer tone styling — fully supported in all target browsers since 2023.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Sparkline renders as a filled area with gradient beneath a smooth cubic Bézier curve. Gradient fills from accent color at bottom to transparent at top. Fill at 8% accent opacity, stroke at 20% accent opacity.
- **D-02:** Sparkline SVG is positioned absolute behind everything (layer 1). The existing Phase 03 radial gradient from `data-accent` sits on top (layer 2). Text content is layer 3. Two distinct visual layers — sparkline provides texture, radial gradient provides left-edge glow.
- **D-03:** Draw-in animation on mount — SVG stroke-dasharray/offset trick, curve draws left-to-right ~600ms ease-out, filled area fades in simultaneously. Respects `prefers-reduced-motion: reduce` (instant render, no animation).
- **D-04:** Live morph on data change — when `useHeroStats` polls new data (every 5s), the SVG path smoothly transitions to the new shape via CSS transition on `d` attribute or Motion animate. ~400ms ease-in-out. Fill gradient stays consistent.
- **D-05:** New `thresholdTone()` utility function alongside existing `thresholdColor()`. Returns `'good' | 'warn' | 'danger' | 'default'` based on ThresholdConfig thresholds.
- **D-06:** Tone colors map to Phase 03 accent hues: good = 142° (accent-health green), warn = 80° (accent-cost amber), danger = 27° (accent-alerts red), default = per-tile accent hue.
- **D-07:** Three-layer opacity values: bg at 8%, text at full accent, border at 15%. Warn tone bumps border to 20%, danger to 20%.
- **D-08:** Tiles without thresholds always use `'default'` tone.
- **D-09:** All 7 tiles get sparkline backgrounds. Sessions ← eventSparkline, Error Rate ← derived from eventSparkline, Alerts/Security/Memory/Durable Facts ← synthetic flat, Advisor Savings ← costSparkline.
- **D-10:** Flat/synthetic sparklines get identical visual treatment to real sparklines.
- **D-11:** Grid stays `grid-cols-2 sm:grid-cols-4 lg:grid-cols-7`. Tiles get `min-h-[72px]`.
- **D-12:** Each tile gets `relative overflow-hidden rounded-lg` plus 1px border in tone color at 15% opacity.
- **D-13:** Outer HeroStatsBar container stays unchanged.

### Claude's Discretion
- Exact cubic Bézier control point algorithm for smoothing the sparkline polyline data
- Whether to use CSS `d` property transition or Motion's SVG path animation for the live morph
- The `data-tone` attribute name and whether to use utility classes or CSS custom property overrides
- Exact min-height value if 72px doesn't look right — tune during implementation
- Whether Error Rate sparkline derivation uses raw error counts per bucket or computed percentages

### Deferred Ideas (OUT OF SCOPE)
- Ambient CSS animations (drift, starfield, pulse) beyond hover and mount effects
- Sparkline click-to-expand showing detailed time-series chart
- Adding real sparkline data for all 7 KPIs (breaking KPI-05's no-new-queries constraint)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KPI-01 | HeroStatsBar tiles have inline SVG sparkline backgrounds — cubic Bézier paths rendered as decorative fills behind the stat value | BackgroundSparkline component with Catmull-Rom smoothing, Motion pathLength draw-in, gradient fill |
| KPI-02 | Each KPI tile uses tone-based coloring (default/warn/danger/good) with three-layer status styling | thresholdTone() utility, data-tone attribute, color-mix(in oklch) for bg/border layers |
| KPI-03 | Stat values use tabular-nums with animated count-up on data change | Already satisfied by AnimatedNumber in MetricCard.tsx — no new work |
| KPI-04 | KPI tiles are clickable with navigation to the relevant detail page | Already satisfied by onClick handlers in HeroStatsBar.tsx — no new work |
| KPI-05 | Sparkline background data from existing time-series aggregation — no new Convex queries | eventSparkline + costSparkline from useHeroStats; synthetic flat arrays for other tiles |
| CC-01 | All new components follow existing Paperclip conventions: shadcn/ui primitives, Lucide icons, Motion animations, memo-optimized | BackgroundSparkline uses memo + motion/react; no shadcn primitives needed (pure SVG) |
| CC-02 | All new components have Vitest test coverage (renders without crash, key props handled) | Existing Vitest + jsdom infrastructure; motion/react must be mocked per established pattern |
| CC-05 | All visual changes verified in browser before phase completion | Standard verification step |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sparkline SVG rendering | Browser / Client | — | Pure SVG component, no server involvement |
| Cubic Bézier path computation | Browser / Client | — | Math utility called at render time, input is number[] |
| Tone classification | Browser / Client | — | thresholdTone() is a pure function; same tier as thresholdColor() |
| Three-layer tone CSS | Browser / Client | — | color-mix() and CSS custom properties, no server needed |
| Draw-in animation (mount) | Browser / Client | — | Motion pathLength, runs in browser after hydration |
| Live morph animation | Browser / Client | — | Motion animate on d prop, triggered by hook poll result |
| Sparkline data polling | Frontend (hook) | Convex backend | useHeroStats already handles polling; no new queries |
| Synthetic flat data | Browser / Client | — | Computed inline from single scalar values already in hook data |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| motion | 12.38.0 | Draw-in (pathLength) and live morph (animate d) | Already installed; v12 has first-class SVG path animation [VERIFIED: npm list] |
| React | 19.2.4 | Component model | Project standard [VERIFIED: package.json] |
| TypeScript | 5.9.3 | Type safety | Project standard [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS color-mix(in oklch) | native | Three-layer tone opacity blending | Already used in Phase 03 radial gradients — same pattern [VERIFIED: src/index.css] |
| SVG linearGradient | native | Area fill beneath Bézier curve | Standard SVG fill technique; no library needed [ASSUMED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Motion animate d | CSS transition on d | CSS d transition lacks Safari support (confirmed unsupported in all Safari versions as of mid-2026) — Motion handles interpolation in JS cross-browser [VERIFIED: caniuse.com] |
| Catmull-Rom inline util | D3.js line generator | D3 is not installed; adding it for one component is over-engineering [VERIFIED: package.json] |
| motion.path pathLength | Raw stroke-dasharray/dashoffset | Motion's pathLength abstracts getTotalLength() calculation, works on path/polyline/rect without manual math [CITED: motion.dev/docs/react-svg-animation] |

**Installation:** No new packages needed. All dependencies are already installed.

---

## Architecture Patterns

### System Architecture Diagram

```
useHeroStats (polls every 5s)
  ├── eventSparkline[12]  ──────────────────────────────────┐
  ├── costSparkline[12]   ──────────────────────────────────┤
  └── scalar values (activeAlerts, securityEvents, etc.)    │
                                                             ▼
HeroStatsBar (builds kpis[] array)                  sparklineData[] per tile
  │                                                   (real | derived | flat)
  └── KPI tile div (data-accent, data-tone)
        ├── Layer 1: BackgroundSparkline (absolute, z-0)
        │     ├── <defs> linearGradient (accent → transparent)
        │     ├── <motion.path> filled area (animate d, opacity)
        │     └── <motion.path> stroke curve (pathLength draw-in, animate d morph)
        ├── Layer 2: data-accent radial gradient (CSS background-image, Phase 03)
        └── Layer 3: tile content (relative, z-1)
              ├── label span
              ├── AnimatedNumber (Motion spring)
              └── sub span
```

### Recommended Project Structure

```
src/
├── components/
│   ├── BackgroundSparkline.tsx   # NEW — full-tile SVG sparkline component
│   ├── HeroStatsBar.tsx          # MODIFIED — add sparkline layer, data-tone, min-h
│   └── MetricCard.tsx            # MODIFIED — export thresholdTone()
├── index.css                     # MODIFIED — add Phase 04 tone tokens
└── hooks/
    └── useHeroStats.ts           # UNCHANGED — already provides sparkline data
```

### Pattern 1: Catmull-Rom → Cubic Bézier SVG Path

**What:** Converts a `number[]` array (sparkline values) to a smooth SVG `d` string using centripetal Catmull-Rom interpolation. Each pair of adjacent points produces a `C` (cubic Bézier) command. Result is a closed area path suitable for gradient fill.

**When to use:** Building the SVG `d` attribute for both the stroke path and the closed area fill path.

**Key algorithm** (centripetal, alpha=0.5 — produces tightest curves, avoids self-intersections):

```typescript
// Source: adapted from gist.github.com/nicholaswmin/c2661eb11cad5671d816 (MIT)
// Converts {x,y}[] points to SVG cubic Bézier path string
function catmullRomPath(pts: {x:number; y:number}[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const alpha = 0.5;
    const d1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) ** alpha;
    const d2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) ** alpha;
    const d3 = Math.hypot(p3.x - p2.x, p3.y - p2.y) ** alpha;
    const A = 2*d1**2 + 3*d1*d2 + d2**2;
    const B = 2*d3**2 + 3*d3*d2 + d2**2;
    const N = 3*d1*(d1+d2) || 1;
    const M = 3*d3*(d3+d2) || 1;
    const cp1 = {
      x: (-d2**2*p0.x + A*p1.x + d1**2*p2.x) / N,
      y: (-d2**2*p0.y + A*p1.y + d1**2*p2.y) / N,
    };
    const cp2 = {
      x: (d3**2*p1.x + B*p2.x - d2**2*p3.x) / M,
      y: (d3**2*p1.y + B*p2.y - d2**2*p3.y) / M,
    };
    d += ` C ${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

// Closed area path: stroke path + line down to bottom + line back to start
function areaPath(strokPath: string, pts: {x:number; y:number}[], height: number): string {
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${strokPath} L ${last.x},${height} L ${first.x},${height} Z`;
}
```

**Important constraint for live morph:** Both the initial and updated `d` strings MUST have the same number of `C` commands (same number of data points). Since the hook always returns 12 buckets this is guaranteed, but flat synthetic sparklines must also produce 12 points (repeat the scalar value 12 times).

### Pattern 2: Motion pathLength Draw-in (Mount)

**What:** Animates `pathLength` from 0→1 on mount for the stroke path. The fill area fades in via opacity simultaneously.

```typescript
// Source: motion.dev/docs/react-svg-animation [CITED]
// Stroke path draws left-to-right
<motion.path
  d={strokeD}
  initial={{ pathLength: 0, opacity: 0 }}
  animate={{ pathLength: 1, opacity: 1 }}
  transition={{
    pathLength: { duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 },
    opacity: { duration: 0.01 },  // instant — prevents flicker before stroke appears
  }}
  fill="none"
  stroke={accentColor}
  strokeWidth={1.5}
  strokeOpacity={0.2}
/>

// Fill area fades in simultaneously
<motion.path
  d={areaD}
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 }}
  fill={`url(#sparkline-grad-${id})`}
/>
```

**`prefers-reduced-motion` note:** The existing rule in `src/index.css` sets `animation-duration: 0ms` for reduced motion. This disables CSS `@keyframes` animations. However, Motion animations are JS-driven and require explicit `useReducedMotion()` hook handling:

```typescript
// Source: [ASSUMED based on Motion docs pattern]
const shouldReduce = useReducedMotion();
// Pass to BackgroundSparkline as prop, skip initial/animate if true
```

### Pattern 3: Motion animate d — Live Morph

**What:** When `useHeroStats` returns new data every 5s, the path `d` string changes. Motion interpolates between the two `d` values.

```typescript
// Source: motion.dev/docs/react-svg-animation [CITED]
// Both paths MUST have same number and type of path commands
<motion.path
  d={currentStrokeD}
  animate={{ d: newStrokeD }}
  transition={{ duration: 0.4, ease: "easeInOut" }}
/>
```

**Cross-browser safety:** Motion handles the interpolation in JS, bypassing Safari's missing CSS `d` property support. This is the recommended approach over CSS `transition: d`. [VERIFIED: caniuse.com/mdn-svg_elements_path_d_path — Safari unsupported all versions]

### Pattern 4: Three-Layer Tone CSS via data-tone

**What:** `data-tone` attribute on each tile div sets `--tile-tone` CSS custom property. Three-layer styling uses `color-mix(in oklch, var(--tile-tone) N%, transparent)`.

```css
/* Phase 04: Tone tokens — add to .dark {} and :root */
--tone-good:   oklch(0.70 0.15 142);
--tone-warn:   oklch(0.70 0.15 80);
--tone-danger: oklch(0.70 0.18 27);

/* data-tone selectors */
[data-tone="good"]   { --tile-tone: var(--tone-good); }
[data-tone="warn"]   { --tile-tone: var(--tone-warn); }
[data-tone="danger"] { --tile-tone: var(--tone-danger); }
/* default: no data-tone → --tile-tone falls through to tile's CSS inheritance */
```

```tsx
// Applied on each tile div — color-mix handles opacity blending
<div
  data-tone={tone}     // "good" | "warn" | "danger" | undefined
  data-accent={kpi.accent}
  style={{
    backgroundColor: `color-mix(in oklch, var(--tile-tone, var(--accent-${kpi.accent})) 8%, transparent)`,
    borderColor: `color-mix(in oklch, var(--tile-tone, var(--accent-${kpi.accent})) ${borderPct}%, transparent)`,
  }}
  className="relative overflow-hidden rounded-lg border min-h-[72px] ..."
>
```

**`borderPct`:** 15 for `good`/`default`, 20 for `warn`/`danger` (per D-07).

### Pattern 5: SVG linearGradient for Area Fill

```tsx
// Gradient anchored to SVG coordinate system (gradientUnits="userSpaceOnUse")
// so bottom = tile bottom regardless of curve shape
<defs>
  <linearGradient
    id={`sparkline-grad-${id}`}
    x1="0" y1="0"
    x2="0" y2={height}          // vertical gradient, top→bottom
    gradientUnits="userSpaceOnUse"
  >
    <stop offset="0%" stopColor={accentColor} stopOpacity={0.08} />
    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
  </linearGradient>
</defs>
```

**Note:** Use `gradientUnits="userSpaceOnUse"` not `"objectBoundingBox"` — the area path includes the bottom rectangle section, making bounding-box coordinates unreliable. `userSpaceOnUse` anchors to SVG pixel coordinates so the gradient reliably fades to transparent at the bottom edge. [ASSUMED — standard SVG gradient practice]

### Pattern 6: thresholdTone() Utility

```typescript
// Source: extends existing thresholdColor() pattern in MetricCard.tsx [VERIFIED: codebase]
export type Tone = 'good' | 'warn' | 'danger' | 'default';

export function thresholdTone(value: number, config: ThresholdConfig): Tone {
  if (config.invertDirection) {
    if (value >= config.ok) return 'good';
    if (value >= config.warn) return 'warn';
    return 'danger';
  }
  if (value <= config.ok) return 'good';
  if (value <= config.warn) return 'warn';
  return 'danger';
}
```

### Anti-Patterns to Avoid

- **Using CSS `transition: d` for live morph:** Safari does not support `d` as a CSS property. The path will not update at all in Safari, not just fail to animate. Use Motion `animate={{ d }}` instead. [VERIFIED: caniuse.com]
- **Computing `getTotalLength()` manually:** Motion's `pathLength` property abstracts this. Manual `getTotalLength()` calls require a DOM ref and a layout effect — unnecessary complexity. [CITED: motion.dev/docs/react-svg-animation]
- **Using `gradientUnits="objectBoundingBox"` on area fill:** The closed area path (which includes horizontal lines at the bottom) has a non-standard bounding box. `userSpaceOnUse` is more predictable. [ASSUMED]
- **Generating different numbers of `C` commands between initial and updated path:** Motion requires the same path command count for morph interpolation. Flat synthetic sparklines must repeat the scalar 12 times (not use a single-point path).
- **Forgetting `useReducedMotion()`:** The existing `animation-duration: 0ms` CSS rule stops CSS animations but not Motion JS animations. Must explicitly check `useReducedMotion()` and skip `initial`/`animate` props.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cubic Bézier path animation | Custom tweening loop | `<motion.path animate={{ d }}>`| Motion handles JS interpolation, cross-browser, handles same-command-count constraint |
| Draw-in stroke animation | Manual stroke-dasharray math + getTotalLength() | Motion `pathLength` 0→1 | No DOM ref needed, works on any stroked SVG element |
| Opacity for color layers | Custom RGBA conversion from OKLCH | `color-mix(in oklch, color N%, transparent)` | Native CSS, already used in Phase 03, OKLCH-native |
| Smooth curve through points | Hand-coded Hermite spline | Catmull-Rom inline utility (~30 lines) | Centripetal variant avoids self-intersections; no library needed for 12 fixed points |

**Key insight:** D3.js is not installed and should not be added for sparkline math. The Catmull-Rom algorithm for 12 points is short enough to inline. Motion already handles the SVG animation contract completely.

---

## Common Pitfalls

### Pitfall 1: Safari CSS `d` Property Failure
**What goes wrong:** Using `style={{ transition: 'd 400ms' }}` or a CSS `transition: d` rule causes SVG paths to snap without animation in Safari — and in older Safari versions the path may not update at all (the property is completely ignored).
**Why it happens:** Safari has never shipped `d` as a CSS presentational property. [VERIFIED: caniuse.com/mdn-svg_elements_path_d_path]
**How to avoid:** Use `<motion.path animate={{ d: newPath }}>` — Motion interpolates in JS and sets the `d` attribute directly.
**Warning signs:** Path morph works in Chrome devtools but not in Safari preview.

### Pitfall 2: Path Command Count Mismatch
**What goes wrong:** Motion path morphing throws a warning and snaps instead of interpolating when the initial and target `d` strings have different numbers of commands.
**Why it happens:** Motion's path interpolation requires matching structure — it interpolates each command's coordinates individually.
**How to avoid:** Flat synthetic sparklines must pad to 12 points (e.g., `Array(12).fill(scalarValue)`). Validate with a `dev` warning if `data.length !== 12`.
**Warning signs:** Console warning from Motion about mismatched path commands; paths snap on update.

### Pitfall 3: prefers-reduced-motion Not Respected by Motion
**What goes wrong:** The `animation-duration: 0ms` CSS rule in `src/index.css` stops CSS `@keyframes` animations but does NOT stop Motion JS animations — draw-in and morph continue playing for users who have reduced motion enabled.
**Why it happens:** Motion uses `requestAnimationFrame`, not CSS animation, so the CSS media query rule has no effect.
**How to avoid:** Import `useReducedMotion` from `motion/react` and conditionally skip `initial`/`animate` props when it returns `true`.
**Warning signs:** Animations play in OS accessibility mode with reduced motion enabled.

### Pitfall 4: linearGradient ID Collision
**What goes wrong:** Multiple `BackgroundSparkline` instances share the same `<linearGradient id="sparkline-grad">` — the last one wins, all others render with the wrong gradient color.
**Why it happens:** SVG `<defs>` IDs are global in the document; all SVGs on the page share the same ID namespace.
**How to avoid:** Generate a unique ID per instance (e.g., `sparkline-grad-${kpi.label.replace(/\s/g,'')}`). Use `useId()` from React for stable SSR-safe IDs.
**Warning signs:** All tiles show the same accent color gradient regardless of their `data-accent` value.

### Pitfall 5: Flat Sparkline Rendering at Same Y
**What goes wrong:** A flat sparkline where all 12 values are equal (e.g., all 0 or all 5) produces `range = 0`, causing division by zero in the Y-scale normalization → NaN coordinates → invisible or broken path.
**Why it happens:** `(val - min) / range` with `range = 0` is undefined.
**How to avoid:** Guard with `const range = max - min || 1` (already done in existing `Sparkline.tsx` — copy this pattern). For all-zero flat lines, render the path at 90% of tile height (near the bottom, gradient nearly invisible, which is correct visual behavior).
**Warning signs:** SVG path contains `NaN` in coordinates; nothing renders.

### Pitfall 6: Tile Border Conflicts with Existing Styling
**What goes wrong:** Adding `border` and `borderColor` inline styles to the tile div conflicts with Tailwind utility classes applied in the same element.
**Why it happens:** Tailwind utility `border-*` and inline `style.borderColor` fight for specificity.
**How to avoid:** Either use all Tailwind (via `style` prop for dynamic OKLCH values Tailwind can't express statically) OR use all inline `style`. Given OKLCH `color-mix` values, use inline `style` for `backgroundColor` and `borderColor`. Remove any Tailwind border color classes from the same element.
**Warning signs:** Border color doesn't change with tone; inconsistent opacity between tiles.

---

## Code Examples

### BackgroundSparkline — Minimal Structure

```tsx
// Source: Pattern derived from motion.dev/docs/react-svg-animation [CITED] +
//         SVG linearGradient standard [ASSUMED]
import { memo, useId } from "react";
import { motion, useReducedMotion } from "motion/react";

interface BackgroundSparklineProps {
  data: number[];
  accentColor: string;  // CSS color string — var(--accent-cost) etc.
  tileIndex?: number;   // for stagger delay
}

function BackgroundSparklineInner({ data, accentColor, tileIndex = 0 }: BackgroundSparklineProps) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const width = 100;  // % — but SVG uses viewBox, not %; tile is measured via ref if needed
  const height = 72;
  const pad = { top: 4, bottom: 4, left: 8, right: 8 };

  const normalized = normalizeData(data, pad, width, height);
  const strokeD = catmullRomPath(normalized);
  const areaD = areaPath(strokeD, normalized, height - pad.bottom);

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    >
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={accentColor} stopOpacity={0.08} />
          <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <motion.path
        d={areaD}
        fill={`url(#sg-${id})`}
        initial={reduce ? undefined : { opacity: 0 }}
        animate={reduce ? undefined : { opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 }}
      />
      {/* Stroke curve — draw-in on mount */}
      <motion.path
        d={strokeD}
        fill="none"
        stroke={accentColor}
        strokeWidth={1.5}
        strokeOpacity={0.2}
        initial={reduce ? undefined : { pathLength: 0, opacity: 0 }}
        animate={reduce ? undefined : { pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 },
          opacity: { duration: 0.01 },
        }}
      />
    </svg>
  );
}

export const BackgroundSparkline = memo(BackgroundSparklineInner);
```

### Live Morph — Updating d on New Data

```tsx
// Motion re-animates to new d value automatically when prop changes
// Source: motion.dev/docs/react-svg-animation [CITED]
<motion.path
  d={strokeD}           // recomputed from new data on every poll
  fill="none"
  stroke={accentColor}
  strokeWidth={1.5}
  strokeOpacity={0.2}
  // After initial draw-in completes, subsequent d changes animate via transition:
  transition={{ duration: 0.4, ease: "easeInOut" }}
/>
// Note: pathLength stays at 1 after initial draw-in; only d changes on data update
```

### Synthetic Flat Sparkline Data

```typescript
// Source: pattern inferred from D-09/D-10 [VERIFIED: CONTEXT.md]
// Pad scalar to 12 buckets matching real sparkline length
const flatSparkline = (value: number, length = 12): number[] =>
  Array.from({ length }, () => value ?? 0);

// Usage in kpis array:
{ label: "Alerts", sparklineData: flatSparkline(stats.activeAlerts) }
{ label: "Security", sparklineData: flatSparkline(stats.securityEvents) }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| stroke-dasharray + getTotalLength() | Motion `pathLength` 0→1 | Motion v4+ | No DOM ref, works on all stroked elements |
| CSS `transition: d` | Motion `animate={{ d }}` | Ongoing (Safari never shipped) | Cross-browser morphing |
| RGBA for opacity layers | `color-mix(in oklch)` | Chrome 111, Firefox 113, Safari 15.4 | OKLCH-native opacity, no color space conversion |

**Deprecated/outdated:**
- SMIL `<animate>` for SVG path morphing: deprecated in Chrome (later un-deprecated), non-standard behavior. Don't use.
- Manual Bézier control point formulas using only neighboring points: produces corners. Catmull-Rom uses 4 points (look-ahead) for truly smooth curves.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `gradientUnits="userSpaceOnUse"` is more reliable than `objectBoundingBox` for the closed area path | Code Examples — linearGradient | Gradient may render incorrectly; test visually and flip to objectBoundingBox if needed |
| A2 | Motion `animate={{ d }}` works with same-count Catmull-Rom C-command paths without explicit `key` prop changes | Pattern 3 — live morph | May need `key={data.join(',')}` to force re-render; verify in browser |
| A3 | `useReducedMotion()` from motion/react correctly reads `prefers-reduced-motion` OS setting in this project's jsdom test environment | Pitfall 3 | Tests may need to mock it; add to test setup if it throws |
| A4 | `preserveAspectRatio="none"` on the SVG element produces correct stretching for non-square tiles in the responsive grid | Code Examples | May cause distortion on narrow tiles (2-col mobile); verify visually |

---

## Open Questions

1. **Error Rate sparkline derivation**
   - What we know: `eventSparkline` gives total event counts per 5-min bucket. No per-bucket error count is exposed by `heroStats.summary`.
   - What's unclear: Is there enough data in `eventSparkline` alone to derive a per-bucket error rate, or does this require a separate query?
   - Recommendation: For Phase 04 (KPI-05: no new queries), use `stats.errorRate` (the scalar hourly aggregate) to generate a flat sparkline for Error Rate — same synthetic flat treatment as Alerts. Document this as a known limitation. A future phase can add per-bucket error counts to the Convex query.

2. **BackgroundSparkline width/height as props vs CSS `100%`**
   - What we know: The UI-SPEC says "SVG fills 100% width and 100% height of tile (inset-0)". But SVG `width="100%"` with `viewBox` and `preserveAspectRatio="none"` requires the parent to have an explicit height — which the `min-h-[72px]` on the tile provides.
   - What's unclear: Whether the SVG should accept explicit pixel `width`/`height` props or rely on CSS `w-full h-full` with `position: absolute`.
   - Recommendation: Use CSS `w-full h-full` (absolute inset-0) with a fixed `viewBox="0 0 100 72"` and `preserveAspectRatio="none"`. No explicit pixel dimension props needed. This is simpler and matches the UI-SPEC intent.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code/CSS changes. All dependencies (motion, React, Tailwind, Vitest) are already installed and verified.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/components/BackgroundSparkline.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KPI-01 | BackgroundSparkline renders without crash | unit | `npx vitest run src/components/BackgroundSparkline.test.tsx` | ❌ Wave 0 |
| KPI-01 | catmullRomPath() produces valid SVG `d` string for 12-point input | unit | same | ❌ Wave 0 |
| KPI-01 | flatSparkline(0, 12) produces 12 zeros (no NaN in path) | unit | same | ❌ Wave 0 |
| KPI-02 | thresholdTone() returns correct tone for all threshold directions | unit | `npx vitest run src/components/MetricCard.test.tsx` | ❌ Wave 0 |
| KPI-02 | HeroStatsBar tiles have data-tone attribute after render | unit | `npx vitest run src/components/HeroStatsBar.test.tsx` | ❌ Wave 0 |
| CC-01 | BackgroundSparkline is memo-wrapped | unit | same BackgroundSparkline test | ❌ Wave 0 |
| CC-02 | All new components render without crash (smoke test) | unit | `npm test` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/BackgroundSparkline.test.tsx src/components/MetricCard.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/components/BackgroundSparkline.test.tsx` — covers KPI-01 smoke test + catmullRomPath unit tests
- [ ] `src/components/MetricCard.test.tsx` — covers KPI-02 thresholdTone() unit tests
- [ ] `src/components/HeroStatsBar.test.tsx` — covers KPI-02 data-tone attribute presence

**motion/react mock pattern** (established in AgentStatusTile.test.tsx — use same pattern):
```typescript
vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
    svg: ({ children, ...rest }: any) => <svg {...rest}>{children}</svg>,
  },
  useReducedMotion: () => false,
}));
```

---

## Security Domain

Step 2.6 security: This phase adds no authentication, no user input handling, no API calls, no data persistence, and no new Convex queries. All new code processes numeric arrays from an existing trusted hook. No ASVS categories apply.

---

## Sources

### Primary (HIGH confidence)
- motion.dev/docs/react-svg-animation — pathLength draw-in, animate d morphing, path command constraints
- motion.dev/tutorials/react-path-drawing — staggered pathLength variant pattern with custom prop
- caniuse.com/mdn-svg_elements_path_d_path — Safari CSS d property: UNSUPPORTED all versions; Chrome/Firefox/Edge: supported
- npm registry (via `npm list`) — motion@12.38.0, react@19.2.4, vitest@4.0.18
- `src/index.css` — Phase 03 OKLCH tokens, color-mix usage, existing reduced-motion rule
- `src/components/HeroStatsBar.tsx` — KpiDef interface, existing kpis[], thresholdColor usage
- `src/components/MetricCard.tsx` — AnimatedNumber, ThresholdConfig, thresholdColor signature
- `src/hooks/useHeroStats.ts` — eventSparkline, costSparkline, scalar fields
- `src/components/AgentStatusTile.test.tsx` — established motion/react vi.mock pattern
- `vitest.config.ts` — jsdom environment confirmed, setupFiles

### Secondary (MEDIUM confidence)
- gist.github.com/nicholaswmin/c2661eb11cad5671d816 — centripetal Catmull-Rom algorithm, MIT license, cross-verified against multiple spline references
- css-tricks.com/animate-svg-path-changes-in-css/ — CSS d transition Chromium-only finding, verified against caniuse

### Tertiary (LOW confidence)
- `gradientUnits="userSpaceOnUse"` recommendation for closed area paths — standard SVG practice, not explicitly verified against this exact path shape

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm list
- Architecture: HIGH — existing code structure read directly
- Motion SVG APIs: HIGH — verified against motion.dev official docs
- CSS d browser support: HIGH — verified against caniuse
- Catmull-Rom algorithm: MEDIUM — algorithm verified against known gist; centripetal variant correctness is established math
- SVG gradient pattern: MEDIUM — standard SVG practice, one assumption about gradientUnits

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (motion API stable; CSS support landscape unlikely to change in 30 days)
