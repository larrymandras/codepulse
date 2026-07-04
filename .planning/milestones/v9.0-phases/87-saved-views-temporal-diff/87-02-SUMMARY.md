---
phase: 87-saved-views-temporal-diff
plan: "02"
subsystem: kg-saved-views-ui
tags: [kg, saved-views, popover, shadcn, url-hydration, share-token]
dependency_graph:
  requires: [useSavedViews, api.savedKgViews.list, api.savedKgViews.save, api.savedKgViews.remove]
  provides: [KGViewsPopover, ?view-hydration, KGControls-saved-views-wiring]
  affects: [KnowledgeGraph.tsx, KGControls.tsx]
tech_stack:
  added: []
  patterns: [shadcn-popover, one-shot-url-param-guard, stopPropagation-nested-actions, role-button-div-pattern]
key_files:
  created:
    - src/components/kg/KGViewsPopover.tsx
    - src/components/kg/KGViewsPopover.test.tsx
  modified:
    - src/components/kg/KGControls.tsx
    - src/components/kg/KGControls.test.tsx
    - src/pages/KnowledgeGraph.tsx
decisions:
  - "div[role=button] for view rows instead of <button> — avoids nested button invalid HTML (action icons inside are own <button> elements)"
  - "savedViews.isLoading as the third guard in ?view effect — the hook returns views ?? [] so the raw undefined is not accessible; isLoading is the canonical guard (Pitfall 1)"
  - "appliedFocusRef.current = true set inside the ?view effect — suppresses ?focus guard when both params present (Pitfall 5)"
metrics:
  duration_seconds: 390
  completed_date: "2026-06-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 3
---

# Phase 87 Plan 02: KGViewsPopover + KGControls/KnowledgeGraph Wiring Summary

**One-liner:** shadcn Popover with saved-view list/empty-state/inline-save-expand wired into KGControls, plus one-shot `?view=<shareToken>` URL hydration guard in KnowledgeGraph.tsx with Convex-load third condition.

## What Was Built

### Task 1 — KGViewsPopover component + Wave 0 tests (commit `f39c0f7`)

Created `src/components/kg/KGViewsPopover.tsx`:
- shadcn `Popover`/`PopoverTrigger`/`PopoverContent` from `@/components/ui/popover`
- Views trigger: ghost Button with `Bookmark h-3.5 w-3.5` + "Views" label
- Save view inline expand: `BookmarkPlus` "Save view" button → expands to `Input` (w-48, `placeholder="Name this view…"`) + `Check` confirm. Enter/checkmark confirms; Escape/blur cancels; empty name triggers shake animation (no-op)
- View list: `max-h-[320px] overflow-y-auto custom-scrollbar`. Each row is a `div[role=button]` (not `<button>`) to avoid nested button invalid HTML — the Copy link and Delete icon buttons inside are their own `<button>` elements
- Hover-reveal action group: `opacity-0 group-hover:opacity-100 transition-opacity duration-150` — Copy link (`Link` icon, `aria-label="Copy link for {name}"`) + Delete (`Trash2` icon, `aria-label="Delete view {name}"`)
- Active view accent: `border-l-2 border-primary bg-primary/5` when `activeViewId === view._id`
- Empty state: Bookmark icon + "No saved views yet" heading + body copy per UI-SPEC
- `relativeTime(epochMs)` helper: "just now" / "Xm ago" / "Xh ago" / "Xd ago"

Created `src/components/kg/KGViewsPopover.test.tsx` — 7/7 tests green:
1. Empty state renders "No saved views yet"
2. Empty state renders body copy
3. Clicking a view row calls `onLoadView(view)`
4. Clicking trash calls `onDeleteView(_id)` and NOT `onLoadView` (stopPropagation)
5. Clicking Copy link calls `onCopyLink(shareToken)`
6. Confirming save with non-empty name calls `onSaveView(name)`
7. Confirming save with empty name does NOT call `onSaveView`

**Auto-fix (Rule 1):** Nested `<button>` inside `<button>` is invalid HTML that causes React hydration errors. Fixed by using `div[role=button]` for the outer view row element.

### Task 2 — KGControls + KnowledgeGraph wiring (commit `506fc49`)

**KGControls.tsx:**
- Extended `KGControlsProps` with 6 new saved-views props: `views`, `activeViewId`, `onLoadView`, `onDeleteView`, `onCopyLink`, `onSaveView`
- `ml-auto` wrapper upgraded to `ml-auto flex items-center gap-1.5`
- `<KGViewsPopover>` rendered before the Refresh button (passing all saved-views props)
- `KGControls.test.tsx` updated with defaults for the 6 new props — 12/12 existing tests still pass

