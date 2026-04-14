# Phase 4: Task Management - Context

**Gathered:** 2026-04-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Operators can create, track, and manage work items for Ástríðr agents; view and triage proactive scan findings with task conversion; edit agent config with diff preview and hot-reload feedback; and manage cron jobs with visual builder, manual trigger, and enable/disable controls — all from the dashboard. This phase upgrades four existing surfaces (Tasks, Ideation, ConfigEditor, Automation) that were scaffolded in Phase 56.

</domain>

<decisions>
## Implementation Decisions

### Kanban Board Evolution
- **D-01:** Expand from 3 columns to 6: backlog → queued → running → review → done → cancelled. Full task lifecycle visibility
- **D-02:** Collapsible columns — all 6 exist but empty columns auto-collapse to a thin strip. Expand on hover or when tasks arrive. Keeps the board compact on smaller screens
- **D-03:** Rich task cards — add labels/tags, due dates, time-in-column indicator, and linked finding badge (for ideation conversions). Matches Paperclip's information-dense style
- **D-04:** Drag-and-drop column moves trigger Ástríðr commands with confirmation — dragging to action columns (running, cancelled) shows a confirmation toast before sending the WebSocket command
- **D-05:** Data source architecture — Claude's Discretion with strong directive: choose the BEST architecture for a command center that genuinely controls Ástríðr, not just displays data. Evaluate Ástríðr task queue (WS commands) as primary with Convex persistence vs. Convex-primary with WS overlay. Prioritize operational correctness over implementation simplicity

### Ideation → Task Conversion
- **D-06:** Both inline and batch conversion — each finding row gets a "Create Task" icon button for one-off conversions, PLUS checkbox multi-select with "Convert Selected" bulk action for triage sessions
- **D-07:** Bidirectional linking — finding shows linked task status badge, task detail shows originating finding. Changes to either are visible from the other side
- **D-08:** Full status workflow for findings: open → acknowledged → converted → dismissed. Visual status badges on each finding. Supports proper triage: acknowledge first, convert or dismiss later

### Config Editor Enhancements
- **D-09:** Inline diff preview — show a unified diff view below the editor when "Review Changes" is clicked. Green/red highlighting for additions/removals. Stays in the same view, no modal
- **D-10:** Full hot-reload feedback loop — after apply: show pending → validating → applied → confirmed status bar. WebSocket ack from Ástríðr confirms the reload actually took effect. Error state if reload fails
- **D-11:** Both CodeMirror native undo (Ctrl+Z/Ctrl+Y for granular edits) AND a "Revert to Saved" button for full rollback to last-applied config

### Cron Management UX
- **D-12:** Visual dropdown cron builder — frequency selector (every minute/hour/day/week/custom) with dropdown fields for hour, day-of-week, etc. Generates the cron expression. Shows human-readable preview ("Every day at 3:00 AM")
- **D-13:** Inline controls on each cron job row — play button (manual trigger) and toggle switch (enable/disable). Actions send WebSocket commands to Ástríðr. Status updates live
- **D-14:** Slide-out panel for create/edit — side panel slides in from the right with the cron builder form. Keeps context of the job list visible. Matches Paperclip's information-dense pattern

### Claude's Discretion
- Kanban data source architecture (D-05) — choose the best approach given Ástríðr Phase 49's actual API surface
- KanbanCard component API and layout density within the "rich cards" directive
- Collapsible column animation and collapse threshold (how many tasks before auto-expand)
- Diff view library choice (CodeMirror diff extension vs. custom)
- Cron expression builder component design (number of dropdowns, custom expression validation)
- Finding-to-task field mapping (severity → priority, category → label)
- Slide-out panel component choice (shadcn Sheet or custom)
- Hot-reload status bar animation and timing

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Task Management (Phase 56 — upgrade these)
- `src/pages/Tasks.tsx` — Kanban board page with 3-column DnD, Convex commandExecutions + local state
- `src/components/KanbanBoard.tsx` — @dnd-kit DnD board with DragOverlay, closestCenter collision
- `src/components/KanbanColumn.tsx` — Droppable column with SortableContext
- `src/components/KanbanCard.tsx` — Draggable task card (minimal: title, priority, agent)
- `src/components/TaskDetail.tsx` — Task detail side panel
- `src/components/TaskCreateForm.tsx` — Task creation form
- `src/types/kanban.ts` — KanbanTask, TaskColumn, TaskPriority types (needs expansion to 6 columns)

