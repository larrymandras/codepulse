# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58, 59, 01, 02 (shipped 2026-04-14, updated 2026-05-09)
- 📋 **v5.0 Premium Dashboard** — Phases 03-07 (planned)

## Phases

<details>
<summary>✅ v4.0 Operational Excellence (9 phases, 42 plans) — SHIPPED 2026-05-06</summary>

- [x] Phase 1: UI Foundation (4 plans) — Paperclip design language, shadcn/ui, oklch palette
- [x] Phase 2: Bidirectional Telemetry (4 plans) — WebSocket consumer + command sender
- [x] Phase 3: Interaction Layer (6 plans) — Inbox, Command Palette, Agent Chat, Live Run, Insights Chat
- [x] Phase 4: Task Management (6 plans) — Kanban, Ideation Findings, Config Editor, Cron management
- [x] Phase 5: Data Pipeline (5 plans) — Aggregation, retention, cursor pagination
- [x] Phase 6: Alert Routing (5 plans) — Rules, webhooks, lifecycle, notification preferences
- [x] Phase 7: Intelligence Layer (5 plans) — Cost forecasting, briefings, anomaly detection, memory quality
- [x] Phase 58: Infrastructure Layer (1 plan) — Command catalog on Capabilities page
- [x] Phase 59: Rubric-Inspired Observability (5 plans) — Operations page with agent status grid, cron calendar, pipeline flow

Full details: [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)

</details>

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1. UI Foundation | v4.0 | 6/6 | Complete   | 2026-05-07 |
| 2. Bidirectional Telemetry | v4.0 | 3/6 | In Progress|  |
| 3. Interaction Layer | v4.0 | 6/6 | Complete | 2026-03-29 |
| 4. Task Management | v4.0 | 6/6 | Complete | 2026-04-03 |
| 5. Data Pipeline | v4.0 | 5/5 | Complete | 2026-04-06 |
| 6. Alert Routing | v4.0 | 5/5 | Complete | 2026-04-09 |
| 7. Intelligence Layer | v4.0 | 5/5 | Complete | 2026-04-12 |
| 58. Infrastructure Layer | v4.0 | 1/1 | Complete | 2026-04-14 |
| 59. Rubric-Inspired Observability | v4.0 | 5/5 | Complete | 2026-05-06 |

### Phase 1: Design Studio — sandboxed design preview, artifact storage, template gallery, export

**Goal:** Integrate nexu-io/open-design into CodePulse as a first-class Design Studio page with two modes: iframe embed for immediate full-featured access and a native Paperclip-styled UI reimplementing the full Open Design workflow (skill selection, discovery, direction picking, live streaming generation, sandboxed preview, multi-format export).
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12
**Depends on:** Phase 0
**Plans:** 6/6 plans complete

Plans:
- [x] 01-00-PLAN.md — Wave 0: Dockerfile for Open Design daemon + 6 test stub files
- [x] 01-01-PLAN.md — Foundation: types, API client, Convex tables, hooks, Docker sidecar
- [x] 01-02-PLAN.md — Page shell, iframe embed, daemon status badge, route/nav registration
- [x] 01-03-PLAN.md — Native UI wizard shell + catalog steps 1-3 (skill, design system, brief)
- [x] 01-04-PLAN.md — Native UI steps 4-6 (direction picker, streaming preview, export panel)
- [x] 01-05-PLAN.md — Project gallery, ZIP import, page integration, Convex sync

### Phase 2: Email Template Manager — CRUD UI for email layouts, content templates, per-agent signature defaults, and asset management

**Goal:** Build a dedicated /email-templates page in CodePulse with 4 tabs (Layouts, Templates, Agent Defaults, Assets) that provides full CRUD management of Astríðr's email template system via REST API, including Monaco-based HTML/CSS editing, live debounced preview, variable schema management with insert-at-cursor chips, per-agent email signature defaults, and image asset gallery with upload.
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14
**Depends on:** Phase 1
**Plans:** 5/6 plans executed

