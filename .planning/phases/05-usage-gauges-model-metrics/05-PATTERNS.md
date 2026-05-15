# Phase 05: Usage Gauges & Model Metrics - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 7 (4 new components, 1 new Convex query, 1 CSS extend, 1 page modify)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/DialGauge.tsx` | component | request-response | `src/components/BackgroundSparkline.tsx` | exact (SVG + motion.path + useReducedMotion + useId) |
| `src/components/DialGaugeRow.tsx` | component | request-response | `src/components/HeroStatsBar.tsx` | role-match (multi-metric row, thresholdTone, data-tone) |
| `src/components/ModelSplitStrip.tsx` | component | CRUD | `src/components/FlexBarChart.tsx` + `src/components/JumpToLatestPill.tsx` | role-match (proportional bar) + role-match (AnimatePresence) |
| `src/components/WindowBar.tsx` | component | request-response | `src/components/ContextGauge.tsx` | role-match (Convex query + SVG render + state) |
| `convex/aggregates.ts` (extend) | service | CRUD | `convex/aggregates.ts` lines 169–191 (`errorTrendByPeriod`) | exact (time-bucketed rows query pattern) |
| `src/index.css` (extend) | config | — | `src/index.css` lines 232–252 | exact (data-accent + data-tone CSS attribute blocks) |
| `src/pages/Analytics.tsx` (extend) | component | request-response | `src/pages/Analytics.tsx` lines 1–84 | self (existing import and SectionErrorBoundary pattern) |

---

## Pattern Assignments

### `src/components/DialGauge.tsx` (component, request-response)

**Analog:** `src/components/BackgroundSparkline.tsx`

**Imports pattern** (BackgroundSparkline.tsx lines 1–2):
```typescript
import { memo, useId } from "react";
import { motion, useReducedMotion } from "motion/react";
```

**useId + useReducedMotion pattern** (BackgroundSparkline.tsx lines 93–95):
```typescript
const id = useId().replace(/:/g, '');
const shouldReduce = useReducedMotion();
```

**motion.path animate pattern for SVG arc fill** (BackgroundSparkline.tsx lines 131–144):
```typescript
<motion.path
  d={strokeD}
  fill="none"
  stroke={accentColor}
  strokeWidth={1.5}
  initial={shouldReduce ? undefined : { pathLength: 0, opacity: 0 }}
  animate={shouldReduce ? undefined : { pathLength: 1, opacity: 1 }}
  transition={{
    pathLength: { duration: 0.6, ease: "easeOut", delay: tileIndex * 0.1 },
    d: { duration: 0.4, ease: "easeInOut" },
  }}
/>
```

**For DialGauge, adapt this to strokeDashoffset:**
```typescript
// strokeDashoffset MUST be in animate prop (not inline style) for smooth Convex subscription updates
<motion.path
  d={arcPath270(38, 38, R)}
  fill="none"
  stroke={`var(--tone-${tone})`}
  strokeWidth={8}
  strokeLinecap="round"
  strokeDasharray={CIRCUMFERENCE}
  animate={{ strokeDashoffset: shouldReduce ? offset : offset }}
  transition={{ duration: 0.5, ease: "easeOut" }}
/>
```

**linearGradient useId pattern** (BackgroundSparkline.tsx lines 111–121):
```typescript
<defs>
  <linearGradient
    id={`sg-${id}`}
    x1="0" y1="0"
    x2="0" y2={VIEWBOX_H}
    gradientUnits="userSpaceOnUse"
  >
    <stop offset="0%" stopColor={accentColor} stopOpacity={0.05} />
    <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
  </linearGradient>
</defs>
```
Use `id={`track-${id}`}` and `id={`glow-${id}`}` for DialGauge SVG defs — same collision-avoidance pattern.

**SVG arc math** (Research.md Pattern 1 — Math.pow required, NOT `**`):
```typescript
const R = 28;
// MUST use Math.pow() — esbuild rejects ** operator (STATE.md decision 04-01-D-01)
const CIRCUMFERENCE = 2 * Math.PI * R * (270 / 360); // ~131.9

function arcPath270(cx: number, cy: number, r: number): string {
  const startAngle = 135 * (Math.PI / 180);
  const endAngle   = 45  * (Math.PI / 180);
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  return `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${ex} ${ey}`;
}

// Clamp to [0.5, 99.5] to prevent degenerate arc at 0% and 100% (RESEARCH Pitfall 2)
const safePct = Math.min(Math.max(pct, 0.5), 99.5);
const offset = CIRCUMFERENCE * (1 - safePct / 100);
```

