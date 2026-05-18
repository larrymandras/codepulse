# Architecture: CodePulse v5.0 Advanced Visualization & Integrations

**Project:** CodePulse  
**Researched:** 2026-05-16  
**Milestone:** v5.0 Advanced Visualization & Integrations  
**Mode:** Subsequent milestone — integration analysis against existing architecture

---

## Existing Architecture Snapshot

Before specifying what changes, a precise picture of what already exists:

**Frontend:**
- React 19 SPA, Vite 7, TypeScript 5.9, Tailwind CSS 4, shadcn/ui New York
- `@xyflow/react` ^12.10.1 already installed (React Flow v12)
- `dagre` ^0.8.5 already installed (auto-layout engine)
- `recharts` ^3.8.0 already installed (not currently used for charts — FlexBarChart is custom CSS)
- `motion` ^12.38.0 already installed (Framer Motion successor)
- 15 pages, 90+ components
- Component patterns: `MetricCard`, `EntityRow`, `SectionHeader`, `FlexBarChart`

**Backend:**
- Convex with 40+ tables in `schema.ts`
- Bidirectional WebSocket via `AstridrWSContext` (single connection, topic-based fan-out)
- Cron jobs in `convex/crons.ts` for aggregation, briefings, anomaly detection, alert delivery
- `internalAction` pattern for all HTTP egress (Discord/Slack webhook delivery via `sendAlertWebhook`)
- Alert lifecycle: `alerts` table → `webhookDeliveryLog` → Discord/Slack via `sendAlertWebhook`
- `briefings` table and `generateDailyDigestAction` already exist
- `contextSnapshots` table already exists with `contextTokens`, `summaryTokens` fields
- `llmMetrics` table has `provider`, `model`, `promptTokens`, `completionTokens`, `cost`, `sessionId`
- `integrationCalls` table already exists for external service call tracking
- `githubWorkflowRuns` table and `GithubActionsPanel` component already exist (passive monitoring only — v5.0 adds trigger capability)
- `agentCoordination` table has `fromAgent`, `toAgent`, `eventType` fields

**Notification delivery pattern (existing):**
```
Alert created → webhookStatus: "pending"
  → ctx.scheduler.runAfter(0, sendAlertWebhook)
    → internalAction fetches alert + channels + prefs
    → HTTP POST to Discord/Slack
    → logDeliveryAttempt → webhookDeliveryLog
    → retry via RETRY_DELAYS [5s, 30s, 120s]
```

All new delivery channels (email, PagerDuty) must follow this same pattern.

---

## Feature 1: Call Graph Visualization (VIZ-01)

### What it is
A React Flow DAG showing integration dependencies between Ástríðr components and the error propagation path when something fails. Distinct from `AgentTopology` (which shows agent parent/child relationships): this shows which integrations call which other integrations and where errors originate.

### Data Source
Two existing tables are the primary source:
- `integrationCalls` — has `integrationName`, `endpointName`, `success`, `statusCode`
- `agentCoordination` — has `fromAgent`, `toAgent`, `eventType`

These alone are not sufficient for a call graph. A call graph needs edges that say "integration X called integration Y", not just "this call happened". A new Convex table is required.

### New Convex Table: `callGraphEdges`

```typescript
callGraphEdges: defineTable({
  fromNode: v.string(),       // "agent:claude" | "integration:supabase" | "tool:bash"
  toNode: v.string(),         // same format
  edgeType: v.string(),       // "calls" | "depends_on" | "triggers"
  sessionId: v.optional(v.string()),
  errorPropagated: v.boolean(),
  callCount: v.float64(),
  errorCount: v.float64(),
  lastSeenAt: v.float64(),
})
  .index("by_from", ["fromNode", "lastSeenAt"])
  .index("by_session", ["sessionId", "lastSeenAt"])
  .index("by_error", ["errorPropagated", "lastSeenAt"])
```

**Alternative (lower schema footprint):** Derive the graph at query time by joining `integrationCalls` + `toolExecutions` + `agentCoordination`. This avoids a new table but requires grouping in a Convex query, which can scan many rows. For a dashboard that refreshes frequently, pre-materialized edges are better.

### New Convex Queries

In a new `convex/callGraph.ts`:
```typescript
// Public query — returns nodes + edges for the graph
export const getGraph = query({
  args: {
    sessionId: v.optional(v.string()),
    timeWindowSeconds: v.optional(v.float64()), // default: last 24h
  },
  handler: async (ctx, args) => { ... }
});

// Internal mutation — upsert edge on each integration call (called from ingest pipeline)
export const upsertEdge = internalMutation({ ... });
```

