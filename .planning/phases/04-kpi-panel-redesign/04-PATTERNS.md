# Phase 04: KPI Panel Redesign - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/BackgroundSparkline.tsx` | component | transform (data→SVG) | `src/components/Sparkline.tsx` | role-match (same role; new adds Motion, filled area, cubic Bézier) |
| `src/components/HeroStatsBar.tsx` | component | request-response (poll) | `src/components/HeroStatsBar.tsx` | self (modify in place) |
| `src/components/MetricCard.tsx` | utility / component | transform | `src/components/MetricCard.tsx` | self (modify in place) |
| `src/index.css` | config | — | `src/index.css` Phase 03 block | self (extend existing pattern) |
| `src/components/BackgroundSparkline.test.tsx` | test | — | `src/components/AgentStatusTile.test.tsx` | role-match (same test infrastructure, same motion/react mock shape) |
| `src/components/HeroStatsBar.test.tsx` | test | — | `src/components/AgentStatusTile.test.tsx` | role-match |
| `src/components/MetricCard.test.tsx` | test | — | `src/components/AgentStatusTile.test.tsx` | role-match |

---

## Pattern Assignments

### `src/components/BackgroundSparkline.tsx` (component, transform)

**Analog:** `src/components/Sparkline.tsx`

**Imports pattern** (`Sparkline.tsx` lines 1-1 / `GlassPanel.tsx` lines 1-2 for Motion + useReducedMotion):
```tsx
import { memo, useId } from "react";
import { motion, useReducedMotion } from "motion/react";
```
Notes:
- `memo` wrap comes from `Sparkline.tsx` (line 48: `const Sparkline = memo(SparklineInner)`)
- `useReducedMotion` import pattern comes from `GlassPanel.tsx` (line 1) and `JumpToLatestPill.tsx` (line 8) — both are exact models
- No shadcn primitives needed; pure SVG

**Data→points normalization pattern** (`Sparkline.tsx` lines 19-31):
```tsx
const max = Math.max(...data);
const min = Math.min(...data);
const range = max - min || 1;   // <-- guard: copy this exactly, prevents division-by-zero on flat lines
const padding = 2;
const drawHeight = height - padding * 2;
const step = width / (data.length - 1);

const points = data.map((val, i) => {
  const x = i * step;
  const y = padding + drawHeight - ((val - min) / range) * drawHeight;
  return { x, y };   // BackgroundSparkline needs {x,y} objects, not strings
});
```
The `range = max - min || 1` guard on line 21 of `Sparkline.tsx` is the critical pattern to copy — it prevents NaN coords on flat/all-zero sparklines (Pitfall 5 in RESEARCH.md).

**Memo-wrap pattern** (`Sparkline.tsx` lines 48-49):
```tsx
const BackgroundSparklineInner = function(...) { ... };
export const BackgroundSparkline = memo(BackgroundSparklineInner);
```
Note: use named export (not default) to match the pattern for imported utilities.

**prefers-reduced-motion pattern** (`GlassPanel.tsx` lines 12-19, `JumpToLatestPill.tsx` lines 16-38):
```tsx
// GlassPanel.tsx — canonical reduced-motion guard (lines 12-19)
const shouldReduce = useReducedMotion();
const skipMotion = !animate || shouldReduce;

return (
  <motion.div
    initial={skipMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={skipMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
  />
);
```
For BackgroundSparkline: replace `skipMotion` with `shouldReduce` directly (no `animate` prop needed — sparkline always renders its animation):
```tsx
const shouldReduce = useReducedMotion();

// On <motion.path> stroke:
initial={shouldReduce ? undefined : { pathLength: 0, opacity: 0 }}
animate={shouldReduce ? undefined : { pathLength: 1, opacity: 1 }}

// On <motion.path> fill area:
initial={shouldReduce ? undefined : { opacity: 0 }}
animate={shouldReduce ? undefined : { opacity: 1 }}
```
When `shouldReduce` is true, omitting `initial`/`animate` causes Motion to render static — no animation at all, respecting the OS preference.

