# Requirements: CodePulse

**Defined:** 2026-04-06
**Core Value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard.

## v5.0 Requirements

### Advanced Visualization

- [ ] **VIZ-01**: Call graph displays directed agent/tool dependency graph with node state coloring (healthy/errored/pending), error propagation path highlighting, and dagre top-down auto-layout
- [ ] **VIZ-02**: Context window displays animated progress bar with 70%/90% color thresholds, area chart of token growth over session time, and compaction event markers
- [ ] **VIZ-03**: Token sunburst shows two-level ring (agent inner, tool outer) sized by token count with hover tooltip, click-to-zoom subtree, and total tokens + cost estimate at center

### Extended Integrations

- [ ] **EXT-01**: Email digest delivers scheduled daily/weekly HTML summary (alerts, cost, tokens, anomalies, briefing narrative) to configurable recipient via Resend
- [ ] **EXT-02**: PagerDuty integration triggers/resolves incidents via Events API v2 with stable dedup_key, per-rule toggle, severity mapping, and routing key configuration
- [ ] **EXT-03**: GitHub Actions trigger fires workflow_dispatch on alert match with configurable repo/workflow/ref/PAT, per-rule toggle, rate limiting, and dispatch result logging

### Schema Foundation

- [ ] **SCH-01**: New `callGraphEdges` table with materialized integration dependency edges upserted on ingest events
- [ ] **SCH-02**: `llmMetrics` table extended with optional `agentId` and `toolName` fields and `by_agent` index for sunburst hierarchy
- [ ] **SCH-03**: `alertRuleCustom` table extended with `pagerdutyEnabled` and `githubTrigger` fields for integration delivery config
- [ ] **SCH-04**: New delivery log tables (`emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog`) for audit trails

## v4.0 Requirements (Validated)

### UI Redesign

- [x] **UI-01**: Dashboard adopts shadcn/ui New York style with monochromatic oklch palette and `--radius: 0` globally
- [x] **UI-02**: All metric displays use MetricCard pattern (large tabular-nums value, tiny label, no card borders)
- [x] **UI-03**: Section headers use uppercase tracking-wide muted-foreground pattern with separators
- [x] **UI-04**: Navigation uses compact 240px sidebar with labeled sections and live count badges
- [x] **UI-05**: Charts replaced with custom CSS flex bar charts (no Recharts dependency for primary displays)
- [x] **UI-06**: EntityRow universal list pattern used across all data lists (consistent hover, dividers, leading icon)
- [x] **UI-07**: Activity feeds show slide-in animations with highlight accent for new entries
- [x] **UI-08**: Icons standardized to Lucide React with consistent 4x4 sizing

### Real-Time Telemetry

- [x] **RT-01**: WebSocket endpoint with topic-based subscriptions
- [x] **RT-02**: JWT/service-role key authentication on WebSocket
- [x] **RT-03**: Dashboard widgets update within 1 second of event occurrence
- [x] **RT-04**: Reconnect resumes telemetry without restarting Ástríðr
- [x] **RT-05**: Critical events bypass batching and arrive within 500ms

### Data Pipeline

- [x] **DP-01**: Convex cron jobs compute hourly and daily aggregates
- [x] **DP-02**: Analytics page queries pre-computed aggregates
- [x] **DP-03**: Data retention policy auto-archives events older than configurable threshold
- [x] **DP-04**: Dashboard list queries use server-side pagination with cursor

### Alert Routing

- [x] **ALR-01**: Configurable alert rules with threshold triggers
- [x] **ALR-02**: Discord webhook delivery within 60 seconds
- [x] **ALR-03**: Slack webhook delivery within 60 seconds
- [x] **ALR-04**: Mute, acknowledge, and escalate from dashboard
- [x] **ALR-05**: Per-severity notification preferences

### Intelligence Layer

- [x] **INT-01**: Cost forecasting with trend-based predictions and budget threshold alerts
- [x] **INT-02**: LLM-generated session briefings
- [x] **INT-03**: Daily digest auto-generated and stored in Convex
- [x] **INT-04**: Anomaly detection flags unusual patterns with visual indicators

## Future Requirements (Deferred)

- **VIZ-01d**: Error propagation path animation (live red traversal)
- **VIZ-02d**: Projected fill time at current growth rate
- **VIZ-03d**: PNG/CSV export for token sunburst
- **EXT-01d**: React Email templates for richer digest formatting
- **EXT-02d**: Bidirectional PagerDuty sync (inbound webhook)
- **EXT-03d**: Multiple event_type mappings (severity → different workflow)
- **EXT-03d2**: GitHub App auth (replace PAT)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native app | Responsive web layout sufficient |
| Multi-tenant/team access | Single operator dashboard |
| OpenTelemetry collector backend | Convex handles persistence |
| React Three Fiber / 3D visualizations | Custom SVG + recharts sufficient for operational viz |
| Force-directed graph layout | Non-deterministic, confusing to operators — use dagre |
| Bidirectional PagerDuty sync | Inbound webhook complexity disproportionate for single operator |
| Graph history playback | v6.0 candidate |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCH-01 | TBD | Pending |
| SCH-02 | TBD | Pending |
| SCH-03 | TBD | Pending |
| SCH-04 | TBD | Pending |
| VIZ-01 | TBD | Pending |
| VIZ-02 | TBD | Pending |
| VIZ-03 | TBD | Pending |
| EXT-01 | TBD | Pending |
| EXT-02 | TBD | Pending |
| EXT-03 | TBD | Pending |
