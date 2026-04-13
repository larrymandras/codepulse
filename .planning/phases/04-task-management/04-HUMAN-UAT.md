---
status: partial
phase: 04-task-management
source: [04-VERIFICATION.md]
started: 2026-04-13T23:45:00Z
updated: 2026-04-13T23:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Kanban drag-and-drop
expected: Drag task between columns works smoothly; dragging to running/cancelled shows 5-second confirmation toast with Confirm/Cancel buttons; confirming fires WS command
result: [pending]

### 2. Column collapse/expand
expected: Empty columns auto-collapse to 40px strip with rotated label; hover expands them; adding a task auto-expands the column
result: [pending]

### 3. Config diff preview
expected: "Review Changes" button shows inline LCS diff with green backgrounds for added lines and red for removed lines; line numbers in gutter
result: [pending]

### 4. Hot-reload status transitions
expected: HotReloadBar cycles through pending → validating → applied → confirmed states with appropriate icons (Loader2 spinner, CheckCircle2, etc.) when connected to Ástríðr
result: [pending]

### 5. Cron Sheet and Builder
expected: Sheet slides in from right at 400px width; frequency dropdown presets generate correct cron expressions; human-readable preview updates live; Save button disabled when name is empty or expression is invalid
result: [pending]

### 6. Cron Play spinner
expected: Play button shows Loader2 spinner for ~3 seconds then reverts to play icon; WS dispatch fires on click
result: [pending]

### 7. Ideation bulk convert
expected: Multi-select checkboxes work; bulk convert creates tasks for all selected findings; "Task linked" badges appear on converted findings; success toast fires
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