**Empty/null state pattern** (ContextGauge.tsx lines 105–112):
```typescript
if (!latest) {
  return (
    <div className="glass-panel lift-on-hover rounded-2xl p-4">
      <p className="text-sm text-gray-500 py-6 text-center">No context data</p>
    </div>
  );
}
```

**AnimatedNumber for gauge center value** (MetricCard.tsx lines 6–23):
```typescript
import { AnimatedNumber } from "./MetricCard";

// Inside gauge SVG overlay div:
<AnimatedNumber value={pct} format={(v) => `${Math.round(v)}%`} />
```

**thresholdTone for gauge stroke color** (MetricCard.tsx lines 50–61):
```typescript
import { thresholdTone } from "./MetricCard";

// Budget utilization — lower is better
const tone = thresholdTone(pct, { ok: 70, warn: 90 });
// Returns: 'good' | 'warn' | 'danger'
// Apply as: stroke={`var(--tone-${tone})`}
```

**memo wrapping** (BackgroundSparkline.tsx line 149):
```typescript
export const DialGauge = memo(DialGaugeInner);
```

---

### `src/components/DialGaugeRow.tsx` (component, request-response)

**Analog:** `src/components/HeroStatsBar.tsx`

**Imports pattern** (HeroStatsBar.tsx lines 1–8):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AnimatedNumber, thresholdColor, ThresholdConfig, thresholdTone, Tone } from "./MetricCard";
import { BackgroundSparkline, flatSparkline } from "./BackgroundSparkline";
```

For DialGaugeRow, adapt:
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { thresholdTone } from "./MetricCard";
import { useRateLimitState } from "../hooks/useRateLimitState";
import DialGauge from "./DialGauge";
```

**Three-metric row layout** (HeroStatsBar.tsx lines 144):
```typescript
<div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
```
For DialGaugeRow, use flex row with three equal gauges:
```typescript
<div className="flex items-center gap-4">
  <DialGauge pct={budgetPct} label="Budget" thresholds={{ ok: 70, warn: 90 }} />
  <DialGauge pct={contextPct} label="Context" thresholds={{ ok: 60, warn: 85 }} />
  <DialGauge pct={rateLimitPct} label="Rate Limit" thresholds={{ ok: 0, warn: 50 }} />
</div>
```

**data-tone attribute spreading** (HeroStatsBar.tsx lines 170–172):
```typescript
data-accent={kpi.accent}
{...(tone !== 'default' ? { "data-tone": tone } : {})}
```

**SectionErrorBoundary wrapping** (Analytics.tsx lines 79–83):
```typescript
<SectionErrorBoundary name="Usage Gauges">
  <GlassPanel className="p-4">
    <DialGaugeRow />
  </GlassPanel>
</SectionErrorBoundary>
```

---

### `src/components/ModelSplitStrip.tsx` (component, CRUD)

**Primary analog:** `src/components/FlexBarChart.tsx` (proportional layout)
**Secondary analog:** `src/components/JumpToLatestPill.tsx` (AnimatePresence pattern)

**Proportional-width segment approach** (FlexBarChart.tsx lines 13–32):
```typescript
// FlexBarChart uses proportional height — ModelSplitStrip uses proportional WIDTH
const maxVal = Math.max(...data.map(d => d.value), 1);
// For ModelSplitStrip:
const totalCost = models.reduce((s, m) => s + m.cost, 0);
// Each segment:
<div
  key={model.name}
  style={{ width: `${(model.cost / totalCost) * 100}%` }}
  onClick={() => setActiveSegment(prev => prev === model.name ? null : model.name)}
/>
```

**Click handler + tooltip pattern** (FlexBarChart.tsx lines 19–26):
```typescript
<div
  key={d.label}
  className="relative flex-1 group cursor-pointer"
  onClick={() => onSegmentClick?.(d.label, d.value)}
>
  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border border-border px-2 py-1 text-xs text-popover-foreground whitespace-nowrap z-10">
    {d.label}: {d.value}
  </div>
</div>
```

