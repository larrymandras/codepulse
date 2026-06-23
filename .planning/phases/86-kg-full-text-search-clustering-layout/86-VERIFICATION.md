---
phase: 86-kg-full-text-search-clustering-layout
verified: 2026-06-23T18:00:00Z
status: passed
score: 7/7 truths verified
overrides_applied: 0
human_uat: "Confirmed 2026-06-23 (commit d78c032) — all 3 human-verification items signed off via Playwright on an auth-bypassed dev instance against 4,038 real Convex nodes: (1) community halos/clustering render on /graphs CodeVault; (2) Communities legend correctly absent on community-null KG Explorer; (3) Search lens degrades gracefully on an unreachable /api/kg/search. Fully-lit halos + live search remain data-gated on Ástríðr (community emission D-10 + SEED-008 /api/kg/search) — by design, not a CodePulse gap."
human_verification:
  - test: "Open /graphs with a live Convex code/vault snapshot. Confirm that nodes carrying integer community ids render with visible color halos and drift toward community-specific regions as the simulation settles. Vault nodes (community: null) must show no halo."
    expected: "Co-community code nodes grouped spatially + halo rings; vault nodes unchanged, force-directed only."
    why_human: "Canvas paint output and d3-force cluster convergence cannot be asserted by grep or unit test — requires visual inspection with live WebGL/Canvas render."
  - test: "On the KG Explorer (/knowledge-graph), switch to the Search lens. Type any term (e.g. 'memory'). Confirm the panel shows the amber 'not available on this build yet' copy — not a red error banner and not a stack trace."
    expected: "Amber informational banner exactly as in KGSearchResults 'not-deployed' state. Entity lens still functional when switched back."
    why_human: "Requires a running dev server and the live Ástríðr backend returning 404 or 501 from /api/kg/search — automated unit tests mock the API response."
  - test: "On the KG Explorer, confirm the Communities legend section is absent when all nodes have community=null (current real-data state). Then (future, when Ástríðr emits community): confirm it appears with correct Cluster {id} labels and swatch colors."
    expected: "No Communities section visible today. Section appears automatically once API emits community."
    why_human: "Legend visibility depends on live Convex data; cannot be verified without the actual running app."
---

# Phase 86: KG Full-Text Search + Clustering Layout — Verification Report

**Phase Goal:** Operators can search across KG fact text and relationships (not just entity names), and large graphs render with legible community-cluster layout.
**Verified:** 2026-06-23T18:00:00Z
**Status:** passed (7/7 truths VERIFIED; all 3 visual/runtime human items signed off 2026-06-23 via Playwright — commit d78c032)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | Typing a term in the KG search box returns fact-text and relationship-label matches, distinct from entity-name search | VERIFIED | `KGSearchResults.tsx` renders `hit.predicate + hit.snippet`; `KGControls.tsx` gates entity-name input to `lens==="entity"` only and full-text input to `lens==="search"` only; 12 `KGControls.test.tsx` tests including SC#1 mutual-exclusivity assertions pass |
| SC-2 | Search backed by `/api/kg/search`; cross-repo dependency called out and gated | VERIFIED | `kgApi.ts:234-241` — `fetchSearch` delegates to `kgGet("/api/kg/search", ...)` via Bearer auth; `KnowledgeGraph.tsx:157-163` — `AstridrApiError` with `e.status === 404 \|\| e.status === 501` routes to `"not-deployed"` gate state; header comment at `kgApi.ts:20-34` documents A2 SEED + Open Q1 + gate placement; 7 `kgApi.test.ts` cases cover 404/501 throws |
| SC-3 | Graphs with `community` field render co-community nodes visually clustered (color-coded or spatially grouped) | VERIFIED (wiring + gating; visual pending human) | `ForceGraphCanvas.tsx:118-177` — `clusterForce` useEffect injects `d3Force("clusterX")`, `d3Force("clusterY")`, `d3Force("clusterCollide")` when `nodes.some(n => n.community != null)`; halo arc drawn in `paint` wrapper at L231-247 via `communityColorFn`; both `CodeVaultGraph.tsx` (L482-483) and `KnowledgeGraph.tsx` (L465-468) pass `clusterForce={true}` + `communityColorFn`; `ForceGraphCanvas.test.tsx` — 14 tests including gate test (community present → d3Force called) and halo test; live canvas rendering requires human check |
| SC-4 | Graphs without `community` field continue with existing force-directed layout — no regression | VERIFIED (logic verified; runtime pending human) | `ForceGraphCanvas.tsx:126-132` — when `hasCommunity = false`, forces are removed: `d3Force("clusterX", null)`, `d3Force("clusterY", null)`, `d3Force("clusterCollide", null)`, then `return`; `useKnowledgeGraph.ts:209-212` — `lens==="search"` branch sets `EMPTY_GRAPH`, never registering cluster forces via the search path; KG entities today resolve `community: null` via `upsertNode` (`kg-graph.ts:272`), so `hasCommunity` is `false` on the KG surface — confirmed by SUMMARY-02 manual observation |

