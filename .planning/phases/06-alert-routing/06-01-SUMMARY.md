---
phase: 06-alert-routing
plan: 01
subsystem: database
tags: [convex, schema, vitest, shadcn, alert-routing, test-stubs]

requires:
  - phase: 05-data-pipeline
    provides: aggregates table and retention patterns this phase builds on top of

provides:
  - alertRuleCustom table with compound AND/OR conditions and conditionGroups
  - alertMutes table with timed expiry (15m/1h/4h/24h/indefinite)
  - webhookDeliveryLog table with per-attempt tracking
  - alerts table extended with status, resolvedAt, ruleId, linkedTaskId, webhookStatus fields
  - tasks table extended with alertId field for escalation linkage
  - 31 test.todo stubs across 3 new test files covering ALR-02 through ALR-07
  - 4 shadcn components installed (accordion, tabs, table, alert)

affects: [06-alert-routing plans 02-05, any plan consuming alerts or tasks tables]

tech-stack:
  added: [shadcn/ui accordion, shadcn/ui tabs, shadcn/ui table, shadcn/ui alert]
  patterns: [Wave 0 test stubs using test.todo exclusively, optional fields on existing tables for backward compatibility]

key-files:
  created:
    - convex/__tests__/alertLifecycle.test.ts
    - convex/__tests__/notificationPrefs.test.ts
    - convex/__tests__/webhookDelivery.test.ts
    - src/components/ui/accordion.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/table.tsx
    - src/components/ui/alert.tsx
  modified:
    - convex/schema.ts
    - convex/__tests__/notifications.test.ts

key-decisions:
  - "All new fields on existing tables use v.optional() to avoid breaking existing records — no data migration needed"
  - "Wave 0 stubs use test.todo exclusively so no implementation is required for the suite to be green"

patterns-established:
  - "Wave 0 test stubs: test.todo-only describe blocks grouped by requirement ID (ALR-XX)"
  - "Phase 6 schema additions isolated in // ALERT ROUTING (Phase 6) comment block"

requirements-completed: [ALR-01, ALR-02, ALR-03, ALR-04, ALR-05, ALR-07]

duration: 3min
completed: 2026-04-14
---

# Phase 06 Plan 01: Alert Routing Foundation Summary

**Convex schema extended with 3 new tables (alertRuleCustom, alertMutes, webhookDeliveryLog) and 8 new optional fields on alerts/tasks, plus 31 Wave 0 test.todo stubs and 4 shadcn components installed**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-14T15:48:08Z
- **Completed:** 2026-04-14T15:51:04Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Extended Convex schema with full Phase 6 alert routing data model — alertRuleCustom (compound AND/OR rules), alertMutes (timed expiry), webhookDeliveryLog (delivery attempt tracking)
- Added 8 optional fields to existing alerts and tasks tables (status, resolvedAt, ruleId, linkedTaskId, webhookStatus, webhookDeliveredAt, webhookAttempts, alertId) with backward-compatible v.optional() wrappers
- Created 31 test.todo stubs across 3 new test files (alertLifecycle, notificationPrefs, webhookDelivery) and extended notifications.test.ts with ALR-07 inbox integration stubs
- Installed 4 shadcn components required by downstream UI plans (accordion, tabs, table, alert)

## Task Commits

1. **Task 1: Schema migration** - `fba4e06` (feat)
2. **Task 2: Wave 0 test stubs + shadcn installs** - `628ad94` (feat)
3. **Fix: duplicate import** - `0872789` (fix — Rule 1 auto-fix)

## Files Created/Modified

- `convex/schema.ts` - Added alertRuleCustom, alertMutes, webhookDeliveryLog tables; extended alerts and tasks tables
- `convex/__tests__/alertLifecycle.test.ts` - 11 test.todo stubs for ALR-04 (lifecycle) and ALR-06 (escalation)
- `convex/__tests__/notificationPrefs.test.ts` - 6 test.todo stubs for ALR-05 (notification preferences)
- `convex/__tests__/webhookDelivery.test.ts` - 9 test.todo stubs for ALR-02/ALR-03 (webhook delivery)
- `convex/__tests__/notifications.test.ts` - Extended with 5 test.todo stubs for ALR-07 (inbox integration)
- `src/components/ui/accordion.tsx` - shadcn accordion component
- `src/components/ui/tabs.tsx` - shadcn tabs component
- `src/components/ui/table.tsx` - shadcn table component
- `src/components/ui/alert.tsx` - shadcn alert component

## Decisions Made

- All new fields on existing tables use `v.optional()` — existing records unaffected, no data migration needed
- Wave 0 stubs use `test.todo` exclusively so no implementation is required for the suite to be green (consistent with Phase 01-ui-redesign pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed duplicate vitest import in notifications.test.ts**
- **Found during:** Task 2 verification (TypeScript compile check)
- **Issue:** First edit to notifications.test.ts prepended `import { describe, test } from "vitest"` before the existing `import { describe, it, expect } from "vitest"`, causing TS2300 duplicate identifier errors
- **Fix:** Merged both imports into `import { describe, it, expect, test } from "vitest"` and removed the duplicate line
- **Files modified:** convex/__tests__/notifications.test.ts
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run` on all 4 files exits 0
- **Committed in:** `0872789`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered

None beyond the auto-fixed duplicate import.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Schema foundation complete — all downstream plans (06-02 through 06-05) can now reference alertRuleCustom, alertMutes, webhookDeliveryLog, and the extended alerts/tasks fields
- Test stubs are scaffolded for all ALR requirements covered in this phase; downstream plans implement them
- shadcn components ready for alert UI construction in 06-03/06-04

---
*Phase: 06-alert-routing*
*Completed: 2026-04-14*
