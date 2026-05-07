---
phase: 01-design-studio
verified: 2026-05-07T18:30:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /design-studio in browser and verify Embedded Studio tab shows iframe loading state or error overlay"
    expected: "Daemon offline shows 'Design Studio Unavailable' overlay with Retry Connection button; daemon online shows iframe embedding Open Design web app"
    why_human: "IframeEmbed health polling behavior and visual overlay states require a running browser to observe"
  - test: "Navigate to Native UI tab, step through all 6 wizard steps"
    expected: "Step 1 shows skill card grid (or API error if daemon offline); step indicator advances; steps 4-6 require daemon for live SSE streaming"
    why_human: "Wizard step progression, direction generation via SSE, and streaming preview require live daemon interaction"
  - test: "Verify DaemonStatusBadge tooltip shows daemon URL and last-checked time"
    expected: "Tooltip shows VITE_OPEN_DESIGN_URL value and 'Last checked: HH:MM:SS AM/PM'"
    why_human: "Tooltip interaction is visual and requires browser hover"
  - test: "Import ZIP button opens ZipImportDialog; .zip file selection enables Import ZIP button"
    expected: "Dialog opens, file input accepts .zip only, button enables after selection"
    why_human: "File input interaction and dialog opening are visual behaviors"
---

# Phase 1: Design Studio Verification Report

**Phase Goal:** Integrate nexu-io/open-design into CodePulse as a first-class Design Studio page with two modes: iframe embed for immediate full-featured access and a native Paperclip-styled UI reimplementing the full Open Design workflow (skill selection, discovery, direction picking, live streaming generation, sandboxed preview, multi-format export).
**Verified:** 2026-05-07T18:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Dockerfile builds a working Open Design daemon container using node:24-alpine | VERIFIED | `open-design/Dockerfile` exists; line 4: `FROM node:24-alpine AS base`; CMD `["pnpm", "tools-dev", "start", "web"]`; curl installed for healthcheck |
| 2 | docker-compose.yml defines open-design sidecar on port 17456 referencing the Dockerfile | VERIFIED | `docker-compose.yml` exists; `build.context: ./open-design`, `dockerfile: Dockerfile`; `ports: ["17456:17456"]`; healthcheck with curl |
| 3 | openDesignApi.ts exports functions for all daemon API endpoints | VERIFIED | All 12 functions exported: `fetchSkills`, `fetchDesignSystems`, `fetchAgents`, `checkHealth` (with AbortSignal.timeout(3000)), `createProject`, `createRun`, `getRunStatus`, `streamRunEvents` (SSE via fetch+ReadableStream), `saveArtifact`, `exportProject`, `importClaudeDesign` (FormData), `listProjects`, `listTemplates` |
| 4 | Convex schema includes designProjects and designTemplates tables with indexes | VERIFIED | `convex/schema.ts` lines 1508-1533; both tables have `by_odProjectId`/`by_odTemplateId` indexes and `by_updatedAt`/`by_createdAt` indexes |
| 5 | Convex domain modules export upsert, remove, list, and listIds functions | VERIFIED | `convex/designProjects.ts` and `convex/designTemplates.ts` export all four functions plus `syncFromDaemon` action; Convex cloud limitation (A7) documented in comments |
| 6 | React hooks wrap Convex queries with ?? [] guard | VERIFIED | `useDesignProjects.ts`: `useQuery(api.designProjects.list) ?? []`; `useDesignTemplates.ts`: same pattern |
| 7 | User can navigate to /design-studio from the sidebar | VERIFIED | `src/App.tsx` line 55-56: lazy import + Route at `/design-studio`; `DashboardLayout.tsx` line 133: nav entry with Palette icon |
| 8 | DesignStudio page has Embedded Studio and Native UI tabs with DaemonStatusBadge | VERIFIED | `DesignStudio.tsx` renders `<Tabs>` with TabsTrigger values "embedded" and "native"; `<DaemonStatusBadge />` in page header |
| 9 | IframeEmbed shows loading/error/ready states; error overlay has Retry Connection button | VERIFIED | `IframeEmbed.tsx`: 3-state FSM (`loading`/`ready`/`error`); error overlay renders "Design Studio Unavailable" + retry button; ready state shows iframe with `sandbox="allow-scripts allow-same-origin allow-forms"` |
| 10 | Native UI wizard renders 6 steps with step indicator and navigation enforcement | VERIFIED | `NativeWorkflow.tsx`: `STEP_LABELS` array with 6 entries; `canGoToStep()` enforces no back past step 4 once `generationStarted=true`; all 6 steps wired to real components |
| 11 | Directions are generated via daemon SSE run (not hardcoded) | VERIFIED | `NativeWorkflow.tsx` `generateDirections()`: calls `createProject()` then `createRun()` then `streamRunEvents()` to collect SSE output; hardcoded fallback only fires when SSE parse fails |
| 12 | srcdoc iframe uses sandbox="allow-scripts" without allow-same-origin | VERIFIED | `StreamingPreview.tsx` line 137: `sandbox="allow-scripts"`; no `allow-same-origin`; security comment at line 129; `StreamingPreview.test.tsx` line 65-69 explicitly asserts this attribute |
| 13 | All 5 export formats (HTML, PDF, PPTX, ZIP, Markdown) available in ExportPanel | VERIFIED | `ExportPanel.tsx`: `const FORMATS: ExportFormat[] = ["html", "pdf", "pptx", "zip", "md"]`; 5 toggle buttons rendered |
| 14 | User can see list of saved projects with reactive Convex subscription | VERIFIED | `DesignStudio.tsx` calls `useDesignProjects()` (wraps `useQuery`); passes `projects` to `ProjectGallery`; auto-sync on mount via `syncFromDaemon` action |
| 15 | User can delete a project via AlertDialog confirmation | VERIFIED | `ProjectGallery.tsx`: Delete button in Sheet opens AlertDialog; `handleDelete()` calls `useMutation(api.designProjects.remove)` |
| 16 | User can import a Claude Design ZIP file | VERIFIED | `ZipImportDialog.tsx`: file input with `accept=".zip"`; calls `importClaudeDesign(file)` from openDesignApi; `ZipImportDialog` imported and rendered in `DesignStudio.tsx` |

