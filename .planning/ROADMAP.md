# Roadmap: CodePulse Command Center

## Overview

Seven phases transform CodePulse from a monitoring dashboard into an all-in-one command center for Astridr. Phase 1 (UI Foundation) establishes the design system. Phase 2 (Bidirectional Telemetry) builds the real-time communication layer. Phase 3 (Interaction Layer) is the vision shift — adding chat, inbox, live runs, approvals, and command palette. Phase 4 (Task Management) adds Kanban, ideation, agent config, and cron UX. Phases 5-7 handle data pipeline, alert routing, and intelligence.

Phase 58 (Infrastructure Layer) is a cross-project phase from Astridr that adds a command catalog frontend surface to the Capabilities page.

**Research sources:**
- Paperclip AI (agent orchestration platform) — chat interaction, live runs, inbox, Kanban, approvals
- Aperant (autonomous coding IDE) — insights chat, ideation findings, changelog
- Rubric Labs (generative UI framework) — block rendering, chains visualization, live state, memory evals

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)
- High-numbered phases (58+): Cross-project phases from Astridr infrastructure

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: UI Foundation** - Establish design system across all dashboard surfaces (shadcn/ui, oklch, FlexBarChart, EntityRow, sidebar)
- [ ] **Phase 2: Bidirectional Telemetry** - WebSocket consumer + command sender + live state layer
- [ ] **Phase 3: Interaction Layer** - Unified Inbox, Command Palette, Agent Chat with Generative UI Blocks, Live Run Widget, Approval Gates, Insights Chat
- [ ] **Phase 4: Task Management** - Kanban board, Ideation Findings panel, Agent Config editor, enhanced Cron management
- [ ] **Phase 5: Data Pipeline** - Aggregation tables, retention policies, paginated queries
- [ ] **Phase 6: Alert Routing** - Configurable alert rules with Discord/Slack delivery and dashboard management
- [ ] **Phase 7: Intelligence Layer** - Cost forecasting, briefings, anomaly detection, memory quality metrics, changelog
- [x] **Phase 58: Infrastructure Layer** - Command catalog frontend surface on Capabilities page (WebSocket-driven), collapsible sections, dynamic search (completed 2026-04-14)

## Phase Details

### Phase 1: UI Foundation
**Goal**: The dashboard adopts the Paperclip design language — operators see a consistent, information-dense interface with a unified design system powering every page
**Depends on**: Nothing (first phase)
**Ástríðr dependency**: None
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08
**Success Criteria** (what must be TRUE):
  1. Every page uses the monochromatic oklch palette with `--radius: 0` — no rounded corners anywhere in the UI
  2. Metric values display in large tabular-nums format with tiny muted labels and no card borders
  3. The sidebar is 240px wide with uppercase section headers, labeled nav items, and live count badges
  4. All primary charts render as custom CSS flex bars — Recharts is absent from primary data displays
  5. Data lists use the EntityRow pattern with consistent hover states, dividers, and leading icons; activity feeds animate new entries with slide-in highlights
**Plans**: 4 plans
Plans:
- [x] 01-00-PLAN.md — Wave 0 test stubs (all 7 test files for Nyquist-compliant verification)
- [x] 01-01-PLAN.md — Design token layer (oklch palette, shadcn/ui init, MetricCard redesign)
- [x] 01-02-PLAN.md — Shared components and Recharts migration (FlexBarChart, EntityRow, SectionHeader, StatusBadge, R3F removal)
- [x] 01-03-PLAN.md — Sidebar navigation rebuild (grouped sections, Lucide icons, live badges, collapse)
**UI hint**: yes

### Phase 2: Bidirectional Telemetry
**Goal**: Dashboard updates within 1 second of Astridr events; CodePulse can send commands back to Astridr via the same WebSocket
**Depends on**: Phase 1
**Ástríðr dependency**: v4.0 Phase 47 (Bidirectional WebSocket + Live Run Emitter)
**Requirements**: RT-01, RT-02, RT-03, RT-04, RT-05, RT-06, RT-07, RT-08
**Success Criteria** (what must be TRUE):
  1. Dashboard widgets visibly update within 1 second when a new event occurs in Astridr
  2. Connection status indicator in sidebar shows green (connected) or red (disconnected)
  3. Auto-reconnect resumes live feed without any action in Astridr
  4. Commands sent from CodePulse receive ack within 500ms
  5. Live run transcript events stream in real-time (no batching delay)
  6. Agent status (idle/running/paused) updates via useLiveState without polling

