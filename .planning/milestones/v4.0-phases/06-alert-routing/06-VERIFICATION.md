---
phase: 06-alert-routing
verified: 2026-04-14T16:45:00Z
status: human_needed
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Configure a Discord webhook URL in Settings > Notification Channels. Trigger an alert by breaching a threshold. Verify Discord receives a rich embed with severity color within 60 seconds."
    expected: "Discord embed appears with correct severity color (red for critical), rule name, threshold, and timestamp within 60 seconds of trigger."
    why_human: "Requires running Convex backend with live cron, ingest hook, and external Discord endpoint. Cannot verify sub-60s delivery timing programmatically."
  - test: "Configure a Slack webhook URL in Settings > Notification Channels. Trigger an alert. Verify Slack receives a Block Kit message within 60 seconds."
    expected: "Slack Block Kit message appears with severity emoji, rule name, triggered timestamp, and View in CodePulse button within 60 seconds."
    why_human: "Requires running Convex backend with live cron and external Slack endpoint. Cannot verify timing without a live deployment."
  - test: "On Alerts page, click Acknowledge on an active alert. Verify the row immediately dims to opacity-60 and shows Acknowledged badge."
    expected: "Alert row transitions to opacity-60 with Acknowledged badge. Alert status in Convex updates to acknowledged."
    why_human: "Optimistic UI behavior requires browser rendering and live Convex connection."
  - test: "On Alerts page, click Mute on an alert, select 1h. Verify Mute changes to Unmute and alert row shows clock icon + Muted label."
    expected: "Alert row shows muted state indicator. alertMutes record created in Convex with expiresAt = now + 3600."
    why_human: "Requires live Convex backend to verify mute record creation and UI reactivity."
  - test: "On Alerts page, click Escalate on an alert, verify dialog is pre-filled with alert title and severity-mapped priority. Click Create Task. Verify Kanban board shows the new task."
    expected: "Task appears in Kanban backlog. Alert row shows Linked to task badge. alertLifecycle.escalateToTask creates bidirectional linkage (task.alertId + alert.linkedTaskId)."
    why_human: "Requires live Convex backend and cross-page Kanban verification."
  - test: "Set warning severity to Digest mode in Settings > Notification Preferences. Trigger a warning alert. Verify it does NOT immediately send to Discord/Slack but appears in the dashboard."
    expected: "Warning alert visible in dashboard but no immediate webhook delivery. Digest cron sends it in the next hourly batch."
    why_human: "Requires live backend with configurable delivery modes; digest timing requires waiting for hourly cron or inspecting delivery log."
  - test: "Navigate to Inbox page. Verify active alerts appear as inbox items with Acknowledge and Mute inline actions."
    expected: "Alert items appear in unified inbox with severity-appropriate styling, acknowledge button, and mute popover."
    why_human: "Requires live Convex connection to verify real-time alert-to-inbox mapping and inline action wiring."
---

# Phase 6: Alert Routing Verification Report

