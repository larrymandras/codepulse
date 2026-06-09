# UI-SPEC — Phase 71: Unified Design System ("Agentic OS")

> Discovery + spec artifact for M2.P0 of the v6.0 Agentic OS Front-End milestone.
> **Scope:** design discovery only. No `src/` code was edited. Every token/finding below is traced to a live file:line in the repo as it stands on 2026-06-09.

---

## 1. Ground-Truth Audit — what the design language ACTUALLY is

Both project docs are WRONG about the current look. The live code tells a third story.

### What the docs claim

| Doc | Claim | Verdict |
|-----|-------|---------|
| `.planning/PROJECT.md:14,116,117` | "shadcn/ui New York, monochromatic **oklch 'Paperclip'** palette, `--radius: 0`, Lucide icons" | **Partly true** — shadcn ✓, Lucide ✓, `--radius:0` ✓ (`:root` only). But monochromatic/Paperclip is **FALSE** for the live dark theme. |
| `CLAUDE.md:72` | "Tailwind CSS 4 only — **no component library**. Cinzel (headings), Geist (body), JetBrains Mono (code). **indigo-600** accents." | **FALSE on two counts** — there IS a component library (shadcn/ui, 30 components), and accents are **emerald `#10b981`**, not indigo. Fonts partly true (see below). |

### What is actually true (the resolved ground truth)

**The live dark theme is a cyberpunk "Matrix Emerald" system**, not a monochrome Paperclip palette and not indigo. Evidence:

- **Primary accent is emerald `#10b981`**, labelled in-code as "Matrix Emerald" — `src/index.css:123` (`--primary: #10b981; /* Matrix Emerald */`). Also `--ring`, `--sidebar-primary`, `--chart-1`, `--chart-bar-accent` all `#10b981` (`src/index.css:134,142,135,159`).
- **There is NO indigo-600 anywhere** in the live theme. (Grep of `src/index.css` — zero indigo tokens.)
- **Component library IS installed and in use.** `src/components/ui/` contains **30 shadcn/ui primitives** (badge, button, card, dialog, table, tabs, tooltip, select, etc.). `package.json:42` ships `radix-ui` (umbrella) `^1.4.3`, `package.json:76` ships the `shadcn` CLI as a devDep, plus CVA/clsx/tailwind-merge (`package.json:32,33,56`). `src/index.css:3` imports `shadcn/tailwind.css`. The CLAUDE.md "no component library" line is stale from before the v4.0 shadcn migration (logged as a Key Decision in `PROJECT.md:132`).
- **Fonts actually loaded:** Geist (body), JetBrains Mono (code), Cinzel (headings, declared but barely used). `index.html:10` loads all three via Google Fonts; `index.html:12` sets `font-geist`; `src/index.css:9-11` defines `--font-geist`/`--font-mono`; `src/index.css:187` sets `body { font-family: var(--font-geist) }`. **Cinzel is loaded but the UI overwhelmingly uses Geist + JetBrains Mono `font-mono`** for the operational/terminal feel (e.g. nav labels `font-mono tracking-wider` `DashboardLayout.tsx:196`, metric labels `font-mono` `MetricCard.tsx:116`). Cinzel has no `--font-*` token and no `@apply` — it is effectively vestigial.
- **`--radius` is `0rem` in `:root`** (`src/index.css:100`) — PROJECT.md is right here. BUT components routinely override with `rounded-xl` / `rounded-lg` / `rounded-sm` (e.g. `MetricCard.tsx:98` `rounded-xl`; `ui/button.tsx:8` `rounded-lg`; `StatusBadge.tsx:47` `rounded-sm`). So the *effective* radius is inconsistent, not zero. This is a real drift to resolve.
- **Heavy cyberpunk effects layer** on top of shadcn: emerald glow shadows, a matrix grid background (`src/index.css:356-373` `.matrix-bg`, mounted `DashboardLayout.tsx:476`), CRT scanline overlay (`DashboardLayout.tsx:478-480`, toggle `361-394`), glitch text (`src/index.css:308-354`, used on the logo `DashboardLayout.tsx:295`), emerald custom scrollbar (`src/index.css:291-306`), and glassmorphism (`--glass-bg/--glass-border/--glass-blur` `src/index.css:103-105,169-171`; `GlassPanel.tsx`).