**Deliverables:**
- WebSocket client singleton with topic subscriptions and auto-reconnect
- Command sender with optimistic UI and request/response correlation
- useLiveState hook for transient real-time data (agent status, active runs)
- Connection status indicator in sidebar footer
- Auth validation logging on both sides (CodePulse + Astrid backend)
**Plans**: 4 plans
Plans:
- [x] 02-01-PLAN.md — Wave 0 test stubs (useLiveState, useLiveFlash, ConnectionPopover), CSS live-update-pulse animation, shadcn Popover install
- [x] 02-02-PLAN.md — useLiveState hook, WSStatusIndicator token upgrade, ConnectionPopover with ping-based latency, DashboardLayout integration
- [x] 02-03-PLAN.md — Wire all 11 event-driven pages to WebSocket with live-update-flash animation, SectionErrorBoundary wrapping
- [x] 02-04-PLAN.md — Astrid backend auth validation logging and ping handler (cross-repo: astridr-repo)

### Phase 3: Interaction Layer
**Goal**: CodePulse becomes a command center — operators can send tasks, approve actions, search everything, and chat with operational data from the dashboard
**Depends on**: Phase 2
**Ástríðr dependency**: v4.0 Phase 48 (Interaction APIs — task queue, HITL dashboard, agent status)
**Requirements**: IL-01, IL-02, IL-03, IL-04, IL-05, IL-06
**Success Criteria** (what must be TRUE):
  1. Cmd+K opens command palette with search across agents, sessions, alerts, cron jobs
  2. Unified Inbox shows alerts, failed runs, and approval requests with keyboard navigation
  3. Agent Chat panel sends tasks to Astridr and shows live run transcripts with Generative UI Blocks
  4. HITL approval requests appear as action cards with approve/reject buttons
  5. Live Run Widget shows streaming tool calls, reasoning, and text output with stop button
  6. Insights Chat answers operational questions by querying Convex data

**Deliverables:**
- Command Palette (cmdk) with global search + quick actions
- Unified Inbox page with tabs, keyboard nav, read/unread tracking
- Agent Chat Panel with Generative UI Block renderer (metric, table, chart, code, diff, approval blocks)
- Live Run Widget with Run > Rounds > Tool Calls hierarchy and Flow tab
- Approval Gates UI (inline cards with approve/reject)
- Insights Chat (LLM-powered Q&A over CodePulse data)
**Plans**: 6 plans
Plans:
- [x] 03-01-PLAN.md — Wave 0: dependency install (shadcn Command, dagre), GenerativeBlock types, test stubs
- [x] 03-02-PLAN.md — BlockRenderer dispatcher + all 6 block sub-components (metric, table, chart, code, approval)
- [x] 03-03-PLAN.md — Command Palette (Cmd+K) with entity search + quick actions, DashboardLayout wiring
- [x] 03-04-PLAN.md — ChatBubble block upgrade + Chat.tsx run.block subscription + Inbox keyboard navigation
- [x] 03-05-PLAN.md — RunTimeline nested accordion (rounds) + Flow tab (React Flow + dagre) + stop button
- [x] 03-06-PLAN.md — Insights Chat page + Convex insightsChat action + sidebar/route wiring
**UI hint**: yes

### Phase 4: Task Management
**Goal**: Operators can create, track, and manage work items for Astridr agents; view proactive scan findings; edit agent config; manage cron jobs — all from the dashboard
**Depends on**: Phase 3
**Ástríðr dependency**: v4.0 Phase 49 (Config hot-reload, proactive ideation)
**Requirements**: TM-01, TM-02, TM-03, TM-04
**Success Criteria** (what must be TRUE):
  1. Kanban board shows tasks across lifecycle columns with drag-and-drop
  2. Ideation findings display with severity, category, and one-click task conversion
  3. Agent config editable from dashboard with diff preview and hot-reload
  4. Cron jobs manageable with visual builder, manual trigger, and enable/disable toggle

**Deliverables:**
- Task Kanban Board (@dnd-kit) with columns: backlog -> queued -> running -> review -> done -> cancelled
- Ideation Findings page with status workflow and task conversion
- Agent Configuration Editor with diff preview and hot-reload
- Enhanced Cron Management with expression builder and manual trigger
**Plans**: 6 plans
Plans:
- [x] 04-01-PLAN.md — Wave 0: install deps, expand types/schema, create utilities, test stubs
- [x] 04-02-PLAN.md — Kanban components: 6-column board, collapsible columns, rich cards
- [x] 04-03-PLAN.md — Ideation upgrade: finding rows, status workflow, task conversion
- [x] 04-04-PLAN.md — Config Editor: inline diff view, hot-reload status bar, revert
- [x] 04-05-PLAN.md — Cron Management: visual builder, slide-out panel, inline controls
- [x] 04-06-PLAN.md — Tasks page: Convex data wiring, drag confirmation, finding pre-fill
**UI hint**: yes

