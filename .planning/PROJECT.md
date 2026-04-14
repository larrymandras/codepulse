# CodePulse

## What This Is

Real-time telemetry and observability dashboard for monitoring Ástríðr AI assistant runtime and Claude Code agent activity. React 19 + Vite + Convex SPA with 15 dashboard pages, 40+ Convex tables, and 90+ UI components. Ingests build-time events from Claude Code hooks and runtime events from Ástríðr's ConvexHandler (45+ event types).

## Core Value

Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard.

## Current Milestone: v1.0 CodePulse Operational Excellence

**Goal:** Transform CodePulse from a functional monitoring dashboard into a polished, Paperclip-inspired operational command center with real-time telemetry, intelligent alerting, and LLM-powered insights.

**Target features:**
- UI Redesign — Paperclip design language (shadcn/ui New York, monochromatic, zero border-radius, information-dense)
- Real-Time Telemetry — WebSocket endpoint in Ástríðr for live event push
- Data Pipeline — Time-series aggregation, retention policies, query optimization
- Alert Routing — External notifications (Discord/Slack webhooks), configurable thresholds
- Intelligence Layer — Cost forecasting, LLM-powered session briefings, anomaly detection

## Requirements

### Validated

- Convex backend with 40+ tables and real-time subscriptions
- HTTP ingest endpoints (/ingest, /runtime-ingest, /scan)
- 15 dashboard pages (Dashboard, Agents, Analytics, Capabilities, Memory, Security, Alerts, Infrastructure, Automation, Executions, Build Progress, Self-Healing, Briefings, Settings, Profiles)
- SectionErrorBoundary error isolation per widget group
- Privacy context with PII masking
- Optional Clerk auth (gracefully skipped if not configured)
- 45+ runtime event types routed from Ástríðr via ConvexHandler
- Generative UI Block system — discriminated union type, BlockRenderer dispatcher, 6 block sub-components (Validated in Phase 3)
- Command Palette (Cmd+K) with entity search and quick actions (Validated in Phase 3)
- Agent Chat with generative block rendering and approval gates (Validated in Phase 3)
- Unified Inbox with keyboard navigation (j/k/Enter/A/R/Escape) (Validated in Phase 3)
- RunTimeline nested accordion with Flow DAG visualization (Validated in Phase 3)
- Insights Chat with LLM-powered Convex backend action (Validated in Phase 3)
- 6-column Kanban board with collapsible columns, rich task cards, drag-and-drop with action column confirmation (Validated in Phase 4)
- Ideation Findings panel with status workflow (open/acknowledged/converted/dismissed), batch task conversion, bidirectional linking (Validated in Phase 4)
- Config Editor with inline diff preview, hot-reload status bar, revert-to-saved (Validated in Phase 4)
- Cron management with visual builder, frequency presets, live human-readable previews, interactive job controls (Validated in Phase 4)
- Time-series aggregation with hourly compute + daily rollup cron jobs (Validated in Phase 5)
- Data retention with configurable archival (1-365 days), 500-row batch processing, archived-row filters on all high-volume queries (Validated in Phase 5)
- Cursor-based pagination across all 7 list-view domains with shared LoadMoreButton component (Validated in Phase 5)
- Analytics page consuming pre-computed aggregates instead of raw table scans (Validated in Phase 5)
- Alert routing with configurable rules (static + custom compound AND/OR), threshold overrides, lookback windows (Validated in Phase 6)
- Webhook delivery engine with Discord embeds and Slack Block Kit, 3-attempt retry with backoff, mute-aware gating (Validated in Phase 6)
- Alert lifecycle management: acknowledge, resolve, mute (timed expiry), escalate-to-task with bidirectional linkage (Validated in Phase 6)
- Per-severity notification preferences (always/digest/dashboard-only/disabled) with Settings page UI (Validated in Phase 6)
- Alerts surface in Unified Inbox with inline acknowledge/mute actions (Validated in Phase 6)

### Active

See REQUIREMENTS.md for v1.0 scoped requirements.

### Out of Scope

- Mobile app — web-first, responsive layouts sufficient
- Multi-tenant — single operator dashboard
- OpenTelemetry collector — Convex handles persistence, no need for separate OTEL backend
- Historical data migration — new aggregation tables start fresh

## Context

- **Ástríðr repo:** C:\Users\mandr\astridr-repo (WebSocket endpoint lives here)
- **CodePulse repo:** C:\Users\mandr\codepulse
- **Design reference:** Paperclip AI (github.com/paperclipai/paperclip) — shadcn/ui New York, monochromatic oklch palette, --radius: 0, Lucide icons, custom CSS flex charts
- **Research:** C:\Users\mandr\Mandras\04-research\paperclip-ui-patterns-2026-04-06.md
- **Current stack:** React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Convex, Recharts, React Flow, React Three Fiber
- **Target stack changes:** Replace Recharts with custom CSS flex charts, adopt shadcn/ui New York style, add Lucide icons

## Constraints

- **Cross-repo:** WebSocket endpoint must be implemented in Ástríðr repo, consumed by CodePulse
- **Convex:** All persistence through Convex — no direct database access
- **Backward compatible:** Existing /ingest and /runtime-ingest endpoints must continue working

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paperclip as design reference | Information-dense, monochromatic, professional operational feel | — Pending |
| shadcn/ui New York over current custom components | Consistent design system, Radix primitives, community maintained | — Pending |
| Custom CSS flex charts over Recharts | Compact, lightweight, matches Paperclip aesthetic | — Pending |
| WebSocket for real-time over polling | Sub-second latency for critical events, reduces unnecessary HTTP traffic | Validated in Phase 2 |
| WebSocket command catalog on Capabilities page | Live command registry via `commands.catalog` event, replacing static Convex count | Validated in Phase 58 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after Phase 6 (alert-routing) completion*
