# Feature Landscape — CodePulse v5.0 Advanced Visualization & Integrations

**Domain:** Operational dashboard for a single-operator AI assistant (Ástríðr)
**Researched:** 2026-05-16
**Milestone context:** Adding visualization and external integrations to an existing React 19 + Convex dashboard (v4.0 already ships 15 pages, WebSocket telemetry, alert routing, analytics aggregates)

---

## VIZ-01: Call Graph Visualization

Shows integration dependencies between Ástríðr agents/tools and how errors propagate through the call chain.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Directed graph of agent → tool → agent calls | Operators need to trace what called what during a run | Medium | React Flow already in stack (confirmed in PROJECT.md) |
| Node state coloring (healthy / errored / pending) | Immediate visual triage — error propagation path obvious at a glance | Low | CSS class switching on existing node data |
| Click-to-inspect node detail | Every operational graph tool does this; without it the graph is decorative | Low | React Flow `onNodeClick` + existing EntityRow pattern |
| Zoom / pan / fit-to-view controls | Required for any graph with more than ~8 nodes | Low | React Flow built-in |
| Edge directional arrows showing call direction | Fundamental to understanding dependency order | Low | React Flow default edge type |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-layout via dagre (top-down DAG) | Eliminates manual node positioning; graphs render usably with zero config | Medium | `dagre` + `@dagrejs/dagre` npm packages; well-documented with React Flow |
| Error propagation highlighting (red path from root cause to leaf) | Instantly shows blast radius of a failure — rare in dashboards, high operational value | Medium | Graph traversal on edge data + CSS stroke color |
| Edge latency labels (ms per call) | Shows where time is spent in a multi-step run without clicking each node | Low | Text label on React Flow edge |
| Live update during active run | Graph nodes change state in real-time as the run progresses | Medium | WebSocket telemetry already exists; feed node state updates via Convex subscription |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Force-directed layout | Looks impressive, but non-deterministic — same graph renders differently each time, confusing operators | Use dagre top-down DAG layout always |
| Editable graph (drag to reconnect nodes) | This is read-only telemetry, not a workflow builder | Make nodes drag-repositionable for layout comfort but don't allow edge editing |
| 3D graph (React Three Fiber) | Already called out of scope in PROJECT.md; adds no operational value | 2D only |
| Full graph history playback slider | Very high complexity, marginal value for single operator | Offer snapshot export (PNG) instead |

### Complexity Estimate: Medium
React Flow is already in the stack. The work is: (1) define the Convex query that produces node/edge data from run telemetry, (2) write the dagre layout wrapper, (3) build custom node components matching Paperclip aesthetic. No new library installs required beyond `dagre`.

### v4.0 Dependencies
- RunTimeline / Flow DAG already exists (v4.0 Phase 3) — call graph is a superset of this; reuse node component patterns
- Convex run telemetry tables already populated — query shape is the design question
- WebSocket subscription infrastructure available for live updates

---

## VIZ-02: Context Window Growth Visualization

Shows how token consumption in the active LLM context grows (and optionally shrinks via compression/summarization) during a live session.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Linear progress bar: used tokens / max tokens | Simplest possible representation; every LLM observability tool shows this | Low | shadcn/ui Progress component |
| Color threshold at 70% / 90% used | Visual warning before context overflow; standard in all LLM monitoring tools | Low | CSS class on progress fill |
| Numeric display: "42,381 / 128,000 tokens" | Raw numbers needed for precise operator reasoning | Low | Formatted counter |
| Per-message token delta annotation | Shows how much each message/tool call consumed | Medium | Requires per-event token data from Ástríðr telemetry |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Animated area chart showing context growth over time within a session | More useful than a single bar — shows rate of growth and inflection points | Medium | Can use existing FlexBarChart pattern or a simple SVG area; no new library needed |
| Compression/summarization events marked on timeline | Shows exactly when Ástríðr compacted context; distinguishes shrink from confusion | Medium | Requires specific telemetry event type from Ástríðr |
| Projected "fill time" at current growth rate | Warns operator N minutes before context overflow | Medium | Linear extrapolation from rolling average delta |
| Role breakdown (system / user / assistant / tool) | Shows what's consuming context budget; tool results are often the surprise | Medium | Requires structured token metadata per role |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Token-by-token streaming animation | High WebSocket pressure for marginal value; distracting during active use | Update at message/turn boundaries (every few seconds) |
| Historical comparison across sessions | Adds complexity; sessions have different purposes and different max context | Show current session only; Analytics page handles cross-session aggregates |
| Editable context (delete messages) | Out of scope — CodePulse is observability, not LLM control plane | Link to Agent Chat for intervention |

