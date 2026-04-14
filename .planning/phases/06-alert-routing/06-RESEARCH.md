# Phase 6: Alert Routing - Research

**Researched:** 2026-04-14
**Domain:** Convex scheduled actions, webhook delivery, alert lifecycle management, compound rule evaluation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rule Configuration**
- D-01: Keep the existing 30+ static rules in `alertRules.ts` as a catalog. Allow operators to override thresholds per rule (stored in Convex, not code).
- D-02: Operators can also create fully custom rules with compound AND/OR conditions combining multiple thresholds.
- D-03: Each condition (static or custom) includes a configurable lookback time window: 5m, 15m, 30m, 1h, or 24h.
- D-04: Dual evaluation strategy — Convex cron job evaluates all active rules every 1-5 minutes. Critical-severity rules ALSO evaluate on event ingest for sub-60s response.

**Webhook Delivery**
- D-05: Discord and Slack webhook URLs configured globally on the Settings page in a "Notification Channels" section.
- D-06: Webhook messages use rich embeds — Discord embeds / Slack blocks with severity color coding, alert name, threshold values, timestamp, and a deep link.
- D-07: Failed webhook deliveries retry with exponential backoff — 3 attempts at 5s, 30s, 2m intervals. Failures logged in Convex. Delivery status visible on the alert.
- D-08: Webhook delivery dispatched as a scheduled Convex action (`ctx.scheduler.runAfter`), decoupled from alert evaluation.

**Alert Lifecycle**
- D-09: Three alert states: Active → Acknowledged → Resolved.
- D-10: Mute is a timed flag, not a separate state. Duration options: 15m, 1h, 4h, 24h, indefinite. Muted alerts still fire but skip webhook delivery. Auto-unmutes when duration expires.
- D-11: Escalate = Create a Kanban task from the alert (Phase 4 integration). Alert gets linked to the created task.
- D-12: Auto-resolve — when the next cron evaluation finds the triggering condition no longer met, alert transitions to Resolved automatically.

**Notification Preferences**
- D-13: Notification preferences configured at per-severity granularity: critical, error, warning, info.
- D-14: Four delivery modes: Always notify, Digest, Dashboard only, Disabled.
- D-15: Digest delivery is a scheduled summary via Convex cron at configurable interval (1h, 4h, or daily).
- D-16: All notification config on the Settings page.

### Claude's Discretion
- Visual condition builder UI design for compound AND/OR rules
- Exact cron evaluation interval (1-5 minute range)
- Digest message formatting and grouping strategy
- How auto-resolve interacts with acknowledged alerts

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALR-01 | Operator can configure alert rules with threshold triggers | D-01/D-02/D-03: threshold overrides stored in `agentConfigs`; custom rules in new `alertRuleConfigs` table |
| ALR-02 | Triggered alerts deliver notifications to configured Discord webhook within 60 seconds | D-04/D-08: dual eval (cron + ingest hook) + `ctx.scheduler.runAfter` decoupled delivery |
| ALR-03 | Triggered alerts deliver notifications to configured Slack webhook within 60 seconds | Same architecture as ALR-02; Slack Block Kit format |
| ALR-04 | Operator can mute, acknowledge, and escalate alerts from the dashboard | D-09/D-10/D-11: schema migration + new mutations + UI lifecycle actions |
| ALR-05 | Alert notification preferences are configurable per severity level | D-13/D-14/D-15/D-16: `notificationPreferences` config in `agentConfigs` |
| ALR-06 | One-click "Create Task from Alert" converts alert to Kanban task | D-11: `tasks.create` mutation exists in Phase 4; need `alertId` linkage field on tasks |
| ALR-07 | All alerts surface in Unified Inbox | `InboxCard` already supports `type: "alert"`; need query feeding alerts as inbox items |
</phase_requirements>

---

## Summary

Phase 6 builds on a solid existing foundation. The `alerts` table, `alertRules.ts` catalog, `alertRulesConfig.ts` toggle system, and `evaluate` mutation are all operational. The cron infrastructure from Phase 5 (`crons.ts`) is the natural extension point for alert evaluation scheduling. The `tasks` table and `tasks.create` mutation from Phase 4 handle escalation. The `InboxCard` component already supports an `"alert"` item type.

