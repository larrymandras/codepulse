---
phase: 03-design-token-refresh
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/index.css
  - src/components/MetricCard.tsx
  - src/components/GlassPanel.tsx
  - src/components/HeroStatsBar.tsx
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

This phase adds category accent tokens, a `lift-on-hover` utility class, and `[data-accent]` radial gradient rules to `index.css`, then wires `GlassPanel` and `MetricCard` to consume them. `HeroStatsBar` is refactored to use the new tokens and display eight KPIs.

The token definitions and CSS machinery are sound. The bugs are in the gap between intent and implementation: `HeroStatsBar` was not migrated to the new token system (hardcoded gray Tailwind classes throughout), `GlassPanel` hardcodes the blur value instead of consuming `--glass-blur`, the `[data-accent]` gradient rules use dark-mode OKLCH values unconditionally (so light mode tints are too saturated), and `MetricCard` silently drops its `sparklineData` prop without rendering anything. There are also two logic issues: the `durableFacts` count is capped at the query `limit` instead of reflecting the true total, and the "Startup Time" KPI is permanently `"—"` with no data source wired.

---

## Warnings

### WR-01: HeroStatsBar not migrated — hardcoded gray classes bypass the new token system

**File:** `src/components/HeroStatsBar.tsx:130,135,137,138,157,176`
**Issue:** The outer container and all label/divider text use hardcoded Tailwind gray utilities (`bg-gray-800/50`, `border-gray-700/50`, `text-gray-200`, `text-gray-500`, `bg-gray-700`) rather than the design-token classes introduced by this phase. The `healthConfig` object on lines 9–13 also uses hardcoded `bg-emerald-500`, `bg-yellow-500`, `bg-red-500` and matching ring colors instead of `--status-ok`, `--status-warn`, `--status-error`. These values will not respond to future token changes and will be visually inconsistent with every other panel in the app, which uses `bg-card`, `border-border`, `text-muted-foreground`, and the status token variables.

**Fix:**
```tsx
// Outer container
<div className="bg-card border border-border rounded-xl p-4">

// Divider
<div className="h-4 w-px bg-border" />

// Labels
<span className="text-xs text-gray-500">  →  <span className="text-xs text-muted-foreground">
<span className="text-[10px] text-gray-500 uppercase tracking-wider">  →  text-muted-foreground
<span className="text-[10px] text-gray-500">  →  text-muted-foreground

// Health label
<span className="text-sm font-semibold text-gray-200">  →  text-foreground

// healthConfig — replace with token-based inline styles
const healthConfig = {
  green:  { dotStyle: { background: "var(--status-ok)" },   ringClass: "ring-2 ring-[color:var(--status-ok)]/30",   label: "Healthy"  },
  yellow: { dotStyle: { background: "var(--status-warn)" },  ringClass: "ring-2 ring-[color:var(--status-warn)]/30",  label: "Warning"  },
  red:    { dotStyle: { background: "var(--status-error)" }, ringClass: "ring-2 ring-[color:var(--status-error)]/30", label: "Critical" },
};
```

---

### WR-02: GlassPanel ignores `--glass-blur` token, hardcodes 12px

**File:** `src/components/GlassPanel.tsx:22`
**Issue:** The dark-mode blur is written as `dark:backdrop-blur-[12px]` — a literal pixel value — rather than consuming `--glass-blur` which is exactly what was introduced in `index.css` (line 105/179) for this purpose. The light mode value (`--glass-blur: 0px`) is already different from the dark value (`12px`), so this is a functional discrepancy: if `--glass-blur` is later tuned, GlassPanel will not respond.
**Fix:**
```tsx
// Replace:
"dark:bg-[var(--glass-bg)] dark:border-[var(--glass-border)] dark:backdrop-blur-[12px]"

// With:
"dark:bg-[var(--glass-bg)] dark:border-[var(--glass-border)] dark:backdrop-blur-[var(--glass-blur)]"
```

---

### WR-03: `[data-accent]` gradient rules always use dark-mode OKLCH values — light mode tints are over-saturated

**File:** `src/index.css:209–223`
**Issue:** The five `[data-accent="*"]` gradient rules use high-chroma dark-mode OKLCH values (e.g., `oklch(0.70 0.15 80 / 0.10)`) unconditionally. The light-mode accent tokens defined in `:root` on lines 123–128 use noticeably lower chroma (`0.10`, `0.08`, `0.12`) precisely to account for light backgrounds. The gradients ignore this distinction — at `0.10` alpha even a high-chroma value is subtle, but the intent of the separate `:root` / `.dark` token sets is that callers reference the tokens, not inline values.