Plans:
- [x] 02-00-PLAN.md — Wave 0: backend prerequisite (GET /api/email-assets) + test stubs + API connectivity
- [x] 02-01-PLAN.md — Foundation: types, API functions, utility library, CRUD hooks
- [x] 02-02-PLAN.md — Page shell with 4 tabs, route/nav registration
- [x] 02-03-PLAN.md — LayoutSheet with Monaco sub-tabs, asset components (dropzone, gallery, picker)
- [x] 02-04-PLAN.md — TemplateSheet with split editor+preview, variable schema table, chips toolbar
- [x] 02-05-PLAN.md — AgentDefaultSheet, wire Templates + Agent Defaults tabs, visual checkpoint

### v5.0 Premium Dashboard

- [x] **Phase 03: Design Token Refresh** — Colored OKLCH dark theme, per-category accent hues, radial gradient cards, lift-on-hover, no regressions (completed 2026-05-14)
- [ ] **Phase 04: KPI Panel Redesign** — SVG sparkline backgrounds on HeroStatsBar, tone-based three-layer status pills, animated count-up
- [ ] **Phase 05: Usage Gauges & Model Metrics** — SVG dial gauges, model split strip with gradient fills, provider rows with radial gradients, window bars
- [ ] **Phase 06: Memory Graph 3D** — react-force-graph-3d + three.js, bloom post-processing, starfield, view modes, lazy-loaded, 2D constellation fallback
- [ ] **Phase 07: Intelligence Dashboard Panel** — Prescription cards, operator score gauge, dream review carousel, score sub-dimensions, v15.0 backend integration

## Phase Details (v5.0)

### Phase 03: Design Token Refresh
**Goal**: CodePulse's dark theme evolves from pure monochromatic grayscale to a subtle colored OKLCH palette with per-category accents — every existing page still renders correctly
**Depends on**: v4.0 completion (Phase 02)
**Requirements**: DT-01, DT-02, DT-03, DT-04, DT-05, DT-06
**Success Criteria** (what must be TRUE):
  1. Dark mode background is `oklch(0.16 0.012 260)` (subtle blue tint) instead of `oklch(0.145 0 0)` (pure gray) — visually warmer
  2. Five accent hue tokens exist in index.css: cost (amber ~80°), health (green ~142°), activity (blue ~230°), memory (violet ~290°), alerts (red ~27°) — each used in at least one component
  3. At least 3 card types (MetricCard, GlassPanel, HeroStatsBar tile) use radial gradient backgrounds with the category accent
  4. `.lift-on-hover` utility class exists and is applied to interactive cards — verified with translateY(-2px) on hover
  5. All 15 existing dashboard pages render without visual regressions — verified in browser
  6. `prefers-reduced-motion: reduce` disables all new transitions
**Plans:** 3/3 plans complete

Plans:
- [x] 03-01-PLAN.md — Wave 1: Token foundation: whisper-tint dark theme, accent hues, lift-on-hover, data-accent gradient selectors
- [x] 03-02-PLAN.md — Wave 2 (depends 03-01): Component adoption: MetricCard, GlassPanel, HeroStatsBar get accent gradients and lift-on-hover
- [x] 03-03-PLAN.md — Wave 3 (depends 03-02): Visual regression verification: build/test/type check + human visual checkpoint

### Phase 04: KPI Panel Redesign
**Goal**: The HeroStatsBar transforms from flat colored tiles to a premium panel with decorative SVG sparkline backgrounds, semantic status pills, and animated values
**Depends on**: Phase 03 (accent tokens must exist)
**Requirements**: KPI-01, KPI-02, KPI-03, KPI-04, KPI-05
**Success Criteria** (what must be TRUE):
  1. Each HeroStatsBar tile renders an inline SVG sparkline as a decorative background — cubic Bezier path visible behind the stat value
  2. Tiles change tone based on thresholds: green (good), yellow (warn), red (danger) — with three-layer styling (bg/text/border at different opacities)
  3. Stat values animate on data change using Motion spring animation with tabular-nums font variant
  4. Clicking a KPI tile navigates to the relevant detail page (sessions → SessionKanban, errors → Alerts, etc.)
  5. Sparkline data comes from existing hourly aggregation tables — no new Convex queries added
