---
phase: 04-task-management
verified: 2026-04-13T23:45:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Drag a task card between columns on the Tasks page"
    expected: "Card moves smoothly between columns; dragging to 'running' or 'cancelled' shows a 5-second confirmation toast with Confirm/Cancel before committing"
    why_human: "Drag-and-drop interaction, timing, and toast behavior cannot be verified programmatically without a running browser"
  - test: "Create a task, then confirm the empty-column auto-collapse behavior"
    expected: "Empty columns shrink to 40px strip with rotated label; columns with tasks expand to 260px; hovering a collapsed column temporarily expands it"
    why_human: "CSS transition behavior and hover states require visual/interaction testing"
  - test: "Open Config Editor, edit some YAML, click Review Changes"
    expected: "Inline diff panel appears below editor with green additions and red removals; 'Hide Diff' toggles it off; Revert to Saved restores original content"
    why_human: "Visual diff rendering and interactive flow require a running browser"
  - test: "Open Config Editor, click Validate, then Apply"
    expected: "HotReloadBar transitions: pending -> validating -> applied -> confirmed (or error if no WS connection)"
    why_human: "Status transition timing and UI state require a running browser; WS round-trip to Ástríðr requires connected backend"
  - test: "On Automation page, click Add Cron Job"
    expected: "Slide-out Sheet opens from the right at 400px width with CronBuilder form; selecting 'Every day' shows hour/minute dropdowns; live preview updates as dropdowns change; Save button disabled until name is filled"
    why_human: "Sheet animation, Radix UI Select interactions, and live preview require a running browser"
  - test: "On Automation page, click the Play button for a cron job"
    expected: "Play button shows spinner for ~3 seconds; toast shows 'Cron job triggered.' (or error if WS disconnected)"
    why_human: "Spinner timing and WS dispatch require a running browser"
  - test: "On Ideation page, check multiple findings and click Convert Selected"
    expected: "All selected findings convert to tasks in bulk; badge shows 'Task linked' next to converted findings; bulk count decrements as findings are converted"
    why_human: "Multi-step Convex mutations and real-time UI updates require a running browser with connected Convex backend"
---

# Phase 4: Task Management Verification Report

