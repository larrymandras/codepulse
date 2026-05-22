# Roadmap: CodePulse Command Center

## Overview

Seven phases transform CodePulse from a monitoring dashboard into an all-in-one command center for Astridr. Phase 1 (UI Foundation) establishes the design system. Phase 2 (Bidirectional Telemetry) builds the real-time communication layer. Phase 3 (Interaction Layer) is the vision shift — adding chat, inbox, live runs, approvals, and command palette. Phase 4 (Task Management) adds Kanban, ideation, agent config, and cron UX. Phases 5-7 handle data pipeline, alert routing, and intelligence.

Phase 58 (Infrastructure Layer) is a cross-project phase from Astridr that adds a command catalog frontend surface to the Capabilities page.

v5.0 (Phases 59-65) extends CodePulse with deep operational visualizations and external delivery channels.

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
- [x] **Phase 59: Schema Foundation** - New tables and field extensions that unblock all v5.0 visualizations and integrations (completed 2026-05-18)
- [ ] **Phase 60: Context Window Animation** - Real-time animated context window progress bar with area chart and compaction markers
- [ ] **Phase 61: Token Sunburst** - Two-level ring chart showing per-agent/per-tool token consumption with drill-down
- [ ] **Phase 62: Email Digest** - Scheduled HTML email delivery of daily/weekly operational summaries via Resend
- [ ] **Phase 63: Call Graph** - Directed agent/tool dependency graph with dagre layout, node state coloring, and error path highlighting
- [ ] **Phase 64: PagerDuty** - Incident trigger/resolve lifecycle via PagerDuty Events API v2 with per-rule toggle
- [ ] **Phase 65: GitHub Actions** - Workflow dispatch trigger from alert rules with configurable repo/PAT and rate limiting

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

### Phase 59: Schema Foundation
**Goal**: All new Convex tables and field extensions required by v5.0 are in place so that visualization and integration phases have a stable backend to build against
**Depends on**: Phase 58 (last shipped phase)
**Requirements**: SCH-01, SCH-02, SCH-03, SCH-04
**Success Criteria** (what must be TRUE):
  1. A `callGraphEdges` table exists in the Convex schema with integration dependency fields and can be upserted from ingest events
  2. `llmMetrics` rows carry optional `agentId` and `toolName` fields with a working `by_agent` index queryable from the dashboard
  3. Each `alertRuleCustom` row has `pagerdutyConfig` (nested object with enabled/routingKey/severity) and `githubTrigger` (nested object with enabled/repo/workflowFile/ref) fields editable through existing alert rule mutations
  4. Three delivery log tables (`emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog`) exist and accept insert mutations
**Plans**: 2 plans
Plans:
- [x] 59-01-PLAN.md -- Schema definitions (4 new tables, 2 extensions) + Wave 0 test stubs
- [x] 59-02-PLAN.md -- Mutations, ingest wiring, archival extension, backfill

### Phase 60: Context Window Animation
**Goal**: Operators can see how a session's context window is filling in real time — growth rate, current pressure, and when compactions occur
**Depends on**: Phase 59
**Requirements**: VIZ-02
**Success Criteria** (what must be TRUE):
  1. An animated progress bar on the session detail view shows current context window fill percentage with color change at 70% (warning) and 90% (critical)
  2. An area chart below the bar plots token count growth over session elapsed time, updating as new LLM events arrive
  3. Compaction events appear as vertical markers on the area chart at the timestamp they occurred
  4. The component renders correctly when no session is active (empty/zero state)
**Plans**: TBD
**UI hint**: yes

### Phase 61: Token Sunburst
**Goal**: Operators can see exactly which agents and tools are consuming tokens at a glance, with the ability to drill into any subtree
**Depends on**: Phase 59 (agentId field on llmMetrics)
**Requirements**: VIZ-03
**Success Criteria** (what must be TRUE):
  1. A two-level ring chart renders on the Analytics page with agents as the inner ring and tools as the outer ring, each arc sized proportionally to token count
  2. Hovering any arc shows a tooltip with entity name, token count, and percentage of total
  3. Clicking an agent arc zooms the chart to show only that agent's tool breakdown
  4. The center of the chart displays total tokens consumed and estimated cost for the visible selection
**Plans**: TBD
**UI hint**: yes

