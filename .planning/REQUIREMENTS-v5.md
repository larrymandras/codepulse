# Requirements: v5.0 Premium Dashboard

## v5.0 Requirements

### Design Token Upgrade

- [ ] **DT-01**: Dark theme uses colored OKLCH tokens with subtle blue tint (background ~oklch(0.16 0.012 260)) instead of pure monochromatic grayscale
- [ ] **DT-02**: Each metric category has a dedicated accent hue: cost (orange/amber), health (green/emerald), activity (blue/sky), memory (violet/purple), alerts (red/rose)
- [ ] **DT-03**: Card backgrounds use per-category radial gradients (`radial-gradient(120% 60% at 0% 50%, ${accent}10, transparent 55%)`) for subtle depth
- [ ] **DT-04**: Hover states use translateY(-2px) lift effect with transition (`.lift-on-hover` utility class)
- [ ] **DT-05**: All existing pages continue to render correctly after token migration — no visual regressions on the 15 dashboard pages
- [ ] **DT-06**: `prefers-reduced-motion` continues to disable all new animations

### KPI Panel Redesign

- [ ] **KPI-01**: HeroStatsBar tiles have inline SVG sparkline backgrounds — cubic Bezier paths rendered as decorative fills behind the stat value
- [ ] **KPI-02**: Each KPI tile uses tone-based coloring (default/warn/danger/good) with three-layer status styling: `bg-{color}/10 text-{color} border-{color}/20`
- [ ] **KPI-03**: Stat values use tabular-nums with animated count-up on data change (Motion spring animation)
- [ ] **KPI-04**: KPI tiles are clickable with navigation to the relevant detail page
- [ ] **KPI-05**: Sparkline background data comes from the existing time-series aggregation (hourly rollups) — no new Convex queries needed

### Usage Gauges & Model Metrics

- [ ] **UG-01**: SVG dial gauge component (76px circular) with animated strokeDashoffset showing utilization percentage (budget spent, context used, rate limit proximity)
- [ ] **UG-02**: Model split strip shows per-model cost allocation as a horizontal stacked bar with flowing gradient fills and per-segment expand-on-click detail
- [ ] **UG-03**: Service/provider rows use radial gradient backgrounds with brand-colored accents
- [ ] **UG-04**: Window bar visualization shows usage over time with gradient fills and tick marks (hourly/daily granularity)
- [ ] **UG-05**: All gauge/strip data sources from existing Convex analytics tables — no new aggregation logic needed
- [ ] **UG-06**: Gauges animate smoothly on data updates (not jumpy re-renders)

### Memory Graph 3D

- [ ] **MG-01**: Interactive 3D force-directed graph using react-force-graph-3d + three.js showing memory topology (hubs, workspaces, files, decisions, sessions)
- [ ] **MG-02**: Post-processing bloom effect (UnrealBloomPass) with starfield background (1200+ points) and fog for depth
- [ ] **MG-03**: Multiple view modes: structured (by type), blend (force-directed), spheres (clustered), random
- [ ] **MG-04**: Hover highlighting with adjacency map — hovering a node highlights connected nodes and dims others
- [ ] **MG-05**: Node types visually distinct: hub (large, bright), workspace, file, decision, session, skill, vector_store (each with unique color/size)
- [ ] **MG-06**: 2D SVG constellation fallback for the home dashboard preview (lightweight, no WebGL dependency)
- [ ] **MG-07**: Lazy-loaded — 3D graph bundle not included in initial page load (React.lazy + Suspense)
- [ ] **MG-08**: Memory data sourced from Ástríðr's memory API via existing WebSocket or REST endpoint

### Intelligence Dashboard Panel

- [ ] **ID-01**: Prescription cards display with category icon, tone-based border (info=blue, warn=yellow, action=orange), headline, evidence bullets, and optional runnable command button
- [ ] **ID-02**: Prescription state management UI: accept, dismiss, view history — state changes pushed back to Ástríðr via API
- [ ] **ID-03**: Operator Score displayed as hero metric with circular gauge, trend arrow (↑↓→), and 30-day sparkline
- [ ] **ID-04**: Score sub-dimensions (memory freshness, skill ROI, activity, baseline) shown as breakdown bars with green/yellow/red thresholds
- [ ] **ID-05**: Dream review section with carousel of prescription cards and dismiss/restore actions
- [ ] **ID-06**: Panel gracefully degrades when Ástríðr v15.0 backend is not yet available — shows "Intelligence Engine not active" placeholder instead of errors
- [ ] **ID-07**: Prescription and score data stored in Convex (synced from Ástríðr Supabase) for offline dashboard access

### Cross-Cutting

- [ ] **CC-01**: All new components follow existing Paperclip conventions: shadcn/ui primitives, Lucide icons, Motion animations, memo-optimized
- [ ] **CC-02**: All new components have Vitest test coverage (at minimum: renders without crash, key props handled)
- [ ] **CC-03**: Bundle size increase from 3D graph dependencies (three.js, react-force-graph-3d) is under 500KB gzipped via lazy loading
- [ ] **CC-04**: No new Convex table schema changes required for phases 03-05 (reuse existing tables); phases 06-07 may add prescription/score tables
- [ ] **CC-05**: All visual changes verified in browser before phase completion

---

## Future Requirements (deferred from v5.0)

- Light theme color token upgrade (v5.0 focuses on dark theme)
- Ambient CSS animations (drift, starfield, pulse) beyond hover effects
- Real-time prescription push via WebSocket (v5.0 uses polling/refresh)
- Custom dashboard layout builder (drag-and-drop widget arrangement)
- Export dashboard as PDF report
- Theming system (user-selectable color palettes beyond the default)