**AnimatePresence expand/collapse** (JumpToLatestPill.tsx lines 8, 20–37):
```typescript
import { motion, useReducedMotion, AnimatePresence } from "motion/react";

// Slide-down detail panel — height 0 → auto:
<AnimatePresence>
  {activeSegment === model.name && (
    <motion.div
      key={model.name}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="overflow-hidden"
    >
      {/* Detail panel: model name, total cost, %, input/output tokens */}
    </motion.div>
  )}
</AnimatePresence>
```

**Zero-cost guard** (Research.md Pitfall 3):
```typescript
if (totalCost === 0) {
  return <p className="text-sm text-muted-foreground py-4 text-center">No model cost data</p>;
}
const models = Object.entries(rawData)
  .filter(([, v]) => v.cost > 0)
  .map(([name, v]) => ({ name, ...v }));
```

**Sequential OKLCH palette** (Research.md Pattern 4):
```typescript
// Evenly-spaced hues — index assigned per model, wraps if > 6 models
const MODEL_PALETTE = [
  "oklch(0.70 0.14 200)",  // teal
  "oklch(0.70 0.14 280)",  // violet
  "oklch(0.70 0.14 50)",   // amber
  "oklch(0.70 0.14 320)",  // pink
  "oklch(0.70 0.14 140)",  // green
  "oklch(0.70 0.14 20)",   // red-orange
];
const getModelColor = (idx: number) => MODEL_PALETTE[idx % MODEL_PALETTE.length];
```

---

### `src/components/WindowBar.tsx` (component, request-response)

**Analog:** `src/components/ContextGauge.tsx` (Convex query + local state + SVG render)

**Imports pattern** (ContextGauge.tsx lines 1–4):
```typescript
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
```

**Local state for time-range selection:**
```typescript
// Following ContextGauge's wsOverlay state pattern — local state controls query params
const [preset, setPreset] = useState<"1h" | "6h" | "24h" | "7d" | "30d">("24h");

const PRESETS = [
  { label: "1h",  lookbackDays: 1/24,  tickInterval: 3600,  granularity: "hourly" },
  { label: "6h",  lookbackDays: 6/24,  tickInterval: 3600,  granularity: "hourly" },
  { label: "24h", lookbackDays: 1,     tickInterval: 3600,  granularity: "hourly" },
  { label: "7d",  lookbackDays: 7,     tickInterval: 86400, granularity: "daily"  },
  { label: "30d", lookbackDays: 30,    tickInterval: 86400, granularity: "daily"  },
] as const;

const active = PRESETS.find(p => p.label === preset)!;
// New thin Convex query (see convex/aggregates.ts extension below):
const timeSeries = useQuery(api.aggregates.costTimeSeriesHourly, {
  lookbackDays: active.lookbackDays,
});
```

**Pill button row:**
```typescript
<div className="flex gap-1 mb-3">
  {PRESETS.map(p => (
    <button
      key={p.label}
      onClick={() => setPreset(p.label)}
      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
        preset === p.label
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {p.label}
    </button>
  ))}
</div>
```

**Tick label formatting** (vanilla Date, no date-fns — package.json confirms no date-fns):
```typescript
// "6a", "12p", "3a" style for hourly; "Mon", "Tue" for daily
function fmtTick(ts: number, granularity: "hourly" | "daily"): string {
  const d = new Date(ts * 1000);
  if (granularity === "daily") {
    return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
  }
  const h = d.getHours();
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
```

**useMemo for derived sparkline data** (ContextGauge.tsx lines 85–91):
```typescript
const sparkline = useMemo(() => {
  if (!history || history.length === 0) return [] as number[];
  return [...history]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-20)
    .map((s) => s.fillPercent);
}, [history]);
```

---

### `convex/aggregates.ts` — new `costTimeSeriesHourly` query (service, CRUD)

**Analog:** `convex/aggregates.ts` lines 169–191 (`errorTrendByPeriod`)

**errorTrendByPeriod as direct template** (aggregates.ts lines 169–191):
```typescript
export const errorTrendByPeriod = query({
  args: {
    period: v.string(),
    lookbackHours: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackHours ?? 24) * 3600;
    const cutoff = Date.now() / 1000 - lookback;

    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "errors").eq("period", args.period).gte("bucket_start", cutoff)
      )
      .collect();

    return rows.map((r) => ({
      bucket_start: r.bucket_start,
      errors: r.value,
      category: (r.dimensions as { error_category?: string } | null)?.error_category ?? "unknown",
    }));
  },
});
```