The bulk of new work falls into four areas: (1) schema additions for threshold overrides, custom rules, mute state, webhook config, and notification preferences; (2) a new `webhookDelivery` Convex action that handles Discord/Slack HTTP calls with retry scheduling; (3) evaluation engine upgrades to check custom/overridden thresholds, enforce lookback windows, apply mute checks, and trigger delivery; (4) UI additions across Alerts page, AlertRulesEngine, Settings page, and InboxCard.

**Primary recommendation:** Extend the existing `evaluate`/`evaluateInternal` mutation pattern rather than replacing it. Add new Convex tables for operator-configured data. Use `ctx.scheduler.runAfter` for all external HTTP calls (webhook delivery and retry). Store all config (webhook URLs, notification prefs, threshold overrides, custom rules, mute state) in Convex — no env vars or files needed.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| convex | (project-installed) | All backend mutations, queries, actions, cron scheduling | Already in use throughout project |
| shadcn/ui | (project-installed) | UI components — accordion, tabs, table, alert (new installs per UI-SPEC) | Project design system |
| Lucide React | (project-installed) | Icons — 4×4px per UI-08 | Established icon standard |

[VERIFIED: codebase grep — convex, shadcn, lucide-react all present]

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn accordion | via shadcn CLI | Rule list expand/collapse | Condition builder groups |
| shadcn tabs | via shadcn CLI | Severity filter tabs | Alerts page filter bar |
| shadcn table | via shadcn CLI | Alert rule list table view | AlertRulesEngine extension |
| shadcn alert | via shadcn CLI | Inline delivery status banners | Webhook failure feedback |

[VERIFIED: codebase — UI-SPEC lists these as "additional shadcn components to install for this phase"]

**Installation (shadcn components):**
```bash
npx shadcn@latest add accordion tabs table alert
```

---

## Architecture Patterns

### New Convex Tables Required

The current schema has `alerts` and `agentConfigs` but lacks dedicated storage for the new phase's data. New tables to add:

```
alertRuleOverrides       — per-rule threshold overrides (static rules)
alertRuleCustom          — fully custom compound rules
alertMutes               — mute records per alert or rule with expiry
webhookDeliveryLog       — per-alert delivery attempt log
notificationChannels     — Discord + Slack webhook URLs (global)
notificationPreferences  — per-severity delivery mode settings
```

**Alternative approach (simpler):** Store webhook URLs and notification preferences in `agentConfigs` using structured keys (e.g., `"webhook-discord-url"`, `"notification-prefs"`). This avoids new tables and matches the existing toggle pattern in `alertRulesConfig.ts`. Recommended for config data; dedicated tables recommended for logs and mutes.

[ASSUMED — no external source; derived from locked decisions and existing codebase patterns]

### Schema: `alerts` Table Migration

The existing `alerts` table needs new fields to support the full lifecycle:

```typescript
// Fields to add via schema migration:
status: v.optional(v.string()),       // "active" | "acknowledged" | "resolved"
resolvedAt: v.optional(v.float64()),
ruleId: v.optional(v.string()),        // link to alertRules id or custom rule id
linkedTaskId: v.optional(v.string()), // for escalation (ALR-06)
webhookStatus: v.optional(v.string()), // "pending" | "delivered" | "failed"
webhookDeliveredAt: v.optional(v.float64()),
webhookAttempts: v.optional(v.float64()),
```

The existing `acknowledged: boolean` field must remain for backward-compat; `status` field is additive.

[VERIFIED: codebase — existing schema has `acknowledged`, `acknowledgedBy`, `acknowledgedAt` but no `status`, `resolvedAt`, `linkedTaskId`, `webhookStatus`]

### Pattern 1: Decoupled Webhook Delivery via Convex Scheduler

**What:** Alert evaluation creates an alert record, then immediately schedules a webhook delivery action using `ctx.scheduler.runAfter(0, ...)`. The delivery action makes the HTTP call and schedules retries on failure.

**When to use:** Any time evaluation fires a new alert. The scheduler decouples network latency from the evaluation transaction.