**Resolution:** PROJECT.md was closer (shadcn + Lucide + radius-0 origin) but its palette descriptor ("monochromatic Paperclip") describes only the **light `:root` theme**, which is monochrome grayscale oklch. The app ships `<html class="dark">` (`index.html:2`) by default, and the dark theme is the cyberpunk Matrix-Emerald skin. CLAUDE.md's styling section is outdated and should be corrected (note for Larry — not edited here).

### Light vs dark, in one line
- **Light (`:root`, `src/index.css:58-114`):** true monochrome — all grayscale oklch, `--primary: oklch(0.205 0 0)` (near-black). This IS the "Paperclip" palette PROJECT.md meant.
- **Dark (`.dark`, `src/index.css:116-172`, the default shipped skin):** Matrix-Emerald cyberpunk — emerald primary, zinc neutrals (`#09090b/#141416/#27272a`), full glow/CRT/matrix/glitch effect layer.

The unified system below **evolves the dark Matrix-Emerald identity** (the real product look), preserving the light monochrome as the secondary theme.

---

## 2. Design Tokens (formalized — evolved from the live `:root`/`.dark`)

All values below are the LIVE tokens unless marked **[NEW]** (a proposed addition to fill a gap) or **[FIX]** (a proposed reconciliation of an inconsistency). Nothing here is invented from scratch.

### 2.1 Color — neutrals & surfaces (dark, the canonical skin)

| Token | Value | Source |
|-------|-------|--------|
| `--background` | `#09090b` (zinc-950) | `index.css:117` |
| `--foreground` | `#ffffff` | `index.css:118` |
| `--card` | `#141416` | `index.css:119` |
| `--popover` | `#141416` | `index.css:120` |
| `--secondary` / `--muted` / `--accent` | `#27272a` (zinc-800) | `index.css:125,127,129` |
| `--muted-foreground` | `#a1a1aa` (zinc-400) | `index.css:128` |
| `--border` / `--input` | `#27272a` | `index.css:132,133` |

### 2.2 Color — brand / accent

| Token | Value | Source |
|-------|-------|--------|
| `--primary` ("Matrix Emerald") | `#10b981` | `index.css:123` |
| `--primary-foreground` | `#09090b` | `index.css:124` |
| `--ring` | `#10b981` | `index.css:134` |
| `--sidebar-active-bar` | `var(--primary)` | `index.css:109` |

### 2.3 Color — semantic status (the canonical status ramp)

| Semantic | Dark value | Light value | Source |
|----------|-----------|-------------|--------|
| success / `--status-ok` | `#22c55e` | `oklch(0.65 0.15 142)` | `index.css:149` / `91` |
| warn / `--status-warn` | `#eab308` | `oklch(0.75 0.12 85)` | `index.css:151` / `93` |
| error / `--status-error` | `#ef4444` | `oklch(0.65 0.18 27)` | `index.css:150` / `92` |
| **info [NEW]** | `#3b82f6` | `oklch(0.62 0.18 250)` | proposed — fills the gap; MetricCard already uses `bg-blue-500` ad-hoc for "info" severity (`MetricCard.tsx:70`). Promote it to a token. |
| `--destructive` | `oklch(0.704 0.191 22.216)` | `oklch(0.577 0.245 27.325)` | `index.css:131` / `73` |
| `--metric-ok/warn/error` (aliases) | → status-* | → status-* | `index.css:106-108` |

**Drift to fix [FIX]:** MetricCard hardcodes severity colors as Tailwind classes/rgba (`bg-red-500`, `rgba(239,68,68,0.8)`, etc. `MetricCard.tsx:66-72`) and StatusBadge consumes the `--status-*` tokens (`StatusBadge.tsx:10-13`). Standardize ALL status color usage on the `--status-*`/`--metric-*`/`--info` tokens so a single source drives every pill, dot, and metric.