### Phase 62: Email Digest
**Goal**: Operators receive a rich HTML operational summary in their inbox on a schedule, without having to visit the dashboard
**Depends on**: Phase 59 (emailDeliveryLog table)
**Requirements**: EXT-01
**Success Criteria** (what must be TRUE):
  1. A Convex cron job fires on the configured schedule (daily and/or weekly) and sends an HTML email to the configured recipient via Resend
  2. The email body includes sections for active alerts, token cost, anomaly flags, and the latest briefing narrative
  3. Every send attempt (success or failure) writes a row to `emailDeliveryLog` visible in the Settings page
  4. The operator can configure recipient address and schedule from the Settings page without redeploying
**Plans**: TBD

### Phase 63: Call Graph
**Goal**: Operators can see the live dependency graph of agent/tool integrations, identify which nodes are erroring, and trace how errors propagate
**Depends on**: Phase 59 (callGraphEdges table), Phase 60 (establishes D3/React pattern)
**Requirements**: VIZ-01
**Success Criteria** (what must be TRUE):
  1. The Call Graph page renders a directed graph with dagre top-down auto-layout showing all agent and tool nodes with edges representing call dependencies
  2. Each node is colored by its current state: healthy (default), errored (red), or pending (muted)
  3. When a node is in an errored state, the edges forming the error propagation path are highlighted
  4. The graph updates in real time as new ingest events arrive without requiring a page reload
**Plans**: TBD
**UI hint**: yes

### Phase 64: PagerDuty
**Goal**: Critical alerts automatically open PagerDuty incidents and resolve them when the alert clears — operators get paged through their existing on-call tooling
**Depends on**: Phase 59 (pagerdutyConfig field, pagerdutyDeliveryLog table)
**Requirements**: EXT-02
**Success Criteria** (what must be TRUE):
  1. An alert rule with PagerDuty enabled triggers a PagerDuty incident via Events API v2 within 60 seconds of the rule firing
  2. When the same alert rule resolves, the PagerDuty incident closes using the same stable `dedup_key`
  3. Each trigger and resolve attempt writes a log row to `pagerdutyDeliveryLog` with status and timestamp
  4. The operator can configure the routing key and enable/disable PagerDuty per rule from the alert rule editor
**Plans**: TBD

### Phase 65: GitHub Actions
**Goal**: Alert rules can automatically dispatch GitHub Actions workflows — enabling auto-remediation without manual intervention
**Depends on**: Phase 59 (githubTrigger field, githubTriggerLog table)
**Requirements**: EXT-03
**Success Criteria** (what must be TRUE):
  1. An alert rule with GitHub trigger enabled fires a `workflow_dispatch` event to the configured repo/workflow/ref when the rule matches
  2. Rate limiting prevents more than one dispatch per rule within the configured window
  3. Each dispatch attempt (success, rate-limited, or failed) writes a row to `githubTriggerLog` visible from the Settings or Alerts page
  4. The operator can configure repo, workflow file, ref, and PAT per rule from the alert rule editor
**Plans**: TBD

