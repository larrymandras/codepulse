---
phase: 02-email-template-manager
plan: "00"
subsystem: email-template-manager
tags: [backend, api, test-stubs, wave-0]
dependency_graph:
  requires: []
  provides:
    - GET /api/email-assets list endpoint in astridr-repo
    - 5 test stub files in codepulse for Plans 01-05
  affects:
    - astridr-repo: astridr/api/template_routes.py
    - codepulse: src/lib/astridrApi.test.ts
    - codepulse: src/lib/emailTemplateUtils.test.ts
    - codepulse: src/hooks/useEmailLayouts.test.ts
    - codepulse: src/components/email/__tests__/AssetDropzone.test.tsx
    - codepulse: src/components/email/__tests__/EmailPreviewPane.test.tsx
tech_stack:
  added: []
  patterns:
    - Supabase Storage list API (POST /storage/v1/object/list/{bucket})
    - FastAPI route ordering: fixed-path before path-param to avoid shadowing
    - Vitest .todo() stubs for Nyquist sampling (pre-create test files before implementation)
key_files:
  created:
    - src/lib/emailTemplateUtils.test.ts
    - src/lib/astridrApi.test.ts
    - src/hooks/useEmailLayouts.test.ts
    - src/components/email/__tests__/AssetDropzone.test.tsx
    - src/components/email/__tests__/EmailPreviewPane.test.tsx
  modified:
    - C:/Users/mandr/astridr-repo/astridr/api/template_routes.py
decisions:
  - "Inserted list_email_assets() before proxy_email_asset() in template_routes.py to prevent FastAPI route shadowing"
  - "Used Supabase Storage POST list API (not GET) per Supabase API contract"
  - "API connectivity check returned 401 (auth enforced) — Astríðr API is reachable and healthy"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-09T16:12:29Z"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 00: Wave 0 — Backend Prerequisite + Test Scaffolding Summary

Wave 0 delivered the GET /api/email-assets list endpoint in astridr-repo and pre-created 5 Vitest test stub files in codepulse covering all critical Phase 02 behaviors.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add GET /api/email-assets list endpoint | fa67882 (astridr-repo) | template_routes.py |
| 2 | Create 5 test stub files in codepulse | 67f7d76 (codepulse) | 5 new test files |

## What Was Built

### Task 1: GET /api/email-assets Endpoint (astridr-repo)

Added `list_email_assets()` to `astridr/api/template_routes.py` with:
- Optional `?folder=` query parameter (avatars or logos)
- Queries Supabase Storage list API: `POST /storage/v1/object/list/email-assets`
- Returns: `name`, `storage_path`, `public_url`, `size`, `created_at` per asset
- Skips folder entries (items where `id is None`)
- Capped at 1,000 results (T-02-00b DoS mitigation)
- Inserted BEFORE `GET /api/email-assets/{path:path}` to prevent route shadowing

Route order in file (verified):
1. `POST /api/email-assets/upload`
2. `GET /api/email-assets` (new — list)
3. `GET /api/email-assets/{path:path}` (proxy — must be last)

### Task 2: Test Stub Files (codepulse)

5 test files created with 29 total `.todo()` stubs. All run without errors.

| File | Stubs | Key Behaviors Covered |
|------|-------|-----------------------|
| `src/lib/emailTemplateUtils.test.ts` | 7 | variableSchemaToRows, rowsToVariableSchema, buildSampleVariables |
| `src/lib/astridrApi.test.ts` | 6 | uploadEmailAsset auth contract (no Content-Type on FormData), fetchLayouts, fetchEmailAssets |
| `src/hooks/useEmailLayouts.test.ts` | 4 | is_active filter, loading/error states, reload |
| `src/components/email/__tests__/AssetDropzone.test.tsx` | 7 | 5MB limit, file type validation, thumbnail display, drag-over |
| `src/components/email/__tests__/EmailPreviewPane.test.tsx` | 5 | create-mode placeholder ("Save the template first"), iframe sandbox, debounce |

### API Connectivity

Astríðr API status: REACHABLE. `GET http://localhost:8181/api/email-layouts` returns `401` (auth enforced, not offline). Phase 01 backend is operational.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

All test files are intentional stubs (`.todo()` pattern). They will be expanded in Plans 01-05 as each component is implemented. This is the expected Wave 0 pattern per plan design.

## Threat Flags

None. The new `list_email_assets()` endpoint exposes only public URLs (already publicly accessible via Supabase Storage), asset names, sizes, and creation timestamps. No service key or internal paths are returned to the client. T-02-00a disposition: mitigated.

## Self-Check: PASSED

- [x] `astridr/api/template_routes.py` modified with list endpoint
- [x] `src/lib/emailTemplateUtils.test.ts` created
- [x] `src/lib/astridrApi.test.ts` created
- [x] `src/hooks/useEmailLayouts.test.ts` created
- [x] `src/components/email/__tests__/AssetDropzone.test.tsx` created
- [x] `src/components/email/__tests__/EmailPreviewPane.test.tsx` created
- [x] astridr-repo commit fa67882 verified
- [x] codepulse commit 67f7d76 verified
- [x] 29 todo tests run with 0 failures