**Phase Goal:** Operators receive notifications within 60 seconds of threshold breaches and can manage alerts without leaving the dashboard
**Verified:** 2026-04-14T16:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator can create an alert rule with a threshold and see it listed in the Alerts page | VERIFIED | `AlertRulesEngine.tsx` has "+ New Custom Rule" button, opens `AlertRuleForm` Sheet in custom mode. `alertRuleCustom.create` mutation wired. `alertRuleCustom.list` query populates CUSTOM RULES section. `setThresholdOverride` wired to static rule rows via hover input. |
| 2 | A triggered alert delivers a notification to a configured Discord webhook within 60 seconds | VERIFIED (code; timing needs human) | `evaluateCriticalInternal` fires synchronously on every ingest event. `evaluate-alert-rules` cron runs every 2 minutes. After alert creation, `ctx.scheduler.runAfter(0, sendAlertWebhook)` schedules immediate delivery. `buildDiscordPayload` produces rich embed with severity color map. 3-attempt retry with 5s/30s/2m backoff. Sub-60s path exists for critical alerts via ingest hook. |
| 3 | A triggered alert delivers a notification to a configured Slack webhook within 60 seconds | VERIFIED (code; timing needs human) | Same evaluation pipeline as Discord. `buildSlackPayload` produces Block Kit message with severity emoji. Both channels sent in same `sendAlertWebhook` action. |
| 4 | Operator can mute, acknowledge, and escalate any alert from the dashboard | VERIFIED | `AlertLifecycleActions.tsx` renders Acknowledge (single-click), Mute (MuteDurationPicker popover), and Escalate (Dialog). Wired to `api.alertLifecycle.acknowledgeAlert`, `api.alertMutes.muteTarget`/`unmuteTarget`, `api.alertLifecycle.escalateToTask`. `AlertLifecycleActions` imported and used in `src/pages/Alerts.tsx`. |
| 5 | Per-severity notification preferences work — critical always notify, warning to digest | VERIFIED | `NotificationPreferences.tsx` renders 4 severity selects with modes (always/digest/dashboard_only/disabled). `webhookDelivery.setPreferences` persists to agentConfigs with server-side validation. `sendAlertWebhook` reads preferences and routes accordingly — `"digest"` skips immediate delivery. Settings page imports both `NotificationChannels` and `NotificationPreferences`. |
| 6 | One-click "Create Task from Alert" converts alert to Kanban task | VERIFIED | `alertLifecycle.escalateToTask` inserts into tasks table with `alertId`, patches alert with `linkedTaskId`, maps severity to priority (critical→urgent, error→high, warning→medium, info→low). UI shows "Create Task" button in escalation dialog and "Linked to task" badge on success. |
| 7 | All alerts surface in Unified Inbox | VERIFIED | `src/pages/Inbox.tsx` calls `useQuery(api.alerts.listActive)`, maps via `alertToInboxItem` to InboxItem with `type: "alert"` and `alertId`. `InboxCard.tsx` renders `AlertInlineActions` (Acknowledge + Mute) when `type === "alert"`. Inbox filter includes `"alerts"` filter path. |