### Component: `CallGraphViz`

```
src/components/CallGraphViz.tsx
  - Uses @xyflow/react (already installed, same as AgentTopology)
  - Node types: "service" (integration), "agent", "tool"
  - Edge styling: red = error propagated, green = healthy, gray = stale
  - Error highlighting: when a node has errorCount > 0, pulse red ring
  - Layout: dagre auto-layout (already installed)
  - Sidebar: click node → detail panel showing recent calls from integrationCalls
  - NOT animated edges by default (too noisy for a dependency graph)
```

**Existing pattern to follow:** `AgentTopology.tsx` uses `@xyflow/react`, `dagre`, custom `nodeTypes`, click-to-select detail panel. `CallGraphViz` should follow this exact structure. Reuse `AgentNode.tsx` styling pattern for service nodes.

### Integration Points
- Page: New section on `Infrastructure.tsx` page (already has DockerPanel, IntegrationHealth) OR new dedicated page `CallGraph.tsx` added to router
- WebSocket: No new WS subscription needed. Convex real-time query is sufficient for dependency graphs (not millisecond-sensitive)
- Ingest path: When Ástríðr sends `integration_call` events through `/runtime-ingest`, the ingest handler should call `upsertEdge` to maintain the materialized graph

### Data Flow

```
Ástríðr runtime
  → POST /runtime-ingest { eventType: "integration_call", data: { from, to, success } }
    → convex/ingest.ts (existing handler)
      → insert integrationCalls (existing)
      → callGraph.upsertEdge (new)
        → upsert callGraphEdges (new table)

UI
  useQuery(api.callGraph.getGraph, { timeWindowSeconds: 86400 })
    → Convex real-time subscription
      → CallGraphViz renders nodes/edges
```

---

## Feature 2: Real-Time Context Window Animation (VIZ-02)

### What it is
A live visualization showing the context window growing and shrinking during an active session. The existing `contextSnapshots` table already records `contextTokens` and `summaryTokens` at each snapshot point. The missing piece is a time-series sparkline or animated bar that reacts in real time.

### Existing Infrastructure (no new tables needed)
`contextSnapshots` table already has everything needed:
- `sessionId`
- `contextTokens` — current context size in tokens
- `summaryTokens` — tokens in summary/compacted form
- `timestamp`

`historyBySession` query already exists and returns ordered snapshots.

The `useContextSnapshots.ts` hook already provides `useContextHistory(sessionId)`.

**No new Convex tables or queries are required for VIZ-02.** The data is already there.

### New Component: `ContextWindowAnimator`

```
src/components/ContextWindowAnimator.tsx
  Props:
    sessionId: string
    maxTokens?: number  // default: 200000 (Claude's max)

  Data:
    useContextHistory(sessionId) → sorted snapshots
    useLatestContext(sessionId) → current value

  Rendering:
    - Horizontal bar: filled width = contextTokens / maxTokens
    - Color bands: green (0-60%), yellow (60-80%), red (80%+)
    - Compaction events: sudden drop = animated shrink via motion library
    - Threshold line at 80% and 95%
    - Mini sparkline showing last N snapshots (reuse Sparkline component already at src/components/Sparkline.tsx)
    - "Danger zone" flash when > 95%
```

**Animation approach:** Use `motion` (already installed as `motion` ^12.38.0) for the bar fill transition. A `useEffect` that tracks the previous value and animates the difference is cleaner than CSS transitions alone because it can handle both growth (smooth fill right) and compaction (fast snap left with a brief flash).

### Real-Time Feed
The WebSocket `contextSnapshots` topic is already handled in AstridrWSContext. Add a WebSocket subscription:

```
subscribe("live-runs", callback) — existing topic
```

When a `run.thinking` event arrives with token count data, update local state. For between-event accuracy, Convex real-time subscription on `contextSnapshots` is sufficient (Convex pushes within ~100ms of mutation).

### Integration Points
- New component placed on `LiveRun.tsx` page (already shows active session runs)
- Also usable on `SessionDetail.tsx` for historical sessions (static view of the timeline)
- Reuses `useLatestContext` and `useContextHistory` hooks (already exist)

### Data Flow

