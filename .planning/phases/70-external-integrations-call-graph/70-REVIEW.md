---
phase: 70-external-integrations-call-graph
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - convex/emailTemplates/DigestEmailTemplate.tsx
  - convex/emailDigest.test.ts
  - convex/pagerdutyDelivery.test.ts
  - src/components/CallGraphPanel.test.tsx
  - src/components/EmailDigestConfig.test.tsx
  - convex/schema.ts
  - convex/deliveryLogs.ts
  - convex/emailDigest.ts
  - convex/pagerdutyDelivery.ts
  - convex/crons.ts
  - convex/alerts.ts
  - src/components/CallGraphSVG.tsx
  - src/components/CallGraphPanel.tsx
  - src/components/EmailDigestConfig.tsx
  - src/components/DeliveryHistory.tsx
  - src/pages/Settings.tsx
  - src/pages/Infrastructure.tsx
  - src/components/AlertRuleForm.tsx
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 70: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 70 adds email digest delivery (via Resend), PagerDuty incident trigger/resolve, and the call graph SVG panel. The core delivery mechanics are sound — errors are caught and logged, and the guard order is generally correct. However, there are three blockers: a PagerDuty routing key is persisted and displayed in plaintext in the database and in alert delivery logs despite being credential-grade sensitive material; a PagerDuty resolve race can fire against an alert created in the *current* eval cycle, prematurely resolving incidents that just triggered; and the `getCustomRuleById` internalQuery does an unvalidated `ctx.db.get(args.id as any)` with a bare `catch {}` that silently swallows all DB errors including schema violations. Several warnings cover logic gaps: duplicate email delivery attempts, a `schedule` field saved but never acted upon, missing validation on the PD routing key at save time, and broken edge-to-source dedup in the call graph edge-status resolution.

---

## Critical Issues

### CR-01: PagerDuty routing key stored and logged as plaintext

**File:** `convex/schema.ts:912-916`, `convex/pagerdutyDelivery.ts:38`, `convex/alerts.ts:873`

**Issue:** `alertRuleCustom.pagerdutyConfig.routingKey` is a PagerDuty integration key — credential-grade material that grants anyone with the key the ability to trigger and resolve incidents in the target service. It is stored verbatim in the Convex document, rendered verbatim in `pagerdutyDelivery.ts` payload construction, and echoed back in the `dedupKey` preview shown in `AlertRuleForm.tsx` line 413 (`...${pdRoutingKey.slice(-6)}`). The last 6 chars of a 32-char routing key are not sufficient masking. Additionally, the full key ends up readable by any Convex function that calls `getCustomRuleById`.

This is an acceptable architecture **only if** the Convex deployment is treated as a secrets store with strict access control, but no such control exists here — all `internalQuery` results are accessible to any other internal function. The key also propagates into `pagerdutyDeliveryLog.dedupKey` (which is the rule id, not the key itself — but the pattern is dangerous because a log that accidentally serialized the payload would expose it).

**Fix:** Encrypt the routing key at rest using a Convex-side secret (e.g., encrypt before insert, decrypt inside the internalAction only). At minimum, mask all but the last 4 characters in any UI display and confirm the key is never written to any log table.

```typescript
// In AlertRuleForm.tsx line 413 — change display mask from last 6 to last 4:
`On — ...${pdRoutingKey.slice(-4)}`

// In pagerdutyDelivery.ts — decrypt the key only inside the action, never expose it in logs:
// Do NOT log the routing_key field at any point.
```

---

### CR-02: PagerDuty auto-resolve fires against alerts that just triggered in the same eval cycle

**File:** `convex/alerts.ts:882-900`

**Issue:** The resolve loop at the end of `evaluateInternal` iterates `customRules` and checks whether a rule had an active alert in `stillActive` (loaded *before* this eval cycle ran) but did NOT appear in `created` this cycle. The intent is correct — resolve if the condition cleared. However, `created` tracks rule IDs added as string via `created.push(ruleId)` (line 729), but `createIfNew` is called with `customRule._id` at line 870:

```typescript
const newAlertId = await createIfNew(customRule._id, ...)
created.push(ruleId)   // <— ruleId is customRule._id here
```

That part is fine. The race is different: `stillActive` is loaded at line 696 *after* the auto-resolve loop at lines 679–693. Any alert that was resolved by the age-based auto-resolve (line 689) is NOT removed from `stillActive` because `stillActive` is the re-query at line 699 which only filters `by_acknowledged` — a resolved alert with `acknowledged=false` and `status="resolved"` will still appear in `stillActive`. If a rule's previous active alert is age-resolved this cycle, and the rule also does NOT re-trigger, the resolve loop finds the alert in `stillActive` (because it's unacknowledged), doesn't see it in `created`, and fires a *second* PD resolve for an alert that was already resolved via the age path. This is a duplicate PD event, not a dangerous one, but it indicates the state machine is incorrect.