### Phase 5: Data Pipeline
**Goal**: Analytics queries run fast against pre-computed aggregates, old data auto-archives, and list views never load the full raw event table
**Depends on**: Phase 1 (can run in parallel with Phases 3-4)
**Ástríðr dependency**: None
**Requirements**: DP-01, DP-02, DP-03, DP-04
**Success Criteria** (what must be TRUE):
  1. The Analytics page loads historical views by querying hourly/daily aggregate tables — not raw event tables
  2. Convex cron jobs run on schedule and produce visible aggregate rows for cost, event counts, and error rates
  3. Events older than the configured threshold (default 30 days) are automatically archived without manual intervention
  4. Dashboard list views page through large result sets using server-side cursor pagination — no client-side filtering of full tables
**Plans**: 5 plans
Plans:
- [x] 05-00-PLAN.md — Wave 0 test stubs (aggregates, archival, pagination)
- [x] 05-01-PLAN.md — Schema (aggregates table, archived fields), cron registrations, aggregation + archival mutations, retention config, fill test stubs
- [x] 05-02-PLAN.md — Archived-row filter audit on all existing queries (llm.ts, analytics.ts, events.ts) + Analytics page aggregate query swap
- [x] 05-03-PLAN.md — Cursor pagination for events/llm/sessions (backend + frontend hooks), LoadMoreButton component, Settings retention UI
- [x] 05-04-PLAN.md — Cursor pagination for agents, alerts, executions, security events (remaining D-09 domains)
**UI hint**: yes

### Phase 6: Alert Routing
**Goal**: Operators receive notifications within 60 seconds of threshold breaches and can manage alerts without leaving the dashboard
**Depends on**: Phase 2
**Ástríðr dependency**: None (CodePulse-side delivery)
**Requirements**: ALR-01, ALR-02, ALR-03, ALR-04, ALR-05, ALR-06, ALR-07
**Success Criteria** (what must be TRUE):
  1. Operator can create an alert rule with a threshold and see it listed in the Alerts page
  2. A triggered alert delivers a notification to a configured Discord webhook within 60 seconds
  3. A triggered alert delivers a notification to a configured Slack webhook within 60 seconds
  4. Operator can mute, acknowledge, and escalate any alert from the dashboard
  5. Per-severity notification preferences work — critical always notify, warning to digest
  6. One-click "Create Task from Alert" converts alert to Kanban task
  7. All alerts surface in Unified Inbox
**Plans**: 5 plans
Plans:
- [x] 06-01-PLAN.md — Schema migration, Wave 0 test stubs, shadcn component installs
- [x] 06-02-PLAN.md — Alert lifecycle mutations, custom rule CRUD, threshold overrides, mute system
- [x] 06-03-PLAN.md — Webhook delivery engine, evaluation upgrades, cron registration, ingest hook
- [x] 06-04-PLAN.md — Settings page: Notification Channels + Notification Preferences UI
- [x] 06-05-PLAN.md — Alerts page lifecycle UI, AlertRuleForm, ConditionBuilder, InboxCard integration
**UI hint**: yes

### Phase 7: Intelligence Layer
**Goal**: The dashboard surfaces cost forecasts, session narratives, anomaly signals, activity changelogs, and memory quality metrics — operators understand not just what happened but what to expect
**Depends on**: Phase 5 (aggregated data)
**Ástríðr dependency**: v4.0 Phase 50 (Agent Intelligence — for memory eval hooks)
**Requirements**: INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07
**Success Criteria** (what must be TRUE):
  1. The dashboard displays trend-based daily, weekly, and monthly spend predictions with a visual budget threshold indicator
  2. Any completed session has an LLM-generated briefing summarizing what happened, key decisions made, and anomalies detected
  3. A daily digest is auto-generated and stored in Convex — operator can browse past digests from the Briefings page
  4. Unusual patterns (cost spikes, error clusters, latency degradation) appear as visual anomaly indicators
  5. Activity changelog auto-generates "what did Astridr accomplish today?" from events
  6. Ideation briefings weave proactive scan findings into daily digest
  7. Memory page shows quality metrics: deduplication rate, contradiction resolution, staleness indicators
**Plans**: 5 plans
Plans:
- [x] 07-01-PLAN.md — Schema tables (briefings, anomalyEvents, memoryQuality), cron registrations, Wave 0 test stubs
- [x] 07-02-PLAN.md — Cost forecasting: moving average query, budget config, CostForecastPanel on Analytics, Settings budget cap
- [x] 07-03-PLAN.md — Briefings: LLM actions with dual-provider failover, daily digest cron, Briefings page rewrite, LLMProviderConfig on Settings
- [x] 07-04-PLAN.md — Anomaly detection: z-score computation, alert auto-creation, AnomalyBadge on Analytics MetricCards
- [x] 07-05-PLAN.md — Memory quality: dedup rate, staleness, LLM contradiction detection, Quality tab on Memory page
**UI hint**: yes