```
Ástríðr runtime
  → POST /runtime-ingest { eventType: "context_snapshot", data: { contextTokens, summaryTokens } }
    → contextSnapshots.record (existing mutation)

UI (LiveRun page)
  useContextHistory(sessionId) → Convex real-time subscription
    → ContextWindowAnimator updates bar and sparkline
  OR
  subscribe("live-runs", cb) in AstridrWSContext
    → parse context token counts from run events
    → update local useState for sub-100ms responsiveness
```

**Recommendation:** Use both. Convex subscription for durable state; WS for immediate visual response. Deduplicate by taking the max of the two sources.

---

## Feature 3: Token Sunburst (VIZ-03)

### What it is
A sunburst (or treemap) showing token consumption breakdown: outer ring = agent, inner segments = tools called by that agent, sized by `promptTokens + completionTokens`.

### Data Source
`llmMetrics` table has `sessionId`, `promptTokens`, `completionTokens`, `cost`. It does NOT have `agentId` or `toolName` as a direct field. To build the sunburst hierarchy:

```
Session
  → Agent (from agents table via sessionId)
    → Tool calls within agent (from toolExecutions via sessionId)
```

The missing link is that `llmMetrics` rows don't carry `agentId`. If Ástríðr doesn't emit `agentId` in LLM metric events, the hierarchy must be inferred from timing overlap with agent lifecycles.

**Two options:**
1. Require Ástríðr to include `agentId` in LLM metric events (schema change to `llmMetrics` — add optional `agentId` field). This is the right long-term fix.
2. Derive at query time by joining `agents` (time overlap) — fragile and expensive.

**Recommendation:** Add `agentId` as an optional field to the `llmMetrics` schema, populated when Ástríðr emits it. The sunburst degrades gracefully if `agentId` is null (shows flat per-model breakdown).

### Schema Change to Existing Table

```typescript
// In schema.ts, add to llmMetrics:
agentId: v.optional(v.string()),
toolName: v.optional(v.string()),  // which tool invoked this LLM call, if any
```

No new table needed. Add an index:
```typescript
.index("by_agent", ["agentId", "timestamp"])
```

### New Convex Query: `tokenBreakdown`

```typescript
// In convex/analytics.ts (already exists) or new convex/tokenBreakdown.ts
export const bySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    // Returns hierarchy: { agents: [{ agentId, model, promptTokens, completionTokens, tools: [...] }] }
  }
});

export const rollup = query({
  args: { periodHours: v.optional(v.float64()) },
  handler: async (ctx, args) => {
    // Returns flat breakdown by model for the sunburst outer ring
  }
});
```

### Component: `TokenSunburst`

```
src/components/TokenSunburst.tsx
  - Uses recharts (already installed, ^3.8.0) — specifically PieChart with nested data
  - OR uses a custom SVG sunburst (simple to implement, no extra deps)
  - Recommendation: custom SVG — recharts' PieChart doesn't natively support true sunbursts
    (concentric rings with different data sets)
  - Two rings:
      Inner ring: per-model token share (computed from llmMetrics by model)
      Outer ring: per-session or per-agent share
  - Tooltip on hover: model, tokens, cost, % of total
  - Click outer segment: drill into session detail
  - Color: oklch-based palette matching existing design language
  - Size: fits in a 400x400 canvas, compact enough for sidebar placement
```

**SVG sunburst pattern:** Compute start/end angles for each arc based on token count proportions. Use `path` elements with `d` attribute for arcs. No external library needed beyond React — the math is ~50 lines.

### Integration Points
- New section on `Analytics.tsx` page (already exists, has cost breakdown charts)
- Or as a widget on the `Dashboard.tsx` page in the overview section
- Convex real-time subscription updates as new LLM calls come in

### Data Flow

```
llmMetrics table (existing, with new agentId field)
  ↓
tokenBreakdown.bySession or tokenBreakdown.rollup query
  ↓ Convex real-time subscription
TokenSunburst component renders arcs
```

---

## Feature 4: Email Digest Delivery (EXT-01)

### What it is
Send the daily digest (already generated by `generateDailyDigestAction`) to an email address. Possibly also send per-severity alert emails for "critical" alerts.

### Existing Infrastructure
- `briefings` table already has `daily_digest` type entries with full `narrative` text
- `generateDailyDigestAction` already runs daily at 06:00 UTC via cron
- `profileConfigs` table already has `emailAddress` field per profile
- The entire Discord/Slack delivery pattern in `webhookDelivery.ts` is the template