**Example:**
```typescript
// In evaluateInternal (internalMutation) — after creating alert:
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
  alertId: newAlertId,
  attempt: 1,
});

// In convex/webhookDelivery.ts (internalAction):
export const sendAlertWebhook = internalAction({
  args: {
    alertId: v.id("alerts"),
    attempt: v.number(),
  },
  handler: async (ctx, { alertId, attempt }) => {
    const alert = await ctx.runQuery(internal.alerts.getById, { id: alertId });
    const channels = await ctx.runQuery(internal.notificationChannels.get, {});
    const prefs = await ctx.runQuery(internal.notificationPreferences.get, {});
    
    // Check mute state
    const muted = await ctx.runQuery(internal.alertMutes.isAlertMuted, { alertId });
    if (muted) return;
    
    // Check delivery mode for this severity
    const mode = prefs[alert.severity] ?? "always";
    if (mode === "dashboard_only" || mode === "disabled") return;
    if (mode === "digest") return; // digest cron handles it
    
    // Send to Discord and/or Slack
    const RETRY_DELAYS = [5_000, 30_000, 120_000]; // 5s, 30s, 2m
    
    try {
      if (channels.discordUrl) await sendDiscordEmbed(channels.discordUrl, alert);
      if (channels.slackUrl) await sendSlackBlock(channels.slackUrl, alert);
      await ctx.runMutation(internal.alerts.updateWebhookStatus, {
        id: alertId, status: "delivered", deliveredAt: Date.now() / 1000
      });
    } catch (err) {
      if (attempt <= 3) {
        await ctx.scheduler.runAfter(
          RETRY_DELAYS[attempt - 1],
          internal.webhookDelivery.sendAlertWebhook,
          { alertId, attempt: attempt + 1 }
        );
      } else {
        await ctx.runMutation(internal.alerts.updateWebhookStatus, {
          id: alertId, status: "failed", attempts: attempt
        });
      }
    }
  },
});
```

[ASSUMED — pattern derived from Convex documentation on actions and scheduling; scheduler.runAfter is a confirmed Convex pattern]

### Pattern 2: Dual Evaluation — Cron + Ingest Hook

**What:** Critical-severity rules evaluate immediately on event ingest (within seconds). All rules evaluate on the cron interval.

**When to use:** Satisfies ALR-02/ALR-03 60-second SLA for critical alerts.

**Cron registration:**
```typescript
// In convex/crons.ts — add to existing crons:
crons.interval(
  "evaluate-alert-rules",
  { minutes: 2 },  // 2-minute interval (within D-04's 1-5 min range)
  internal.alerts.evaluateInternal
);

crons.interval(
  "deliver-digest-alerts",
  { hours: 1 },   // default; operator can configure 1h/4h/daily
  internal.webhookDelivery.sendDigest
);
```

**Ingest hook in `runtimeIngest.ts`:**
```typescript
// After inserting critical event, trigger critical-rule evaluation:
if (evt.critical) {
  await ctx.scheduler.runAfter(0, internal.alerts.evaluateCriticalInternal, {});
}
```

[ASSUMED — pattern inferred from D-04 and existing `runtimeIngest.ts` structure]

### Pattern 3: Threshold Override Storage

**What:** Per-rule threshold overrides stored in `agentConfigs` using a structured key pattern. Mirrors the existing `alert-rules-disabled` key pattern.

**Key pattern:** `"alert-rule-override:{ruleId}"` → value is `{ threshold: number, lookbackWindow: string }`

**Why:** Avoids a new table, consistent with existing `alertRulesConfig.ts` pattern. Custom rules require a separate table due to their compound condition structure.

**Lookup in evaluation:**
```typescript
const overrideConfig = await ctx.db
  .query("agentConfigs")
  .withIndex("by_key", (q) => q.eq("configKey", `alert-rule-override:${ruleId}`))
  .first();
const threshold = overrideConfig?.value?.threshold ?? defaultThreshold;
```

[ASSUMED — derived from existing codebase pattern in alertRulesConfig.ts]

### Pattern 4: Mute as Timed Record

**What:** Mute state stored as a record with `expiresAt`. Evaluation and delivery check mute status by querying this record. Auto-unmute is handled by checking `expiresAt` at query time — no cron needed.

```typescript
// In new convex/alertMutes.ts:
export const isAlertMuted = internalQuery({
  args: { alertId: v.optional(v.id("alerts")), ruleId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now() / 1000;
    const mute = await ctx.db
      .query("alertMutes")
      .withIndex("by_target", ...)
      .first();
    if (!mute) return false;
    if (mute.expiresAt && mute.expiresAt < now) return false; // auto-expired
    return true;
  }
});
```

