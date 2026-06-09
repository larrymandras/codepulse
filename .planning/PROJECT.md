# CodePulse

## What This Is

Multi-provider operational command center for Ástríðr AI assistant. React 19 + Vite + Convex SPA with 15 dashboard pages, 50+ Convex tables, and 110+ UI components. Features bidirectional WebSocket telemetry, multi-provider cost intelligence (7 providers), gateway observability with quota/routing/spend controls, agent chat with generative UI blocks, unified inbox, task Kanban, intelligent alerting with Discord/Slack/PagerDuty/Email/GitHub Actions delivery, cost forecasting, anomaly detection, LLM-powered session briefings, and call graph visualization.

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard. And now: take action on it.

## Current State

**Shipped:** v5.0 Advanced Visualization & Integrations (2026-05-25)
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

## Current Milestone: v6.0 Agentic OS Front-End

> **Reframed 2026-06-09** from the never-executed "Knowledge Graph Observability & Hardening" roadmap. CodePulse is the rendering/control half of the two-milestone Agentic OS plan (Ástríðr "Surface Substrate" emits/exposes the data; CodePulse renders it beautifully and drives the coding agents). Companion plan: `C:\Users\mandr\html-out\agentic-os-milestones.md`. All prior v6.0 work was absorbed, not dropped (KG Waves → Phase 74; UI polish → Phase 71; CI hardening → Phase 77).

**Goal:** Show all of Ástríðr's graphs (tools, knowledge, code, vault) beautifully under one cohesive design system, and drive Claude Code + Codex from the dashboard.

**Phases (71-77):**
- **Phase 71 — Unified Design System** *(ready)* — cohesive "Agentic OS" visual language (tokens, primitives, full icon standardization) + IA refactor (Graphs + Agents/Console clusters). The foundation all later UI renders against.
- **Phase 72 — Tool / Capability Galaxy** *(M1.P1 emitter ✅ built)* — force/R3F graph over tools + MCP servers + kits + callGraphEdges with usage glow + orphan detection.
- **Phase 73 — MCP Inventory + Health** *(M1.P1 ✅)* — tool-governance surface (status pills + prune chips).
- **Phase 74 — Temporal-KG Explorer** *(⛔ Ástríðr Phase 125 + 126)* — the showpiece: entities, ego graphs, as-of scrubber, contradiction lens, provenance deep-links. Design authority: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`.
- **Phase 75 — Agent Console** *(⛔ Ástríðr M1.P0 + M1.P3)* — drive Claude Code + Codex; live = local-direct WS, history = Convex (Convex is cloud, can't reach localhost).
- **Phase 76 — Unified Graph Hub** *(dep: Phase 74 + Ástríðr M1.P4)* — graphify + Obsidian + KG + tools in one place.
- **Phase 77 — CI & Production Hardening** *(ready)* — Gitleaks + Supabase-drift CI green; `CODEPULSE_ALLOWED_ORIGIN` documented (carried from old v6.0 P71).

**Sequencing:** Phase 71 (design system) lands first — it gates every later UI phase. Phases 72/73 follow immediately (M1.P1 emitter already built). Phase 77 (hardening) is runnable any time. Phases 74/75/76 are gated on the Ástríðr Surface Substrate milestone.

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

### Active

(Pending v6.0 requirements definition via `/gsd-new-milestone`)

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
*Last updated: 2026-06-09 — reframed v6.0 → "Agentic OS Front-End" (7 phases, 71-77); starting Phase 71 Unified Design System*
