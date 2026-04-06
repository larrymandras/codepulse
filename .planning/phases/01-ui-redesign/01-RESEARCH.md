# Phase 1: UI Redesign - Research

**Researched:** 2026-04-06
**Domain:** React dashboard design system migration — shadcn/ui New York, oklch palette, CSS flex charts, Lucide icons
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Remove CRT scanline overlay effect entirely — drop `.crt-overlay` CSS and related animation
- **D-02:** Remove Cinzel serif font from headings — replace with Geist (or system font) everywhere. Drop `@font-face` for Cinzel
- **D-03:** Full oklch monochromatic palette — pure grayscale oklch with a single muted accent for interactive elements. No indigo, no colored accents beyond the operational accent
- **D-04:** Border-radius exceptions: avatars stay circular, status badges/pills get slight rounding. Everything else is `--radius: 0` (sharp corners globally)
- **D-06:** Replace ALL 19 Recharts-consuming components with custom CSS flex bar charts — clean break, remove Recharts dependency entirely (actual count is 18 files)
- **D-07:** Complex visualizations (TokenSunburst, SankeyFlow, TokenWaterfall) are removed entirely — replace with tables or summary metrics
- **D-08:** CSS flex charts support hover tooltips AND click drill-down
- **D-09:** 240px sidebar with nav items grouped by operational function (OVERVIEW, OPERATIONS, SYSTEM, INSIGHTS, ADMIN)
- **D-10:** Live count badges on every nav item
- **D-11:** Collapsible sidebar — icon-only on small screens, hamburger on mobile
- **D-12:** Initialize shadcn/ui via CLI (`npx shadcn@latest init`) with New York style on the existing Vite + React 19 + Tailwind 4 stack
- **D-13:** EntityRow is a full-featured universal list pattern with leading icon, primary text, secondary text, trailing metadata, hover state, divider, click handler
- **D-14:** Activity feeds use slide-in animations with highlight accent for new entries

### Claude's Discretion

- Component migration order (outside-in vs design-system-first)
- MetricCard API design (single component vs composable primitives)
- Exact oklch color values for the monochromatic palette
- Loading skeleton and empty state designs
- Exact spacing scale and typography sizing
- Token depth (min: shadcn/ui default CSS variables; extend with operational tokens if it improves consistency)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Dashboard adopts shadcn/ui New York style with monochromatic oklch palette and `--radius: 0` globally | shadcn/ui init, CSS variable configuration, oklch grayscale values |
| UI-02 | All metric displays use MetricCard pattern (large tabular-nums value, tiny label, no card borders) | Existing MetricCard.tsx redesign spec, tabular-nums class, borderless pattern |
| UI-03 | Section headers use uppercase tracking-wide muted-foreground pattern with separators | Typography pattern from Paperclip research, shadcn Separator component |
| UI-04 | Navigation uses compact 240px sidebar with labeled sections and live count badges | DashboardLayout.tsx migration, Lucide icons, navItems grouping per D-09 |
| UI-05 | Charts replaced with custom CSS flex bar charts (no Recharts dependency for primary displays) | 18 Recharts files inventoried, CSS flex chart pattern, D-07 removal list |
| UI-06 | EntityRow universal list pattern used across all data lists (consistent hover, dividers, leading icon) | New component spec, migration targets in EventFeed, ExecutionTable, etc. |
| UI-07 | Activity feeds show slide-in animations with highlight accent for new entries | Paperclip animation spec: translateY + scale + blur over 520ms |
| UI-08 | Icons standardized to Lucide React with consistent 4x4 sizing | lucide-react v1.7.0, zero existing usage — clean install |
</phase_requirements>

---

## Summary

CodePulse is a React 19 + Vite 7 + Tailwind CSS 4 dashboard with 93 components, 16 pages, and no existing component library. The design system migration adopts the Paperclip AI design language: shadcn/ui New York style, oklch monochromatic palette, zero border-radius, custom CSS flex charts, and Lucide icons.

