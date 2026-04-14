# Phase 6: Alert Routing - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators receive external notifications (Discord/Slack webhooks) within 60 seconds of threshold breaches. Alert rules are configurable with operator-defined thresholds and custom compound conditions. Alerts follow a clear lifecycle (Active → Acknowledged → Resolved) with mute, escalate (to Kanban task), and auto-resolve capabilities. Per-severity notification preferences control delivery mode. All alerts surface in Unified Inbox.

</domain>

<decisions>
## Implementation Decisions

### Rule Configuration
- **D-01:** Keep the existing 30+ static rules in `alertRules.ts` as a catalog. Allow operators to override thresholds per rule (stored in Convex, not code).
- **D-02:** Operators can also create fully custom rules with compound AND/OR conditions combining multiple thresholds.
- **D-03:** Each condition (static or custom) includes a configurable lookback time window: 5m, 15m, 30m, 1h, or 24h. Prevents noisy alerts from momentary spikes.
- **D-04:** Dual evaluation strategy — Convex cron job evaluates all active rules every 1-5 minutes. Critical-severity rules ALSO evaluate on event ingest for sub-60s response.

### Webhook Delivery
- **D-05:** Discord and Slack webhook URLs configured globally on the Settings page in a "Notification Channels" section with URL fields, test button, and connection status indicator.
- **D-06:** Webhook messages use rich embeds — Discord embeds / Slack blocks with severity color coding, alert name, threshold values, timestamp, and a deep link back to the CodePulse Alerts page.
- **D-07:** Failed webhook deliveries retry with exponential backoff — 3 attempts at 5s, 30s, 2m intervals. Failures logged in Convex. Delivery status visible on the alert in the dashboard.
- **D-08:** Webhook delivery dispatched as a scheduled Convex action (`ctx.scheduler.runAfter`), decoupled from alert evaluation. No blocking of the evaluation pipeline on external HTTP calls.

### Alert Lifecycle
- **D-09:** Three alert states: Active (firing) → Acknowledged (operator has seen it) → Resolved (condition cleared or manually resolved).
- **D-10:** Mute is a timed flag on any alert or rule, not a separate state. Duration options: 15m, 1h, 4h, 24h, indefinite. Muted alerts still fire and appear in dashboard but skip webhook delivery. Auto-unmutes when duration expires.
- **D-11:** Escalate = Create a Kanban task from the alert (Phase 4 integration). The alert gets linked to the created task. This satisfies the "Create Task from Alert" success criteria.
- **D-12:** Auto-resolve — when the next cron evaluation finds the triggering condition no longer met, the alert transitions to Resolved automatically. Keeps the dashboard clean.

### Notification Preferences
- **D-13:** Notification preferences configured at per-severity granularity: critical, error, warning, info — each maps to a delivery mode.
- **D-14:** Four delivery modes available: Always notify (immediate webhook), Digest (batched summary), Dashboard only (no external notification), Disabled (suppressed entirely — not shown in dashboard).
- **D-15:** Digest delivery is a scheduled summary via Convex cron at a configurable interval (every 1h, 4h, or daily). One consolidated webhook message per interval summarizing all digest-level alerts.
- **D-16:** Notification preferences configured on the Settings page alongside webhook URL configuration. Single location for all alert routing configuration.

### Claude's Discretion
- Visual condition builder UI design for compound AND/OR rules
- Exact cron evaluation interval (1-5 minute range)
- Digest message formatting and grouping strategy
- How auto-resolve interacts with acknowledged alerts (likely: auto-resolve even if acknowledged)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Alert Infrastructure
- `convex/alertRules.ts` — Static rule catalog with categories, severities, conditions, and message templates (30+ rules)
- `convex/alertRulesConfig.ts` — Rule enable/disable toggle mutations
- `convex/alerts.ts` — Alert CRUD (create, acknowledge, listActive, listAll, paginated queries)
- `convex/notifications.ts` — Notification classification system (toast/bell/alert by severity)

### Existing UI Components
- `src/components/AlertRulesEngine.tsx` — Rule management UI with category filter tabs and severity colors
- `src/components/AlertBanner.tsx` — Urgent alert banner with critical/error counts
- `src/components/NotificationBell.tsx` — Bell dropdown with unread notifications
- `src/components/HeartbeatAlertsPanel.tsx` — Heartbeat check display panel
- `src/pages/Alerts.tsx` — Full alerts page with severity tabs, grouped view, pagination
- `src/pages/Settings.tsx` — Settings page (webhook config and notification prefs go here)

### Integration Points
- `src/components/InboxCard.tsx` — Unified Inbox (alerts must surface here per Phase 3)
- Phase 4 Kanban board — Escalation creates tasks here
- Phase 5 aggregation tables — Time-window conditions query pre-computed aggregates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AlertRulesEngine` component: Category filter tabs, severity color mapping, rule toggle UI — extend for threshold overrides and custom rules
- `AlertBanner` component: Critical/error count banner — works as-is, feeds from existing alert queries
- `NotificationBell` + `useNotifications` hook: Bell notification system — wire to webhook delivery status
- `LoadMoreButton` component: Cursor-based pagination (Phase 5) — already used on Alerts page
- `classifyNotification()` in `convex/notifications.ts`: Severity-based routing logic — extend for delivery mode preferences

### Established Patterns
- Convex mutations for CRUD, queries for reads with index-based filtering (`by_acknowledged`, `by_source`)
- Cron jobs pattern established in Phase 5 (hourly/daily aggregation) — reuse for alert evaluation and digest delivery
- Paginated queries with `paginationOptsValidator` — already on alerts table
- Severity color system: `critical=red, error=orange, warning=yellow, info=blue` — consistent across AlertRulesEngine, Alerts page, NotificationBell

### Integration Points
- Settings page (`src/pages/Settings.tsx`) — add Notification Channels and Notification Preferences sections
- Unified Inbox (`src/components/InboxCard.tsx`) — alerts need to appear as inbox items
- Kanban board — escalation mutation creates a task and links back to the alert
- Event ingest pipeline (`convex/runtimeIngest.ts`) — hook critical-severity rule evaluation into ingest flow

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for the rule builder UI and webhook integration patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-alert-routing*
*Context gathered: 2026-04-14*
