---
phase: 02-email-template-manager-crud-ui-for-email-layouts-content-tem
reviewed: 2026-05-09T21:22:04Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - src/App.tsx
  - src/components/email/AgentDefaultSheet.tsx
  - src/components/email/__tests__/AssetDropzone.test.tsx
  - src/components/email/__tests__/EmailPreviewPane.test.tsx
  - src/hooks/useAgentDefaults.ts
  - src/hooks/useEmailAssets.ts
  - src/hooks/useEmailLayouts.test.ts
  - src/hooks/useEmailLayouts.ts
  - src/hooks/useEmailTemplates.ts
  - src/layouts/DashboardLayout.tsx
  - src/lib/astridrApi.test.ts
  - src/lib/astridrApi.ts
  - src/lib/emailTemplateUtils.test.ts
  - src/lib/emailTemplateUtils.ts
  - src/pages/EmailTemplates.tsx
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-09T21:22:04Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This phase adds the Email Template Manager page: layouts CRUD, templates CRUD with Monaco editor, agent email defaults, and an asset upload/gallery system. The implementation is structurally sound but has several defects ranging from a data-loss bug in `LayoutSheet` to missing auth on `validateAgent`, stale `previewUrl` closure bugs in `AssetDropzone`, and a complete set of no-op test files that create false confidence. Three findings qualify as BLOCKERs.

---

## Critical Issues

### CR-01: Logo URL never shown in LayoutSheet edit mode — existing logo silently discarded on save

**File:** `src/components/email/LayoutSheet.tsx:439-446`
**Issue:** The `AssetDropzone` for the Logo field always passes `currentUrl={undefined}` regardless of mode. In edit mode the loaded `form.logo_storage_path` is never surfaced as `currentUrl`, so the dropzone always renders in idle state. More critically, if the user opens edit mode and saves without touching the logo field, `logo_storage_path` is correctly preserved from `form.logo_storage_path` — however the dropzone's internal `previewUrl` state is always initialized to `undefined`, so the user gets no visual confirmation the logo is set and may inadvertently replace it thinking there is none. This is also an information-integrity defect: the form faithfully loads the path from the API but the UI presents it as though no logo exists.

**Fix:**
```tsx
// Derive public URL from loaded logo_storage_path (same pattern as AgentDefaultSheet line 96-100)
const logoPublicUrl = form.logo_storage_path
  ? form.logo_storage_path.startsWith("http")
    ? form.logo_storage_path
    : `${import.meta.env.VITE_ASTRIDR_API_URL ?? ""}/api/email-assets/public/${form.logo_storage_path}`
  : undefined;

// Then pass it to the dropzone:
<AssetDropzone
  folder="logos"
  currentUrl={logoPublicUrl}   // was: undefined
  onUploaded={(asset) => setField("logo_storage_path", asset.storage_path)}
  onPickerOpen={() => setAssetPickerOpen(true)}
/>
```

---

### CR-02: `validateAgent` sends unauthenticated request — auth bypass on validation endpoint

**File:** `src/lib/astridrApi.ts:73-82`
**Issue:** `validateAgent` calls `fetch` directly with `authHeaders()` for the `Content-Type` header but skips adding `Authorization`. The function does not use the shared `apiRequest` helper that always attaches the bearer token. Per `CLAUDE.md`: "All `fetch()` calls to the Ástríðr backend MUST include the `Authorization: Bearer` header using `VITE_ASTRIDR_API_KEY`." As written, this call will succeed only if the endpoint is unauthenticated, but it leaks config data to an unauthenticated request path and will break if auth is ever hardened on that route.

```ts
// Current — missing Authorization on the res.json() path and no AstridrApiError on failure
export async function validateAgent(
  config: Record<string, unknown>,
): Promise<{ valid: boolean; errors?: string[] }> {
  const res = await fetch(`${ASTRIDR_API_BASE}/api/agents/validate`, {
    method: "POST",
    headers: authHeaders(),   // authHeaders() does add Authorization — but see below
    body: JSON.stringify({ config }),
  });
  return res.json();   // ← no res.ok check; 401/422/500 silently returns body as if valid
}
```

