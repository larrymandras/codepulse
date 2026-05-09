---
phase: 02-email-template-manager-crud-ui-for-email-layouts-content-tem
fixed_at: 2026-05-09T22:00:22Z
review_path: .planning/phases/02-email-template-manager-crud-ui-for-email-layouts-content-tem/02-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-09T22:00:22Z
**Source review:** .planning/phases/02-email-template-manager-crud-ui-for-email-layouts-content-tem/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (3 Critical + 6 Warning; Info findings excluded by fix_scope)
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: Logo URL never shown in LayoutSheet edit mode

**Files modified:** `src/components/email/LayoutSheet.tsx`
**Commit:** d5d51b3
**Applied fix:** Replaced `currentUrl={undefined}` on the logo `AssetDropzone` with a derived public URL computed from `form.logo_storage_path` — same starts-with-http guard + env-var interpolation pattern used in `AgentDefaultSheet`. The logo is now shown in the dropzone when editing an existing layout.

---

### CR-02: `validateAgent` sends response without `res.ok` check

**Files modified:** `src/lib/astridrApi.ts`
**Commit:** 260844d
**Applied fix:** Replaced the raw `fetch` + `res.json()` call with `apiRequest<...>()`, which checks `res.ok` and throws `AstridrApiError` on failure. A 401, 422, or 500 now throws rather than silently returning an error body as a valid `{ valid, errors }` payload.

---

### CR-03: `AssetDropzone.validateAndUpload` stale closure in error path and onDrop

**Files modified:** `src/components/email/AssetDropzone.tsx`
**Commit:** e5e9eea
**Applied fix:** In the upload error catch block, replaced `setState(previewUrl ? "uploaded" : "idle")` with a functional updater `setState((prev) => prev === "uploading" ? (previewUrl ? "uploaded" : "idle") : prev)` to avoid stomping state from a concurrent operation. In `onDrop`, added an early return guard `if (state === "uploading") return` and removed `previewUrl` from the dependency array (replaced with `state`).

---

### WR-01: `TemplateSheet` — `handleSave` onClick without void

**Files modified:** `src/components/email/TemplateSheet.tsx`
**Commit:** fdb77eb
**Applied fix:** Changed `onClick={handleSave}` to `onClick={() => void handleSave()}` on the Save Template button, consistent with LayoutSheet pattern.

---

### WR-02: `TemplateSheet` — `handleDelete` onClick without void

**Files modified:** `src/components/email/TemplateSheet.tsx`
**Commit:** fdb77eb
**Applied fix:** Changed `onClick={handleDelete}` to `onClick={() => void handleDelete()}` on the AlertDialogAction, consistent with LayoutSheet pattern.

---

### WR-03: `useEmailLayouts` and `useEmailTemplates` — `!== false` admits undefined

**Files modified:** `src/hooks/useEmailLayouts.ts`, `src/hooks/useEmailTemplates.ts`
**Commit:** 59ebe0d
**Applied fix:** Changed both client-side `is_active` filters from `!== false` to `=== true` so that records with undefined or missing `is_active` are excluded rather than leaked through as active.

---

### WR-04: `LayoutSheet.handleSave` — uses edited slug as update identifier

**Files modified:** `src/components/email/LayoutSheet.tsx`
**Commit:** d5d51b3
**Applied fix:** Changed `updateLayout(form.slug, body)` to `updateLayout(layoutSlug, body)` so the original slug prop is used as the URL path identifier. The new slug value is still sent in the request body. Also added an `else if (layoutSlug)` guard to avoid calling update when layoutSlug is null.

---

### WR-05: `fetchEmailAssets` — folder parameter not URL-encoded

**Files modified:** `src/lib/astridrApi.ts`
**Commit:** 260844d
**Applied fix:** Replaced manual string concatenation `?folder=${folder}` with `?folder=${encodeURIComponent(folder)}` to match the encoding pattern used elsewhere in the module and guard against future constraint widening.

---

### WR-06: `LayoutSheet` — `console.error` left in save and delete handlers

**Files modified:** `src/components/email/LayoutSheet.tsx`
**Commit:** d5d51b3
**Applied fix:** Removed both `console.error(...)` calls from `handleSave` and `handleDelete` catch blocks. Errors are already surfaced to the user via `setSaveError` / `toast.error` — no raw error detail is logged to the console in production.

---

_Fixed: 2026-05-09T22:00:22Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