### Plan-Frontmatter Must-Haves (merged with ROADMAP SCs above)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| P1-T1 | `communityColor(0)` returns `#60a5fa`; `communityColor(null)` returns `null`; `communityColor(8)` wraps to slot 0 | VERIFIED | `kg-graph.ts:123-144` — `COMMUNITY_PALETTE[0] = "#60a5fa"`, `if (community == null) return null`, `COMMUNITY_PALETTE[Math.abs(community) % 8]`; confirmed by 37 passing kg-graph.test.ts cases |
| P2-T1 | 5th Search lens in KGControls; full-text input visible only for lens=search; entity-name input mutually exclusive | VERIFIED | `KGControls.tsx:21` — `{ id: "search", label: "Search", ... }` in LENSES array; `L112-123` — `{lens === "search" && <Input placeholder="Search facts & relationships…" ...>}`; `L85-109` — `{lens === "entity" && ...}` gates entity input; 12 test cases in `KGControls.test.tsx` assert SC#1 mutual exclusivity |
| P3-T1 | Clicking a result row calls `buildFocusUrl` with `surface="knowledge-graph"`, `hops=1`, `subjectName` verbatim | VERIFIED | `KnowledgeGraph.tsx:184-193` — `handleSearchResultClick` calls `buildFocusUrl({ surface: "knowledge-graph", entityName: subjectName, hops: 1 }, ...)` and `navigate(url)`; `KGSearchResults.tsx:138` — `onClick={() => onSelectResult(hit.subjectName)}` passes verbatim; test `KGSearchResults.test.tsx:62-76` asserts verbatim subjectName on click |

**Score:** 7/7 truths VERIFIED (wiring and logic checks pass; visual/runtime behaviors routed to human verification)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/kg-graph.ts` | `COMMUNITY_PALETTE` 8-slot + `communityColor()` + `KgNode.community` | VERIFIED | L123-144: palette defined, function exported; L53-55: `community?: number \| null` on `KgNode`; L272: threaded in `upsertNode` |
| `src/components/graph/ForceGraphCanvas.tsx` | `clusterForce` prop, cluster force useEffect, halo paint, `d3Force`/`d3ReheatSimulation` on handle | VERIFIED | L10: `import { forceX, forceY, forceCollide } from "d3-force-3d"`; L35-37: handle members; L114-115: wired via `useImperativeHandle`; L118-177: cluster useEffect; L231-247: halo in `paint` wrapper |
| `src/components/graph/CodeVaultGraph.tsx` | `clusterForce` + `communityColorFn` wired on ForceGraphCanvas | VERIFIED | L39: `import { communityColor } from "../../lib/kg-graph"`; L482-483: `clusterForce={true}` + `communityColorFn={(node) => communityColor(node.community)}` |
| `src/pages/KnowledgeGraph.tsx` | Community halo wiring + `presentCommunities` useMemo + auto-hide legend + search lens layout fork | VERIFIED | L265-279: `presentCommunities` useMemo; L408-428: Communities legend auto-hides on `presentCommunities.length > 0`; L345-374: search layout fork; L465-468: `clusterForce={true}` + `communityColorFn` |
| `src/lib/kgApi.ts` | `fetchSearch()` + `KgSearchParams/KgSearchHit/KgSearchResponse` types | VERIFIED | L109-143: three types exported; L234-241: `fetchSearch` delegates to `kgGet("/api/kg/search", ...)` |
| `src/hooks/useKnowledgeGraph.ts` | `KgLens "search"` + `searchQuery` ephemeral filter + idb strip | VERIFIED | L21: `"search"` in union; L35: `searchQuery: string` in `KgFilters`; L149: `searchQuery` destructured out before `idbSet`; L129: `saved.lens !== "search"` guard on hydration |
| `src/components/kg/KGControls.tsx` | 5th lens tab + gated full-text input | VERIFIED | L21: `{ id: "search" }` entry in LENSES; L112-123: `{lens === "search" && <Input ...>}` |
| `src/components/kg/KGSearchResults.tsx` | Scrollable results panel with all states | VERIFIED | L47-165: component renders idle/loading/not-deployed/error/ok states; `renderSnippet` at L29-43 uses React text + `<span>` only |
| `src/types/d3-force-3d.d.ts` | Ambient type declarations for d3-force-3d | VERIFIED | File exists at `src/types/d3-force-3d.d.ts` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CodeVaultGraph.tsx` | `kg-graph.ts communityColor` | `communityColorFn` prop on `ForceGraphCanvas` | WIRED | `L39: import { communityColor }` + `L483: communityColorFn={(node) => communityColor(node.community)}` |
| `ForceGraphCanvas.tsx` | `d3-force-3d forceX/forceY/forceCollide` | `useEffect` injected cluster force gated on `nodes.some(n => n.community != null)` | WIRED | `L10: import { forceX, forceY, forceCollide }` + `L125-177: useEffect` with `hasCommunity` gate |
| `KnowledgeGraph.tsx` | `kg-graph.ts communityColor` | `communityColorFn` prop on `ForceGraphCanvas` | WIRED | `L24: import { communityColor }` + `L466-468: communityColorFn={(n) => communityColor((n as KgNode).community)}` |
| `KnowledgeGraph.tsx` | `kgApi.ts fetchSearch + AstridrApiError` | Debounced `useEffect` with monotonic token guard | WIRED | `L18-19: import { fetchSearch, AstridrApiError }` + `L147: await fetchSearch(...)` + `L157-163: instanceof AstridrApiError && e.status === 404 \|\| 501` |
| `KnowledgeGraph.tsx` | `focus-url.ts buildFocusUrl` | `handleSearchResultClick` result-click handler | WIRED | `L17: import { buildFocusUrl }` + `L184-193: handleSearchResultClick → buildFocusUrl` + `navigate(url)` |
| `kgApi.ts fetchSearch` | Ástríðr `/api/kg/search` | `kgGet(...)` with Bearer auth via `authHeaders()` | WIRED | `L234-241: kgGet<KgSearchResponse>("/api/kg/search", { query, entity_type, agent_id, limit })` |
| `KGSearchResults.tsx` | `kgApi.ts KgSearchHit` | Props interface + row renderer | WIRED | `L13: import type { KgSearchHit }` + `L15-25: props interface` + `L136-157: result row buttons` |