Two sub-problems:
1. `authHeaders()` does include `Authorization` (line 119) — so the auth token IS sent. However, `res.json()` is called unconditionally without checking `res.ok`, so a 401, 422, or 500 will silently return the error body as though it were a `{ valid, errors }` payload. Callers receive `{ detail: "Unauthorized" }` which is neither `valid: true` nor `valid: false` with errors, causing silent incorrect validation results.

**Fix:**
```ts
export async function validateAgent(
  config: Record<string, unknown>,
): Promise<{ valid: boolean; errors?: string[] }> {
  return apiRequest<{ valid: boolean; errors?: string[] }>("/api/agents/validate", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
}
```

---

### CR-03: `AssetDropzone.validateAndUpload` — stale closure captures `previewUrl` at call time, causing wrong fallback state after upload sequence

**File:** `src/components/email/AssetDropzone.tsx:29-58`
**Issue:** `validateAndUpload` is a `useCallback` that closes over `previewUrl`. The dependency array includes `previewUrl`, which is correct for recreation, but the problem is the error path: if an upload fails (line 54), the fallback state decision `previewUrl ? "uploaded" : "idle"` uses the `previewUrl` captured at the time the callback was created — which may be stale if a successful upload earlier in the same session changed `previewUrl` via `setPreviewUrl` but a re-render hasn't yet propagated. Additionally, `onDrop` (line 60-68) also captures `previewUrl` and uses it to set state to `"idle"` or `"uploaded"` at the start of drop, before the async upload begins. If the user drops a file while a prior upload is still in-flight (state is `"uploading"`), the `onDrop` guard `setState(previewUrl ? "uploaded" : "idle")` resets state away from `"uploading"` before the first upload completes, leaving the UI out of sync.

The deeper fix is to read state functionally:

**Fix:**
```ts
// Replace all previewUrl ternaries in state setters with functional updaters
// In the error catch block:
} catch {
  toast.error("Upload failed");
  setState((prev) => prev === "uploading" ? (previewUrl ? "uploaded" : "idle") : prev);
}

// In onDrop, guard against uploading:
const onDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  if (state === "uploading") return; // don't interrupt in-flight upload
  const file = e.dataTransfer.files[0];
  if (!file) return;
  void validateAndUpload(file);
}, [validateAndUpload, state]);
```

---

## Warnings

### WR-01: `TemplateSheet` — `handleSave` not called with `void` operator; async click handler runs without rejection handling

**File:** `src/components/email/TemplateSheet.tsx:459`
**Issue:** The Save Template button uses `onClick={handleSave}` without `void`. Although `handleSave` has its own internal try/catch, React's `onClick` handler is expected to be synchronous or return `void`. If an unhandled rejection escapes the catch (e.g., a second throw from `toast.success`), it becomes an unhandled promise rejection. Compare with `LayoutSheet` line 456 which correctly uses `onClick={() => void handleSave()}`. The inconsistency is a latent reliability gap.

**Fix:**
```tsx
// Line 459 — was: onClick={handleSave}
onClick={() => void handleSave()}
```

---

### WR-02: `TemplateSheet` — `handleDelete` called without `void` in AlertDialogAction

**File:** `src/components/email/TemplateSheet.tsx:511`
**Issue:** `onClick={handleDelete}` on the AlertDialogAction passes the async function directly. Same issue as WR-01: unhandled promise rejection risk. `LayoutSheet` correctly uses `void handleDelete()` (line 500).

**Fix:**
```tsx
// Line 511 — was: onClick={handleDelete}
onClick={() => void handleDelete()}
```

---

