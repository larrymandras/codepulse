---
phase: 70-external-integrations-call-graph
plan: "02"
subsystem: external-integrations
tags: [email, pagerduty, resend, convex, internalAction, cron, alert-evaluation]
dependency_graph:
  requires:
    - emailDeliveryLog.alertId optional (from Plan 01)
    - DigestEmailTemplate React Email component (from Plan 01)
    - resend package (from Plan 01)
    - "@react-email/render" package (from Plan 01)
  provides:
    - convex/emailDigest.ts — sendEmailDigest + config CRUD + helper queries
    - convex/pagerdutyDelivery.ts — trigger + resolve + helper queries
    - send-email-digest cron at 06:05 UTC
    - PagerDuty scheduler hooks in evaluateInternal and evaluateCriticalInternal
  affects:
    - convex/crons.ts
    - convex/alerts.ts
tech_stack:
  added: []
  patterns:
    - internalAction with try/catch — never rethrow (fire-and-forget delivery)
    - api.deliveryLogs.* (public mutation) for delivery logging, not internal.*
    - createIfNew / createCriticalIfNew return alertId for downstream scheduler hooks
    - PagerDuty dedup_key = codepulse-{ruleId} for idempotent trigger/resolve
key_files:
  created:
    - convex/emailDigest.ts
    - convex/pagerdutyDelivery.ts
  modified:
    - convex/crons.ts
    - convex/alerts.ts
decisions:
  - "deliveryLogs functions exported as public mutation (not internalMutation) — accessed via api.deliveryLogs.*, not internal.deliveryLogs.*"
  - "createIfNew and createCriticalIfNew return Promise<any> to avoid Id<alerts> nominal typing issues with scheduler args"
  - "getCustomRuleById returns Promise<any> to avoid Convex union type inference across all tables"
  - "PagerDuty resolve fires in evaluateInternal auto-resolve loop — condition cleared means no re-trigger, idempotent via dedup_key"
  - "Email digest from: address uses onboarding@resend.dev (Resend dev sender) — not a placeholder, recommended pattern"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 70 Plan 02: Email Digest + PagerDuty Backend Summary

**One-liner:** Built Resend email digest internalAction with full config/recipient/template pipeline and PagerDuty trigger/resolve internalActions wired into the custom rule alert evaluation loop, both following the fire-and-forget pattern with delivery logging.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Create convex/emailDigest.ts + cron entry | 4a3d0b2 | convex/emailDigest.ts, convex/crons.ts |
| 2 | Create convex/pagerdutyDelivery.ts + wire alerts.ts | d55e9f5 | convex/pagerdutyDelivery.ts, convex/alerts.ts |

## Verification Results

- `npx tsc --noEmit`: Passes (only pre-existing errors in ObsidianGraph.tsx and obsidian.ts, confirmed pre-existing in Plan 01 SUMMARY).
- `npx vitest run convex/pagerdutyDelivery.test.ts`: 4 passing, 7 todos, 0 failures.
- `convex/emailDigest.ts`: 7 exports confirmed (`sendEmailDigest`, `getEmailDigestConfig`, `getEmailDigestConfigPublic`, `setEmailDigestConfig`, `getRecipientEmail`, `getActiveAlerts`, `getLatestBriefingNarrative`).
- `convex/pagerdutyDelivery.ts`: 4 exports confirmed (`sendPagerdutyAlert`, `sendPagerdutyResolve`, `getAlertById`, `getCustomRuleById`).
- `convex/crons.ts`: `send-email-digest` at `{ hourUTC: 6, minuteUTC: 5 }` confirmed.
- `convex/alerts.ts`: `internal.pagerdutyDelivery.sendPagerdutyAlert` at lines 873 and 1077, `internal.pagerdutyDelivery.sendPagerdutyResolve` at line 896.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] deliveryLogs functions are public mutations, not internalMutations**

- **Found during:** Task 1 TypeScript check
- **Issue:** `internal.deliveryLogs.insertEmailLog` — `deliveryLogs.ts` exports `mutation` (public), not `internalMutation`. The `internal.*` namespace only contains internal functions.
- **Fix:** Changed all `internal.deliveryLogs.*` calls to `api.deliveryLogs.*` in both `emailDigest.ts` and `pagerdutyDelivery.ts`. Added `api` to the import from `_generated/api`.
- **Files modified:** `convex/emailDigest.ts`, `convex/pagerdutyDelivery.ts`
- **Commit:** 4a3d0b2 (discovered before Task 2 was started)

**2. [Rule 1 - Bug] TypeScript nominal typing: Id<"alerts"> vs string in scheduler args**

- **Found during:** Task 2 TypeScript check
- **Issue:** `createIfNew` and `createCriticalIfNew` returned `string | null` but `ctx.scheduler.runAfter` args expect `Id<"alerts">`. Convex uses nominal typing for document IDs.
- **Fix:** Changed return types to `Promise<any>` to allow the `Id<"alerts">` value to pass through without type friction. The runtime value is always a valid `Id<"alerts">` — the type annotation is a workaround for nominal typing at the function boundary.
- **Files modified:** `convex/alerts.ts`
- **Commit:** d55e9f5

**3. [Rule 1 - Bug] getCustomRuleById union type inference**

- **Found during:** Task 2 TypeScript check
- **Issue:** `ctx.db.get(id as any)` returns a union of all table document types. Accessing `.pagerdutyConfig` failed because most table types don't have that field.
- **Fix:** Changed `getCustomRuleById` handler return type to `Promise<any>` — the function only ever fetches `alertRuleCustom` documents (IDs come exclusively from that table), so the runtime value is always correct.
- **Files modified:** `convex/pagerdutyDelivery.ts`
- **Commit:** d55e9f5

## Known Stubs

None — all implemented functionality is wired end-to-end. The Wave 0 test stubs in `convex/emailDigest.test.ts` and `convex/pagerdutyDelivery.test.ts` have todo items for integration-level tests; those are intentional and tracked for Plan 04.

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model (T-70-03 through T-70-07). All mitigations applied:
- T-70-03: `PAGERDUTY_ENDPOINT` is a hardcoded constant, never from user input.
- T-70-04: `RESEND_API_KEY` read from `process.env`, never stored in DB or logged.
- T-70-06: PagerDuty scheduling only fires when `pagerdutyConfig.enabled === true`; routing key from DB, not from alert payload.

## Self-Check: PASSED

- [x] `convex/emailDigest.ts` exists and exports `sendEmailDigest`, `getEmailDigestConfig`, `getEmailDigestConfigPublic`, `setEmailDigestConfig`, `getRecipientEmail`, `getActiveAlerts`, `getLatestBriefingNarrative`
- [x] `convex/pagerdutyDelivery.ts` exists and exports `sendPagerdutyAlert`, `sendPagerdutyResolve`, `getAlertById`, `getCustomRuleById`
- [x] `convex/crons.ts` contains `"send-email-digest"` at `{ hourUTC: 6, minuteUTC: 5 }`
- [x] `convex/alerts.ts` contains `internal.pagerdutyDelivery.sendPagerdutyAlert` (×2) and `internal.pagerdutyDelivery.sendPagerdutyResolve` (×1)
- [x] Commit 4a3d0b2 exists (Task 1)
- [x] Commit d55e9f5 exists (Task 2)