### Email Provider Decision
Convex `internalAction` can make arbitrary HTTP calls. The cleanest integration that doesn't require managing SMTP:

**Use Resend** (resend.com) — single HTTP POST to `https://api.resend.com/emails`, no SDK needed in a Convex action. Free tier: 3000 emails/month, 100/day. Alternatively SendGrid, which has the same HTTP API pattern.

**No new npm packages needed** — Convex actions use `fetch`. The API key is stored in `agentConfigs`.

### New Convex File: `convex/emailDelivery.ts`

```typescript
// Config keys stored in agentConfigs:
//   "email-provider" → { provider: "resend", apiKey: "re_..." }
//   "email-to-address" → string (operator email)
//   "email-alert-severities" → string[] (which severities get email, default ["critical"])

export const sendDailyDigestEmail = internalAction({
  args: { briefingId: v.id("briefings") },
  handler: async (ctx, args) => {
    // Load briefing
    // Load email config
    // POST to Resend/SendGrid
    // Log to emailDeliveryLog (new table)
  }
});

export const sendAlertEmail = internalAction({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    // Same pattern as sendAlertWebhook
    // Only fires for severities in email-alert-severities config
  }
});

// Public config mutations for Settings page
export const setEmailConfig = mutation({ ... });
export const getEmailConfig = query({ ... }); // never returns apiKey
```

### New Convex Table: `emailDeliveryLog`

```typescript
emailDeliveryLog: defineTable({
  type: v.string(),            // "digest" | "alert"
  refId: v.string(),           // briefingId or alertId as string
  toAddress: v.string(),
  subject: v.string(),
  status: v.string(),          // "sent" | "failed" | "skipped"
  statusCode: v.optional(v.float64()),
  errorMessage: v.optional(v.string()),
  attempt: v.float64(),
  sentAt: v.float64(),
})
  .index("by_type_sent", ["type", "sentAt"])
  .index("by_sentAt", ["sentAt"])
```

### Trigger Integration

**Daily digest email:** Extend `generateDailyDigestAction` to schedule `sendDailyDigestEmail` after storing the briefing:
```typescript
// After storeBriefing in generateDailyDigestAction:
await ctx.scheduler.runAfter(0, internal.emailDelivery.sendDailyDigestEmail, {
  briefingId: newBriefingId,
});
```

**Alert email:** Extend `createIfNew` in `evaluateInternal` (same location where `sendAlertWebhook` is scheduled) to also schedule `sendAlertEmail` for qualifying severities.

### Settings UI Changes
- Extend `Settings.tsx` with a new "Email Delivery" section alongside existing NotificationChannels
- New component: `EmailDeliveryConfig.tsx` — email address input, provider API key input, severity checkboxes, test button
- Test button: new `testEmailDelivery` action that sends a test email

### Data Flow

```
generateDailyDigestAction (existing, 06:00 UTC cron)
  → storeBriefing (existing)
  → schedule emailDelivery.sendDailyDigestEmail (new)
    → load briefing.narrative
    → fetch Resend API
    → log to emailDeliveryLog

alerts.evaluateInternal (existing, 2min cron)
  → createIfNew (when severity matches config)
    → schedule webhookDelivery.sendAlertWebhook (existing)
    → schedule emailDelivery.sendAlertEmail (new, for qualifying severities)
```

---

## Feature 5: PagerDuty Integration (EXT-02)

### What it is
When a "critical" alert fires, create a PagerDuty incident via the Events API v2. Optionally auto-resolve the PagerDuty incident when the alert is acknowledged/resolved in CodePulse.

### PagerDuty Events API v2
- Endpoint: `https://events.pagerduty.com/v2/enqueue`
- Auth: `routing_key` (Integration Key) in request body — no Bearer token
- Payload: `{ routing_key, event_action: "trigger"|"resolve", dedup_key, payload: { summary, severity, source, timestamp } }`
- `dedup_key` maps to alert `_id` — enables resolve calls to match the original incident

No npm SDK needed. Pure `fetch` in a Convex action.

### New Convex File: `convex/pagerduty.ts`

