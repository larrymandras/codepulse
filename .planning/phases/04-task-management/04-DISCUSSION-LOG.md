# Phase 4: Task Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-13
**Phase:** 04-task-management
**Areas discussed:** Kanban Board Evolution, Ideation → Task Conversion, Config Editor Enhancements, Cron Management UX

---

## Kanban Board Evolution

### Column Layout

| Option | Description | Selected |
|--------|-------------|----------|
| All 6 visible always | All columns shown side-by-side with horizontal scroll if needed | |
| Collapsible columns | All 6 exist but empty columns auto-collapse to a thin strip | ✓ |
| You decide | Claude determines best layout | |

**User's choice:** Collapsible columns
**Notes:** None

### Data Source

| Option | Description | Selected |
|--------|-------------|----------|
| Ástríðr task queue (WS) | Tasks from Ástríðr via WebSocket, Convex mirrors for persistence | |
| Convex-primary, WS overlay | Tasks in Convex table, WebSocket pushes status updates | |
| Hybrid (current pattern) | Keep Convex commandExecutions + local state | |

**User's choice:** Other — "you decide what is best, don't just choose what is simpler, choose what is truly the best option"
**Notes:** Recorded as Claude's Discretion with strong directive to prioritize operational correctness over simplicity

### Card Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Rich cards (Recommended) | Labels/tags, due dates, time-in-column, linked finding badge | ✓ |
| Minimal cards | Title, priority dot, agent avatar only | |
| You decide | Claude determines card density | |

**User's choice:** Rich cards
**Notes:** None

### DnD Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with confirmation | Confirmation toast before WebSocket command on action column moves | ✓ |
| Yes, immediate | Direct fire WebSocket command with optimistic UI | |
| Column move only | Visual only, actions via task detail panel | |

**User's choice:** Yes, with confirmation
**Notes:** None

---

## Ideation → Task Conversion

### Conversion Method

| Option | Description | Selected |
|--------|-------------|----------|
| Inline convert button (Recommended) | Per-row "Create Task" icon button | |
| Batch convert | Multi-select + "Convert Selected" bulk action | |
| Both | Inline button AND checkbox multi-select | ✓ |

**User's choice:** Both
**Notes:** None

### Finding-Task Linking

| Option | Description | Selected |
|--------|-------------|----------|
| Bidirectional link (Recommended) | Finding shows task status, task shows finding. Both directions. | ✓ |
| One-way reference | Finding records task, task doesn't reference back | |
| You decide | Claude determines linking depth | |

**User's choice:** Bidirectional link
**Notes:** None

### Status Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Full workflow (Recommended) | open → acknowledged → converted → dismissed with visual badges | ✓ |
| Keep binary + converted | Add "converted" to active/dismissed. Three states total. | |
| You decide | Claude determines workflow complexity | |

**User's choice:** Full workflow
**Notes:** None

---

## Config Editor Enhancements

### Diff Preview

| Option | Description | Selected |
|--------|-------------|----------|
| Inline diff (Recommended) | Unified diff below editor, green/red highlighting, no modal | ✓ |
| Side-by-side panels | Split editor into original/modified with synchronized scrolling | |
| Modal diff | Full-screen modal with diff on Apply click | |
| You decide | Claude determines best diff UX | |

**User's choice:** Inline diff
**Notes:** None

### Hot-Reload Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Full feedback loop (Recommended) | Status bar: pending → validating → applied → confirmed. WS ack confirms. | ✓ |
| Toast confirmation only | Simple toast on WS ack | |
| You decide | Claude determines feedback granularity | |

**User's choice:** Full feedback loop
**Notes:** None

### Undo/Revert

| Option | Description | Selected |
|--------|-------------|----------|
| CodeMirror native undo | Built-in Ctrl+Z/Ctrl+Y | |
| Full revert button | "Revert to Saved" button for last-applied config | |
| Both (Recommended) | Native undo + Revert to Saved button | ✓ |

**User's choice:** Both
**Notes:** None

---

## Cron Management UX

### Expression Builder

| Option | Description | Selected |
|--------|-------------|----------|
| Visual dropdowns (Recommended) | Frequency selector with dropdown fields, human-readable preview | ✓ |
| Raw expression + preview | Text input with live human-readable preview | |
| Both modes | Toggle between visual builder and raw expression | |

**User's choice:** Visual dropdowns
**Notes:** None

### Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Inline controls (Recommended) | Play button + toggle switch per cron job row, WS commands | ✓ |
| Detail panel controls | Click to open detail panel with controls | |
| Both | Inline quick actions + detail panel for full management | |

**User's choice:** Inline controls
**Notes:** None

### Create/Edit UX

| Option | Description | Selected |
|--------|-------------|----------|
| Slide-out panel | Side panel from right with cron builder form | ✓ |
| Modal dialog | Full modal with cron builder form | |
| You decide | Claude determines best create/edit UX | |

**User's choice:** Slide-out panel
**Notes:** None

---

## Claude's Discretion

- Kanban data source architecture (best approach, not simplest)
- KanbanCard component API and layout density
- Collapsible column animation details
- Diff view library choice
- Cron expression builder component design
- Finding-to-task field mapping
- Slide-out panel component choice
- Hot-reload status bar animation

## Deferred Ideas

None — discussion stayed within phase scope
