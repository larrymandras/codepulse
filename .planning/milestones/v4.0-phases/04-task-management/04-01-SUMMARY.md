---
phase: 04-task-management
plan: "01"
subsystem: task-management
tags:
  - kanban
  - convex
  - types
  - shadcn
  - utilities
  - test-stubs
dependency_graph:
  requires: []
  provides:
    - kanban-types-6-column
    - convex-tasks-table
    - ideation-status-schema
    - findingToTask-utility
    - cronToHuman-utility
    - shadcn-ui-components
    - wave-0-test-stubs
  affects:
    - 04-02
    - 04-03
    - 04-04
    - 04-05
    - 04-06
tech_stack:
  added:
    - "@codemirror/merge ^6.12.1"
    - "shadcn sheet, switch, select, textarea, input, label, checkbox"
  patterns:
    - "Convex v.string() validators with runtime enum checks in handlers"
    - "test.todo stubs for Wave 0 compliance"
key_files:
  created:
    - convex/tasks.ts
    - src/lib/findingToTask.ts
    - src/lib/cronToHuman.ts
    - src/types/kanban.test.ts
    - src/components/__tests__/KanbanColumn.test.tsx
    - src/components/__tests__/KanbanCard.test.tsx
    - src/components/__tests__/IdeationRow.test.tsx
    - src/components/__tests__/DiffView.test.tsx
    - src/components/__tests__/HotReloadBar.test.tsx
    - src/components/__tests__/CronBuilder.test.tsx
    - src/lib/__tests__/findingToTask.test.ts
    - src/lib/__tests__/cronToHuman.test.ts
    - src/components/ui/sheet.tsx
    - src/components/ui/switch.tsx
    - src/components/ui/select.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/checkbox.tsx
  modified:
    - src/types/kanban.ts
    - convex/schema.ts
    - convex/ideation.ts
    - src/components/TaskCreateForm.tsx
    - src/components/KanbanBoard.tsx
    - src/components/TaskDetail.tsx
    - src/pages/Tasks.tsx
    - src/hooks/useNavCounts.ts
    - src/pages/Ideation.tsx
decisions:
  - "TaskCreateForm prefillData prop is type-contract only; behavior wired in Plan 06"
  - "Column validation enforced at runtime in convex/tasks.ts moveColumn (T-04-01 mitigation)"
  - "Status validation enforced at runtime in convex/ideation.ts updateFindingStatus (T-04-02 mitigation)"
  - "Inbox.test.tsx pre-existing failure is out-of-scope; deferred to separate fix"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-13"
  tasks_completed: 3
  files_changed: 28
---

# Phase 4 Plan 01: Foundation — Types, Schema, Dependencies, and Test Stubs Summary