**New query — copy this pattern exactly:**
```typescript
export const costTimeSeriesHourly = query({
  args: {
    lookbackDays: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const lookback = (args.lookbackDays ?? 1) * 86400;
    const cutoff = Date.now() / 1000 - lookback;

    const rows = await ctx.db
      .query("aggregates")
      .withIndex("by_type_period_bucket", (q) =>
        q.eq("metric_type", "cost").eq("period", "hourly").gte("bucket_start", cutoff)
      )
      .collect();

    // Sum across providers per bucket — returns time-series array for WindowBar SVG
    const byBucket: Record<number, number> = {};
    for (const r of rows) {
      byBucket[r.bucket_start] = (byBucket[r.bucket_start] ?? 0) + r.value;
    }
    return Object.entries(byBucket)
      .map(([ts, value]) => ({ bucket_start: Number(ts), value }))
      .sort((a, b) => a.bucket_start - b.bucket_start);
  },
});
```

---

### `src/index.css` — provider accent tokens + selectors (config)

**Analog:** `src/index.css` lines 193–252 (Phase 03 data-accent + Phase 04 data-tone blocks)

**Exact pattern to replicate** (index.css lines 193–198, 232–252):
```css
/* Phase 03: Category accent tokens */
--accent-cost: oklch(0.70 0.15 80);
--accent-health: oklch(0.70 0.15 142);
/* ... */

/* Phase 03: Category accent radial gradient backgrounds (D-05) */
[data-accent="cost"] {
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--accent-cost) 10%, transparent), transparent 55%);
}
/* ... */

/* Phase 04: Tone selectors (D-05, D-06, D-07) */
[data-tone="good"]   { --tile-tone: var(--tone-good); }
[data-tone="warn"]   { --tile-tone: var(--tone-warn); }
[data-tone="danger"] { --tile-tone: var(--tone-danger); }
```

**New Phase 05 block to add after line 252:**
```css
/* Phase 05: Provider accent tokens */
:root {
  --provider-anthropic: oklch(0.70 0.15 45);
  --provider-openai:    oklch(0.70 0.12 160);
  --provider-google:    oklch(0.70 0.12 250);
  --provider-mistral:   oklch(0.70 0.12 290);
  --provider-unknown:   var(--accent-activity);
}

/* Phase 05: Provider radial gradient backgrounds — mirrors data-accent pattern (D-07) */
[data-provider="anthropic"] {
  --provider-accent: var(--provider-anthropic);
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--provider-accent) 10%, transparent), transparent 55%);
}
[data-provider="openai"] {
  --provider-accent: var(--provider-openai);
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--provider-accent) 10%, transparent), transparent 55%);
}
[data-provider="google"] {
  --provider-accent: var(--provider-google);
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--provider-accent) 10%, transparent), transparent 55%);
}
[data-provider="mistral"] {
  --provider-accent: var(--provider-mistral);
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--provider-accent) 10%, transparent), transparent 55%);
}
[data-provider="unknown"] {
  --provider-accent: var(--provider-unknown);
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--provider-accent) 10%, transparent), transparent 55%);
}
```

Note: Dark-mode values for `--provider-*` tokens are NOT needed separately — the OKLCH values at L=0.70 are already tuned for dark mode. Light mode can use lower chroma variants if needed, but CONTEXT.md D-06 specifies these exact values without a light/dark split.

---

### `src/pages/Analytics.tsx` — integrate new components (component, request-response)

**Analog:** `src/pages/Analytics.tsx` lines 1–84 (self — existing import + layout pattern)

**Import block pattern** (Analytics.tsx lines 1–32):
```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import CostForecastPanel from "../components/CostForecastPanel";
import { GlassPanel } from "../components/GlassPanel";
// ADD:
import DialGaugeRow from "../components/DialGaugeRow";
import ModelSplitStrip from "../components/ModelSplitStrip";
import WindowBar from "../components/WindowBar";
```

**SectionErrorBoundary + GlassPanel wrapping** (Analytics.tsx lines 79–83):
```typescript
<SectionErrorBoundary name="Cost Forecast">
  <GlassPanel className="p-4">
    <CostForecastPanel />
  </GlassPanel>
</SectionErrorBoundary>
```

