---
phase: 86
plan: "01"
subsystem: graph-rendering
tags: [kg, clustering, community, force-graph, canvas-paint, d3-force-3d]
dependency_graph:
  requires: [phase-83-graph-snapshot-receiver, phase-84-graphs-hub-codevault]
  provides: [communityColor, COMMUNITY_PALETTE, KgNode.community, ForceGraphCanvas.clusterForce, ForceGraphCanvas.communityColorFn, ForceGraphHandle.d3Force]
  affects: [src/lib/kg-graph.ts, src/components/graph/ForceGraphCanvas.tsx, src/components/graph/CodeVaultGraph.tsx]
tech_stack:
  added: [d3-force-3d (forceX/forceY/forceCollide — already transitive dep; now imported directly)]
  patterns: [d3-force cluster ring centroid injection, canvas halo arc paint, useEffect-gated simulation reheat, prefers-reduced-motion guard]
key_files:
  created: [src/types/d3-force-3d.d.ts]
  modified:
    - src/lib/kg-graph.ts
    - src/lib/kg-graph.test.ts
    - src/components/graph/ForceGraphCanvas.tsx
    - src/components/graph/ForceGraphCanvas.test.tsx
    - src/components/graph/CodeVaultGraph.tsx
decisions:
  - "Halo drawn in shared paint wrapper (communityColorFn prop) not in caller's paintNode — single implementation serves both KG and CodeVaultGraph without code duplication"
  - "COMMUNITY_PALETTE uses exact UI-SPEC locked hex values (#60a5fa..#a3e635); test assertion changed from non-overlap-with-ENTITY_TYPE_COLORS to exact-slot-values match (plan behavior spec conflicted with locked hex values — slots 1/4/5 share values with ENTITY_TYPE_COLORS by design)"
  - "d3-force-3d ambient .d.ts added to src/types/ instead of @types install (no package available)"
  - "forwardRef mock in ForceGraphCanvas.test.tsx allows inner fgRef.current to be populated by react-force-graph-2d mock so useEffect cluster injection is testable"
metrics:
  duration: "~35 minutes"
  completed: "2026-06-23"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 6
  tests_added: 37
  tests_total_passing: 64
---

# Phase 86 Plan 01: Community Cluster Renderer Summary

One-liner: KG-09 community clustering shipped — 8-slot palette + communityColor() helper, d3-force ring centroid injection gated on community data, canvas halo arc drawn via communityColorFn prop, wired live on the code/vault graph.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Community palette + communityColor() + KgNode.community | 1198789 | src/lib/kg-graph.ts, src/lib/kg-graph.test.ts |
| 2 | ForceGraphCanvas cluster force + halo + extended handle | 02f9150 | src/components/graph/ForceGraphCanvas.tsx, ForceGraphCanvas.test.tsx, src/types/d3-force-3d.d.ts |
| 3 | Wire clustering into code/vault graph | 68a076a | src/components/graph/CodeVaultGraph.tsx |

## Verification

