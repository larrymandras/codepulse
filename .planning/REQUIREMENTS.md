# Requirements: CodePulse Operational Excellence

**Defined:** 2026-04-06
**Core Value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard.

## v1.0 Requirements

### UI Redesign

- [ ] **UI-01**: Dashboard adopts shadcn/ui New York style with monochromatic oklch palette and `--radius: 0` globally
- [ ] **UI-02**: All metric displays use MetricCard pattern (large tabular-nums value, tiny label, no card borders)
- [ ] **UI-03**: Section headers use uppercase tracking-wide muted-foreground pattern with separators
- [ ] **UI-04**: Navigation uses compact 240px sidebar with labeled sections and live count badges
- [ ] **UI-05**: Charts replaced with custom CSS flex bar charts (no Recharts dependency for primary displays)
- [ ] **UI-06**: EntityRow universal list pattern used across all data lists (consistent hover, dividers, leading icon)
- [ ] **UI-07**: Activity feeds show slide-in animations with highlight accent for new entries
- [ ] **UI-08**: Icons standardized to Lucide React with consistent 4x4 sizing

### Real-Time Telemetry

- [ ] **RT-01**: Ástríðr exposes WebSocket endpoint (`/ws/telemetry`) with topic-based subscriptions (health, security, executions, agents)
- [ ] **RT-02**: WebSocket connection requires JWT or service-role key authentication — no unauthenticated access
- [ ] **RT-03**: CodePulse subscribes to WebSocket topics and updates dashboard widgets within 1 second of event occurrence
- [ ] **RT-04**: Disconnecting and reconnecting CodePulse resumes telemetry without restarting Ástríðr
- [ ] **RT-05**: Critical events (security blocks, execution failures, stall detection) bypass normal batching and arrive within 500ms

### Data Pipeline

- [ ] **DP-01**: Convex cron jobs compute hourly and daily aggregates for LLM cost, event counts, and error rates
- [ ] **DP-02**: Historical dashboard views (Analytics page) query pre-computed aggregates instead of raw event tables
- [ ] **DP-03**: Data retention policy auto-archives events older than configurable threshold (default 30 days)
- [ ] **DP-04**: Dashboard list queries use server-side pagination with index-based cursors (no client-side filtering of large result sets)

### Alert Routing

- [ ] **ALR-01**: Operator can configure alert rules with threshold triggers (cost spike, stall detected, security block, execution failure rate)
- [ ] **ALR-02**: Triggered alerts deliver notifications to configured Discord webhook within 60 seconds
- [ ] **ALR-03**: Triggered alerts deliver notifications to configured Slack webhook within 60 seconds
- [ ] **ALR-04**: Operator can mute, acknowledge, and escalate alerts from the dashboard
- [ ] **ALR-05**: Alert notification preferences are configurable per severity level (critical → always notify, warning → digest only)

### Intelligence Layer

- [ ] **INT-01**: Cost forecasting displays trend-based daily/weekly/monthly spend predictions with budget threshold alerts
- [ ] **INT-02**: Session briefings are LLM-generated narrative summaries of what happened, key decisions, and anomalies
- [ ] **INT-03**: Daily digest auto-generates and stores in Convex — operator can view past digests from Briefings page
- [ ] **INT-04**: Anomaly detection flags unusual patterns (cost spikes, error clusters, latency degradation) with visual indicators on relevant dashboard widgets

## v2.0 Requirements (Deferred)

### Advanced Visualization
- **VIZ-01**: Call graph visualization showing integration dependencies and error propagation
- **VIZ-02**: Real-time context window growth/shrink visualization during active sessions
- **VIZ-03**: Token sunburst showing per-agent/per-tool token consumption breakdown

### Extended Integrations
- **EXT-01**: Email digest delivery for daily/weekly summaries
- **EXT-02**: PagerDuty integration for critical alert escalation
- **EXT-03**: GitHub Actions trigger from alert rules (auto-remediation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Responsive web layout sufficient for v1.0 |
| Multi-tenant/team access | Single operator dashboard — Larry only |
| OpenTelemetry collector backend | Convex handles persistence, OTEL adds infra complexity without proportional value |
| Migrating historical raw events to aggregated format | New aggregation tables start fresh, old data stays in raw tables |
| React Three Fiber / 3D visualizations | Cool but not operationally useful — remove complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |
| UI-04 | Phase 1 | Pending |
| UI-05 | Phase 1 | Pending |
| UI-06 | Phase 1 | Pending |
| UI-07 | Phase 1 | Pending |
| UI-08 | Phase 1 | Pending |
| RT-01 | Phase 2 | Pending |
| RT-02 | Phase 2 | Pending |
| RT-03 | Phase 2 | Pending |
| RT-04 | Phase 2 | Pending |
| RT-05 | Phase 2 | Pending |
| DP-01 | Phase 3 | Pending |
| DP-02 | Phase 3 | Pending |
| DP-03 | Phase 3 | Pending |
| DP-04 | Phase 3 | Pending |
| ALR-01 | Phase 4 | Pending |
| ALR-02 | Phase 4 | Pending |
| ALR-03 | Phase 4 | Pending |
| ALR-04 | Phase 4 | Pending |
| ALR-05 | Phase 4 | Pending |
| INT-01 | Phase 5 | Pending |
| INT-02 | Phase 5 | Pending |
| INT-03 | Phase 5 | Pending |
| INT-04 | Phase 5 | Pending |

**Coverage:**
- v1.0 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation — all requirements mapped*
