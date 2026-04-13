---
phase: 04-task-management
plan: 06
subsystem: task-management
tags:
  - tasks
  - kanban
  - convex
  - websocket
  - ideation
dependency_graph:
  requires:
    - 04-01 (Convex tasks table)
    - 04-02 (KanbanBoard component upgrades)
    - 04-03 (Ideation finding-to-task flow)
  provides:
    - Tasks page wired to Convex tasks table
    - Drag confirmation with WS dispatch
    - TaskCreateForm with finding pre-fill
    - TaskDetail with finding link display
  affects:
    - src/pages/Tasks.tsx
    - src/components/TaskCreateForm.tsx
    - src/components/TaskDetail.tsx
    - src/pages/Ideation.tsx
tech_stack:
  added: []
  patterns:
    - anyApi for unregistered Convex modules
    - ACTION_COLUMNS gate for WS command confirmation
    - prefillData pattern for cross-page task creation
key_files:
  created: []
  modified:
    - src/pages/Tasks.tsx
    - src/components/TaskCreateForm.tsx
    - src/components/TaskDetail.tsx
    - src/pages/Ideation.tsx
decisions:
  - Used anyApi.tasks.* instead of api.tasks.* because convex/_generated/api.d.ts is stale (tasks module not yet regenerated)
  - Renamed TaskCreateForm onClose -> onCancel to match standard cancel semantics; updated all call sites
  - Changed TaskCreateForm onSubmit signature from (task, column) to (task) — column is now internal to each call site
metrics:
  duration: ~25min
  completed: 2026-04-13
  tasks_completed: 2
  files_modified: 4
---

# Phase 04 Plan 06: Tasks Page Wiring and Component Upgrades Summary

Tasks page rewired to Convex tasks table with drag-to-action-column confirmation toasts and WS dispatch; TaskCreateForm upgraded with finding pre-fill and rich fields; TaskDetail upgraded with linked finding display and column move selector.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Rewrite Tasks.tsx data layer with Convex tasks and drag confirmation | 2e54f3e | src/pages/Tasks.tsx |
| 2 | Upgrade TaskCreateForm with finding pre-fill and TaskDetail with finding link | 7ff06f9 | src/components/TaskCreateForm.tsx, src/components/TaskDetail.tsx, src/pages/Ideation.tsx |

## What Was Built

**Task 1 — Tasks.tsx rewrite:**
- Replaced `commandExecutions` + local state overlay with `useQuery(anyApi.tasks.listByColumn)`
- Added `ACTION_COLUMNS` guard: drag to `running` or `cancelled` shows a 5-second confirmation toast with Confirm/Cancel before calling `useMutation(anyApi.tasks.moveColumn)` and dispatching `task.move` WS command
- Non-action column drags move immediately via Convex mutation, no WS command
- Column validation against `TASK_COLUMNS` (T-04-10 mitigation) gates all mutations
- Empty state shows "No tasks yet" heading + "Create a task with the + button in any column, or convert an ideation finding."

**Task 2 — Component upgrades:**
- `TaskCreateForm`: accepts `prefillData?: Partial<NewTask> | null`, initializes `title/description/priority/labels` from it, shows "Pre-filled from finding: {title}" notice when `findingId` present; adds labels input (comma-separated with chip preview), due date input; includes `findingId` in submit payload; prop renamed `onClose` → `onCancel`; `onSubmit` signature simplified to `(task: NewTask) => void | Promise<void>`
- `TaskDetail`: adds Origin section with "Finding" badge when `task.findingId` present; shows labels chips, due date, time-in-column; adds Move To column selector (`select` over TASK_COLUMNS) calling `onMove` prop; accepts optional `onMove` prop
- `Ideation.tsx`: updated `onClose` → `onCancel`, updated `handleFormSubmit` to match new single-argument signature, passes `findingId` through `createTask`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `api.tasks` not in generated Convex API**
- **Found during:** Task 1
- **Issue:** `convex/_generated/api.d.ts` does not include `tasks` module (not regenerated since Plan 01 created `convex/tasks.ts`). `api.tasks.listByColumn` caused TS errors.
- **Fix:** Used `anyApi.tasks.*` (same pattern as `Ideation.tsx` from Plan 03), cast `rawTasks` as `any[]` for mapping, cast `_id` as `any` for mutations.
- **Files modified:** src/pages/Tasks.tsx
- **Commit:** 2e54f3e

**2. [Rule 1 - Bug] TaskCreateForm onSubmit signature mismatch**
- **Found during:** Task 2
- **Issue:** Plan specified new `onSubmit: (task: NewTask) => void | Promise<void>` but Ideation.tsx used old `(task: NewTask, column: TaskColumn) => void`. Updated `handleFormSubmit` in Ideation.tsx to match new signature and removed unused `TaskColumn` import.
- **Fix:** Updated Ideation.tsx handleFormSubmit signature and removed unused import.
- **Files modified:** src/pages/Ideation.tsx
- **Commit:** 7ff06f9

## Known Stubs

None — all data flows are wired to real Convex queries/mutations.

## Self-Check: PASSED

Files verified:
- src/pages/Tasks.tsx — FOUND
- src/components/TaskCreateForm.tsx — FOUND
- src/components/TaskDetail.tsx — FOUND
- src/pages/Ideation.tsx — FOUND

Commits verified:
- 2e54f3e — FOUND
- 7ff06f9 — FOUND

TypeScript: `npx tsc --noEmit` — PASSED (0 errors)
Tests: 185 passed, 1 pre-existing failure in Inbox.test.tsx (unrelated to this plan)
