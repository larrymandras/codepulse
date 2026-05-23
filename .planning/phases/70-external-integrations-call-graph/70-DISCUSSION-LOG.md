# Phase 70: External Integrations & Call Graph - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 70-External Integrations & Call Graph
**Areas discussed:** Email delivery, PagerDuty lifecycle, Call graph viz, Cross-cutting

---

## Email Delivery

### Trigger & Schedule

| Option | Description | Selected |
|--------|-------------|----------|
| Convex cron only | Daily/weekly cron fires generateDailyDigestAction, sends via Resend | ✓ |
| Cron + manual trigger | Same cron plus 'Send now' button on Settings/Briefings | |
| Event-driven | Send on thresholds in addition to schedule | |

**User's choice:** Convex cron only

### Digest Content

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse daily digest as-is | Wrap existing generateDailyDigestAction output in HTML email | ✓ |
| Enhanced digest | Add provider breakdown, top-spending agents, call graph health | |
| You decide | Claude picks content scope | |

**User's choice:** Reuse daily digest as-is

### Config Location

| Option | Description | Selected |
|--------|-------------|----------|
| Existing Settings page | Email Digest section under Notification Channels | ✓ |
| Dedicated email config page | Separate page with preview and send history | |

**User's choice:** Existing Settings page

### Email Template Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Inline HTML string | Template literals in Convex action, no extra deps | |
| React Email | @react-email/components for type-safe templates | ✓ |
| You decide | Claude picks | |

**User's choice:** React Email

---

## PagerDuty Lifecycle

### Dedup Key Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Rule ID based | dedup_key = 'codepulse-{alertRuleId}', one incident per rule | ✓ |
| Rule + timestamp window | Allows multiple incidents per rule per day | |
| You decide | Claude picks based on PD best practices | |

**User's choice:** Rule ID based

### Severity Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-map from alert severity | critical->critical, warning->warning, info->info with override | ✓ |
| Always critical | PD only fires for critical alerts | |
| User-configured per rule | Explicit PD severity independent of alert severity | |

**User's choice:** Auto-map from alert severity

### Auto-Resolve

| Option | Description | Selected |
|--------|-------------|----------|
| On alert clear | Send resolve event when condition returns to normal | ✓ |
| Manual resolve only | Operator resolves in PD UI or CodePulse | |
| Both | Auto-resolve + manual resolve from CodePulse | |

**User's choice:** On alert clear

### Routing Key Config

| Option | Description | Selected |
|--------|-------------|----------|
| Per-rule in alert editor | Uses existing pagerdutyConfig.routingKey field | ✓ |
| Global + per-rule override | Default in Settings, optional per-rule override | |

**User's choice:** Per-rule in alert editor

---

## Call Graph Visualization

### Rendering Approach

| Option | Description | Selected |
|--------|-------------|----------|
| dagre + custom SVG | Dagre for layout, custom SVG nodes/edges, deterministic top-down | ✓ |
| React Flow + dagre | React Flow rendering with dagre layout, more interactive | |
| You decide | Claude picks based on codebase | |

**User's choice:** dagre + custom SVG

### Page Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Infrastructure page | New section alongside GithubActionsPanel, ProviderHealthPanel | ✓ |
| Dedicated Call Graph page | New sidebar nav entry and route | |
| Analytics page | Section alongside cost/token visualizations | |

**User's choice:** Infrastructure page

### Real-Time Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Convex reactive query | useQuery on callGraphEdges, auto-updates on upsert | ✓ |
| Polling interval | Query every N seconds | |
| You decide | Claude picks based on volume/performance | |

**User's choice:** Convex reactive query

### Node Design

| Option | Description | Selected |
|--------|-------------|----------|
| Agent + tool nodes, red edges | Agents larger, tools smaller, edges = calls, red for errors | ✓ |
| Agent-only with tool counts | Only agents shown, tool counts as labels | |
| You decide | Claude picks based on schema | |

**User's choice:** Agent + tool nodes, red edges

---

## Cross-Cutting

### Alert Rule Editor Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable sections in existing form | Collapsible PagerDuty and Email sections in AlertRuleForm | ✓ |
| Separate delivery config page | Configure delivery channels separately, link to rules | |
| You decide | Claude picks | |

**User's choice:** Expandable sections in existing form

### Settings Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Group under existing sections | Email Digest under Notification Channels, delivery logs in new tab | ✓ |
| New External Integrations section | Dedicated section for all external integrations | |
| You decide | Claude picks | |

**User's choice:** Group under existing sections

### Secrets & API Keys

| Option | Description | Selected |
|--------|-------------|----------|
| Convex environment variables | RESEND_API_KEY as env var, PD routing key per-rule | ✓ |
| Convex table with encryption | Encrypted secrets table | |
| You decide | Claude picks | |

**User's choice:** Convex environment variables

---

## Claude's Discretion

- React Email template structure and styling
- PagerDuty Events API v2 payload structure details
- Call graph SVG node sizing, spacing, and animation
- Test structure and Wave 0 stub design
- Delivery History tab layout and filtering

## Deferred Ideas

None -- discussion stayed within phase scope.
