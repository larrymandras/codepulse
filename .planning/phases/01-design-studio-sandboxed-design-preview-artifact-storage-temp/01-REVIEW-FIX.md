---
phase: 01-design-studio-sandboxed-design-preview-artifact-storage-temp
fixed_at: 2026-05-07T00:00:00Z
review_path: .planning/phases/01-design-studio-sandboxed-design-preview-artifact-storage-temp/01-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 11
skipped: 2
status: partial
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-05-07
**Source review:** `.planning/phases/01-design-studio-sandboxed-design-preview-artifact-storage-temp/01-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (5 Critical + 8 Warning)
- Fixed: 11
- Skipped: 2 (CR-01, WR-05 — architecture mismatch; see below)

---

## Fixed Issues

### CR-02: Prompt Injection — User Brief Interpolated Directly Into Agent Prompt

**Files modified:** `src/components/design-studio/NativeWorkflow.tsx`
**Commit:** `248ccf5` (combined with WR-08)
**Applied fix:** Added `MAX_BRIEF_LENGTH = 2000` cap applied via `.slice()` at all three prompt sites (`generateDirections`, `handleRegenerate`, `handleNext` step 3→4). Wrapped the brief in `--- BEGIN USER BRIEF / END USER BRIEF ---` delimiters in the direction-generation prompt so the model treats it as user content only.

---

### CR-03: AbortController Leak — Direction-Generation SSE Stream Never Aborted

**Files modified:** `src/components/design-studio/NativeWorkflow.tsx`
**Commit:** `90441aa`
**Applied fix:** Added `directionStreamCleanupRef` (a `useRef`) to store the cleanup function returned by `streamRunEvents`. A `useEffect` with an empty deps array calls the ref's cleanup on component unmount. The ref is also updated at the start of each `generateDirections` call to abort any in-flight stream before starting a new one.

---

### CR-04: TOCTOU Race in Sync — Projects Can Be Incorrectly Deleted

**Files modified:** `convex/designProjects.ts`, `convex/designTemplates.ts`
**Commit:** `1aa516c` (combined with WR-03)
**Applied fix:** Both `syncFromDaemon` actions now record `actionStartedAt = Date.now()` before fetching `existingIds`. Before removing a record not present in the daemon response, they query `getSyncedAt` for that record. If `syncedAt` is within 60 seconds of `actionStartedAt`, the removal is skipped — protecting records just created browser-side that the daemon snapshot hasn't returned yet. Added `getSyncedAt` query to both modules.

---

### CR-05: Primary Iframe Embeds Daemon with `allow-same-origin`

**Files modified:** `src/components/design-studio/IframeEmbed.tsx`
**Commit:** `ed4ce53`
**Applied fix:** Changed `sandbox="allow-scripts allow-same-origin allow-forms"` to `sandbox="allow-scripts allow-forms allow-popups"`. Removes the risk of a proxied daemon page accessing CodePulse's DOM, localStorage, or Convex auth tokens.

---

### WR-01: `useEffect` Missing Dependency — `onGenerationComplete` Not in Deps Array

**Files modified:** `src/components/design-studio/StreamingPreview.tsx`
**Commit:** `9ea92bf`
**Applied fix:** Added `onGenerationCompleteRef` via `useRef(onGenerationComplete)` with a bare `useEffect` to keep it current on every render. The `onDone` callback inside `streamRunEvents` now calls `onGenerationCompleteRef.current()` instead of the stale closure capture.

---

### WR-02: `generateDirections` Error Path Does Not Navigate Back

**Files modified:** `src/components/design-studio/NativeWorkflow.tsx`
**Commit:** `eaa3e30`
**Applied fix:** Added `setCurrentStep(2)` to the `onError` callback inside `generateDirections` so a daemon SSE error returns the user to the brief step rather than leaving the DirectionPicker in a permanent loading state.

---

### WR-03: `listIds` Uses `collect()` — No Pagination Cap

**Files modified:** `convex/designProjects.ts`, `convex/designTemplates.ts`
**Commit:** `1aa516c` (combined with CR-04)
**Applied fix:** Changed both `listIds` queries from `.collect()` to `.take(500)` to cap document reads and avoid hitting Convex's document read limits at scale.

---

### WR-04: `statusBadgeClass` Checks Wrong Status Values

**Files modified:** `src/components/design-studio/ProjectGallery.tsx`
**Commit:** `e18f759`
**Applied fix:** Replaced title-case switch cases (`"Complete"`, `"In Progress"`, `"Failed"`) with the actual schema values (`"completed"`, `"active"`, `"failed"`). Every project was falling through to the default (no color) before this fix.

---

### WR-06: `ZipImportDialog` Does Not Validate File Type

**Files modified:** `src/components/design-studio/ZipImportDialog.tsx`
**Commit:** `71f02a3`
**Applied fix:** Added a guard at the top of `handleImport` that checks `file.name.endsWith(".zip") || file.type === "application/zip"` and sets an error message if neither matches, preventing non-ZIP files from being sent to the daemon.

---

### WR-07: `IframeEmbed` `startPolling` Called Without `daemonUrl` in Deps

**Files modified:** `src/components/design-studio/IframeEmbed.tsx`
**Commit:** `58cc055`
**Applied fix:** Changed `useEffect(() => { ... }, [])` to `useEffect(() => { ... }, [daemonUrl])` so polling restarts if the daemon URL changes. Retained the `eslint-disable-line` comment for `startPolling`/`stopPolling` (which only close over stable refs) with a clear justification.

---

### WR-08: `handleNext` Step 3→4 Advances Before `createRun` Completes

**Files modified:** `src/components/design-studio/NativeWorkflow.tsx`
**Commit:** `248ccf5` (combined with CR-02)
**Applied fix:** Moved `setCurrentStep(4)` and `setGenerationStarted(true)` to after `createRun` resolves successfully. The catch block now calls `toast.error("Failed to start generation")` and does NOT set `generationStarted`, keeping the Back button enabled so the user can retry.

---

## Skipped Issues

### CR-01: Missing Authorization Header — Daemon API Calls Are Unauthenticated

**File:** `src/lib/openDesignApi.ts:31-44`
**Reason:** Architecture mismatch — reviewer misread CLAUDE.md scope. CLAUDE.md states auth is required for calls to the **Ástríðr backend** (`ASTRIDR_API_BASE`). The Open Design daemon is an independent local sidecar at `localhost:17456`, not proxied through Ástríðr and not part of the Ástríðr auth domain. The daemon has no auth by design. Prompt context explicitly states "The daemon is NOT proxied through Ástríðr." Applying this fix would add spurious headers to an unauthenticated local service and create a dependency on a nonexistent `VITE_OPEN_DESIGN_API_KEY`.
**Original issue:** Missing `Authorization: Bearer` header on `odRequest` helper.

---

### WR-05: `exportProject` Does Not Set Authorization Header

**File:** `src/lib/openDesignApi.ts:207-209`
**Reason:** Same architecture mismatch as CR-01. `exportProject` calls the Open Design daemon, not the Ástríðr backend. No auth header is appropriate here.
**Original issue:** `exportProject` uses direct `fetch()` without auth headers.

---

_Fixed: 2026-05-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