More critically: when an alert WAS active, its condition cleared (so no new alert fires this cycle), and the alert is within the 6-hour auto-resolve window (so age-resolve didn't touch it), the resolve loop correctly fires PD resolve. But `activeAlert._id` passed to `sendPagerdutyResolve` is the *old* alert's ID. That alert may have been resolved by a prior admin action (acknowledged + status="resolved") while `acknowledged` remains `false` due to the distinction between `acknowledge` and `resolve` semantics. This is a minor edge case but represents state inconsistency.

**Fix:** Filter `stillActive` to only alerts with `status === "active"` before the resolve loop, to avoid resolving already-resolved incidents:

```typescript
const resolveEligible = stillActive.filter(
  (a) => a.status === "active" || a.status == null
);
// Use resolveEligible instead of stillActive in the resolve loop at line 889
```

---

### CR-03: `getCustomRuleById` uses unsafe type cast `as any` on a Convex document ID

**File:** `convex/pagerdutyDelivery.ts:163-175`

**Issue:** The function receives a `v.string()` arg and calls `ctx.db.get(args.id as any)`. Convex's `db.get` expects a typed `Id<TableName>`. Casting an arbitrary string as `any` and passing it to `db.get` will throw a runtime error if the string is not a valid Convex document ID, which is silently caught and returns `null`. This means a malformed `ruleId` (e.g., empty string, truncated ID, ID from a different table) always returns `null`, causing `sendPagerdutyAlert` and `sendPagerdutyResolve` to silently skip delivery without logging any failure. An operator would see the PD trigger "succeed" at the mutation layer but no incident in PagerDuty, with no error in the delivery log.

The bare `catch {}` at line 172 hides the error completely:

```typescript
try {
  const doc = await ctx.db.get(args.id as any);
  return doc ?? null;
} catch {
  return null;  // silent failure — no logging
}
```

**Fix:** Accept `v.id("alertRuleCustom")` and use the proper typed ID. If the arg must remain a string for cross-table flexibility, validate it explicitly and log failures:

```typescript
export const getCustomRuleById = internalQuery({
  args: { id: v.id("alertRuleCustom") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

If the callers pass string IDs, update them to use the typed `Id<"alertRuleCustom">` from their alert data.

---

## Warnings

### WR-01: Email digest always logs `attempt: 1` — retry state is never tracked

**File:** `convex/emailDigest.ts:176`, `convex/emailDigest.ts:248`, `convex/emailDigest.ts:261`

**Issue:** Every call to `insertEmailLog` hard-codes `attempt: 1`. The schema has an `attempt` field explicitly to support retry tracking. When a send fails, the cron will re-fire the following day with attempt 1 again. The delivery history UI will show multiple attempt-1 entries with no way to distinguish a first-try failure from a recurring daily failure. This makes the audit log misleading.

**Fix:** Either persist retry count in `agentConfigs` and increment it per delivery, or document that the `attempt` field for digest emails always means "1 per cron fire" and rename it `cronFire` to avoid confusion. At minimum, don't use a field named `attempt` with a hardcoded value of `1`.

---

### WR-02: `schedule` config value is saved but never consulted by the cron

**File:** `convex/crons.ts:63-67`, `convex/emailDigest.ts:61-98`

**Issue:** `setEmailDigestConfig` saves `schedule` ("daily", "weekly", "both") to `agentConfigs`. `SCHEDULE_OPTIONS` in `EmailDigestConfig.tsx` offers "Daily", "Weekly", and "Daily + Weekly". However, `sendEmailDigest` at line 183 reads only `config.enabled` — it never reads `config.schedule`. The cron is hardwired to fire daily at 06:05 UTC regardless of the schedule setting. A user who selects "Weekly" will still receive daily digests. This is a logic gap — the saved preference has no effect.

**Fix:** Either read `config.schedule` in `sendEmailDigest` and gate delivery based on day-of-week, or remove the schedule UI option until the logic is implemented to honor it.

---

### WR-03: `getLatestBriefingNarrative` fetches without ordering — returns arbitrary briefing

**File:** `convex/emailDigest.ts:140-149`

**Issue:**

```typescript
const briefing = await ctx.db
  .query("briefings")
  .order("desc")
  .first();
```

`.order("desc")` on a table without `.withIndex(...)` orders by `_creationTime` (Convex's implicit field), not by `generatedAt`. If briefings are ever inserted out of chronological order (e.g., a backfill), the query may return a stale briefing narrative in the email. The `briefings` table has `index("by_type_generated", ["type", "generatedAt"])` which is the correct index to use here.

**Fix:**

```typescript
const briefing = await ctx.db
  .query("briefings")
  .withIndex("by_type_generated", (q) => q.eq("type", "daily_digest"))
  .order("desc")
  .first();
```

---

### WR-04: PagerDuty resolve sends empty payload body — no `payload` field

**File:** `convex/pagerdutyDelivery.ts:118-123`

**Issue:** The resolve action sends:

```typescript
{
  routing_key: ...,
  event_action: "resolve",
  dedup_key: dedupKey,
}
```

The PagerDuty Events API v2 `resolve` action accepts but does not require a `payload` block. However, the trigger's `dedup_key` is `codepulse-${args.ruleId}` where `ruleId` is the Convex document `_id` string. The resolve uses the same formula, which is correct for dedup matching. This is fine mechanically, but the error message logged on non-OK HTTP response omits the response body: `\`HTTP ${res.status}\`` (line 125) vs the trigger which includes `await res.text()`. This makes debugging resolve failures harder.

**Fix:** Use the same error capture pattern as the trigger:

```typescript
const errorMessage = res.ok
  ? undefined
  : `HTTP ${res.status}: ${await res.text().catch(() => "unknown")}`;
```

---

### WR-05: `computeLayout` — errored edge status not propagated correctly for multi-agent shared tools

**File:** `src/components/CallGraphSVG.tsx:54-59`

**Issue:** Tool node status is set to "errored" if ANY edge involving that tool is errored. This is correct. However, when two agents share a tool and one agent's edge is errored while the other's is healthy, the tool node correctly turns red. But the test at `CallGraphPanel.test.tsx:50-58` ("deduplicates tool nodes across multiple edges") does not cover the mixed-status case — both input edges are healthy. There is no test that asserts a shared tool with one errored and one healthy edge ends up `errored`. The logic appears correct by inspection, but the untested case means a regression would go undetected.

This is a WARNING because the code is likely correct, but the test suite has a meaningful coverage gap for a safety-critical display (errored nodes are highlighted red for operator attention).

**Fix:** Add a test case:

```typescript
it("marks shared tool as errored when any agent-tool edge is errored", () => {
  const edges: GraphEdge[] = [
    { agentId: "agent-1", toolName: "tool-shared", status: "healthy", callCount: 1, errorCount: 0 },
    { agentId: "agent-2", toolName: "tool-shared", status: "errored", callCount: 1, errorCount: 1 },
  ];
  const result = computeLayout(edges);
  const toolNode = result.nodes.find((n) => n.id === "tool:tool-shared");
  expect(toolNode?.status).toBe("errored");
});
```

---

### WR-06: `AlertRuleForm` does not validate PagerDuty routing key before saving

**File:** `src/components/AlertRuleForm.tsx:188-224`

**Issue:** When `pdEnabled` is true, the form submits `pdRoutingKey.trim()` regardless of whether it's empty or invalid. An empty routing key is stored in `alertRuleCustom.pagerdutyConfig.routingKey = ""`. The `sendPagerdutyAlert` action at line 31 of `pagerdutyDelivery.ts` checks `if (!rule.pagerdutyConfig.routingKey) return;` — so delivery silently skips. The user configured PagerDuty, toggled it on, hit Save, and gets no error, but incidents are never delivered.

**Fix:** Add client-side validation in `handleSave`:

```typescript
if (pdEnabled && !pdRoutingKey.trim()) {
  toast.error("PagerDuty routing key is required when PagerDuty is enabled.");
  setSaving(false);
  return;
}
```

---

## Info

### IN-01: All email digest tests are `.todo` — zero behavioral coverage

**File:** `convex/emailDigest.test.ts:1-21`

**Issue:** All 8 test cases are `it.todo(...)`. The `sendEmailDigest` action has a non-trivial guard chain (API key, enabled flag, recipient, digest data, Resend call), none of which is tested. This means a regression in any guard or in the Resend integration would not be caught before ship.

---

### IN-02: `EmailDigestConfig.test.tsx` only tests that the module exports a function

**File:** `src/components/EmailDigestConfig.test.tsx:1-14`

**Issue:** Both tests assert `typeof mod.EmailDigestConfig === "function"` and `mod.EmailDigestConfig` is defined — these are compile-time assertions, not behavioral tests. No rendering, no interaction, no state transition is tested.

---

### IN-03: `Infrastructure.tsx` uses array index as React `key` for auth aliases table

**File:** `src/pages/Infrastructure.tsx:167`

**Issue:** `authAliases.map((alias, i) => (<TableRow key={i}>...))` — index-keyed lists produce incorrect reconciliation behavior if the list is sorted or items are inserted/removed mid-list. The `alias.alias` field appears to be unique (indexed `by_alias`), making it a stable key.

**Fix:**
```tsx
authAliases.map((alias) => (<TableRow key={alias._id}>...))
```

---

### IN-04: `fromboarding@resend.dev` sender is a Resend sandbox address

**File:** `convex/emailDigest.ts:241`

**Issue:** `from: "CodePulse <onboarding@resend.dev>"` is the Resend onboarding sandbox domain. Emails from this domain can only be delivered to the account owner's verified email. Any recipient email that is not the Resend account owner will receive the email into their inbox or be rejected silently. This is expected during development but must be changed to a verified custom domain before production use. There is no comment flagging this as a TODO.

**Fix:** Add a comment:
```typescript
// TODO: Replace with verified sending domain before production
from: "CodePulse <onboarding@resend.dev>",
```

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
