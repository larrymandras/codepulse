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
| WebSocket for real-time over polling | Sub-second latency for critical events, reduces unnecessary HTTP traffic | — Pending |
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
*Last updated: 2026-04-13 after Phase 58 (infrastructure-layer) completion*
