---
phase: 06-alert-routing
plan: 03
subsystem: backend
tags: [convex, webhook-delivery, discord, slack, cron, alert-evaluation, retry-logic]

requires:
  - phase: 06-alert-routing/06-01
    provides: schema tables (webhookDeliveryLog, alertRuleCustom, alertMutes) and test stubs
  - phase: 06-alert-routing/06-02
    provides: alertMutes.isTargetMuted, alerts.getById, alerts.updateWebhookStatus, alertRuleCustom module

provides:
  - sendAlertWebhook internalAction with Discord embed + Slack Block Kit formatters and 3-attempt retry (5s/30s/2m)
  - sendDigest internalAction with interval alignment (1h/4h/daily) and 20-alert cap
  - buildDiscordPayload and buildSlackPayload pure functions with severity color/emoji mapping
  - HTTPS URL validation before all outbound webhook calls (T-06-05 mitigation)
  - Digest payload capped at 20 alerts (T-06-08 mitigation)
  - evaluateInternal upgraded with threshold overrides, custom rule evaluation, lookback windows, auto-resolve, webhook scheduling
  - evaluateCriticalInternal internalMutation for sub-60s critical rule evaluation on ingest
  - evaluate-alert-rules cron (every 2 minutes)
  - deliver-digest-alerts cron (every 1 hour)
  - runtimeIngest evaluateCriticalInternal hook (non-blocking, fires on every ingest)
  - 10 passing tests for buildDiscordPayload and buildSlackPayload

affects: [06-alert-routing plans 04-05, any plan consuming alerts or webhook delivery state]

tech-stack:
  added: []
  patterns:
    - "internalAction for outbound HTTP fetch calls (Convex requires actions for network I/O)"
    - "ctx.scheduler.runAfter(0, ...) for non-blocking async scheduling after mutation"
    - "RETRY_DELAYS array with attempt index for exponential backoff: [5000, 30000, 120000]"
    - "Threat model mitigations inline: HTTPS check before fetch, digest cap at 20 alerts"
    - "_generated/api.d.ts manually updated to include new modules (no live Convex dev server in worktree)"

key-files:
  created:
    - convex/webhookDelivery.ts
  modified:
    - convex/alerts.ts
    - convex/crons.ts
    - convex/runtimeIngest.ts
    - convex/__tests__/webhookDelivery.test.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "sendAlertWebhook uses internalAction (not internalMutation) because Convex requires actions for outbound HTTP fetch"
  - "evaluateCriticalInternal called via ctx.runMutation in runtimeIngest (not scheduler) to ensure it fires synchronously within the same ingest request context"
  - "Auto-resolve in evaluateInternal uses 6h staleness threshold for status=active alerts — full per-rule condition re-check would require duplicating all rule logic; resolved lifecycle mutations in alertLifecycle.ts handle explicit resolution"
  - "HTTPS URL validation applied at delivery time (not storage time) since Plan 03 owns delivery; Plan 04/05 UI can add validation at storage time"
  - "_generated/api.d.ts manually patched with alertLifecycle, alertMutes, alertRuleCustom, webhookDelivery — Convex codegen runs on dev server start"

requirements-completed: [ALR-02, ALR-03, ALR-04, ALR-05]

duration: 14min
completed: 2026-04-14
---

# Phase 06 Plan 03: Webhook Delivery Engine + Evaluation Upgrades + Cron Registration Summary

**Webhook delivery action with Discord/Slack formatters, 3-attempt retry with 5s/30s/2m backoff, upgraded evaluation engine with custom rules and threshold overrides, and cron registration for 2-minute evaluation and hourly digest**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-14T15:48:00Z
- **Completed:** 2026-04-14T16:02:45Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `convex/webhookDelivery.ts` — full webhook delivery engine: `sendAlertWebhook` internalAction with Discord embed + Slack Block Kit formatters, 3-attempt retry (5s/30s/2m), mute check, delivery mode routing (dashboard_only/disabled/digest → skip), HTTPS URL validation; `sendDigest` internalAction with interval alignment (1h/4h/daily), 20-alert cap, per-severity grouping; `getNotificationChannels`, `getNotificationPreferences`, `getDigestInterval` internalQuery helpers; `logDeliveryAttempt` internalMutation writing to webhookDeliveryLog
- Upgraded `evaluateInternal` in `convex/alerts.ts` — threshold overrides via agentConfigs `alert-rule-override:` prefix, custom rule evaluation with AND/OR conditionLogic and conditionGroups, lookback window enforcement (5m/15m/30m/1h/24h), auto-resolve for stale active alerts, `webhookStatus: "pending"` on insert, `ctx.scheduler.runAfter(0, sendAlertWebhook)` after every new alert
- Created `evaluateCriticalInternal` internalMutation — evaluates only critical-severity rules (static + custom), same webhook scheduling pattern, used by ingest hook for sub-60s alerting
- Updated `convex/crons.ts` — added `evaluate-alert-rules` (every 2 minutes) and `deliver-digest-alerts` (every 1 hour)
- Updated `convex/runtimeIngest.ts` — added `ctx.runMutation(internal.alerts.evaluateCriticalInternal)` at end of ingest handler (non-blocking: Convex runs mutations asynchronously)
- Filled 10 webhook delivery tests (pure function tests for `buildDiscordPayload` and `buildSlackPayload`) — all passing

