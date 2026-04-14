---
phase: 06-alert-routing
reviewed: 2026-04-14T18:30:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - convex/__tests__/alertLifecycle.test.ts
  - convex/__tests__/notificationPrefs.test.ts
  - convex/__tests__/notifications.test.ts
  - convex/__tests__/webhookDelivery.test.ts
  - convex/alertLifecycle.ts
  - convex/alertMutes.ts
  - convex/alertRuleCustom.ts
  - convex/alerts.ts
  - convex/crons.ts
  - convex/runtimeIngest.ts
  - convex/schema.ts
  - convex/webhookDelivery.ts
  - src/components/AlertLifecycleActions.tsx
  - src/components/AlertRuleForm.tsx
  - src/components/AlertRulesEngine.tsx
  - src/components/ConditionBuilder.tsx
  - src/components/InboxCard.tsx
  - src/components/MuteDurationPicker.tsx
  - src/components/NotificationChannels.tsx
  - src/components/NotificationPreferences.tsx
  - src/components/WebhookStatusBadge.tsx
  - src/pages/Alerts.tsx
  - src/pages/Inbox.tsx
  - src/pages/Settings.tsx
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-04-14T18:30:00Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Phase 06 implements alert routing, lifecycle management, webhook delivery, notification preferences, and inbox integration. The overall architecture is solid: clean separation between backend mutations/queries, webhook delivery actions with retry logic, and frontend components wired via Convex. Security mitigations (HTTPS-only webhooks, URL masking) are present and well-documented.

Key concerns: (1) the `evaluateCriticalInternal` mutation is invoked on every ingest request, which could cause excessive DB reads; (2) the `setChannel` mutation does not validate the `channel` argument, allowing arbitrary config keys to be written; (3) expired mute records are never cleaned up, accumulating indefinitely; (4) several `alertRules.find()!` calls use non-null assertions that will throw if the rule registry changes.

## Critical Issues

### CR-01: Unrestricted channel name in setChannel allows arbitrary agentConfigs writes

**File:** `convex/webhookDelivery.ts:41-64`
**Issue:** The `setChannel` mutation accepts `channel: v.string()` without validating that the value is `"discord"` or `"slack"`. An attacker or buggy client could call `setChannel({ channel: "../../anything", url: "https://evil.com" })` and write an arbitrary `configKey` like `webhook-../../anything-url` into the `agentConfigs` table. While the URL is validated for `https://`, the config key pollution could overwrite or create unintended configuration entries. This is a data integrity / injection risk.
**Fix:**
```typescript
export const setChannel = mutation({
  args: {
    channel: v.union(v.literal("discord"), v.literal("slack")),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // ... rest of handler
  },
});
```
Apply the same fix to `removeChannel` at line 72.

## Warnings

### WR-01: Non-null assertion on alertRules.find() will crash if rule registry changes

**File:** `convex/alerts.ts:249-251` (and many similar lines throughout evaluate/evaluateInternal)
**Issue:** Throughout the `evaluate` mutation, `alertRules.find((r) => r.id === "std-high-error-rate")!` uses the non-null assertion operator. If a rule ID is removed or renamed in the `alertRules` registry, this will throw at runtime with "Cannot read properties of undefined". The `evaluateInternal` mutation at lines 748-759 handles this correctly with `if (rule)` checks, but the public `evaluate` mutation does not.
**Fix:** Replace all `!` assertions with guard checks:
```typescript
const rule = alertRules.find((r) => r.id === "std-high-error-rate");
if (rule) {
  await createIfNew(rule.id, rule.severity, rule.source, rule.message);
}
```

### WR-02: evaluateCriticalInternal called on every ingest request with no debounce

**File:** `convex/runtimeIngest.ts:542`
**Issue:** Every single ingest HTTP request triggers `evaluateCriticalInternal`, which loads all unacknowledged alerts, disabled config, events, security events, and custom rules. Under high ingest volume this creates substantial DB read amplification. While it is scheduled via `runMutation` (not blocking the response), every ingest still enqueues one full evaluation run.
**Fix:** Consider adding a rate-limiting mechanism -- for example, check a `last-critical-eval` timestamp in `agentConfigs` and skip if evaluated within the last 10-30 seconds. Alternatively, use `ctx.scheduler.runAfter(0, ...)` to schedule an internal action instead of calling the mutation directly, and deduplicate scheduled evaluations.

### WR-03: Expired mute records are never cleaned up from alertMutes table