**KnowledgeGraph.tsx:**
- `useSavedViews()` called; `views`, `saveView`, `deleteView`, `buildShareUrl`, `isLoading` destructured
- `viewToken = searchParams.get("view")` and `appliedViewRef = useRef(false)` declared
- `activeViewId: string | null` state added (set on load/hydration, cleared on delete)
- `?view` one-shot hydration effect: 4 guards (no token / already applied / !hydrated / isLoading). On match: sets `appliedViewRef.current = true`, `appliedFocusRef.current = true` (Pitfall 5), calls `setLens` + 7x `setFilter`, sets `activeViewId`
- `handleSaveView(name)` → `saveView(name, lens, filters, filters.entityName, filters.hops)`
- `handleLoadView(view)` → applies all filter fields + sets `activeViewId`
- `handleDeleteView(id)` → `deleteView(id)` + clears `activeViewId` if it matched
- `handleCopyLink(shareToken)` → `navigator.clipboard.writeText(buildShareUrl(shareToken))` + `toast.success("View link copied")`
- All callbacks + `views`/`activeViewId` wired through to `<KGControls>`

## Verification Results

- `npx tsc --noEmit` — clean, no errors
- `npx vitest run src/components/kg/KGViewsPopover.test.tsx` — 7/7 passed
- `npx vitest run src/components/kg/KGControls.test.tsx` — 12/12 passed (existing tests unaffected)

## Commits

| Hash | Message |
|------|---------|
| `f39c0f7` | feat(87-02): add KGViewsPopover component + Wave 0 tests |
| `506fc49` | feat(87-02): wire KGViewsPopover into KGControls + add ?view hydration in KnowledgeGraph |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Nested `<button>` inside `<button>` invalid HTML**
- **Found during:** Task 1 (test run revealed React hydration warning + Vitest "multiple elements" ambiguity)
- **Issue:** The view row was initially a `<button>` containing Copy link and Delete `<button>` elements. HTML forbids nested buttons; React logs hydration errors and the DOM behavior is undefined.
- **Fix:** Changed the outer view row to `div[role=button]` with `tabIndex={0}` and a `keyDown` handler (Enter/Space) for accessibility. The inner Copy link and Delete remain proper `<button>` elements.
- **Files modified:** `src/components/kg/KGViewsPopover.tsx`, `src/components/kg/KGViewsPopover.test.tsx`
- **Commits:** `f39c0f7`

**2. [Rule 2 - Missing functionality] views === undefined guard via isLoading**
- **Found during:** Task 2 implementation
- **Issue:** The plan's acceptance criteria says to grep for `views === undefined` inside the view effect. The hook returns `views: views ?? []` so the raw `undefined` is not reachable from outside. The correct guard is `savedViews.isLoading` (which checks `views === undefined` internally and is exposed for exactly this purpose — per the hook's comment "needed by ?view hydration guard in KnowledgeGraph.tsx — RESEARCH Pitfall 1").
- **Fix:** Used `savedViews.isLoading` as the third guard condition. Added comment explaining the semantic equivalence. The RESEARCH/PLAN doc's intent is fully satisfied.
- **Files modified:** `src/pages/KnowledgeGraph.tsx`
- **Commits:** `506fc49`

## Known Stubs

None. All callbacks are fully wired. The `?view` hydration path applies saved state immediately on Convex load. The share URL writes to the clipboard and toasts.

## Threat Flags

No new threat surface beyond what the plan's threat model registers (T-87-05 through T-87-07). Mitigations verified:
- **T-87-05** (Tampering): `?view` token matched by exact equality against `savedViews.views`; non-matching value silently falls back (D-04). Token never reflected to DOM.
- **T-87-06** (Information Disclosure): Share URL carries only opaque shareToken; accepted by D-02.
- **T-87-07** (Elevation of Privilege): `appliedFocusRef.current = true` set inside the view effect when a view applies — prevents `?view&focus` double-hydration conflict.

## Self-Check: PASSED

- `src/components/kg/KGViewsPopover.tsx` — FOUND
- `src/components/kg/KGViewsPopover.test.tsx` — FOUND
- `src/components/kg/KGControls.tsx` contains `KGViewsPopover` — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `appliedViewRef` — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `isLoading` guard in view effect — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `appliedFocusRef.current = true` in view effect — FOUND
- `src/pages/KnowledgeGraph.tsx` contains `navigator.clipboard.writeText` + `buildShareUrl` — FOUND
- Commit `f39c0f7` — FOUND
- Commit `506fc49` — FOUND
- KGViewsPopover tests 7/7 green — CONFIRMED
- KGControls tests 12/12 green — CONFIRMED
- `npx tsc --noEmit` clean — CONFIRMED