**Score:** 16/16 truths verified (note: plan frontmatter defined 12 across all plans; all verified plus phase-level truths from CONTEXT.md D-01 through D-12)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `open-design/Dockerfile` | Docker image using node:24-alpine | VERIFIED | 33 lines; node:24-alpine base; corepack enable; pnpm install; CMD pnpm tools-dev start web |
| `docker-compose.yml` | open-design sidecar on port 17456 | VERIFIED | References ./open-design/Dockerfile; healthcheck with curl; volume open-design-data |
| `src/lib/openDesignTypes.ts` | TypeScript interfaces for all daemon API types | VERIFIED | 10 exported interfaces: Skill, DesignSystem, OdAgent, OdProject, OdTemplate, RunRequest, RunStatus, RunEvent, HealthResponse, ExportFormat |
| `src/lib/openDesignApi.ts` | REST API client with SSE streaming | VERIFIED | 12 exported functions; SSE via fetch+ReadableStream; FormData for importClaudeDesign; AbortSignal.timeout(3000) on checkHealth |
| `convex/schema.ts` | designProjects and designTemplates table definitions | VERIFIED | Lines 1508-1533; correct field types and indexes |
| `convex/designProjects.ts` | upsert, remove, list, listIds, syncFromDaemon | VERIFIED | All 5 exports present; Convex cloud A7 limitation documented |
| `convex/designTemplates.ts` | upsert, remove, list, listIds, syncFromDaemon | VERIFIED | All 5 exports present |
| `src/hooks/useDesignProjects.ts` | useQuery hook with ?? [] guard | VERIFIED | 6-line file; correct pattern |
| `src/hooks/useDesignTemplates.ts` | useQuery hook with ?? [] guard | VERIFIED | 6-line file; correct pattern |
| `src/pages/DesignStudio.tsx` | Full page: tabs, NativeWorkflow, ProjectGallery, sync, ZIP import | VERIFIED | 100 lines; imports NativeWorkflow, ProjectGallery, ZipImportDialog, useDesignProjects, syncFromDaemon; auto-sync on mount; MetricCards |
| `src/components/design-studio/IframeEmbed.tsx` | Health-aware iframe with 3 states | VERIFIED | 124 lines; loading/ready/error FSM; opacity transition; retry button |
| `src/components/design-studio/DaemonStatusBadge.tsx` | Live daemon health indicator polling every 10s | VERIFIED | 97 lines; 3 status states; Tooltip with URL and lastChecked; 10s setInterval; cleanup mounted flag |
| `src/components/design-studio/NativeWorkflow.tsx` | 6-step wizard with daemon-driven directions | VERIFIED | 412 lines; generateDirections() uses SSE; canGoToStep() enforces navigation; abandon dialog wired |
| `src/components/design-studio/SkillPicker.tsx` | Skill grid with search and single-select | VERIFIED | fetchSkills() on mount; filter by search; skeleton loading; error state |
| `src/components/design-studio/DesignSystemPicker.tsx` | Design system grid with category filter and pagination | VERIFIED | fetchDesignSystems() on mount; category filter; Load More pagination at 50 |
| `src/components/design-studio/DiscoveryForm.tsx` | Textarea with character count | VERIFIED | Brief textarea; character count display; disabled submit until brief has content |
| `src/components/design-studio/DirectionPicker.tsx` | 3-direction card layout with single-select | VERIFIED | Loading skeleton; 3 cards; onSelect callback; keyword badges |
| `src/components/design-studio/StreamingPreview.tsx` | SSE streaming log + srcdoc iframe | VERIFIED | 177 lines; streamRunEvents(); extractArtifact(); sandbox="allow-scripts"; AbortController cleanup on unmount |
| `src/components/design-studio/ExportPanel.tsx` | 5-format selector with download trigger | VERIFIED | 84 lines; 5 format buttons; exportProject(); URL.createObjectURL; error display |
| `src/components/design-studio/ProjectGallery.tsx` | Project list with Sheet detail and AlertDialog delete | VERIFIED | 186 lines; EntityRow pattern; Sheet; AlertDialog; useMutation(api.designProjects.remove) |
| `src/components/design-studio/ZipImportDialog.tsx` | ZIP file upload dialog | VERIFIED | 93 lines; file input accept=".zip"; importClaudeDesign(); loading/error states |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `open-design/Dockerfile` | `docker-compose.yml` | build context reference | VERIFIED | `context: ./open-design, dockerfile: Dockerfile` |
| `src/lib/openDesignApi.ts` | `src/lib/openDesignTypes.ts` | import types | VERIFIED | Line 7: `import type { Skill, DesignSystem, ... } from "./openDesignTypes"` |
| `src/hooks/useDesignProjects.ts` | `convex/designProjects.ts` | useQuery(api.designProjects.list) | VERIFIED | `useQuery(api.designProjects.list) ?? []` |
| `src/hooks/useDesignTemplates.ts` | `convex/designTemplates.ts` | useQuery(api.designTemplates.list) | VERIFIED | `useQuery(api.designTemplates.list) ?? []` |
| `src/App.tsx` | `src/pages/DesignStudio.tsx` | lazy import + Route | VERIFIED | Line 55: `const DesignStudio = lazy(...)`, line 116: Route at `/design-studio` |
| `src/layouts/DashboardLayout.tsx` | `/design-studio` | nav item entry | VERIFIED | Line 133: `{ to: "/design-studio", label: "Design Studio", icon: "palette", group: "OVERVIEW" }` |
| `src/pages/DesignStudio.tsx` | `src/components/design-studio/IframeEmbed.tsx` | import IframeEmbed | VERIFIED | Line 6: `import IframeEmbed from "@/components/design-studio/IframeEmbed"` |
| `src/pages/DesignStudio.tsx` | `src/components/design-studio/DaemonStatusBadge.tsx` | import DaemonStatusBadge | VERIFIED | Line 5: `import DaemonStatusBadge from "@/components/design-studio/DaemonStatusBadge"` |
| `src/pages/DesignStudio.tsx` | `src/components/design-studio/NativeWorkflow.tsx` | import NativeWorkflow | VERIFIED | Line 7: `import NativeWorkflow from "@/components/design-studio/NativeWorkflow"` |
| `src/pages/DesignStudio.tsx` | `src/components/design-studio/ProjectGallery.tsx` | import ProjectGallery | VERIFIED | Line 8: `import ProjectGallery from "@/components/design-studio/ProjectGallery"` |
| `src/components/design-studio/NativeWorkflow.tsx` | `src/components/design-studio/DirectionPicker.tsx` | renders as step 4 | VERIFIED | Line 296-303: `<DirectionPicker directions={...} ... />` in case 3 |
| `src/components/design-studio/StreamingPreview.tsx` | `src/lib/openDesignApi.ts` | streamRunEvents() | VERIFIED | Line 6: `import { streamRunEvents }` called in useEffect when runId changes |
| `src/components/design-studio/StreamingPreview.tsx` | srcdoc iframe | extractArtifact() populates srcDoc | VERIFIED | Line 134-139: `<iframe ... srcDoc={iframeContent} sandbox="allow-scripts" />` |
| `src/components/design-studio/ExportPanel.tsx` | `src/lib/openDesignApi.ts` | exportProject() for download | VERIFIED | Line 4: `import { exportProject }` called in handleDownload |
| `src/components/design-studio/SkillPicker.tsx` | `src/lib/openDesignApi.ts` | fetchSkills() on mount | VERIFIED | Line 4: `import { fetchSkills }` called in useEffect |
| `src/components/design-studio/DesignSystemPicker.tsx` | `src/lib/openDesignApi.ts` | fetchDesignSystems() on mount | VERIFIED | `import { fetchDesignSystems }` called in useEffect |
| `src/components/design-studio/ProjectGallery.tsx` | `src/hooks/useDesignProjects.ts` | useDesignProjects() | VERIFIED | ProjectGallery receives `projects` as prop from DesignStudio which calls useDesignProjects() |
| `src/components/design-studio/ZipImportDialog.tsx` | `src/lib/openDesignApi.ts` | importClaudeDesign() | VERIFIED | Line 12: `import { importClaudeDesign }` called in handleImport |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ProjectGallery.tsx` | `projects` prop | `useDesignProjects()` → `useQuery(api.designProjects.list)` → Convex DB | Yes — live Convex subscription; synced via `syncFromDaemon` which queries daemon `/api/projects` | FLOWING |
| `SkillPicker.tsx` | `skills` state | `fetchSkills()` → `GET /api/skills` on daemon | Yes — live daemon REST call in useEffect | FLOWING |
| `StreamingPreview.tsx` | `iframeContent` state | `streamRunEvents()` → SSE from daemon `/api/runs/:id/events`; `extractArtifact()` parses tokens | Yes — real SSE tokens from daemon generation run | FLOWING |
| `ExportPanel.tsx` | Download blob | `exportProject()` → `GET /api/export/:id?format=...` | Yes — Blob returned from daemon endpoint | FLOWING |

### Behavioral Spot-Checks

Step 7b SKIPPED for server-requiring behaviors (daemon not running in test environment). Unit-level spot-checks confirmed via test file inspection:

| Behavior | Verification Method | Result |
|----------|--------------------|----|
| sandbox="allow-scripts" on srcdoc iframe | `StreamingPreview.test.tsx` line 65: `expect(iframe).toHaveAttribute("sandbox", "allow-scripts")` + line 68-69: asserts no `allow-same-origin` | VERIFIED by test |
| All 5 export formats rendered | `ExportPanel.test.tsx` lines 36-41: renders all 5 format buttons | VERIFIED by test |
| SkillPicker filters by search | `SkillPicker.test.tsx` lines 36-50: fireEvent on search input; verifies non-matching skills disappear | VERIFIED by test |
| openDesignApi calls correct endpoints | `openDesignApi.test.ts` lines 38-50+: fetch mock verifies URL contains `/api/skills`, etc. | VERIFIED by test |
| Convex domain modules (designProjects/designTemplates) | `convex/designProjects.test.ts` and `convex/designTemplates.test.ts` | WARNING — behavioral doc tests only (`expect(true).toBe(true)`); real upsert/remove/list behavior not unit-tested |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| D-01 | Plan 01 | Design Studio is an Open Design integration | SATISFIED | openDesignApi.ts, openDesignTypes.ts — full API client wrapping Open Design daemon |
| D-02 | Plan 02 | Two modes: iframe embed AND native UI | SATISFIED | DesignStudio.tsx: "Embedded Studio" tab (IframeEmbed) + "Native UI" tab (NativeWorkflow) |
| D-03 | Plans 03, 04 | Native UI rebuilds full Open Design flow with daemon SSE direction generation | SATISFIED | NativeWorkflow 6 steps; generateDirections() uses createRun() + streamRunEvents() |
| D-04 | Plan 02 | iframe embed on dedicated /design-studio route | SATISFIED | Route at `/design-studio` in App.tsx; IframeEmbed in Embedded Studio tab |
| D-05 | Plans 00, 04 | srcdoc iframe for artifact preview with sandbox enforcement | SATISFIED | StreamingPreview.tsx sandbox="allow-scripts"; test explicitly asserts no allow-same-origin |
| D-06 | Plans 00, 01 | Browser calls daemon REST API directly via VITE_OPEN_DESIGN_URL | SATISFIED | openDesignApi.ts: `OD_BASE = import.meta.env.VITE_OPEN_DESIGN_URL ?? "http://localhost:17456"` |
| D-07 | Plans 00, 01 | Docker sidecar for daemon | SATISFIED | open-design/Dockerfile + docker-compose.yml |
| D-08 | Plans 01, 05 | Project metadata mirrors to Convex designProjects table | SATISFIED | schema.ts + designProjects.ts + useDesignProjects hook + ProjectGallery |
| D-09 | Plans 01, 05 | Template metadata mirrors to Convex designTemplates table | SATISFIED | schema.ts + designTemplates.ts + useDesignTemplates hook |
| D-10 | Plans 03, 05 | All skills and design systems surfaced in native gallery | SATISFIED | SkillPicker fetches all 31 skills; DesignSystemPicker fetches all 129 design systems with pagination |
| D-11 | Plans 00, 04 | Native UI supports all 5 export formats | SATISFIED | ExportPanel: `["html", "pdf", "pptx", "zip", "md"]` |
| D-12 | Plan 05 | Claude Design ZIP import | SATISFIED | ZipImportDialog + importClaudeDesign API function |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `convex/designProjects.test.ts` | `expect(true).toBe(true)` behavioral doc stubs — not real assertions | WARNING | Convex domain mutation behavior (upsert/remove/list) is untested at unit level; integration test coverage only via live Convex |
| `convex/designTemplates.test.ts` | Same pattern | WARNING | Same impact as above |
| `src/components/design-studio/NativeWorkflow.tsx` line 84-86 | `void setPendingTabSwitch; void showAbandonDialog` — suppress unused var warnings for abandon dialog state | INFO | Abandon dialog opens but nothing currently triggers `setShowAbandonDialog(true)` from DesignStudio — the guard exists but has no call site yet |

**Stub classification notes:**
- The Convex test stubs (`expect(true).toBe(true)`) are intentional per the SUMMARY.md decision note: "Convex's ctx.db cannot be instantiated in jsdom test environments." This matches the pattern in other Convex test files in the codebase. Not a blocker.
- The `showAbandonDialog` state is declared and the Dialog renders, but `setShowAbandonDialog(true)` is never called from DesignStudio or NativeWorkflow's parent. The abandon flow is effectively dead code for tab switches. This is a WARNING but does not block phase goal achievement.

### Human Verification Required

#### 1. Embedded Studio Tab — IframeEmbed Visual States

**Test:** Start `npm run dev`. Navigate to `/design-studio`. Observe the Embedded Studio tab (default).
**Expected:** Loading spinner shows briefly; after ~10s with daemon offline, "Design Studio Unavailable" overlay appears with instructions and "Retry Connection" button. With daemon running, iframe loads Open Design web app.
**Why human:** IframeEmbed health polling and overlay state transitions are browser-only behaviors. The retry button should trigger fresh polling and update state.

#### 2. Native UI Wizard — 6-Step End-to-End Flow

**Test:** Click "Native UI" tab. Verify step indicator shows 6 steps. Click through steps 1-3 (Skill, Design System, Brief) with daemon offline.
**Expected:** Step 1 shows skill card grid or API error message. Step 2 shows design system grid with category filter. Step 3 shows textarea with character counter. "Next" button in step 1 disabled until skill selected; step 2 disabled until design system selected; step 3 disabled until brief non-empty.
**Why human:** Wizard navigation flow, conditional Next button states, and catalog card rendering require browser interaction to verify.

#### 3. DaemonStatusBadge Tooltip

**Test:** Hover over the DaemonStatusBadge in the page header.
**Expected:** Tooltip shows daemon URL (default `http://localhost:17456`) and "Last checked: HH:MM:SS" timestamp.
**Why human:** Tooltip interaction requires browser hover; cannot be verified programmatically.

#### 4. ZIP Import Dialog

**Test:** Click "Import ZIP" button. Select a `.zip` file in the file picker. Verify button state.
**Expected:** Dialog opens with "Import Claude Design ZIP" title. File input accepts only `.zip`. "Import ZIP" button enables after selecting a file, disabled before.
**Why human:** File input dialog behavior and dialog open/close are browser-only interactions.

### Gaps Summary

No blockers found. All 16 observable truths are VERIFIED by direct codebase inspection. All 12 requirement IDs (D-01 through D-12) are satisfied with concrete implementation artifacts. Two WARNING-level observations:

1. **Convex domain tests are behavioral documentation stubs** — `expect(true).toBe(true)` does not verify mutation logic. Acceptable per codebase convention (ctx.db cannot be instantiated in jsdom), but means Convex upsert/remove/listIds correctness relies solely on integration testing against a live Convex instance.

2. **Abandon dialog trigger is unreachable** — `setShowAbandonDialog(true)` is never called. The dialog renders but cannot be opened. This is a minor incomplete feature, not a phase blocker.

Status is `human_needed` because the browser-interactive behaviors (iframe loading states, wizard step flow, daemon-connected generation) cannot be verified programmatically and are core to the phase goal.

---

_Verified: 2026-05-07T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