**No analog exists for:** `motion.path` with `pathLength` draw-in and `animate={{ d }}` morph — no existing codebase usage. Use RESEARCH.md Pattern 2 and Pattern 3 verbatim. These are well-sourced from motion.dev official docs.

---

### `src/components/HeroStatsBar.tsx` (component, request-response — MODIFY)

**Analog:** self — read the full current file at lines 1-176

**Current imports** (lines 1-7) — extend, do not replace:
```tsx
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useHeroStats } from "../hooks/useHeroStats";
import { AnimatedNumber, thresholdColor, ThresholdConfig } from "./MetricCard";
import Sparkline from "./Sparkline";
import InfoTooltip from "./InfoTooltip";
```
Add to imports:
```tsx
import { BackgroundSparkline } from "./BackgroundSparkline";
import { thresholdTone } from "./MetricCard";   // new export being added
```

**KpiDef interface** (lines 15-26) — add `sparklineData` field:
```tsx
interface KpiDef {
  label: string;
  value: string | number;
  numericValue?: number;
  threshold?: ThresholdConfig;
  format?: (v: number) => string;
  sparkline?: number[];       // existing inline Sparkline — may be removed
  sparklineData?: number[];   // NEW: background sparkline data array (12 buckets)
  sub?: string;
  color?: string;
  accent?: "cost" | "health" | "activity" | "memory" | "alerts";
  onClick: () => void;
}
```

**data-accent attribute pattern** (lines 144-148) — `data-tone` follows the same pattern:
```tsx
// Existing pattern on tile div (line 147):
data-accent={kpi.accent}

// New pattern — add alongside data-accent:
data-tone={tone}   // "good" | "warn" | "danger" | undefined
```

**Current tile div structure** (lines 143-169) — reference for adding BackgroundSparkline as layer 1:
```tsx
<div
  key={kpi.label}
  onClick={kpi.onClick}
  data-accent={kpi.accent}
  className="group flex flex-col gap-1 cursor-pointer rounded-lg px-2 py-1.5 -mx-2 -my-1.5 lift-on-hover"
>
  {/* layer 1: BackgroundSparkline goes here (absolute, z-0) */}
  {/* layer 2: data-accent radial gradient is CSS background-image from index.css */}
  {/* layer 3: existing content (relative, z-10) */}
  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
    {kpi.label}
  </span>
  ...
</div>
```
Add `relative overflow-hidden min-h-[72px]` to tile className (D-11, D-12). Add inline `style` for `backgroundColor` and `borderColor` using `color-mix(in oklch, ...)` (D-07). Do NOT use Tailwind `border-*` color classes on the same element (Pitfall 6 in RESEARCH.md).

---

### `src/components/MetricCard.tsx` (utility/component — MODIFY, add thresholdTone)

**Analog:** self — read current file lines 35-46

**Existing thresholdColor** (lines 35-46) — `thresholdTone` mirrors this exactly, replacing return type:
```tsx
// EXISTING (lines 35-46):
export function thresholdColor(value: number, config: ThresholdConfig): string {
  if (config.invertDirection) {
    if (value >= config.ok) return "var(--metric-ok)";
    if (value >= config.warn) return "var(--metric-warn)";
    return "var(--metric-error)";
  }
  if (value <= config.ok) return "var(--metric-ok)";
  if (value <= config.warn) return "var(--metric-warn)";
  return "var(--metric-error)";
}

// NEW — add immediately after thresholdColor:
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
Insert after line 46 (after the closing `}` of `thresholdColor`), before the `// ─── MetricCard` section comment. The threshold logic is identical — only the return strings change.

**ThresholdConfig interface** (lines 28-33) — unchanged, already exported, already used by HeroStatsBar:
```tsx
export interface ThresholdConfig {
  ok: number;
  warn: number;
  invertDirection?: boolean;
}
```

---

### `src/index.css` (config — MODIFY, add Phase 04 tone tokens)