**Insertion point:** New gauge row, model strip, and window bar go ABOVE the existing `CostForecastPanel` block (line 79), per RESEARCH.md architecture diagram. Follow same SectionErrorBoundary + GlassPanel wrapping pattern for each:
```typescript
{/* Usage Gauges Row */}
<SectionErrorBoundary name="Usage Gauges">
  <GlassPanel className="p-4">
    <DialGaugeRow />
  </GlassPanel>
</SectionErrorBoundary>

{/* Model Split Strip */}
<SectionErrorBoundary name="Model Split">
  <GlassPanel className="p-4">
    <ModelSplitStrip />
  </GlassPanel>
</SectionErrorBoundary>

{/* Window Bar */}
<SectionErrorBoundary name="Cost Window">
  <GlassPanel className="p-4">
    <WindowBar />
  </GlassPanel>
</SectionErrorBoundary>
```

---

## Shared Patterns

### motion/react imports (ALL new animated components)
**Source:** `src/components/BackgroundSparkline.tsx` lines 1–2, `src/components/JumpToLatestPill.tsx` line 8
```typescript
import { motion, useReducedMotion, AnimatePresence } from "motion/react";
// NOT from "framer-motion" — package is named "motion" (motion/react)
```

### useReducedMotion guard (ALL animated components)
**Source:** `src/components/BackgroundSparkline.tsx` lines 95, 124–128
```typescript
const shouldReduce = useReducedMotion();

// Pattern: skip initial/animate when shouldReduce is true
initial={shouldReduce ? undefined : { pathLength: 0, opacity: 0 }}
animate={shouldReduce ? undefined : { pathLength: 1, opacity: 1 }}
// OR for DialGauge strokeDashoffset: always pass animate, but set transition duration to 0
transition={shouldReduce ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
```

### memo wrapping (ALL new components)
**Source:** `src/components/BackgroundSparkline.tsx` line 149, `src/components/MetricCard.tsx` line 122
```typescript
function ComponentInner(props: Props) { /* ... */ }
export const Component = memo(ComponentInner);
// Default export variant (for pages):
export default memo(ComponentInner);
```

### useId for SVG defs (DialGauge — prevents gradient ID collision across 3 instances)
**Source:** `src/components/BackgroundSparkline.tsx` line 94
```typescript
const id = useId().replace(/:/g, '');
// Use in SVG: id={`gauge-track-${id}`}, id={`gauge-fill-${id}`}
// Reference: href={`#gauge-track-${id}`}
```

### data-attribute CSS injection (ProviderRows via ModelSplitStrip or provider section)
**Source:** `src/components/HeroStatsBar.tsx` lines 170–172, `src/components/GlassPanel.tsx` line 25
```typescript
// Spread pattern for conditional data attributes:
{...(accent ? { "data-accent": accent } : {})}
// For provider rows:
<div data-provider={provider.toLowerCase()} className="...">
```

### Math.pow() requirement (DialGauge SVG arc math)
**Source:** `src/components/BackgroundSparkline.tsx` line 33 (uses Math.pow explicitly)
```typescript
// CORRECT — esbuild compatible:
const d1 = Math.pow(Math.hypot(p1.x - p0.x, p1.y - p0.y), alpha);
// WRONG — esbuild in this project rejects ** operator:
// const d1 = Math.hypot(...) ** alpha;
```

### Convex query + undefined loading guard (WindowBar, DialGaugeRow)
**Source:** `src/pages/Analytics.tsx` lines 53–59
```typescript
if (costByProvider === undefined || eventCounts === undefined) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-sm text-(--muted-foreground)">Loading...</p>
    </div>
  );
}
```
For components: return `null` or a skeleton rather than a full-page loader — the component is wrapped in SectionErrorBoundary.

### Test file motion/react mock (ALL new *.test.tsx files)
**Source:** `src/components/BackgroundSparkline.test.tsx` lines 5–10
```typescript
vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
    div: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  },
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```
Extend the mock to include `motion.div` and `AnimatePresence` for components that use expand/collapse.

---

## No Analog Found

None — all files have close analogs in the codebase.

---

## Metadata

**Analog search scope:** `src/components/`, `src/pages/`, `convex/`, `src/index.css`
**Files scanned:** 12 source files read directly
**Pattern extraction date:** 2026-05-15