[ASSUMED — pattern derived from D-10 decisions]

### Pattern 5: Escalation → Kanban Task

**What:** Escalation calls `tasks.create` (already exists) with `alertId` linkage. The `tasks` table does not currently have an `alertId` field — needs schema addition.

```typescript
// New field on tasks table in schema.ts:
alertId: v.optional(v.id("alerts")),

// New mutation in alerts.ts:
export const escalateToTask = mutation({
  args: {
    alertId: v.id("alerts"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.string(),
  },
  handler: async (ctx, args) => {
    const taskDocId = await ctx.db.insert("tasks", {
      taskId: crypto.randomUUID(),
      title: args.title,
      description: args.description,
      priority: args.priority,
      column: "backlog",
      columnEnteredAt: Date.now() / 1000,
      createdAt: Date.now() / 1000,
      alertId: args.alertId,
    });
    await ctx.db.patch(args.alertId, { linkedTaskId: taskDocId });
    return taskDocId;
  }
});
```

[VERIFIED: codebase — `tasks.create` mutation exists, `tasks` table confirmed in schema; `alertId` field not present, must be added]

### Pattern 6: Discord Embed Format

Discord webhook POST body for rich embed:
```typescript
const discordPayload = {
  embeds: [{
    title: alert.message,
    color: severityToColor(alert.severity), // critical=16711680, error=16744192, warning=16776960, info=5592575
    fields: [
      { name: "Severity", value: alert.severity, inline: true },
      { name: "Rule", value: alert.source, inline: true },
      { name: "Triggered", value: new Date(alert.createdAt * 1000).toISOString(), inline: false },
    ],
    url: `https://codepulse.app/alerts`, // deep link per D-06
    footer: { text: "CodePulse Alert Routing" },
    timestamp: new Date(alert.createdAt * 1000).toISOString(),
  }]
};
await fetch(discordUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(discordPayload) });
```

[ASSUMED — Discord webhook embed format based on training knowledge; Discord API is stable but should be verified at implementation]

### Pattern 7: Slack Block Kit Format

```typescript
const slackPayload = {
  blocks: [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${severityEmoji(alert.severity)} ${alert.message}*`,
      }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Severity:* ${alert.severity}` },
        { type: "mrkdwn", text: `*Rule:* ${alert.source}` },
        { type: "mrkdwn", text: `*Triggered:* ${relativeTime(alert.createdAt)}` },
      ]
    },
    {
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "View in CodePulse" },
        url: `https://codepulse.app/alerts`
      }]
    }
  ]
};
```

[ASSUMED — Slack Block Kit format based on training knowledge; stable API]

### Anti-Patterns to Avoid

- **Making HTTP calls inside Convex mutations or queries:** Convex mutations/queries cannot make network calls. All webhook delivery MUST be in Convex `action` or `internalAction` functions, triggered via `ctx.scheduler.runAfter`. [VERIFIED: Convex constraint — mutations are transactions, actions handle side effects]
- **Blocking ingest on evaluation:** Never `await evaluateInternal()` synchronously inside runtimeIngest. Always use `ctx.scheduler.runAfter(0, ...)` to keep ingest latency low. [ASSUMED — derived from D-08]
- **Deduplicating by source only:** The current `createIfNew` checks `activeSourceSet.has(ruleId)`. Custom rules with the same metric but different thresholds need a different dedup strategy — deduplicate by `ruleId` not `source`.
- **Storing webhook URLs in .env or code:** All operator config lives in Convex. No hardcoded URLs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry scheduling with backoff | Custom setTimeout loops | `ctx.scheduler.runAfter` with delay params | Convex scheduler is durable; survives restarts; handles delay precisely |
| Webhook HTTP requests in mutations | Fetch inside mutation handler | `internalAction` with `fetch` | Mutations are transactions — no network I/O allowed |
| Custom cron management | Manual timer tracking | `cronJobs()` in `convex/crons.ts` | Already established pattern in project; Phase 5 uses this |
| Per-severity routing logic | Large if/else chains | Extend `classifyNotification()` in `convex/notifications.ts` | Classification function already exists, just needs delivery mode awareness |
| Mute expiry polling | Cron that checks mutes | Lazy expiry check at query time | Query-time check is simpler and correct; no extra cron needed |

---

## Common Pitfalls

### Pitfall 1: Convex action context vs mutation context
**What goes wrong:** Developer tries to call `fetch()` or `ctx.scheduler.runAfter()` inside a mutation. Convex mutations are transactions and cannot perform side effects.
**Why it happens:** The existing `evaluate` mutation is a mutation (not action), so instinct is to add delivery there.
**How to avoid:** Keep evaluation in `internalMutation`. After inserting the alert, use `ctx.scheduler.runAfter` to hand off to an `internalAction` for HTTP delivery.
**Warning signs:** TypeScript error "ctx.scheduler is not available in mutation context" or runtime error on deployment.

### Pitfall 2: Schema migration breaks existing alert queries
**What goes wrong:** Adding new required fields to the `alerts` table breaks queries on existing records that don't have those fields.
**Why it happens:** Convex schemas are additive but existing records won't have new fields.
**How to avoid:** All new fields must be `v.optional(...)`. Never make new fields required on an existing table. The existing `acknowledged: boolean` must remain — don't replace it with `status`.
**Warning signs:** TypeScript type errors on existing `alerts` queries referencing new fields without null checks.

### Pitfall 3: Cron interval vs action timeout
**What goes wrong:** Alert evaluation cron runs every 2 minutes but the action that evaluates ALL 30+ rules times out.
**Why it happens:** Convex actions have a 10-minute timeout, but mutations have shorter limits. The existing `evaluate` mutation is large.
**How to avoid:** The existing `evaluateInternal` is already an `internalMutation` with a subset of checks for speed. Keep the full evaluation in the public `evaluate` mutation (manual trigger) and the lightweight version in `evaluateInternal` (cron). Consider splitting into category-specific internal mutations if timeout becomes an issue.
**Warning signs:** Cron job logs showing timeouts or partial evaluation results.

### Pitfall 4: Mute state not checked before webhook delivery
**What goes wrong:** Alert fires, webhook sends, but the rule was muted by the operator.
**Why it happens:** Mute check is in the evaluation path but not in the delivery action.
**How to avoid:** The `sendAlertWebhook` action MUST query mute state before making any HTTP call. Mute applies to both alert-level and rule-level mutes.
**Warning signs:** Operators report receiving notifications for muted alerts.

### Pitfall 5: Duplicate alerts from dual evaluation (cron + ingest hook)
**What goes wrong:** A critical event triggers the ingest hook evaluation which creates an alert, then the cron fires 90 seconds later and creates a duplicate.
**Why it happens:** The dedup logic in `createIfNew` checks `activeSourceSet` populated at query time — if both run concurrently or in fast succession, the in-memory set may not see the first insert.
**How to avoid:** The `createIfNew` dedup already queries `activeAlerts` at start of evaluation. The cron running 2 minutes later will see the already-active alert from the ingest hook evaluation and skip. The race condition window is only if cron and ingest hook run within the same Convex transaction — which can't happen since cron uses `internalMutation` scheduled separately.
**Warning signs:** Multiple alerts with the same `source` (ruleId) and `acknowledged: false` in the table.

### Pitfall 6: Digest grouping creates oversized webhook payloads
**What goes wrong:** Digest fires with 50+ alerts, resulting in a Discord/Slack message that exceeds platform limits.
**Why it happens:** No grouping or truncation in the digest payload.
**How to avoid:** Group digest alerts by category (max 5 categories), show count per category rather than full list. Discord embed field limit is 25 fields; Slack blocks have no hard limit but messages truncate at ~40KB.
**Warning signs:** Webhook returns 400 with "invalid_blocks" or Discord returns error on embed with too many fields.

---

## Code Examples

### Convex Scheduler (runAfter) — Verified Pattern
```typescript
// Source: Convex docs — scheduling actions
// In an internalMutation:
await ctx.scheduler.runAfter(0, internal.webhookDelivery.sendAlertWebhook, {
  alertId: id,
  attempt: 1,
});

