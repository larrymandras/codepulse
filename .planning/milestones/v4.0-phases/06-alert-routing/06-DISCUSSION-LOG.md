# Phase 6: Alert Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 06-alert-routing
**Areas discussed:** Rule configuration, Webhook delivery, Alert lifecycle, Notification prefs

---

## Rule Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold overrides | Keep static catalog, let operators override thresholds per rule | |
| Full CRUD custom rules | Operators create brand new rules with custom conditions | |
| Both — overrides + custom | Static rules with overrides PLUS custom rule creation | ✓ |

**User's choice:** Both — threshold overrides on static rules + ability to create custom rules
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple threshold only | Pick metric, set threshold and comparison operator | |
| Compound conditions | AND/OR logic combining multiple thresholds | ✓ |
| You decide | Claude picks complexity level | |

**User's choice:** Compound conditions — AND/OR logic combining multiple thresholds
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Time windows | Each condition includes a lookback window (5m-24h) | ✓ |
| Point-in-time only | Conditions evaluate against current/latest values only | |
| You decide | Claude picks based on aggregation pipeline | |

**User's choice:** Time windows — each condition includes a lookback window
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Convex cron | Scheduled cron evaluates all rules every 1-5 minutes | |
| Event-driven | Rules evaluate immediately on event ingest | |
| Both — cron + critical event-driven | Cron for regular, event-driven for critical-severity | ✓ |

**User's choice:** Both — Convex cron for regular checks + event-driven for critical-severity rules
**Notes:** None

---

## Webhook Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page | Global webhook config with URL fields, test button, status | ✓ |
| Per-rule attachment | Each rule specifies which webhook(s) to notify | |
| Per-category channels | Map categories to specific webhook channels | |

**User's choice:** Settings page — global Notification Channels section
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rich embeds | Discord embeds / Slack blocks with severity color, details, link | ✓ |
| Plain text | Simple text message with alert details | |
| You decide | Claude picks per platform | |

**User's choice:** Rich embeds with severity color, alert name, threshold values, timestamp, deep link
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Retry with backoff | 3 retries at 5s, 30s, 2m with logged failures | ✓ |
| Fire and forget | Send once, log result, no retry | |
| You decide | Claude picks based on Convex capabilities | |

**User's choice:** Retry with exponential backoff — 3 attempts
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduled action | ctx.scheduler.runAfter for background delivery | ✓ |
| Inline action | Synchronous delivery in evaluation pipeline | |
| You decide | Claude picks based on codebase patterns | |

**User's choice:** Scheduled Convex action via ctx.scheduler.runAfter
**Notes:** None

---

## Alert Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Active → Ack → Resolved | Three states, mute as flag | ✓ |
| Active → Ack → Escalated → Resolved | Four states with escalation step | |
| Active → Ack → Resolved + Snoozed | Three states plus snooze | |

**User's choice:** Active → Acknowledged → Resolved (mute is a timed flag, not a state)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Create Kanban task | Escalate = convert alert to Kanban task with linking | ✓ |
| Re-notify at higher severity | Escalate = re-send webhook bumped to critical | |
| Both — task + re-notify | Creates task AND re-sends notification | |

**User's choice:** Create Kanban task — alert linked to created task
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Timed mute | Suppress for duration (15m-indefinite), auto-unmute | ✓ |
| Permanent mute toggle | Simple on/off, must manually unmute | |
| You decide | Claude picks best approach | |

**User's choice:** Timed mute with duration options (15m, 1h, 4h, 24h, indefinite)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-resolve | Transition to Resolved when condition clears | ✓ |
| Manual only | Stay Active/Acknowledged until operator resolves | |
| Configurable per rule | Toggle per rule, critical=manual, warning/info=auto | |

**User's choice:** Auto-resolve when condition clears on next evaluation
**Notes:** None

---

## Notification Preferences

| Option | Description | Selected |
|--------|-------------|----------|
| Per-severity level | 4 severity levels each mapped to a delivery mode | ✓ |
| Per-category + severity matrix | Category × severity grid | |
| Per-rule | Individual notification pref per rule | |

**User's choice:** Per-severity level granularity
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 modes | Always notify, Digest, Dashboard only | |
| 4 modes | Always notify, Digest, Dashboard only, Disabled | ✓ |
| You decide | Claude picks | |

**User's choice:** 4 delivery modes including Disabled (suppress entirely)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Scheduled summary | Cron sends consolidated digest at configurable interval | ✓ |
| Threshold-based batch | Send when accumulated count reaches N | |
| You decide | Claude picks based on existing cron infrastructure | |

**User's choice:** Scheduled summary via Convex cron (1h, 4h, or daily)
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page | Same page as webhook config, single location | ✓ |
| Alerts page | Inline config panel on Alerts page | |
| You decide | Claude picks based on layout | |

**User's choice:** Settings page alongside webhook URL configuration
**Notes:** None

---

## Claude's Discretion

- Visual condition builder UI design for compound AND/OR rules
- Exact cron evaluation interval within the 1-5 minute range
- Digest message formatting and grouping strategy
- Auto-resolve behavior when alert is already acknowledged

## Deferred Ideas

None — discussion stayed within phase scope.
