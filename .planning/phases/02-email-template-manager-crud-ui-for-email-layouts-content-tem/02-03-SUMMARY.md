---
phase: 02-email-template-manager
plan: "03"
subsystem: email-template-manager
tags: [email, layouts, assets, monaco, react, shadcn]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [layout-crud-ui, asset-management-ui, monaco-editing]
  affects: [src/pages/EmailTemplates.tsx]
tech_stack:
  added:
    - "@monaco-editor/react ^4.7.0 — Monaco code editor for HTML/CSS editing"
  patterns:
    - "Sheet + sub-tabs + Monaco for layout editing"
    - "Drag-drop dropzone with client-side 5MB/type validation"
    - "AlertDialog for delete confirmations (destructive actions)"
    - "useEmailLayouts hook driving Layouts tab data"
    - "AssetGallery self-managed loading/empty/error states"
key_files:
  created:
    - src/components/email/AssetDropzone.tsx
    - src/components/email/AssetGallery.tsx
    - src/components/email/AssetPicker.tsx
    - src/components/email/LayoutSheet.tsx
  modified:
    - src/pages/EmailTemplates.tsx
    - package.json
    - package-lock.json
decisions:
  - "DropzoneState machine (idle/dragover/uploading/uploaded) avoids boolean state conflicts"
  - "SlugEdited flag tracks user slug edits vs auto-derived from name"
  - "AssetGallery passes showUploadButton=false inside AssetPicker to avoid nested upload confusion"
  - "LayoutSheet uses separate AlertDialog portal to avoid z-index conflicts with Sheet"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 7
---

# Phase 02 Plan 03: LayoutSheet + Asset Components + Page Wiring Summary

Monaco-powered LayoutSheet with 4 sub-tabs (Header/Footer/CSS/Settings), three asset management components (AssetDropzone, AssetGallery, AssetPicker), and Layouts + Assets tabs wired with live data.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install Monaco + asset components | `7700079` | AssetDropzone.tsx, AssetGallery.tsx, AssetPicker.tsx, package.json |
| 2 | Create LayoutSheet with Monaco sub-tabs | `b03c153` | LayoutSheet.tsx |
| 3 | Wire Layouts + Assets tabs into EmailTemplates page | `d1305be` | EmailTemplates.tsx |

## What Was Built

### AssetDropzone (`src/components/email/AssetDropzone.tsx`)
- 4-state machine: idle, dragover, uploading, uploaded
- Client-side validation before upload: 5MB max (File exceeds 5 MB limit), image type only (Only PNG, JPEG, or WebP)
- Inline error display below dropzone on validation failure
- Drag-over state: border-primary with bg-primary/5 fill
- Uploaded state: thumbnail with hover "Replace" overlay
- Hidden `<input type="file">` for keyboard accessibility
- Calls `uploadEmailAsset` (multipart, no authHeaders — follows T-02-06 mitigation)
- Optional `onPickerOpen` prop renders "Browse gallery" link

### AssetGallery (`src/components/email/AssetGallery.tsx`)
- Filter pills: All / Avatars / Logos (wired to useEmailAssets filter)
- Thumbnail grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Each cell: 96x96px, object-cover, filename below
- Selected cell: ring-2 ring-primary bg-primary/10
- Delete button: visible on hover, triggers AlertDialog with "Delete asset?" confirmation
- Empty state with "No assets uploaded" heading and upload trigger
- Loading state: 8x Skeleton cells
- Error state: message + Retry button
- Inline upload toggle: shows AssetDropzone above grid when "+" clicked

### AssetPicker (`src/components/email/AssetPicker.tsx`)
- Dialog (max-w-3xl) wrapping AssetGallery for gallery selection
- "Upload New" toggle shows inline AssetDropzone
- "Use Selected" button enabled only when asset is selected
- Closes dialog and calls onSelect on confirmation
- State reset on dialog close

### LayoutSheet (`src/components/email/LayoutSheet.tsx`)
- Sheet width: `w-[640px] sm:max-w-[640px] overflow-y-auto`
- 4 sub-tabs: Header, Footer, CSS, Settings
- Monaco in Header and Footer tabs: `language="html"`, vs-dark, minimap off, JetBrains Mono 13px, h-80 (320px) container
- Monaco in CSS tab: `language="css"`, same options
- Collapsible slot documentation panel in Header/Footer tabs showing: `{{{content}}}`, `{{{logo_url}}}`, `{{{avatar_url}}}`, `{{{signature_name}}}`, `{{{signature_title}}}`
- Settings tab: Name, Slug (auto-derived + editable), Description, AssetDropzone + "Browse gallery" → AssetPicker
- Edit mode: fetchLayout on open, Skeleton loading state, Retry on error
- Dirty tracking: save disabled until form changes AND name non-empty
- Save: createLayout (create) or updateLayout (edit), toast.success("Layout saved"), generic error without raw API detail (T-02-07)
- Delete (edit only): AlertDialog "Delete layout?", toast.success("Layout deleted")
- AssetPicker dialog for logo selection, separate portal from Sheet

### EmailTemplates page (`src/pages/EmailTemplates.tsx`)
- Layouts tab: loading skeletons (3x h-12), error+retry, empty state, data-driven list
- Layout rows: name, slug (font-mono), description, Edit button
- Edit button opens LayoutSheet in edit mode with slug
- New Layout button opens LayoutSheet in create mode
- Assets tab: `<AssetGallery />` (self-managed states)
- LayoutSheet wired with onSaved → reloadLayouts

## Deviations from Plan

None — plan executed exactly as written.

## Threat Model Compliance

All STRIDE mitigations from the plan's threat model were applied:

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-02-05 | Mitigated | AssetDropzone validates size and type client-side before upload call; shows inline error text |
| T-02-06 | Mitigated | uploadEmailAsset uses raw fetch + FormData with Authorization only; no Content-Type set |
| T-02-07 | Mitigated | Save/delete errors show generic copy ("Failed to save layout"), raw error logged to console only |
| T-02-08 | Accepted | Monaco stores HTML via API; CodePulse does not render in own DOM |

## Known Stubs

- Templates tab: empty state only (Plan 04 will add TemplateSheet + data)
- Agent Defaults tab: empty state only (Plan 05 will add AgentDefaultSheet + data)
- Assets tab "Upload Image" button in page header: not yet wired (AssetGallery handles upload internally; page-level button is a stub for Plan 03 scope — AssetGallery's own upload button is fully functional)

## Self-Check

### Created files exist:
- [x] `src/components/email/AssetDropzone.tsx`
- [x] `src/components/email/AssetGallery.tsx`
- [x] `src/components/email/AssetPicker.tsx`
- [x] `src/components/email/LayoutSheet.tsx`
- [x] `src/pages/EmailTemplates.tsx` (modified)

### Commits exist:
- [x] `7700079` — feat(02-03): install Monaco + create AssetDropzone, AssetGallery, AssetPicker
- [x] `b03c153` — feat(02-03): create LayoutSheet with Monaco sub-tabs
- [x] `d1305be` — feat(02-03): wire Layouts and Assets tabs into EmailTemplates page

## Self-Check: PASSED