// With delay (retry):
await ctx.scheduler.runAfter(30_000, internal.webhookDelivery.sendAlertWebhook, {
  alertId: id,
  attempt: 2,
});
```
[ASSUMED — Convex `ctx.scheduler.runAfter` is a documented API; delay in milliseconds]

### internalAction Definition
```typescript
// Source: convex/webhookDelivery.ts (new file)
import { internalAction } from "./_generated/server";
import { v } from "convex/values";

export const sendAlertWebhook = internalAction({
  args: { alertId: v.id("alerts"), attempt: v.number() },
  handler: async (ctx, args) => {
    // fetch() is available in actions
    // ctx.runQuery / ctx.runMutation available
    // ctx.scheduler.runAfter available for retry scheduling
  },
});
```
[ASSUMED — internalAction is a confirmed Convex pattern]

### Cron with Interval
```typescript
// Source: existing convex/crons.ts in project
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("evaluate-alert-rules", { minutes: 2 }, internal.alerts.evaluateInternal);
crons.interval("deliver-digest-alerts", { hours: 1 }, internal.webhookDelivery.sendDigest);
export default crons;
```
[VERIFIED: codebase — existing crons.ts uses this exact pattern for Phase 5 aggregation]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `evaluate` public mutation for cron evaluation | `evaluateInternal` internalMutation | Already in codebase | No public API exposure; internal scheduling only |
| `acknowledged: boolean` as sole state | `status` string field additive approach | This phase | Backward compat maintained |
| agentConfigs for disable-only | agentConfigs extended to threshold overrides + webhook URLs + prefs | This phase | Single config pattern, no new tables for scalar config |

---

## Open Questions

1. **Auto-resolve and acknowledged alerts**
   - What we know: D-12 says auto-resolve fires when condition clears. D-09 says Acknowledged is a state.
   - What's unclear: Does auto-resolve override Acknowledged state? (Claude's Discretion says "likely yes")
   - Recommendation: Auto-resolve fires regardless of Acknowledged state. An acknowledged alert that clears should move to Resolved. This is the simplest model and matches real-world alerting system behavior.

2. **Configurable digest interval**
   - What we know: D-15 says digest interval is configurable (1h, 4h, daily). Convex crons are static — cron interval cannot be dynamically reconfigured without redeployment.
   - What's unclear: How does the operator change the digest interval?
   - Recommendation: Use a fixed 1-hour cron. Store a `digestInterval` preference in `agentConfigs`. The digest cron runs every hour but checks the preference — if current time doesn't align with preferred interval (e.g., 4h means only fire at 00:00, 04:00, 08:00...), it skips. This avoids redeployment for config changes.

3. **InboxCard integration for alerts**
   - What we know: `InboxCard` supports `type: "alert"` with title/message/timestamp. ALR-07 requires all alerts to surface in Unified Inbox.
   - What's unclear: Does InboxCard need acknowledge/mute inline actions added per UI-SPEC?
   - Recommendation: Yes — per UI-SPEC "Alert items gain acknowledge/mute inline actions." The `InboxCard` component needs a new `alertId` prop and conditional rendering of acknowledge/mute buttons when `type === "alert"`.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 6 is purely Convex backend + React frontend changes. No external CLI tools, databases, or services beyond what's already deployed (Convex, Discord/Slack webhooks configured by operator at runtime).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (inferred from project structure — `convex/__tests__/` contains `.test.ts` files) |
| Config file | Check for `vitest.config.ts` at project root |
| Quick run command | `npx vitest run convex/__tests__/` |
| Full suite command | `npx vitest run` |

[VERIFIED: codebase — `convex/__tests__/alertRules.test.ts`, `notifications.test.ts`, `insightsChat.test.ts` exist]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALR-01 | Threshold override stored and retrieved correctly | unit | `npx vitest run convex/__tests__/alertRules.test.ts` | ✅ (extend existing) |
| ALR-01 | Custom rule with AND/OR conditions evaluates correctly | unit | `npx vitest run convex/__tests__/alertRules.test.ts` | ✅ (extend existing) |
| ALR-02 | Discord webhook fires within 60s of critical alert trigger | integration / smoke | Manual — requires live Convex + Discord endpoint | ❌ manual-only |
| ALR-03 | Slack webhook fires within 60s of critical alert trigger | integration / smoke | Manual — requires live Convex + Slack endpoint | ❌ manual-only |
| ALR-04 | Mute suppresses webhook delivery; acknowledge transitions state | unit | `npx vitest run convex/__tests__/alertLifecycle.test.ts` | ❌ Wave 0 |
| ALR-05 | Per-severity delivery mode routes correctly (always/digest/dashboard/disabled) | unit | `npx vitest run convex/__tests__/notificationPrefs.test.ts` | ❌ Wave 0 |
| ALR-06 | Escalation creates task with correct alertId linkage | unit | `npx vitest run convex/__tests__/alertLifecycle.test.ts` | ❌ Wave 0 |
| ALR-07 | Alert items appear in inbox feed | unit | `npx vitest run convex/__tests__/notifications.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npx vitest run convex/__tests__/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `convex/__tests__/alertLifecycle.test.ts` — covers ALR-04 (mute, acknowledge, escalate) and ALR-06 (task creation)
- [ ] `convex/__tests__/notificationPrefs.test.ts` — covers ALR-05 (delivery mode routing)
- [ ] `convex/__tests__/webhookDelivery.test.ts` — unit-tests the delivery action with mocked fetch (retry logic, mute check, mode check)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — single operator, no auth layer added |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a — single operator dashboard |
| V5 Input Validation | yes | Validate webhook URLs are HTTPS before storing; validate threshold values are numeric and within reasonable ranges |
| V6 Cryptography | no | Webhook URLs stored as plaintext in Convex (not secrets — URLs are bearer tokens, treat with care but no encryption needed at rest in Convex) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via operator-configured webhook URL | Tampering | Validate URL scheme is `https://`; validate hostname against known Discord/Slack domains OR accept any https (simpler — single operator trust model) |
| Webhook URL stored insecurely | Information Disclosure | URLs live in `agentConfigs` in Convex — masked in any UI display (show last 8 chars only after save) |
| Alert flood → webhook spam | Denial of Service | Dedup via `createIfNew` prevents duplicate alerts; digest mode batches high-volume severities |
| Oversized payload to Discord/Slack | Denial of Service | Cap digest to max 20 alerts per message; truncate individual alert messages at 1000 chars |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `convex/alerts.ts`, `convex/alertRules.ts`, `convex/alertRulesConfig.ts`, `convex/notifications.ts`, `convex/crons.ts`, `convex/schema.ts`, `convex/tasks.ts`, `convex/runtimeIngest.ts` — all read directly this session
- Codebase: `src/pages/Alerts.tsx`, `src/components/InboxCard.tsx`, `src/pages/Settings.tsx` — read directly
- Phase files: `06-CONTEXT.md`, `06-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md` — read directly