**Score:** 7/7 truths verified (code-level)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `convex/schema.ts` | alertRuleCustom, alertMutes, webhookDeliveryLog tables; alerts/tasks field extensions | VERIFIED | All 3 new tables present. `status`, `resolvedAt`, `ruleId`, `linkedTaskId`, `webhookStatus`, `webhookDeliveredAt`, `webhookAttempts` on alerts. `alertId` on tasks. Indexes `by_status`, `by_alertId` added. |
| `convex/alertLifecycle.ts` | acknowledgeAlert, resolveAlert, escalateToTask mutations | VERIFIED | All 3 exports found at lines 8, 23, 50. `column: "backlog"` and `alertId: args.alertId` present. |
| `convex/alertRuleCustom.ts` | create, update, remove, list, setThresholdOverride, getThresholdOverride mutations/queries | VERIFIED | All exports present. setThresholdOverride at line 111, getThresholdOverride at 140, listThresholdOverrides at 154. |
| `convex/alertMutes.ts` | muteTarget, unmuteTarget, isTargetMuted, isTargetMutedPublic, listActiveMutes | VERIFIED | All 5 exports present at lines 39, 74, 92, 112, 132. |
| `convex/webhookDelivery.ts` | sendAlertWebhook, sendDigest, Discord/Slack formatters, retry logic | VERIFIED | All exports present. RETRY_DELAYS=[5000,30000,120000] at line 400. getNotificationChannels, getNotificationPreferences, logDeliveryAttempt, getChannels, setChannel, removeChannel, testWebhook, getPreferences, setPreferences all present. |
| `convex/crons.ts` | evaluate-alert-rules (2min), deliver-digest-alerts (1h) | VERIFIED | Both registrations present at lines 36-43. |
| `convex/runtimeIngest.ts` | evaluateCriticalInternal hook | VERIFIED | `ctx.runMutation(internal.alerts.evaluateCriticalInternal)` at line 542. |
| `src/components/NotificationChannels.tsx` | Webhook URL inputs, Send Test buttons, font-mono, NOTIFICATION CHANNELS | VERIFIED | All content verified: NOTIFICATION CHANNELS header at line 278, font-mono at 171, Send Test at 211. |
| `src/components/NotificationPreferences.tsx` | Per-severity selects, Save Preferences, NOTIFICATION PREFERENCES | VERIFIED | All content verified at lines 102, 150. All 4 modes (always/digest/dashboard_only/disabled) present. |
| `src/pages/Settings.tsx` | NotificationChannels and NotificationPreferences imported | VERIFIED | Both imports at lines 14-15, rendered at 623, 630. |
| `src/components/AlertLifecycleActions.tsx` | Acknowledge/Mute/Escalate, Create Task, alertLifecycle wiring | VERIFIED | acknowledgeAlert at line 71, escalateToTask at 74, muteTarget at 72, Create Task dialog at 243. "Linked to task" badge at 180. |
| `src/components/MuteDurationPicker.tsx` | Popover, 5 duration options, "Mute for how long?" | VERIFIED | All 5 options (15m/1h/4h/24h/indefinite) at lines 25-29. Header at line 44. |
| `src/components/WebhookStatusBadge.tsx` | Status dots using --status-ok/error/warn CSS vars | VERIFIED | All 3 CSS vars at lines 41, 52, 63. |
| `src/components/AlertRuleForm.tsx` | Sheet, Save Rule, w-[480px], override/custom modes | VERIFIED | Sheet width at line 227, Save Rule at 375. create/update/setThresholdOverride mutations wired at lines 90-98. |
| `src/components/ConditionBuilder.tsx` | AND/OR logic, 5 lookback windows, Add condition | VERIFIED | LOOKBACK_WINDOWS = ["5m","15m","30m","1h","24h"] at line 71. AND/OR toggle present. Add condition at line 335. |
| `src/components/AlertRulesEngine.tsx` | New Custom Rule, CUSTOM RULES section, setThresholdOverride | VERIFIED | "+ New Custom Rule" at line 336, CUSTOM RULES at 397, setThresholdOverride at 54. |
| `src/components/InboxCard.tsx` | alertId prop, AlertInlineActions with acknowledge/mute | VERIFIED | alertId at line 43, AlertInlineActions with acknowledgeAlert at 101, muteTarget at 109. |
| `src/pages/Inbox.tsx` | useQuery for active alerts, alertToInboxItem mapping | VERIFIED | listActive query at line 125, alertToInboxItem at 48, type: "alert" at 63. |
| `convex/__tests__/alertLifecycle.test.ts` | Wave 0 stubs for ALR-04/ALR-06 | VERIFIED | 20 entries (mix of test.todo and import-verification passing tests). |
| `convex/__tests__/notificationPrefs.test.ts` | Stubs/tests for ALR-05 | VERIFIED | 10 entries (import-verification tests, all passing per summary). |
| `convex/__tests__/webhookDelivery.test.ts` | Tests for ALR-02/ALR-03 | VERIFIED | 10 entries (pure function tests for buildDiscordPayload/buildSlackPayload). |
| `convex/__tests__/notifications.test.ts` | ALR-07 inbox integration stubs | VERIFIED | describe("Inbox Integration (ALR-07)") with 5 test.todo stubs at lines 50-55. |
| shadcn components (accordion, tabs, table, alert) | UI component dependencies | VERIFIED | All 4 present in `src/components/ui/`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convex/alerts.ts` | `convex/webhookDelivery.ts` | `ctx.scheduler.runAfter(0, sendAlertWebhook)` | WIRED | Lines 723, 883 in alerts.ts confirm scheduling after alert insert. |
| `convex/webhookDelivery.ts` | `convex/alertMutes.ts` | `isTargetMuted` check before delivery | WIRED | `internal.alertMutes.isTargetMuted` called at line 431 in webhookDelivery.ts. |
| `convex/runtimeIngest.ts` | `convex/alerts.ts` | `evaluateCriticalInternal` on ingest | WIRED | Line 542 calls `internal.alerts.evaluateCriticalInternal`. |
| `convex/alertLifecycle.ts` | `convex/tasks.ts` | `escalateToTask` inserts task with alertId | WIRED | Line 71: `column: "backlog"`, line 74: `alertId: args.alertId` in db.insert. |
| `src/components/AlertLifecycleActions.tsx` | `convex/alertLifecycle.ts` | `useMutation` for acknowledge/escalate | WIRED | Lines 71, 74: useMutation calls confirmed. |
| `src/components/MuteDurationPicker.tsx` via `AlertLifecycleActions.tsx` | `convex/alertMutes.ts` | `useMutation` for muteTarget | WIRED | Lines 72-73: useMutation(api.alertMutes.muteTarget/unmuteTarget) confirmed. |
| `src/components/AlertRuleForm.tsx` | `convex/alertRuleCustom.ts` | `useMutation` for create/update/setThresholdOverride | WIRED | Lines 90-98: all mutations confirmed. |
| `src/components/InboxCard.tsx` | `convex/alertLifecycle.ts` | Acknowledge/Mute inline actions | WIRED | Line 101: acknowledgeAlert, line 109: muteTarget. |
| `src/pages/Inbox.tsx` | `convex/alerts.ts` | Inbox query includes active alerts | WIRED | Line 125: `useQuery(api.alerts.listActive)`. |
| `src/components/NotificationChannels.tsx` | `convex/webhookDelivery.ts` | `useMutation` for setChannel | WIRED | Confirmed via summary — `useQuery(api.webhookDelivery.getChannels)`, `useMutation(api.webhookDelivery.setChannel)`, `useAction(api.webhookDelivery.testWebhook)`. |
| `src/components/NotificationPreferences.tsx` | `convex/webhookDelivery.ts` | `useMutation` for setPreferences | WIRED | Confirmed via summary — `useQuery(api.webhookDelivery.getPreferences)`, `useMutation(api.webhookDelivery.setPreferences)`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/pages/Alerts.tsx` | Alert rows | `api.alerts.listActive` / `api.alerts.listAllPaginated` (existing query) | Yes — Convex DB queries | FLOWING |
| `src/pages/Inbox.tsx` | alertItems | `api.alerts.listActive` → `alertToInboxItem` mapper | Yes — real Convex query | FLOWING |
| `src/components/AlertRulesEngine.tsx` | customRules | `api.alertRuleCustom.list` | Yes — queries alertRuleCustom table | FLOWING |
| `src/components/WebhookStatusBadge.tsx` | status, deliveredAt, attempts | Alert record props (webhookStatus, webhookDeliveredAt, webhookAttempts) | Yes — populated by updateWebhookStatus internalMutation after delivery | FLOWING |
| `src/components/NotificationChannels.tsx` | discordUrl, slackUrl | `api.webhookDelivery.getChannels` → agentConfigs | Yes — real agentConfigs queries | FLOWING |
| `src/components/NotificationPreferences.tsx` | prefs per severity | `api.webhookDelivery.getPreferences` → agentConfigs | Yes — real agentConfigs queries with defaults | FLOWING |