**File:** `convex/alertMutes.ts:92-139`
**Issue:** `isTargetMuted` and `listActiveMutes` correctly filter out expired mutes at query time, but expired records remain in the database indefinitely. Over time this accumulates stale rows. While not a correctness bug (expired mutes are filtered), it leads to unbounded table growth.
**Fix:** Add a cron job to periodically purge expired mute records:
```typescript
// In crons.ts
crons.interval(
  "cleanup-expired-mutes",
  { hours: 6 },
  internal.alertMutes.cleanupExpired
);
```

### WR-04: Webhook delivery marks success after first channel but may fail on second

**File:** `convex/webhookDelivery.ts:447-508`
**Issue:** In `sendAlertWebhook`, if Discord delivery succeeds but Slack delivery throws, the catch block runs and schedules a retry. However, on retry, Discord will receive a duplicate delivery because there is no per-channel tracking of which channels already succeeded. The `success` flag is only set to `true` if both channels succeed without exception.
**Fix:** Track delivery status per channel and only retry the channel that failed. Alternatively, split the delivery into two independent scheduled actions per channel.

### WR-05: AlertRuleForm handleSave returns early without resetting saving state

**File:** `src/components/AlertRuleForm.tsx:153-156`
**Issue:** In `handleSave`, if `isNaN(thresh)` is true, the function calls `toast.error(...)` and returns, but does not call `setSaving(false)`. The `setSaving(true)` at line 151 was already executed, so the "Saving..." state persists and the button remains disabled until the component re-renders for another reason.
**Fix:**
```typescript
if (isNaN(thresh)) {
  toast.error("Enter a valid threshold number.");
  setSaving(false);
  return;
}
```
Same issue exists at line 165-167 for the empty rule name check.

### WR-06: Custom rule evaluation only supports 3 metrics, UI offers 7

**File:** `convex/alerts.ts:802-811` vs `src/components/ConditionBuilder.tsx:53-61`
**Issue:** The `evaluateCondition` function in `evaluateInternal` only handles `error_rate`, `event_count`, and `error_count` metrics. The ConditionBuilder UI offers 7 metrics including `cost_per_hour`, `stall_duration`, `security_blocks`, `execution_failures`, `latency_p95`, and `memory_usage`. Custom rules using these unsupported metrics will silently evaluate to `value = 0`, producing false negatives (rules that never fire despite conditions being met).
**Fix:** Either implement the remaining metric calculations in the evaluation function, or restrict the UI metrics list to only those the backend supports, with a comment noting which are pending implementation.

## Info

### IN-01: Duplicated relativeTime helper across three files

**File:** `src/components/WebhookStatusBadge.tsx:19-29`, `src/components/InboxCard.tsx:55-65`, `src/pages/Alerts.tsx:14-21`
**Issue:** The `relativeTime` function is implemented independently in three locations with slightly different behavior (InboxCard uses milliseconds, Alerts uses seconds). This creates maintenance risk if the logic needs to change.
**Fix:** Extract to a shared utility like `src/utils/time.ts`.

### IN-02: console.error left in NotificationPreferences

**File:** `src/components/NotificationPreferences.tsx:94`
**Issue:** `console.error("Failed to save preferences:", err)` is present in production code.
**Fix:** Replace with a user-facing toast notification or remove if the Convex error handling already surfaces the error.

### IN-03: Type assertion as any on custom rules list

**File:** `src/components/AlertRulesEngine.tsx:400`
**Issue:** `customRules.map((rule: any) => ...)` uses `any` type, bypassing TypeScript safety for the custom rule object shape.
**Fix:** Define a proper type for the custom rule and remove the `any` assertion.

### IN-04: Tests are primarily export-existence checks with many .todo stubs

**File:** `convex/__tests__/alertLifecycle.test.ts`, `convex/__tests__/notificationPrefs.test.ts`, `convex/__tests__/notifications.test.ts`
**Issue:** Most tests only verify that exports are defined (e.g., `expect(alertLifecycle.acknowledgeAlert).toBeDefined()`) without testing actual behavior. The `webhookDelivery.test.ts` file is the exception, with meaningful payload structure tests. The `.todo` tests indicate planned but unimplemented coverage for critical behavior like state transitions, mute expiry, and auto-resolve logic.
**Fix:** Prioritize implementing the `.todo` tests for critical paths (acknowledge transitions, mute expiry, auto-resolve).

---

_Reviewed: 2026-04-14T18:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