---

## Data-Flow Trace (Level 4)

### KG-09: Community data path (CodeVaultGraph)

| Stage | Source | Evidence | Status |
|-------|--------|----------|--------|
| Convex schema | `graphSnapshotNodes.community: v.optional(v.union(v.float64(), v.null()))` | `convex/graphSnapshots.ts:62` | REAL — schema present |
| DB query | `getProjectGraph` query returns `community: n.community` per node | `convex/graphSnapshots.ts:272` | REAL — not stubbed |
| Hook passthrough | `useProjectGraph` returns raw Convex result; `snapshot.nodes` passed directly to `filteredData.nodes` | `useProjectGraph.ts:23-28`; `CodeVaultGraph.tsx:214-226` | FLOWING — no remapping that drops community |
| Render | `communityColorFn={(node) => communityColor(node.community)}` on `ForceGraphCanvas` | `CodeVaultGraph.tsx:483` | FLOWING — community drives halo color |

**Assessment:** Data flows end-to-end from Convex DB → hook → render node objects → `communityColor()` → canvas halo. For vault nodes and current KG entities, `community` resolves to `null` → `communityColor(null) = null` → no halo drawn — SC#4 gating is correct.

### KG-08: Search data path

| Stage | Source | Evidence | Status |
|-------|--------|----------|--------|
| API call | `fetchSearch` → `kgGet("/api/kg/search", ...)` with Bearer auth | `kgApi.ts:234-241` | WIRED — endpoint does not exist yet (by design) |
| D-01 gate | `AstridrApiError 404/501` → `setSearchGateState("not-deployed")` | `KnowledgeGraph.tsx:157-163` | CORRECTLY GATED — informational path, not error |
| Results render | `searchResults` state → `<KGSearchResults results={searchResults} ...>` | `KnowledgeGraph.tsx:349-356` | WIRED |
| Result click | `handleSearchResultClick(subjectName)` → `buildFocusUrl` → `navigate(url)` | `KnowledgeGraph.tsx:184-193` | WIRED |

