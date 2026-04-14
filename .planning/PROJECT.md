# CodePulse

## What This Is

Real-time operational command center for Ástríðr AI assistant. React 19 + Vite + Convex SPA with 15 dashboard pages, 40+ Convex tables, and 90+ UI components. Features bidirectional WebSocket telemetry, agent chat with generative UI blocks, unified inbox, task Kanban, intelligent alerting with Discord/Slack delivery, cost forecasting, anomaly detection, and LLM-powered session briefings.

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard. And now: take action on it.

## Current State

**Shipped:** v4.0 CodePulse Operational Excellence (2026-04-14)
**Stack:** React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Convex, shadcn/ui New York, Lucide icons

8 phases complete across the v4.0 milestone:
1. UI Foundation — Paperclip design language across all pages
2. Bidirectional Telemetry — WebSocket consumer + command sender
3. Interaction Layer — Inbox, Command Palette, Agent Chat, Live Run, Insights Chat
4. Task Management — Kanban, Ideation Findings, Config Editor, Cron management
5. Data Pipeline — Aggregation, retention, pagination, optimized analytics
6. Alert Routing — Rules, webhooks, lifecycle management, notification preferences
7. Intelligence Layer — Cost forecasting, briefings, anomaly detection, memory quality
8. Infrastructure Layer (Phase 58) — Command catalog on Capabilities page

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

### Active

(None — next milestone requirements TBD via `/gsd-new-milestone`)

### Out of Scope

- Mobile app — web-first, responsive layouts sufficient
- Multi-tenant — single operator dashboard
- OpenTelemetry collector — Convex handles persistence
- Historical data migration — new aggregation tables start fresh
- React Three Fiber / 3D visualizations — not operationally useful

## Context

- **Ástríðr repo:** C:\Users\mandr\astridr-repo (WebSocket endpoint lives here)
- **CodePulse repo:** C:\Users\mandr\codepulse
- **Design reference:** Paperclip AI — shadcn/ui New York, monochromatic oklch palette, --radius: 0, Lucide icons
- **Stack:** React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Convex, shadcn/ui, Lucide, React Flow
- **Tests:** 268+ passing (Vitest), 1 pre-existing failure in Inbox keyboard nav

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
*Last updated: 2026-04-14 after v4.0 milestone completion*