### 2.4 Color — chart ramp

| Token | Dark | Source |
|-------|------|--------|
| `--chart-1` | `#10b981` | `index.css:135` |
| `--chart-2` | `#22c55e` | `index.css:136` |
| `--chart-3/4/5` | `oklch(0.439/0.371/0.269 0 0)` (gray ramp) | `index.css:137-139` |
| `--chart-bar` | `#27272a` | `index.css:158` |
| `--chart-bar-accent` | `#10b981` | `index.css:159` |
| `--chart-p50 / p95 / p99` | `#10b981 / #f59e0b / #ef4444` | `index.css:160-162` |

**Drift to fix [FIX]:** `FlexBarChart.tsx:78` hardcodes an **orange** hover glow `rgba(249,115,22,0.6)` on an otherwise emerald gradient bar — a leftover from a pre-Matrix-Emerald palette. The unified system uses emerald glow (`rgba(16,185,129,…)`) for accent hover everywhere.

### 2.5 Glass / elevation tokens

| Token | Dark | Source |
|-------|------|--------|
| `--glass-bg` | `rgba(20,20,22,0.75)` | `index.css:169` |
| `--glass-border` | `rgba(39,39,42,0.6)` | `index.css:170` |
| `--glass-blur` | `12px` | `index.css:171` |

### 2.6 Elevation / glow scale **[NEW — formalizing what's currently inline]**

Today, glow shadows are inline magic strings repeated dozens of times (e.g. `shadow-[0_0_15px_rgba(16,185,129,0.05)]` `Dashboard.tsx:69`; `shadow-[0_0_10px_rgba(16,185,129,0.3)]` `DashboardLayout.tsx:274`; `.glow-card` `index.css:191-207`). Formalize a 4-step glow scale as tokens so pages stop hand-rolling rgba:

```
--glow-xs:  0 0 8px  rgba(16,185,129,0.15);
--glow-sm:  0 0 15px rgba(16,185,129,0.20);
--glow-md:  0 0 25px rgba(16,185,129,0.30);
--glow-lg:  0 0 40px rgba(16,185,129,0.15);   /* large soft, see DashboardLayout.tsx:345 */
```
Status glows derive the same way from `--status-*`.

### 2.7 Typography

| Token | Stack | Source |
|-------|-------|--------|
| `--font-geist` (body) | `"Geist", system-ui, sans-serif` | `index.css:9` |
| `--font-sans` | `'Geist Variable', sans-serif` | `index.css:15` |
| `--font-mono` | `"JetBrains Mono", monospace` | `index.css:10` |
| `--font-heading` | `var(--font-sans)` (i.e. Geist) | `index.css:14` |

**Type scale (de-facto, from live usage):**
- Page H1: `text-2xl font-bold` (`Dashboard.tsx:53`)
- Section header: `text-sm font-semibold uppercase tracking-wide text-muted-foreground` (`SectionHeader.tsx:13`)
- Metric value: `text-3xl font-medium tracking-tight tabular-nums` (`MetricCard.tsx:119,26`)
- Metric/nav label: `text-xs`/`text-[10px] uppercase tracking-widest font-mono` (`MetricCard.tsx:116`, `DashboardLayout.tsx:179`)
- Body: `text-sm`; secondary: `text-xs text-muted-foreground` (`EntityRow.tsx:22,23`)

**Decision needed (see §7):** Cinzel is loaded but vestigial. The "Agentic OS" voice is terminal/operational (mono + Geist), so the recommendation is to RETIRE Cinzel — but flag for Larry since it's an identity element.

### 2.8 Spacing rhythm (de-facto)

- Page sections: `space-y-6` (`Dashboard.tsx:52`)
- Card interior padding: `p-5` (MetricCard `:98`) / `p-4` (header `:524`) / `px-3 py-2.5` (rows `EntityRow.tsx:16`)
- Section header bottom margin: `mb-4` (`SectionHeader.tsx:10`)
- Sidebar width: `w-60` (240px) expanded / `w-48px` collapsed (`DashboardLayout.tsx:483`)
- Header height: `h-14` (`DashboardLayout.tsx:524`)

