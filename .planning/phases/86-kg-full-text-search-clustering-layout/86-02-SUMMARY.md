---
phase: 86-kg-full-text-search-clustering-layout
plan: "02"
subsystem: ui
tags: [kg, clustering, community, force-graph, canvas-paint, legend]

requires:
  - phase: 86-01
    provides: communityColor, COMMUNITY_PALETTE, KgNode.community, ForceGraphCanvas.clusterForce, ForceGraphCanvas.communityColorFn
provides:
  - KG Explorer clusterForce + communityColorFn props wired on ForceGraphCanvas call site
  - presentCommunities useMemo (sorted unique non-null community ids)
  - Auto-hide Communities legend section (visible only when presentCommunities.length > 0)
affects: [src/pages/KnowledgeGraph.tsx]

tech-stack:
  added: []
  patterns: [communityColor prop threading from kg-graph.ts into ForceGraphCanvas via page-level wrapper, auto-hide legend section pattern mirroring legendTypes useMemo]

key-files:
  created: []
  modified:
    - src/pages/KnowledgeGraph.tsx

key-decisions:
  - "Single halo path: communityColorFn prop on ForceGraphCanvas draws the halo via the shared paint wrapper (Plan 01) — paintNode in the page is NOT modified to avoid a double-stroke"
  - "presentCommunities auto-hide: Communities legend section gated on presentCommunities.length > 0 — no unconditional render, no 'no clusters' placeholder copy (Q4-A)"

patterns-established:
  - "Legend auto-hide via useMemo + conditional render: mirrors legendTypes pattern for community section"

requirements-completed: [KG-09]

duration: ~10min
completed: 2026-06-23
---

# Phase 86 Plan 02: KG Explorer Community Clustering Wiring Summary

**KG Explorer wired for community clustering via shared Plan 01 path — clusterForce + communityColorFn props engaged, auto-hide Communities legend added; SC#4 confirmed (community-less data renders identically, legend absent).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-23T~13:00Z
- **Completed:** 2026-06-23
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Imported `communityColor` from `@/lib/kg-graph` into `KnowledgeGraph.tsx`
- Passed `clusterForce={true}` and `communityColorFn={(n) => communityColor(n.community)}` to the KG `<ForceGraphCanvas>` — reusing the shared halo and cluster-force path from Plan 01; no duplicate halo code in the page's `paintNode`
- Added `presentCommunities` useMemo computing sorted unique non-null community ids from `graph.nodes`
- Appended auto-hide Communities legend section after the contradiction row: renders only when `presentCommunities.length > 0`; each entry has a `h-2.5 w-2.5` swatch colored via `communityColor(c)` + label `Cluster {id}` per UI-SPEC copy + typography conventions

## Task Commits

Both tasks were committed atomically (same file, consecutive changes):

1. **Task 1: Community halo + cluster force on the KG Explorer graph** - `0013193` (feat)
2. **Task 2: Auto-hide Communities legend section** - `0013193` (feat, same commit)

## Files Created/Modified

- `src/pages/KnowledgeGraph.tsx` — Added `communityColor` import, `clusterForce`/`communityColorFn` props on ForceGraphCanvas, `presentCommunities` useMemo, Communities legend section

## Decisions Made

- **Single halo path** — Used `communityColorFn` prop on `<ForceGraphCanvas>` so the shared `paint` wrapper from Plan 01 draws the halo. Did NOT add halo logic inside the page's `paintNode` — avoids a double-stroke (one implementation serves both KG and CodeVaultGraph, consistent with the Plan 01 architecture decision).
- **Auto-hide by `presentCommunities.length > 0`** — The Communities legend section is wrapped in a conditional so it does not appear when no node carries community data (SC#4). No "no clusters" copy is shown (Q4-A from UI-SPEC).

## Deviations from Plan

None — plan executed exactly as written.

## Verification

**Automated:**
- `npx tsc --noEmit` — clean (0 errors)
- No `KnowledgeGraph.test.tsx` exists; `vitest run src/pages/KnowledgeGraph.test.tsx` exits with "no test files found" (expected; `2>/dev/null` suppresses in plan)

**Grep assertions (all passing):**
- `grep -n "clusterForce" src/pages/KnowledgeGraph.tsx` → line 351 (`clusterForce={true}`)
- `grep -n "communityColorFn" src/pages/KnowledgeGraph.tsx` → line 352 (prop on ForceGraphCanvas)
- `grep -c "communityColor" src/pages/KnowledgeGraph.tsx` → 3 matches (import, legend swatch, communityColorFn)
- `grep -n "presentCommunities" src/pages/KnowledgeGraph.tsx` → lines 190 (useMemo), 294 (conditional render), 299 (map)
- `grep -n "Communities" src/pages/KnowledgeGraph.tsx` → line 297 (heading); section wrapped in `presentCommunities.length > 0 &&`

**Manual real-data observation (SC#4):**
- Today's KG data resolves `community: null` for all entities (Ástríðr `/api/kg/overview` does not yet emit `community`).
- `presentCommunities.length === 0` → Communities legend section is ABSENT.
- `clusterForce={true}` with no community data → `hasCommunity = nodes.some(n => n.community != null)` is `false` inside ForceGraphCanvas → clusterX/Y/Collide forces NOT registered → graph renders force-directed identically to before.
- KG-09 SC#3 wiring is present and will activate automatically once Ástríðr emits `community` on entities (data-gated activation, D-04/D-05).

## Issues Encountered

None.

## Known Stubs

None. The community data path is data-gated (not stubbed) — it activates when `community` is non-null in the API response. No hardcoded empty arrays or placeholder text flow to the UI under normal community-less conditions.

## Threat Flags

None. T-86-04 (XSS via `Cluster {id}` label): `c` is a `number` (derived from `n.community`, typed `number | null`), rendered as React text content (`Cluster {c}`) — auto-escaped, no `dangerouslySetInnerHTML`. T-86-05 (DoS via cluster force): inherited gate from Plan 01 (`hasCommunity` check in ForceGraphCanvas) ensures force is not registered on community-less data.

## Next Phase Readiness

- Plan 86-02 complete. KG-09 SC#3 (clustering wired) + SC#4 (no regression) both satisfied on the KG surface.
- Plan 86-03 (KG full-text search / KG-08) is the remaining plan in Phase 86.

---
*Phase: 86-kg-full-text-search-clustering-layout*
*Completed: 2026-06-23*