**One-liner:** 6-column KanbanTask types with Convex tasks table, finding-to-task and cron utilities, 7 shadcn components, and 55 Wave 0 test.todo stubs.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install dependencies and shadcn components | 9f39b92 | package.json, 7 src/components/ui/*.tsx |
| 2 | Expand types, schema, utilities, TaskCreateForm prop | b50c714 | kanban.ts, schema.ts, tasks.ts, ideation.ts, findingToTask.ts, cronToHuman.ts, TaskCreateForm.tsx |
| 3 | Create Wave 0 test stubs | 127be3f | 9 test stub files |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed COLUMN_LABELS records in 3 files after TaskColumn expansion**
- **Found during:** Task 2
- **Issue:** KanbanBoard.tsx, TaskDetail.tsx, and TaskCreateForm.tsx all had `COLUMN_LABELS` records using the old 3-column `TaskColumn` type (`backlog | in_progress | done`). After expanding to 6 columns, TypeScript reported type errors.
- **Fix:** Updated all three files to include all 6 columns in their `COLUMN_LABELS` records.
- **Files modified:** src/components/KanbanBoard.tsx, src/components/TaskDetail.tsx, src/components/TaskCreateForm.tsx
- **Commit:** b50c714

**2. [Rule 1 - Bug] Fixed statusToColumn mapping in Tasks.tsx**
- **Found during:** Task 2
- **Issue:** `statusToColumn` mapped `"running"` to `"in_progress"` which no longer exists in TaskColumn.
- **Fix:** Updated to map `"running"` → `"running"`, `"queued"` → `"queued"`, `"failed"` → `"cancelled"`, default → `"done"`.
- **Files modified:** src/pages/Tasks.tsx
- **Commit:** b50c714

**3. [Rule 1 - Bug] Added columnEnteredAt to KanbanTask construction in Tasks.tsx**
- **Found during:** Task 2
- **Issue:** `KanbanTask` now requires `columnEnteredAt: number`, but two places in Tasks.tsx constructed `KanbanTask` objects without it.
- **Fix:** Added `columnEnteredAt: exec.startedAt ?? exec.queuedAt` in convexTasks map and `columnEnteredAt: now` in handleCreateTask.
- **Files modified:** src/pages/Tasks.tsx
- **Commit:** b50c714

**4. [Rule 1 - Bug] Fixed narrowed-type comparison in Ideation.tsx**
- **Found during:** Task 2
- **Issue:** TypeScript narrowed out `"dismissed"` from `severityFilter` after the early-return guard on line 41, making `severityFilter !== "dismissed"` always true on line 43.
- **Fix:** Replaced the redundant comparison with a direct `if (f.dismissed) return false` check.
- **Files modified:** src/pages/Ideation.tsx
- **Commit:** b50c714

**5. [Rule 1 - Bug] Fixed useNavCounts.ts missing required args**
- **Found during:** Task 2
- **Issue:** `useQuery` calls were missing the required second argument `{}` (args object).
- **Fix:** Added `{}` as second argument to all 10 `useQuery` calls.
- **Files modified:** src/hooks/useNavCounts.ts
- **Commit:** b50c714

**6. [Rule 2 - Missing validation] Added runtime column/status validation in Convex mutations**
- **Found during:** Task 2 (threat model T-04-01, T-04-02)
- **Issue:** Threat model required runtime validation for `column` in `moveColumn` and `status` in `updateFindingStatus`, but plan's code snippets used bare `v.string()` without handler-level checks.
- **Fix:** Added `VALID_COLUMNS` and `VALID_STATUSES` arrays with runtime `includes()` checks throwing descriptive errors on invalid values.
- **Files modified:** convex/tasks.ts, convex/ideation.ts
- **Commit:** b50c714

**7. [Rule 1 - Bug] Removed unused KanbanTask import from TaskCreateForm.tsx**
- **Found during:** Task 2
- **Issue:** `KanbanTask` was imported but not used after removing the `in_progress` reference.
- **Fix:** Removed `KanbanTask` from the import statement.
- **Files modified:** src/components/TaskCreateForm.tsx
- **Commit:** b50c714

### Out-of-Scope Issues (Deferred)

**Inbox.test.tsx pre-existing failure** — `'R' key opens reject flow on focused approval item` fails with `sendCommand` not called. This failure pre-dates this plan and is unrelated to any changes made here. Logged for future fix.

## Known Stubs

The following are intentional `prefillData` stubs per plan design:

| File | Stub | Reason |
|------|------|--------|
| src/components/TaskCreateForm.tsx | `prefillData` prop accepted but unused | Type contract only; Plan 06 implements form pre-fill behavior |

## Threat Flags

No new threat surface introduced beyond what was planned in the threat model.

## Self-Check

Files created/modified:

- [x] src/types/kanban.ts — contains `export type TaskColumn = "backlog" | "queued" | "running" | "review" | "done" | "cancelled"`
- [x] convex/schema.ts — contains `tasks: defineTable({`
- [x] convex/tasks.ts — exports listByColumn, create, moveColumn, update, remove
- [x] convex/ideation.ts — contains updateFindingStatus and linkTask
- [x] src/lib/findingToTask.ts — exports findingToTaskDefaults
- [x] src/lib/cronToHuman.ts — exports cronToHuman, isValidCron, FREQUENCY_TO_CRON
- [x] src/components/TaskCreateForm.tsx — props interface contains prefillData
- [x] All 7 shadcn component files exist in src/components/ui/
- [x] All 9 test stub files created
- [x] npx tsc --noEmit passes with no errors
- [x] 95 test todos passing (55 new + 40 pre-existing)

Commits verified:
- 9f39b92: chore(04-01): install @codemirror/merge and 7 shadcn components
- b50c714: feat(04-01): expand types, schema, utilities, and TaskCreateForm prop contract
- 127be3f: test(04-01): add Wave 0 test stubs for Phase 4 components

## Self-Check: PASSED
