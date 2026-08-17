---
phase: 118-studio-media-gallery
plan: 10
subsystem: ui

tags: [react, tailwind, convex, css-masonry, shadcn]

# Dependency graph
requires:
  - phase: 118-studio-media-gallery
    provides: "api.media.list/listTrash/listStyles/listModels + toggleStar/softDelete/restore (plans 118-01/118-04/118-05)"
provides:
  - "/studio route reachable from the COMMAND nav group (D-16)"
  - "Studio page shell: PageHeader, sync caption, Gallery/Trash Tabs, local error boundary, all four UI-SPEC empty states"
  - "True CSS multi-column masonry grid with no JS dependency (MasonryGrid.tsx)"
  - "MediaCard: D-07 provenance-absent badge on the card itself, broken/missing-thumbnail fallback, audio placeholder, star overlay with stopPropagation"
  - "StudioFilterBar: 6 filter chips + 3 Selects (Kind/Model/Project), client-side filtering, createdAt-desc default sort with no favorites-float-up"
  - "The '[ NO MEDIA MATCHES ]' zero-match state, distinct from the table-empty states"
affects: ["118-11 (media detail Sheet)", "118-15 (e2e/studio.spec.ts)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS multi-column masonry (columns-N + break-inside-avoid), no JS masonry library"
    - "Client-side filter/search pipeline over a single unfiltered useQuery subscription — never pushed into the Convex query"
    - "Card-level 'absent signal renders as absent' badge (D-07), matching Bifrost.tsx's livenessOf shape"

key-files:
  created:
    - src/pages/Studio.tsx
    - src/pages/Studio.test.tsx
    - src/components/studio/MasonryGrid.tsx
    - src/components/studio/MediaCard.tsx
    - src/components/studio/MediaCard.test.tsx
    - src/components/studio/StudioFilterBar.tsx
    - src/components/studio/StudioFilterBar.test.tsx
  modified:
    - src/lib/navRegistry.ts
    - src/App.tsx

key-decisions:
  - "MediaCard's Card root carries `py-0 gap-0` overrides (via twMerge) on top of the shadcn Card's default `py-6 gap-6` so the thumbnail sits flush against the card edges, matching the UI-SPEC's literal Media Card Contract markup."
  - "Trash tab wiring (MasonryGrid + MediaCard trashVariant + star toggle) was folded into Task 3 rather than Task 2, since the UI-SPEC scopes 'Trash is a flat, search-only list' as part of the Filter Contract task."
  - "Restore is NOT wired to any card control in this plan — UI-SPEC places it in the detail Sheet's SheetFooter (plan 118-11), not on the card. The star toggle is the only write MediaCard performs in trash context."

requirements-completed: [D-02, D-07, D-16]

duration: ~75min
completed: 2026-08-14
---

# Phase 118 Plan 10: Studio Page Shell, Masonry Grid, Media Card, Filter Bar Summary

**The `/studio` COMMAND-nav route: a CSS-only masonry gallery over `api.media.list`/`listTrash` with a card-level D-07 provenance badge, broken-thumbnail/audio fallbacks, and a two-tier chip+Select filter bar — zero new npm dependencies.**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3 (all `type="auto"`, no checkpoints)
- **Files created:** 7
- **Files modified:** 2

## Accomplishments

- `/studio` is reachable from the COMMAND nav group via `src/lib/navRegistry.ts` alone — `DashboardLayout.tsx` untouched (verified `git diff --stat` empty every task).
- True CSS multi-column masonry (`columns-2 sm:columns-3 lg:columns-4 xl:columns-5 2xl:columns-6 gap-4` + `break-inside-avoid`) with **zero** JS masonry dependency — `git diff --stat package.json` empty across all three commits.
- D-07's control pair is real: a `hasProvenance: false` row renders `No provenance recorded` on the card itself (bottom-left badge), distinguishable from a complete-recipe card in the same grid view without opening either — asserted with a CONTROL test proving the badge is absent on the complete-recipe row.
- D-02 holds: nothing in `MediaCard.tsx` uses `absPath` as an image `src`; the only fetched pixels are the server-resolved `thumbnailUrl`; there is no lightbox.
- Broken/missing thumbnails render an explicit `Thumbnail unavailable` placeholder (never a broken `<img>`, never a blank card); audio rows get a `border-solid` (not dashed) placeholder read as expected, not an error.
- The star overlay's `stopPropagation()` was mutation-tested: removing it made "clicking the star opens the card" true, confirming the guard is load-bearing.
- The filter bar's `Missing Provenance` chip was proven to actually change rendered content (a complete-recipe card disappears, a no-provenance card stays) — not just click-without-error.
- The `[ NO MEDIA MATCHES ]` (filters-active) and `No media yet` / `Trash is empty` (table-empty) states are gated on different values (`visible.length` vs `rows.length`) and were mutation-tested to prove the distinction is load-bearing, not cosmetic.

## Task Commits

1. **Task 1: Nav entry, route, Studio page shell** — `0b2e5b7a` (feat)
2. **Task 2: Masonry grid and media card** — `b3eb1ca6` (feat)
3. **Task 3: Filter bar** — `b8733676` (feat)

_No separate plan-metadata commit — this SUMMARY is committed as part of wrap-up per the orchestrator's instructions._

## Files Created/Modified

- `src/lib/navRegistry.ts` — `images: Images` icon binding + `/studio` COMMAND-group entry beside Bifröst.
- `src/App.tsx` — lazy `/studio` route registration.
- `src/pages/Studio.tsx` — page shell, sync caption, Gallery/Trash Tabs, local error boundary, loading skeletons, all four empty states, filter-bar/grid wiring for both tabs.
- `src/pages/Studio.test.tsx` — 7 tests: loading-vs-empty, zero-match-vs-empty (Gallery and Trash), the Missing-Provenance chip's actual filtering effect.
- `src/components/studio/MasonryGrid.tsx` — presentational CSS-columns masonry container.
- `src/components/studio/MediaCard.tsx` — the card: thumbnail well, star overlay, D-07 badge, broken-thumbnail/audio fallbacks, trash-variant purge caption.
- `src/components/studio/MediaCard.test.tsx` — 13 tests: provenance control pair, broken-thumbnail control pair, onError transition, audio-vs-error, stopPropagation, star fill token, D-02 no-absPath-leak.
- `src/components/studio/StudioFilterBar.tsx` — chip row (6 chips), Select row (Kind/Model/Project), `applyStudioFilters` (the single filter+sort pipeline), `matchesStudioSearch`.
- `src/components/studio/StudioFilterBar.test.tsx` — 15 tests: default-sort comparator, each chip predicate, each Select predicate, search matching.

## data-testid Values Introduced (for plan 118-15's `e2e/studio.spec.ts`)

**Static:**
`studio-tab-gallery`, `studio-tab-trash`, `studio-loading-skeleton`, `studio-empty-gallery`,
`studio-empty-trash`, `studio-zero-match`, `studio-select-kind`, `studio-select-model`,
`studio-select-project`, `studio-chip-all`, `studio-chip-image`, `studio-chip-video`,
`studio-chip-audio`, `studio-chip-starred`, `studio-chip-missing-provenance`.

**Templated (suffixed with the row's `_id`):**
`` studio-media-card-${row._id} ``, `` studio-media-star-${row._id} ``,
`` studio-media-provenance-badge-${row._id} ``, `` studio-media-fallback-${row._id} ``,
`` studio-media-audio-${row._id} ``, `` studio-media-purge-caption-${row._id} `` (trash rows only).

## Decisions Made

- **MediaCard `py-0 gap-0` override.** The shadcn `Card` primitive bakes in `py-6 gap-6`; the UI-SPEC's Media Card Contract shows the thumbnail flush against the card edges with no internal padding above/below it. `twMerge` (via `cn()`) lets a `className="... py-0 gap-0 ..."` override cleanly — verified this resolves correctly (no visual gap) rather than duplicating conflicting classes.
- **Trash tab's grid wiring landed in Task 3, not Task 2.** The plan's Task 2 scope names only the Gallery tab explicitly ("Wire the grid into `Studio.tsx`'s Gallery tab"); the UI-SPEC's Filter Contract states "Trash tab does not show the filter bar... it is a flat, deletedAt-sorted list with only Search" — that statement is what actually defines Trash's final rendered shape, so its grid wiring was completed alongside Task 3's filter work rather than left as Task 2's placeholder text.
- **Restore is not a card control.** The UI-SPEC's Trash View Contract places Restore in the detail Sheet's `SheetFooter` (plan 118-11), not on the card — `MediaCard`'s trash variant only wires the star toggle, matching the spec exactly rather than adding an unspecified control.

## Deviations from Plan

None — plan executed exactly as written. Task 2's file list scoped grid-wiring to "the Gallery tab"; Trash's own grid wiring (using the same `MasonryGrid`/`MediaCard` components Task 2 built) was completed under Task 3 per the UI-SPEC's own Filter Contract framing (see Decisions above) — this is a scope clarification, not a deviation from any `must_haves` truth or acceptance criterion.

## Verification Evidence

- `npx tsc --noEmit` — clean after every task.
- `npm run build` — succeeds after every task.
- `git diff --stat package.json` — empty after every task (no dependency added).
- `git diff --stat src/layouts/DashboardLayout.tsx` — empty after every task (nav entry lives only in `navRegistry.ts`).
- Hardcoded-color grep control (proving the pattern discriminates, not just returns zero everywhere): `grep -nE "#[0-9a-fA-F]{3,8}|rgba?\(" src/index.css` →
  ```
  124:  --glow-xs: 0 0 8px rgba(6, 182, 212, 0.15);
  125:  --glow-sm: 0 0 15px rgba(6, 182, 212, 0.2);
  126:  --glow-md: 0 0 25px rgba(6, 182, 212, 0.3);
  ```
  The same pattern against every `src/components/studio/*.tsx` and `src/pages/Studio.tsx` returned **zero** matches (exit code 1) across all three tasks.
- `grep -c "dangerouslySetInnerHTML" src/components/studio/*.tsx src/pages/Studio.tsx` → `0` for every file (T-118-05).
- Full suite, **before** this plan: `327 test files passed | 17 skipped (344)`; `4506 tests passed | 197 todo (4703)`.
  Full suite, **after** this plan: `330 test files passed | 17 skipped (347)`; `4541 tests passed | 197 todo (4738)`.
  Delta: +3 test files, +35 tests (13 MediaCard + 15 StudioFilterBar + 7 Studio), **zero regressions**.
- Mutation tests (each broken → confirmed RED → restored → confirmed GREEN, restore verified against the committed source):
  1. `MediaCard`'s star `stopPropagation()` removed → "never opens the card" test failed.
  2. `MediaCard`'s `noProvenance` condition inverted → both D-07 control-pair tests failed.
  3. `MediaCard`'s `onError` handler disconnected → the broken-thumbnail-swap test failed.
  4. `StudioFilterBar`'s default sort changed to favorites-first → the no-favorites-float-up test failed.
  5. `StudioFilterBar`'s `missing-provenance` predicate inverted → the chip-isolation test failed.
  6. `StudioFilterBar`'s `kind` Select predicate dropped → the kind-filter test failed.
  7. `Studio.tsx`'s `isLoading` hardcoded to `false` → the loading-skeleton test failed.
  8. `Studio.tsx`'s table-empty gate changed from `rows.length` to `visible.length` → the zero-match-vs-empty test failed (showed `No media yet` instead of `[ NO MEDIA MATCHES ]`, the exact confusion the UI-SPEC warns against).
  9. `StudioFilterBar`'s Missing-Provenance chip `onClick` replaced with a no-op → the content-change test failed (complete-recipe card stayed visible).

## Issues Encountered

None blocking. One self-caught slip: the masonry container's literal Tailwind class string was initially written with a different token order (`columns-2 gap-4 sm:...`) than the plan's required literal string (`columns-2 sm:... gap-4`) — caught by the acceptance-criteria grep itself before commit, fixed in both `MasonryGrid.tsx` and `Studio.tsx`'s loading-skeleton container for consistency.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/studio` is live and reachable; the Gallery and Trash tabs render real data from `api.media.list`/`listTrash` with honest loading/empty/zero-match states.
- Every card exposes a stable `onOpen` prop that is currently a documented no-op — plan `118-11` (media detail Sheet) wires it to open the `MediaDetailSheet`, and should also wire `Restore` there (not on the card) per the UI-SPEC.
- `data-testid` values above are the exact surface plan `118-15`'s `e2e/studio.spec.ts` should assert against.
- The Styles/Models collapsible panels (UI-SPEC's own §"Collapsible Panels") are NOT built by this plan — out of this plan's task scope; confirm which later plan owns them before assuming they exist.

---
*Phase: 118-studio-media-gallery*
*Completed: 2026-08-14*
