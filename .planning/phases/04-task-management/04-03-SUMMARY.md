---
phase: 04-task-management
plan: "03"
subsystem: ideation
tags:
  - ideation
  - task-conversion
  - multi-select
  - status-workflow
dependency_graph:
  requires:
    - "04-01"
  provides:
    - IdeationRow component
    - Ideation page multi-select and bulk convert
    - Finding status workflow (open/acknowledged/converted/dismissed)
    - Bidirectional finding-task linking
  affects:
    - src/pages/Ideation.tsx
    - src/components/IdeationRow.tsx
tech_stack:
  added: []
  patterns:
    - IdeationRow rich row with checkbox, severity badge, status badge, actions
    - anyApi pattern for Convex modules not yet in generated types
    - Multi-select Set state with ESC to deselect
    - Bulk convert with sequential createTask + linkTask mutations
key_files:
  created:
    - src/components/IdeationRow.tsx
  modified:
    - src/lib/__tests__/findingToTask.test.ts
    - src/components/__tests__/IdeationRow.test.tsx
    - src/pages/Ideation.tsx
decisions:
  - anyApi used for api.tasks.create since tasks module absent from generated API (Convex not regenerated in this worktree)
  - TaskCreateForm rendered directly (not in Dialog wrapper) per existing pattern — form handles its own backdrop
metrics:
  duration: 248s
  completed_date: "2026-04-13"
  tasks_completed: 2
  files_modified: 4
---

# Phase 4 Plan 03: Ideation Upgrade — IdeationRow, Multi-Select, Status Workflow Summary

**One-liner:** Rich IdeationRow component with checkbox/severity/status columns plus Ideation page multi-select bulk convert, inline task creation, and open→acknowledged→converted→dismissed status workflow wired to Convex mutations.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement findingToTask tests and create IdeationRow component | f803519 | src/lib/__tests__/findingToTask.test.ts, src/components/IdeationRow.tsx, src/components/__tests__/IdeationRow.test.tsx |
| 2 | Upgrade Ideation page with multi-select, bulk convert, and status workflow | c8a6bdd | src/pages/Ideation.tsx |

## What Was Built

### IdeationRow Component (`src/components/IdeationRow.tsx`)
- Checkbox (shadcn) for multi-select
- Severity badge with SEVERITY_CLASSES map: `bg-(--status-error)` for critical/high, `bg-(--status-warn)` for medium, `bg-(--status-ok)` for low
- Scan type (mono), category, description (flex-1 truncate) columns
- StatusBadge with FINDING_STATUS_MAP: open→idle/OPEN, acknowledged→warn/ACK'D, converted→ok/CONVERTED, dismissed→idle/DISMISSED
- `opacity-60` for dismissed findings
- "Task linked" badge when `finding.taskId` present
- Actions: Plus icon (Create Task), ACK button (open only), Dismiss button (non-dismissed only)
- Create Task hidden when status is "converted"

### findingToTask Tests (`src/lib/__tests__/findingToTask.test.ts`)
- 9 tests replacing all `test.todo` stubs
- Covers all severity→priority mappings including unknown→medium fallback
- Verifies title, description, labels, and findingId mapping

### IdeationRow Tests (`src/components/__tests__/IdeationRow.test.tsx`)
- 7 tests replacing all `test.todo` stubs
- StatusBadge mocked for isolation
- Tests: checkbox render, severity token class, Create Task button, ACK button, Dismiss button, opacity-60 for dismissed, Task linked badge

### Ideation Page (`src/pages/Ideation.tsx`)
- `selectedIds: Set<string>` state for multi-select
- ESC key handler clears selection
- "Convert Selected (N)" button shown when selectedIds.size > 0
- Status filter tabs: All | Open | Acknowledged | Converted | Dismissed (alongside existing severity and scan type filters)
- `handleBulkConvert`: iterates selected findings, calls createTask + linkTask for each, toasts success
- `handleCreateTask`: calls findingToTaskDefaults, sets prefillData, opens TaskCreateForm
- `handleAcknowledge` / `handleDismiss`: call updateFindingStatus mutation
- TaskCreateForm rendered with `prefillData` prop (prop accepted; behavior wired in Plan 06)
- Empty states: "No findings" + scan schedule message; "No findings match this filter" + clear filter hint
- `anyApi.tasks.create` used since `convex/tasks.ts` not yet in generated API types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `api.tasks` not in generated Convex API**
- **Found during:** Task 2 tsc check
- **Issue:** `convex/tasks.ts` added in Plan 01 but `convex/_generated/api.d.ts` not regenerated in this worktree — `api.tasks` causes TS error TS2339
- **Fix:** Imported `anyApi` from `convex/server` and used `anyApi.tasks.create` — runtime behavior identical, type-safe workaround until Convex is regenerated
- **Files modified:** src/pages/Ideation.tsx
- **Commit:** c8a6bdd

## Known Stubs

- `prefillData` is passed to TaskCreateForm but not consumed by the form's internal state — Task 6 (Plan 06) wires the pre-fill behavior. This is intentional per plan spec and does not prevent the plan's conversion workflow from functioning.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. Finding status updates route through existing `updateFindingStatus` Convex mutation which already validates the status enum server-side (T-04-04 mitigated in Plan 01 convex/ideation.ts).

## Self-Check: PASSED

- src/components/IdeationRow.tsx: FOUND
- src/lib/__tests__/findingToTask.test.ts: FOUND (updated)
- src/components/__tests__/IdeationRow.test.tsx: FOUND (updated)
- src/pages/Ideation.tsx: FOUND (updated)
- Commit f803519: FOUND (Task 1)
- Commit c8a6bdd: FOUND (Task 2)
- 16 tests pass (9 findingToTask + 7 IdeationRow)
- tsc --noEmit: no errors in plan files (pre-existing KanbanCard errors unrelated)
