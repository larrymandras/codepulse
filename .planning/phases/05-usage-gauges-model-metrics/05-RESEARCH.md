# Phase 05: Usage Gauges & Model Metrics — Research

**Researched:** 2026-05-15
**Domain:** SVG animation, CSS custom properties, React data visualization
**Confidence:** HIGH

---

## Summary

Phase 05 replaces flat tables and basic bar charts on the Analytics page with four rich visual
components: an SVG dial gauge row (three 76px meters), a horizontal stacked-bar model split strip
with expand-on-click detail, provider rows with radial gradient brand accents, and a time-range
window bar. All component decisions are locked in CONTEXT.md — no architecture choices remain.

The data layer is fully prepared. `api.forecasts.costForecast` supplies budget utilization
(currentMonthSpend, budgetCap, budgetStatus). `api.contextPressure.latestForActiveSession`
supplies context pressure percentage. `api.rateLimitEvents.recentByProvider` + the existing
`useRateLimitState` hook supply rate limit proximity. `api.llm.costByModel` supplies per-model
cost with calls/tokens/cost breakdown (exactly what UG-02's expand panel needs). Zero new Convex
queries are required.

The existing codebase establishes every pattern this phase extends: `motion/react` for SVG
animation, `data-accent`/`data-tone` CSS attribute injection, OKLCH token system, `thresholdTone()`
for semantic tone selection, `AnimatedNumber` for spring-animated values, and
`AnimatePresence`-based height transitions. The implementation is an extension of the Phase 03/04
design system, not a departure from it.

**Primary recommendation:** Build three new components (`DialGaugeRow`, `ModelSplitStrip`,
`WindowBar`), extend the `[data-provider]` CSS selector pattern in `index.css`, and integrate all
four into `Analytics.tsx` at the top of the page above the existing CostForecastPanel.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** 270-degree arc with bottom gap (speedometer style). 8px stroke, rounded caps. Animated
strokeDashoffset fills clockwise from left. Value (large) and label (small) centered inside ring.

**D-02:** Three equal-sized 76px gauges in a flex row: Budget Utilization, Context Pressure, Rate
Limit Proximity.

**D-03:** Gauges use the Phase 04 tone system — `thresholdTone()` returns good/warn/danger, driving
OKLCH tone tokens (`--tone-good/warn/danger`) for fill, track, and glow.

**D-04:** Horizontal stacked bar showing per-model cost allocation. Each segment proportional-width
div with flowing gradient fill. Segments colored from a sequential OKLCH palette (evenly spaced
hues). NOT grouped by provider brand color.

**D-05:** Click a segment → slide-down panel expands below the strip (AnimatePresence height
animation). Shows: model name, total cost, percentage, input/output token breakdown. Click same
segment = close. Click different = switch. Only one panel open at a time.

**D-06:** Hardcoded OKLCH provider palette as CSS tokens in `index.css`:
- `--provider-anthropic: oklch(0.70 0.15 45)`
- `--provider-openai: oklch(0.70 0.12 160)`
- `--provider-google: oklch(0.70 0.12 250)`
- `--provider-mistral: oklch(0.70 0.12 290)`
- `--provider-unknown: var(--accent-activity)` (fallback)

**D-07:** Applied via `data-provider` attribute on provider row elements, following `data-accent`
pattern from Phase 03. Radial gradient background uses the provider accent color.

**D-08:** Window bar time range: preset pill buttons 1h, 6h, 24h, 7d, 30d. Default 24h. No date
picker, no auto-follow.

**D-09:** Tick marks auto-adjust granularity: hourly intervals for 1h–24h, daily for 7d–30d.
Gradient fill shows usage intensity.

### Claude's Discretion

- Exact OKLCH lightness/chroma values for the sequential model palette (aim for perceptual
  distinction)
- SVG viewBox and coordinate math for the 270-degree arc path
- Whether the window bar gradient is linear or uses accent-based coloring
- Layout of the 3 gauges relative to existing Analytics page sections
- How to handle empty/zero states for gauges (no data yet)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UG-01 | SVG dial gauge component (76px circular) with animated strokeDashoffset showing utilization % | D-01/D-02/D-03 locked; `api.forecasts.costForecast`, `api.contextPressure.latestForActiveSession`, `api.rateLimitEvents.recentByProvider` are the three data sources |
| UG-02 | Model split strip: horizontal stacked bar, gradient fills, per-segment expand-on-click detail | `api.llm.costByModel` returns `{ [model]: { calls, tokens, cost } }` — all detail panel fields present. Sequential OKLCH palette needed |
| UG-03 | Service/provider rows use radial gradient backgrounds with brand-colored accents | `data-provider` CSS selector pattern mirrors `data-accent`; D-06/D-07 locked |
| UG-04 | Window bar visualization with gradient fills and tick marks | `api.aggregates.costByPeriod` with `period: "hourly"` + `lookbackDays` param supports all five presets |
| UG-05 | All data from existing Convex tables — no new aggregation logic | Verified: all four data sources already exist. See Data Sources section |
| UG-06 | Gauges animate smoothly on data updates | motion/react `animate` prop on `strokeDashoffset` + `useReducedMotion` guard already established in Phase 04 |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| SVG dial gauge rendering | Browser / Client | — | Pure SVG + CSS animation; no server state needed beyond data values |
| Gauge data (budget, context, rate limit) | API / Backend (Convex) | Browser / Client | Existing Convex queries; React hooks aggregate for the gauge row |
| Model split strip + expand panel | Browser / Client | — | Client-side proportional layout; data comes from one existing query |
| Provider row radial gradients | Browser / Client | — | CSS `data-provider` attribute injection; no server involvement |
| Window bar time-range selection | Browser / Client | API / Backend | Time range state local to component; query parameterized by lookback |
| Tick mark granularity | Browser / Client | — | Pure derived computation from selected time range |

---

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `motion` (motion/react) | ^12.38.0 | SVG animation (strokeDashoffset, AnimatePresence height) | Established Phase 04 pattern; `motion.path`, `useReducedMotion` already in use |
| `convex/react` | ^1.37.0 | `useQuery` subscriptions for live data | Project-wide data layer |
| React | ^19.2.4 | Component model | Project standard |
| Tailwind CSS 4 | ^4.2.1 | Layout and spacing utilities | Project standard |
| Vitest + @testing-library/react | ^4.0.18 / ^16.3.2 | Unit tests | Project standard |

### No New Dependencies

Phase 05 requires zero new npm packages. All animation, layout, and data patterns are already
present in the codebase.

**Version verification:** Confirmed from `package.json` directly. [VERIFIED: package.json]

---

## Architecture Patterns

### System Architecture Diagram

```
Convex subscriptions (3 queries)          Browser render pipeline
─────────────────────────────             ──────────────────────────────────────
api.forecasts.costForecast           →    DialGaugeRow
  .currentMonthSpend / .budgetCap         ├─ BudgetGauge  (tone from thresholdTone)
                                          ├─ ContextGauge (uses existing hook data)
api.contextPressure.latestForActiveSession│  └─ fillPercent from wsOverlay/Convex
                                          └─ RateLimitGauge
api.rateLimitEvents.recentByProvider           └─ state from useRateLimitState("all")
  (+ WS overlay via useRateLimitState)
                                     →    ModelSplitStrip
api.llm.costByModel                       ├─ proportional segments (sequential OKLCH)
  { model: { calls, tokens, cost } }      └─ AnimatePresence slide-down detail panel

api.aggregates.costByPeriod          →    WindowBar
  period:"hourly", lookbackDays:N         ├─ time range pill selector (local state)
                                          ├─ gradient SVG bar
                                          └─ tick marks (hourly or daily granularity)

index.css                            →    ProviderRows (via data-provider attribute)
  [data-provider="anthropic"] { ... }     └─ radial-gradient background (same as data-accent)
```

### Recommended Project Structure

```
src/
├── components/
│   ├── DialGaugeRow.tsx          # Three-gauge flex row (new)
│   ├── DialGauge.tsx             # Single 76px SVG arc gauge (new)
│   ├── ModelSplitStrip.tsx       # Stacked bar + expand panel (new)
│   ├── WindowBar.tsx             # Time-range bar with ticks (new)
│   └── (existing files unchanged)
├── index.css                     # Add [data-provider] tokens + selectors (extend)
└── pages/
    └── Analytics.tsx             # Insert new gauge row + strip + window bar (extend)
```

### Pattern 1: 270-Degree SVG Arc (D-01)

**What:** A circular arc that spans 270 degrees (3/4 of a circle) with a gap at the bottom. The
fill animates via `strokeDashoffset`.

**SVG coordinate math:**
- viewBox: `0 0 76 76` (matches 76px D-02 spec)
- Center: `cx=38, cy=38`
- Radius (to stroke center): `r=28` (leaves ~5px inset for 8px stroke each side, fits 76px box)
- Total arc circumference for 270°: `2π × 28 × (270/360)` = `~131.9`
- Arc path using `A` command for 270° arc (from 135° to 45°, going clockwise)

**esbuild Math.pow constraint** (from D-04-01 STATE.md decision): esbuild in this project does not
support the `**` operator — use `Math.pow()` in any SVG path math. [VERIFIED: STATE.md]

**Arc path approach:** Use two points at 225° offset (bottom-left to bottom-right going clockwise
through top). SVG `path d` with `A` command + `stroke-dasharray`/`stroke-dashoffset`:
- Full arc: `strokeDasharray={circumference}`, `strokeDashoffset={circumference * (1 - pct/100)}`
- Animates via `motion.circle` or `motion.path` `animate={{ strokeDashoffset }}`

**Example:**
```typescript
// Source: established pattern in ContextGauge.tsx + Phase 04 BackgroundSparkline
const R = 28;
const CIRCUMFERENCE = 2 * Math.PI * R * (270 / 360); // ~131.9 — use Math.pow NOT **
const offset = CIRCUMFERENCE * (1 - pct / 100);

<svg viewBox="0 0 76 76" width={76} height={76}>
  {/* Track arc */}
  <path d={arcPath270(38, 38, R)} fill="none"
    stroke="var(--border)" strokeWidth={8} strokeLinecap="round" />
  {/* Fill arc */}
  <motion.path d={arcPath270(38, 38, R)} fill="none"
    stroke={`var(--tone-${tone})`} strokeWidth={8} strokeLinecap="round"
    strokeDasharray={CIRCUMFERENCE}
    animate={{ strokeDashoffset: offset }}
    transition={{ duration: 0.5, ease: "easeOut" }}
  />
</svg>
```

**270° arc path helper** (returns SVG `d` string for a 270° arc centered at cx,cy with radius r):
```typescript
function arcPath270(cx: number, cy: number, r: number): string {
  // Start: 135° from east (bottom-left), End: 45° from east (bottom-right)
  // Going clockwise through top
  const startAngle = 135 * (Math.PI / 180);
  const endAngle = 45 * (Math.PI / 180);
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
}
```
[ASSUMED — coordinate math is correct but must be browser-verified against visual output]

### Pattern 2: AnimatePresence Height Expansion (D-05)

**What:** Model strip segment click → slide-down panel using `AnimatePresence` with height
`0 → auto`.

**motion/react v12 pattern** — `motion/react` (not `framer-motion`) is the installed package.
AnimatePresence with `initial={false}` prevents mount animation:

```typescript
// Source: motion/react docs pattern, consistent with HeroStatsBar.tsx usage
import { AnimatePresence, motion } from "motion/react";

<AnimatePresence>
  {activeSegment === model && (
    <motion.div
      key={model}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      {/* Detail panel content */}
    </motion.div>
  )}
</AnimatePresence>
```
[VERIFIED: motion/react pattern in HeroStatsBar.tsx and BackgroundSparkline.tsx]

### Pattern 3: data-provider CSS Attribute (D-06/D-07)

Follows the exact same pattern as Phase 03 `data-accent`:

```css
/* Phase 05: Provider accent tokens */
:root {
  --provider-anthropic: oklch(0.70 0.15 45);
  --provider-openai:    oklch(0.70 0.12 160);
  --provider-google:    oklch(0.70 0.12 250);
  --provider-mistral:   oklch(0.70 0.12 290);
  --provider-unknown:   var(--accent-activity);
}

[data-provider="anthropic"] {
  --provider-accent: var(--provider-anthropic);
  background-image: radial-gradient(120% 60% at 0% 50%,
    color-mix(in oklch, var(--provider-accent) 10%, transparent),
    transparent 55%);
}
/* ... repeated for each provider */
```
[VERIFIED: index.css data-accent pattern, lines 218–233]

### Pattern 4: Sequential OKLCH Palette for Model Strip (D-04)

Five evenly-spaced hues at L=0.70, C=0.14 (perceptually uniform in dark mode):

```typescript
// Source: [ASSUMED] — OKLCH hue spacing for 5+ models
const MODEL_PALETTE = [
  "oklch(0.70 0.14 200)",  // teal
  "oklch(0.70 0.14 280)",  // violet
  "oklch(0.70 0.14 50)",   // amber
  "oklch(0.70 0.14 320)",  // pink
  "oklch(0.70 0.14 140)",  // green
  "oklch(0.70 0.14 20)",   // red-orange
];
```

Note: Exact L/C values are Claude's Discretion per CONTEXT.md. The pattern of evenly-spaced hues
at constant L/C is the standard OKLCH palette technique.

### Pattern 5: Window Bar with Hourly Aggregates (D-08/D-09)

`api.aggregates.costByPeriod` accepts `{ period: "hourly", lookbackDays: N }`. For 1h/6h/24h
presets, pass `lookbackDays` as a fraction (1/24, 6/24, 1). For 7d/30d, pass integer. The query
returns rows with `bucket_start` timestamps — these drive the tick positions.

```typescript
const PRESETS = [
  { label: "1h",  lookbackDays: 1/24,  tickInterval: 3600, tickFmt: (t: number) => format(t, "ha").toLowerCase() },
  { label: "6h",  lookbackDays: 6/24,  tickInterval: 3600, tickFmt: (t: number) => format(t, "ha").toLowerCase() },
  { label: "24h", lookbackDays: 1,     tickInterval: 3600, tickFmt: (t: number) => format(t, "ha").toLowerCase() },
  { label: "7d",  lookbackDays: 7,     tickInterval: 86400, tickFmt: (t: number) => format(t, "EEE") },
  { label: "30d", lookbackDays: 30,    tickInterval: 86400, tickFmt: (t: number) => format(t, "EEE") },
] as const;
```

Note: The project does not currently use `date-fns`. Tick labels can be computed with vanilla
`Date` objects per D-09 spec ("6a", "12p" style). [VERIFIED: package.json — no date-fns installed]

### Anti-Patterns to Avoid

- **Using `**` operator in SVG math:** esbuild in this project rejects the `**` exponentiation
  operator. Use `Math.pow()` everywhere. [VERIFIED: STATE.md decision 04-01-D-01]
- **Importing `framer-motion`:** The installed package is `motion` (motion/react), not
  `framer-motion`. Imports must be `from "motion/react"`. [VERIFIED: package.json]
- **Hardcoded hex colors for gauge fill:** Gauges use `var(--tone-good/warn/danger)` tokens, not
  hex strings. ContextGauge.tsx uses hex — the new gauges must NOT follow that old pattern.
  [VERIFIED: D-03 decision, index.css tone tokens]
- **Creating new Convex aggregation queries:** UG-05 explicitly forbids this. All required data
  exists. [VERIFIED: convex/llm.ts, convex/forecasts.ts, convex/rateLimitEvents.ts]
- **CSS animations for strokeDashoffset:** Use `motion.path animate={}` not CSS `@keyframes` for
  gauge fill — allows Convex subscription-driven smooth updates without flash (UG-06).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spring animation on arc fill | Custom CSS keyframe | `motion.path` with `animate={{ strokeDashoffset }}` | Handles mid-animation value changes without jump — essential for UG-06 |
| Expand/collapse height animation | CSS max-height hack | `AnimatePresence` + `motion.div` height `0 → auto` | max-height approach causes timing issues; motion handles dynamic height |
| Reduced motion | `window.matchMedia` check | `useReducedMotion()` from motion/react | Already established in BackgroundSparkline; consistent pattern |
| Unique gradient IDs | Static string ID | `useId()` (React 18+) | Multiple gauge instances on same page would collide; established in BackgroundSparkline.tsx |

---

## Data Sources (UG-05 Verification)

All gauge data confirmed present in existing Convex tables:

| Gauge / Component | Convex Query | Return Shape | What to Extract |
|-------------------|-------------|--------------|-----------------|
| Budget Utilization | `api.forecasts.costForecast` | `{ currentMonthSpend, budgetCap, budgetStatus }` | `pct = currentMonthSpend / budgetCap * 100` |
| Context Pressure | `api.contextPressure.latestForActiveSession` | `{ fillPercent, tokensUsed, tokensMax }` | `fillPercent` directly |
| Rate Limit Proximity | `useRateLimitState(provider)` (wraps `api.rateLimitEvents.recentByProvider`) | `"ok" \| "warning" \| "hit"` | Map to 0 / 50 / 100% fill for gauge |
| Model Split Strip | `api.llm.costByModel` | `{ [model]: { calls, tokens, cost } }` | Cost per model → proportional widths; calls/tokens for expand panel |
| Provider Rows | `api.llm.providerBreakdown` | `[{ provider, calls, avgLatency, cost }]` | Provider name → `data-provider` attribute |
| Window Bar | `api.aggregates.costByPeriod` | `{ [provider]: totalCost }` grouped | Needs per-bucket hourly data — see note below |

**Window bar note:** `api.aggregates.costByPeriod` currently returns data grouped by provider
(summed), not time-bucketed rows. The underlying table has `bucket_start` per row. A thin new
query variant returning `[{ bucket_start, value }]` tuples (summed across providers) may be needed
for the window bar SVG. This is a small query addition — NOT a new aggregation mutation (data
already exists in the `aggregates` table). [VERIFIED: convex/aggregates.ts lines 143–167]

---

## Common Pitfalls

### Pitfall 1: strokeDashoffset Flash on Subscription Update

**What goes wrong:** On Convex subscription update, the gauge snaps to the new value instead of
animating, appearing as a flash/jump (violates UG-06).

**Why it happens:** If the `strokeDashoffset` value is computed inline in JSX and not passed
through `motion.path`'s `animate` prop, React re-renders produce instant DOM updates. Same issue
if `AnimatePresence` wraps the entire gauge instead of just the fill path.

**How to avoid:** `strokeDashoffset` MUST be in the `animate` prop of `motion.path`. Use
`transition={{ duration: 0.5, ease: "easeOut" }}`. Do not use CSS `transition` on the SVG
element.

**Warning signs:** Value jumps on rapid Convex updates during testing.

### Pitfall 2: 270-Degree Arc Path Edge Cases

**What goes wrong:** `pct=0` or `pct=100` causes degenerate arc paths (zero-length or full-circle
paths) that SVG renders incorrectly.

**Why it happens:** SVG arc commands with identical start/end points are undefined.

**How to avoid:** Clamp pct to `[0.5, 99.5]` before computing `strokeDashoffset`. The track arc
(background) is always rendered at full circumference independently.

**Warning signs:** Gauge disappears or renders as a dot at 0% or 100%.

### Pitfall 3: Model Strip with Zero-Cost Models

**What goes wrong:** `api.llm.costByModel` may include models with `cost: 0`. Proportional
width calculation divides by total cost — if all models have zero cost, produces `NaN` widths.

**Why it happens:** New installations with no LLM activity yet.

**How to avoid:** Guard: if `totalCost === 0`, render an empty-state placeholder instead of the
strip. If `totalCost > 0`, filter out models with `cost === 0` before computing proportions.

**Warning signs:** Strip renders with invisible segments or NaN in inline styles.

### Pitfall 4: Rate Limit Gauge Has No Continuous Percentage

**What goes wrong:** `useRateLimitState` returns a discrete state (`"ok" | "warning" | "hit"`),
not a 0–100% value. Mapping this to a gauge requires a discrete → continuous conversion that must
look intentional, not broken.

**How to avoid:** Map `ok → 0%`, `warning → 50%`, `hit → 100%` as placeholder fills. The gauge
for rate limit is more of a status indicator than a true percentage meter. Alternatively, use
`percentUsed` from `rateLimitEvents` if available. [ASSUMED — discrete mapping is a design
interpretation; may want to confirm with Larry]

### Pitfall 5: Window Bar Query Shape Mismatch

**What goes wrong:** The planner assumes the window bar can use `api.aggregates.costByPeriod`
directly, but that query returns `{ [provider]: totalCost }` (grouped, no time bucketing). The
window bar needs `[{ bucket_start, value }]`.

**How to avoid:** Plan must include a new thin Convex query
(`api.aggregates.costByPeriodTimeSeries` or similar) that returns hourly rows as an array of
`{ bucket_start, value }`. This is a read query against existing data — not new aggregation.
[VERIFIED: convex/aggregates.ts — existing query groups by provider, not time]

### Pitfall 6: motion/react AnimatePresence ID Collision

**What goes wrong:** If `DialGauge` is rendered multiple times (three times in `DialGaugeRow`)
and each uses a hardcoded `linearGradient` or `radialGradient` id, gradients bleed between
instances.

**How to avoid:** Use `useId()` from React for any SVG gradient `id` attributes, following the
pattern established in `BackgroundSparkline.tsx`. [VERIFIED: BackgroundSparkline.tsx line 2, 117]

---

## Code Examples

### Existing ContextGauge arc approach (reference — DO NOT copy style)

```typescript
// Source: src/components/ContextGauge.tsx lines 120–188
// The existing gauge uses a 180° semicircle and hex colors.
// Phase 05 gauges use 270° arcs and OKLCH tone tokens instead.
// Reference only for the strokeDasharray pattern.
const circumference = Math.PI * arcRadius; // half circle
const filled = (pct / 100) * circumference;
<path strokeDasharray={`${filled} ${circumference}`} />
```

### thresholdTone usage for gauge color

```typescript
// Source: src/components/MetricCard.tsx + HeroStatsBar.tsx
import { thresholdTone } from "./MetricCard";

const budgetTone = thresholdTone(pct, { ok: 70, warn: 90 }); // lower = better
// Returns: 'good' | 'warn' | 'danger'
// Use as: stroke={`var(--tone-${budgetTone})`}
```

### AnimatedNumber for gauge center value

```typescript
// Source: src/components/MetricCard.tsx lines 6–24
import { AnimatedNumber } from "./MetricCard";
// Already handles spring animation — use for the % value inside the gauge ring
<AnimatedNumber value={pct} format={(v) => `${Math.round(v)}%`} />
```

### costByModel data shape

```typescript
// Source: convex/llm.ts lines 73–91
// api.llm.costByModel returns:
// { [modelName: string]: { calls: number; tokens: number; cost: number } }
// Note: tokens = r.totalTokens (not split by prompt/completion)
// For input/output breakdown in the detail panel, use api.analytics.getBreakdown
// which returns grouped[provider][model].prompt + .completion
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hex color strings in gauge (`#22c55e`) | OKLCH tone tokens (`var(--tone-good)`) | Phase 03/04 | Dark mode handled automatically |
| `framer-motion` package | `motion` / `motion/react` package | ~2024 rebrand | Import path changed to `"motion/react"` |
| CSS `transition` on SVG attributes | `motion.path animate={}` | Phase 04 | Handles mid-value interruption correctly |
| Recharts BarChart for cost breakdown | Custom stacked div strip (Phase 05) | Now | More control over gradient fills and expand interaction |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 270° arc SVG coordinate math (arcPath270 helper) | Code Examples / Pattern 1 | Gauge renders incorrectly; needs visual verification in browser |
| A2 | Sequential OKLCH palette `L=0.70 C=0.14` at 6 evenly-spaced hues | Pattern 4 | Segments may not be sufficiently distinct; palette is Claude's Discretion so low risk |
| A3 | Rate limit gauge maps to 0/50/100% for ok/warning/hit | Common Pitfalls #4 | May look like a broken gauge; confirm this discrete mapping is acceptable |
| A4 | Window bar needs a new thin Convex read query for time-bucketed data | Data Sources | If existing query is sufficient, a task can be eliminated |

---

## Open Questions

1. **Rate limit gauge: discrete vs. continuous**
   - What we know: `useRateLimitState` returns `"ok" | "warning" | "hit"` — not a percentage.
     `rateLimitEvents` does store `percentUsed` and `currentRpm/limitRpm` fields (optional).
   - What's unclear: Should the gauge show the discrete 0/50/100 mapping, or should it try to read
     `percentUsed` from the most recent `rateLimitEvents` row?
   - Recommendation: Check if `percentUsed` is reliably populated. If so, use it for a true
     percentage. If not, use the 0/50/100 discrete mapping.

2. **Window bar query shape**
   - What we know: `costByPeriod` returns provider-grouped totals, not time-series arrays.
   - What's unclear: Whether the planner should add a new thin query or compose from the same
     table differently.
   - Recommendation: Plan includes one new Convex read query
     (`api.aggregates.costTimeSeriesHourly` or equivalent) that returns
     `[{ bucket_start: number, value: number }]`.

3. **Budget gauge when no budget cap is set**
   - What we know: `costForecast.budgetCap` can be `null` when no cap is configured.
   - What's unclear: What the Budget Utilization gauge should show in this state.
   - Recommendation: Show 0% fill with a "No budget set" label override, or render a static
     `--` value. This is Claude's Discretion.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 05 is purely frontend component additions + CSS token additions. No
external tools, services, CLIs, or runtimes beyond the existing dev server (`npm run dev`) are
required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 + @testing-library/react ^16.3.2 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/components/DialGauge.test.tsx src/components/ModelSplitStrip.test.tsx src/components/WindowBar.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UG-01 | DialGauge renders SVG with correct arc path at 0%, 50%, 100% | unit | `npx vitest run src/components/DialGauge.test.tsx -t "renders"` | ❌ Wave 0 |
| UG-01 | thresholdTone drives correct tone class on gauge | unit | `npx vitest run src/components/DialGauge.test.tsx -t "tone"` | ❌ Wave 0 |
| UG-01 | Gauge renders zero-state without crash when data is null | unit | `npx vitest run src/components/DialGauge.test.tsx -t "empty"` | ❌ Wave 0 |
| UG-02 | ModelSplitStrip renders one segment per model | unit | `npx vitest run src/components/ModelSplitStrip.test.tsx -t "segments"` | ❌ Wave 0 |
| UG-02 | Clicking a segment opens the detail panel | unit | `npx vitest run src/components/ModelSplitStrip.test.tsx -t "expand"` | ❌ Wave 0 |
| UG-02 | Clicking the same segment closes the panel | unit | `npx vitest run src/components/ModelSplitStrip.test.tsx -t "collapse"` | ❌ Wave 0 |
| UG-02 | Zero-cost guard: renders empty state when totalCost === 0 | unit | `npx vitest run src/components/ModelSplitStrip.test.tsx -t "empty"` | ❌ Wave 0 |
| UG-04 | WindowBar renders tick marks at correct count for each preset | unit | `npx vitest run src/components/WindowBar.test.tsx -t "ticks"` | ❌ Wave 0 |
| UG-06 | DialGauge does not include NaN in SVG d attribute | unit | `npx vitest run src/components/DialGauge.test.tsx -t "NaN"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/components/DialGauge.test.tsx src/components/ModelSplitStrip.test.tsx src/components/WindowBar.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/DialGauge.test.tsx` — covers UG-01
- [ ] `src/components/ModelSplitStrip.test.tsx` — covers UG-02
- [ ] `src/components/WindowBar.test.tsx` — covers UG-04, UG-06
- [ ] Motion mock for `motion.path` — follow BackgroundSparkline.test.tsx pattern (mock `motion.path` as plain `<path>`)

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 05 |
|-----------|---------------------|
| All animations must respect `prefers-reduced-motion` | Yes — use `useReducedMotion()` from motion/react on all new animated components |
| OKLCH everywhere — all new tokens must be OKLCH | Yes — D-06 provider tokens, sequential model palette |
| CSS custom properties via `data-*` attributes — extend with `data-provider` | Yes — D-07 |
| Phase comments in CSS (`/* Phase 05: provider tokens */`) | Yes — add comment block in index.css |
| Use `Math.pow()` not `**` operator | Yes — SVG arc math |
| Imports from `"motion/react"` not `"framer-motion"` | Yes — all new animated components |
| No new Convex table schema changes for phases 03-05 (CC-04) | Yes — no schema changes; only a thin read query addition |
| All new components follow CC-01: shadcn/ui primitives, Lucide icons, Motion, memo-optimized | Yes |
| All new components have Vitest test coverage (CC-02) | Yes — Wave 0 gap list above |
| All visual changes verified in browser (CC-05) | Yes — phase gate |
| Ástríðr API calls must include `Authorization: Bearer` header | Not applicable — no Ástríðr API calls in this phase |

---

## Sources

### Primary (HIGH confidence)

- `convex/aggregates.ts` — costByPeriod query shape verified [VERIFIED: local file]
- `convex/llm.ts` — costByModel and providerBreakdown return shapes [VERIFIED: local file]
- `convex/forecasts.ts` — budget cap and currentMonthSpend data [VERIFIED: local file]
- `convex/rateLimitEvents.ts` + `src/hooks/useRateLimitState.ts` — rate limit data [VERIFIED: local files]
- `src/index.css` — existing token system, data-accent pattern [VERIFIED: local file]
- `src/components/MetricCard.tsx` — thresholdTone, AnimatedNumber [VERIFIED: local file]
- `src/components/BackgroundSparkline.tsx` — motion/react animation patterns [VERIFIED: local file]
- `src/components/HeroStatsBar.tsx` — three-layer tile, AnimatePresence pattern [VERIFIED: local file]
- `src/components/ContextGauge.tsx` — existing SVG arc gauge reference [VERIFIED: local file]
- `package.json` — library versions [VERIFIED: local file]
- `.planning/STATE.md` — Math.pow constraint, motion.path morph pattern [VERIFIED: local file]

### Secondary (MEDIUM confidence)

None required — all findings sourced from local codebase.

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies confirmed in package.json
- Architecture: HIGH — all patterns verified in existing source files
- Data sources: HIGH — all Convex queries read and return shapes confirmed
- SVG arc math: MEDIUM — coordinate math is standard but requires browser visual verification
- Pitfalls: HIGH — derived from direct code inspection + STATE.md decisions

**Research date:** 2026-05-15
**Valid until:** 2026-06-15 (stable stack — no fast-moving dependencies)