### Behavioral Spot-Checks

Step 7b skipped — requires running Convex backend and external webhook endpoints. Human verification items below cover the key behaviors.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| ALR-01 | 06-01, 06-02, 06-05 | Configure alert rules with threshold triggers | SATISFIED | alertRuleCustom CRUD implemented. Threshold overrides in agentConfigs. AlertRuleForm + AlertRulesEngine UI wired. |
| ALR-02 | 06-01, 06-03 | Discord webhook notification within 60 seconds | SATISFIED (code) | sendAlertWebhook with buildDiscordPayload, retry logic, evaluateCriticalInternal on ingest, 2-min cron. Timing requires human verification. |
| ALR-03 | 06-01, 06-03 | Slack webhook notification within 60 seconds | SATISFIED (code) | sendAlertWebhook with buildSlackPayload. Same pipeline as Discord. Timing requires human verification. |
| ALR-04 | 06-01, 06-02, 06-05 | Mute, acknowledge, and escalate from dashboard | SATISFIED | acknowledgeAlert, resolveAlert, escalateToTask, muteTarget, unmuteTarget fully implemented. AlertLifecycleActions UI wired. |
| ALR-05 | 06-01, 06-03, 06-04 | Per-severity notification preferences | SATISFIED | getPreferences/setPreferences with validation. NotificationPreferences UI. sendAlertWebhook respects delivery mode (always/digest/dashboard_only/disabled). |
| ALR-06 | 06-01, 06-02, 06-05 | One-click Create Task from Alert | SATISFIED | escalateToTask creates Kanban task with bidirectional linkage. UI escalation dialog wired with Create Task button and "Linked to task" badge. |
| ALR-07 | 06-01, 06-05 | All alerts surface in Unified Inbox | SATISFIED | Inbox.tsx queries listActive, maps to InboxItem with type:"alert". InboxCard renders AlertInlineActions for alert items. |

