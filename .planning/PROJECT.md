# CodePulse

## What This Is

Multi-provider operational command center for Ástríðr AI assistant. React 19 + Vite + Convex SPA with 15 dashboard pages, 50+ Convex tables, and 110+ UI components. Features bidirectional WebSocket telemetry, multi-provider cost intelligence (7 providers), gateway observability with quota/routing/spend controls, agent chat with generative UI blocks, unified inbox, task Kanban, intelligent alerting with Discord/Slack/PagerDuty/Email/GitHub Actions delivery, cost forecasting, anomaly detection, LLM-powered session briefings, and call graph visualization.

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard. And now: take action on it.

## Current State

**In progress:** v8.0 Graph/KG Consolidation (started 2026-06-18). **Phase 83 — Graph Snapshot Receiver (GH-01)** complete 2026-06-18 (Convex tables + `graphSnapshots.ts` receiver, versioned-swap upsert, dangling-link drop, retention cron, `getProjectGraph` read API; live round-trip verified vs `tidy-whale-981`). **Phase 84 — Graphs Hub + Code/Vault Render (GH-02, GH-03)** complete 2026-06-22 (`useProjectGraph` hook, `CodeVaultGraph` dual-palette force-graph hero with source filter / truncation / freshness / integrity / detail panel / fullscreen, `GraphsHub` page, lazy `/graphs` route, nav placeholder flipped; 7/7 must-haves + human UAT passed via Playwright on real Convex data). Next: Phase 85 Cross-Graph Navigation (GH-04) per roadmap sequence, or Phase 88 Analytics Rollup (scaffolded).
**Shipped:** v7.0 Forge Integration (2026-06-17) — Forge folded into CodePulse as a first-class module via the Surface-Substrate bridge: a local Forge daemon emits state UP through bearer-authed Convex httpActions, and CodePulse sends commands DOWN through a Convex queue the daemon polls. Read render → launch/stop → live log streaming → files + artifact preview, all Clerk-gated; no localhost/mixed-content path. Archive: `milestones/v7.0-ROADMAP.md`.
**Prior shipped:** v5.0 Advanced Visualization & Integrations (2026-05-25). v6.0 Agentic OS Front-End **closed 2026-06-18** — phases 71-74 shipped (light); 77 (CI hardening) complete; 75 (Agent Console) superseded by v7.0 Forge; **76 (Unified Graph Hub) NOT shipped → deferred to v8.0** (2026-06-18 reconciliation).
**Stack:** React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Convex, shadcn/ui New York, Lucide icons, D3.js, dagre, Resend, React Email
**Codebase:** ~66,600 LOC TypeScript (src/ + convex/)

<details>
<summary>v4.0 — Operational Excellence (2026-04-14)</summary>

8 phases: UI Foundation, Bidirectional Telemetry, Interaction Layer, Task Management, Data Pipeline, Alert Routing, Intelligence Layer, Infrastructure Layer.
</details>

v5.0 added 12 phases:
1. Schema Foundation — 4 new tables, 2 extensions for all v5.0 features
2. Context Window Animation — real-time progress bar with compaction markers
3. Token Sunburst — two-level ring chart for per-agent/tool token consumption
4. Email Digest — scheduled HTML summary via Resend
5. Call Graph — directed agent/tool dependency graph with dagre layout
6. PagerDuty — incident trigger/resolve via Events API v2
7. GitHub Actions — workflow_dispatch from alert rules
8. Gateway Compatibility — central provider registry, OTel fix, gateway event routing
9. Multi-Provider Pricing — GPT/Gemini pricing, billingType, subscription vs API split
10. Gateway Observability — quota gauges, routing decisions, provider comparison
11. SDK Spend Guard — provider controls, spend cap, session provider badges
12. External Integrations & Call Graph — email/PagerDuty delivery + call graph visualization

## Current Milestone: v8.0 Graph/KG Consolidation