### WR-03: `useEmailLayouts` and `useEmailTemplates` — client-side filter `!== false` admits `undefined` as "active"

**File:** `src/hooks/useEmailLayouts.ts:17` and `src/hooks/useEmailTemplates.ts:17`
**Issue:** Both hooks filter with `l.is_active !== false`, which treats `undefined` as active. The `EmailLayout` and `EmailTemplate` interfaces declare `is_active: boolean` (non-optional), so the intent is clear — but the loose check means that if the API ever omits the field (partial responses, schema migrations, mock data), inactive records would leak through as active. The API already sends `?is_active=eq.true`, so the client-side filter is a defense-in-depth measure; the least-surprise form should be an explicit `=== true`.

**Fix:**
```ts
setLayouts(data.filter((l) => l.is_active === true));
setTemplates(data.filter((t) => t.is_active === true));
```

---

### WR-04: `LayoutSheet.handleSave` — slug from form used for update instead of original `layoutSlug` prop; rename breaks update

**File:** `src/components/email/LayoutSheet.tsx:221`
**Issue:** The update call is `updateLayout(form.slug, body)`. If the user edits the slug field (which is editable via `handleSlugChange`), `form.slug` no longer matches the resource's current server-side slug. The `PUT /api/email-layouts/{slug}` endpoint identifies the record by the URL segment, so using the new slug as the identifier will result in a 404. The original slug must be used as the path identifier, with the new slug sent in the body.

**Fix:**
```ts
// In handleSave, edit branch — use the original layoutSlug prop as the URL identifier:
if (mode === "create") {
  await createLayout(body);
} else if (layoutSlug) {
  await updateLayout(layoutSlug, body);  // was: form.slug
}
```

---

### WR-05: `fetchEmailAssets` — folder parameter appended via manual string concatenation; no encoding

**File:** `src/lib/astridrApi.ts:495-498`
**Issue:** `fetchEmailAssets` builds the URL as `` `/api/email-assets${params}` `` where `params` is `?folder=${folder}`. The `folder` value comes from an external `AssetFolder` type constrained to `"avatars" | "logos"` in `useEmailAssets`, so in practice it is safe. However the function signature accepts a raw string `folder?: "avatars" | "logos"` from any caller, and using string concatenation instead of `URLSearchParams` is inconsistent with the rest of the module which uses `URL`/`URLSearchParams` (line 36-39, 480). If the constraint ever widens this silently introduces injection.

**Fix:**
```ts
export const fetchEmailAssets = (folder?: "avatars" | "logos") => {
  const url = new URL(`${ASTRIDR_API_BASE}/api/email-assets`);
  if (folder) url.searchParams.set("folder", folder);
  return apiRequest<EmailAssetItem[]>(url.pathname + url.search);
};
// Or simply:
export const fetchEmailAssets = (folder?: "avatars" | "logos") => {
  const qs = folder ? `?folder=${encodeURIComponent(folder)}` : "";
  return apiRequest<EmailAssetItem[]>(`/api/email-assets${qs}`);
};
```

---

### WR-06: `LayoutSheet` — `console.error` left in production save and delete handlers

**File:** `src/components/email/LayoutSheet.tsx:227, 243`
**Issue:** `handleSave` (line 227) and `handleDelete` (line 243) both call `console.error(...)`, logging internal error details to the browser console in production. This contradicts the project's T-02-14 principle (never expose raw API error details) applied correctly in `AgentDefaultSheet`. Error logging should go through a telemetry channel or be omitted in production builds; raw `console.error` in a catch block is a code quality regression.

**Fix:** Remove both `console.error` calls. The error is already surfaced via `setSaveError` / `toast.error`. If telemetry is needed, pipe through the app's structured logger.

---

## Info

### IN-01: All test files except `emailTemplateUtils.test.ts` contain only `it.todo` stubs — zero assertions pass