### Complexity Estimate: Low–Medium
The display itself is low complexity (progress bar + time-series chart). The hard part is whether Ástríðr's existing telemetry already emits per-turn token counts broken down by role. If telemetry already has this, it's Low. If new telemetry fields need to be added to the Ástríðr repo (cross-repo work), it's Medium.

### v4.0 Dependencies
- WebSocket telemetry infrastructure (v4.0 Phase 2) — token events must flow through this pipe
- Analytics aggregation tables (v4.0 Phase 5) — store rolling window for growth rate calculation
- Anomaly detection (v4.0 Phase 7) — can auto-alert on rapid context growth approaching limit

---

## VIZ-03: Token Sunburst

Hierarchical breakdown of total token consumption by agent → tool → operation, visualized as a zoomable sunburst (ring chart).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Two-level ring: agent (inner) → tool/operation (outer) | Sunbursts without drill-down are just pie charts; the hierarchy is the point | Medium | D3 hierarchy + arc layout; or Recharts Sunburst (Recharts v2.5+ has sunburst) |
| Hover tooltip showing absolute tokens + percentage of total | Required for any quantitative chart | Low | Standard D3/Recharts pattern |
| Click to zoom into a subtree | Core sunburst interaction; without it operators can't read crowded outer rings | Medium | D3 zoomable sunburst pattern (Observable reference implementation exists) |
| Total token count + cost estimate at center | Single-operator dashboards need the "so what" number immediately visible | Low | SVG text element at center |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Time range selector (last hour / day / week) | Sunburst is much more useful when scoped to a time window, not all-time | Low | Reuse existing analytics page time range pattern |
| Animate transitions when time range changes | Makes data changes readable, not jarring | Low | D3 transition or Recharts animation prop |
| Export as PNG or CSV | Useful for billing reviews or sharing with stakeholders | Low | Canvas toDataURL() for PNG; JSON serialization for CSV |
| Cost overlay (tokens → dollars at model rate) | Converts abstract token count to concrete budget impact | Low | Already have cost model from v4.0 Phase 7; apply rate table to each leaf node |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Live real-time updates on sunburst | Continuously rotating/reshaping ring charts are nauseating and unreadable | Refresh on interval (every 30s) or on user demand |
| More than 3 hierarchy levels | Outer rings become too thin to interact with on typical monitor | Cap at agent → tool → operation (3 levels max) |
| Custom D3 sunburst from scratch | High implementation effort; Recharts has a Sunburst component since v2.5 | Use Recharts Sunburst if Recharts is acceptable, or use the Observable zoomable sunburst reference pattern with D3 directly |

### Complexity Estimate: Medium
Sunburst charts are the most complex of the three visualizations. The hierarchy data query (aggregating tokens by agent/tool from Convex) is straightforward given existing analytics tables. The chart itself requires either adding Recharts (not currently in stack — PROJECT.md confirms custom flex charts were used instead) or writing a focused D3 component. Recommend a standalone D3 SVG component (~200 lines) rather than adding Recharts as a dependency, consistent with the existing "custom CSS flex charts" decision.

### v4.0 Dependencies
- Pre-computed aggregation tables (v4.0 Phase 5) — token totals by agent/tool must be available
- Cost forecasting model (v4.0 Phase 7) — reuse rate table to convert tokens to dollars
- Analytics page time range state — reuse the existing time range selector pattern

---

## EXT-01: Email Digest Delivery

Scheduled delivery of daily/weekly operational summaries to the operator via email.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Scheduled daily/weekly digest send | Core purpose of the feature; without scheduling it's just a manual report | Medium | Convex scheduled functions (cron) already used for other tasks |
| HTML email with key metrics (alerts, cost, token usage, anomalies) | Plain text is insufficient for a dashboard digest; operators expect formatted output | Medium | React Email (react.email) — renders React components to HTML for email |
| Configurable recipient email address | Must be configurable — single operator but address may change | Low | Convex settings table; existing Config Editor can surface this |
| Unsubscribe / pause delivery | Legal best practice even for single-operator internal tools | Low | Toggle in notification preferences (v4.0 Phase 6 already has per-channel prefs) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Resend as delivery provider | Developer-first API, first-class React Email integration, free tier (3k emails/month) covers single-operator use indefinitely, clean deliverability | Low | Single npm package + API key; simpler than SendGrid for low volume |
| Email rendered from React components (React Email) | Same design language as the dashboard; digest looks professional, not like a cron job output | Medium | React Email renders to HTML server-side via Convex action |
| Include LLM-generated narrative summary | Reuse existing briefings system (v4.0 Phase 7) — wrap the daily briefing text into the email | Low | Briefings already generated; this is delivery plumbing, not new intelligence |
| Configurable time of delivery (e.g., 7 AM local) | Operator gets digest before the workday, not at 3 AM UTC | Low | Convex cron with timezone offset stored in settings |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SMTP/Nodemailer | Configuration overhead, deliverability management, no managed retry — wrong for a single-operator tool | Use Resend API (managed service) |
| Email open tracking pixels | Privacy-invasive for an internal tool; adds unnecessary complexity | Skip tracking entirely |
| Multiple recipient lists / CC / BCC | Over-engineered for single operator; adds address management complexity | Single recipient field |
| SendGrid for this use case | Designed for millions of emails; setup overhead (IP warming, domain authentication steps) is disproportionate | Resend handles <100 emails/month trivially |