> **Started 2026-06-18.** Completes the Unified Graph Hub that Phase 76 (v6.0) never shipped, and deepens the KG Explorer (Phase 74). Net-new work is almost entirely CodePulse-side: Ástríðr's `graph_snapshot` uploader (graphify code graph + Obsidian vault wikilinks → `{nodes,links}` pushed to Convex `/runtime-ingest`, nightly cron) **already ships** (Ástríðr Phase 137 / M1.P4, 2026-06-09) — but CodePulse has **no receiver**, so those snapshots are currently dropped on the floor. v8.0 builds the receiver, the `/graphs` hub, cross-graph navigation, and four KG depth features.

**Goal:** Operators explore all of Ástríðr's graphs — KG, tool galaxy, MCP, and the code/vault dependency graph — from one unified Graphs hub, with deeper KG search, clustering, saved views, and temporal diff.

**Requirements:**
- **GH-01..04** — graph-snapshot receiver (Convex table + `runtimeIngest` dispatch; fixes the dropped-events bug), `/graphs` landing rendering the pushed code+vault graph, unified hub IA, cross-graph navigation
- **KG-08..11** — full-text fact search (+ Ástríðr `/api/kg/search` endpoint), clustering/community-detection layout (leverages the `community` field already in the snapshot payload), named/saved + shareable views, temporal diff/animation

**Phases (83+):** set by the roadmap — this section updates when the roadmap lands. Reuses in-house patterns: the v7.0 Forge receiver (for GH-01), `ForceGraphCanvas` / `kg-graph.ts` / `ObsidianGraph` (render), and the existing KG Explorer (Phase 74) for the depth features.