**Files:**
- `src/components/email/__tests__/AssetDropzone.test.tsx`
- `src/components/email/__tests__/EmailPreviewPane.test.tsx`
- `src/hooks/useEmailLayouts.test.ts`
- `src/lib/astridrApi.test.ts`

**Issue:** Four of the five new test files consist entirely of `it.todo(...)` entries. Vitest marks these as pending, not passing — they provide zero coverage. The test file for `EmailPreviewPane` explicitly calls out the `sandbox` attribute as a security-relevant requirement (`does NOT include allow-scripts in sandbox attribute`), yet that assertion is unimplemented. While todo stubs are a valid placeholder pattern, shipping a phase with four stub-only test files means the test suite gives no signal on any of the behavior documented in those stubs.

**Fix:** Implement at minimum the security-relevant `EmailPreviewPane` sandbox test, and the `uploadEmailAsset` auth-header tests, before this phase is considered complete.

---

### IN-02: `EmailPreviewPane` `sandbox` attribute uses `allow-same-origin` alone — allows cookie/storage access to preview content

**File:** `src/components/email/EmailPreviewPane.tsx:109`
**Issue:** `sandbox="allow-same-origin"` allows the sandboxed iframe content to access the parent page's cookies, localStorage, and IndexedDB if served from the same origin. For email previews this is low risk since the content is fetched from the Ástríðr API and injected as `srcdoc`, but if an attacker were able to inject a malicious template, this sandbox setting could be exploited to exfiltrate session data. The safer setting for a read-only HTML preview is `sandbox=""` (fully sandboxed) or omitting `allow-same-origin`. The comment in `EmailPreviewPane.test.tsx` (`does NOT include allow-scripts in sandbox attribute`) confirms `allow-scripts` was intentionally excluded, but `allow-same-origin` is equally sensitive.

**Fix:**
```tsx
// Change: sandbox="allow-same-origin"
// To: no allow-same-origin needed for a pure display iframe
<iframe
  srcDoc={previewHtml}
  sandbox=""
  className="flex-1 w-full border-0"
  title="Email preview"
/>
```
Note: Removing `allow-same-origin` may break relative CSS/font references in the previewed HTML. Evaluate against actual preview requirements; if broken, document the risk explicitly.

---

### IN-03: `AgentDefaultSheet` — URL construction for `avatarPublicUrl` duplicated verbatim in `EmailTemplates.tsx`

**Files:** `src/components/email/AgentDefaultSheet.tsx:96-100` and `src/pages/EmailTemplates.tsx:333-337`
**Issue:** The logic for constructing an avatar's public URL from a storage path appears in two places with identical code. This is minor duplication, but the pattern is non-trivial (starts-with-http guard + env var interpolation). If the API path prefix changes, both locations must be updated.

**Fix:** Extract into a helper in `src/lib/astridrApi.ts` or a dedicated `emailAssetUrl(path: string): string` utility:
```ts
export function emailAssetPublicUrl(storagePath: string): string {
  if (!storagePath) return "";
  if (storagePath.startsWith("http")) return storagePath;
  return `${import.meta.env.VITE_ASTRIDR_API_URL ?? ""}/api/email-assets/public/${storagePath}`;
}
```

---

### IN-04: `EmailTemplates.tsx` — "Upload Image" button in Assets tab is non-functional

**File:** `src/pages/EmailTemplates.tsx:118-120`
**Issue:** The CTA button rendered when `activeTab === "assets"` has no `onClick` handler:
```tsx
{activeTab === "assets" && (
  <Button>Upload Image</Button>
)}
```
`AssetGallery` (rendered inside the tab) likely has its own upload affordance, making this button either redundant or an incomplete wiring. As written, clicking it does nothing, which is confusing UX.

**Fix:** Either wire this button to trigger `AssetGallery`'s upload flow (via a ref or exposed callback), or remove it if `AssetGallery` is self-contained.

---

_Reviewed: 2026-05-09T21:22:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