**Analog:** self — Phase 03 token block pattern (lines 122-128 in `:root`, lines 188-194 in `.dark`)

**Phase 03 accent token pattern** (lines 122-128) — copy structure for Phase 04 tone tokens:
```css
/* Phase 03: Category accent tokens (light — lower chroma) */
--accent-cost: oklch(0.55 0.10 80);
--accent-health: oklch(0.55 0.10 142);
--accent-activity: oklch(0.55 0.08 230);
--accent-memory: oklch(0.55 0.08 290);
--accent-alerts: oklch(0.55 0.12 27);
```
Insert after line 128 (closing `}` of `:root`... actually just before the `}`), following the same comment convention:
```css
  /* Phase 04: Tone tokens */
  --tone-good:   oklch(0.70 0.15 142);
  --tone-warn:   oklch(0.70 0.15 80);
  --tone-danger: oklch(0.70 0.18 27);
```

**Phase 03 dark overrides pattern** (lines 188-194 in `.dark`) — mirror for Phase 04:
```css
  /* Phase 04: Tone tokens (dark) */
  --tone-good:   oklch(0.72 0.17 142);
  --tone-warn:   oklch(0.78 0.15 80);
  --tone-danger: oklch(0.72 0.20 27);
```

**Phase 03 data-accent selector pattern** (lines 208-223) — `data-tone` selectors follow same structure, add after the `[data-accent="alerts"]` block:
```css
/* Phase 04: Tone selectors */
[data-tone="good"]   { --tile-tone: var(--tone-good); }
[data-tone="warn"]   { --tile-tone: var(--tone-warn); }
[data-tone="danger"] { --tile-tone: var(--tone-danger); }
/* default: no data-tone → --tile-tone not set; consumers fall back to var(--accent-*) */
```

**Phase 03 color-mix pattern in radial gradient** (line 210) — same `color-mix(in oklch, ...)` syntax applies to tile background and border:
```css
/* Reference (existing line 210): */
background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--accent-cost) 10%, transparent), transparent 55%);

/* Phase 04 tone application (inline style on tile div, not CSS file): */
background-color: color-mix(in oklch, var(--tile-tone, var(--accent-activity)) 8%, transparent);
border-color:     color-mix(in oklch, var(--tile-tone, var(--accent-activity)) 15%, transparent);
```

---

### `src/components/BackgroundSparkline.test.tsx` (test — NEW)

**Analog:** `src/components/AgentStatusTile.test.tsx`

**Test file structure** (lines 1-55 — full file is the model):
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AgentStatusTile from "./AgentStatusTile";

