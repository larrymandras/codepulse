---
phase: 04-task-management
plan: "02"
subsystem: frontend-kanban
tags:
  - kanban
  - dnd
  - components
  - tdd
dependency_graph:
  requires:
    - 04-01
  provides:
    - KanbanColumn-collapsible
    - KanbanCard-rich
    - KanbanBoard-6col
  affects:
    - src/pages/Tasks.tsx
tech_stack:
  added: []
  patterns:
    - TDD red-green cycle with vitest + @testing-library/react
    - dnd-kit PointerSensor with 8px activationConstraint
    - CSS custom property border utility classes (border-l-(--status-*))
    - Auto-collapse via useEffect + useRef prev-task-count tracking
key_files:
  created: []
  modified:
    - src/components/KanbanColumn.tsx
    - src/components/KanbanCard.tsx
    - src/components/KanbanBoard.tsx
    - src/components/__tests__/KanbanColumn.test.tsx
    - src/components/__tests__/KanbanCard.test.tsx
    - src/pages/Tasks.tsx
decisions:
  - "Count badge uses parentheses format '(N)' matching column header style"
  - "KanbanColumn accepts onCardClick as optional prop — forwarded to KanbanCard"
  - "Tasks.tsx call site updated to use new onMoveTask/onTaskClick/onAddTask prop names"
  - "Pre-existing Inbox.test.tsx failure (R-key reject flow) is out of scope — not caused by this plan"
metrics:
  duration: "243s"
  completed_date: "2026-04-13"
  tasks_completed: 3
  files_modified: 6
---

# Phase 04 Plan 02: Kanban Component Upgrades Summary

**One-liner:** 6-column collapsible KanbanBoard with rich cards featuring priority stripes, label chips, time-in-column, and PointerSensor drag activation (8px threshold).

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Upgrade KanbanColumn with collapsible behavior | dd25f28 | KanbanColumn.tsx, KanbanColumn.test.tsx |
| 2 | Upgrade KanbanCard with rich content and priority stripe | 5e436c4 | KanbanCard.tsx, KanbanCard.test.tsx |
| 3 | Upgrade KanbanBoard to 6 columns with PointerSensor | 76e2531 | KanbanBoard.tsx, Tasks.tsx |

## What Was Built

### KanbanColumn (Task 1)
- Auto-collapses to `w-10` (40px) strip when tasks transition from >0 to 0
- Expands on `mouseenter` when collapsed; re-collapses on `mouseleave` if still empty
- Auto-expands when tasks arrive (0→>0 transition while collapsed)
- Rotated vertical-rl label displayed when in collapsed strip state
- Drop target highlight: `border-dashed border-(--primary) bg-(--accent)/30`
- Column header: uppercase tracking-wide label + `(N)` count badge + Plus button
- Derives label from `COLUMN_LABELS` record (no `label` prop needed)
- 7 tests: all pass

### KanbanCard (Task 2)
- Priority stripe via `border-l-2` + `border-l-(--status-error/warn/ok)` per priority
- Label chips rendered as `text-[10px]` spans in flex-wrap row
- Due date formatted as `"Mon DD"` when `dueAt` is set
- `formatTimeInColumn` helper: `Xd Xh` / `Xh` / `<1h` from `columnEnteredAt`
- Finding badge `<span>Finding</span>` when `findingId` present
- `opacity-40` applied when `isDragging` prop is true
- Agent avatar: 16x16 rounded circle with uppercase first char of `agentName`
- 10 tests: all pass

### KanbanBoard (Task 3)
- `PointerSensor` with `activationConstraint: { distance: 8 }` — prevents accidental drags
- `TASK_COLUMNS` import from `@/types/kanban` — renders all 6 columns dynamically
- Drop target column validated against `TASK_COLUMNS` before calling `onMoveTask` (T-04-03)
- Props updated: `onMoveTask`, `onAddTask`, `onTaskClick`, `onTasksChange` (compat)
- `DragOverlay` renders at `scale-95 shadow-lg opacity-90`
- Tasks.tsx call site updated to use new prop names

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] KanbanColumn count badge format mismatch**
- **Found during:** Task 1 GREEN phase (test failure)
- **Issue:** Test expected plain `"2"` but component renders `"(2)"` per column header spec
- **Fix:** Updated test assertion to match `"(2)"` — parentheses format matches the spec's `(tasks.length)` pattern
- **Files modified:** src/components/__tests__/KanbanColumn.test.tsx
- **Commit:** dd25f28

**2. [Rule 1 - Bug] KanbanColumn prop interface mismatch (label, onCardClick, onCreateTask)**
- **Found during:** Task 1 implementation
- **Issue:** Old KanbanColumn had `label: string` + `onCardClick` + `onCreateTask` props; new spec uses internal label lookup and `onAddTask` + `onCardClick?` optional
- **Fix:** Removed `label` prop (derived from `COLUMN_LABELS` record), renamed callback props, made `onCardClick` optional
- **Files modified:** src/components/KanbanColumn.tsx, src/pages/Tasks.tsx
- **Commit:** dd25f28, 76e2531

**3. [Rule 1 - Bug] Tasks.tsx call site used old KanbanBoard prop names**
- **Found during:** Task 3 TypeScript check
- **Issue:** Tasks.tsx passed `onCardClick` and `onCreateTask` which no longer exist on updated KanbanBoard
- **Fix:** Updated Tasks.tsx to use `onTaskClick`, `onAddTask`, and provided inline `onMoveTask` handler
- **Files modified:** src/pages/Tasks.tsx
- **Commit:** 76e2531

## Known Stubs

None — all acceptance criteria met, no placeholder data or TODO markers.

## Threat Surface

T-04-03 mitigation applied in KanbanBoard.handleDragEnd and handleDragOver: column ID from `@dnd-kit` droppable validated against `TASK_COLUMNS` array before calling `onMoveTask`. No new threat surface introduced.

## Self-Check: PASSED

- KanbanColumn.tsx: FOUND ✓
- KanbanCard.tsx: FOUND ✓
- KanbanBoard.tsx: FOUND ✓
- KanbanColumn.test.tsx: FOUND ✓ (7 tests pass)
- KanbanCard.test.tsx: FOUND ✓ (10 tests pass)
- Commits dd25f28, 5e436c4, 76e2531: FOUND ✓
- `npx tsc --noEmit`: PASSED ✓
- `npx vitest run`: 185 passed, 1 pre-existing Inbox failure (out of scope)
