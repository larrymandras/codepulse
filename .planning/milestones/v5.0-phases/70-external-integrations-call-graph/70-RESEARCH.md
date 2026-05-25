# Phase 70: External Integrations & Call Graph — Research

**Researched:** 2026-05-24
**Domain:** Resend email delivery, PagerDuty Events API v2, dagre SVG call graph visualization
**Confidence:** HIGH (schema, delivery log, and graph infrastructure already in-repo; API patterns verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Convex cron job only — daily and/or weekly schedule fires `generateDailyDigestAction`, then sends via Resend. No manual trigger button.
- **D-02:** Reuse existing daily digest content as-is — wrap `generateDailyDigestAction` output in an HTML email template.
- **D-03:** Email config lives on the existing Settings page — new "Email Digest" section under Notification Channels. Fields: recipient email (`profileConfigs.emailAddress`), schedule (daily/weekly/both), enabled toggle.
- **D-04:** Use React Email (`@react-email/components`) for type-safe, component-based HTML email templates.
- **D-05:** `dedup_key = 'codepulse-{alertRuleId}'` — one incident per rule. Re-trigger deduplicates via PagerDuty. Resolve uses same key to close.
- **D-06:** Auto-map severity from alert rule: critical→critical, warning→warning, info→info. Operator can override per-rule in `pagerdutyConfig.severity`.
- **D-07:** Auto-resolve on alert clear — when evaluation cron determines condition returned to normal, send 'resolve' event with same dedup_key. No manual resolve from CodePulse.
- **D-08:** Per-rule config only — routing key set in alert rule editor via existing `pagerdutyConfig` field on `alertRuleCustom`. No global PagerDuty Settings entry.
- **D-09:** dagre + custom SVG rendering. Dagre for deterministic top-down layout (already installed). Custom SVG nodes/edges rendered by React. No React Flow or force-directed layout.
- **D-10:** Graph lives on the Infrastructure page as a new section alongside GithubActionsPanel and ProviderHealthPanel.
- **D-11:** Convex reactive query (`useQuery` on `callGraphEdges`) for real-time updates. Standard CodePulse pattern.
- **D-12:** Agent nodes (larger) + tool nodes (smaller) with edges = call dependencies. Errored nodes turn red. Edges on error propagation path highlighted red. Color-based status (healthy=default, errored=red, pending=muted).
- **D-13:** Add collapsible "PagerDuty" and "Email Digest" sections to the existing AlertRuleForm alongside Discord/Slack config. Toggle on/off per delivery channel, show config fields when enabled.
- **D-14:** Settings page groups Email Digest config under existing "Notification Channels" section. PagerDuty stays per-rule only. Delivery logs visible in a new "Delivery History" tab.
- **D-15:** `RESEND_API_KEY` as Convex environment variable. Convex actions read from `process.env`. No secrets in code or Convex tables. PagerDuty routing key stored per-rule in `pagerdutyConfig.routingKey` field.

### Claude's Discretion
- React Email template structure and styling (match Paperclip aesthetic where possible)
- PagerDuty Events API v2 payload structure details (summary, source, component fields)
- Call graph SVG node sizing, spacing, and animation approach
- Test structure and Wave 0 stub design
- Delivery History tab layout and filtering

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXT-01 | Email digest delivers scheduled daily/weekly HTML summary (alerts, cost, tokens, anomalies, briefing narrative) to configurable recipient via Resend | Resend SDK v6.12.3 verified on npm; React Email render pattern verified; Convex cron + action pattern in-repo |
| EXT-02 | PagerDuty integration triggers/resolves incidents via Events API v2 with stable dedup_key, per-rule toggle, severity mapping, and routing key configuration | PagerDuty Events API v2 endpoint and payload structure researched; `pagerdutyConfigValidator` and `pagerdutyDeliveryLog` already in schema |
| VIZ-01 | Call graph displays directed agent/tool dependency graph with node state coloring, error propagation path highlighting, and dagre top-down auto-layout | dagre v0.8.5 already installed; `callGraphEdges` table and CRUD fully built; layout algorithm pattern verified |
</phase_requirements>

---

## Summary

Phase 70 completes three fully schema-ready features. All three delivery log tables (`emailDeliveryLog`, `pagerdutyDeliveryLog`) are in `convex/schema.ts`. The `callGraphEdges` table with upsert/list queries is production-ready. The `pagerdutyConfigValidator` is defined in `convex/alertRuleCustom.ts`. The digest content source (`generateDailyDigestAction` in `convex/briefings.ts`) is live. The only missing pieces are: (1) the Resend action + email template, (2) the PagerDuty internalAction wired into alert evaluation, and (3) the SVG graph component.

The phase requires two new npm packages (`resend` and `@react-email/components`/`@react-email/render`), both not yet installed. dagre (v0.8.5) is already a listed dependency in `package.json`. The existing webhook delivery pattern in `convex/webhookDelivery.ts` is the direct model for both the Resend action and the PagerDuty action — copy the `sendAlertWebhook` internalAction structure.

**Primary recommendation:** Wire all three features as Convex internalActions following the `sendAlertWebhook` pattern. Install Resend and React Email packages before Wave 1. No architectural surprises — the schema was designed for this phase.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Email digest generation | Backend (Convex internalAction) | — | `generateDailyDigestAction` already runs server-side; Resend SDK call belongs in Convex action, not frontend |
| Email schedule config | Frontend (Settings page) | Backend (agentConfigs store) | Operator sets recipient/schedule; stored in `agentConfigs` via Convex mutation |
| Email delivery logging | Backend (Convex mutation) | — | `insertEmailLog` already exists in `convex/deliveryLogs.ts` |
| PagerDuty trigger/resolve | Backend (Convex internalAction) | — | External API call; routing key is backend config, not exposed to frontend |
| PagerDuty per-rule config | Frontend (AlertRuleForm) | Backend (alertRuleCustom table) | Operator enables per rule; stored in existing `pagerdutyConfig` field |
| PagerDuty delivery logging | Backend (Convex mutation) | — | `insertPagerdutyLog` already exists |
| Call graph layout | Frontend (React component) | — | dagre runs in browser; SVG rendered by React; no server-side layout needed |
| Call graph data | Backend (Convex query) | Frontend (useQuery) | `callGraphEdges.listEdges` already exists; React subscribes via `useQuery` |
| Delivery History tab | Frontend (Settings page) | Backend (deliveryLogs queries) | Display-only; queries existing `listEmailLogs` / `listPagerdutyLogs` |

---

## Standard Stack

### Core (new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.12.3 | Send HTML email from Convex action | Official Resend SDK; `{ data, error }` pattern; no exceptions thrown; D-15 locks this choice |
| `@react-email/components` | 1.0.12 | Unstyled, email-client-safe React components for HTML templates | Decision D-04; type-safe; cross-client compatible (Outlook, Gmail) |
| `@react-email/render` | 2.0.8 | Renders React Email component to HTML string for Resend `html:` field | Required companion to `@react-email/components` in server contexts |

[VERIFIED: npm registry — versions confirmed via `npm view` 2026-05-24]

### Already Installed (no action needed)

| Library | Version | Purpose |
|---------|---------|---------|
| `dagre` | 0.8.5 | Deterministic hierarchical graph layout (TB top-down) |
| `@types/dagre` | 0.7.54 | TypeScript types for dagre |

[VERIFIED: `package.json` in-repo]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom SVG rendering | `@xyflow/react` (already installed as `@xyflow/react` v12.10.1) | React Flow is available but D-09 explicitly rejects it for the call graph — custom SVG is the decision |
| `@react-email/render` | Plain HTML string construction | React Email guarantees cross-client compatibility; plain strings require manual MSO/Outlook table hacks |

**Installation:**
```bash
npm install resend @react-email/components @react-email/render
```

---

## Architecture Patterns

### System Architecture Diagram

```
[Convex Cron: daily at 06:00 UTC]
       |
       v
[generateDailyDigestAction]  ──reads──>  [briefings table + alerts + llmMetrics]
       |
       v
[sendEmailDigestAction (new internalAction)]
       |
       |──render──>  [DigestEmailTemplate (React Email component)]
       |                      |
       |                      v (HTML string via @react-email/render)
       |──send──>    [Resend SDK: resend.emails.send()]
       |
       v
[insertEmailLog mutation]  ──writes──>  [emailDeliveryLog table]


[evaluateInternal cron (every 2 min)]
       |
       v  (custom rule triggered)
[createIfNew → schedules sendAlertWebhook]
       |
       +──also schedules──>  [sendPagerdutyAlert (new internalAction)]
                                    |
                                    |──POST──>  [https://events.pagerduty.com/v2/enqueue]
                                    |           event_action: "trigger"
                                    |           dedup_key: "codepulse-{alertRuleId}"
                                    |
                                    v
                             [insertPagerdutyLog mutation]

[evaluateInternal: alert auto-resolves after 6h OR condition clears]
       |
       v
[sendPagerdutyResolve (new internalAction)]
       |──POST──>  [https://events.pagerduty.com/v2/enqueue]
       |           event_action: "resolve"
       |           dedup_key: "codepulse-{alertRuleId}"  (same key)
       |
       v
[insertPagerdutyLog mutation]


[React: Infrastructure page]
       |
       v
[useQuery(api.callGraphEdges.listEdges)]  ──subscribes──>  [callGraphEdges table]
       |
       v  (real-time data)
[CallGraphPanel component]
       |──dagre layout──>  [node positions computed]
       |──SVG render──>    [<svg> with agent nodes, tool nodes, edges]
                           [node color = status: healthy=indigo, errored=red, pending=gray]
                           [error path edges = red stroke]
```

### Recommended File Structure

```
convex/
├── emailDigest.ts         # new: sendEmailDigestAction (internalAction), email config queries/mutations
├── pagerdutyDelivery.ts   # new: sendPagerdutyAlert + sendPagerdutyResolve (internalActions)
├── deliveryLogs.ts        # existing — no changes
├── callGraphEdges.ts      # existing — no changes
├── crons.ts               # add email digest cron entry
└── alerts.ts              # add pagerdutyConfig check in evaluateInternal custom rule path

src/
├── components/
│   ├── CallGraphPanel.tsx              # new: SVG graph with dagre layout
│   ├── EmailDigestSettings.tsx         # new: recipient, schedule, enabled toggle
│   ├── DeliveryHistoryTab.tsx          # new: list email + PagerDuty delivery log entries
│   └── AlertRuleForm.tsx               # edit: add PagerDuty collapsible section
├── pages/
│   ├── Infrastructure.tsx              # edit: import + render <CallGraphPanel />
│   └── Settings.tsx                    # edit: add EmailDigestSettings + DeliveryHistoryTab
└── email/
    └── DigestEmailTemplate.tsx         # new: React Email component (JSX, .tsx)
```

### Pattern 1: Resend internalAction (Email Digest)

**What:** Convex internalAction that renders a React Email template to HTML and sends via Resend SDK.
**When to use:** All outbound email from Convex — never call Resend from frontend.

```typescript
// Source: Resend docs (verified resend.com/docs/send-with-nodejs) + React Email render docs
import { internalAction } from "./_generated/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { DigestEmailTemplate } from "../src/email/DigestEmailTemplate";

export const sendEmailDigest = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      // Log failure, do not throw — digest must not break the cron
      await ctx.runMutation(internal.deliveryLogs.insertEmailLog, {
        alertId: /* sentinel */ ...,
        ruleId: "digest",
        attempt: 1,
        status: "failed",
        errorMessage: "RESEND_API_KEY not configured",
        sentAt: Date.now() / 1000,
      });
      return;
    }

    const resend = new Resend(apiKey);
    const digestData = await ctx.runQuery(internal.briefings.getDailyDigestDataInternal, { dayStart });
    const html = await render(<DigestEmailTemplate data={digestData} />);

    const { data, error } = await resend.emails.send({
      from: "CodePulse <alerts@yourdomain.com>",
      to: [recipientEmail],
      subject: `CodePulse Daily Digest — ${date}`,
      html,
    });

    await ctx.runMutation(internal.deliveryLogs.insertEmailLog, {
      alertId: /* sentinel alert id */ ...,
      ruleId: "digest",
      attempt: 1,
      status: error ? "failed" : "success",
      errorMessage: error?.message,
      recipient: recipientEmail,
      subject: `CodePulse Daily Digest — ${date}`,
      sentAt: Date.now() / 1000,
    });
  },
});
```

[VERIFIED: Resend SDK `{ data, error }` pattern — resend.com/docs; React Email `render()` async — react.email/docs/utilities/render]

**Critical note:** The `emailDeliveryLog` schema requires an `alertId` of type `v.id("alerts")`. For digest emails (not alert-triggered), a sentinel alert record approach or a schema relaxation to `v.optional(v.id("alerts"))` is needed. The planner must resolve this — the current `insertEmailLog` mutation signature requires a real alert ID.

### Pattern 2: PagerDuty Events API v2 (Trigger + Resolve)

**What:** Direct `fetch` POST to `https://events.pagerduty.com/v2/enqueue`. No SDK needed.
**When to use:** When an alert rule with `pagerdutyConfig.enabled = true` fires or clears.

```typescript
// Source: PagerDuty Events API v2 (developer.pagerduty.com/docs/events-api-v2/trigger-events/)
const PAGERDUTY_ENDPOINT = "https://events.pagerduty.com/v2/enqueue";

// TRIGGER
const triggerPayload = {
  routing_key: rule.pagerdutyConfig.routingKey,
  event_action: "trigger",
  dedup_key: `codepulse-${rule._id}`,   // D-05: stable per-rule key
  payload: {
    summary: alert.message.slice(0, 1024),
    source: "CodePulse",
    severity: rule.pagerdutyConfig.severity ?? rule.severity,  // D-06: auto-map, allow override
    timestamp: new Date(alert.createdAt * 1000).toISOString(),
    component: rule.name,
    group: "codepulse-alerts",
    custom_details: {
      alertId: alert._id,
      ruleId: rule._id,
    },
  },
  client: "CodePulse",
  client_url: "https://codepulse.app/alerts",
};

// RESOLVE (same structure, different event_action)
const resolvePayload = {
  routing_key: rule.pagerdutyConfig.routingKey,
  event_action: "resolve",
  dedup_key: `codepulse-${rule._id}`,  // same key closes the incident
};

const res = await fetch(PAGERDUTY_ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(triggerPayload),
});
// Response: { status: "success", message: "Event processed", dedup_key: "..." }
// HTTP 202 = accepted, 400 = bad payload, 429 = rate limited
```

[VERIFIED: PagerDuty Events API v2 endpoint and payload structure — developer.pagerduty.com/docs/events-api-v2/trigger-events/ via WebSearch cross-reference]

**Severity mapping:** PagerDuty Events API v2 accepts: `critical`, `error`, `warning`, `info`. CodePulse alert severities are `critical`, `error`, `warning`, `info` — direct 1:1 map. D-06 decision maps critical→critical, warning→warning, info→info; note `error` is also valid.

### Pattern 3: dagre Layout for Custom SVG

**What:** Pure computation pass — call dagre layout, extract `(x, y)` for each node, render with React SVG.
**When to use:** Any directed graph render needing deterministic hierarchical layout.

```typescript
// Source: dagrejs/dagre wiki + React Flow dagre example (verified)
import dagre from "dagre";

function layoutGraph(edges: CallGraphEdge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });

  // Collect unique agent and tool nodes from edges
  const agentIds = new Set(edges.map(e => e.agentId));
  const toolNames = new Set(edges.map(e => e.toolName));

  for (const agentId of agentIds) {
    g.setNode(`agent:${agentId}`, { width: 140, height: 40, type: "agent" });
  }
  for (const toolName of toolNames) {
    g.setNode(`tool:${toolName}`, { width: 100, height: 32, type: "tool" });
  }
  for (const edge of edges) {
    g.setEdge(`agent:${edge.agentId}`, `tool:${edge.toolName}`, { status: edge.status });
  }

  dagre.layout(g);

  return g; // call g.node(id) for {x, y, width, height}, g.edges() for edge list
}
```

[VERIFIED: dagre v0.8.5 installed in package.json; dagre.graphlib.Graph API from dagrejs/dagre wiki]

**Error propagation path:** An errored node = any edge with `status: "errored"`. Color that node red. Also color red any edges touching errored nodes (highlight propagation path). This is a pure React state computation — no extra data needed.

### Pattern 4: React Email Template (Server-Side Render)

```typescript
// src/email/DigestEmailTemplate.tsx
// Source: @react-email/components v1.0.12 (npm verified)
import {
  Html, Head, Body, Container, Section, Text, Heading, Hr, Row, Column
} from "@react-email/components";

interface DigestEmailTemplateProps {
  date: string;
  sessions: number;
  totalCostUsd: number;
  anomalyCount: number;
  activeAlerts: Array<{ severity: string; message: string; source: string }>;
  briefingNarrative: string;
}

export function DigestEmailTemplate({ date, sessions, totalCostUsd, anomalyCount, activeAlerts, briefingNarrative }: DigestEmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#111827", fontFamily: "Geist, monospace" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "24px" }}>
          <Heading style={{ color: "#e5e7eb", fontFamily: "Cinzel, serif" }}>
            CodePulse Daily Digest — {date}
          </Heading>
          <Hr style={{ borderColor: "#374151" }} />
          <Section>
            <Row>
              <Column><Text style={{ color: "#9ca3af" }}>Sessions</Text><Text style={{ color: "#f9fafb" }}>{sessions}</Text></Column>
              <Column><Text style={{ color: "#9ca3af" }}>Cost</Text><Text style={{ color: "#f9fafb" }}>${totalCostUsd.toFixed(4)}</Text></Column>
              <Column><Text style={{ color: "#9ca3af" }}>Anomalies</Text><Text style={{ color: anomalyCount > 0 ? "#f87171" : "#f9fafb" }}>{anomalyCount}</Text></Column>
            </Row>
          </Section>
          {/* active alerts, briefing narrative sections */}
        </Container>
      </Body>
    </Html>
  );
}
```

**Rendering to string in Convex action:**
```typescript
import { render } from "@react-email/render";
const html = await render(<DigestEmailTemplate {...data} />);
// html is a complete HTML string — pass to resend.emails.send({ html })
```

[VERIFIED: `@react-email/render` v2.0.8 on npm; render function is async, returns Promise\<string\>]

**Note on Convex + JSX:** Convex actions run in a Node.js-like environment but compile via esbuild. React Email components in `src/email/` (frontend source directory) need to be importable from Convex actions. The import path `../src/email/DigestEmailTemplate` from `convex/emailDigest.ts` requires that the `src/` directory is in the TypeScript path resolution for Convex. Check `convex/tsconfig.json` — may need `"include": ["../src/email"]` or move the template to `convex/emailTemplates/`. This is a likely Wave 0 task.

### Pattern 5: Convex Environment Variable Access

```typescript
// In any Convex action/mutation/query
const apiKey = process.env.RESEND_API_KEY;

// Set via CLI:
// npx convex env set RESEND_API_KEY "re_xxxx"
```

[VERIFIED: Convex docs — docs.convex.dev/production/environment-variables; `process.env` is the confirmed pattern for Convex actions]

### Anti-Patterns to Avoid

- **Calling Resend from the React frontend:** Exposes API key in browser bundle. All Resend calls must go through Convex internalActions.
- **Storing PagerDuty routing key as a Convex env var:** Per D-08, routing key is per-rule config stored in `pagerdutyConfig.routingKey`. It is not a secret — it's a service routing identifier. Only `RESEND_API_KEY` is a Convex env var.
- **Using React Flow for the call graph:** D-09 explicitly rejects this. dagre + custom SVG is the decision.
- **`dagre.graphlib.Graph` as a class instance held in module scope:** Dagre mutates the graph object. Create a new instance per layout call — don't share between renders.
- **Importing React Email components in a Convex function without JSX transform:** Convex backend uses esbuild. The template must be in a file that goes through Vite's React transform, OR the template must use `React.createElement` directly. Recommended: put the template under `src/` and verify the Convex tsconfig can resolve it. If not, move to `convex/emailTemplates/` and add `"jsx": "react-jsx"` to Convex tsconfig.
- **Forgetting the `emailDeliveryLog` schema constraint:** `alertId` is typed as `v.id("alerts")` — required. Digest emails are NOT alert-triggered. The schema either needs a migration to make `alertId` optional, or a sentinel strategy. Confirm in Wave 0.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email-client-safe HTML | Custom HTML string builder | `@react-email/components` | MSO/Outlook table hacks, inline style normalization, cross-client dark mode — solved by React Email |
| HTML-from-JSX serialization | `ReactDOM.renderToStaticMarkup` | `@react-email/render` | react-email/render adds email-specific doctype, charset meta, client compatibility patches |
| PagerDuty client library | npm pagerduty SDK | Direct `fetch` to Events API v2 | Events API v2 is two endpoints (enqueue only). No SDK needed — payload is a plain JSON POST |

**Key insight:** Both external APIs (Resend, PagerDuty) are simple HTTP POST operations. The complexity is in the Convex wiring (trigger conditions, dedup logic, log writes), not the API calls themselves.

---

## Common Pitfalls

### Pitfall 1: emailDeliveryLog alertId Type Mismatch
**What goes wrong:** `insertEmailLog` requires `alertId: v.id("alerts")`. A digest email has no associated alert.
**Why it happens:** The schema was designed for alert-triggered email delivery. Digest is a different code path.
**How to avoid:** In Wave 0, decide: (a) add `v.optional()` wrapper to `alertId` in schema + update mutation, or (b) use a sentinel fake ID. Option (a) is cleaner and requires a schema migration. This must be resolved before the digest action can log to `emailDeliveryLog`.
**Warning signs:** TypeScript type error when calling `insertEmailLog` without a valid `alertId`.

### Pitfall 2: PagerDuty dedup_key Re-trigger vs. New Incident
**What goes wrong:** Sending a trigger event when an incident is already open for that `dedup_key` updates the existing incident rather than creating a new one. This is correct behavior — but the delivery log status must say "retriggered" not "success (new incident)" to avoid confusion.
**Why it happens:** PagerDuty's deduplication is explicit: same `dedup_key` = same incident.
**How to avoid:** Per D-05, this is desired behavior. The `pagerdutyDeliveryLog.status` field supports `"success" | "failed" | "resolved"`. Log trigger events as `"success"` regardless — the dedup is correct behavior.
**Warning signs:** Multiple identical entries in pagerdutyDeliveryLog for same rule — expected, not a bug.

### Pitfall 3: React Email JSX Import Resolution in Convex
**What goes wrong:** Convex actions are compiled by esbuild with Convex's own tsconfig. `DigestEmailTemplate.tsx` in `src/email/` may not be resolvable from `convex/emailDigest.ts` without path configuration.
**Why it happens:** Convex backend has a separate TypeScript compilation context from the Vite frontend.
**How to avoid:** Either (a) place `DigestEmailTemplate.tsx` under `convex/emailTemplates/` and ensure `convex/tsconfig.json` has `"jsx": "react-jsx"`, or (b) use a non-JSX `.ts` file that returns an HTML string and imports from `@react-email/render`. Check `convex/tsconfig.json` before implementing.
**Warning signs:** Import error or "Cannot use JSX" in Convex compilation output.

### Pitfall 4: dagre Graph Instance Mutation
**What goes wrong:** Reusing a module-level `dagre.graphlib.Graph` instance across renders causes stale node positions when the edge set changes.
**Why it happens:** dagre mutates the graph object in-place. Old nodes remain even after removing them from the input.
**How to avoid:** Create a new `dagre.graphlib.Graph()` inside the layout function, not at module scope.
**Warning signs:** Nodes appear at wrong positions after a live update arrives.

### Pitfall 5: Missing RESEND_API_KEY in Convex Environment
**What goes wrong:** `process.env.RESEND_API_KEY` is `undefined` in deployed Convex — email sends silently fail or throw.
**Why it happens:** Convex env vars must be set explicitly via dashboard or `npx convex env set`. They don't inherit from local `.env` files.
**How to avoid:** Guard: `if (!apiKey) { log failure, return; }`. Document the required env var in Wave 0 setup tasks.
**Warning signs:** EmailDeliveryLog rows with `status: "failed"` and `errorMessage: "RESEND_API_KEY not configured"`.

### Pitfall 6: PagerDuty 400 on Trigger — Missing Required Fields
**What goes wrong:** POST to `/v2/enqueue` returns HTTP 400 if `routing_key`, `event_action`, `payload.summary`, `payload.source`, or `payload.severity` are missing.
**Why it happens:** All five fields are required by the Events API v2 schema.
**How to avoid:** Validate `pagerdutyConfig.routingKey` is non-empty before firing. Check `alert.message` is non-empty for summary.
**Warning signs:** PagerDuty log entries with `status: "failed"` and HTTP 400 errorMessage.

---

## Code Examples

### Dagre Layout — Full TypeScript Function

```typescript
// Source: dagrejs/dagre v0.8.5 API (verified installed in package.json)
import dagre from "dagre";

export type GraphEdge = {
  agentId: string;
  toolName: string;
  status: "healthy" | "errored";
  callCount: number;
  errorCount: number;
};

export type LayoutNode = {
  id: string;
  type: "agent" | "tool";
  x: number;
  y: number;
  width: number;
  height: number;
  status: "healthy" | "errored";
};

export type LayoutEdge = {
  source: string;
  target: string;
  errored: boolean;
};

export function computeLayout(edges: GraphEdge[]): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80, marginx: 20, marginy: 20 });

  const agentStatus = new Map<string, "errored" | "healthy">();
  const toolStatus = new Map<string, "errored" | "healthy">();

  for (const e of edges) {
    const prev = agentStatus.get(e.agentId) ?? "healthy";
    agentStatus.set(e.agentId, e.status === "errored" ? "errored" : prev);
    const prevT = toolStatus.get(e.toolName) ?? "healthy";
    toolStatus.set(e.toolName, e.status === "errored" ? "errored" : prevT);
  }

  for (const [agentId] of agentStatus) {
    g.setNode(`agent:${agentId}`, { width: 140, height: 40 });
  }
  for (const [toolName] of toolStatus) {
    g.setNode(`tool:${toolName}`, { width: 100, height: 32 });
  }
  for (const e of edges) {
    g.setEdge(`agent:${e.agentId}`, `tool:${e.toolName}`);
  }

  dagre.layout(g);

  const nodes: LayoutNode[] = [
    ...[...agentStatus.entries()].map(([id, status]) => {
      const { x, y, width, height } = g.node(`agent:${id}`);
      return { id: `agent:${id}`, type: "agent" as const, x, y, width, height, status };
    }),
    ...[...toolStatus.entries()].map(([name, status]) => {
      const { x, y, width, height } = g.node(`tool:${name}`);
      return { id: `tool:${name}`, type: "tool" as const, x, y, width, height, status };
    }),
  ];

  const layoutEdges: LayoutEdge[] = edges.map(e => ({
    source: `agent:${e.agentId}`,
    target: `tool:${e.toolName}`,
    errored: e.status === "errored",
  }));

  return { nodes, edges: layoutEdges };
}
```

### Resend SDK — Minimal Send

```typescript
// Source: resend.com/docs/send-with-nodejs (verified)
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
const { data, error } = await resend.emails.send({
  from: "CodePulse <alerts@yourdomain.com>",
  to: [recipientEmail],
  subject: "CodePulse Daily Digest",
  html: htmlString,  // from await render(<DigestEmailTemplate {...} />)
});
// data = { id: "email-uuid" } | null
// error = ErrorResponse | null — SDK does NOT throw
```

### PagerDuty Events API v2 — Trigger + Resolve

```typescript
// Source: developer.pagerduty.com/docs/events-api-v2 (verified via WebSearch + incidenthub.cloud example)
const ENDPOINT = "https://events.pagerduty.com/v2/enqueue";

// Trigger
const res = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    routing_key: routingKey,
    event_action: "trigger",
    dedup_key: `codepulse-${alertRuleId}`,
    payload: {
      summary: alertMessage.slice(0, 1024),
      source: "CodePulse",
      severity: severity,  // "critical" | "error" | "warning" | "info"
      timestamp: new Date().toISOString(),
      component: ruleName,
      group: "codepulse-alerts",
    },
  }),
});
// HTTP 202 = success; res.json() = { status: "success", dedup_key: "...", message: "..." }

// Resolve (identical structure, event_action = "resolve", payload optional)
const resolveRes = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    routing_key: routingKey,
    event_action: "resolve",
    dedup_key: `codepulse-${alertRuleId}`,
  }),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual HTML email construction | React Email components with `@react-email/render` | ~2022 | Cross-client email HTML is generated correctly without hand-crafted MSO tables |
| PagerDuty REST API (v1/v2) for incident management | PagerDuty Events API v2 for trigger/resolve | Long-standing | Events API is simpler (no auth token, uses routing_key), designed for monitoring integrations |
| React Flow for all graph visualizations | dagre + custom SVG for deterministic operational graphs | Project decision | Avoids force-directed non-determinism in an operations context |

**Deprecated/outdated:**
- PagerDuty Events API v1 (`/generic/2010-04-15/create_event.json`): replaced by v2. Do not use.
- `resend.emails.create()`: renamed to `resend.emails.send()` in SDK v2+. Current SDK v6.12.3 uses `.send()`.

---

## Runtime State Inventory

This is a greenfield feature phase adding new Convex actions, schema relaxation, and a React component. No renames, refactors, or migrations of existing state.

**Nothing found in any runtime state category** — verified by: no existing production data in `emailDeliveryLog`, `pagerdutyDeliveryLog`, or `callGraphEdges` for Phase 70 features (all Phase 59 schema placeholders, not yet written to). No OS-registered state, secrets, or build artifacts affected.

Exception: `RESEND_API_KEY` must be set as a new Convex environment variable post-deploy. This is a provisioning step, not a migration.

---

## Open Questions

1. **emailDeliveryLog alertId requirement for digest sends**
   - What we know: `insertEmailLog` requires `v.id("alerts")`. Digest emails have no associated alert.
   - What's unclear: Whether to make `alertId` optional in schema (requires schema migration + mutation update) or use a sentinel record.
   - Recommendation: Make `alertId` optional (`v.optional(v.id("alerts"))`) — consistent with how one might log digest events. Handle in Wave 0 as a schema patch before writing the action.

2. **Resend sender domain verification**
   - What we know: Resend requires a verified sender domain for production sends. The `from:` field must use a verified domain.
   - What's unclear: Whether Larry has a verified domain set up in the Resend account.
   - Recommendation: Use `onboarding@resend.dev` as the sender for local/test sends (Resend provides this for dev). Plan to swap to a real domain when deploying to production. Flag this in Wave 0.

3. **Convex + React Email JSX compilation**
   - What we know: Convex actions compile with their own esbuild config. React Email templates are JSX.
   - What's unclear: Whether `convex/tsconfig.json` supports JSX for files imported from Convex actions.
   - Recommendation: Check `convex/tsconfig.json` in Wave 0. If JSX is not configured, place the template in `convex/emailTemplates/` with explicit `"jsx": "react-jsx"` configuration.

4. **Email digest schedule configuration storage**
   - What we know: D-03 specifies schedule (daily/weekly/both) and enabled toggle. D-15 uses `profileConfigs.emailAddress`.
   - What's unclear: Where the schedule preference and enabled toggle are stored — `agentConfigs` (like `digest-interval`) or `profileConfigs`.
   - Recommendation: Mirror the `digest-interval` pattern in `agentConfigs` — store `email-digest-enabled` (boolean), `email-digest-schedule` ("daily" | "weekly" | "both") as `agentConfigs` rows. The email address already lives in `profileConfigs.emailAddress`. The cron then reads both.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, build | ✓ | v22.17.0 | — |
| Convex CLI | Backend deploy, env set | ✓ | 1.39.1 | — |
| `resend` (npm) | Email delivery | ✗ (not installed) | 6.12.3 on registry | — (must install) |
| `@react-email/components` (npm) | Email template | ✗ (not installed) | 1.0.12 on registry | — (must install) |
| `@react-email/render` (npm) | Template→HTML string | ✗ (not installed) | 2.0.8 on registry | — (must install) |
| `dagre` (npm) | Call graph layout | ✓ | 0.8.5 (package.json) | — |
| `@types/dagre` (npm) | TypeScript types | ✓ | 0.7.54 (package.json) | — |
| RESEND_API_KEY | Email send | ✗ (not set) | — | Dev: use `onboarding@resend.dev` sender |

**Missing dependencies requiring install before Wave 1:**
```bash
npm install resend @react-email/components @react-email/render
```

**Missing env var requiring provisioning:**
```bash
npx convex env set RESEND_API_KEY "re_xxxx"
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXT-01 | Email template renders valid HTML with all digest fields | unit | `npx vitest run convex/emailDigest.test.ts -x` | ❌ Wave 0 |
| EXT-01 | sendEmailDigestAction logs failure when RESEND_API_KEY absent | unit | `npx vitest run convex/emailDigest.test.ts -x` | ❌ Wave 0 |
| EXT-01 | EmailDigestSettings saves recipient + schedule to agentConfigs | unit | `npx vitest run src/components/EmailDigestSettings.test.tsx -x` | ❌ Wave 0 |
| EXT-02 | PagerDuty trigger builds correct payload with dedup_key | unit | `npx vitest run convex/pagerdutyDelivery.test.ts -x` | ❌ Wave 0 |
| EXT-02 | PagerDuty resolve sends same dedup_key as trigger | unit | `npx vitest run convex/pagerdutyDelivery.test.ts -x` | ❌ Wave 0 |
| EXT-02 | pagerdutyConfig absent → PagerDuty action skipped (no fetch) | unit | `npx vitest run convex/pagerdutyDelivery.test.ts -x` | ❌ Wave 0 |
| VIZ-01 | computeLayout returns correct node count from edges | unit | `npx vitest run src/components/CallGraphPanel.test.tsx -x` | ❌ Wave 0 |
| VIZ-01 | Errored edge sets source node status to errored | unit | `npx vitest run src/components/CallGraphPanel.test.tsx -x` | ❌ Wave 0 |
| VIZ-01 | Empty edges → empty graph renders without crash | unit | `npx vitest run src/components/CallGraphPanel.test.tsx -x` | ❌ Wave 0 |

Existing relevant tests (no changes needed):
- `convex/callGraphEdges.test.ts` — covers upsert logic (existing, passing)
- `convex/deliveryLogs.test.ts` — covers insert shape validation (existing, passing)

### Sampling Rate
- **Per task commit:** `npx vitest run convex/emailDigest.test.ts convex/pagerdutyDelivery.test.ts src/components/CallGraphPanel.test.tsx -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `convex/emailDigest.test.ts` — covers EXT-01 (template render, missing API key guard, log write shape)
- [ ] `convex/pagerdutyDelivery.test.ts` — covers EXT-02 (payload shape, dedup_key, resolve action, skip-when-disabled)
- [ ] `src/components/CallGraphPanel.test.tsx` — covers VIZ-01 (layout computation, node coloring, empty state)
- [ ] `src/components/EmailDigestSettings.test.tsx` — covers EXT-01 UI (save recipient, schedule select)
- [ ] `npm install resend @react-email/components @react-email/render` — before any email code compiles
- [ ] Schema patch: `emailDeliveryLog.alertId` → `v.optional(v.id("alerts"))` — before digest action logs to DB
- [ ] Check `convex/tsconfig.json` for JSX support — before importing DigestEmailTemplate from Convex action

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not a new auth surface |
| V3 Session Management | No | Not a new session surface |
| V4 Access Control | Yes | AlertRuleForm mutations (`create`, `update`) already require Clerk identity (CPHLTH-01 in alertRuleCustom.ts) |
| V5 Input Validation | Yes | PagerDuty routing key, email recipient, and schedule must be validated before persist |
| V6 Cryptography | No | No new crypto surfaces; RESEND_API_KEY stored in Convex env, not in DB |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Routing key stored in plaintext in alertRuleCustom table | Information Disclosure | Per D-08, this is intentional (it's a service routing identifier, not a secret). Document as accepted risk. |
| Email recipient injection (CRLF) | Tampering | Validate recipient is a valid email format before passing to Resend SDK. Resend SDK validates on its end but defense-in-depth applies. |
| SSRF via PagerDuty endpoint override | Spoofing | Hardcode the PagerDuty endpoint (`https://events.pagerduty.com/v2/enqueue`) — never accept it as user input. |
| Digest email to wrong recipient after config change | Information Disclosure | Read recipient from stored config at send time (not from form state). Convex reactive query ensures current value. |

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 70 |
|-----------|-------------------|
| Tailwind CSS 4 only — no component library | Call graph SVG uses Tailwind classes for surrounding panel; SVG elements use inline styles (SVG attributes, not Tailwind) |
| Dark theme throughout: `bg-gray-800/50` cards, `border-gray-700/50` borders, `text-gray-300` body | CallGraphPanel and EmailDigestSettings must follow this palette |
| `SectionErrorBoundary` wraps widget groups | `<CallGraphPanel>` on Infrastructure page must be wrapped |
| `GlassPanel` + `SectionHeader` for Infrastructure page sections | New call graph section uses these wrappers (per D-10 and existing Infrastructure.tsx pattern) |
| All Ástríðr API fetch calls must include `Authorization: Bearer` header | Not applicable here — Resend and PagerDuty are different external APIs |
| Never commit `.env` files or credentials | `RESEND_API_KEY` set via `npx convex env set`, not `.env` |
| Convex actions for external API calls: fire-and-forget with try/catch, log to delivery table | Both Resend and PagerDuty actions follow this pattern |
| Vitest + jsdom, tests alongside source | All new test files: `convex/*.test.ts` or `src/components/*.test.tsx` |
| graphify: run `graphify update .` after modifying code files | Run after each wave completes |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PagerDuty Events API v2 endpoint is `https://events.pagerduty.com/v2/enqueue` (no auth header needed, routing_key in body) | Code Examples — PagerDuty | Planner should verify against official PagerDuty docs before implementation; endpoint URL is high-confidence from multiple sources |
| A2 | Email digest cron should fire `sendEmailDigestAction` independently of `triggerDailyDigest` — a second daily cron entry | Architecture — Cron | Could be wired into existing `generate-daily-digest` cron instead. Planner should confirm preferred wiring. |
| A3 | `profileConfigs.emailAddress` is the correct field to read for digest recipient (not a separate agentConfigs entry) | Standard Stack | Verified in Settings.tsx + schema — HIGH confidence, not truly assumed |

**Assumptions A2–A3 are LOW risk.** A1 is MEDIUM risk (endpoint URL highly cross-confirmed but not from official docs page directly due to fetch failures). Implementation should include a graceful error log on 4xx from the PagerDuty endpoint.

---

## Sources

### Primary (HIGH confidence)
- `convex/schema.ts` (in-repo) — `emailDeliveryLog`, `pagerdutyDeliveryLog`, `callGraphEdges` table definitions
- `convex/deliveryLogs.ts` (in-repo) — `insertEmailLog`, `insertPagerdutyLog` mutation signatures
- `convex/callGraphEdges.ts` (in-repo) — `upsertEdge`, `listEdges`, `getBySession` query signatures
- `convex/webhookDelivery.ts` (in-repo) — internalAction delivery pattern (model for Resend + PagerDuty actions)
- `convex/alertRuleCustom.ts` (in-repo) — `pagerdutyConfigValidator` validator shape
- `convex/crons.ts` (in-repo) — existing cron entries and patterns
- `package.json` (in-repo) — dagre v0.8.5 confirmed installed; resend/react-email confirmed NOT installed
- npm registry (`npm view resend version`) — resend@6.12.3 current
- npm registry (`npm view @react-email/components version`) — 1.0.12 current
- npm registry (`npm view @react-email/render version`) — 2.0.8 current
- resend.com/docs/send-with-nodejs — SDK constructor, `.send()` method, `{ data, error }` return
- react.email/docs/utilities/render — `render()` async function returns HTML string
- docs.convex.dev/production/environment-variables — `process.env.RESEND_API_KEY` pattern confirmed

### Secondary (MEDIUM confidence)
- developer.pagerduty.com/docs/events-api-v2/trigger-events/ (via WebSearch cross-reference) — endpoint URL, event_action values, dedup_key semantics, payload field names
- dagrejs/dagre wiki (via React Flow example) — `setGraph`, `setNode`, `setEdge`, `dagre.layout()` API

### Tertiary (LOW confidence)
- None — all critical claims verified via in-repo inspection or npm registry

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions verified from npm registry; dagre confirmed in package.json
- Architecture: HIGH — follows existing internalAction patterns exactly; delivery log tables ready
- Pitfalls: HIGH — based on direct schema inspection (alertId type mismatch), confirmed Convex env var pattern, and dagre mutation semantics
- PagerDuty API payload: MEDIUM — endpoint and payload fields confirmed from multiple secondary sources; official docs page failed to load

**Research date:** 2026-05-24
**Valid until:** 2026-06-24 (Resend/React Email APIs are stable; PagerDuty Events API v2 has been stable for years)