The codebase has never had shadcn/ui installed — `src/components/ui/` does not exist. No Lucide icons are used anywhere. The current visual language uses indigo accents (`indigo-600`), `rounded-xl` everywhere, `gray-800/50` card backgrounds, CRT effects, and Cinzel serif fonts — all of which are removed by this phase. Recharts is imported in **18 files** (the CONTEXT.md says 19; actual grep found 18). Three components (TokenSunburst, SankeyFlow, TokenWaterfall) are eliminated entirely per D-07; the remaining 15 Recharts components are replaced with CSS flex charts.

The good news for the planner: Tailwind 4 is already configured correctly with the `@tailwindcss/vite` plugin and `@/` path aliases. The `npx shadcn@latest init` command will detect this setup and wire correctly. Vitest + jsdom is already operational with 2 component tests passing. The MetricCard interface (label, value, trend) is reused by 9 pages — the prop API should remain stable even as the visual implementation changes completely.

**Primary recommendation:** Execute design-system-first — establish the token layer (`index.css` reset + CSS variables) and install shadcn/ui primitives first, then migrate the layout shell (DashboardLayout), then migrate shared components (MetricCard, EntityRow, SectionHeader), then migrate pages outside-in.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui CLI | 4.1.2 | Component scaffolding, CSS variable theming | New York style, Radix primitives, Tailwind 4 support confirmed |
| lucide-react | 1.7.0 | Icon set | Paperclip design reference uses exclusively; thin-line, consistent sizing |
| class-variance-authority | 0.7.1 | Component variant API | shadcn/ui dependency; used in generated component code |
| clsx | 2.1.1 | Conditional class joining | shadcn/ui dependency |
| tailwind-merge | 3.5.0 | Merge Tailwind classes without conflicts | shadcn/ui dependency |

[VERIFIED: npm registry — all versions confirmed via `npm view` on 2026-04-06]

### Radix UI Primitives (installed on demand via shadcn CLI)

| Library | Latest Version | Purpose |
|---------|---------------|---------|
| @radix-ui/react-separator | 1.1.8 | SectionHeader dividers |
| @radix-ui/react-tooltip | 1.2.8 | Chart hover tooltips |
| @radix-ui/react-navigation-menu | 1.2.14 | Sidebar navigation |
| @radix-ui/react-slot | 1.2.4 | Button/icon composition |

[VERIFIED: npm registry]

### Supporting (already installed, keep)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 | Toast notifications | Already installed, keep as-is |
| react-router-dom | 7.13.1 | Routing + NavLink | Already installed, no changes needed |
| convex | 1.17.0 | Real-time data hooks | Data layer, unchanged |

### Remove

| Library | Action | Why |
|---------|--------|-----|
| recharts | Remove from package.json after migration | D-06: clean break, all 18 usages replaced |
| @react-three/fiber | Remove | Out of scope per REQUIREMENTS.md |
| @react-three/drei | Remove | Same |
| three | Remove | Same |
| react-globe.gl | Remove | Same |

[ASSUMED — React Three Fiber/Globe are not referenced from current active pages, but verify before removing that no non-obvious import exists]

**Installation:**
```bash
# shadcn/ui init (interactive — select New York style, neutral/zinc base, dark mode)
npx shadcn@latest init

# Install core shadcn components as needed
npx shadcn@latest add separator tooltip badge button

# Install Lucide
npm install lucide-react

# Install shadcn/ui peer dependencies (auto-installed via shadcn CLI, listed for awareness)
npm install class-variance-authority clsx tailwind-merge
```

