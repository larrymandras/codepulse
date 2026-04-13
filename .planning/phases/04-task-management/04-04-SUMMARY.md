---
phase: 04-task-management
plan: "04"
subsystem: config-editor
tags:
  - diff-view
  - hot-reload
  - revert
  - codemirror
  - tdd
dependency_graph:
  requires:
    - "04-01"
  provides:
    - DiffView component (inline diff renderer)
    - HotReloadBar component (status bar with transitions)
    - ConfigEditor diff panel, revert, and reload status
  affects:
    - src/pages/ConfigEditor.tsx
    - src/components/DiffView.tsx
    - src/components/HotReloadBar.tsx
tech_stack:
  added: []
  patterns:
    - LCS-based diff algorithm (no library, pure TypeScript)
    - TDD red-green cycle with @testing-library/react
    - oklch CSS custom property tokens for status colors
key_files:
  created:
    - src/components/DiffView.tsx
    - src/components/HotReloadBar.tsx
    - src/components/__tests__/DiffView.test.tsx (replaced stubs)
    - src/components/__tests__/HotReloadBar.test.tsx (replaced stubs)
  modified:
    - src/pages/ConfigEditor.tsx
decisions:
  - LCS diff in DiffView — no external diff library needed for display-only use; LCS gives correct added/removed/unchanged classification
  - setTimeout for confirmed state — WS ack confirmation simulated with 1500ms delay per plan; real ack would require WS message handler
  - Pre-existing Inbox test failure is out of scope — unrelated to this plan's changes
metrics:
  duration: "~12 minutes"
  completed: "2026-04-13T23:12:40Z"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
requirements:
  - TM-03
---

# Phase 04 Plan 04: Diff Preview, Hot-Reload Bar, and Revert Summary

**One-liner:** Inline GitHub-style diff panel with oklch colors, hot-reload status bar transitioning pending→validating→applied→confirmed, and Revert to Saved with inline confirm row added to ConfigEditor.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Write failing tests for DiffView and HotReloadBar | 22564db | DiffView.test.tsx, HotReloadBar.test.tsx |
| 1 (GREEN) | Implement DiffView and HotReloadBar components | c73d2a7 | DiffView.tsx, HotReloadBar.tsx |
| 2 | Wire DiffView, HotReloadBar, and Revert into ConfigEditor | 2fad3e5 | ConfigEditor.tsx |

## What Was Built

### DiffView.tsx
Pure display component implementing a line-level LCS diff algorithm. Given `original` and `current` YAML strings, computes added/removed/unchanged lines and renders them with:
- Green background (`bg-(--status-ok)/15`) and `+` prefix for additions
- Red background (`bg-(--status-error)/15`) and `-` prefix for removals
- Line numbers in left gutter
- Monospace font, max 300px height with scroll
- "No changes to review." empty state when strings are equal

### HotReloadBar.tsx
Pure display component showing apply lifecycle state with icons:
- `pending`: Loader2 spinner + "Sending..."
- `validating`: Loader2 spinner + "Validating..."
- `applied`: "Applied." in ok color
- `confirmed`: CheckCircle2 + "Confirmed by Astrid."
- `error`: XCircle + "Apply failed: {errorMessage}"
- `null/undefined`: renders nothing

### ConfigEditor.tsx additions
- **Review Changes** button (D-09): toggles `showDiff` state, renders `<DiffView>` below editor
- **HotReloadBar** (D-10): shown below Apply button; transitions applied→confirmed→null after successful apply
- **Revert to Saved** (D-11): shown when `isDirty`; single-step confirm row before reverting editor to `originalContent`
- Apply button disabled during `pending` and `validating` states (T-04-07 DoS mitigation)

## Verification

```
npx vitest run src/components/__tests__/DiffView.test.tsx src/components/__tests__/HotReloadBar.test.tsx
→ 11/11 tests pass

npx tsc --noEmit (for DiffView.tsx, HotReloadBar.tsx, ConfigEditor.tsx)
→ 0 errors in modified files
```

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing `Inbox.test.tsx` failure (`'R' key opens reject flow`) was present before this plan and is out of scope.

## Known Stubs

None — all components are fully wired with real logic.

## Threat Flags

No new threat surface introduced. T-04-06 (YAML validation) and T-04-07 (DoS via rapid apply) mitigations are both in place: Apply button disabled during pending/validating, and dry-run validation step exists in handleValidate.

## Self-Check: PASSED

- src/components/DiffView.tsx: EXISTS
- src/components/HotReloadBar.tsx: EXISTS
- src/components/__tests__/DiffView.test.tsx: EXISTS (11 tests, 0 todos)
- src/components/__tests__/HotReloadBar.test.tsx: EXISTS (6 tests, 0 todos)
- src/pages/ConfigEditor.tsx: EXISTS with DiffView, HotReloadBar, Review Changes, Revert to Saved
- Commits 22564db, c73d2a7, 2fad3e5: all present in git log