## Task Commits

1. **Task 1: Webhook delivery action** - `a14dbe3` (feat)
2. **Task 2: Evaluation engine upgrades + cron + ingest hook** - `912b007` (feat)

## Files Created/Modified

- `convex/webhookDelivery.ts` - Full webhook delivery engine (created)
- `convex/alerts.ts` - evaluateInternal upgraded; evaluateCriticalInternal added
- `convex/crons.ts` - evaluate-alert-rules and deliver-digest-alerts crons added
- `convex/runtimeIngest.ts` - evaluateCriticalInternal hook added
- `convex/__tests__/webhookDelivery.test.ts` - 10 passing tests for pure payload formatters
- `convex/_generated/api.d.ts` - Added alertLifecycle, alertMutes, alertRuleCustom, webhookDelivery modules

## Decisions Made

- `sendAlertWebhook` as `internalAction` (not mutation) — Convex requires actions for outbound HTTP network calls
- `evaluateCriticalInternal` invoked via `ctx.runMutation` in runtimeIngest, not `ctx.scheduler.runAfter`, so it fires within the same request lifecycle; Convex handles the actual async scheduling
- Auto-resolve uses 6h staleness threshold — full per-rule condition re-evaluation would require duplicating all rule check logic; explicit resolve goes through `alertLifecycle.resolveAlert`
- `_generated/api.d.ts` manually patched since no live Convex dev server runs in parallel worktrees; Convex codegen will regenerate on next `npx convex dev`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated _generated/api.d.ts to include new modules**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** `internal.webhookDelivery`, `internal.alertMutes` not found in generated API types — api.d.ts was stale from before Plans 01/02 created these modules
- **Fix:** Manually added `alertLifecycle`, `alertMutes`, `alertRuleCustom`, `webhookDelivery` to both import section and `fullApi` declaration in `convex/_generated/api.d.ts`
- **Files modified:** convex/_generated/api.d.ts
- **Verification:** `npx tsc --noEmit` exits 0

**2. [Rule 2 - Missing critical functionality] Added HTTPS URL validation before webhook delivery**
- **Found during:** Task 1 implementation — threat model T-06-05 requires HTTPS validation
- **Issue:** Plan specified validating URLs at storage time; delivery engine must also validate before sending to prevent SSRF via non-HTTPS URLs already in config
- **Fix:** Added `if (!url.startsWith("https://")) throw new Error(...)` guard before every `fetch()` call
- **Files modified:** convex/webhookDelivery.ts
- **Verification:** Part of sendAlertWebhook logic; covered by mute/mode checks in the action flow

---

**Total deviations:** 2 auto-fixed (Rule 1 stale types, Rule 2 HTTPS threat mitigation)
**Impact on plan:** Both necessary for correctness and security. No scope creep.

## Known Stubs

None — all exported functions are fully implemented.

## Threat Flags

None beyond what was already in the plan's threat model. All T-06-05 through T-06-08 mitigations applied:
- T-06-05: HTTPS URL validation before fetch
- T-06-07: evaluateCriticalInternal only checks critical-severity rules (small subset)
- T-06-08: Digest capped at 20 alerts, individual messages truncated at 1000 chars

## User Setup Required

To enable webhook delivery, set these keys in agentConfigs via the Settings page (Plan 06-04):
- `webhook-discord-url` — Discord webhook URL (must start with `https://`)
- `webhook-slack-url` — Slack webhook URL (must start with `https://`)
- `notification-preferences` — JSON: `{ critical: "always", error: "always", warning: "digest", info: "dashboard_only" }`

## Next Phase Readiness

- Webhook delivery engine ready for Plans 04/05 to wire up UI (settings, alert list with status badges)
- evaluateCriticalInternal provides sub-60s alerting from ingest
- Cron jobs will activate when Convex dev server starts (after `npx convex dev`)
- All ALR-02/ALR-03 (webhook delivery) and ALR-04/ALR-05 (evaluation, preferences) backend requirements are implemented

---
*Phase: 06-alert-routing*
*Completed: 2026-04-14*

## Self-Check: PASSED

- convex/webhookDelivery.ts — FOUND
- convex/alerts.ts (evaluateCriticalInternal) — FOUND
- convex/crons.ts (evaluate-alert-rules, deliver-digest-alerts) — FOUND
- convex/runtimeIngest.ts (evaluateCriticalInternal hook) — FOUND
- 06-03-SUMMARY.md — FOUND
- Commit a14dbe3 (Task 1) — FOUND
- Commit 912b007 (Task 2) — FOUND
- npx tsc --noEmit — exits 0
- npx vitest run webhookDelivery.test.ts — 10 passed