### 2.9 Radius **[FIX — reconcile the contradiction]**

`--radius: 0rem` (`index.css:100`) but the radius scale is then defined as multiples of it (`index.css:49-55`, all collapse to 0) **while components hardcode `rounded-xl/lg/sm`**. Pick ONE:
- **Recommended:** set `--radius: 0.5rem` (small, modern) and delete the hardcoded `rounded-*` on shared components so the scale (`--radius-sm…4xl`) actually drives geometry. This matches what MetricCard/Button/Badge already render (they look rounded today, contradicting the `0` token).
- Alternative: keep `--radius: 0` (true Paperclip sharp edges) and strip the `rounded-*` overrides. (Bigger visual change.)
This is a genuine fork — see §7.

### 2.10 Motion / transitions (de-facto)

- Standard transition: `transition-all duration-300` (`MetricCard.tsx:98`), `transition-colors`, sidebar width `duration-200` (`DashboardLayout.tsx:483`)
- Entry: `GlassPanel` motion `opacity 0→1, y 8→0, duration 0.2 easeOut` (`GlassPanel.tsx:16-18`)
- Named keyframes: `slide-in-entry 520ms` (`index.css:257-272`), `live-update-pulse 600ms` (`275-281`), `ping-pulse 1.5s` (`284-288`), eq-bounce, glitch, scanline.
- **Honors `prefers-reduced-motion`** globally (`index.css:376-381`) — a hard requirement for the system.

---

## 3. Component Conventions (shared primitives, standardized)

Inventory of the de-facto reusable primitives that repeat across the 15+ pages. Standardize their props/usage; do NOT rewrite them in this phase.

| Primitive | File | Standardized contract |
|-----------|------|----------------------|
| **MetricCard** | `src/components/MetricCard.tsx` | `{label, value\|numericValue, trend?, severity?, threshold?, format?, sparklineData?, onClick?}`. Glow-card surface, emerald-by-default severity dot. **Standardize:** drive dot/value colors from `--status-*`/`--info` tokens (not hardcoded rgba `:66-72`); use `--glow-*` scale. |
| **EntityRow** | `src/components/EntityRow.tsx` | `{icon, primary, secondary?, trailing?, onClick?}`. List row, `border-b border-border`, hover `bg-accent/50`. Already clean — make it the canonical list-row. |
| **StatusBadge** | `src/components/StatusBadge.tsx` | `{status, label?}`. Maps a large `legacyMap` of domain statuses → `ok/warn/error/idle` semantics → `--status-*`. **This is the canonical status-pill** — all ad-hoc colored badges should route through it. |
| **GlassPanel** | `src/components/GlassPanel.tsx` | `{children, className?, animate?}`. The canonical "Panel/Card" container: `bg-card border`, dark glass override, motion entry honoring reduced-motion. |
| **SectionHeader** | `src/components/SectionHeader.tsx` | `{title, action?}`. Uppercase tracked label + separator. Canonical section divider. |
| **FlexBarChart** | `src/components/FlexBarChart.tsx` | `{data, height?, onSegmentClick?}`. Lightweight CSS bar chart (the "custom flex chart over Recharts" decision, `PROJECT.md:133`). **Standardize:** emerald glow on hover (fix orange `:78`); segment colors from chart tokens. |
| **shadcn/ui set** | `src/components/ui/*` (30) | Button/Badge/Card/Dialog/Table/Tabs/Tooltip/Select/etc. These are the base layer; CodePulse primitives compose on top. Keep New-York variants; theme via the CSS vars above. |

**Convention rules going forward:**
1. Surfaces = `GlassPanel` (or `bg-card border border-border`); never hand-roll a card div with inline glass.
2. Status = `StatusBadge`; metrics = `MetricCard`; list rows = `EntityRow`; section dividers = `SectionHeader`.
3. All glow via `--glow-*` tokens; all status color via `--status-*`/`--info`; all chart color via `--chart-*`.
4. Mono (`font-mono uppercase tracking-widest`) for labels/operational chrome; Geist for content.

