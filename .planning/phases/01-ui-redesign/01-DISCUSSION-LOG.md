# Phase 1: UI Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 01-ui-redesign
**Areas discussed:** Design system migration, Chart replacement strategy, Sidebar & navigation overhaul, Component architecture

---

## Design System Migration

### CRT & Fonts

| Option | Description | Selected |
|--------|-------------|----------|
| Remove both | Drop CRT overlay entirely, replace Cinzel with Geist everywhere — clean Paperclip look | ✓ |
| Keep Cinzel headings only | Drop CRT overlay but keep Cinzel for h1/h2 as a distinctive brand touch | |
| Remove CRT, you decide fonts | CRT goes, Claude picks the best font stack for the Paperclip aesthetic | |

**User's choice:** Remove both
**Notes:** Clean break from current retro-terminal aesthetic

### Color Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Full oklch monochromatic | Pure grayscale oklch with single muted accent — matches Paperclip exactly | ✓ |
| oklch with brand accent | oklch grayscale base but keep an indigo or custom accent for CodePulse identity | |
| You decide | Claude picks palette matching Paperclip while keeping readability | |

**User's choice:** Full oklch monochromatic
**Notes:** No brand accent retention — pure Paperclip approach

### Design Tokens

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn/ui default tokens | Standard shadcn/ui CSS variables | |
| Extended token system | shadcn/ui plus custom operational tokens | |
| You decide | Claude determines right token depth | ✓ |

**User's choice:** You decide
**Notes:** Claude discretion on token depth

### Border-Radius

| Option | Description | Selected |
|--------|-------------|----------|
| Zero everywhere, no exceptions | Everything sharp — avatars, buttons, badges, all square | |
| Avatars get border-radius | Only avatars stay circular | |
| Avatars and pills/badges | Avatars circular, badges/pills get slight rounding | ✓ |

**User's choice:** Avatars and pills/badges
**Notes:** Minor exceptions for visual distinction on small elements

---

## Chart Replacement Strategy

### Replacement Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Replace all 19 at once | Clean break — remove Recharts entirely in Phase 1 | ✓ |
| Primary displays only | Main dashboard charts get CSS flex bars, keep Recharts for complex viz | |
| Page by page | Replace as each page is redesigned | |

**User's choice:** Replace all 19 at once
**Notes:** Complete Recharts removal, no mixed visual language

### Interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Hover tooltips only | Bars show value on hover, no click actions | |
| Hover + click drill-down | Tooltips on hover, clicking a bar opens detail view or filters | ✓ |
| You decide | Claude picks interactivity per chart | |

**User's choice:** Hover + click drill-down
**Notes:** Full interactivity on flex bar charts

### Complex Visualizations

| Option | Description | Selected |
|--------|-------------|----------|
| Remove them entirely | Not operationally essential, simplify to tables/metrics | ✓ |
| Keep but restyle | Keep Recharts for 3 complex ones, restyle to match new palette | |
| You decide | Claude determines operational value | |

**User's choice:** Remove them entirely
**Notes:** TokenSunburst, SankeyFlow, TokenWaterfall all removed — replaced with tables or summary metrics

---

## Sidebar & Navigation Overhaul

### Nav Grouping

| Option | Description | Selected |
|--------|-------------|----------|
| By function (Recommended) | OVERVIEW, OPERATIONS, SYSTEM, INSIGHTS, ADMIN grouping | ✓ |
| Flat list, no sections | All 15 items in single scrollable list | |
| Custom grouping | User specifies their own sections | |

**User's choice:** By function
**Notes:** 5-section grouping by operational purpose

### Live Count Badges

| Option | Description | Selected |
|--------|-------------|----------|
| Active counts only | Only items needing attention show badges | |
| Counts on everything | Every nav item shows a count | ✓ |
| You decide | Claude picks based on operational value | |

**User's choice:** Counts on everything
**Notes:** Full at-a-glance operational awareness

### Mobile Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible sidebar | Icon-only on small screens, hamburger on mobile | ✓ |
| Full overlay on mobile | Full-screen overlay drawer with backdrop | |
| You decide | Claude picks best responsive approach | |

**User's choice:** Collapsible sidebar
**Notes:** Standard collapse-to-icons pattern

---

## Component Architecture

### shadcn/ui Setup

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn/ui CLI init (Recommended) | Run npx shadcn@latest init with New York style | ✓ |
| Manual setup | Copy specific primitives without CLI scaffolding | |
| You decide | Claude picks best setup for the stack | |

**User's choice:** shadcn/ui CLI init
**Notes:** Standard CLI approach

### Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Redesign from outside in | Layout shell first, then pages, then widgets | |
| Build design system first | Create all base primitives in ui/, then update pages | |
| You decide | Claude determines most efficient order | ✓ |

**User's choice:** You decide
**Notes:** Claude discretion on 93-component migration order

### MetricCard Pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Single component | One <MetricCard label value trend /> | |
| Composable primitives | Metric.Root / Metric.Value / Metric.Label / Metric.Trend | |
| You decide | Claude picks based on usage patterns across 14 importing files | ✓ |

**User's choice:** You decide
**Notes:** Claude discretion based on actual usage analysis

### EntityRow

| Option | Description | Selected |
|--------|-------------|----------|
| Full-featured row | Leading icon, primary/secondary text, trailing metadata, hover, divider, click | ✓ |
| Minimal + slots | Basic structure with named slots | |
| You decide | Claude designs based on page data needs | |

**User's choice:** Full-featured row
**Notes:** Universal pattern for all data lists

---

## Claude's Discretion

- Design token depth (standard shadcn vs extended operational tokens)
- Component migration order (outside-in vs design-system-first)
- MetricCard API design (single vs composable)
- Exact oklch palette values
- Loading skeleton and empty state patterns
- Spacing scale and typography sizing

## Deferred Ideas

None — discussion stayed within phase scope
