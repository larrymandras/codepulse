---
phase: 06-alert-routing
plan: 05
subsystem: ui
tags: [react, alert-lifecycle, mute, escalate, webhook-badge, condition-builder, alert-rule-form, inbox-integration]

requires:
  - phase: 06-alert-routing/06-02
    provides: alertLifecycle, alertMutes, alertRuleCustom mutations
  - phase: 06-alert-routing/06-03
    provides: webhook delivery status fields on alerts (webhookStatus, webhookDeliveredAt, webhookAttempts)

provides:
  - AlertLifecycleActions component: Acknowledge/Mute/Escalate row buttons wired to Convex mutations
  - MuteDurationPicker component: Popover with 15m/1h/4h/24h/indefinite options (44px touch targets)
  - WebhookStatusBadge component: Delivery status dot + caption using --status-ok/error/warn CSS vars
  - ConditionBuilder component: AND/OR compound condition editor with metric/operator/threshold/lookback rows and sub-group nesting
  - AlertRuleForm component: 480px Sheet for threshold override and custom rule CRUD with dirty tracking and delete confirm
  - AlertRulesEngine extended: threshold override inputs (hover), mute toggles, New Custom Rule button, CUSTOM RULES section
  - InboxCard extended: alertId prop + AlertInlineActions (Acknowledge/Mute) for alert type items
  - Inbox page: alertToInboxItem passes alertId and respects Phase 6 status field for read state

affects: [Alerts page, Inbox page, AlertRulesEngine, InboxCard, any plan consuming alert UI]

tech-stack:
  added: []
  patterns:
    - "Per-row useQuery isolation: AlertRow component wraps each alert to call isTargetMutedPublic independently"
    - "Optimistic opacity state classes: opacity-60 (acknowledged), opacity-40 (resolved), opacity-50 (muted)"
    - "MuteDurationPicker as reusable trigger-based Popover wrapper used in both AlertLifecycleActions and AlertRulesEngine"
    - "AlertRuleForm dirty tracking: setDirty() called on any field change, dot indicator in Sheet header"

key-files:
  created:
    - src/components/AlertLifecycleActions.tsx
    - src/components/MuteDurationPicker.tsx
    - src/components/WebhookStatusBadge.tsx
    - src/components/ConditionBuilder.tsx
    - src/components/AlertRuleForm.tsx
  modified:
    - src/components/AlertRulesEngine.tsx
    - src/components/InboxCard.tsx
    - src/pages/Alerts.tsx
    - src/pages/Inbox.tsx

key-decisions:
  - "AlertRow extracted as sub-component to isolate per-alert useQuery(isTargetMutedPublic) calls — avoids calling hooks in a map callback"
  - "MuteDurationPicker accepts trigger: React.ReactNode for reuse in both alert rows and rule rows without duplication"
  - "Inbox.tsx alertToInboxItem casts _id to Id<alerts> with eslint-disable — avoids requiring a full type parameter on the mapper function signature"
  - "AlertRulesEngine StaticRuleRow uses local useState for threshold input and commits on blur/Enter via setThresholdOverride"
  - "CUSTOM RULES section in AlertRulesEngine only renders when customRules.length > 0 — avoids empty section header"

requirements-completed: [ALR-01, ALR-04, ALR-06, ALR-07]

duration: 21min
completed: 2026-04-14
---

# Phase 06 Plan 05: Alerts Lifecycle UI + AlertRuleForm + ConditionBuilder + InboxCard Integration Summary

**5 new UI components and 4 extended files wiring full alert lifecycle management (acknowledge/mute/escalate), webhook delivery status badges, compound condition rule builder, threshold overrides, and alert items in Unified Inbox**

## Performance

- **Duration:** ~21 min
- **Started:** 2026-04-14T15:52:00Z
- **Completed:** 2026-04-14T16:13:25Z
- **Tasks:** 2
- **Files modified:** 9 (5 created, 4 extended)

## Accomplishments