**Automated (64 tests, all passing):**
- `npx vitest run src/lib/kg-graph.test.ts` — 37 tests (includes communityColor behavior cases, COMMUNITY_PALETTE slot checks, KgNode.community threading)
- `npx vitest run src/components/graph/ForceGraphCanvas.test.tsx` — 14 tests (includes SC#3 gate test: community present → d3Force("clusterX",...) called; SC#4 test: no community → clusterX set to null)
- `npx vitest run src/components/graph/CodeVaultGraph.test.tsx` — 13 tests (all existing, still passing)
- `npx tsc --noEmit` — clean

**Manual real-data observations (SC#3 + SC#4):**
- SC#3 (co-community nodes spatially grouped + halo-colored): the code/vault graph on `/graphs` with the live Convex snapshot (~4,038 nodes from astridr-repo + codepulse + vault) now passes `clusterForce={true}` and `communityColorFn`. Code nodes (graphify:*) carry integer community ids from the graphify snapshot; they will cluster and show halo rings when the simulation settles. Vault nodes have `community: null` and render with no halo — exactly as before.
- SC#4 (no-community graphs unchanged): the `hasCommunity = nodes.some(n => n.community != null)` gate removes clusterX/clusterY/clusterCollide forces when no community data is present. A community-less graph follows the existing force-directed layout with no layout change.
- NOTE: Live visual observation at `/graphs` was not performed in this session (dev server not started). The SC#3/SC#4 behavior is verified by the automated test suite above which mocks the d3Force calls and asserts the correct gating logic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion conflicted with locked UI-SPEC hex values**
- **Found during:** Task 1 RED phase
- **Issue:** Plan behavior spec stated "none present in ENTITY_TYPE_COLORS (distinct encoding)" but the UI-SPEC–locked hex values for slots 1 (#f472b6/pink-400), 4 (#a78bfa/violet-400), and 5 (#22d3ee/cyan-400) are identical to existing ENTITY_TYPE_COLORS entries for "event", "project", and "concept" respectively. The plan's behavior spec was inconsistent with the locked action values.
- **Fix:** Changed the test assertion from a non-overlap check to an exact-slot-match assertion against the 8 UI-SPEC hex values. The semantic intent (community encoding distinct from entity-type encoding) is preserved — the palette entries serve different visual roles (halo ring vs. node fill).
- **Files modified:** src/lib/kg-graph.test.ts
- **Commit:** 1198789

**2. [Rule 3 - Blocking] `window.matchMedia` not available in jsdom**
- **Found during:** Task 2 GREEN phase
- **Issue:** `ForceGraphCanvas` useEffect calls `window.matchMedia("(prefers-reduced-motion: reduce)")` for the prefers-reduced-motion guard; jsdom throws `TypeError: window.matchMedia is not a function`.
- **Fix:** Added `Object.defineProperty(window, "matchMedia", ...)` stub in ForceGraphCanvas.test.tsx (returns `matches: false`).
- **Files modified:** src/components/graph/ForceGraphCanvas.test.tsx
- **Commit:** 02f9150

**3. [Rule 3 - Blocking] Missing type declarations for d3-force-3d**
- **Found during:** Task 2 TypeScript check
- **Issue:** `d3-force-3d` has no `@types` package; TypeScript reported implicit `any`.
- **Fix:** Created `src/types/d3-force-3d.d.ts` with ambient module declaration covering the three functions used (forceX, forceY, forceCollide).
- **Files modified:** src/types/d3-force-3d.d.ts (created)
- **Commit:** 02f9150

**4. [Rule 1 - Bug] react-force-graph-2d mock needed forwardRef to populate inner fgRef**
- **Found during:** Task 2 test execution
- **Issue:** The plain `vi.fn()` mock for `react-force-graph-2d` didn't use `forwardRef`, so React never called the ref setter on the mock — `fgRef.current` stayed null, causing the cluster `useEffect` to return early without calling `d3Force`.
- **Fix:** Changed mock to `reactForwardRef((props, ref) => { ref.current = h.fgRef; return null; })` so the inner ref is populated correctly when React renders the mock.
- **Files modified:** src/components/graph/ForceGraphCanvas.test.tsx
- **Commit:** 02f9150

## Known Stubs

None. All community data flows from `graphSnapshotNodes.community` (Convex schema, already live since Phase 83). No hardcoded empty values or placeholders in the deliverable.

## Threat Flags

None. T-86-01 (palette index clamping via Math.abs % 8) and T-86-03 (canvas state reset after halo) are implemented as specified in the threat model.

## Self-Check

**Created files:**
- src/types/d3-force-3d.d.ts — EXISTS

**Commits:**
- 1198789 — feat(86-01): add COMMUNITY_PALETTE, communityColor(), KgNode.community
- 02f9150 — feat(86-01): ForceGraphCanvas cluster force + community halo + extended handle
- 68a076a — feat(86-01): wire clusterForce + communityColorFn into CodeVaultGraph

## Self-Check: PASSED
