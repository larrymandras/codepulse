---
phase: 02
plan: "05"
subsystem: email-template-manager
tags: [email, agent-defaults, templates, crud, react, visual-verify]
dependency_graph:
  requires: [02-03, 02-04]
  provides: [AgentDefaultSheet, fully-wired-email-page]
  affects: [EmailTemplates.tsx]
tech_stack:
  added: []
  patterns: [card-grid, asset-dropzone-reuse, layout-selector, form-state-reset-on-open]
key_files:
  created:
    - src/components/email/AgentDefaultSheet.tsx
  modified:
    - src/pages/EmailTemplates.tsx
decisions:
  - AgentDefaultSheet placed AssetPicker outside Sheet (sibling JSX) to avoid z-index stacking conflicts between Sheet overlay and Dialog overlay
  - Avatar URL construction uses conditional check for http prefix to support both storage paths and pre-existing full URLs
  - Layout lookup by ID uses inline helper function shared between Templates tab badges and Agent Defaults tab cards
  - Agent card shows initials placeholder (first character of agent name) when no avatar configured
  - Templates tab variable count badge uses singular/plural ("var"/"vars") for clarity
metrics:
  duration: ~8min
  completed: "2026-05-09T17:00:00Z"
  tasks: 2
  files_created: 1
  files_modified: 1
---

# Phase 02 Plan 05: Agent Defaults + Final Tab Wiring Summary

AgentDefaultSheet editor with signature fields, avatar dropzone, and layout selector, plus full wiring of Templates and Agent Defaults tabs -- completing all 4 tabs of the Email Template Manager page. Human visual checkpoint approved.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | AgentDefaultSheet + wire Templates and Agent Defaults tabs | 7950063 | AgentDefaultSheet.tsx (new), EmailTemplates.tsx (updated) |
| 2 | Visual checkpoint | -- (human-verify, approved) | -- |

## What Was Built

### AgentDefaultSheet (src/components/email/AgentDefaultSheet.tsx)

480px wide Sheet with title "Agent Email Settings". Form state: signature_name, signature_title, avatar_storage_path, default_layout_id. Each re-initialized via useEffect on sheet open with existingDefaults prop. Fields: display-only agent name (text-lg font-semibold), Signature Name Input, Signature Title Input, Default Layout Select (None + all layouts from prop), Avatar AssetDropzone (folder="avatars") with "Browse gallery" link opening AssetPicker Dialog. Save calls upsertAgentEmailDefaults, shows toast.success("Agent settings saved"), closes sheet. Error shows generic "Failed to save settings" per T-02-14 threat mitigation -- never raw API details.

### Templates Tab Wiring (src/pages/EmailTemplates.tsx)

Connected useEmailTemplates hook. Loading state: 3x Skeleton rows. Error state: error text + Retry button. Empty state: FileText icon + "No templates yet" copy from UI-SPEC. Data state: vertical list matching Layouts tab pattern (bg-card border-b), each row showing template name, slug (font-mono), layout name Badge (outline, looked up from layouts by layout_id), variable count Badge (outline, "N vars"). Edit button opens TemplateSheet in edit mode. "New Template" button wired to open TemplateSheet in create mode.

### Agent Defaults Tab Wiring (src/pages/EmailTemplates.tsx)

Connected useAgentDefaults hook. Loading state: 6x Skeleton cards in 3-column grid. Error state: error text + Retry button. Empty state: UserCircle icon + "No agent defaults configured" copy from UI-SPEC (no CTA per spec). Data state: responsive card grid (grid-cols-1/md:2/lg:3, gap-4). Each card: rounded-xl border with hover:border-primary/30 transition, 48x48 avatar thumbnail (rounded-full object-cover) or initials placeholder (bg-muted circle), signature name (font-semibold), signature title (text-xs muted), assigned layout name or "No layout assigned", and "No email defaults configured" text for agents without defaults. Click opens AgentDefaultSheet with agent data pre-loaded.

### Sheet Integration

TemplateSheet and AgentDefaultSheet both rendered at root level of EmailTemplates page (siblings to existing LayoutSheet). TemplateSheet receives layouts array for its layout selector. AgentDefaultSheet receives layouts array for its default layout selector. Both fire reload callbacks on successful save.

## Deviations from Plan

None -- plan executed exactly as written.

## Security Audit (T-02-13, T-02-14)

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-02-13 | Avatar URLs sourced from Supabase Storage via trusted API -- accepted risk | Acknowledged |
| T-02-14 | Save error shows generic "Failed to save settings", never raw API error details | Applied |

## Known Stubs

None. All 4 tabs are fully wired to live hooks (useEmailLayouts, useEmailTemplates, useAgentDefaults, useEmailAssets via AssetGallery). All Sheets call real API functions. No hardcoded data or placeholder content.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced in this plan.

## Self-Check: PASSED

- [x] src/components/email/AgentDefaultSheet.tsx -- FOUND
- [x] src/pages/EmailTemplates.tsx -- FOUND
- [x] Commit 7950063 (Task 1) -- FOUND
- [x] No TypeScript errors in email/ files -- VERIFIED
- [x] emailTemplateUtils tests pass (7/7) -- VERIFIED
- [x] Visual checkpoint approved by user -- CONFIRMED