**Fix:** Reference the CSS variables instead of hard-coding OKLCH literals, so the gradient automatically picks up the correct chroma for each mode:
```css
[data-accent="cost"] {
  background-image: radial-gradient(120% 60% at 0% 50%, color-mix(in oklch, var(--accent-cost) 10%, transparent), transparent 55%);
}
/* repeat for health, activity, memory, alerts */
```
Alternatively, define intermediate gradient-stop custom properties in `:root` / `.dark` and reference those.

---

### WR-04: `durableFacts` count is capped at the query `limit`, not the true total

**File:** `src/components/HeroStatsBar.tsx:35,42–43`
**Issue:** `durableFacts` is fetched with `{ limit: 100 }`, and `durableFactsCount` is `durableFacts.length`. When there are more than 100 facts in the DB, this KPI will display "100" indefinitely rather than the real count. The `dreaming.recentFacts` query only returns up to `limit` rows (confirmed in `convex/dreaming.ts:23`). This is a correctness bug — the "Durable Facts" metric will silently plateau.
**Fix:** Either use a dedicated count query (add `export const factCount = query(...)` in `convex/dreaming.ts` that uses `ctx.db.query("dreamingFacts").collect()` then `.length`, or a paginated approach), or document the cap in the KPI label (`sub: "last 100"`).

---

### WR-05: "Startup Time" KPI is permanently `"—"` — no data source wired

**File:** `src/components/HeroStatsBar.tsx:119–127`
**Issue:** The Startup Time KPI has `value: "—"` and `numericValue: undefined` with no conditional logic or data query to populate it. The `threshold` and `format` props are configured but will never fire. This means a permanently empty KPI cell is rendered in the stats bar, which will confuse users and could be mistaken for a loading state.
**Fix:** Either wire a real data source (e.g., a `useQuery(api.infrastructure.startupTime)` call) and handle the undefined-until-loaded state explicitly, or remove the KPI entry from the array until the data source exists.

---

### WR-06: `MetricCard` accepts `sparklineData` prop but silently drops it — no rendering path

**File:** `src/components/MetricCard.tsx:62,66–109`
**Issue:** `MetricCardInner` declares `sparklineData?: number[]` in `MetricCardProps` (line 62) and receives it through the destructured interface, but the prop is not destructured in `MetricCardInner`'s parameter list (line 66) and is never used in the render output. Any consumer passing `sparklineData` will get no sparkline rendered, with no error or warning. `HeroStatsBar` uses a separate `KpiDef.sparkline` field and renders via `<Sparkline>` itself, so this dead prop in `MetricCard` is likely an integration oversight.
**Fix:** Either remove `sparklineData` from `MetricCardProps` and document that sparkline rendering belongs to the caller, or destructure and render it:
```tsx
function MetricCardInner({
  label, value, numericValue, trend, threshold, format, onClick, accent, sparklineData,
}: MetricCardProps) {
  // ...inside the JSX, after the value span:
  {sparklineData && sparklineData.length > 0 && (
    <Sparkline data={sparklineData} color={valueColor ?? "var(--accent-activity)"} />
  )}
}
```

---

## Info

### IN-01: `prevRef` in `AnimatedNumber` is written but never read

**File:** `src/components/MetricCard.tsx:19,22`
**Issue:** `prevRef` is created with `useRef(0)` and assigned `motionValue.get()` inside `useEffect`, but its value is never consumed anywhere in the component. This is dead code — it was likely scaffolded for a direction-based animation (e.g., color flash on increase vs. decrease) that was not implemented.
**Fix:** Remove the `prevRef` declaration and assignment until the feature is needed.

---

### IN-02: `[data-accent]` gradients conflict with `background-image` set by consumers

**File:** `src/index.css:209–223`
**Issue:** The `[data-accent]` rules set `background-image` at the element level with no `@layer` scoping. Any component that also sets a `background-image` (e.g., via a Tailwind `bg-gradient-*` class on the same element) will have one or the other silently win based on specificity/source order. In `GlassPanel`, the `bg-card` utility sets `background-color`, which is fine — but the lack of `@layer` means these rules sit in the default layer and may conflict unpredictably if the pattern is reused.
**Fix:** Move the `[data-accent]` rules into `@layer utilities` so they participate in the Tailwind layer cascade correctly.

---

### IN-03: Light-mode `--glass-bg` opacity (0.85) is effectively opaque — backdrop-blur does nothing useful

**File:** `src/index.css:103`
**Issue:** In light mode, `--glass-bg: oklch(1 0 0 / 0.85)` gives a near-opaque white background. `GlassPanel` also skips `backdrop-blur` in light mode (blur only applied via `dark:backdrop-blur-[12px]`). This is technically consistent behavior, but `--glass-blur: 0px` (line 105) and the near-opaque `--glass-bg` together mean the "glass" token system provides no glass effect in light mode at all. If light-mode glass is intentional non-glass, a comment clarifying this would prevent future contributors from introducing `backdrop-blur` in light mode expecting it to do something with the 85%-opaque background.

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
