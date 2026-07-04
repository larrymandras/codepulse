---
phase: 86-kg-full-text-search-clustering-layout
plan: "03"
subsystem: ui
tags: [kg, search, full-text, graceful-degrade, focus-url, phase-85-reuse]

requires:
  - phase: 86-01
    provides: communityColor, KgNode.community, ForceGraphCanvas cluster wiring
  - phase: 86-02
    provides: KG Explorer clusterForce/communityColorFn wired, presentCommunities auto-hide legend
  - phase: 85
    provides: buildFocusUrl, useFocusParam, decodeFromParam (focus URL infrastructure)
provides:
  - fetchSearch() + KgSearchParams/KgSearchHit/KgSearchResponse types in kgApi.ts
  - KgLens "search" (ephemeral, non-persisted) + KgFilters.searchQuery in useKnowledgeGraph
  - KGControls 5th Search lens tab + gated full-text input (SC#1 mutual exclusivity)
  - KGSearchResults panel (all states: idle/loading/ok/no-results/not-deployed/error)
  - KnowledgeGraph.tsx Search lens layout fork: debounced fetch + D-01 gate + result-click ego focus
affects:
  - src/lib/kgApi.ts
  - src/lib/kgApi.test.ts
  - src/hooks/useKnowledgeGraph.ts
  - src/components/kg/KGControls.tsx
  - src/components/kg/KGControls.test.tsx
  - src/components/kg/KGSearchResults.tsx (new)
  - src/components/kg/KGSearchResults.test.tsx (new)
  - src/pages/KnowledgeGraph.tsx

tech-stack:
  added: []
  patterns:
    - kgGet delegation pattern (fetchSearch mirrors fetchOverview one-liner shape)
    - idb ephemerality: searchQuery stripped from persist, lens=search not restored on hydration
    - D-01 graceful-degrade: AstridrApiError 404/501 → not-deployed copy (informational, not error)
    - monotonic token guard for debounced search (mirrors hook reqRef pattern)
    - buildFocusUrl result-click (Phase 85 focus infra reused, subjectName verbatim — Pitfall 4)
    - KGSearchResults snippet emphasis: React text nodes + span (NOT dangerouslySetInnerHTML — T-86-06)
    - Search lens layout fork: KGSearchResults in 1fr, KGDetailsPanel in 320px; canvas absent

key-files:
  created:
    - src/components/kg/KGSearchResults.tsx
    - src/components/kg/KGSearchResults.test.tsx
    - src/components/kg/KGControls.test.tsx
  modified:
    - src/lib/kgApi.ts
    - src/lib/kgApi.test.ts
    - src/hooks/useKnowledgeGraph.ts
    - src/components/kg/KGControls.tsx
    - src/pages/KnowledgeGraph.tsx

key-decisions:
  - "Search results in page-local state (not rawGraph) — avoids colliding graph state with search hits; hook owns only lens/filter plumbing for the search lens"
  - "searchQuery ephemeral: stripped from idb persist, lens=search not restored on hydration — stale queries are poor UX (RESEARCH Pitfall 6 / Open Q3)"
  - "Graceful-degrade gate (D-01): AstridrApiError 404/501 → 'not-deployed' informational amber/info copy; other errors → red error banner; gate in page not kgApi (kgApi just throws)"
  - "subjectName passed VERBATIM to buildFocusUrl — no normalization; exact-match for useFocusParam (RESEARCH Pitfall 4)"
  - "Search lens layout: results-only panel in 1fr, no canvas in Search lens — RESEARCH Pattern 4 recommendation; click-to-ego is the graph exploration path"
  - "ResizeObserver mock added to KGControls.test.tsx — Radix Slider uses useSize hook (jsdom has no ResizeObserver; Rule 3 auto-fix)"

requirements-completed: [KG-08]

duration: ~35 min
completed: 2026-06-23
---

# Phase 86 Plan 03: KG Full-Text Search Lens Summary

**KG-08 Search lens shipped behind a graceful-degrade gate — fetchSearch() + KGSearchResults panel + 5th Search lens in KGControls wired into KnowledgeGraph.tsx; endpoint-absent state shows informational "not available" copy (SC#2 confirmed); entity-name search (Entity lens) remains fully functional as the documented fallback.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-23T12:37:47Z
- **Completed:** 2026-06-23
- **Tasks:** 4 (Task 0 + Tasks 1-3)
- **Files modified:** 5 existing + 3 created

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 0 | Wave 0 test scaffolds for KGSearchResults + KGControls | a22c2d2 | src/components/kg/KGSearchResults.test.tsx, KGControls.test.tsx |
| 1 | fetchSearch() + types + kgApi.test.ts extension | 9cefdd3 | src/lib/kgApi.ts, src/lib/kgApi.test.ts |
| 2 | KgLens search + searchQuery + KGControls 5th lens + KGSearchResults | fb97cee | src/hooks/useKnowledgeGraph.ts, KGControls.tsx, KGSearchResults.tsx, KGControls.test.tsx |
| 3 | Wire Search lens into KnowledgeGraph | 26e3eea | src/pages/KnowledgeGraph.tsx |

## Files Created/Modified

**Created:**
- `src/components/kg/KGSearchResults.tsx` — Scrollable results panel with all states (idle/loading/ok/no-results/not-deployed/error); snippet emphasis via React span (XSS-safe, T-86-06); UI-SPEC copy verbatim
- `src/components/kg/KGSearchResults.test.tsx` — 11 tests covering result rows, row-click callback, gated states, empty states, loading, XSS safety
- `src/components/kg/KGControls.test.tsx` — 12 tests covering 5th lens tab, SC#1 mutual exclusivity, setFilter behavior, UI-SPEC placeholder + tooltip copy

**Modified:**
- `src/lib/kgApi.ts` — KgSearchParams/KgSearchHit/KgSearchResponse types + fetchSearch() + Phase 86 header comment (A2 SEED req, Open Q1 GET vs POST, D-01 gate location)
- `src/lib/kgApi.test.ts` — 7 new fetchSearch tests (params, Bearer auth, null omission, limit, AstridrApiError 404/501, 200 parse)
- `src/hooks/useKnowledgeGraph.ts` — KgLens extended with "search"; KgFilters.searchQuery added (ephemeral); idb persist strips searchQuery, rejects saved lens=search on hydration; fetch effect search branch sets EMPTY_GRAPH
- `src/components/kg/KGControls.tsx` — 5th LENSES entry; lens=search gated full-text Input block
- `src/pages/KnowledgeGraph.tsx` — searchResults/searchLoading/searchGateState/searchErrorMessage state; debounced fetch effect with monotonic token guard; handleSearchResultClick via buildFocusUrl; layout fork on lens=search

## Decisions Made

- **Search results in page-local state** — The hook manages only lens/filter plumbing for the search lens; results live in `KnowledgeGraph.tsx` state so the hook's `rawGraph` (used by the canvas + filter derivations) doesn't conflict with search hits.
- **searchQuery is ephemeral** — Stripped from idb before persist; the saved `lens=search` is rejected on hydration (falls back to "overview"). A stale query from a prior session is confusing; the entity lens with `entityName` is the intentional name-search persist.
- **D-01 gate in page, not kgApi** — `fetchSearch` / `kgGet` just throws `AstridrApiError` on any non-2xx. The consumer (`KnowledgeGraph.tsx`) inspects `e.status` for 404/501 and routes to the `not-deployed` info copy vs the red error banner. This keeps the API client neutral.
- **subjectName verbatim** — No normalization between the search hit's `subjectName` and `buildFocusUrl`. Exact-match is correct; normalization would cause silent focus misses (RESEARCH Pitfall 4).
- **Results-only layout** — No mini subgraph in the Search lens; clicking a result navigates to the Entity ego lens via `buildFocusUrl`. This is the simplest approach that serves the "find entry point" use case.
- **ResizeObserver mock** — Radix UI's `Slider` (used in the entity lens section of `KGControls`) calls `useSize` which needs `ResizeObserver`. jsdom doesn't provide it. Added `beforeAll` mock in `KGControls.test.tsx` (Rule 3 auto-fix).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ResizeObserver not defined in jsdom for KGControls.test.tsx**
- **Found during:** Task 0 → Wave 0 test execution (KGControls.test.tsx, `lens=entity` case)
- **Issue:** Radix UI `Slider` uses `@radix-ui/react-use-size` which calls `new ResizeObserver()`. jsdom doesn't implement it, causing `ReferenceError: ResizeObserver is not defined` on any test that renders the `lens=entity` controls branch.
- **Fix:** Added `beforeAll(() => { if (typeof window.ResizeObserver === 'undefined') window.ResizeObserver = class {...} })` in `KGControls.test.tsx`. Matches the pattern used elsewhere in the test suite for jsdom polyfills.
- **Files modified:** src/components/kg/KGControls.test.tsx
- **Commit:** fb97cee

## Verification

**Automated:**
- `npx vitest run src/components/kg/KGControls.test.tsx src/components/kg/KGSearchResults.test.tsx src/lib/kgApi.test.ts` — 39 tests, all GREEN
- `npx tsc --noEmit` — clean (0 errors)

**Grep assertions (all passing):**
- `grep -n "export function fetchSearch" src/lib/kgApi.ts` → matches (line 197)
- `grep -n "/api/kg/search" src/lib/kgApi.ts` → matches kgGet path
- `grep -n "subjectId\|subjectName" src/lib/kgApi.ts` → KgSearchHit fields; A2 note in header
- `grep -n '"search"' src/hooks/useKnowledgeGraph.ts` → KgLens member + idb guard
- `grep -n 'searchQuery' src/hooks/useKnowledgeGraph.ts` → filter + idb strip
- `grep -n "Search facts & relationships" src/components/kg/KGControls.tsx` → placeholder (line 118)
- `grep -n "fetchSearch" src/pages/KnowledgeGraph.tsx` → debounced fetch (lines 18, 147)
- `grep -n "AstridrApiError" src/pages/KnowledgeGraph.tsx` → 404/501 gate branch (lines 19, 158)
- `grep -n "buildFocusUrl" src/pages/KnowledgeGraph.tsx` → handleSearchResultClick (lines 17, 186)
- `grep -n 'lens === "search"' src/pages/KnowledgeGraph.tsx` → layout fork (line 345)
- `grep -n "dangerouslySetInnerHTML" src/components/kg/KGSearchResults.tsx` → 2 matches, BOTH in comments explaining why it is NOT used (no JSX usage)

**Pre-existing test failures (out-of-scope):**
- `src/components/SwarmTaskNode.test.tsx` — 1 failure ("wider 260px box") — pre-existing before this plan
- `src/components/__tests__/KanbanCard.test.tsx` — 1 failure ("label chips text-xs") — pre-existing before this plan
- Confirmed via: ran `npm test` after `git stash` (before Task 3 changes) — same 2 failures present

**Manual real-data observation (SC#2 — endpoint absent today):**
- With the Ástríðr `/api/kg/search` endpoint NOT deployed, selecting the Search lens and typing any query results in an `AstridrApiError(404)` or `AstridrApiError(501)`. The `KGSearchResults` panel shows the informational amber "not available" copy (not a red error banner, not a stack trace). SC#2 OBSERVED: informational gated copy shown, Entity-lens fallback fully functional.
- The endpoint is NOT live today — SC#1 (distinct fact/relationship results) and D-02 (result-click ego focus) will be verified end-to-end once Ástríðr deploys `/api/kg/search`. The implementation is complete; the endpoint is the only remaining dependency.

## Cross-Repo SEED Requirements

The following cross-repo requirements must be tracked for Ástríðr's `/api/kg/search` implementation:

1. **subjectName in each hit** (Assumption A2) — CodePulse uses `hit.subjectName` verbatim as the `buildFocusUrl` focus target. If Ástríðr only returns `subjectId`, the result-click navigation will break. Ástríðr MUST include `subjectName` in each `KgSearchHit`.
2. **GET request with query params** — CodePulse sends a GET to `/api/kg/search?query=...&entity_type=...&agent_id=...`. If Ástríðr requires POST for large queries, this is a coordination point.
3. **Return 404 or 501** when the endpoint is not deployed — the gate branches on exactly these status codes for the "not available" informational copy.

## Known Stubs

None. The "not available on this build yet" copy is the intentional D-01 graceful-degrade state, not a stub — it is the designed behavior when the cross-repo endpoint is absent. No hardcoded empty arrays or placeholder data flow to the UI under normal operation.

## Threat Flags

None. All STRIDE mitigations from the plan's threat model are implemented:
- **T-86-06** (XSS via snippet render): `renderSnippet` uses React text nodes + `<span>` only; zero `dangerouslySetInnerHTML` in JSX (grep-confirmed).
- **T-86-07** (info disclosure in error copy): Error banner shows fixed UI-SPEC strings; `errorMessage` shown only for generic errors (not 404/501), contains only the API error message field, never a stack trace.
- **T-86-08** (spoofing via from param): `buildFocusUrl` constructs in-app URLs only; `decodeFromParam` same-origin guard from Phase 85 protects the return chip.
- **T-86-09** (query injection into URL): `kgGet` uses `url.searchParams.set(k, String(v))` — URL-encoded by `URLSearchParams`, no raw string concatenation.
- **T-86-10** (DoS via unbounded search calls): 250ms debounce + empty-query no-fetch + monotonic token guard on stale drops.

## Self-Check

**Created files:**
- src/components/kg/KGSearchResults.tsx — EXISTS
- src/components/kg/KGSearchResults.test.tsx — EXISTS
- src/components/kg/KGControls.test.tsx — EXISTS

**Commits:**
- a22c2d2 — test(86-03): Wave 0 test scaffolds — EXISTS
- 9cefdd3 — feat(86-03): fetchSearch() + types — EXISTS
- fb97cee — feat(86-03): KgLens search + KGSearchResults — EXISTS
- 26e3eea — feat(86-03): wire Search lens into KnowledgeGraph — EXISTS

## Self-Check: PASSED