vi.mock("motion/react", () => ({
  motion: { div: ({ children, className }: any) => <div className={className}>{children}</div> },
}));
```

**motion/react mock for BackgroundSparkline** — extend the mock to include `path` and `useReducedMotion` (RESEARCH.md Validation Architecture section, confirmed pattern):
```tsx
vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
    svg: ({ children, ...rest }: any) => <svg {...rest}>{children}</svg>,
  },
  useReducedMotion: () => false,
}));
```
Note: `AgentStatusTile.test.tsx` only mocks `motion.div` — BackgroundSparkline needs `motion.path` and `useReducedMotion` added.

**Test assertion style** (AgentStatusTile.test.tsx lines 13-16) — smoke test pattern:
```tsx
describe("AgentStatusTile", () => {
  it("renders agent name", () => {
    render(<AgentStatusTile agentId="astridr" agentName="Astridhr" state="idle" />);
    expect(screen.getByText("Astridhr")).toBeDefined();
  });
```
Translate to BackgroundSparkline:
```tsx
describe("BackgroundSparkline", () => {
  it("renders without crash", () => {
    const { container } = render(
      <BackgroundSparkline data={[1,2,3,4,5,6,7,8,9,10,11,12]} accentColor="oklch(0.70 0.15 80)" />
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
```

**Container query assertion style** (AgentStatusTile.test.tsx lines 19-22):
```tsx
it("applies green background for active state", () => {
  const { container } = render(<AgentStatusTile agentId="a" agentName="A" state="active" />);
  expect(container.querySelector(".bg-green-500\\/20")).not.toBeNull();
});
```
Translate for BackgroundSparkline path presence:
```tsx
it("renders SVG path elements", () => {
  const { container } = render(
    <BackgroundSparkline data={Array(12).fill(5)} accentColor="oklch(0.70 0.15 80)" />
  );
  expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
});
```

---

### `src/components/HeroStatsBar.test.tsx` (test — NEW)

**Analog:** `src/components/AgentStatusTile.test.tsx` + `src/components/StatusHeartbeatGrid.test.tsx`

**Hook mocking pattern** (StatusHeartbeatGrid.test.tsx lines 10-12):
```tsx
vi.mock("../hooks/useAgentStatus", () => ({
  useRecentAgentStatus: () => [],
  useLatestAgentStatus: () => undefined,
}));
```
Translate for HeroStatsBar (mock all three external dependencies):
```tsx
vi.mock("../hooks/useHeroStats", () => ({
  useHeroStats: () => ({
    activeSessions: 3,
    runningAgents: 1,
    errorRate: 5,
    errorsThisHour: 2,
    eventsThisHour: 40,
    eventSparkline: Array(12).fill(3),
    activeAlerts: 0,
    criticalAlerts: 0,
    errorAlerts: 0,
    hourlyCost: 0.05,
    hourlyTokens: 1000,
    costSparkline: Array(12).fill(0.004),
    knownTools: 8,
    securityEvents: 0,
    health: "green" as const,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));
```

**motion/react mock** (same as BackgroundSparkline.test.tsx — needed because HeroStatsBar renders BackgroundSparkline):
```tsx
vi.mock("motion/react", () => ({
  motion: {
    path: ({ d, children, ...rest }: any) => <path d={d} {...rest}>{children}</path>,
    span: ({ children, ...rest }: any) => <span {...rest}>{children}</span>,
  },
  useReducedMotion: () => false,
  useMotionValue: (v: number) => ({ set: vi.fn(), get: () => v }),
  useSpring: (v: any) => v,
  useTransform: (_v: any, fn: any) => ({ get: () => fn(0) }),
}));
```
Note: HeroStatsBar uses `AnimatedNumber` from MetricCard which uses `useMotionValue`, `useSpring`, `useTransform` — all need to be in the mock.

**data-tone assertion** (new — no direct analog, but follows container query pattern from AgentStatusTile.test.tsx lines 19-22):
```tsx
it("tiles have data-tone attribute when threshold is set", () => {
  const { container } = render(<HeroStatsBar />);
  // Error Rate tile has threshold { ok: 10, warn: 20 } and errorRate: 5 → tone "good"
  const toneEl = container.querySelector('[data-tone="good"]');
  expect(toneEl).not.toBeNull();
});
```

---

### `src/components/MetricCard.test.tsx` (test — NEW)

**Analog:** `src/components/AgentStatusTile.test.tsx`

**Pure function test pattern** — no direct analog in codebase (all existing tests render components). `thresholdTone` is a pure function so no render needed:
```tsx
import { describe, it, expect } from "vitest";
import { thresholdTone } from "./MetricCard";

describe("thresholdTone", () => {
  it("returns 'good' when value is within ok threshold (lower-is-better)", () => {
    expect(thresholdTone(5, { ok: 10, warn: 20 })).toBe("good");
  });

  it("returns 'warn' when value is between ok and warn thresholds", () => {
    expect(thresholdTone(15, { ok: 10, warn: 20 })).toBe("warn");
  });

  it("returns 'danger' when value exceeds warn threshold", () => {
    expect(thresholdTone(25, { ok: 10, warn: 20 })).toBe("danger");
  });

  it("returns 'good' when invertDirection and value >= ok", () => {
    expect(thresholdTone(80, { ok: 70, warn: 40, invertDirection: true })).toBe("good");
  });
});
```
No Motion mock needed — `thresholdTone` is a pure function with no React dependency.

---

## Shared Patterns

### Motion + useReducedMotion Guard
**Source:** `src/components/GlassPanel.tsx` lines 1, 12-19
**Apply to:** `BackgroundSparkline.tsx`
```tsx
// Import:
import { motion, useReducedMotion } from "motion/react";

// Usage:
const shouldReduce = useReducedMotion();
// Pass shouldReduce to conditionally omit initial/animate props
// When shouldReduce is true: pass undefined for initial and animate → static render
// When shouldReduce is false: pass full animation objects
```

### memo Wrap (named inner function pattern)
**Source:** `src/components/Sparkline.tsx` lines 10 and 48-49
```tsx
function SparklineInner({ ... }: SparklineProps) { ... }
const Sparkline = memo(SparklineInner);
export default Sparkline;
```
**Apply to:** `BackgroundSparkline.tsx` (use named export instead of default)
```tsx
function BackgroundSparklineInner({ ... }: BackgroundSparklineProps) { ... }
export const BackgroundSparkline = memo(BackgroundSparklineInner);
```

### Range Guard (division-by-zero protection)
**Source:** `src/components/Sparkline.tsx` line 21
```tsx
const range = max - min || 1;
```
**Apply to:** `BackgroundSparkline.tsx` data normalization. Copy exactly — prevents NaN SVG coordinates on flat sparklines.

### data-* Attribute Pattern
**Source:** `src/components/MetricCard.tsx` line 86, `src/components/HeroStatsBar.tsx` line 147
```tsx
// MetricCard.tsx (line 86):
{...(accent ? { "data-accent": accent } : {})}

// HeroStatsBar.tsx (line 147):
data-accent={kpi.accent}
```
**Apply to:** `HeroStatsBar.tsx` tile div for `data-tone` attribute — same spread pattern or direct attribute.

### color-mix(in oklch) Opacity Pattern
**Source:** `src/index.css` lines 210-223 (Phase 03 radial gradients)
```css
color-mix(in oklch, var(--accent-cost) 10%, transparent)
```
**Apply to:** `src/index.css` Phase 04 tone CSS, inline styles on HeroStatsBar tiles. Use same `color-mix(in oklch, <color> N%, transparent)` syntax.

### motion/react Test Mock
**Source:** `src/components/AgentStatusTile.test.tsx` lines 9-11, `src/components/StatusHeartbeatGrid.test.tsx` lines 18-21
```tsx
vi.mock("motion/react", () => ({
  motion: { div: ({ children, className }: any) => <div className={className}>{children}</div> },
}));
```
**Apply to:** All three new test files. Extend with `path`, `span`, `useReducedMotion`, `useMotionValue`, `useSpring`, `useTransform` as needed per component under test.

---

## No Analog Found

No files in this phase lack analogs. All patterns are covered by existing codebase components or well-sourced from RESEARCH.md.

| File | Status | Note |
|---|---|---|
| `motion.path` + `pathLength` | No codebase analog | Use RESEARCH.md Patterns 2 & 3 — sourced from motion.dev official docs |
| SVG `linearGradient` | No codebase analog | Use RESEARCH.md Pattern 5 — standard SVG, no library |
| Catmull-Rom path algorithm | No codebase analog | Use RESEARCH.md Pattern 1 — ~30 line inline utility |

---

## Metadata

**Analog search scope:** `src/components/`, `src/hooks/`, `src/index.css`
**Files scanned:** 9 (Sparkline.tsx, MetricCard.tsx, HeroStatsBar.tsx, AgentStatusTile.tsx, AgentStatusTile.test.tsx, StatusHeartbeatGrid.test.tsx, PipelineFlowDiagram.test.tsx, GlassPanel.tsx, JumpToLatestPill.tsx, useHeroStats.ts, index.css)
**Pattern extraction date:** 2026-05-14
