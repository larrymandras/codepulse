# Milestones

## v5.0 Advanced Visualization & Integrations (Shipped: 2026-05-25)

**Phases completed:** 12 phases (6 with GSD plans, 6 built outside GSD), 23 plans, 31 tasks
**Files modified:** 668 | **Lines:** +76,219 / -3,401
**Timeline:** 10 days (2026-05-16 → 2026-05-25) | 267 commits

**Key accomplishments:**

1. **Schema foundation** — 4 new Convex tables (callGraphEdges, emailDeliveryLog, pagerdutyDeliveryLog, githubTriggerLog) and 2 table extensions (llmMetrics agentId/toolName, alertRuleCustom pagerdutyConfig/githubTrigger) unblocking all v5.0 features
2. **Multi-provider gateway** — Central provider registry (7 providers: 3 legacy + 4 gateway), OTel provider attribution fix, gateway event routing to dedicated tables, CLIGatewayTool telemetry emission
3. **Cost intelligence** — Provider billing registry with GPT/Gemini pricing, billingType-aware cost aggregation, SDK spend cap gauge with projected daily totals, subscription vs API-billed split views
4. **Gateway observability** — Real-time quota burndown gauges, routing decision audit table with score breakdown, provider comparison charts, per-provider cost trend stacking, gateway task lifecycle tracking
5. **SDK spend guard & multi-provider UX** — Provider enable/disable and priority controls with drag-to-reorder, session timeline provider badges, provider attribution across all surfaces
6. **External integrations & call graph** — Email digest delivery via Resend with daily cron, PagerDuty trigger/resolve via Events API v2 with stable dedup_key, agent/tool call graph visualization with dagre layout

---

## v4.0 CodePulse Operational Excellence (Shipped: 2026-04-14)

**Phases completed:** 8 phases, 36 plans
**Files modified:** 311 | **Lines:** +43,759 / -5,570
**Timeline:** 39 days (2026-03-06 → 2026-04-14)

**Key accomplishments:**

1. **Paperclip design language** — shadcn/ui New York, monochromatic oklch palette, zero border-radius, MetricCard/EntityRow patterns across 15 dashboard pages
2. **Bidirectional WebSocket telemetry** — real-time event push from Ástríðr, command sending, connection state management with auto-reconnect
3. **Command center UI** — Unified Inbox with keyboard navigation, Command Palette (Cmd+K), Agent Chat with Generative UI Blocks, Live Run Widget with Flow DAG, Insights Chat
4. **Task management** — 6-column Kanban with drag-and-drop, Ideation Findings with status workflow, Config Editor with inline diff/hot-reload, Cron management with visual builder
5. **Data pipeline** — Hourly/daily time-series aggregation, configurable retention with batch archival, cursor-based pagination across 7 list-view domains, Analytics page on pre-computed aggregates
6. **Alert routing** — Configurable rules (static + compound AND/OR), Discord/Slack webhook delivery with retry, acknowledge/mute/escalate lifecycle, per-severity notification preferences
7. **Intelligence layer** — Cost forecasting with moving averages, LLM-generated session briefings with daily digest cron, anomaly detection with z-score auto-alerts, memory quality metrics with dedup/staleness/contradiction detection
8. **Command catalog** — Live WebSocket-driven command registry on Capabilities page with accordion expand/collapse, category filter pills, dynamic search

**Known gaps:**

- REQUIREMENTS.md traceability table was stale (checkboxes not updated during phase execution) — all phases verified complete via VERIFICATION.md reports
- INFRA-01 through INFRA-05 referenced in ROADMAP but undefined in REQUIREMENTS.md (Ástríðr-side requirements, out of CodePulse scope)
- UI-08 (Lucide icon standardization) not fully checked off — partial coverage across phases

---