**Version verification:** All versions confirmed via `npm view` on 2026-04-06. shadcn CLI is 4.1.2 (latest).

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui generated primitives (Separator, Badge, Tooltip, etc.)
│   ├── MetricCard.tsx   # Redesigned — no border, large tabular-nums
│   ├── EntityRow.tsx    # New — universal list row pattern
│   ├── SectionHeader.tsx  # New — uppercase + separator
│   ├── FlexBarChart.tsx   # New — CSS flex chart primitive
│   ├── EventFeed.tsx    # Migrated to EntityRow + slide-in animation
│   └── [others]        # Migrated to oklch + Lucide
├── layouts/
│   └── DashboardLayout.tsx  # Redesigned sidebar with sections + badges
├── pages/              # 16 pages, migrated in waves
└── index.css           # Token layer: complete replacement
```

### Pattern 1: CSS Variable Token Layer (index.css reset)

**What:** Replace current `index.css` with shadcn/ui oklch CSS variables + operational extensions. This is the single source of truth for all colors, radius, and typography.

**When to use:** Wave 0 of the phase — everything else depends on this being correct.

```css
/* Source: shadcn/ui theming docs + Paperclip design patterns research */
@import "tailwindcss";

@layer base {
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --accent: oklch(0.97 0 0);
    --accent-foreground: oklch(0.205 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --ring: oklch(0.708 0 0);

    /* Operational tokens (Claude's Discretion) */
    --status-ok: oklch(0.65 0.15 142);      /* muted green */
    --status-error: oklch(0.65 0.18 27);    /* muted red */
    --status-warn: oklch(0.75 0.12 85);     /* muted amber */
    --chart-bar: oklch(0.45 0 0);           /* mid-gray bar fill */
    --chart-bar-accent: oklch(0.65 0.08 220); /* subtle blue accent bar */

    /* Zero radius globally per D-04 */
    --radius: 0rem;
    /* Avatar/badge exceptions handled with explicit utility classes */
  }

  .dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --border: oklch(0.269 0 0);
    --input: oklch(0.269 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --ring: oklch(0.439 0 0);

    --status-ok: oklch(0.72 0.17 142);
    --status-error: oklch(0.72 0.20 27);
    --status-warn: oklch(0.80 0.14 85);
    --chart-bar: oklch(0.55 0 0);
    --chart-bar-accent: oklch(0.70 0.10 220);
  }
}

/* Remove: CRT overlay, @font-face Cinzel — per D-01/D-02 */
/* Keep: privacy-demo/privacy-screenshot rules, eq-bar animations */
/* Keep: JetBrains Mono for code/log elements */
```

[CITED: ui.shadcn.com/docs/theming — base oklch values; ASSUMED — exact chroma/lightness values for operational tokens need designer validation]

### Pattern 2: MetricCard Redesign

**What:** Remove border and background, use large tabular-nums value with tiny muted label. Keep existing prop API (label, value, trend) to avoid breaking 9 importing pages.

**When to use:** All 9 page imports work without import changes.

```tsx
// Source: Paperclip research — paperclip-ui-patterns-2026-04-06.md
function MetricCardInner({ label, value, trend }: MetricCardProps) {
  const trendColor =
    trend === "up" ? "text-(--status-ok)"
    : trend === "down" ? "text-(--status-error)"
    : "text-muted-foreground";

  return (
    // No border, no background — just padding
    <div className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {trend === "up" && <TrendingUp className={`w-3 h-3 ${trendColor}`} />}
        {trend === "down" && <TrendingDown className={`w-3 h-3 ${trendColor}`} />}
      </div>
    </div>
  );
}
```

### Pattern 3: SectionHeader

**What:** Uppercase section label + Separator. Used at the top of every content section on every page (UI-03).

```tsx
// Source: Paperclip research — exact class string documented
import { Separator } from "@/components/ui/separator";

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="space-y-2 mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      <Separator />
    </div>
  );
}
```

### Pattern 4: CSS Flex Bar Chart

**What:** Replace Recharts. Pure CSS with flex layout. Supports hover tooltip (UI-05) and click drill-down (D-08).

**When to use:** All 15 non-eliminated chart components.

```tsx
// Source: Paperclip research — custom chart pattern
interface FlexBarChartProps {
  data: { label: string; value: number; max?: number }[];
  height?: number; // default 80px per Paperclip pattern
  onSegmentClick?: (label: string, value: number) => void;
}