### Secondary (MEDIUM confidence)
- Convex scheduling pattern (`ctx.scheduler.runAfter`) — known from training, consistent with Convex's documented architecture; `internalAction` with `fetch` is the established Convex pattern for external HTTP calls

### Tertiary (LOW confidence / ASSUMED)
- Discord embed payload format — training knowledge; API is stable but format should be verified at implementation
- Slack Block Kit payload format — training knowledge; format should be verified at implementation
- Exact Convex mutation timeout limits — training knowledge; verify if evaluation mutation grows large

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ctx.scheduler.runAfter` is available in `internalMutation` context | Architecture Patterns P1, P2 | If only available in actions, evaluation must be restructured to schedule from a wrapping action |
| A2 | New Convex tables `alertMutes`, `webhookDeliveryLog` use standard `defineTable` pattern | Schema section | Low risk — pattern is established in project |
| A3 | Discord embed color is integer (not hex string) | Code Examples P6 | Webhook returns 400; easy to fix at implementation |
| A4 | Vitest is the test runner (not Jest) | Validation Architecture | Wrong runner means test commands are wrong; verify `package.json` scripts |
| A5 | Digest interval controlled via stored preference + hourly cron time-alignment check | Open Questions Q2 | If Convex supports dynamic cron config, a cleaner solution exists |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in codebase
- Architecture patterns: HIGH for Convex patterns (verified in existing code); MEDIUM for exact payload formats (Discord/Slack, assumed from training)
- Pitfalls: HIGH — derived from direct reading of existing evaluate mutation and schema
- Schema additions: HIGH — derived from locked decisions + existing schema gaps

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable tech domain)