### Complexity Estimate: Low–Medium
Convex already has cron scheduling. The digest content (briefings, cost data, alert summaries) already exists. This is primarily: (1) add Resend + React Email, (2) write the email template component, (3) wire a Convex cron action to call Resend. Cross-repo scope: none — entirely within CodePulse + Convex.

### v4.0 Dependencies
- LLM session briefings (v4.0 Phase 7) — digest narrative is an email delivery of the existing briefing
- Alert lifecycle data (v4.0 Phase 6) — include alert summary in digest
- Cron management (v4.0 Phase 4) — existing cron infrastructure handles scheduling; email cron is one more entry
- Notification preferences (v4.0 Phase 6) — add email channel to existing per-severity preferences

---

## EXT-02: PagerDuty Integration

Escalates critical alerts from CodePulse to PagerDuty, creating incidents and respecting PagerDuty deduplication and escalation policies.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Send trigger event to PagerDuty Events API v2 | Core integration — every PagerDuty integration does this | Low | Single HTTPS POST to `https://events.pagerduty.com/v2/enqueue` |
| Deduplication via `dedup_key` | Without this, a flapping alert creates hundreds of incidents | Low | Use alert rule ID + timestamp window as dedup_key |
| Resolve event when alert auto-resolves | Two-way lifecycle — open alert → PagerDuty incident open; resolved → PagerDuty incident resolved | Low | Send `resolve` action event when CodePulse alert closes |
| Routing key configuration in settings | Required to connect to the correct PagerDuty service | Low | Store in Convex settings; surface in Config Editor |
| Per-alert-rule toggle: escalate to PagerDuty yes/no | Not every alert warrants waking someone up | Low | Add field to existing alert rule schema (v4.0 Phase 6) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Severity mapping (CodePulse severity → PagerDuty severity) | Keeps PagerDuty noise low; INFO alerts should not page | Low | Map critical→critical, warning→warning, info→info in config |
| Acknowledge in PagerDuty → acknowledge in CodePulse | Bidirectional sync via PagerDuty webhooks; single source of truth | High | Requires PagerDuty webhook endpoint in Ástríðr or a Convex HTTP action; inbound webhook adds complexity |
| Custom PagerDuty payload enrichment (links back to CodePulse alert) | Operator clicking PagerDuty notification goes directly to the alert in CodePulse | Low | Include `links` array in Events API v2 payload |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| PagerDuty REST API (not Events API) | REST API requires API key with broader permissions, designed for admin operations not event ingestion | Events API v2 — designed for this exact use case, uses routing key only |
| Building an escalation policy UI in CodePulse | Reinventing PagerDuty's core product; creates two places to manage escalation policy | Send events to PagerDuty, let PagerDuty manage its own escalation policies |
| Bidirectional sync in v5.0 scope | High complexity inbound webhook; out of proportion with single-operator use | Ship outbound-only in v5.0; note bidirectional as v6.0 candidate |

### Complexity Estimate: Low
Outbound-only PagerDuty integration is genuinely simple — one HTTPS POST per alert event. The Events API v2 is well-documented, requires only a routing key, and handles deduplication server-side. The real work is schema changes to alert rules (add PagerDuty toggle + severity mapping) and a Convex action that fires on alert state changes.

### v4.0 Dependencies
- Alert lifecycle (v4.0 Phase 6) — hook into alert creation, resolution, and state-change events
- Alert rule schema (v4.0 Phase 6) — extend rule with `pagerdutyEnabled: boolean` and severity mapping
- Notification preferences (v4.0 Phase 6) — PagerDuty is another delivery channel alongside Discord/Slack

---

## EXT-03: GitHub Actions Trigger from Alert Rules

