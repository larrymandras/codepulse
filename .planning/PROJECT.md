# CodePulse

## What This Is

Multi-provider operational command center for Ástríðr AI assistant. React 19 + Vite + Convex SPA with 15 dashboard pages, 50+ Convex tables, and 110+ UI components. Features bidirectional WebSocket telemetry, multi-provider cost intelligence (7 providers), gateway observability with quota/routing/spend controls, agent chat with generative UI blocks, unified inbox, task Kanban, intelligent alerting with Discord/Slack/PagerDuty/Email/GitHub Actions delivery, cost forecasting, anomaly detection, LLM-powered session briefings, and call graph visualization.

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard. And now: take action on it.

## Current State

**Shipped:** v8.0 Graph/KG Consolidation (2026-06-23) — all 5 phases (83-87), 8/8 requirements (GH-01..04, KG-08..11), milestone audit PASSED. Built the receiver for Ástríðr's nightly `graph_snapshot` (GH-01), the unified `/graphs` hub replacing the placeholder nav stub (GH-02/03), cross-graph tool→agent→KG navigation (GH-04), community-cluster layout (KG-09), a full-text KG Search lens (KG-08), saved + shareable graph views (KG-10), and KG temporal Diff/Animate sub-modes (KG-11). Two follow-ons are data-gated on cross-repo Ástríðr deltas (live full-text search needs `/api/kg/search`, SEED-008; live clustering needs `community` emission, D-10) — CodePulse side complete and degrades gracefully. Phase 87 deployed to prod `tidy-whale-981`. Archive: `milestones/v8.0-ROADMAP.md`.
**Prior shipped:** v7.0 Forge Integration (2026-06-17) — Forge folded into CodePulse via the Surface-Substrate bridge: a local daemon emits state UP through bearer-authed Convex httpActions, and CodePulse sends commands DOWN through a Convex queue the daemon polls. Clerk-gated; no localhost/mixed-content path. Archive: `milestones/v7.0-ROADMAP.md`. v5.0 Advanced Visualization & Integrations (2026-05-25). v6.0 Agentic OS Front-End **closed 2026-06-18** — phases 71-74 shipped (light); 77 (CI hardening) complete; 75 (Agent Console) superseded by v7.0 Forge; **76 (Unified Graph Hub) NOT shipped → deferred to v8.0** (2026-06-18 reconciliation).
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

## Shipped Milestone: v8.0 Graph/KG Consolidation

> **Shipped 2026-06-23** (started 2026-06-18). 5 phases (83-87), 17 plans, 8/8 requirements (GH-01..04, KG-08..11); milestone audit PASSED. Completed the Unified Graph Hub that Phase 76 (v6.0) never shipped and deepened the KG Explorer (Phase 74): graph-snapshot receiver (stops dropping Ástríðr's nightly snapshots — the full ~4,038-node real graph is now live) + `/graphs` hub + cross-graph navigation + KG search / clustering / saved-views / temporal-diff. Two follow-ons are data-gated on cross-repo Ástríðr deltas (live full-text search needs `/api/kg/search`, SEED-008; live community clustering needs `community` emission, D-10) — the CodePulse side is complete and degrades gracefully today. Archive: `milestones/v8.0-ROADMAP.md`; audit: `milestones/v8.0-MILESTONE-AUDIT.md`.

## Next Milestone: v9.0 Readability & Experience (seed)

> **Seeded 2026-06-22.** Readable theme system + editorial skin toggle (the dark Matrix-Emerald default is hard to read). Phase 89 in progress — `ThemeSwitcher` shipped (toggles `data-theme` cyan/emerald/amber via the existing `index.css` palettes; default skin now Electric Cyan). Agent Room + 3D galaxy are candidate follow-ons. Fresh requirements to be defined via `/gsd-new-milestone`.

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

### Validated (v8.0 Graph/KG Consolidation)

- ✓ GH-01 — Graph-snapshot receiver: `graphSnapshots` table + `runtimeIngest` dispatch (idempotent on `snapshotId`) + read query API; stops dropping Ástríðr's nightly snapshots — Phase 83 (2026-06-18)
- ✓ GH-02 — `/graphs` landing renders the pushed code (graphify) + vault (Obsidian) graph from Convex, reusing `ForceGraphCanvas`, with truncation indicated — Phase 84 (2026-06-22)
- ✓ GH-03 — Unified Graphs hub: KG Explorer, Tool Galaxy, MCP Inventory, code/vault graph reachable from one hub — Phase 84 (2026-06-22)
- ✓ GH-04 — Cross-graph navigation: deep-link tool → owning agent → KG entity — Phase 85 (2026-06-22)
- ✓ KG-08 — Full-text fact/relationship Search lens (backed by Ástríðr `/api/kg/search`) — Phase 86 (2026-06-23); live results data-gated on the Ástríðr endpoint (SEED-008), graceful-degrade gate shipped
- ✓ KG-09 — Clustering / community-detection layout for large graphs — Phase 86 (2026-06-23); live halos data-gated on Ástríðr `community` emission (D-10), no-regression when absent
- ✓ KG-10 — Named, saved, and shareable graph views (beyond last-state idb persistence) — Phase 87 (2026-06-23)
- ✓ KG-11 — Temporal diff / animation between two as-of points — Phase 87 (2026-06-23)

Full definitions + traceability: archived in `.planning/milestones/v8.0-REQUIREMENTS.md` (fresh `REQUIREMENTS.md` is created by the next `/gsd-new-milestone`). Closed v6.0 requirements (DS/GAL/MCP/KG/CON/HUB/OPS) retained in the archive as well.

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
| Cross-graph nav = normalized-EXACT match, no fuzzy (v8.0, Phase 85) | A wrong jump is worse than a missing one — `focusKeysMatch` is strict equality on normalized keys; a non-match shows no link (SC#3). `decodeFromParam` constrains the return target to same-origin in-app paths. | Zero-false-positive forward links; `from`-param return chips |
| Summarize `graph_snapshot` in legacy `runtime_events` (v8.0, Phase 85) | The full {nodes,links} blob (>1 MiB) blew Convex's per-doc limit on the legacy insert, rejecting the whole ingest and silently capping the production cron; the row-based `graphSnapshots` receiver already holds the full graph. | Legacy row stores counts+sources only; full snapshots ingest (~4k nodes live) |

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
*Last updated: 2026-06-23 — v8.0 Graph/KG Consolidation SHIPPED (phases 83-87, 8/8 requirements, milestone audit PASSED, archived + tagged). KG-08/KG-09 live output data-gated on cross-repo Ástríðr deltas. Next: v9.0 Readability & Experience (Phase 89 in progress) — define fresh requirements via `/gsd-new-milestone`; Phase 88 (Analytics Rollup) remains a standalone scaffolded option.*