**Plans:** 3 plans

Plans:
- [ ] 04-01-PLAN.md — Wave 1: Foundation: tone CSS tokens, thresholdTone() utility, BackgroundSparkline component + tests
- [ ] 04-02-PLAN.md — Wave 2 (depends 04-01): Integration: wire BackgroundSparkline + tone system into HeroStatsBar + tests
- [ ] 04-03-PLAN.md — Wave 3 (depends 04-02): Visual verification: build/test/type check + human visual checkpoint

### Phase 05: Usage Gauges & Model Metrics
**Goal**: Cost and usage data is displayed through rich visual components — circular gauges, gradient strip charts, and provider rows — replacing flat tables and basic bar charts
**Depends on**: Phase 03 (accent tokens), Phase 04 (status pill patterns)
**Requirements**: UG-01, UG-02, UG-03, UG-04, UG-05, UG-06
**Success Criteria** (what must be TRUE):
  1. A 76px SVG dial gauge renders on the Analytics page showing budget utilization with animated strokeDashoffset
  2. Model split strip shows per-model cost allocation as a horizontal stacked bar — clicking a segment expands to show detail (model name, cost, percentage)
  3. Provider rows have radial gradient backgrounds with the provider's brand color
  4. Window bar shows usage over a time range with gradient fill and tick marks at hourly intervals
  5. All data comes from existing Convex analytics/cost tables — no new aggregation mutations
  6. Gauges animate smoothly on Convex subscription updates (no flash/jump)
**Plans**: TBD

### Phase 06: Memory Graph 3D
**Goal**: An interactive 3D force-directed graph visualizes Astríðr's memory topology — nodes are memories, edges are relationships — with bloom effects, a starfield backdrop, and multiple view modes
**Depends on**: Phase 03 (color tokens for node types)
**Requirements**: MG-01, MG-02, MG-03, MG-04, MG-05, MG-06, MG-07, MG-08
**Success Criteria** (what must be TRUE):
  1. The Memory page renders an interactive 3D force graph with nodes colored/sized by type (hub, workspace, file, decision, session, skill, vector_store)
  2. UnrealBloomPass bloom effect is visible on bright nodes, with a 1200+ point starfield and fog for depth
  3. At least 3 view modes are switchable: structured (by type), blend (force-directed), spheres (clustered)
  4. Hovering a node highlights its connected neighbors and dims non-adjacent nodes
  5. A 2D SVG constellation renders on the Dashboard as a lightweight preview (no WebGL needed)
  6. The 3D graph bundle is lazy-loaded — initial page load does not include three.js or react-force-graph-3d (confirmed via network tab)
  7. Memory data is fetched from Astríðr's memory API (REST or WebSocket) and transformed into graph nodes/edges
**Plans**: TBD

### Phase 07: Intelligence Dashboard Panel
**Goal**: Prescriptions from Astríðr's Intelligence Engine (v15.0) are displayed as actionable cards with state management, and the Operator Score is the hero metric on the dashboard
**Depends on**: Phase 03 (tokens), Phase 04 (status pill patterns), Phase 05 (gauge component for score display)
**Requirements**: ID-01, ID-02, ID-03, ID-04, ID-05, ID-06, ID-07
**Success Criteria** (what must be TRUE):
  1. Prescription cards render with category icon, tone-based border (info=blue, warn=yellow, action=orange), headline, evidence bullets, and command button
  2. Accept/dismiss actions on prescription cards push state changes back to Astríðr and update the UI immediately
  3. Operator Score renders as a circular gauge with trend arrow and a 30-day sparkline below
  4. Score sub-dimensions (memory, ROI, activity, baseline) render as horizontal breakdown bars with green/yellow/red thresholds
  5. Dream review section renders as a horizontally scrollable carousel of prescription cards
  6. When Astríðr v15.0 is not active, the panel shows "Intelligence Engine not active" placeholder — no errors, no blank space
  7. Prescription and score data syncs to Convex tables for persistence
**Plans**: TBD

---

*Last updated: 2026-05-14 — v5.0 Premium Dashboard milestone planned (5 phases).*