### Phase 58: Infrastructure Layer
**Goal**: Capabilities page displays a live command catalog received over WebSocket, showing all registered slash commands grouped by category with expand/collapse details, collapsible page sections, and dynamic search placeholder
**Depends on**: Existing WebSocket infrastructure (AstridrWSContext from Phase 56)
**Ástríðr dependency**: v4.0 Phase 58 (manifest-driven lazy tool loading + command registry)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. CommandCatalogPanel displays commands grouped by category with accordion expand/collapse
  2. Commands MetricCard shows live count from WebSocket catalog (not Convex polling)
  3. Category filter pills filter the command list
  4. Search input on Capabilities page includes commands in its scope
  5. Connection states handled: loading spinner, error message, empty state
  6. All Capabilities page sections are collapsible with expand/collapse toggle
  7. Search placeholder dynamically generated from mounted panels
**Plans**: 1 plan
Plans:
- [x] 58-01-PLAN.md — Status field on CommandEntry, collapsible sections, dynamic search placeholder, test update, visual verification
**UI hint**: yes

### Phase 59: Rubric-Inspired Observability

**Goal:** Operators see Astridr's live operational state through three new dashboard surfaces — a real-time agent status grid (active/waiting/recent/idle), a 7-day cron calendar showing daily_rhythm tasks color-coded by category, and an animated pipeline flow diagram tracing messages through receive->route->process->respond->TTS stages.
**Requirements**: D-01 through D-13 (cross-project: Astridr emits heartbeat/step events, CodePulse consumes and visualizes)
**Depends on:** Phase 58
**Inspiration:** [Rubric](https://github.com/robonuggets/rubric) command center patterns (status grid, cron calendar, flow visualization)
**Success Criteria** (what must be TRUE):
  1. Operations page accessible at /operations with sidebar nav entry
  2. Status grid shows all 10 configured agent types as tiles with 4 states (active/waiting/recent/idle), pulse animations, 5-min idle timeout
  3. Cron calendar shows 7-day hour grid combining Astridr daily_rhythm entries and Convex crons, with category color coding and system cron toggle
  4. Pipeline flow renders 5 stages as animated React Flow diagram with live/replay modes
  5. Click-to-expand detail panels on tiles, calendar slots, and pipeline nodes
  6. WebSocket instant updates for agent_status and step_started/step_completed events
  7. SectionErrorBoundary wrapping prevents panel crashes from propagating
**Plans:** 5/5 plans complete
Plans:
- [x] 59-01-PLAN.md — Data foundation: Convex schema (3 tables), domain modules, ingest routing, WS topic map, static utilities, hooks, test stubs
- [x] 59-02-PLAN.md — Status Heartbeat Grid: AgentStatusTile + StatusHeartbeatGrid with WS subscription, idle timeout, inline detail
- [x] 59-03-PLAN.md — Cron Calendar View: 7-day hour grid, category colors, system cron toggle, slot popover, time indicator
- [x] 59-04-PLAN.md — Pipeline Flow Diagram: PipelineStageNode + PipelineFlowDiagram with live/replay modes, WS subscription
- [x] 59-05-PLAN.md — Operations page wiring: page composition, route registration, nav entry, visual verification
**UI hint**: yes

## Execution Order

```
Phase 1 (UI Foundation)       ██████████  Execute now — no blockers
                                  │
Phase 5 (Data Pipeline)       ░░░░██████████  Parallel — backend only
                                  │
Phase 2 (Bidirectional WS)   ░░░░░░██████████  After Phase 1 + Astridr Phase 47
                                       │
Phase 3 (Interaction)         ░░░░░░░░░░██████████████  After Phase 2 + Astridr Phase 48
                                              │
Phase 4 (Tasks)               ░░░░░░░░░░░░░░░░██████████  After Phase 3 + Astridr Phase 49
                                       │
Phase 6 (Alerts)              ░░░░░░░░░░░░██████████  After Phase 2
                                                    │
Phase 7 (Intelligence)        ░░░░░░░░░░░░░░░░░░░░░░██████████  After Phase 5
```

**Critical path:** Phase 1 -> Phase 2 -> Phase 3 (vision shift) -> Phase 4

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. UI Foundation | 4/4 | Complete |  |
| 2. Bidirectional Telemetry | 0/4 | Planned | - |
| 3. Interaction Layer | 0/6 | Planned | - |
| 4. Task Management | 0/6 | Planned | - |
| 5. Data Pipeline | 0/5 | Planned | - |
| 6. Alert Routing | 0/5 | Planned | - |
| 7. Intelligence Layer | 0/5 | Planned | - |
| 58. Infrastructure Layer | 2/1 | Complete    | 2026-04-14 |
| 59. Rubric-Inspired Observability | 5/5 | Complete    | 2026-05-06 |

---

*Last updated: 2026-05-06 — Phase 59 complete. Operations page live at /operations with agent status grid, cron calendar, pipeline flow.*