```typescript
// Config in agentConfigs:
//   "pagerduty-routing-key" → string (Integration Key)
//   "pagerduty-enabled-severities" → string[] (default: ["critical"])

export const triggerIncident = internalAction({
  args: {
    alertId: v.id("alerts"),
    dedupKey: v.string(),  // = alertId as string
  },
  handler: async (ctx, args) => {
    // Load alert, check severity, load routing key
    // POST to events.pagerduty.com/v2/enqueue
    // Log to pagerdutyDeliveryLog
  }
});

export const resolveIncident = internalAction({
  args: { dedupKey: v.string() },
  handler: async (ctx, args) => {
    // POST event_action: "resolve" with same dedupKey
    // Update pagerdutyDeliveryLog
  }
});

export const setPagerDutyConfig = mutation({ ... });
export const getPagerDutyConfig = query({ ... }); // omits routing_key
```

### New Convex Table: `pagerdutyDeliveryLog`

```typescript
pagerdutyDeliveryLog: defineTable({
  alertId: v.string(),         // alert _id as string
  dedupKey: v.string(),
  eventAction: v.string(),     // "trigger" | "resolve"
  status: v.string(),          // "sent" | "failed"
  statusCode: v.optional(v.float64()),
  errorMessage: v.optional(v.string()),
  sentAt: v.float64(),
})
  .index("by_alertId", ["alertId", "sentAt"])
  .index("by_sentAt", ["sentAt"])
```

### Trigger Integration

Same hook points as email:
- In `createIfNew` within `evaluateInternal`: schedule `pagerduty.triggerIncident`
- In `alertLifecycle.acknowledgeAlert` or `resolveAlert`: schedule `pagerduty.resolveIncident` using the alert `_id` as `dedupKey`

**Auto-resolve:** Extend `alertLifecycle.resolveAlert` to call `ctx.scheduler.runAfter(0, internal.pagerduty.resolveIncident, { dedupKey: args.alertId })`. This closes the PagerDuty incident when the operator resolves in the dashboard.

### Settings UI Changes
- New component: `PagerDutyConfig.tsx` — routing key input (masked), severity filter, enabled toggle, test button
- Test button sends a trigger + immediate resolve to verify connectivity

### Data Flow

```
alerts.evaluateInternal → createIfNew (critical alert)
  → schedule pagerduty.triggerIncident
    → POST events.pagerduty.com/v2/enqueue { event_action: "trigger" }
    → log pagerdutyDeliveryLog

alertLifecycle.resolveAlert (operator action)
  → schedule pagerduty.resolveIncident
    → POST events.pagerduty.com/v2/enqueue { event_action: "resolve", dedup_key }
    → update pagerdutyDeliveryLog
```

---

## Feature 6: GitHub Actions Trigger from Alert Rules (EXT-03)

### What it is
When an alert rule fires, trigger a GitHub Actions workflow via the `workflow_dispatch` API. This enables auto-remediation: "if container is down, trigger restart-container.yml".

This is distinct from the existing `githubWorkflowRuns` table which only receives passive status reports. EXT-03 adds active triggering from CodePulse outward.

### GitHub Actions API
- Endpoint: `POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`
- Auth: `Authorization: Bearer {github_pat}` — requires `workflow` scope PAT
- Payload: `{ ref: "main", inputs: { alert_id, severity, source } }`
- Response: 204 No Content on success

The `workflow_id` can be the workflow file name (e.g., `restart-container.yml`) or the numeric ID.

### Schema Change: `alertRuleCustom` + New Table

The trigger configuration must be associated with a rule. Two options:

**Option A (preferred):** Add `githubTrigger` optional field to `alertRuleCustom`:
```typescript
// In alertRuleCustom table, add:
githubTrigger: v.optional(v.object({
  repo: v.string(),           // "owner/repo"
  workflowId: v.string(),     // "restart-container.yml"
  ref: v.optional(v.string()), // default: "main"
  enabled: v.boolean(),
})),
```

This keeps trigger config colocated with the rule that fires it.

**Option B:** Separate `alertRuleTriggers` table. More extensible if multiple trigger types are added, but requires a join.

**Recommendation:** Option A for v5.0. Extend to Option B in a future milestone if trigger types proliferate.

### New Convex File: `convex/githubTrigger.ts`

```typescript
// Config in agentConfigs:
//   "github-pat" → string (PAT with workflow scope)

export const dispatchWorkflow = internalAction({
  args: {
    alertId: v.id("alerts"),
    repo: v.string(),
    workflowId: v.string(),
    ref: v.string(),
  },
  handler: async (ctx, args) => {
    // Load PAT from agentConfigs
    // POST github.com/repos/{repo}/actions/workflows/{workflowId}/dispatches
    // Record in githubTriggerLog
  }
});

export const setGitHubPAT = mutation({ ... }); // requires auth
export const getGitHubPAT = query({ ... });     // returns only masked value
```

