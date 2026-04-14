# Phase 1: UI Redesign - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Adopt the Paperclip design language across the entire CodePulse dashboard — monochromatic oklch palette, shadcn/ui New York style, zero border-radius, information-dense layout, custom CSS flex charts replacing Recharts, Lucide icons, and universal component patterns (MetricCard, EntityRow, SectionHeader). Every page should feel like a professional operational command center.

</domain>

<decisions>
## Implementation Decisions

### Design System Migration
- **D-01:** Remove CRT scanline overlay effect entirely — drop the `.crt-overlay` CSS and related animation
- **D-02:** Remove Cinzel serif font from headings — replace with Geist (or system font) everywhere. Drop the `@font-face` for Cinzel
- **D-03:** Full oklch monochromatic palette — pure grayscale oklch with a single muted accent for interactive elements. No indigo, no colored accents beyond the operational accent
- **D-04:** Border-radius exceptions: avatars stay circular, status badges/pills get slight rounding. Everything else is `--radius: 0` (sharp corners globally)

### Design Tokens
- **D-05:** Claude's Discretion — determine the right token depth. At minimum use shadcn/ui default CSS variables (--background, --foreground, --primary, etc.). Extend with operational tokens (--metric-value, --status-ok, --status-error, --chart-bar) if it improves consistency across the 15 dashboard pages

### Chart Replacement
- **D-06:** Replace ALL 19 Recharts-consuming components with custom CSS flex bar charts — clean break, remove Recharts dependency entirely
- **D-07:** Complex visualizations (TokenSunburst, SankeyFlow, TokenWaterfall) are removed entirely — replace with tables or summary metrics. They are not operationally essential
- **D-08:** CSS flex charts support hover tooltips AND click drill-down — clicking a bar segment opens detail view or filters the page data

### Sidebar & Navigation
- **D-09:** 240px sidebar with nav items grouped by operational function:
  - OVERVIEW: Dashboard, Analytics
  - OPERATIONS: Agents, Executions, Build, Automation
  - SYSTEM: Infrastructure, Security, Self-Healing, Memory
  - INSIGHTS: Capabilities, Briefings, Alerts, Profiles
  - ADMIN: Settings
- **D-10:** Live count badges on every nav item (active sessions, total agents, unread alerts, etc.) — at-a-glance operational awareness
- **D-11:** Collapsible sidebar — collapses to icon-only on small screens, hamburger menu on mobile

### Component Architecture
- **D-12:** Initialize shadcn/ui via CLI (`npx shadcn@latest init`) with New York style on the existing Vite + React 19 + Tailwind 4 stack. Install components as needed
- **D-13:** EntityRow is a full-featured universal list pattern — leading icon, primary text, secondary text, trailing metadata, hover state, divider, click handler. One pattern used across agents, executions, alerts, and all data lists
- **D-14:** Activity feeds use slide-in animations with highlight accent for new entries

### Claude's Discretion
- Component migration order (outside-in vs design-system-first — Claude determines most efficient approach for 93 existing components)
- MetricCard API design (single component vs composable primitives — Claude decides based on usage patterns across the 14 files importing it)
- Exact oklch color values for the monochromatic palette
- Loading skeleton and empty state designs
- Exact spacing scale and typography sizing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design Reference
- `C:\Users\mandr\Mandras\04-research\paperclip-ui-patterns-2026-04-06.md` — Paperclip design patterns research: oklch palette, shadcn/ui New York style, flex charts, EntityRow, MetricCard patterns

### Project Context
- `.planning/PROJECT.md` — Project vision, design reference (Paperclip AI), target stack changes
- `.planning/REQUIREMENTS.md` — UI-01 through UI-08 requirements with acceptance criteria

### Existing Code (migration targets)
- `src/index.css` — Current CRT overlay, font declarations (Geist, Cinzel, JetBrains Mono) — must be replaced
- `src/layouts/DashboardLayout.tsx` — Current sidebar implementation with text icon placeholders and nav items
- `src/components/MetricCard.tsx` — Current MetricCard implementation (bordered, rounded-xl, gray-800 bg) — must be redesigned

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MetricCard.tsx`: exists but needs full restyle (currently bordered, rounded-xl, gray-800). Memoized with trend support — keep the interface concept
- `DashboardLayout.tsx`: sidebar + outlet pattern can be adapted. 15 nav items already defined in `navItems` array
- `AlertBanner.tsx`, `ErrorBoundary.tsx`, `PrivacyShield.tsx`: infrastructure components that may need light restyling but architecture stays

### Established Patterns
- Tailwind 4 with `@import "tailwindcss"` and `@theme` block — standard setup for CSS variable-based design tokens
- React Router v6 with `NavLink` for sidebar navigation
- `sonner` for toast notifications
- Component memoization pattern (React.memo) used on performance-sensitive widgets

### Integration Points
- Layout: `DashboardLayout.tsx` wraps all pages via `<Outlet />`
- Routing: `App.tsx` defines all routes
- State: Convex hooks (useQuery, useMutation) used throughout pages
- Charts: 19 components import from `recharts` — all need replacement
- No component library (no shadcn, no Radix) — clean slate for ui/ directory

</code_context>

<specifics>
## Specific Ideas

- Paperclip AI (github.com/paperclipai/paperclip) is the explicit design reference — shadcn/ui New York, monochromatic oklch palette, --radius: 0, Lucide icons, custom CSS flex charts
- Every metric should use large tabular-nums format with tiny muted labels and no card borders
- Section headers use uppercase tracking-wide muted-foreground with separators
- The feel should be "professional operational command center" — information-dense, scannable, no visual noise

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-ui-redesign*
*Context gathered: 2026-04-06*