**Phase Goal:** Operators can create, track, and manage work items for Ástríðr agents; view proactive scan findings; edit agent config; manage cron jobs — all from the dashboard
**Verified:** 2026-04-13T23:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Kanban board shows tasks across lifecycle columns with drag-and-drop | VERIFIED | `KanbanBoard.tsx` renders 6 `KanbanColumn` instances via `TASK_COLUMNS`, uses `PointerSensor` with `activationConstraint: { distance: 8 }`, `DragOverlay` at scale-95 |
| 2 | Ideation findings display with severity, category, and one-click task conversion | VERIFIED | `IdeationRow.tsx` renders severity badge, category, status badge, Plus icon for Create Task; `Ideation.tsx` has multi-select bulk convert and inline convert via `findingToTaskDefaults` |
| 3 | Agent config editable from dashboard with diff preview and hot-reload | VERIFIED | `ConfigEditor.tsx` has Review Changes button wired to `DiffView`, `HotReloadBar` shows status transitions, Revert to Saved with inline confirm |
| 4 | Cron jobs manageable with visual builder, manual trigger, and enable/disable toggle | VERIFIED | `CronBuilder.tsx` generates expressions with live `cronToHuman` preview, `CronSheet.tsx` wraps it in a 400px right-side Sheet, `CronJobList.tsx` has inline Play + Switch controls wired to WS `cron.trigger`/`cron.toggle` |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/kanban.ts` | 6-column TaskColumn type | VERIFIED | Contains `"backlog" \| "queued" \| "running" \| "review" \| "done" \| "cancelled"`, `TASK_COLUMNS`, `ACTION_COLUMNS`, `FindingStatus` |
| `convex/tasks.ts` | Task CRUD mutations | VERIFIED | Exports `listByColumn`, `create`, `moveColumn`, `update`, `remove` with runtime `VALID_COLUMNS` validation |
| `convex/schema.ts` | tasks table + ideationFindings patches | VERIFIED | `tasks: defineTable({...})` at line 791; `ideationFindings` has `status`, `taskId`, `acknowledgedAt`, `convertedAt` fields |
| `convex/ideation.ts` | Status workflow mutations | VERIFIED | `updateFindingStatus` at line 74, `linkTask` at line 97 |
| `src/lib/findingToTask.ts` | Severity-to-priority mapping | VERIFIED | Exports `findingToTaskDefaults`, maps critical/high->high, medium->medium, low->low, unknown->medium |
| `src/lib/cronToHuman.ts` | Cron expression utilities | VERIFIED | Exports `cronToHuman`, `isValidCron`, `FREQUENCY_TO_CRON` |
| `src/components/KanbanBoard.tsx` | 6-column DnD board | VERIFIED | PointerSensor with `activationConstraint: { distance: 8 }`, maps `TASK_COLUMNS`, `DragOverlay` at `scale-95 shadow-lg opacity-90` |
| `src/components/KanbanColumn.tsx` | Collapsible column | VERIFIED | `useState(false)` for `isCollapsed`, `useRef` for `prevTaskCount`, `w-10` collapsed / `w-[260px]` expanded, `writingMode: "vertical-rl"` rotated label |
| `src/components/KanbanCard.tsx` | Rich task card | VERIFIED | `border-l-2` priority stripe, `border-l-(--status-error/warn/ok)`, `line-clamp-2`, `text-[10px]` labels, `formatTimeInColumn`, finding badge |
| `src/pages/Tasks.tsx` | Convex-wired kanban page | VERIFIED | Uses `anyApi.tasks.listByColumn`, `moveColumn`; ACTION_COLUMNS gate for toast confirmation with `duration: 5000` and `task.move` WS dispatch; no `commandExecutions` reference |
| `src/components/IdeationRow.tsx` | Rich finding row | VERIFIED | `Checkbox`, severity badge with `SEVERITY_CLASSES`, `FINDING_STATUS_MAP`, `opacity-60` for dismissed, Plus button, ACK/Dismiss actions |
| `src/pages/Ideation.tsx` | Ideation page with multi-select | VERIFIED | `selectedIds: Set<string>`, ESC handler, "Convert Selected (N)" button, status filter tabs, `updateFindingStatus`/`linkTask` mutations |
| `src/components/DiffView.tsx` | Inline diff renderer | VERIFIED | LCS algorithm, `bg-(--status-ok)/15` for added, `bg-(--status-error)/15` for removed, `max-h-[300px] overflow-y-auto`, "No changes to review." empty state |
| `src/components/HotReloadBar.tsx` | Hot-reload status bar | VERIFIED | All 5 states: pending (Loader2 + "Sending..."), validating (Loader2 + "Validating..."), applied ("Applied."), confirmed (CheckCircle2 + "Confirmed by Astrid."), error (XCircle + "Apply failed: ...") |
| `src/pages/ConfigEditor.tsx` | Config editor with diff+reload+revert | VERIFIED | "Review Changes" button, `<DiffView>` conditional render, `<HotReloadBar>`, "Revert to Saved" with inline confirm row, Apply disabled during pending/validating |
| `src/components/CronBuilder.tsx` | Visual cron builder | VERIFIED | `FrequencyPreset` selector, conditional dropdowns (hour/minute/dow), `font-mono text-xs bg-(--muted)` expression output, `text-sm text-(--muted-foreground) italic` preview, `border-(--destructive)` for invalid custom |
| `src/components/CronSheet.tsx` | Slide-out cron panel | VERIFIED | `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` imported, `side="right"` `w-[400px]`, renders `CronBuilder` |
| `src/components/CronJobList.tsx` | Interactive cron list | VERIFIED | `Play`/`Loader2` icons, `Switch` toggle, `StatusBadge`, `cronToHuman` preview, "No cron jobs configured" empty state |
| `src/pages/Automation.tsx` | Automation page wiring | VERIFIED | "Add Cron Job" button, `CronSheet` render, WS dispatch for `cron.trigger`/`cron.toggle`/`cron.create` |
| `src/components/TaskCreateForm.tsx` | Task form with finding pre-fill | VERIFIED | `prefillData?: Partial<NewTask> \| null`, state initialized from prefillData, "Pre-filled from finding:" notice, `findingId` in submit payload |
| `src/components/TaskDetail.tsx` | Task detail with finding link | VERIFIED | Origin section with `task.findingId` conditional, "Finding" badge, `TASK_COLUMNS` column move selector |
| `src/components/ui/sheet.tsx` | shadcn Sheet | VERIFIED | File exists |
| `src/components/ui/switch.tsx` | shadcn Switch | VERIFIED | File exists |
| `src/components/ui/select.tsx` | shadcn Select | VERIFIED | File exists |
| `src/components/ui/checkbox.tsx` | shadcn Checkbox | VERIFIED | File exists |
| `src/components/ui/input.tsx` | shadcn Input | VERIFIED | File exists |
| `src/components/ui/label.tsx` | shadcn Label | VERIFIED | File exists |
| `src/components/ui/textarea.tsx` | shadcn Textarea | VERIFIED | File exists |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `KanbanBoard.tsx` | `KanbanColumn.tsx` | `TASK_COLUMNS.map` | WIRED | Line 127: `{TASK_COLUMNS.map((col) => (<KanbanColumn ...>))}` |
| `KanbanColumn.tsx` | `KanbanCard.tsx` | `tasks.map` renders KanbanCard | WIRED | Line 113: `{tasks.map((task) => (<KanbanCard ...>))}` |
| `Tasks.tsx` | `convex/tasks.ts` | `useQuery(anyApi.tasks.listByColumn)`, `useMutation(anyApi.tasks.moveColumn)` | WIRED | Lines 24-26; `anyApi` used due to stale generated API types |
| `Tasks.tsx` | `AstridrWSContext.tsx` | `dispatch({ type: "task.move", ... })` | WIRED | Line 70 |
| `Ideation.tsx` | `convex/ideation.ts` | `useMutation(api.ideation.updateFindingStatus)`, `linkTask` | WIRED | Lines 35-36 |
| `IdeationRow.tsx` | `findingToTask.ts` | `findingToTaskDefaults` called in `handleCreateTask` in Ideation.tsx | WIRED | Ideation.tsx lines 84-88 |
| `ConfigEditor.tsx` | `DiffView.tsx` | `<DiffView original={originalContent} current={yamlContent}>` | WIRED | Line 422 |
| `ConfigEditor.tsx` | `HotReloadBar.tsx` | `<HotReloadBar status={reloadStatus} errorMessage={reloadError}>` | WIRED | Line 359 |
| `CronSheet.tsx` | `CronBuilder.tsx` | `<CronBuilder>` inside `SheetContent` | WIRED | CronSheet.tsx line 29 |
| `Automation.tsx` | `CronSheet.tsx` | `<CronSheet>` render with dispatch handlers | WIRED | Lines 113-118 |
| `CronJobList.tsx` | `useCommandDispatch` | `onTrigger(jobName)` -> `dispatch({ type: "cron.trigger" })` | WIRED | Automation.tsx lines 57-59 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `Tasks.tsx` | `rawTasks` | `useQuery(anyApi.tasks.listByColumn)` -> `convex/tasks.ts` `listByColumn` | Yes — DB query `ctx.db.query("tasks")` | FLOWING |
| `Ideation.tsx` | `findings` | `useQuery(api.ideation.listFindings, { dismissed: false })` | Yes — existing Convex query | FLOWING |
| `Automation.tsx` | `cronJobs` | `schedulesToCronJobs()` -> `CRON_SCHEDULES` static list | Partial — `expression` field uses human-readable interval strings (e.g. "Every 5 min"), not valid cron syntax | STATIC (known stub) |
| `ConfigEditor.tsx` | `yamlContent` | `sendCommand({ type: "config.get" })` via WS | Yes — fetches from Ástríðr backend | FLOWING (requires WS connection) |

### Behavioral Spot-Checks

Step 7b SKIPPED for browser-rendered React pages — all artifacts require running browser + Convex backend. TypeScript compilation serves as the primary programmatic check.

| Check | Command | Result | Status |
|-------|---------|--------|--------|
| TypeScript clean | `npx tsc --noEmit` | 0 errors (per all 6 SUMMARY files self-check) | PASS |
| Test suite | `npx vitest run` | 185 passed, 1 pre-existing Inbox failure (unrelated) | PASS |
| KanbanBoard wired to TASK_COLUMNS | grep | `TASK_COLUMNS.map` in KanbanBoard.tsx line 127 | PASS |
| Tasks.tsx uses api.tasks (not commandExecutions) | grep | No `commandExecutions` in Tasks.tsx; uses `anyApi.tasks.*` | PASS |
| `task.move` WS dispatch present | grep | `{ type: "task.move"` at line 70 of Tasks.tsx | PASS |
| Confirmation toast 5s duration | grep | `duration: 5000` at line 62 of Tasks.tsx | PASS |

### Requirements Coverage

The PLAN frontmatter references TM-01 through TM-04. These requirement IDs are defined in the phase-specific RESEARCH.md and CONTEXT.md documents, not in the global REQUIREMENTS.md. The global REQUIREMENTS.md maps Phase 4 to ALR-01 through ALR-05 — a known documentation discrepancy noted in RESEARCH.md line 52 ("Note: REQUIREMENTS.md maps ALR-01 through ALR-05 to Phase 4, but CONTEXT.md defines the actual Phase 4 scope as TM-01 through TM-04").

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TM-01 | Plans 01, 02, 06 | Kanban board with drag-and-drop across 6 task lifecycle columns | SATISFIED | 6-column KanbanBoard with PointerSensor, collapsible columns, rich cards, Convex data source |
| TM-02 | Plans 01, 03, 06 | Ideation findings with severity/category and one-click task conversion | SATISFIED | IdeationRow component, status workflow, multi-select bulk convert, TaskCreateForm pre-fill |
| TM-03 | Plans 01, 04 | Agent config editable from dashboard with diff preview and hot-reload | SATISFIED | DiffView + HotReloadBar + Revert to Saved wired into ConfigEditor |
| TM-04 | Plans 01, 05 | Cron jobs manageable with visual builder, manual trigger, enable/disable toggle | SATISFIED | CronBuilder, CronSheet, CronJobList with Play/Switch, Automation page WS wiring |

**Note on orphaned requirements:** ALR-01 through ALR-05 are mapped to Phase 4 in REQUIREMENTS.md but are NOT addressed by Phase 4 plans. These requirements (alert routing with Discord/Slack delivery) belong to Phase 6 and were incorrectly mapped in REQUIREMENTS.md. This is a documentation tracking issue, not a Phase 4 implementation gap.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/pages/Automation.tsx` (line 37) | `expression: s.interval` — passes human-readable string (e.g. "Every 5 min") as cron expression | Warning | `cronToHuman("Every 5 min")` returns "Invalid expression" for existing CRON_SCHEDULES jobs in CronJobList. New jobs created via CronBuilder will use proper expressions. Documented as intentional stub in 04-05-SUMMARY.md |

No blockers found. The `schedulesToCronJobs()` stub is informational — existing static schedule display shows the human-readable interval as both label and expression, which produces "Invalid expression" in the human-readable preview. This does not prevent the visual builder from generating and dispatching valid new cron expressions.

### Human Verification Required

**1. Kanban Drag-and-Drop**

**Test:** On the Tasks page, drag a task card between columns. Then drag a task to the "Running" or "Cancelled" column.
**Expected:** Cards move between columns with smooth CSS transition. Dragging to "Running" or "Cancelled" shows a toast: "{task title} -> {column}. Send command to Astrid?" with Confirm and Cancel buttons. The toast stays for 5 seconds. Clicking Confirm moves the card and dispatches the WS command; clicking Cancel does nothing.
**Why human:** Drag interaction, toast timing, and confirmation flow require a running browser with the Convex backend connected.

**2. Column Collapse/Expand**

**Test:** On the Tasks page, move all tasks out of a column that had tasks.
**Expected:** The empty column automatically collapses to a ~40px strip with a rotated vertical column label. Hovering the strip expands it temporarily. Adding a task to a collapsed column auto-expands it.
**Why human:** CSS transition behavior (`transition-[width] duration-200`) and hover states require visual testing.

**3. Config Diff Preview**

**Test:** Open Config Editor, edit some YAML in any section, then click "Review Changes".
**Expected:** An inline diff panel appears below the editor showing added lines with green background and + prefix, removed lines with red background and - prefix, and unchanged lines with no highlight. "Hide Diff" collapses the panel.
**Why human:** Visual diff rendering requires a browser; the LCS algorithm can only be verified visually with real YAML content.

**4. Hot-Reload Status Transitions**

**Test:** Open Config Editor with an active WebSocket connection to Ástríðr, edit some YAML, click Validate, then click Apply.
**Expected:** HotReloadBar shows "Sending..." → "Validating..." → "Applied." → "Confirmed by Astrid." in sequence. If WS is disconnected, shows error state.
**Why human:** Status transition timing and actual WS round-trip require connected Ástríðr backend.

**5. Cron Sheet and Builder**

**Test:** On Automation page, click "Add Cron Job". Select "Every week" frequency.
**Expected:** Slide-out Sheet opens from right at 400px. Day-of-week, Hour, and Minute dropdowns appear. As selections change, the cron expression display updates (e.g., `0 9 * * 1`) and the preview text updates (e.g., "Every Monday at 9:00"). Save is disabled until a name is entered.
**Why human:** Sheet animation, Radix UI Select interactions, and live preview require a running browser.

**6. Cron Job Play Button Spinner**

**Test:** On Automation page, click the Play (triangle) button for any cron job.
**Expected:** Button briefly shows a spinner (Loader2 animated), then reverts to Play after ~3 seconds. A toast shows "Cron job triggered." (or error if WS disconnected).
**Why human:** Spinner timing and WS dispatch require a running browser.

**7. Ideation Bulk Convert**

**Test:** On Ideation page with active findings, check multiple findings with the checkboxes, then click "Convert Selected (N)".
**Expected:** A loading state, then each selected finding creates a task in Convex and shows "Task linked" badge. A success toast shows "Converted N findings to tasks". Checkboxes deselect.
**Why human:** Sequential Convex mutations and real-time UI updates require connected Convex backend; Escape key to deselect also needs testing.

---

## Gaps Summary

No blocking gaps found. All 4 ROADMAP success criteria are achieved:

1. Kanban board renders 6 lifecycle columns with drag-and-drop, rich cards (priority stripe, labels, time-in-column, finding badge), collapsible empty columns, and PointerSensor activation.
2. Ideation findings display severity, category, status badges with one-click task conversion (inline via Create Task button, bulk via Convert Selected), plus full status workflow (open/acknowledged/converted/dismissed).
3. Agent config editor has diff preview (Review Changes button + DiffView), hot-reload feedback (HotReloadBar with 5 states), and Revert to Saved with inline confirm.
4. Cron jobs have a visual expression builder (CronBuilder with frequency presets + live preview), slide-out Sheet panel (CronSheet), inline Play trigger button with spinner, and enable/disable Switch toggle.

One known informational stub: existing CRON_SCHEDULES use human-readable interval strings as cron expressions, causing "Invalid expression" in the preview for pre-existing jobs. New jobs created via the builder will use valid expressions. This is documented and not blocking.

One documentation discrepancy: REQUIREMENTS.md maps ALR-01 through ALR-05 to Phase 4, but Phase 4 implements TM-01 through TM-04 (task management). ALR requirements belong to Phase 6. This is a tracking document issue, not a functional gap.

---

_Verified: 2026-04-13T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