### New Convex Table: `githubTriggerLog`

```typescript
githubTriggerLog: defineTable({
  alertId: v.string(),
  ruleId: v.string(),
  repo: v.string(),
  workflowId: v.string(),
  ref: v.string(),
  status: v.string(),       // "dispatched" | "failed" | "skipped"
  statusCode: v.optional(v.float64()),
  errorMessage: v.optional(v.string()),
  triggeredAt: v.float64(),
})
  .index("by_alertId", ["alertId"])
  .index("by_triggeredAt", ["triggeredAt"])
```

### Trigger Integration

In `evaluateInternal` (existing), after `createIfNew`:
```typescript
// For custom rules that have githubTrigger configured:
if (triggered && customRule.githubTrigger?.enabled) {
  await ctx.scheduler.runAfter(0, internal.githubTrigger.dispatchWorkflow, {
    alertId: newAlertId,
    repo: customRule.githubTrigger.repo,
    workflowId: customRule.githubTrigger.workflowId,
    ref: customRule.githubTrigger.ref ?? "main",
  });
}
```

### UI Changes
- `AlertRuleForm.tsx` (existing component) — add a "GitHub Actions Trigger" collapsible section with repo, workflow file, ref inputs and enabled toggle
- `GithubActionsPanel.tsx` (existing) — add a "Triggered by Alert" badge when a run appears in `githubTriggerLog` with matching runId
- `ConditionBuilder.tsx` (existing) — no change needed
- New Settings section: GitHub PAT configuration

### Data Flow

```
alertRuleCustom (with githubTrigger config)
  ↓
evaluateInternal fires (2min cron)
  → createIfNew → newAlertId
  → schedule githubTrigger.dispatchWorkflow
    → POST github API
    → insert githubTriggerLog { status: "dispatched" }

Ástríðr GitHub Actions workflow (separate repo)
  → runs remediation steps
  → POST /runtime-ingest { eventType: "github_workflow_run" } (existing pattern)
    → insert githubWorkflowRuns (existing)

UI
  GithubActionsPanel shows run
  githubTriggerLog links run back to the alert that triggered it
```

---

## Component Hierarchy Summary

### New Components

| Component | File | Page Placement | Data Source |
|-----------|------|----------------|-------------|
| `CallGraphViz` | `src/components/CallGraphViz.tsx` | Infrastructure or new CallGraph page | `callGraph.getGraph` query |
| `CallGraphNode` | `src/components/CallGraphNode.tsx` | Used by CallGraphViz | props from parent |
| `ContextWindowAnimator` | `src/components/ContextWindowAnimator.tsx` | LiveRun, SessionDetail | `useContextHistory` + WS |
| `TokenSunburst` | `src/components/TokenSunburst.tsx` | Analytics page | `tokenBreakdown.bySession` |
| `EmailDeliveryConfig` | `src/components/EmailDeliveryConfig.tsx` | Settings page | `emailDelivery` queries |
| `PagerDutyConfig` | `src/components/PagerDutyConfig.tsx` | Settings page | `pagerduty` queries |

### Modified Components

| Component | Change |
|-----------|--------|
| `AlertRuleForm.tsx` | Add GitHub Actions Trigger section (collapsible) |
| `GithubActionsPanel.tsx` | Show "triggered by alert" badge when triggered |
| `Settings.tsx` | Add Email Delivery + PagerDuty + GitHub PAT sections |
| `LiveRun.tsx` | Embed ContextWindowAnimator for active session |
| `SessionDetail.tsx` | Static context window timeline using ContextWindowAnimator |
| `Analytics.tsx` | Add TokenSunburst widget |

### New Convex Files

| File | Purpose |
|------|---------|
| `convex/callGraph.ts` | Call graph queries + edge upsert |
| `convex/emailDelivery.ts` | Email send action + config |
| `convex/pagerduty.ts` | PagerDuty trigger/resolve actions + config |
| `convex/githubTrigger.ts` | GitHub workflow dispatch action + config |