**Assessment:** The search path is correctly wired and correctly gated. The "not available" state is the intended behavior while the Ástríðr endpoint is not yet deployed — this is SC#2 satisfied, not a stub.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — the dev server is not running in this verification session. Key behaviors are verified via unit tests (90/90 passing per integration gate) and the grep-level wiring checks above. Visual rendering behaviors are routed to human verification.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| KG-08 | 86-03 | Full-text search across KG fact text + relationship labels; cross-repo gated | SATISFIED | `fetchSearch` + `KGSearchResults` + D-01 gate verified; 39 tests green |
| KG-09 | 86-01, 86-02 | Community-cluster visual grouping; SC#4 no-regression | SATISFIED | `COMMUNITY_PALETTE` + `communityColor()` + `clusterForce` useEffect + halo + wired on both graph surfaces; 64 tests green |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No `TBD`, `FIXME`, or `XXX` markers in any phase-86 modified files. No stub returns (`return []`, `return {}`, `return null` without real data source). The `community: null` default in `upsertNode` is intentional gating (not a stub) — it resolves to the amber "no community" path which is the correct current-data behavior. The `not-deployed` state in `KGSearchResults` is the designed D-01 graceful-degrade, not a placeholder.

One notable code pattern: `communityColorFn` draws the halo AFTER the `paintNode` callback in the `paint` wrapper (`ForceGraphCanvas.tsx:229-247`). The comment says "under the selection ring" but the draw order means the halo is drawn AFTER the caller's fill+ring — visually the halo sits between fill and label. This is the architecture decision from Plan 01 and is tested. Not a bug; notation is slightly ambiguous but the intent (no double-stroke; shared path) is correct.

---

## Human Verification Required

### 1. SC-3 Live Canvas: Community halos + spatial clustering on real data

**Test:** Start `npm run dev` with the Convex backend running (`npm run dev:backend`). Navigate to `/graphs`. With a live code/vault snapshot containing graphify-computed community ids, observe the force graph settle.
**Expected:** Nodes with the same integer `community` id drift toward each other and show color-coded halo rings (matching `COMMUNITY_PALETTE` slots). Vault nodes (community=null) render with no halo and follow standard force-directed layout.
**Why human:** Canvas 2D arc paint and d3-force cluster centroid convergence cannot be asserted programmatically without a headless browser + canvas capture pipeline. Unit tests mock the d3Force calls and assert call signatures, but not pixel output.

### 2. SC-2 Live Degrade: Search lens shows amber "not available" copy (not a red error or stack trace)

**Test:** Start the dev server. Navigate to `/knowledge-graph`. Click the "Search" lens tab. Type any term (e.g. "memory") in the full-text input.
**Expected:** After ~250ms debounce, the results panel shows the amber informational banner: "Full-text search isn't available on the connected Ástríðr build yet." The Entity lens tab still functions normally (switching back lets you search by entity name).
**Why human:** Requires a running dev server with Ástríðr either not running or its `/api/kg/search` endpoint returning 404 — the exact production scenario. Unit tests mock `AstridrApiError(404)` but real-network timing and the rendered amber panel require visual confirmation.

### 3. SC-4 Live: Communities legend absent on real community-less KG data

**Test:** On the KG Explorer, switch to Overview, Temporal, or Contradiction lens. Observe the floating legend panel in the top-left of the graph area.
**Expected:** The "Communities" heading and any "Cluster {id}" rows are completely absent (because today's KG entities all have `community: null`). Only entity-type colors, current/superseded/contradiction line legend entries appear.
**Why human:** Legend visibility is driven by `presentCommunities.length > 0` on live Convex data — must be confirmed with real app data, not a mock.

---

## Gaps Summary

No gaps. All 7 observable truths are VERIFIED in the codebase. The 3 human verification items above are runtime/visual checks that require a live dev server — they are not indications of missing implementation.

The two design constraints called out in the verification context are confirmed correctly implemented:

**KG-09 data-gated clustering:** The gate at `ForceGraphCanvas.tsx:125` (`nodes.some(n => n.community != null)`) is the correct mechanism. When all nodes have `community: null`, forces are removed via `d3Force("clusterX", null)` etc. and the function returns early — no spatial disruption. When real community data arrives, the existing props `clusterForce={true}` + `communityColorFn` activate automatically on both surfaces.

**KG-08 graceful-degrade gate (D-01):** `KnowledgeGraph.tsx:157-163` catches `AstridrApiError` with `status 404 || 501` and sets `searchGateState("not-deployed")` — routing to the amber informational panel, not the red error banner. Any other error class routes to `"error"` (red). This is the correct gating behavior.

---

_Verified: 2026-06-23T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
