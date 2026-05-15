# Phase 05: Usage Gauges & Model Metrics - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Cost and usage data on the Analytics page transforms from flat tables and basic bar charts into rich visual components — SVG dial gauges for utilization metrics, a horizontal stacked-bar model split strip with expand-on-click detail, provider rows with radial gradient brand-color backgrounds, and a time-range window bar with gradient fill and tick marks. All data comes from existing Convex analytics/cost tables — no new aggregation mutations.

</domain>

<decisions>
## Implementation Decisions

### Dial Gauge Shape & Styling
- **D-01:** 270-degree arc with a bottom gap (speedometer style). 8px stroke, rounded caps. Animated strokeDashoffset fills clockwise from left. Value (large) and label (small) centered inside the ring.
- **D-02:** Three equal-sized 76px gauges in a flex row: Budget Utilization, Context Pressure, Rate Limit Proximity.
- **D-03:** Gauges use the Phase 04 tone system — `thresholdTone()` returns good/warn/danger, driving OKLCH tone tokens (`--tone-good/warn/danger`) for fill, track, and glow. Dark mode handled automatically by the existing `.dark` token block.

### Model Split Strip
- **D-04:** Horizontal stacked bar showing per-model cost allocation. Each segment is a proportional-width div with flowing gradient fill. Segments colored from a sequential OKLCH palette (evenly spaced hues) — NOT grouped by provider brand color. Easy to distinguish 5+ models regardless of provider.
- **D-05:** Click a segment → slide-down panel expands below the strip (AnimatePresence height animation). Shows: model name, total cost, percentage, input/output token breakdown. Click same segment = close. Click different segment = switch. Only one panel open at a time.

### Provider Brand Colors
- **D-06:** Hardcoded OKLCH provider palette as CSS tokens in `index.css`:
  - `--provider-anthropic: oklch(0.70 0.15 45)` (warm orange)
  - `--provider-openai: oklch(0.70 0.12 160)` (teal green)
  - `--provider-google: oklch(0.70 0.12 250)` (blue)
  - `--provider-mistral: oklch(0.70 0.12 290)` (violet)
  - `--provider-unknown: var(--accent-activity)` (fallback)
- **D-07:** Applied via `data-provider` attribute on provider row elements, following the `data-accent` pattern from Phase 03. Radial gradient background uses the provider accent color.

### Window Bar Time Controls
- **D-08:** Row of preset pill buttons: 1h, 6h, 24h, 7d, 30d. Default selection is 24h. No date picker, no auto-follow.
- **D-09:** Tick marks auto-adjust granularity: hourly intervals for 1h–24h presets, daily intervals for 7d–30d presets. Gradient fill shows usage intensity.

### Claude's Discretion
- Exact OKLCH lightness/chroma values for the sequential model palette (aim for perceptual distinction)
- SVG viewBox and coordinate math for the 270-degree arc path
- Whether the window bar gradient is linear or uses accent-based coloring
- Layout of the 3 gauges relative to existing Analytics page sections
- How to handle empty/zero states for gauges (no data yet)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS-v5.md` — UG-01 through UG-06 requirements for this phase

### Design System & Tokens
- `src/index.css` — Token definitions (`:root` and `.dark` blocks), accent hues from Phase 03, tone tokens from Phase 04, `data-accent` and `data-tone` selectors
- `src/components/MetricCard.tsx` — AnimatedNumber, thresholdTone(), ThresholdConfig — gauge coloring reuses this

### Target Page
- `src/pages/Analytics.tsx` — Primary edit target: existing analytics layout with costByProvider, eventCounts, llmCalls queries already wired

### Existing Gauge Reference
- `src/components/ContextGauge.tsx` — Existing context pressure gauge with threshold coloring (different pattern, but useful for data flow reference)

### Existing Charts
- `src/components/FlexBarChart.tsx` — Existing horizontal bar chart component (may inform model split strip approach)
- `src/components/ProjectCostBreakdown.tsx` — Existing cost breakdown component being replaced/upgraded

### Animation Patterns (from Phase 04)
- `src/components/BackgroundSparkline.tsx` — Motion animation patterns (draw-in, live morph) established in Phase 04
- `src/components/HeroStatsBar.tsx` — Three-layer tile pattern, data-tone usage, color-mix inline styles

### Prior Phase Context
- `.planning/phases/03-design-token-refresh/03-CONTEXT.md` — OKLCH tokens, accent hues, radial gradient pattern
- `.planning/phases/04-kpi-panel-redesign/04-CONTEXT.md` — Tone system, BackgroundSparkline, thresholdTone()

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **thresholdTone()** (`MetricCard.tsx`): Returns semantic tone strings — gauges reuse this for fill color
- **AnimatedNumber** (`MetricCard.tsx`): Spring-animated count display — use for gauge center values
- **data-accent / data-tone patterns** (`index.css`): CSS custom property injection via HTML attributes — provider rows follow this with `data-provider`
- **FlexBarChart** (`FlexBarChart.tsx`): Existing horizontal bar — model strip may reference its proportional-width approach
- **useQuery hooks** (`Analytics.tsx`): `costByProvider`, `eventCounts`, `useLlmMetrics` already wired — no new Convex queries needed
- **ContextGauge** (`ContextGauge.tsx`): Existing gauge with WebSocket overlay + Convex queries for context pressure data

### Established Patterns
- **OKLCH everywhere**: All tokens are OKLCH. New provider tokens and sequential palette must use OKLCH.
- **CSS custom properties via data attributes**: `data-accent`, `data-tone` → extend with `data-provider`
- **Motion/Framer Motion for animations**: Phase 04 established motion.path for SVG animations. Gauges and strip transitions follow this.
- **prefers-reduced-motion**: All new animations must respect this media query.
- **Phase comments in CSS**: New token groups commented with phase number (`/* Phase 05: provider tokens */`)

### Integration Points
- `src/pages/Analytics.tsx` — New gauge row, model strip, and window bar integrate into existing page layout
- `src/index.css` — Add provider accent tokens and sequential palette tokens
- Convex `api.aggregates.costByPeriod` — Already returns provider-keyed cost data (source for provider rows and model strip)

</code_context>

<specifics>
## Specific Ideas

- Gauge bottom gap gives a "meter" feel — think car dashboard, not loading spinner
- Model strip slide-down uses AnimatePresence for smooth height transition, matching the premium animation language from Phase 04
- Provider radial gradient follows exact same pattern as Phase 03 card accents: `radial-gradient(120% 60% at 0% 50%, ${accent}10, transparent 55%)`
- Window bar tick labels should be concise: "6a", "12p", "3a" style for hourly, "Mon", "Tue" for daily

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-Usage Gauges & Model Metrics*
*Context gathered: 2026-05-15*