Fires a GitHub Actions `repository_dispatch` event when a CodePulse alert rule matches, enabling auto-remediation workflows.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| POST to GitHub `repository_dispatch` endpoint on alert match | Core mechanism — this is how external services trigger GitHub Actions | Low | Single HTTPS POST to `https://api.github.com/repos/{owner}/{repo}/dispatches` |
| Configurable repo (owner/repo), event type, and PAT | Operators need to point at the correct repo and workflow | Low | Store in Convex settings; surface in Config Editor |
| Per-alert-rule toggle: trigger GitHub Actions yes/no | Not every alert should kick off a workflow | Low | Add field to alert rule schema (same pattern as PagerDuty toggle) |
| Custom payload: include alert details in `client_payload` | Downstream workflow needs to know what fired it | Low | Pass alert rule name, severity, metric values in `client_payload` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multiple event_type mappings (different alert severity → different workflow) | Critical alert triggers `restart-service`; warning alert triggers `run-diagnostic` | Low | Array of condition → event_type mappings per rule |
| Delivery confirmation: log dispatch result + HTTP status to Convex | Operator can verify the trigger fired without checking GitHub | Low | Store dispatch log in Convex; surface on alert detail panel |
| Rate limiting: max N dispatches per hour per rule | Prevents flapping alert from flooding GitHub Actions minutes | Low | Debounce in Convex action; check last-fired timestamp |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| GitHub OAuth app / GitHub App | Disproportionate auth complexity for a single-operator trigger; requires callback URL, installation flow | Fine-grained PAT stored in Convex settings — read/write contents scope is all that's needed |
| Workflow result polling (wait for job completion) | GitHub Actions jobs can run for minutes; blocking Convex actions on this is wrong | Fire-and-forget dispatch; surface result via separate GitHub status check if needed in v6.0 |
| Building a workflow editor inside CodePulse | CodePulse is the trigger, not the workflow engine | Let GitHub Actions YAML live in the target repo |

### Complexity Estimate: Low
`repository_dispatch` is a single authenticated POST. This is the simplest of the three external integrations — less complex than PagerDuty (no deduplication logic) and far less than email (no templating). The work is: extend alert rule schema with GitHub Actions config, write a Convex action that POSTs on alert match, add rate limiting logic, log the result.

### v4.0 Dependencies
- Alert lifecycle (v4.0 Phase 6) — hook into alert creation events (same trigger point as PagerDuty)
- Alert rule schema (v4.0 Phase 6) — extend with `githubActionsEnabled`, `githubRepo`, `githubEventType`, `githubPAT` fields
- Config Editor (v4.0 Phase 4) — surface PAT and repo config securely

---

## Cross-Feature Notes

### MVP Recommendation for v5.0

**Ship in order of confidence-to-value ratio:**

1. **EXT-02 PagerDuty** — Lowest complexity, highest operational urgency. Single operator getting paged correctly is non-negotiable if Ástríðr is running unattended.
2. **EXT-03 GitHub Actions** — Also low complexity; completes the "alert → auto-remediate" loop. Two-thirds of the external integrations ship as a pair.
3. **VIZ-01 Call Graph** — React Flow is already in the stack. Medium complexity but foundational; the graph data shapes influence how VIZ-02 and VIZ-03 consume telemetry.
4. **VIZ-02 Context Window** — Low display complexity; blocked on whether Ástríðr emits per-turn role-breakdown token data. Validate telemetry schema first.
5. **VIZ-03 Token Sunburst** — Medium complexity (D3 component); can reuse aggregation tables from Phase 5. Ship last among visualizations.
6. **EXT-01 Email Digest** — Low-medium; content already exists (briefings, alerts). Delivery plumbing is the whole task. Ship last since it has no real-time dependency.

### Shared Schema Extension
All three external integrations (EXT-01, EXT-02, EXT-03) require extending the alert rule schema introduced in v4.0 Phase 6. Plan this extension once, not three times — a single migration adds all delivery-channel fields to the rule record.

### No New Major Library Installs Required for Visualizations
- VIZ-01: React Flow already in stack
- VIZ-02: Progress bar + SVG area chart — shadcn/ui + custom SVG (consistent with v4.0 flex chart decision)
- VIZ-03: D3 hierarchy/arc (d3-hierarchy + d3-shape sub-packages, ~30KB) — one focused install, not full Recharts

### Single-Operator Calibration
Anti-features above are calibrated for a **single-operator** dashboard. Features justified by multi-tenant or multi-team use (recipient lists, bidirectional PagerDuty sync, workflow editors) are explicitly deferred. The operator's primary need is visibility + escalation, not collaboration.

---

## Sources

- PagerDuty Events API v2: https://developer.pagerduty.com/api-reference/f80f5db9acbe3-pager-duty-v2-events-api
- PagerDuty trigger events docs: https://developer.pagerduty.com/docs/events-api-v2/trigger-events/index.html
- GitHub repository_dispatch: https://www.anantacloud.com/post/github-repository-dispatch-event-for-custom-triggers
- React Flow (Context7 ID: /websites/reactflow_dev)
- Resend + React Email: https://dev.to/whoffagents/resend-react-email-the-transactional-email-stack-that-doesnt-fight-you-774
- D3 zoomable sunburst: https://observablehq.com/@d3/zoomable-sunburst
- LLM context window monitoring patterns: https://dev.to/whoffagents/llm-context-window-managing-tokens-in-production-ai-apps-11l