### Phase 66: Gateway Compatibility Layer
**Goal**: CodePulse correctly ingests, routes, and attributes telemetry events from the multi-provider CLI Gateway without data loss or misattribution
**Depends on**: Phase 59 (schema foundation), Ástríðr CLI Gateway merge
**Ástríðr dependency**: CLI Gateway sidecar (PR #4 on feature/cli-gateway)
**Requirements**: GW-01, GW-02, GW-03, GW-04
**Success Criteria** (what must be TRUE):
  1. A Codex CLI task routed through the gateway appears in CodePulse with `provider: "codex"`, not `provider: "anthropic"`
  2. Gateway task events route to `toolExecutions` and `gatewayTasks` (not generic `events` table)
  3. Provider health panel shows all 4 gateway providers with availability and auth status
  4. Existing Claude-only telemetry continues working unchanged
**Scope**:
  - Fix OTel provider default fallback (`otelLogs.ts:182`, `otelMetrics.ts:170,188`) — `?? "anthropic"` → `?? "unknown"` with warning
  - Add gateway event routing to ingest pipeline (`gateway.task_started`, `gateway.task_completed`, `gateway.task_failed`, `gateway.routing_decision`)
  - Gateway event → CodePulse translation layer in Ástríðr's `CLIGatewayTool`
  - Add `provider` field to `sessions` and `toolExecutions` tables with `by_provider` indexes
  - Central provider name registry (`convex/lib/providers.ts`) replacing all hardcoded provider arrays
  - Extend `providerHealth` schema with `authenticated`, `billingType`, `quotaRemaining` fields
  - Dynamic provider list in `ProviderHealthPanel` and `providerHealth.ts` queries
**Plans**: 4 plans
Plans:
- [x] 66-01-PLAN.md — Schema migration + provider registry + mutation upgrades + Wave 0 test stubs
- [x] 66-02-PLAN.md — OTel provider default fix + gateway event routing (otelLogs, otelMetrics, runtimeIngest)
- [x] 66-03-PLAN.md — Dynamic ProviderHealthPanel with all 7 providers and extended fields
- [x] 66-04-PLAN.md — CLIGatewayTool telemetry emission (Astridr-side) + hooks documentation
**UI hint**: yes

### Phase 67: Multi-Provider Pricing & Intelligence
**Goal**: Cost estimates, briefings, and intelligence features work correctly for all providers, not just Claude
**Depends on**: Phase 66
**Requirements**: GW-05, GW-06, GW-07
**Success Criteria** (what must be TRUE):
  1. A Codex task using GPT-4o shows correct cost ($2.50/$10 per 1M tokens), not Claude Sonnet rates
  2. Daily briefings generate without errors when gateway provider events are in the data
  3. Analytics page cost breakdown distinguishes subscription (free) from API-billed usage
  4. TokenWaterfall and provider map include all provider/model families
**Scope**:
  - Expand `modelPricing.ts` with GPT-4o, GPT-4o-mini, Gemini 2.5 Pro/Flash pricing
  - Fix `briefings.ts:241-243` provider validation — accept gateway provider names
  - Fix `memoryQuality.ts:216-235` provider handling
  - Expand `LLMProviderConfig` and `AgentProfileEditor` dropdowns with non-Claude options
  - Add `billingType` to `llmMetrics` table; update cost aggregation to include billing dimension
  - Add TokenWaterfall colors for GPT/Gemini model families
  - Add providerLocations entries for gateway providers
**Plans**: 3 plans
Plans:
- [x] 67-01-PLAN.md -- Provider billing registry, model pricing (GPT/Gemini), schema billingType, ingest wiring, model dropdowns, map locations
- [x] 67-02-PLAN.md -- Aggregates billingType dimension, cost forecast API-only filter, intelligence pipeline verification (briefings/memoryQuality)
- [x] 67-03-PLAN.md -- TokenWaterfall provider grouping + colors, Analytics split view, SDKSpendCapGauge, CostForecastPanel note
**UI hint**: yes

### Phase 68: Gateway Observability
**Goal**: CodePulse surfaces gateway-specific operational data — task lifecycle, quota burndown, routing decisions, and per-provider performance comparison
**Depends on**: Phase 67
**Requirements**: GW-08, GW-09, GW-10, GW-11
**Success Criteria** (what must be TRUE):
  1. Quota gauges show live remaining capacity for each enabled provider
  2. Routing decisions table shows why each provider was selected (score breakdown)
  3. Provider comparison chart shows relative performance across all active providers
  4. CostTrendChart shows separate trend lines per provider
**Scope**:
  - New `gatewayTasks` table (`taskId`, `sessionId`, `provider`, `billingType`, `status`, `durationSeconds`, `error`, `timestamp`)
  - New `gatewayQuotaSnapshots` table (`provider`, `billingType`, `usedToday`, `dailyLimit`, `spendUsd`, `spendCapUsd`, `remainingPct`, `timestamp`)
  - New `routingDecisions` table (`taskId`, `requestedProvider`, `selectedProvider`, scores, `fallbackUsed`, `timestamp`)
  - Gateway quota polling action + ingest
  - GatewayQuotaPanel (per-provider burndown gauges)
  - ProviderComparisonChart (success rate, latency, task count)
  - GatewayTasksPanel (sortable/filterable recent tasks)
  - LlmProviderPanel grouped by provider then model
  - CostBreakdown and CostTrendChart provider dimensions
  - Analytics page wiring + rename "Claude Code Telemetry" → "Agent Telemetry"
**Plans**: 5 plans
Plans:
- [x] 68-01-PLAN.md — Schema tables (gatewayTasks, gatewayQuotaSnapshots, routingDecisions) + cron + backend services + test stubs
- [ ] 68-02-PLAN.md — OTel gateway event redirect + costByPeriodByProvider query + FlexBarChart segments extension
- [ ] 68-03-PLAN.md — GatewayQuotaPanel + ProviderComparisonChart + useGatewayTasks hook
- [ ] 68-04-PLAN.md — RoutingDecisionsTable + GatewayTasksPanel + useRoutingDecisions hook
- [ ] 68-05-PLAN.md — CostTrendChart upgrade + LlmProviderPanel + Analytics page wiring + section rename
**UI hint**: yes

### Phase 69: SDK Spend Guard & Multi-Provider UX
**Goal**: Operator has full control and visibility over API-billed SDK usage, and the entire dashboard feels multi-provider-native
**Depends on**: Phase 68
**Requirements**: GW-12, GW-13, GW-14
**Success Criteria** (what must be TRUE):
  1. SDK spend guard card shows real-time spend with projected daily total and visual alert at threshold
  2. Operator can manually disable a provider from the dashboard
  3. Session timeline shows provider badge per tool call
  4. Alert fires automatically when SDK spend hits 80% of daily cap
**Scope**:
  - SDKSpendGuard card (spend vs cap, trend line, projected overshoot)
  - RoutingAuditTable (expandable score breakdown per task)
  - Auto-alert rule for SDK spend at 80% cap
  - ProviderControls panel (enable/disable, priority, force-route)
  - Session detail provider attribution badges
  - Non-Claude agent profile seed data
  - Hook system documentation update
**Plans**: TBD
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
Phase 58 (Infrastructure)     Shipped 2026-04-14

Phase 59 (Schema Foundation)  ██████████  Start now — unblocks all v5.0 phases
                                  │
Phase 60 (Context Window)     ░░░░██████████  After 59 — establishes viz pattern
Phase 61 (Token Sunburst)     ░░░░░░░░██████████  After 59
Phase 62 (Email Digest)       ░░░░██████████  After 59 — validates delivery pattern
                                  │
Phase 63 (Call Graph)         ░░░░░░░░░░░░██████████  After 59 + 60 (pattern)
Phase 64 (PagerDuty)          ░░░░░░░░████████████  After 59
Phase 65 (GitHub Actions)     ░░░░░░░░░░░░████████  After 59

--- Gateway Integration (v5.1) ---

Phase 66 (Compatibility)      ████████████  MUST ship before/with gateway merge
                                  │
Phase 67 (Pricing/Intel)      ░░░░████████████  After 66 — fixes data accuracy
                                  │
Phase 68 (Observability)      ░░░░░░░░████████████████  After 67 — new tables + widgets
                                  │
Phase 69 (SDK Guard/UX)       ░░░░░░░░░░░░░░░████████████  After 68 — polish
```

**Critical path (v5.0):** Phase 59 (schema) -> Phase 60 (viz pattern) -> Phase 63 (call graph)
**Critical path (v5.1 gateway):** Phase 66 (compatibility) -> Phase 67 (pricing) -> Phase 68 (observability) -> Phase 69 (UX)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. UI Foundation | 4/4 | Complete | - |
| 2. Bidirectional Telemetry | 4/4 | Complete | - |
| 3. Interaction Layer | 6/6 | Complete | - |
| 4. Task Management | 6/6 | Complete | - |
| 5. Data Pipeline | 5/5 | Complete | - |
| 6. Alert Routing | 5/5 | Complete | - |
| 7. Intelligence Layer | 5/5 | Complete | - |
| 58. Infrastructure Layer | 1/1 | Complete | 2026-04-14 |
| 59. Schema Foundation | 2/2 | Complete    | 2026-05-18 |
| 60. Context Window Animation | 0/TBD | Not started | - |
| 61. Token Sunburst | 0/TBD | Not started | - |
| 62. Email Digest | 0/TBD | Not started | - |
| 63. Call Graph | 0/TBD | Not started | - |
| 64. PagerDuty | 0/TBD | Not started | - |
| 65. GitHub Actions | 0/TBD | Not started | - |
| 66. Gateway Compatibility | 4/4 | Complete    | 2026-05-21 |
| 67. Multi-Provider Pricing | 3/3 | Complete    | 2026-05-22 |
| 68. Gateway Observability | 1/5 | In Progress|  |
| 69. SDK Guard & UX | 0/TBD | Not started | - |

---

*Last updated: 2026-05-22 — Phase 68 planning complete (5 plans in 4 waves)*