- Created `src/components/AlertLifecycleActions.tsx` — Acknowledge (single-click, optimistic opacity-60), Mute/Unmute via MuteDurationPicker popover, Escalate (Dialog pre-filled with alertTitle and severity-mapped priority, creates Kanban task via escalateToTask mutation with success toast)
- Created `src/components/MuteDurationPicker.tsx` — Popover with 5 options (15m/1h/4h/24h/indefinite), 44px minimum touch targets per WCAG 2.5.5, single-click selection closes popover
- Created `src/components/WebhookStatusBadge.tsx` — 8px colored dot (--status-ok/error/warn CSS vars) + relative time caption for delivered/failed/retrying states
- Created `src/components/ConditionBuilder.tsx` — flat grouped list with metric Select (7 options), operator Select (gt/lt/gte/lte/eq), numeric threshold Input (type=number min=0, T-06-11 mitigation), lookback Select (5m/15m/30m/1h/24h), AND/OR logic toggle pills, Add condition + Add group buttons, one level of sub-group nesting
- Created `src/components/AlertRuleForm.tsx` — 480px right Sheet, override mode (threshold + lookback), custom mode (name/severity/ConditionBuilder/messageTemplate), dirty indicator dot in header, Save Rule / Discard Changes / Delete Rule footer, delete confirmation Dialog with UI-SPEC copy
- Extended `src/components/AlertRulesEngine.tsx` — StaticRuleRow with hover-revealed threshold override Input, MuteDurationPicker mute toggle per row, Edit button per row, "+ New Custom Rule" primary button, CUSTOM RULES section below static rules
- Extended `src/components/InboxCard.tsx` — alertId?: Id<"alerts"> field on InboxItem, AlertInlineActions sub-component with Acknowledge/Mute buttons for alert type items
- Extended `src/pages/Alerts.tsx` — AlertRow sub-component isolating per-alert mute query, AlertLifecycleActions + WebhookStatusBadge in action cluster, opacity states for acknowledged/resolved/muted rows
- Extended `src/pages/Inbox.tsx` — alertToInboxItem passes alertId and uses Phase 6 status field for read state

## Task Commits

1. **Task 1: AlertLifecycleActions + MuteDurationPicker + WebhookStatusBadge + Alerts page wiring** - `dbdd7e5` (feat)
2. **Task 2: AlertRuleForm + ConditionBuilder + AlertRulesEngine extension + InboxCard + Inbox query wiring** - `6af79e7` (feat)

## Files Created/Modified

- `src/components/AlertLifecycleActions.tsx` — Row-level Acknowledge/Mute/Escalate (created)
- `src/components/MuteDurationPicker.tsx` — Mute duration popover with 5 options (created)
- `src/components/WebhookStatusBadge.tsx` — Webhook delivery status indicator (created)
- `src/components/ConditionBuilder.tsx` — AND/OR compound condition editor (created)
- `src/components/AlertRuleForm.tsx` — Sheet form for override and custom rules (created)
- `src/components/AlertRulesEngine.tsx` — Threshold overrides, mute toggles, custom rule section (extended)
- `src/components/InboxCard.tsx` — alertId prop + AlertInlineActions for alert type (extended)
- `src/pages/Alerts.tsx` — AlertRow, lifecycle actions cluster, webhook badge, opacity states (extended)
- `src/pages/Inbox.tsx` — alertToInboxItem passes alertId with Phase 6 status field (extended)

## Decisions Made

- AlertRow extracted as sub-component: React hooks cannot be called inside a map callback — isolating `useQuery(isTargetMutedPublic)` per row requires a component boundary
- MuteDurationPicker accepts `trigger: React.ReactNode` rather than rendering its own button — enables reuse in both alert rows (ghost "Mute" button) and rule rows (Clock icon button) without duplication
- Inbox.tsx alertId cast: `alert._id as any` with eslint-disable avoids requiring complex generic plumbing on the mapper function; type safety is maintained by the InboxCard prop types
- StaticRuleRow threshold commits on blur AND Enter key — aligns with standard form UX without requiring a submit button per row
- CUSTOM RULES section conditional: only renders when `customRules.length > 0` — avoids orphan section header with empty content

## Deviations from Plan

None - plan executed exactly as written.

Both tasks verified with `npx tsc --noEmit` (exit 0) and `npx vitest run convex/__tests__/notifications.test.ts` (4 passed, 5 todo).

## Known Stubs

None — all components are fully implemented and wired to Convex mutations/queries. The Escalate dialog creates real Kanban tasks via `escalateToTask`. Custom rule CRUD writes to `alertRuleCustom` table. Mute state is queried live from `alertMutes.isTargetMutedPublic`.

## Threat Flags

None — no new network endpoints or auth paths introduced. All mutations go through existing Convex patterns. T-06-11 mitigation applied: ConditionBuilder threshold inputs use `type="number" min={0}`.

---
*Phase: 06-alert-routing*
*Completed: 2026-04-14*

## Self-Check: PASSED

- src/components/AlertLifecycleActions.tsx — FOUND
- src/components/MuteDurationPicker.tsx — FOUND
- src/components/WebhookStatusBadge.tsx — FOUND
- src/components/ConditionBuilder.tsx — FOUND
- src/components/AlertRuleForm.tsx — FOUND
- src/components/AlertRulesEngine.tsx — FOUND
- src/components/InboxCard.tsx — FOUND
- src/pages/Alerts.tsx — FOUND
- src/pages/Inbox.tsx — FOUND
- Commit dbdd7e5 (Task 1) — FOUND
- Commit 6af79e7 (Task 2) — FOUND
- npx tsc --noEmit — exits 0
- npx vitest run notifications.test.ts — 4 passed, 5 todo