**Note on ALR-06 and ALR-07:** These requirement IDs appear in ROADMAP.md and plan frontmatter but are NOT defined in REQUIREMENTS.md (which only covers ALR-01 through ALR-05). The REQUIREMENTS.md traceability table maps ALR-01 through ALR-05 to Phase 4 (which appears to be an earlier numbering). ALR-06 (escalation) and ALR-07 (inbox) were introduced as extended requirements during Phase 6 planning. They are implemented but REQUIREMENTS.md should be updated to formally define them.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/components/AlertLifecycleActions.tsx` lines 200, 214 | `placeholder=` in Input fields | Info | Standard HTML placeholder text in form inputs — not a stub, expected UX pattern. |
| `src/components/ConditionBuilder.tsx` line 139 | `placeholder="0"` | Info | Standard numeric input placeholder — not a stub. |
| `src/components/AlertRuleForm.tsx` lines 271, 309, 363 | `placeholder=` in inputs | Info | Standard form placeholder text — not a stub. |

No blocker or warning-level anti-patterns found. All placeholder strings are legitimate UI copy in form inputs, not stub implementations.

### Human Verification Required

#### 1. Discord Webhook Delivery within 60 Seconds

**Test:** Configure a Discord webhook URL in Settings > Notification Channels. Trigger a critical alert by breaching a configured threshold (or manually invoke `evaluateInternal`). Monitor Discord channel.
**Expected:** Discord embed appears within 60 seconds with correct severity color (red/orange/yellow/blue), alert message, rule name, triggered timestamp, and "View in CodePulse" link.
**Why human:** Sub-60s delivery timing requires a running Convex deployment with active cron scheduler and real outbound HTTP to Discord.

#### 2. Slack Webhook Delivery within 60 Seconds

**Test:** Configure a Slack webhook URL in Settings > Notification Channels. Trigger an alert.
**Expected:** Slack Block Kit message appears within 60 seconds with severity emoji, rule name, timestamp, and View in CodePulse button.
**Why human:** Same timing and external service dependency as Discord.

#### 3. Alert Lifecycle Actions — Acknowledge, Mute, Escalate

**Test:** On Alerts page with an active alert: (a) click Acknowledge, (b) click Mute and select 1h, (c) click Escalate and submit Create Task.
**Expected:** (a) Row dims to opacity-60 with Acknowledged badge. (b) Row shows muted state with clock icon. (c) Kanban board shows new task; alert row shows "Linked to task" badge.
**Why human:** Optimistic UI transitions, real-time Convex reactivity, and cross-page Kanban verification require browser rendering.

#### 4. Per-Severity Delivery Mode Routing

**Test:** Set warning severity to "Digest" mode in Notification Preferences. Trigger a warning alert. Verify it does NOT immediately deliver to Discord/Slack. Wait for hourly digest (or inspect webhookDeliveryLog in Convex dashboard).
**Expected:** Warning alert shows in dashboard with webhookStatus="pending" (not "delivered"). Digest cron eventually sends it.
**Why human:** Requires live backend and either waiting for hourly cron or Convex dashboard inspection.

#### 5. Unified Inbox — Alert Items with Inline Actions

**Test:** Navigate to Inbox page. Verify active alerts appear as inbox items with type "alert" and have Acknowledge and Mute inline action buttons. Click Acknowledge on an alert inbox item.
**Expected:** Alert items appear in inbox feed sorted by createdAt. Inline actions are functional. Acknowledged alert updates in Convex.
**Why human:** Requires live Convex connection to verify real-time data and action wiring.

#### 6. Custom Rule Creation and Listing

**Test:** In AlertRulesEngine, click "+ New Custom Rule". Fill in name, select severity, add 2 conditions with AND logic, select lookback windows. Click Save Rule. Verify rule appears in CUSTOM RULES section.
**Expected:** Custom rule persisted to alertRuleCustom table and immediately visible in the UI list.
**Why human:** Requires live Convex backend to verify DB write and real-time query reactivity.

#### 7. Threshold Override Persistence

**Test:** Hover over a static rule row in AlertRulesEngine. Input a threshold override value. Press Enter or blur. Verify the override persists on page refresh.
**Expected:** setThresholdOverride writes to agentConfigs. Page reload shows the override value still in the input.
**Why human:** Requires live Convex backend for persistence verification.

---

## Gaps Summary

No gaps blocking goal achievement at the code level. All 7 success criteria are implemented and wired. The `human_needed` status reflects that the two most critical criteria (Discord/Slack delivery within 60 seconds — SCs 2 and 3) involve timing guarantees and external service integrations that cannot be verified programmatically without a running deployment.

**One administrative gap:** ALR-06 and ALR-07 are referenced in ROADMAP.md and plan frontmatter but are not formally defined in REQUIREMENTS.md (which only covers ALR-01 through ALR-05, with a traceability table mapping them to "Phase 4"). REQUIREMENTS.md should be updated to add ALR-06 (escalation to Kanban task) and ALR-07 (unified inbox integration) with Phase 6 traceability.

---

_Verified: 2026-04-14T16:45:00Z_
_Verifier: Claude (gsd-verifier)_