### Modified Convex Files

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `callGraphEdges`, `emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog`; add `agentId`/`toolName` to `llmMetrics`; add `githubTrigger` to `alertRuleCustom` |
| `convex/briefings.ts` | Schedule email delivery after digest generation |
| `convex/alerts.ts` | Schedule PagerDuty + GitHub trigger after createIfNew |
| `convex/alertLifecycle.ts` | Schedule PagerDuty resolve on alert resolution |
| `convex/ingest.ts` | Call `callGraph.upsertEdge` on integration_call events |
| `convex/crons.ts` | No structural changes needed |

---

## New Convex Tables Summary

| Table | Purpose | Approx Rows/Day |
|-------|---------|-----------------|
| `callGraphEdges` | Materialized integration dependency graph | Low (upsert, not insert) |
| `emailDeliveryLog` | Email send audit trail | 1-10 |
| `pagerdutyDeliveryLog` | PagerDuty incident audit trail | 0-5 |
| `githubTriggerLog` | GitHub dispatch audit trail | 0-10 |

Total schema additions: 4 new tables, 3 modified tables.

---

## Data Flow Diagrams

### Visualization Features (read path)

```
Ástríðr runtime
    │
    ├── POST /runtime-ingest { integration_call }
    │       → integrationCalls (existing)
    │       → callGraph.upsertEdge → callGraphEdges (new)
    │
    ├── POST /runtime-ingest { context_snapshot }
    │       → contextSnapshots (existing)
    │
    └── POST /runtime-ingest { llm_metric, agentId }
            → llmMetrics (existing, + agentId field)

React UI (read path)
    ├── CallGraphViz ← useQuery(callGraph.getGraph)
    ├── ContextWindowAnimator ← useQuery(contextSnapshots.historyBySession)
    └── TokenSunburst ← useQuery(tokenBreakdown.bySession)
```

### Integration Features (write/delivery path)

```
alerts.evaluateInternal (cron, 2min)
    │
    └── createIfNew (severity: critical)
            │
            ├── scheduler → webhookDelivery.sendAlertWebhook (existing → Discord/Slack)
            ├── scheduler → emailDelivery.sendAlertEmail (new → Resend/SendGrid)
            ├── scheduler → pagerduty.triggerIncident (new → PagerDuty Events API)
            └── if customRule.githubTrigger → scheduler → githubTrigger.dispatchWorkflow

alertLifecycle.resolveAlert (operator action)
    └── scheduler → pagerduty.resolveIncident (new → PagerDuty Events API)

briefings.generateDailyDigestAction (cron, 06:00 UTC)
    └── after storeBriefing → scheduler → emailDelivery.sendDailyDigestEmail (new)
```

---

## Build Order

Dependencies determine the order. Schema must be migrated before any feature that uses new tables. Integration features are independent of each other after the shared schema migration.

### Phase A: Schema Foundation (prerequisite for all)
1. Add `agentId` and `toolName` to `llmMetrics` in `schema.ts`
2. Add `githubTrigger` to `alertRuleCustom` in `schema.ts`
3. Add all 4 new tables (`callGraphEdges`, `emailDeliveryLog`, `pagerdutyDeliveryLog`, `githubTriggerLog`) to `schema.ts`
4. Run `npx convex dev` to push schema — this is a non-breaking additive migration

### Phase B: Visualization (parallel after Phase A)

**B1: Context Window Animation (VIZ-02) — Build First**
- Rationale: No new Convex tables, no schema changes, purely UI. Fastest to complete and validates the `motion` animation approach before VIZ-01/VIZ-03.
- Components: `ContextWindowAnimator`
- Hooks: extend existing `useContextSnapshots.ts`

**B2: Token Sunburst (VIZ-03)**
- Depends on: Phase A (`agentId` in `llmMetrics`)
- New queries: `tokenBreakdown.ts`
- Components: `TokenSunburst`
- Extends `Analytics.tsx`

**B3: Call Graph Visualization (VIZ-01) — Build Last Among Viz**
- Depends on: Phase A (`callGraphEdges` table), ingest path modification
- New: `callGraph.ts`, `CallGraphViz`, `CallGraphNode`
- Most complex of the three viz features due to materialization logic

### Phase C: Integration Features (parallel after Phase A)

**C1: Email Digest (EXT-01)**
- Depends on: Phase A (`emailDeliveryLog` table)
- Rationale: Build first among integrations because it has the highest operator value (daily digest) and the API is simplest (no two-way handshake)
- New: `emailDelivery.ts`, `EmailDeliveryConfig`
- Modifies: `briefings.ts`, `Settings.tsx`

