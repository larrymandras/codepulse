---
phase: 06-alert-routing
fixed_at: 2026-04-14T18:45:00Z
review_path: .planning/phases/06-alert-routing/06-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-04-14T18:45:00Z
**Source review:** .planning/phases/06-alert-routing/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 6
- Skipped: 1

## Fixed Issues

### CR-01: Unrestricted channel name in setChannel allows arbitrary agentConfigs writes

**Files modified:** `convex/webhookDelivery.ts`
**Commit:** 4b0bfcd
**Applied fix:** Changed `channel: v.string()` to `channel: v.union(v.literal("discord"), v.literal("slack"))` in both `setChannel` and `removeChannel` mutations, preventing arbitrary config key injection.

### WR-01: Non-null assertion on alertRules.find() will crash if rule registry changes

**Files modified:** `convex/alerts.ts`
**Commit:** d5fd63a
**Applied fix:** Replaced all 43 non-null assertion (`!`) operators on `alertRules.find()` calls in the `evaluate` mutation with guard checks (`if (rule) await createIfNew(...)`). If a rule ID is removed or renamed, the evaluation now safely skips it instead of crashing.

### WR-02: evaluateCriticalInternal called on every ingest request with no debounce

**Files modified:** `convex/alerts.ts`, `convex/runtimeIngest.ts`
**Commit:** 03c4fe4
**Applied fix:** Added a `getLastCriticalEvalTimestamp` internal query and a rate-limit check in the ingest handler that skips `evaluateCriticalInternal` if it was called within the last 15 seconds. The mutation now writes a `last-critical-eval` timestamp to `agentConfigs` after each evaluation. Status: fixed: requires human verification (logic change).

### WR-03: Expired mute records are never cleaned up from alertMutes table

**Files modified:** `convex/alertMutes.ts`, `convex/crons.ts`
**Commit:** 4e19c6c
**Applied fix:** Added a `cleanupExpired` internal mutation to `alertMutes.ts` that deletes all mute records where `expiresAt` is in the past. Registered a cron job in `crons.ts` to run this cleanup every 6 hours.

### WR-05: AlertRuleForm handleSave returns early without resetting saving state

**Files modified:** `src/components/AlertRuleForm.tsx`
**Commit:** 5cf2b5b
**Applied fix:** Added `setSaving(false)` before the `return` statement in both early-exit validation paths (invalid threshold at line 154 and empty rule name at line 165), so the save button is re-enabled after validation errors.

### WR-06: Custom rule evaluation only supports 3 metrics, UI offers 7

**Files modified:** `src/components/ConditionBuilder.tsx`
**Commit:** cc3bf04
**Applied fix:** Restricted the `METRICS` constant to the 3 metrics the backend actually supports (`error_rate`, `event_count`, `error_count`). Added a comment documenting the 4 pending metrics (`cost_per_hour`, `stall_duration`, `security_blocks`, `execution_failures`, `latency_p95`, `memory_usage`) for future backend implementation.

## Skipped Issues

### WR-04: Webhook delivery marks success after first channel but may fail on second

**File:** `convex/webhookDelivery.ts:447-508`
**Reason:** Requires significant architectural refactoring to split delivery into per-channel tracked actions with independent retry logic. The current sequential approach with a shared success flag needs to be replaced with independent scheduled actions per channel, which is too large a change to apply safely without dedicated testing. Recommend addressing in a follow-up task.
**Original issue:** In `sendAlertWebhook`, if Discord delivery succeeds but Slack delivery throws, on retry Discord receives a duplicate because there is no per-channel tracking of which channels already succeeded.

---

_Fixed: 2026-04-14T18:45:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
