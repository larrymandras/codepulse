---
phase: 87-saved-views-temporal-diff
plan: "01"
subsystem: kg-saved-views
tags: [convex, kg, saved-views, persistence, share-token]
dependency_graph:
  requires: []
  provides: [api.savedKgViews.save, api.savedKgViews.list, api.savedKgViews.remove, api.savedKgViews.getByShareToken, useSavedViews]
  affects: [KnowledgeGraph.tsx, KGControls.tsx]
tech_stack:
  added: []
  patterns: [convex-domain-module, useQuery-useMutation-hook-wrapper, searchQuery-exclusion, client-side-share-token]
key_files:
  created:
    - convex/savedKgViews.ts
    - src/hooks/useSavedViews.ts
    - src/hooks/useSavedViews.test.ts
  modified:
    - convex/schema.ts
    - convex/_generated/api.d.ts
decisions:
  - "D-06 searchQuery exclusion: destructure pattern const { searchQuery: _sq, ...persistable } = filters mirrors useKnowledgeGraph.ts:149"
  - "D-03 shareToken generated client-side in useSavedViews.saveView() via crypto.randomUUID() — avoids Convex runtime crypto question (RESEARCH Open Question 1)"
  - "D-05 focus + hops stored as top-level fields in savedKgViews (not only inside filters) per CONTEXT.md correction to UI-SPEC"
  - "save mutation input-validates name.trim().length 1..100 (T-87-01 ASVS V5)"
metrics:
  duration_seconds: 230
  completed_date: "2026-06-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 87 Plan 01: savedKgViews Persistence Layer + useSavedViews Hook Summary

**One-liner:** Convex `savedKgViews` table with CRUD + share-token lookup, plus `useSavedViews` hook with searchQuery exclusion, client-side UUID generation, and `buildShareUrl` helper.

## What Was Built

### Task 1 — savedKgViews table + Convex CRUD (commit `4b1eec4`)

Added `savedKgViews` table to `convex/schema.ts` immediately after the `kgSummary` table (keeps KG tables co-located). Fields: `name`, `lens`, `filters` (`v.any()`), `focus`, `hops`, `shareToken`, `createdAt`. Two indexes: `by_shareToken` (exact lookup for share-link resolution) and `by_createdAt` (newest-first list).

Created `convex/savedKgViews.ts` with four exports:
- `save` — validates `name.trim().length` in [1, 100] before insert (T-87-01 guard); receives client-generated `shareToken` as arg
- `list` — `.withIndex("by_createdAt").order("desc").collect()` — not a bare collect
- `remove` — deletes by `_id`
- `getByShareToken` — exact index match via `by_shareToken`; returns `null` on miss with no reflected content (T-87-02)

Ran `npx convex codegen` — `api.savedKgViews` present in `convex/_generated/api.d.ts`.

### Task 2 — useSavedViews hook + Wave 0 tests (commit `b5f2bc5`)

Created `src/hooks/useSavedViews.ts` mirroring `useTeamPresets.ts` exactly:
- `useQuery(api.savedKgViews.list)` with `isLoading: views === undefined` (RESEARCH Pitfall 1 guard for `?view` hydration)
- `saveView(name, lens, filters, focus, hops)`: strips `searchQuery` via destructure (D-06), generates `shareToken = crypto.randomUUID()` (D-03), calls mutation with `toast.success` / `toast.error`
- `deleteView(id)`: silent — no toast (views are reconstructable preferences)
- `buildShareUrl(shareToken)`: `${window.location.origin}/knowledge-graph?view=${shareToken}`

Exports: `useSavedViews` (function) + `SavedKgView` (interface).

Wave 0 tests (`src/hooks/useSavedViews.test.ts`) — 3/3 green:
1. `saveView` passes filters WITHOUT `searchQuery` key to mutation
2. `saveView` passes a truthy `shareToken` string to mutation
3. `buildShareUrl("abc")` returns URL ending with `/knowledge-graph?view=abc`

## Verification Results

- `npx tsc --noEmit` — no errors for `savedKgViews` or `useSavedViews`
- `npx vitest run src/hooks/useSavedViews.test.ts` — 3/3 passed
- `api.savedKgViews` present in `convex/_generated/api.d.ts` (grep: 2 matches)
- Schema indexes: `grep -c "by_shareToken\|by_createdAt" convex/schema.ts` → 4
- Exports: `grep -c "^export const" convex/savedKgViews.ts` → 4

## Commits

| Hash | Message |
|------|---------|
| `4b1eec4` | feat(87-01): add savedKgViews table + Convex CRUD + share-token lookup |
| `b5f2bc5` | feat(87-01): add useSavedViews hook + Wave 0 tests (searchQuery exclusion, buildShareUrl) |

## Deviations from Plan

None — plan executed exactly as written.

The test file used named imports (`{ useSavedViews }`) instead of default imports (trivially correct — the hook uses named exports). No behavior change.

## Known Stubs

None. This plan is a pure persistence layer — no UI rendering, no placeholder data.

## Threat Flags

No new threat surface beyond what the plan's threat model already registers (T-87-01 through T-87-04). The `save` mutation's name-length guard (T-87-01) and the `getByShareToken` exact-match return (T-87-02) are both implemented as specified.

## Self-Check: PASSED

- `convex/savedKgViews.ts` — FOUND
- `src/hooks/useSavedViews.ts` — FOUND
- `src/hooks/useSavedViews.test.ts` — FOUND
- Commit `4b1eec4` — FOUND
- Commit `b5f2bc5` — FOUND
- `api.savedKgViews` in `convex/_generated/api.d.ts` — FOUND (2 matches)
- Wave 0 tests 3/3 green — CONFIRMED