---

## 4. Icon System

- **Library:** `lucide-react` `^1.8.0` (`package.json:40`). **Standardize on Lucide, exclusively.**
- **Offenders found:** NONE. A grep for `@heroicons`, `react-icons`, `@tabler/icons`, `@radix-ui/react-icons`, `@phosphor` across `src/**/*.tsx` returned zero matches. The old UI-09 "standardize to one icon system" goal is effectively already met at the import level.
- **Real inconsistency (not a different library):** `DashboardLayout.tsx:66-97` maintains a string→component `iconComponents` map (e.g. `"grid"→LayoutDashboard`) so nav items reference icons by string. Other components import Lucide icons directly. **Rule going forward:** nav/IA uses the string map (keeps `navItems` serializable); everything else imports Lucide components directly. Document the map as the single registry; new nav entries MUST add to it (already the pattern in `CLAUDE.md:62`).
- **Rule:** default stroke width, `h-4 w-4` (16px) for inline/nav, `h-3 w-3` for dense chrome, emerald `drop-shadow` glow only on active/hover nav (`DashboardLayout.tsx:204`).

---

## 5. IA Refactor (before → after)

### Current nav (live, `DashboardLayout.tsx:99-140`) — 3 groups, 31 items

```
COMMAND   : Chat, Live Run, Inbox, Tasks, Config, Skills                         (6)
AGENTS    : Roster, Catalog, Onboarding, Teams, Analytics  (/hr/*)               (5)
OVERVIEW  : Dashboard, Capabilities, Analytics, Alerts, Infrastructure,
            Security, Ideation, Self-Healing, Build, Memory, Dreaming,
            Briefings, Automation, Executions, Settings, Insights, WhatsApp,
            War Room, Meeting Bot, Mission Control                               (20)
```
OVERVIEW is a 20-item dumping ground — the core problem this refactor solves.

### Proposed nav (after) — adds **GRAPHS** + **CONSOLE**, splits OVERVIEW, breaks NO routes

```
COMMAND    : Chat, Live Run, Inbox, Tasks, Config, Skills                        (unchanged)

CONSOLE    : Agent Console [ph75 NEW], Live Run*, Executions, Build              (drive coding agents)
             (* Live Run may dual-list; canonical home = COMMAND)

GRAPHS     : Graphs Hub [ph76 NEW], Tool Galaxy [ph72 NEW],
             KG Explorer [ph74 NEW], Capabilities                                (all relationship/graph views)

AGENTS     : Roster, Catalog, Onboarding, Teams, Analytics  (/hr/*)              (unchanged)

OBSERVE    : Dashboard, Analytics, Alerts, Infrastructure, Security,
             Self-Healing, Memory, Insights, Mission Control                     (telemetry/health)

ACTIVITY   : Briefings, Automation, Ideation, Dreaming,
             WhatsApp, War Room, Meeting Bot                                     (feeds/channels/scheduled)

(Settings stays pinned to the footer / UserMenu, not a nav cluster)
```

Rules:
- **No route changes.** Every existing `to` path is preserved; clustering is purely a regrouping of `navItems`. New routes (`/graphs`, `/tools`, `/kg`, `/console`) are added by later phases, registered here only as labels for now (or behind a "coming soon" state).
- The two NEW clusters required by the milestone — **GRAPHS** (Tool Galaxy ph72, KG Explorer ph74, Unified Hub ph76) and **CONSOLE** (Agent Console ph75) — are added without touching `App.tsx` routes.
- OVERVIEW (20 items) is split into OBSERVE + ACTIVITY so no cluster exceeds ~9 items.
- Implementation: convert the three flat arrays into one ordered `navGroups` config (`{group, items[]}`), iterate to render `NavGroup`. `navItems` flat export is preserved for CommandPalette (`DashboardLayout.tsx:140,593`).

