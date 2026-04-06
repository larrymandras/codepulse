# Roadmap: CodePulse Operational Excellence

## Overview

Five phases transform CodePulse from a functional monitoring dashboard into a polished operational command center. The design system comes first to establish the visual language all subsequent UI work inherits. Real-time telemetry and data pipeline follow in parallel (both depend on the design system, not each other). Alert routing builds on the live data stream and the alert management UI. The intelligence layer closes the milestone, consuming aggregated pipeline data to surface forecasts, briefings, and anomaly signals.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: UI Redesign** - Establish Paperclip-inspired design system across all dashboard surfaces
- [ ] **Phase 2: Real-Time Telemetry** - WebSocket pipeline from Astridr to CodePulse with sub-second delivery
- [ ] **Phase 3: Data Pipeline** - Aggregation tables, retention policies, and paginated queries
- [ ] **Phase 4: Alert Routing** - Configurable alert rules with Discord/Slack delivery and dashboard management
- [ ] **Phase 5: Intelligence Layer** - Cost forecasting, LLM session briefings, and anomaly detection

## Phase Details

### Phase 1: UI Redesign
**Goal**: The dashboard adopts the Paperclip design language — operators see a consistent, information-dense interface with a unified design system powering every page
**Depends on**: Nothing (first phase)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08
**Success Criteria** (what must be TRUE):
  1. Every page uses the monochromatic oklch palette with `--radius: 0` — no rounded corners anywhere in the UI
  2. Metric values display in large tabular-nums format with tiny muted labels and no card borders
  3. The sidebar is 240px wide with uppercase section headers, labeled nav items, and live count badges
  4. All primary charts render as custom CSS flex bars — Recharts is absent from primary data displays
  5. Data lists use the EntityRow pattern with consistent hover states, dividers, and leading icons; activity feeds animate new entries with slide-in highlights
**Plans**: 3 plans
Plans:
- [ ] 01-01-PLAN.md — Design token layer (oklch palette, shadcn/ui init, MetricCard redesign)
- [ ] 01-02-PLAN.md — Shared components and Recharts migration (FlexBarChart, EntityRow, SectionHeader, StatusBadge)
- [ ] 01-03-PLAN.md — Sidebar navigation rebuild (grouped sections, Lucide icons, live badges, collapse)
**UI hint**: yes

### Phase 2: Real-Time Telemetry
**Goal**: Dashboard widgets update within 1 second of Astridr events — live operational state, not polled snapshots
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-04, RT-05

**Cross-repo note:** RT-01 and RT-02 require implementation in the Astridr repo (`C:\Users\mandr\astridr-repo`). RT-03, RT-04, RT-05 are CodePulse consumer work.

**Success Criteria** (what must be TRUE):
  1. Astridr exposes `/ws/telemetry` with topic-based subscriptions (health, security, executions, agents) — unauthenticated connections are rejected
  2. Dashboard widgets visibly update within 1 second when a new event occurs in Astridr
  3. Closing and reopening the CodePulse browser tab resumes the live feed without any action in Astridr
  4. Security blocks, execution failures, and stall detections appear on the dashboard within 500ms of occurrence
**Plans**: TBD

### Phase 3: Data Pipeline
**Goal**: Analytics queries run fast against pre-computed aggregates, old data auto-archives, and list views never load the full raw event table
**Depends on**: Phase 1
**Requirements**: DP-01, DP-02, DP-03, DP-04
**Success Criteria** (what must be TRUE):
  1. The Analytics page loads historical views by querying hourly/daily aggregate tables — not raw event tables
  2. Convex cron jobs run on schedule and produce visible aggregate rows for cost, event counts, and error rates
  3. Events older than the configured threshold (default 30 days) are automatically archived without manual intervention
  4. Dashboard list views page through large result sets using server-side cursor pagination — no client-side filtering of full tables
**Plans**: TBD

### Phase 4: Alert Routing
**Goal**: Operators receive notifications within 60 seconds of threshold breaches and can manage alerts without leaving the dashboard
**Depends on**: Phase 2, Phase 1
**Requirements**: ALR-01, ALR-02, ALR-03, ALR-04, ALR-05
**Success Criteria** (what must be TRUE):
  1. Operator can create an alert rule with a threshold (cost spike, stall detected, security block, execution failure rate) and see it listed in the Alerts page
  2. A triggered alert delivers a notification to a configured Discord webhook within 60 seconds
  3. A triggered alert delivers a notification to a configured Slack webhook within 60 seconds
  4. Operator can mute, acknowledge, and escalate any alert from the dashboard without external tools
  5. Operator can set per-severity notification preferences — critical alerts always notify, warning-level alerts go to digest only
**Plans**: TBD
**UI hint**: yes

### Phase 5: Intelligence Layer
**Goal**: The dashboard surfaces cost forecasts, LLM-generated session narratives, and anomaly signals — operators understand not just what happened but what to expect
**Depends on**: Phase 3, Phase 1
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. The dashboard displays trend-based daily, weekly, and monthly spend predictions with a visual budget threshold indicator
  2. Any completed session has an LLM-generated briefing summarizing what happened, key decisions made, and anomalies detected
  3. A daily digest is auto-generated and stored in Convex — operator can browse past digests from the Briefings page
  4. Unusual patterns (cost spikes, error clusters, latency degradation) appear as visual anomaly indicators directly on the relevant dashboard widgets
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phase 1 → Phase 2 → Phase 3 (parallel with 2 after Phase 1) → Phase 4 → Phase 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. UI Redesign | 0/3 | Planned | - |
| 2. Real-Time Telemetry | 0/TBD | Not started | - |
| 3. Data Pipeline | 0/TBD | Not started | - |
| 4. Alert Routing | 0/TBD | Not started | - |
| 5. Intelligence Layer | 0/TBD | Not started | - |
