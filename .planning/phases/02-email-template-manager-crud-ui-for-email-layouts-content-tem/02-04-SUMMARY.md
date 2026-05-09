---
phase: 02
plan: "04"
subsystem: email-template-manager
tags: [email, monaco, preview, variables, crud, react]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [TemplateSheet, VariableSchemaTable, VariableChipsToolbar, EmailPreviewPane]
  affects: [EmailTemplates.tsx]
tech_stack:
  added: ["@monaco-editor/react@4.7.0"]
  patterns: [debounced-preview, insert-at-cursor, controlled-table-rows, srcdoc-iframe-sandbox]
key_files:
  created:
    - src/components/email/VariableSchemaTable.tsx
    - src/components/email/VariableChipsToolbar.tsx
    - src/components/email/EmailPreviewPane.tsx
    - src/components/email/TemplateSheet.tsx
  modified:
    - package.json
    - package-lock.json
decisions:
  - VariableChipsToolbar only shows chips when v.name.trim() is non-empty to avoid empty {{}} chips
  - TemplateSheet tracks slug-derived-from-name state to stop auto-slug when user manually edits slug
  - EmailPreviewPane splits disabled/edit paths early to avoid hook-in-conditional issues
  - Monaco Editor uses explicit height containers (320px for html_body, 160px for text_body) per Pitfall 7
  - VariableChipsToolbar hidden when no named variables exist (returns null) vs showing empty toolbar
metrics:
  duration: ~10min
  completed: "2026-05-09T16:31:04Z"
  tasks: 2
  files_created: 4
  files_modified: 2
---

# Phase 02 Plan 04: Template Editor Components Summary

Template editor UI delivering the most complex editor surface — Monaco HTML editing with variable chip insert-at-cursor, interactive variable schema table, debounced sandboxed iframe preview, and the split TemplateSheet orchestrating all four.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | VariableSchemaTable + VariableChipsToolbar + EmailPreviewPane | 9645d2a | VariableSchemaTable.tsx, VariableChipsToolbar.tsx, EmailPreviewPane.tsx, package.json |
| 2 | TemplateSheet with split editor + preview layout and Monaco integration | 463a92a | TemplateSheet.tsx |

## What Was Built

### VariableSchemaTable (src/components/email/VariableSchemaTable.tsx)

Interactive controlled table component. Each row has Name (font-mono Input with blur-validation against `[a-z_][a-z0-9_]*`), Type (Select: string/number/url/html), Required (Switch), Description (Input), Example (Input), and Delete (ghost Button, `aria-label="Remove variable"`, 40px touch target). State is fully parent-controlled via `rows`/`onChange` props — the component calls `onChange(updatedRows)` on every field change. Add row appends a blank row; remove row re-indexes name error state.

### VariableChipsToolbar (src/components/email/VariableChipsToolbar.tsx)

Horizontal flex-wrap bar rendering one chip per named variable. Each chip button displays `{{variable_name}}` in font-mono with `primary/10` background and `aria-label="Insert {{variable_name}}"`. Clicking calls `onInsert("{{" + v.name + "}}")`. Returns null when no variables have non-empty names (toolbar collapses entirely). No external dependencies.

### EmailPreviewPane (src/components/email/EmailPreviewPane.tsx)

Debounced iframe preview with 500ms useRef timer following the useCatalog.ts pattern. In disabled mode (create), shows static "Save the template first to enable preview." centered placeholder. In edit mode: header row with "Preview" label, SMTP/Gmail ToggleGroup toggle, and Loader2 spinner + "Updating preview…" text during fetch. Calls `previewTemplate(slug, { variables: buildSampleVariables(variables), channel })` on change. Error state shows generic "Preview failed. Check your template syntax and variable definitions." iframe uses `srcDoc` with `sandbox="allow-same-origin"` — no `allow-scripts` (T-02-09).

### TemplateSheet (src/components/email/TemplateSheet.tsx)

1100px wide Sheet orchestrating all three components. Split layout: `flex-1` left editor panel + `w-[400px]` shrink-0 right preview panel. Monaco Editor (OnMount ref captured as `editorRef`) for html_body at 320px height; plaintext Monaco for text_body at 160px. `insertAtCursor` uses `editor.getSelection()` + `editor.executeEdits("variable-insert", [...])` + `editor.focus()`. VariableChipsToolbar renders above html_body Monaco only when named variables exist, with border-t-0 to connect toolbar to editor visually. Layout selector populates from `layouts` prop. Auto-slug derivation from name in create mode; manual slug edit stops auto-derive. Dirty tracking via `JSON.stringify(current) !== JSON.stringify(original)`. Save calls `createTemplate` or `updateTemplate`, shows `toast.success("Template saved")`. Delete uses AlertDialog with "Delete template?" + correct destructive copy, calls `deleteTemplate`, shows `toast.success("Template deleted")`. EmailPreviewPane receives `disabled={mode === "create"}`.

## Deviations from Plan

None - plan executed exactly as written.

## Security Audit (T-02-09 through T-02-12)

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-09 | `srcDoc` + `sandbox="allow-same-origin"` (no allow-scripts) | Applied |
| T-02-10 | Blur validation against `/^[a-z_][a-z0-9_]*$/` with inline error text | Applied |
| T-02-11 | Preview error shows generic copy, never raw API error | Applied |
| T-02-12 | 500ms debounce with useRef timer + cleanup on unmount | Applied |

## Known Stubs

None. All components are fully wired. TemplateSheet receives `layouts` from parent. EmailPreviewPane calls live `previewTemplate` API.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced in this plan.

## Self-Check: PASSED

- [x] src/components/email/VariableSchemaTable.tsx — FOUND
- [x] src/components/email/VariableChipsToolbar.tsx — FOUND
- [x] src/components/email/EmailPreviewPane.tsx — FOUND
- [x] src/components/email/TemplateSheet.tsx — FOUND
- [x] Commit 9645d2a (Task 1) — FOUND
- [x] Commit 463a92a (Task 2) — FOUND
- [x] No TypeScript errors in email/ files — VERIFIED
- [x] No `allow-scripts` in EmailPreviewPane.tsx — VERIFIED
- [x] No `dangerouslySetInnerHTML` in EmailPreviewPane.tsx — VERIFIED