**Cross-repo:** mostly CodePulse-side. The one likely Ástríðr delta is a `/api/kg/search` endpoint for full-text fact search (KG-08); the snapshot uploader (GH-01's producer) is already done.

## Closed Milestone: v6.0 Agentic OS Front-End

> **Closed 2026-06-18** (reconciled against live code). Phases **71/72/73/74 shipped** (light-mode); **75 (Agent Console) superseded** by v7.0 Forge; **77 (CI & Production Hardening) complete** (3/3). **76 (Unified Graph Hub) was NOT shipped** — only the 3 standalone graph pages exist; its HUB-01/02/03 requirements are **absorbed into v8.0** (GH-01..04). All DS/GAL/MCP/KG/CON/HUB/OPS requirements retained in REQUIREMENTS.md — nothing dropped.

## Requirements

### Validated (v4.0)

- ✓ Paperclip design language (shadcn/ui New York, oklch, zero border-radius) — v4.0 Phase 1
- ✓ MetricCard, EntityRow, FlexBarChart patterns across all pages — v4.0 Phase 1
- ✓ Compact 240px sidebar with live count badges — v4.0 Phase 1
- ✓ Bidirectional WebSocket with topic subscriptions and command sending — v4.0 Phase 2
- ✓ Real-time dashboard updates within 1 second — v4.0 Phase 2
- ✓ Generative UI Block system with BlockRenderer dispatcher — v4.0 Phase 3
- ✓ Command Palette (Cmd+K) with entity search — v4.0 Phase 3
- ✓ Agent Chat with approval gates — v4.0 Phase 3
- ✓ Unified Inbox with keyboard navigation — v4.0 Phase 3
- ✓ RunTimeline with Flow DAG visualization — v4.0 Phase 3
- ✓ Insights Chat with LLM backend — v4.0 Phase 3
- ✓ 6-column Kanban with drag-and-drop — v4.0 Phase 4
- ✓ Ideation Findings with status workflow — v4.0 Phase 4
- ✓ Config Editor with diff preview and hot-reload — v4.0 Phase 4
- ✓ Cron management with visual builder — v4.0 Phase 4
- ✓ Time-series aggregation (hourly + daily rollup) — v4.0 Phase 5
- ✓ Data retention with configurable archival — v4.0 Phase 5
- ✓ Cursor-based pagination across 7 domains — v4.0 Phase 5
- ✓ Analytics on pre-computed aggregates — v4.0 Phase 5
- ✓ Configurable alert rules (static + compound) — v4.0 Phase 6
- ✓ Discord/Slack webhook delivery with retry — v4.0 Phase 6
- ✓ Alert lifecycle (acknowledge/mute/escalate) — v4.0 Phase 6
- ✓ Per-severity notification preferences — v4.0 Phase 6
- ✓ Cost forecasting with budget thresholds — v4.0 Phase 7
- ✓ LLM-generated session briefings with daily digest — v4.0 Phase 7
- ✓ Anomaly detection with z-score auto-alerts — v4.0 Phase 7
- ✓ Memory quality metrics (dedup, staleness, contradictions) — v4.0 Phase 7
- ✓ WebSocket command catalog on Capabilities page — v4.0 Phase 58

### Validated (v5.0)

- ✓ Call graph with dagre layout, node state coloring, error path highlighting — v5.0 Phase 63/70
- ✓ Context window animated progress bar with compaction markers — v5.0 Phase 60
- ✓ Token sunburst two-level ring with drill-down — v5.0 Phase 61
- ✓ Email digest delivery via Resend with configurable schedule — v5.0 Phase 62/70
- ✓ PagerDuty trigger/resolve via Events API v2 with dedup_key — v5.0 Phase 64/70
- ✓ GitHub Actions workflow_dispatch from alert rules — v5.0 Phase 65
- ✓ Central provider registry (7 providers, 3 legacy + 4 gateway) — v5.0 Phase 66
- ✓ Multi-provider cost intelligence with billingType dimension — v5.0 Phase 67
- ✓ Gateway observability (quota, routing, tasks, comparison) — v5.0 Phase 68
- ✓ SDK spend guard with projected daily totals — v5.0 Phase 69

### Validated (v7.0 Forge Integration)

- ✓ FI-01 … FI-14 — Forge folded into CodePulse (schema/emitter, read UI, command bridge, live logs, files/preview, hardening) — Phases 78-82 (shipped 2026-06-17)

### Active (v8.0 Graph/KG Consolidation)

- [x] GH-01 — Graph-snapshot receiver: `graphSnapshots` table + `runtimeIngest` dispatch for `graph_snapshot` (idempotent on `snapshotId`) + read query API; stops dropping Ástríðr's nightly snapshots — **Phase 83 (2026-06-18)**
- [x] GH-02 — `/graphs` landing renders the pushed code (graphify) + vault (Obsidian) graph from Convex, reusing `ForceGraphCanvas`, with truncation indicated — **Phase 84 (2026-06-22)**
- [x] GH-03 — Unified Graphs hub: KG Explorer, Tool Galaxy, MCP Inventory, code/vault graph reachable from one hub with consistent interactions — **Phase 84 (2026-06-22)**
- [ ] GH-04 — Cross-graph navigation: deep-link tool → owning agent → KG entity across graph surfaces where data supports it
- [ ] KG-08 — Full-text fact search across fact text/values + relationship labels (backed by an Ástríðr `/api/kg/search` endpoint)
- [ ] KG-09 — Clustering / community-detection layout for large graphs (leverages the `community` field in the snapshot payload)
- [ ] KG-10 — Named, saved, and shareable graph views (beyond last-state idb persistence)
- [ ] KG-11 — Temporal diff / animation: compare the KG between two as-of points and/or animate evolution

Full definitions + traceability: `.planning/REQUIREMENTS.md`. Closed v6.0 requirements (DS/GAL/MCP/KG/CON/HUB/OPS) retained there as well.

### Out of Scope

- Mobile app — web-first, responsive layouts sufficient
- Multi-tenant — single operator dashboard
- OpenTelemetry collector — Convex handles persistence
- React Three Fiber / 3D visualizations — not operationally useful
- Bidirectional PagerDuty sync — inbound webhook complexity disproportionate for single operator

## Context

- **Ástríðr repo:** C:\Users\mandr\astridr-repo (WebSocket endpoint + CLI Gateway)
- **CodePulse repo:** C:\Users\mandr\codepulse
- **Design reference (corrected 2026-06-09):** shadcn/ui New York + Tailwind 4. Default skin is a **dark "Matrix Emerald" cyberpunk theme** (emerald `#10b981` accent, zinc neutrals, glow/CRT effects); light `:root` is monochrome oklch. Geist + JetBrains Mono (Cinzel retired), Lucide icons, effective radius `0.5rem`. Formal system: `.planning/phases/071-unified-design-system/UI-SPEC.md`. *(The old "monochromatic Paperclip / --radius:0" descriptor was inaccurate for the live dark theme.)*
- **Stack:** React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Convex, shadcn/ui, Lucide, React Flow, D3.js, dagre, Resend, React Email
- **Providers:** 7 total — Anthropic Direct, OpenRouter, Ollama (legacy); Claude CLI, Codex CLI, Antigravity CLI, Claude SDK (gateway)
- **Codebase:** ~66,600 LOC TypeScript, 50+ Convex tables, 15 dashboard pages, 110+ UI components

## Constraints

- **Cross-repo:** WebSocket endpoint in Ástríðr repo, consumed by CodePulse
- **Convex:** All persistence through Convex — no direct database access
- **Backward compatible:** /ingest and /runtime-ingest endpoints must continue working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paperclip as design reference | Information-dense, monochromatic, professional operational feel | ✓ Good — consistent across 15 pages |
| shadcn/ui New York over custom components | Consistent design system, Radix primitives, community maintained | ✓ Good — reduced custom component code |
| Custom CSS flex charts over Recharts | Compact, lightweight, matches Paperclip aesthetic | ✓ Good — smaller bundle, better fit |
| WebSocket for real-time over polling | Sub-second latency, reduces HTTP traffic | ✓ Good — validated in Phase 2 |
| Convex .paginate() for list views | Server-side cursors, no full-table scans | ✓ Good — 7 domains paginated |
| Compound AND/OR alert rules | Flexible alert conditions beyond simple thresholds | ✓ Good — extensible rule engine |
| Z-score anomaly detection | Statistical approach, no ML dependency | ✓ Good — auto-creates alerts |
| WebSocket command catalog | Live registry vs static Convex count | ✓ Good — real-time command visibility |
| Central provider registry | Single source of truth for all 7 providers | ✓ Good — eliminates hardcoded provider arrays |
| D3 for sunburst/area, dagre for call graph | Recharts insufficient for ring/graph viz | ✓ Good — clean D3/React ownership split |
| Resend for email digest | Consistent with Convex action pattern | ✓ Good — simple API, reliable delivery |
| PagerDuty Events API v2 (not REST) | Stable dedup_key for trigger/resolve lifecycle | ✓ Good — clean incident management |
| billingType dimension on cost aggregation | Subscription vs API-billed cost separation | ✓ Good — accurate cost intelligence |
| dagre graph per-call (not module scope) | Deterministic layout on each render | ✓ Good — avoids stale layout state |
| Force-directed (react-force-graph-2d) for relationship graphs (v6.0) | Reverses the v5.0 "force-directed out of scope" call: dagre suits DAGs (call graph), but the Obsidian vault graph and Ástríðr KG are cyclic entity-relationship graphs where force layout is the right fit. Already validated by the merged Obsidian graph. | KG-viz + Obsidian graph use it; dagre retained for the call graph |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-22 — v8.0 in progress: Phase 83 (GH-01 receiver) + Phase 84 (GH-02/GH-03 Graphs Hub + Code/Vault render) complete & UAT-passed. GH-04 + KG-08..11 remain. Next: Phase 85 Cross-Graph Navigation (roadmap sequence) or Phase 88 Analytics Rollup (scaffolded).*