---

## 6. Migration Plan (page-by-page adoption, sequenced)

**Wave 0 — Token foundation (no visual regression risk if done right).**
1. Add `--info`, `--glow-xs…lg` tokens to `src/index.css`; resolve the `--radius` fork (§2.9, §7).
2. Fix the two color drifts: FlexBarChart orange→emerald glow (`:78`); MetricCard severity → `--status-*`/`--info` tokens (`:66-72`).
   *Risk:* low; visual diff is intentional convergence. Verify against a screenshot baseline.

**Wave 1 — Layout & IA.**
3. Refactor `DashboardLayout.tsx` nav arrays → `navGroups` config with the 6 clusters (§5). Preserve `navItems` export + `iconComponents` map. No route edits.
   *Risk:* medium — CommandPalette and any code importing `navItems` must keep working; add a test asserting every route still has a nav entry.

**Wave 2 — Primitive consolidation (highest-traffic pages first).**
4. Dashboard, Analytics, Capabilities, Alerts, Infrastructure: replace ad-hoc card divs with `GlassPanel`; ad-hoc badges with `StatusBadge`; inline glow with `--glow-*`.
   *Risk:* medium — these pages have bespoke layouts; do one page per commit, screenshot-diff each.

**Wave 3 — Remaining pages.**
5. Security, Ideation, Self-Healing, Build, Memory, Briefings, Automation, Executions, Settings, Insights, WhatsApp, War Room, Meeting Bot, Mission Control, Chat, Live Run, Inbox, Tasks, Skills, HR/*.
   *Risk:* low-medium individually; the long tail. Sequence by traffic; lazy-loaded pages (`App.tsx:24-56`) can lag.

**Wave 4 — Cleanup.**
6. Retire Cinzel if approved (§7); remove dead radius multiples; update `CLAUDE.md` styling section to match reality.

**Regression watch-list:**
- `--radius` change touches every shadcn component geometry — screenshot-diff broadly.
- CRT/matrix/glitch effects are load-bearing identity (`DashboardLayout.tsx:476-480`); preserve them.
- `prefers-reduced-motion` block (`index.css:376`) must survive any motion refactor.
- Light theme (`:root`) must remain usable — don't bake emerald-only assumptions into shared components.

---

## 7. Open Questions — RESOLVED by Larry (2026-06-09)

**Q1 — Radius identity. → DECISION: (A) `--radius: 0.5rem`.** Set `--radius: 0.5rem` and remove the hardcoded `rounded-*` overrides on shared components so the existing scale (`--radius-sm…4xl`) drives geometry. Matches what the app already renders; lowest-risk. *(Execute in Phase 71 build; touches all shadcn component geometry — screenshot-diff broadly.)*

**Q2 — Cinzel (vestigial serif). → DECISION: (A) Retire Cinzel.** Drop the `index.html:10` font load (perf win); Geist remains the heading font (already `--font-heading`). The Matrix-Emerald + mono look is the real brand. *(Execute in Phase 71 build.)*

**Q3 — Doc reconciliation. → DECISION: Yes, correct now.** `CLAUDE.md` styling section and `.planning/PROJECT.md` design-reference were corrected in this batch (2026-06-09) to: "shadcn/ui New York + Matrix-Emerald dark cyberpunk skin / monochrome light `:root`, Geist + JetBrains Mono, emerald `#10b981` accent, Lucide icons, effective radius `0.5rem`."

> **Phase 71 is now decision-complete and ready to `/gsd-plan-phase 71`.** No open forks remain.

---

## Appendix — files cited (all live as of 2026-06-09)
- `index.html`, `src/index.css`, `package.json`
- `src/layouts/DashboardLayout.tsx`, `src/App.tsx`, `src/pages/Dashboard.tsx`
- `src/components/{MetricCard,EntityRow,StatusBadge,GlassPanel,SectionHeader,FlexBarChart}.tsx`
- `src/components/ui/{button,badge,...}.tsx` (30 shadcn primitives)