**C2: PagerDuty (EXT-02)**
- Depends on: Phase A (`pagerdutyDeliveryLog` table)
- New: `pagerduty.ts`, `PagerDutyConfig`
- Modifies: `alerts.ts`, `alertLifecycle.ts`, `Settings.tsx`
- Note: Two-way (trigger + resolve) makes this more complex than email

**C3: GitHub Actions Trigger (EXT-03)**
- Depends on: Phase A (`githubTriggerLog` table, `githubTrigger` field in `alertRuleCustom`)
- New: `githubTrigger.ts`
- Modifies: `alerts.ts`, `AlertRuleForm.tsx`, `GithubActionsPanel.tsx`, `Settings.tsx`
- Note: UI changes to `AlertRuleForm` require careful handling of the existing form structure

### Recommended Phase Grouping for GSD Roadmap

```
Phase N:   Schema Foundation (A1-A4) — 1 phase, ~half day
Phase N+1: Context Window Animation (B1) — 1 phase, 1 day
Phase N+2: Token Sunburst (B2) — 1 phase, 1-2 days
Phase N+3: Email Digest Delivery (C1) — 1 phase, 1-2 days
Phase N+4: Call Graph Visualization (B3) — 1 phase, 2-3 days (most complex viz)
Phase N+5: PagerDuty Integration (C2) — 1 phase, 1-2 days
Phase N+6: GitHub Actions Trigger (C3) — 1 phase, 1-2 days
```

B3 and C1/C2/C3 can be developed in parallel by separate work streams after Phase N (schema), but sequentially is safer given single-developer context.

---

## Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Call graph as materialized `callGraphEdges` (not derived at query time) | Avoids expensive multi-table joins on each dashboard refresh. Convex queries on 40+ tables already push complexity |
| Resend (not SMTP/nodemailer) for email | Convex actions are serverless — no persistent SMTP connection. HTTP API is the only viable approach. Resend has the simplest API of the HTTP providers |
| PagerDuty Events API v2 (not REST API) | Events API is stateless, designed for monitoring integrations. REST API requires account-scoped auth and is overkill for alert delivery |
| Add `agentId` to `llmMetrics` (schema change) vs. derive at query time | Derivation would require time-overlap join between `llmMetrics` and `agents` — unreliable and expensive. Schema change is the correct fix |
| `githubTrigger` embedded in `alertRuleCustom` (not a separate table) | Single join point, simpler for v5.0. Separate table only needed if multiple trigger types per rule become necessary |
| Use `motion` for ContextWindowAnimator (not CSS transitions) | CSS transitions can't animate from unknown current value to new value reactively. Motion's `animate` API handles value-driven animation correctly |
| Custom SVG sunburst (not recharts PieChart) | Recharts PieChart cannot natively represent concentric rings with independent datasets. Custom SVG arcs are ~50 lines and match the existing Paperclip aesthetic better |

---

## Configuration Storage Pattern

All new integrations follow the existing pattern: config stored in `agentConfigs` table with structured keys.

```
"email-provider"              → { provider: "resend", apiKey: "re_..." }
"email-to-address"            → "operator@example.com"
"email-alert-severities"      → ["critical", "error"]
"pagerduty-routing-key"       → "abc123def456..."
"pagerduty-enabled-severities" → ["critical"]
"github-pat"                  → "ghp_..."
```

**Security:** API keys are never returned from public queries. The pattern already established in `briefings.ts` (getLLMConfig omits apiKey, getLLMConfigInternal includes it) must be replicated for all new configs.

---

## Sources

All findings are based on direct code inspection of the existing CodePulse codebase at `C:\Users\mandr\codepulse`. No external documentation lookup was required for integration analysis — all integration points were derived from reading existing `convex/schema.ts`, `convex/webhookDelivery.ts`, `convex/alerts.ts`, `convex/briefings.ts`, `convex/crons.ts`, `src/contexts/AstridrWSContext.tsx`, `src/components/AgentTopology.tsx`, and `package.json`.

External API documentation referenced from training data (HIGH confidence, stable APIs):
- PagerDuty Events API v2: `https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview`
- GitHub Actions workflow dispatch: `https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event`
- Resend API: `https://resend.com/docs/api-reference/emails/send-email`
- React Flow (@xyflow/react v12): version confirmed from `package.json`
