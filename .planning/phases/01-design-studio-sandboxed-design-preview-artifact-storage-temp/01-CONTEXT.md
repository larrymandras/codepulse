# Phase 1: Design Studio — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase integrates [nexu-io/open-design](https://github.com/nexu-io/open-design) — an open-source design generation platform — into CodePulse as a first-class Design Studio page. Open Design uses coding agents (Claude Code, Cursor, Gemini CLI, etc.) as the design engine, with 31 skills, 129 design systems, sandboxed iframe previews, and multi-format export.

The phase delivers two integration modes:
1. **iframe embed** — Open Design running as a Docker sidecar, embedded in a dedicated `/design-studio` page via iframe for immediate full-featured access.
2. **Native UI** — A complete Paperclip-styled reimplementation of the Open Design workflow (skill picker → discovery form → direction picker → live streaming → preview → export) calling the Open Design daemon's REST API directly from the browser.

Both modes ship in this phase. The iframe provides the fast path; the native UI provides the integrated experience.

</domain>

<decisions>
## Implementation Decisions

### Studio Purpose
- **D-01:** Design Studio is an Open Design integration — not a custom-built tool. CodePulse embeds and wraps the nexu-io/open-design platform.
- **D-02:** Two modes delivered: iframe embed (full Open Design UI) AND native CodePulse UI (Paperclip design language). Both complete in this phase.
- **D-03:** The native UI rebuilds the full Open Design flow: skill selection → discovery form → direction picker → live streaming → sandboxed preview → export. No partial/hybrid approach.

### Sandbox & Preview Architecture
- **D-04:** iframe embed mode lives on a dedicated `/design-studio` route, full content area (sidebar stays). Same pattern as Operations, Analytics pages.
- **D-05:** Native UI artifact preview uses `srcdoc` iframe approach (same as Open Design). Proven sandboxing, style isolation from CodePulse.
- **D-06:** Native UI communicates directly with the Open Design daemon REST API from the browser (no Convex proxy). Same pattern as Ástríðr API integration via `VITE_ASTRIDR_API_URL`. New env var: `VITE_OPEN_DESIGN_URL`.

### Infrastructure
- **D-07:** Open Design daemon runs as a Docker sidecar container. Clean separation from CodePulse's Vite dev server.

### Storage & Data Sync
- **D-08:** Open Design owns persistence in its SQLite (`.od/app.sqlite`). Project metadata (name, status, thumbnail) mirrors to a Convex table for native listing/search.
- **D-09:** User-saved templates also mirror to Convex — enables cross-session template discovery in the native gallery.
- **D-10:** All 129 design systems and 31 skills surfaced in the native template gallery. No curation/filtering — full catalog available, users can browse and filter.

### Import & Export
- **D-11:** Native UI supports all Open Design export formats: HTML, PDF, PPTX, ZIP, Markdown.
- **D-12:** Claude Design ZIP import supported in Phase 1 — users can bring in existing Claude Design projects.

### Claude's Discretion
- API communication pattern: direct browser → daemon (decided), but Claude can choose proxy patterns for specific endpoints if security requires it
- Convex table schema design for mirrored project metadata and user templates
- Docker sidecar configuration (ports, volumes, networking)
- Sync mechanism between SQLite and Convex (polling, webhook, or event-driven)
- Navigation placement in DashboardLayout sidebar (icon, position, badge)
- Native UI component decomposition and state management approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Open Design Source
- `https://github.com/nexu-io/open-design` — Source repo. Clone and study the REST API surface, skill system, design system format, and artifact preview mechanism before planning.

### CodePulse Patterns
- `src/layouts/DashboardLayout.tsx` — Sidebar navigation, route registration pattern, iconMap
- `src/pages/Operations.tsx` — Reference for a dedicated page with multiple surfaces (same structure pattern)
- `src/components/BlockRenderer.tsx` — Existing generative UI block system
- `src/contexts/AstridrWSContext.tsx` — Existing external API integration pattern (WebSocket + REST)
- `src/lib/astridrApi.ts` — `authHeaders()` pattern for external API calls — reuse for Open Design API
- `convex/schema.ts` — Convex table definitions, 40+ existing tables

### Design Language
- Paperclip design language: shadcn/ui New York, monochromatic oklch palette, `--radius: 0`, Lucide icons
- All new UI must follow existing CodePulse conventions (dark theme, `bg-gray-800/50` cards, `border-gray-700/50`, `indigo-600` accents)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EntityRow` — List item pattern, usable for project/template listing
- `MetricCard` — Stats display, usable for project counts/status overview
- `SectionErrorBoundary` — Error isolation for each Design Studio surface
- `DiffView` — Could display config/template differences
- `CatalogBrowser` / `CatalogCard` / `CatalogFilters` (in `hr/`) — Gallery browsing pattern with filters, directly applicable to template/skill gallery
- `FlexBarChart` / `Sparkline` — Usage/activity visualization for design projects
- `LoadingState` / `Skeleton` — Loading states during API calls and streaming

### Established Patterns
- External API integration via env var (`VITE_ASTRIDR_API_URL` pattern → `VITE_OPEN_DESIGN_URL`)
- Direct browser-to-API communication with bearer auth headers
- Convex for all persistent data + `useQuery()` subscriptions for live UI updates
- Page-level lazy loading via React.lazy in App.tsx
- shadcn/ui components (Dialog, Sheet, Tabs, Command) for complex interactions

### Integration Points
- `src/App.tsx` — New `<Route>` for `/design-studio`
- `src/layouts/DashboardLayout.tsx` — New nav entry in `navItems` array + icon in `iconMap`
- `convex/schema.ts` — New tables for mirrored design projects and user templates
- `convex/http.ts` — Potential webhook endpoint for Open Design → Convex sync
- Docker compose configuration for the Open Design sidecar

</code_context>

<specifics>
## Specific Ideas

- Open Design uses Next.js 16 + Express daemon + SQLite — the daemon is the single server, web app is stateless
- Skills are file-based `SKILL.md` bundles (31 shipped): web-prototype, dashboard, pricing-page, mobile-app, etc.
- Design systems are `DESIGN.md` with 9 sections: color, typography, spacing, layout, components, motion, voice, brand, anti-patterns
- 5-dimensional quality scoring: Philosophy, Hierarchy, Execution, Specificity, Restraint — triggers re-pass below 3/5
- Anti-slop blacklist forbids generic gradients, emoji icons, fake metrics
- The daemon's REST API at `/api/*` is the integration surface
- Open Design auto-detects coding agents on PATH (Claude Code, Cursor, Gemini CLI, etc.)
- Projects stored at `.od/projects/<id>/` with SQLite at `.od/app.sqlite`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-Design Studio*
*Context gathered: 2026-05-07*