export function FlexBarChart({ data, height = 80, onSegmentClick }: FlexBarChartProps) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height }}>
      {data.map((d) => (
        <div
          key={d.label}
          className="relative flex-1 group cursor-pointer"
          style={{ height: `${(d.value / maxVal) * 100}%` }}
          onClick={() => onSegmentClick?.(d.label, d.value)}
        >
          <div className="w-full h-full bg-(--chart-bar) hover:bg-(--chart-bar-accent) transition-colors" />
          {/* Tooltip */}
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block
                          bg-popover border border-border px-2 py-1 text-xs text-popover-foreground
                          whitespace-nowrap z-10">
            {d.label}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Pattern 5: EntityRow

**What:** Universal list primitive for agents, executions, alerts, memory entries, sessions (UI-06).

```tsx
// Source: Paperclip research — EntityRow pattern
interface EntityRowProps {
  icon: React.ReactNode;
  primary: string;
  secondary?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}

export function EntityRow({ icon, primary, secondary, trailing, onClick }: EntityRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 border-b border-border
                  last:border-b-0 transition-colors
                  ${onClick ? "cursor-pointer hover:bg-accent/50" : ""}`}
    >
      <div className="w-4 h-4 shrink-0 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{primary}</p>
        {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
      </div>
      {trailing && <div className="shrink-0 text-xs text-muted-foreground">{trailing}</div>}
    </div>
  );
}
```

### Pattern 6: Activity Feed Slide-In Animation

**What:** New entries animate in from above with scale + blur, plus a left-border highlight accent (UI-07, D-14).

```css
/* Source: Paperclip research — exact timing values documented */
@keyframes slide-in-entry {
  from {
    opacity: 0;
    transform: translateY(-14px) scale(0.985);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.activity-entry-new {
  animation: slide-in-entry 520ms ease-out forwards;
  box-shadow: inset 2px 0 0 var(--primary); /* left accent stripe */
}
```

### Pattern 7: Sidebar Navigation with Grouped Sections

**What:** Replace flat nav list with grouped sections (D-09), Lucide icons (D-11, UI-08), live count badges (D-10), collapsible behavior (D-11).

**Key changes from current DashboardLayout.tsx:**
- Replace ASCII `iconMap` text strings with `<LucideIcon className="w-4 h-4" />` per UI-08
- Add section headers as non-interactive dividers between groups
- Add Badge component next to each nav label for live counts
- Add collapse toggle (icon-only mode at `md:` breakpoint)

### Nav Grouping per D-09

```tsx
const navGroups = [
  {
    label: "OVERVIEW",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, countQuery: "activeSessions" },
      { to: "/analytics", label: "Analytics", icon: BarChart2 },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { to: "/agents", label: "Agents", icon: Bot, countQuery: "activeAgents" },
      { to: "/executions", label: "Executions", icon: List },
      { to: "/build", label: "Build", icon: Hammer },
      { to: "/automation", label: "Automation", icon: Clock },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/infrastructure", label: "Infrastructure", icon: Server },
      { to: "/security", label: "Security", icon: Shield },
      { to: "/self-healing", label: "Self-Healing", icon: RefreshCw },
      { to: "/memory", label: "Memory", icon: Brain },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { to: "/capabilities", label: "Capabilities", icon: Cpu },
      { to: "/briefings", label: "Briefings", icon: ScrollText },
      { to: "/alerts", label: "Alerts", icon: Bell, countQuery: "unreadAlerts" },
      { to: "/profiles", label: "Profiles", icon: Users },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { to: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];
```

### Anti-Patterns to Avoid

- **Using `rounded-*` on cards/panels:** Violates `--radius: 0` rule. Only `rounded-full` for avatars, slight rounding for status badges.
- **Adding color accents beyond operational tokens:** No `indigo-*`, `purple-*`, or arbitrary colors. All grays use `var(--muted-foreground)` etc.
- **Wrapping Recharts in a "thin" layer:** D-06 says clean break. Zero Recharts in the final bundle.
- **Changing MetricCard prop API:** 9 pages import it; breaking the API requires 9 simultaneous page updates. Keep `{ label, value, trend }` stable.
- **Direct CSS color values:** Use CSS variables exclusively — never `#hex` or `rgb()` values. Makes dark mode automatic.
- **Putting shadcn primitives outside `src/components/ui/`:** The CLI always writes here; keeping them in `ui/` preserves the ability to re-run `shadcn add`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip primitives | Custom tooltip div logic | `@radix-ui/react-tooltip` via `shadcn add tooltip` | Accessibility, positioning, portal — edge cases are deep |
| Badge / pill components | Custom span styling | `shadcn add badge` (wraps Radix) | Consistent variant API across the codebase |
| Separator lines | `<hr>` or `<div className="border-b">` | `shadcn add separator` | Semantic, themeable via CSS variables |
| Focus ring management | Custom `:focus` CSS | shadcn's built-in `ring` utilities | WCAG compliance, keyboard nav included |
| CSS chart animations | JavaScript animation libraries | CSS `animation` + `@keyframes` | Zero runtime overhead, GPU-composited |
| Icon library | Custom SVGs | `lucide-react` v1.7.0 | 1500+ icons, tree-shakeable, consistent stroke width |

**Key insight:** shadcn/ui installs source files (not a runtime dependency), so components are fully owned and modifiable. Radix primitives handle the hard parts (accessibility, portal management, keyboard) while you own the visual layer.

---

## Common Pitfalls

### Pitfall 1: shadcn/ui Init Overwrites index.css

**What goes wrong:** `npx shadcn@latest init` may ask to modify `src/index.css`. Accepting blindly will overwrite the current Tailwind import and custom animations.

**Why it happens:** shadcn writes a full theme block to the detected CSS entry point.

**How to avoid:** Let shadcn write its generated CSS variables, then manually merge back the privacy mode rules, eq-bar animations, and JetBrains Mono font declaration. The CRT rules are intentionally dropped (D-01).

**Warning signs:** If `eq-bar-1`, `eq-bar-2`, `eq-bar-3` keyframes disappear from `index.css` after init, they need to be added back.

### Pitfall 2: Tailwind 4 CSS Variable Syntax Difference

**What goes wrong:** Tailwind 4 uses `bg-(--variable-name)` syntax instead of the v3 `bg-[var(--variable-name)]` syntax. Components written with v3 syntax won't render correctly.

**Why it happens:** Tailwind 4 changed arbitrary value syntax for CSS variables.

**How to avoid:** Use `bg-(--chart-bar)` not `bg-[var(--chart-bar)]`. This applies to all utility classes — `text-`, `border-`, `fill-`, etc.

**Warning signs:** Arbitrary value classes not resolving in dev tools; colors not appearing when CSS variable is correctly defined.

### Pitfall 3: Dark Mode Not Applying

**What goes wrong:** The `.dark` class in CSS variables works only if a dark mode strategy is configured. Tailwind 4 defaults to `@media (prefers-color-scheme: dark)` — class-based dark mode requires explicit config.

**Why it happens:** shadcn components use `.dark` class variant, but Tailwind 4's default is media query.

**How to avoid:** Add `@variant dark (.dark &);` or configure `darkMode: 'class'` equivalent in the Tailwind 4 theme block. shadcn init sets this automatically if dark mode is selected during init.

**Warning signs:** `.dark` class applied to `<html>` but colors not changing.

### Pitfall 4: FlexBarChart Height Units

**What goes wrong:** CSS flex bar charts using percentage heights require the parent to have an explicit pixel height set. Percentage heights are relative to parent — if parent height is `auto`, bars collapse to 0.

**Why it happens:** Browser height resolution for flex children requires a concrete parent height.

**How to avoid:** Always set the chart container to an explicit pixel height (e.g., `style={{ height: 80 }}` or `h-20` utility). Do not use `h-full` or `h-auto` on the bar container.

**Warning signs:** All bars appear as flat lines or zero height.

### Pitfall 5: Live Count Badges Cause Re-render Storms

**What goes wrong:** If each nav item's count badge subscribes to a separate Convex `useQuery`, the sidebar re-renders on every data change from any of those queries.

**Why it happens:** D-10 requires live counts on every nav item — that's up to 15 separate subscriptions if done naively.

**How to avoid:** Create a single `useNavCounts()` hook that returns all counts from one aggregated Convex query. Badge values come from one subscription update, not 15.

**Warning signs:** React DevTools shows sidebar re-rendering more than 2-3 times per second at rest.

### Pitfall 6: Recharts Tree-Shaking Not Enough

**What goes wrong:** Even after replacing all usages, leaving `recharts` in `package.json` means it stays in the bundle (it's not tree-shaken well — the package doesn't support it).

**Why it happens:** Recharts uses barrel exports and doesn't mark itself as side-effect-free.

**How to avoid:** After migrating all 18 files, run `npm uninstall recharts` and verify the build completes without import errors. Run `npm run build` and check for warnings.

**Warning signs:** Bundle size doesn't decrease meaningfully after "removing" all recharts imports.

---

## Code Examples

### shadcn/ui Init for This Stack

```bash
# Source: shadcn/ui v4.1.2 CLI (VERIFIED: npm view shadcn version = 4.1.2)
# Run from /c/Users/mandr/codepulse
npx shadcn@latest init
# Prompts: style = New York, base color = Neutral/Zinc, CSS variables = yes, dark mode = yes
# tsconfig path alias (@/*) already configured in tsconfig.json and vite.config.ts
# -- No changes needed to tsconfig or vite.config --
```

### Lucide Icon Usage Pattern

```tsx
// Source: lucide-react docs — consistent 4x4 sizing per UI-08
import { Bot, Shield, Brain } from "lucide-react";

// In sidebar nav item:
<Bot className="w-4 h-4 shrink-0" />

// In EntityRow leading icon:
<Shield className="w-4 h-4" />

// Never: custom SVG, text icon strings (current iconMap), or inconsistent sizing
```

### StatusBadge with Rounding Exception (D-04)

```tsx
// Source: Paperclip research — rounded-full exception for badges
import { Badge } from "@/components/ui/badge";

// D-04: status badges get slight rounding (rounded-full is fine for pills)
<Badge variant="outline" className="rounded-full text-xs tabular-nums">
  {count}
</Badge>
```

### Removing CRT Feature Completely

```tsx
// DashboardLayout.tsx: Remove the entire CrtToggle component and its state
// Remove from JSX: <CrtToggle .../>  and  {crtEnabled && <div className="crt-overlay" />}
// Remove from state: crtEnabled, setCrtEnabled, localStorage read
// Remove from useEffect: codepulse-crt-toggle listener
// Remove from index.css: .crt-overlay, ::before, ::after, @keyframes crt-flicker
// Remove from keyboard handler: no replacement needed
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 config file | Tailwind v4 `@theme` block in CSS | 2024 | No `tailwind.config.js` — all in CSS |
| shadcn `default` style | shadcn `New York` style | 2023 | New York uses tighter spacing, stronger borders |
| `import { cva } from "class-variance-authority"` | Same, but auto-installed by shadcn CLI | 2023 | Don't install manually |
| `recharts` for all charts | Custom CSS flex for operational dashboards | Ongoing | Better bundle size, exact visual control |
| v3 arbitrary values `bg-[var(--x)]` | v4 CSS variable shorthand `bg-(--x)` | Tailwind v4 | Required for all generated component code |

**Deprecated/outdated:**

- Cinzel font: removed per D-02. The `@font-face` was only loaded via CDN/system fallback anyway.
- `iconMap` ASCII strings: the entire text-icon system in `DashboardLayout.tsx` is replaced by Lucide.
- `rounded-xl` on cards: replaced by `--radius: 0` global.
- Indigo accent (`indigo-600` in sidebar logo, filter chips): replaced by oklch operational accent.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact oklch L/C/H values for operational tokens (--status-ok, --chart-bar, etc.) need designer validation | Pattern 1: CSS Token Layer | Colors may not meet contrast ratio for WCAG AA on dark/light backgrounds |
| A2 | react-three-fiber, @react-three/drei, three, and react-globe.gl are safe to remove — no active page renders them | Standard Stack / Remove table | If any page renders a 3D component, removing the packages breaks build |
| A3 | shadcn/ui New York style `--radius: 0` will propagate through all generated component code | Standard Stack | Some shadcn components may override radius with hardcoded values — needs post-init audit |
| A4 | A single `useNavCounts()` Convex query can serve all sidebar badge counts efficiently | Pitfall 5 | If no aggregated query exists in Convex schema, it must be written before sidebar implementation |

---

## Open Questions

1. **Are 3D packages safe to remove?**
   - What we know: `@react-three/fiber`, `@react-three/drei`, `three`, and `react-globe.gl` are in `package.json`. The only `.tsx` file that imports them is `src/App.test.tsx` and `OrbitalStatusRings.tsx` / `AgentTopology.tsx`.
   - What's unclear: Whether OrbitalStatusRings and AgentTopology are rendered by any page in normal operation (they appear in Agents.tsx and Dashboard.tsx imports).
   - Recommendation: Read OrbitalStatusRings.tsx and AgentTopology.tsx before the plan is written to confirm they use Three.js. If yes, they become "remove entirely" candidates like TokenSunburst.

2. **Does `useNavCounts()` aggregated query exist in Convex?**
   - What we know: Convex schema has 40+ tables with real-time subscriptions.
   - What's unclear: Whether a query that returns all nav counts in one call exists or needs to be written.
   - Recommendation: Check `convex/` directory during Wave 0 planning. If the query doesn't exist, writing it is a Wave 1 prerequisite for the sidebar.

3. **Dark mode default or system-preference?**
   - What we know: Current codebase has no dark/light toggle. The UI appears to be dark-only (gray-950 background).
   - What's unclear: Should the redesign default to dark mode class permanently, or support system-preference toggle?
   - Recommendation: Default to dark mode class on `<html>` in `main.tsx` — the operational dashboard audience expects dark.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, build | ✓ | v22.17.0 | — |
| npx / npm | shadcn init, package install | ✓ | npm bundled with Node | — |
| shadcn CLI | UI-01 init | ✓ | 4.1.2 (confirmed via npx) | — |
| Vitest | Test validation | ✓ | 4.0.18 | — |
| lucide-react | UI-08 | Not installed | 1.7.0 available | — |
| class-variance-authority | shadcn dependency | Not installed | 0.7.1 available | — |
| clsx | shadcn dependency | Not installed | 2.1.1 available | — |
| tailwind-merge | shadcn dependency | Not installed | 3.5.0 available | — |

[VERIFIED: `command -v node && node --version`, `npm view shadcn version`, `npx shadcn@latest info`]

**Missing dependencies with no fallback:** None — all missing packages are installable via npm.

**Missing dependencies with fallback:** None applicable.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | CSS variables set in DOM; --radius resolves to 0 | unit (CSS snapshot) | `npm test -- --run src/components/__tests__/theme.test.ts` | ❌ Wave 0 |
| UI-02 | MetricCard renders without border/bg; shows tabular-nums value | unit | `npm test -- --run src/components/__tests__/MetricCard.test.tsx` | ✅ (needs update) |
| UI-03 | SectionHeader renders uppercase text + Separator | unit | `npm test -- --run src/components/__tests__/SectionHeader.test.tsx` | ❌ Wave 0 |
| UI-04 | Sidebar renders grouped sections, Lucide icons, count badges | unit | `npm test -- --run src/layouts/__tests__/DashboardLayout.test.tsx` | ❌ Wave 0 |
| UI-05 | FlexBarChart renders bars at correct proportional heights | unit | `npm test -- --run src/components/__tests__/FlexBarChart.test.tsx` | ❌ Wave 0 |
| UI-06 | EntityRow renders icon, primary, secondary, trailing; fires onClick | unit | `npm test -- --run src/components/__tests__/EntityRow.test.tsx` | ❌ Wave 0 |
| UI-07 | Activity entry has slide-in animation class on new items | unit | `npm test -- --run src/components/__tests__/ActivityAnimation.test.tsx` | ❌ Wave 0 |
| UI-08 | All icon usages are lucide-react imports | static (grep) | Manual verification during code review | N/A |

### Sampling Rate

- **Per task commit:** `npm test -- --run` (full suite, ~2s)
- **Per wave merge:** `npm test -- --run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/__tests__/theme.test.ts` — covers UI-01 (CSS variable values)
- [ ] `src/components/__tests__/SectionHeader.test.tsx` — covers UI-03
- [ ] `src/layouts/__tests__/DashboardLayout.test.tsx` — covers UI-04
- [ ] `src/components/__tests__/FlexBarChart.test.tsx` — covers UI-05
- [ ] `src/components/__tests__/EntityRow.test.tsx` — covers UI-06
- [ ] `src/components/__tests__/ActivityAnimation.test.tsx` — covers UI-07
- [ ] Update `src/components/__tests__/MetricCard.test.tsx` — current tests check for borders that will be removed; tests need to be updated for new borderless visual, tabular-nums, Lucide trend icons (replaces `^` / `v` text)

---

## Security Domain

> `security_enforcement` not set in config.json — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — UI layer only, AuthGuard unchanged | existing AuthGuard.tsx |
| V3 Session Management | No — no session changes in this phase | — |
| V4 Access Control | No — no permission changes | — |
| V5 Input Validation | No — no new user inputs introduced | — |
| V6 Cryptography | No | — |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| CSS injection via dynamic class names | Tampering | Never interpolate unsanitized user data into Tailwind class strings — use static variant maps |
| XSS via dangerouslySetInnerHTML in activity feeds | Tampering | Existing pattern uses `.textContent` — maintain that; no innerHTML in EntityRow or FlexBarChart |

This is a visual migration phase. The primary security concern is maintaining existing protections (PrivacyShield, AuthGuard) through the layout refactor. Neither component's logic changes.

---

## Sources

### Primary (HIGH confidence)

- `C:\Users\mandr\Mandras\04-research\paperclip-ui-patterns-2026-04-06.md` — Paperclip design patterns: typography scale, MetricCard/EntityRow/SectionHeader patterns, animation timing, flex chart approach, sidebar structure
- `C:\Users\mandr\codepulse\src\components\MetricCard.tsx` — Current prop API (stable interface)
- `C:\Users\mandr\codepulse\src\layouts\DashboardLayout.tsx` — Current nav structure, CRT code to remove
- `C:\Users\mandr\codepulse\src\index.css` — Current CRT, font, animation CSS (migration target)
- `ui.shadcn.com/docs/theming` — oklch CSS variable format, --radius, dark mode configuration [CITED]
- npm registry — All library versions verified via `npm view` on 2026-04-06 [VERIFIED]

### Secondary (MEDIUM confidence)

- `ui.shadcn.com/docs/installation/vite` — shadcn init command with Vite + Tailwind 4 [CITED]
- Grep audit of `src/` — confirmed 18 Recharts files, 0 Lucide files, 10 MetricCard imports [VERIFIED]
- `npx shadcn@latest info` — confirmed Tailwind v4 detected, no `components.json` yet [VERIFIED]

### Tertiary (LOW confidence)

- Exact oklch chroma/lightness values for operational tokens (--status-ok, --chart-bar) — derived from Paperclip screenshot analysis, not from a published spec [LOW — flag for designer review]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions verified via npm registry
- Architecture patterns: HIGH — directly from Paperclip research doc + codebase audit
- Pitfalls: HIGH — based on concrete codebase evidence (Recharts tree-shaking, CRT state in DashboardLayout, flex height constraints)
- Operational token values: LOW — exact oklch numbers need validation

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable ecosystem — shadcn/ui and Tailwind 4 are not in rapid churn)