### Existing Ideation (Phase 56 — upgrade)
- `src/pages/Ideation.tsx` — Findings list with severity/scan-type filtering, dismiss functionality
- `convex/ideation.ts` — Convex queries: listFindings, findingStats, dismissFinding mutations

### Existing Config Editor (Phase 56 — upgrade)
- `src/pages/ConfigEditor.tsx` — CodeMirror YAML editor with dry-run validation, hot-reload apply via WebSocket
- Dependencies: `@uiw/react-codemirror`, `@codemirror/lang-yaml`, `js-yaml`

### Existing Cron/Automation (Phase 56 — upgrade)
- `src/pages/Automation.tsx` — Read-only automation dashboard with CronJobList, CronExecutionHistory
- `src/components/CronJobList.tsx` — Cron job list (read-only display)
- `src/components/CronExecutionHistory.tsx` — Execution history table

### WebSocket Infrastructure (Phase 2)
- `src/contexts/AstridrWSContext.tsx` — WebSocket singleton with subscribeEvent/sendCommand API
- `src/hooks/useCommandDispatch.ts` — Command dispatch pattern (reference for cron/config commands)

### UI Foundation (Phase 1)
- `src/components/MetricCard.tsx` — MetricCard pattern
- `src/components/EntityRow.tsx` — Universal list item pattern
- `src/components/StatusBadge.tsx` — Status badge component (reuse for finding status workflow)
- `src/index.css` — oklch token layer, animation keyframes

### Phase 3 Assets (reusable)
- `src/components/BlockRenderer.tsx` — Generative UI Block dispatcher (potential reuse in task detail)
- `src/components/InboxCard.tsx` — Action card pattern with approve/reject (reference for conversion UX)

### Project Context
- `.planning/PROJECT.md` — Project vision, cross-repo constraints
- `.planning/REQUIREMENTS.md` — TM-01 through TM-04, ALR-01 through ALR-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `KanbanBoard` + `KanbanColumn` + `KanbanCard`: Working @dnd-kit setup — extend with 3 more columns, richer card data, collapsible behavior
- `TaskDetail` + `TaskCreateForm`: Working task CRUD UI — extend with finding link, richer fields
- `ConfigEditor`: Full CodeMirror YAML editor with WS command integration — add diff layer and feedback bar
- `CronJobList`: Read-only cron display — upgrade to interactive with inline controls
- `StatusBadge`: Existing component — reuse for finding status workflow badges
- `EntityRow`: Universal list pattern — potential base for cron job rows
- `AstridrWSContext.sendCommand()`: Established pattern for all WS command interactions

### Established Patterns
- WebSocket command: `sendCommand({type, ...params})` returns `Promise<AckResponse>` — use for task CRUD, cron trigger, config apply
- Optimistic UI: Tasks page already uses local state overlay on Convex data — extend this pattern
- @dnd-kit: `DndContext` + `DragOverlay` + `closestCenter` collision — established, extend for 6 columns
- shadcn/ui: Sheet component available for slide-out panels
- Convex queries: `useQuery(api.table.query)` pattern throughout

### Integration Points
- `AstridrWSContext`: New command types needed — `task.*`, `cron.trigger`, `cron.toggle`, `config.apply` with ack feedback
- `src/types/kanban.ts`: Expand TaskColumn union to 6 values, add fields to KanbanTask interface
- `convex/ideation.ts`: Add status workflow mutations, task linking fields
- `DashboardLayout.tsx`: No nav changes needed — Tasks, Ideation, ConfigEditor, Automation pages already exist

</code_context>

<specifics>
## Specific Ideas

- Kanban collapsible columns should feel smooth — thin strip with column label rotated vertically, expands with animation when tasks arrive or on hover
- Rich task cards should show priority as a colored left-border stripe (like InboxCard's risk-level pattern), not just a dot
- Finding → Task conversion should pre-fill intelligently: severity maps to priority (critical→high, high→high, medium→medium, low→low), finding title becomes task title, finding description becomes task description
- Config diff should look like a GitHub PR diff — familiar, scannable, using the oklch palette for add/remove colors
- Cron human-readable preview should update live as the user changes dropdowns — instant feedback loop
- Manual trigger button should show a brief "running" spinner state while waiting for the WS ack

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-task-management*
*Context gathered: 2026-04-13*
