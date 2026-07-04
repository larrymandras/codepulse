# Phase 86: KG Full-Text Search + Clustering Layout - Research

**Researched:** 2026-06-23
**Domain:** react-force-graph-2d cluster forces, KG full-text search consumer contract, Phase 85 focus-param reuse
**Confidence:** HIGH (all implementation unknowns resolved from live source code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Graceful-degrade behind a gate.** `fetchSearch()` in `src/lib/kgApi.ts`; on 404/501/network failure → informational copy, not hard error. Entity-name search is the documented fallback.
- **D-02: Result click → focus entity in the Entity (ego) lens.** Reuses Phase 85 `buildFocusUrl` / `useFocusParam` to center result's subject entity and switch to entity lens with hops=1 (default).
- **D-03: Search respects the active filter row.** `entityType` + `agentId` filters passed to `/api/kg/search`. Distinctness (SC#1) comes from what is searched (fact text + relationship labels), not scope.
- **D-04: Generic, data-gated cluster renderer.** Cluster force + halo paint inside `ForceGraphCanvas`, keyed on `node.community != null`. Code/vault graph has live data now; KG graph activates when Ástríðr adds `community` to `/api/kg/overview`.
- **D-05: Thread `community` through `KgNode`.** `KgNode` in `src/lib/kg-graph.ts` gains `community?: number | null`; resolves to null until KG API emits it.
- **UI contract locked in 86-UI-SPEC.md** — results panel, 5th Search lens, 8-slot community palette, halo geometry, auto-hide legend, all copy. Do not re-derive.

### Claude's Discretion

- Search ergonomics: debounce interval (250ms per UI-SPEC), min query length, result cap/pagination, exact response fields in a row.
- `/api/kg/search` request/response wire shape — consumer side defines the expected contract (see § API Contract below).
- d3-force cluster-force tuning (cluster strength, gravity-well centers, collision).
- Whether Search lens shows a result-driven subgraph or leaves overview canvas in place (one layout fork — see § Architecture Patterns).
- `hops` default for inbound search→ego jump (1 per UI-SPEC Interaction Contract).

### Deferred Ideas (OUT OF SCOPE)

- Ástríðr `/api/kg/search` endpoint implementation (astridr-repo, cross-repo SEED).
- `community` on Ástríðr KG read API — astridr-repo delta, auto-activates via D-04 when shipped.
- Saved/named/shareable views + temporal diff — Phase 87 (KG-10/KG-11).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KG-08 | Full-text search across KG fact text/values and relationship labels via Ástríðr `/api/kg/search` endpoint, surfaced as a 5th Search lens | § API Contract below; § Phase 85 Reuse; graceful-degrade pattern confirmed from `AstridrApiError` + kgApi.ts patterns |
| KG-09 | Community-cluster layout: co-community nodes visually clustered (color halos + d3-force spatial grouping); graphs without `community` keep existing force-directed layout | § d3-force Cluster Force below; `forceX`/`forceY`/`forceCollide` confirmed in installed `d3-force-3d`; `d3Force` accessor confirmed on `ForceGraph2D` ref; existing `community` field confirmed on `graphSnapshotNodes` schema |
</phase_requirements>

---

## Summary

Phase 86 ships two independent features onto the KG Explorer and the ForceGraphCanvas generic render engine. Both features are consumer-side only — no Convex backend changes are required.

**KG-08 (Full-Text Search)** adds a 5th "Search" lens to `KGControls` and a new `KGSearchResults` panel component. The feature is gated behind `AstridrApiError` status handling: a 404/501 from the Ástríðr endpoint shows informational copy instead of an error, so the UI ships fully functional code-side and lights up the moment Ástríðr deploys `/api/kg/search`. The Phase 85 focus infrastructure (`buildFocusUrl`, `useFocusParam`, `decodeFromParam`) handles result-click → ego-lens navigation with zero new deep-link plumbing.

**KG-09 (Community Clustering)** enhances `ForceGraphCanvas` with a cluster force (using `d3-force-3d`'s `forceX`/`forceY`, which is already transitively installed) and extends `paintNode` with community color halo rendering. The gate `nodes.some(n => n.community != null)` preserves the existing force-directed layout for all graphs without community data. The code/vault graph (`graphSnapshotNodes.community` field) is the only live data source this phase — demo and verify clustering there.

**Primary recommendation:** Build in three clean units — (1) `kgApi.ts` + types for `fetchSearch`, (2) `KGControls`/`KGSearchResults` Search lens UI, (3) `ForceGraphCanvas` cluster force + `kg-graph.ts` community threading — so each unit tests independently.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Full-text KG search fetch | API/Backend (Ástríðr) | Frontend (CodePulse consumer) | Ástríðr owns the search index; CodePulse calls the HTTP endpoint and renders results |
| Search gate / graceful degrade | Frontend (kgApi.ts) | — | Status-code inspection on `AstridrApiError` is a client-side concern |
| Search lens UI + results panel | Frontend (KGControls / KGSearchResults) | — | Pure UI — lens tab, debounced input, results list |
| Result-click → ego focus | Frontend (focus-url.ts / useFocusParam) | — | Reuses Phase 85 URL-param infrastructure |
| Community color palette | Frontend (kg-graph.ts) | — | Pure constant — 8-slot array, `community % 8` index |
| Community halo paint | Frontend (ForceGraphCanvas paintNode / KnowledgeGraph paintNode) | — | Canvas 2D draw call, same layer as existing node paint |
| Community spatial cluster force | Frontend (ForceGraphCanvas d3-force integration) | — | d3-force-3d `forceX`/`forceY` injected via `d3Force` ref accessor |
| KgNode community field threading | Frontend (kg-graph.ts toGraphData) | — | Pure data transform; no backend change |
| Community legend | Frontend (KnowledgeGraph.tsx legend block) | — | Auto-hide toggle based on node data presence |

---

## Standard Stack

### Core (all already installed — no new packages this phase)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `react-force-graph-2d` | `1.29.1` [VERIFIED: package.json] | Force-directed graph canvas render | Already wraps `force-graph` + `d3-force-3d`; ForceGraphCanvas is the project's generic graph wrapper |
| `force-graph` | `1.51.4` [VERIFIED: node_modules] | Underlying graph engine; exposes `d3Force` / `d3ReheatSimulation` | Transitive dep of react-force-graph-2d; `d3Force` accessor confirmed in dist |
| `d3-force-3d` | `3.0.6` [VERIFIED: node_modules] | Provides `forceX`, `forceY`, `forceCollide` | Transitive dep of force-graph; `forceX`/`forceY`/`forceCollide` confirmed available |

### No New Packages

The UI-SPEC § Registry Safety section confirms: all shadcn primitives needed (`input`, `button`, `select`, `scroll-area`, `badge`, `tooltip`) are already installed from Phase 71. d3-force clustering uses the already-present `d3-force-3d` transitive dependency. [VERIFIED: 86-UI-SPEC.md § Registry Safety]

### Package Legitimacy Audit

> No new packages are installed this phase. All libraries are already in `node_modules` from prior phases.

| Package | Registry | Status |
|---------|----------|--------|
| `react-force-graph-2d` | npm | Already installed — no install action needed |
| `d3-force-3d` | npm (transitive) | Already installed — no install action needed |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Search Lens (KGControls)
  │ user types query (debounced 250ms)
  ▼
fetchSearch(query, {entityType, agentId})  ← kgApi.ts
  │
  ├─ 404 / 501 / network error
  │       ▼
  │   KGSearchResults: gated copy ("not available on this Ástríðr build yet")
  │
  └─ 200 OK → KgSearchResponse { results: KgSearchHit[] }
          ▼
      KGSearchResults panel (new component)
          │ result row click
          ▼
      buildFocusUrl({ surface: "knowledge-graph", entityName: hit.subjectName, hops: 1 })
          ▼
      useNavigate → /knowledge-graph?focus=<name>&lens=entity&hops=1
          ▼
      KnowledgeGraph.tsx (existing) reads ?focus via useFocusParam → ego lens loads

Community Cluster Force (ForceGraphCanvas enhancement)
  │
  ├─ nodes.some(n => n.community != null) ?
  │       YES → inject forceX + forceY toward per-community centroids
  │              + forceCollide for padding
  │              + call fgRef.current.d3ReheatSimulation()
  │       NO  → existing forces only (no-op, SC#4 preserved)
  │
  └─ paintNode: communityColor(node.community) → draw halo ring under selection ring
```

### Recommended Project Structure

No new directories needed. All changes are additive to existing files plus one new component:

```
src/
├── lib/
│   ├── kgApi.ts             # ADD: fetchSearch() + KgSearchParams + KgSearchHit + KgSearchResponse
│   └── kg-graph.ts          # MODIFY: KgNode.community?: number | null; ADD: communityColor() + COMMUNITY_PALETTE
├── components/
│   ├── kg/
│   │   ├── KGControls.tsx   # MODIFY: add 5th lens entry + lens==="search" input block
│   │   └── KGSearchResults.tsx  # NEW: scrollable results panel
│   └── graph/
│       └── ForceGraphCanvas.tsx  # MODIFY: clusterForce prop + halo via paintNode opts
├── hooks/
│   └── useKnowledgeGraph.ts  # MODIFY: KgLens type + KgFilters.searchQuery; search fetch branch
└── pages/
    └── KnowledgeGraph.tsx   # MODIFY: Search lens layout fork; community legend section
```

### Pattern 1: d3-force Cluster Force via `d3Force` ref accessor

**What:** After ForceGraph2D mounts, use the imperative ref's `d3Force()` accessor to inject custom `forceX` / `forceY` forces that pull co-community nodes toward per-community centroid coordinates. Collision padding prevents overlap.

**When to use:** Only when `nodes.some(n => n.community != null)` — gate strictly.

**Key API facts:** [VERIFIED: node_modules/react-force-graph-2d/dist/react-force-graph-2d.d.ts]
- `fgRef.current.d3Force(name)` → get existing force
- `fgRef.current.d3Force(name, fn)` → set/replace force; `fn = null` removes it
- `fgRef.current.d3ReheatSimulation()` → restart simulation after force injection
- Forces are from `d3-force-3d`: `forceX(accessor)`, `forceY(accessor)`, `forceCollide(radius)`
- `forceX` / `forceY` both support `.strength(number)` and `.x(accessor)` / `.y(accessor)`

**Integration point:** ForceGraphCanvas currently exposes `onEngineStop` callback but no `d3Force` prop. Two viable approaches:

- **Approach A (prop-driven, recommended):** Add a `clusterForce?: boolean` prop to `ForceGraphCanvasProps`. When true and the underlying ref is ready (via `useEffect` on mount + data change), call `fgRef.current.d3Force("clusterX", ...)` / `fgRef.current.d3Force("clusterY", ...)` directly inside `ForceGraphCanvas`. The cluster force reads `node.community` from the graph data.

- **Approach B (caller-driven):** Expose `d3Force` / `d3ReheatSimulation` through `ForceGraphHandle` so callers (`KnowledgeGraph.tsx`, `CodeVaultGraph.tsx`) can inject the force themselves. More flexible but requires each call-site to repeat the centroid computation.

Approach A keeps cluster logic co-located with the force-graph wrapper, which is the established encapsulation pattern. Approach B is viable if the caller needs different tuning per surface.

**Example — Approach A inside ForceGraphCanvas:**
```typescript
// Source: confirmed API from node_modules/react-force-graph-2d/dist/react-force-graph-2d.d.ts
// + d3-force-3d forceX/forceY/forceCollide confirmed in node_modules/d3-force-3d

import { forceX, forceY, forceCollide } from "d3-force-3d";

// Called from useEffect after data changes, gated on community presence
function applyClusterForce(
  fg: ForceGraphHandle & { d3Force: (n: string, f?: any) => any; d3ReheatSimulation: () => any },
  nodes: Array<{ community?: number | null; x?: number; y?: number }>,
) {
  const hasCommunity = nodes.some((n) => n.community != null);
  if (!hasCommunity) {
    // Remove cluster forces if previously applied (data change, no regression)
    fg.d3Force("clusterX", null);
    fg.d3Force("clusterY", null);
    fg.d3Force("clusterCollide", null);
    return;
  }

  // Compute per-community centroid targets (grid or radial arrangement)
  const communities = [...new Set(nodes.filter(n => n.community != null).map(n => n.community!))];
  const R = 150; // radius of centroid ring
  const centroids = new Map(communities.map((c, i) => {
    const angle = (i / communities.length) * 2 * Math.PI;
    return [c, { x: Math.cos(angle) * R, y: Math.sin(angle) * R }];
  }));

  fg.d3Force(
    "clusterX",
    forceX((node: any) => centroids.get(node.community)?.x ?? 0).strength(0.15),
  );
  fg.d3Force(
    "clusterY",
    forceY((node: any) => centroids.get(node.community)?.y ?? 0).strength(0.15),
  );
  fg.d3Force(
    "clusterCollide",
    forceCollide((node: any) => (node.val ?? 3) + 2).strength(0.7),
  );
  fg.d3ReheatSimulation();
}
```

**Tuning note (planner discretion):** Strength 0.1–0.2 produces visible clustering without destroying the organic force-directed look. `forceCollide` radius = `node.val + padding` avoids halos from overlapping.

**`prefers-reduced-motion` note (UI-SPEC mandate):** When `window.matchMedia("(prefers-reduced-motion: reduce)").matches` is true, set cluster force strength to 0 (or skip `d3ReheatSimulation()` entirely). The static halo color is sufficient for reduced-motion contexts.

### Pattern 2: Community halo in `paintNode`

**What:** After drawing the node fill (entity-type color), draw a ring at `radius + 3` in the community color if non-null. Sits under the selection ring.

**Layer order (per UI-SPEC):** entity-type fill → community halo → selection ring.

```typescript
// Source: UI-SPEC.md § Color — community halo spec
// + KnowledgeGraph.tsx:L128-L172 — existing paintNode pattern

// In paintNode, after the fill, before the selection ring:
const communityHex = communityColor(n.community);  // null when community == null
if (communityHex) {
  ctx.beginPath();
  ctx.arc(n.x, n.y, size + 3, 0, 2 * Math.PI, false);
  ctx.strokeStyle = communityHex;
  ctx.lineWidth = 2;
  ctx.globalAlpha = opts.dimmed ? 0.08 : 0.7;
  ctx.shadowColor = communityHex;
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = opts.dimmed ? 0.18 : 1; // restore node alpha
}
```

The `paintNode` prop is already called for both the KG Explorer (`KnowledgeGraph.tsx:L128`) and `CodeVaultGraph` uses its own node paint. The community halo addition is:
- In `KnowledgeGraph.tsx` `paintNode` callback — for the KG graph
- In `CodeVaultGraph`'s node paint path — for the code/vault graph (first live data)

Alternatively, `ForceGraphCanvas` could accept an optional `communityColorFn?: (node: any) => string | null` prop and draw the halo in the shared `paint` function, so callers don't each implement the halo geometry. This avoids duplication between KG and CodeVaultGraph.

### Pattern 3: `fetchSearch()` in kgApi.ts

**What:** A new fetcher following the exact `kgGet` pattern — Bearer-authed GET to `/api/kg/search`, params as query string, throws `AstridrApiError` on non-2xx.

**Consumer wire contract (planner discretion — Ástríðr is the source of truth):**

```typescript
// In src/lib/kgApi.ts

export interface KgSearchParams {
  query: string;
  entity_type?: string | null;
  agent_id?: string | null;
  limit?: number;
}

export interface KgSearchHit {
  /** Subject entity name — used as the focus target for result-click (D-02). */
  subjectName: string;
  /** Subject entity id. */
  subjectId: string;
  /** The relationship label / predicate that matched. */
  predicate: string;
  /** The fact text or object literal snippet containing the match. */
  snippet: string;
  /** The matched substring within snippet, for emphasis rendering. */
  matchedTerm?: string;
  /** Confidence of the underlying triple (optional). */
  confidence?: number | null;
}

export interface KgSearchResponse {
  results: KgSearchHit[];
  count: number;
  query: string;
}

export function fetchSearch(params: KgSearchParams): Promise<KgSearchResponse> {
  return kgGet<KgSearchResponse>("/api/kg/search", {
    query: params.query,
    entity_type: params.entity_type,
    agent_id: params.agent_id,
    limit: params.limit,
  });
}
```

**Graceful-degrade gate (D-01):**
```typescript
// In the Search lens fetch handler:
import { AstridrApiError } from "./astridrApi";

try {
  const data = await fetchSearch({ query, entity_type: entityType, agent_id: agentId });
  setResults(data.results);
} catch (e) {
  if (e instanceof AstridrApiError && (e.status === 404 || e.status === 501)) {
    setGateState("not-deployed"); // → "not available on this build yet" copy
  } else {
    setGateState("error");        // → endpoint-named error copy + fallback note
  }
}
```

**Note on wire shape:** This contract is the CodePulse consumer's expectation. The Ástríðr emitter is the source of truth when live — mirror the kgApi.ts header comment pattern by documenting any known consumer/emitter divergences.

### Pattern 4: Search lens layout fork (planner discretion)

The UI-SPEC flags a layout fork: in the Search lens, the existing `grid-cols-[1fr_320px]` layout puts `KGSearchResults` in the 1fr left pane (and the 320px right pane becomes `KGDetailsPanel` after a result click). The full-width results list then switches to the entity ego graph once the user clicks a result.

**Concrete approach:** In the Search lens, render `KGSearchResults` full-width in the left pane; the existing `KGDetailsPanel` occupies the right 320px. On result click, `buildFocusUrl` navigates to the entity ego view (changing the lens to `entity`). The graph canvas is NOT shown in the Search lens — the results panel IS the primary content.

This avoids the need for a result-driven subgraph and keeps the layout simple. The Search lens is a "find entry point" tool; the ego graph is the "explore" tool.

### Anti-Patterns to Avoid

- **Hand-rolling the cluster force:** `forceX`/`forceY` from `d3-force-3d` are already installed. Do not write a custom `tick`-based position updater.
- **Using `forceCluster` plugin:** No separate plugin needed — `forceX`/`forceY` toward per-community centroids is the canonical d3 approach and all dependencies are present.
- **Always registering cluster forces:** Gate on `nodes.some(n => n.community != null)` before `d3Force(...)` calls. If forces are registered when no data has community, set them to null/no-op.
- **Hardcoding centroid positions:** Compute centroids dynamically from the unique community ids in the current data. Static hardcoded positions break when the number of communities changes.
- **Drawing the halo in `colorFn`:** `colorFn` returns one string, not two (fill + halo). Halo must be in `paintNode` (canvas draw call).
- **Throwing on 404/501 from `/api/kg/search`:** `AstridrApiError` status 404/501 must be caught and routed to the "not available" gated copy, not the general error banner.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cluster gravity | Custom tick function moving nodes | `forceX`/`forceY` from `d3-force-3d` (already installed) | d3-force handles velocity decay, alpha cooling, convergence — custom tick needs all of that |
| Node collision in cluster layout | Custom overlap resolver | `forceCollide` from `d3-force-3d` | Handles variable-radius, quadtree-efficient collision |
| Deep-link / result-click navigation | Custom router | `buildFocusUrl` + `useNavigate` (Phase 85) | Already shipped, tested (focus-url.test.ts), same-origin-guarded |
| Focus-param reading on arrival | Custom URL parsing | `useFocusParam` hook (Phase 85) | Already shipped with one-shot guard, decodeFromParam XSS guard |
| Matched-term highlight | `<mark>` / yellow background | `font-semibold text-primary` span (UI-SPEC) | Keeps palette, no yellow highlight |

---

## Focus Infrastructure Reuse (Phase 85, D-02)

### Exact signatures (confirmed from source)

**`buildFocusUrl`** (`src/lib/focus-url.ts:L46`) — [VERIFIED: live source]
```typescript
export function buildFocusUrl(target: FocusTarget, fromUrl?: string): string
// For KG search result-click:
buildFocusUrl(
  { surface: "knowledge-graph", entityName: hit.subjectName, hops: 1 },
  window.location.pathname + window.location.search  // encode current search lens URL as from-param
)
// Emits: /knowledge-graph?focus=<name>&lens=entity&hops=1&from=<encoded-origin>
```

**`useFocusParam`** (`src/hooks/useFocusParam.ts:L39`) — [VERIFIED: live source]
```typescript
export function useFocusParam<N>({
  nodes,       // N[] | undefined — undefined = still loading, hook waits
  getId,       // (node: N) => string — extract match key from node
  onFocus,     // (node: N) => void — called exactly once when matched
}: UseFocusParamOptions<N>): { fromParam: string | null }
```

**How `KnowledgeGraph.tsx` already uses it** — [VERIFIED: live source L113-L122]
```typescript
const { fromParam } = useFocusParam({
  nodes: focusEntity ? kg.graph.nodes : undefined,
  getId: (n: KgNode) => n.name,      // KG focus is name-based (D-02 in Phase 85)
  onFocus: (node: KgNode) => {
    kg.selectNode(node.id);
    centerNodeWhenReady(fgRef, node as KgNode & { x?: number; y?: number });
  },
});
```

**Precision-over-recall bias (Phase 85 D-04):** `useFocusParam` uses exact string equality (`nodes.find(n => getId(n) === focusParam)`). For search result→node resolution: if the hit's `subjectName` does not exactly match a node's `name` after the ego graph loads, the focus is a silent no-op — no broken nav, no error. This is correct behavior per the zero-false-positive bias.

**`hops` default:** 1 (matches Phase 85 pattern and UI-SPEC Interaction Contract). The `?hops=1` is hardcoded in `buildFocusUrl` for the knowledge-graph surface when `hops` is not specified.

**`KgLens` type extension:** `useKnowledgeGraph.ts` line 21 defines `KgLens = "overview" | "entity" | "temporal" | "contradiction"`. Adding `"search"` to this union affects `idb-keyval` persistence (the PERSIST_KEY `kg-explorer-state-v1` stores `{ lens, filters }`). The search lens state (query string) needs a new filter key (e.g. `searchQuery: string`) — or the search is ephemeral (not persisted). Persisting search state is planner discretion; the simplest approach is ephemeral (clearing query on lens switch, matching the entity-lens behavior today where `entityName` stays in `KgFilters`).

---

## Community Palette — Separate from Entity-Type Colors

### Confirmed separation

`ENTITY_TYPE_COLORS` in `src/lib/kg-graph.ts:L101` is the 10-slot entity-type palette. [VERIFIED: live source]
The community palette is a distinct 8-slot set. Both coexist without collision because:
- Entity-type color → node fill
- Community color → halo ring (drawn around the node, not as fill)

### Palette location

Add to `src/lib/kg-graph.ts` (same file as `ENTITY_TYPE_COLORS`) so both palettes are co-located:

```typescript
// Source: 86-UI-SPEC.md § Color — community palette (exact hex values locked)
export const COMMUNITY_PALETTE: string[] = [
  "#60a5fa", // slot 0 — blue-400
  "#f472b6", // slot 1 — pink-400
  "#fbbf24", // slot 2 — amber-400
  "#34d399", // slot 3 — emerald-400 (lighter than #10b981 accent)
  "#a78bfa", // slot 4 — violet-400
  "#22d3ee", // slot 5 — cyan-400
  "#fb923c", // slot 6 — orange-400
  "#a3e635", // slot 7 — lime-400
];

/**
 * Returns the community palette color for a given community id, or null for
 * un-clustered nodes (community == null). Keyed by community % 8 so a given
 * community id is stable across renders regardless of how many communities exist.
 */
export function communityColor(community: number | null | undefined): string | null {
  if (community == null) return null;
  return COMMUNITY_PALETTE[Math.abs(community) % 8];
}
```

**Distinctness check:** Slot 3 (`#34d399`) is emerald-400, lighter than the accent `#10b981` (emerald-500). Slot 0 (`#60a5fa`) does not appear in `ENTITY_TYPE_COLORS`. No collision confirmed. [VERIFIED against ENTITY_TYPE_COLORS source]

---

## KgNode `community` Threading (D-05)

**Change to `src/lib/kg-graph.ts`:**

```typescript
// Add to KgNode interface (line ~39):
export interface KgNode {
  // ... existing fields ...
  /** Community cluster id from graphify or future KG community detection. null = unclustered. */
  community?: number | null;
}
```

**`toGraphData` threading:** The `upsertNode` function creates KgNode from `KgEntity`. `KgEntity` (from `kgApi.ts`) does not currently carry `community` — it will once the KG API emits it (D-10, deferred). For now: KgNode.community = undefined for all KG nodes (renders as unclustered). When the API adds `community`, thread it through `KgEntity` → `upsertNode` → `KgNode`.

**For the code/vault graph:** `graphSnapshotNodes` carries `community: v.optional(v.float64())` [VERIFIED: convex/schema.ts:L1685]. The `useProjectGraph` hook / `getProjectGraph` query returns node objects with `community: number | null | undefined`. `CodeVaultGraph.tsx` already reads `selectedNode.community` for display [VERIFIED: CodeVaultGraph.tsx:L564-L568]. Threading to the graph renderer adds `community` to the node objects passed to `ForceGraphCanvas.data.nodes`.

---

## Common Pitfalls

### Pitfall 1: `d3Force` calls before the ref is populated

**What goes wrong:** Calling `fgRef.current?.d3Force(...)` during the first render before `react-force-graph-2d` has mounted returns `undefined`. The force is silently not applied.

**Why it happens:** `useImperativeHandle` populates the ref after the component tree mounts. The force injection must happen in a `useEffect` that runs after mount, not during render.

**How to avoid:** Inject cluster forces in a `useEffect` that depends on the graph data. Use the `onEngineStop` callback or a ref-check guard: `if (!fgRef.current) return;`.

**Warning signs:** Graph renders but nodes don't cluster even when `community` data is present.

### Pitfall 2: Community force re-injection on data changes without removal

**What goes wrong:** If `clusterX`/`clusterY` are re-applied on every data change without first removing the old forces, multiple named forces accumulate (each with a different centroid mapping). The simulation receives conflicting position targets.

**How to avoid:** Always call `d3Force("clusterX", null)` before re-applying. Or check if the community set is unchanged before re-injecting.

### Pitfall 3: Vault nodes (`community: null`) triggering the cluster force gate

**What goes wrong:** The gate `nodes.some(n => n.community != null)` correctly evaluates to `true` when code nodes (community: 0, 1, …) are in the graph, even when vault nodes (community: null) coexist. Vault nodes get no halo (`communityColor(null) === null`) and no cluster pull (centroid map has no entry for `null`). This is correct behavior. But if the force function applies `forceX` to a null-community node (e.g., `centroids.get(node.community)?.x ?? 0`), they get pulled to `(0, 0)` — the center — instead of being free.

**How to avoid:** In the `forceX`/`forceY` accessor, return `undefined` (not 0) for nodes where `community == null`. d3-force treats `undefined` as "no target" and leaves the node free:
```typescript
forceX((node: any) => node.community != null ? (centroids.get(node.community)?.x ?? 0) : undefined)
```

**Warning signs:** Vault nodes cluster at the origin when mixed with code nodes.

### Pitfall 4: Search result `subjectName` not matching KgNode `name` after ego load

**What goes wrong:** A search hit's `subjectName` is the name as stored in the KG. The ego entity fetch returns `resp.entity.name`. If these diverge (case, whitespace, alias), `useFocusParam`'s exact-match fails silently — the node is never centered.

**How to avoid:** Pass `subjectName` verbatim from the search result to `buildFocusUrl`. Do not normalize/transform names between the search result and the focus URL. Document this expectation in the `KgSearchHit` type comment.

### Pitfall 5: `d3ReheatSimulation` is not called after injecting forces on an already-settled graph

**What goes wrong:** If the force simulation has already cooled (alpha < alphaMin), adding new `forceX`/`forceY` forces does nothing — the simulation won't tick again.

**How to avoid:** Always call `fgRef.current?.d3ReheatSimulation()` after modifying forces. The `onEngineStop` callback is the reliable signal that the simulation has settled; the cluster-force injection should also reheat.

### Pitfall 6: `KgLens` union in idb-persisted state

**What goes wrong:** Adding `"search"` to the `KgLens` union and persisting it to idb under the existing key `"kg-explorer-state-v1"` causes no issue for new sessions, but an old saved state with `lens: "search"` in a future build where the type changes could cause a hydration mismatch.

**How to avoid:** Either (a) treat the Search lens as non-persisted (don't save `"search"` to idb; on hydration, validate `lens` against the allowed set), or (b) bump the idb key to `"kg-explorer-state-v2"` when adding the new lens. Option (a) is simpler and search queries are naturally ephemeral.

---

## Code Examples

### communityColor helper

```typescript
// Source: 86-UI-SPEC.md § Color — locked 8-slot palette
export function communityColor(community: number | null | undefined): string | null {
  if (community == null) return null;
  return COMMUNITY_PALETTE[Math.abs(community) % 8];
}
```

### KGControls 5th lens entry

```typescript
// Source: KGControls.tsx:L15 — existing LENSES array pattern [VERIFIED: live source]
const LENSES: { id: KgLens; label: string; hint: string }[] = [
  { id: "overview",       label: "Overview",       hint: "Bounded top-N entities + relationships" },
  { id: "entity",         label: "Entity (ego)",   hint: "Search an entity → its ego graph" },
  { id: "temporal",       label: "Temporal",        hint: "Scrub an as-of date; superseded facts dashed" },
  { id: "contradiction",  label: "Contradictions",  hint: "Conflicting current beliefs" },
  // ADD:
  { id: "search",         label: "Search",          hint: "Full-text across fact text + relationship labels" },
];
```

### ForceGraphHandle extension for d3Force

```typescript
// ForceGraphCanvas.tsx — extend ForceGraphHandle to expose d3Force / d3ReheatSimulation
// Source: confirmed in react-force-graph-2d.d.ts [VERIFIED]
export interface ForceGraphHandle {
  centerAt: (x: number, y: number, ms?: number) => void;
  zoom: (k: number, ms?: number) => void;
  zoomToFit: (ms?: number, padding?: number) => void;
  // ADD for cluster force injection:
  d3Force: (name: string, force?: any) => any;
  d3ReheatSimulation: () => void;
}
// In useImperativeHandle:
useImperativeHandle(ref, () => ({
  centerAt: (x, y, ms) => fgRef.current?.centerAt(x, y, ms),
  zoom: (k, ms) => fgRef.current?.zoom(k, ms),
  zoomToFit: (ms, padding) => fgRef.current?.zoomToFit(ms, padding),
  d3Force: (name, force) => fgRef.current?.d3Force(name, force),
  d3ReheatSimulation: () => fgRef.current?.d3ReheatSimulation(),
}));
```

### Community legend section in KnowledgeGraph.tsx

```typescript
// Source: KnowledgeGraph.tsx:L254-L283 — existing legend pattern [VERIFIED: live source]
// Auto-hide: render ONLY when ≥1 node has non-null community (UI-SPEC Q4-A)
const presentCommunities = useMemo(() => {
  const ids = new Set<number>();
  for (const n of graph.nodes) {
    if (n.community != null) ids.add(n.community);
  }
  return [...ids].sort((a, b) => a - b);
}, [graph.nodes]);

// In the legend block, AFTER the entity-type entries:
{presentCommunities.length > 0 && (
  <>
    <span className="mt-1 border-t border-border pt-1 text-muted-foreground uppercase tracking-wide">
      Communities
    </span>
    {presentCommunities.map((c) => (
      <span key={c} className="flex items-center gap-2 text-muted-foreground">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: communityColor(c) ?? "transparent" }}
        />
        Cluster {c}
      </span>
    ))}
  </>
)}
```

---

## Runtime State Inventory

> Omitted — this is a greenfield feature addition, not a rename/refactor/migration. No stored data, live service config, OS-registered state, secrets, or build artifacts reference the new "search" or "community" features yet (the feature doesn't exist).

---

## Environment Availability

> No new external tools or services beyond already-running Ástríðr + Convex.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `d3-force-3d` | KG-09 cluster force | ✓ (transitive) | 3.0.6 | — |
| `react-force-graph-2d` | Both KG-08/KG-09 | ✓ | 1.29.1 | — |
| Ástríðr `/api/kg/search` | KG-08 full-text search | ✗ (not yet deployed) | — | Graceful-degrade gated copy per D-01; entity-name search (Entity lens) still works |
| Convex `graphSnapshotNodes.community` | KG-09 first live data | ✓ | in schema since Phase 83 | — |

**Missing dependencies with no fallback:** None that block CodePulse execution.

**Missing dependencies with fallback:** Ástríðr `/api/kg/search` (404/501 → gated copy, Entity lens fallback). This is the designed behavior per D-01, not a gap.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + jsdom + @testing-library/react |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/kg-graph.test.ts src/lib/kgApi.test.ts src/components/graph/ForceGraphCanvas.test.tsx` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KG-08 | `fetchSearch()` sends Bearer-authed GET to `/api/kg/search` with query + filters | unit | `npx vitest run src/lib/kgApi.test.ts` | ✅ (extend existing) |
| KG-08 | `AstridrApiError(404)` → gated state, not thrown | unit | `npx vitest run src/lib/kgApi.test.ts` | ✅ (extend existing) |
| KG-08 | `AstridrApiError(501)` → gated state, not thrown | unit | `npx vitest run src/lib/kgApi.test.ts` | ✅ (extend existing) |
| KG-08 | `KGSearchResults` renders result rows with entity name, predicate, snippet | unit | `npx vitest run src/components/kg/KGSearchResults.test.tsx` | ❌ Wave 0 |
| KG-08 | `KGSearchResults` shows "not available" copy on gated state | unit | `npx vitest run src/components/kg/KGSearchResults.test.tsx` | ❌ Wave 0 |
| KG-08 | `KGSearchResults` result row click calls `onSelectResult(subjectEntity)` | unit | `npx vitest run src/components/kg/KGSearchResults.test.tsx` | ❌ Wave 0 |
| KG-08 | `KGControls` renders Search lens tab + full-text input only when `lens==="search"` | unit | `npx vitest run src/components/kg/KGControls.test.tsx` | ❌ Wave 0 |
| KG-08 | SC#1 distinctness — entity-name input hidden when lens=search; full-text input hidden when lens=entity | unit | `npx vitest run src/components/kg/KGControls.test.tsx` | ❌ Wave 0 |
| KG-09 | `communityColor(0)` returns `#60a5fa`; `communityColor(null)` returns `null` | unit | `npx vitest run src/lib/kg-graph.test.ts` | ✅ (extend existing) |
| KG-09 | `communityColor(8)` wraps to slot 0 (`community % 8`) | unit | `npx vitest run src/lib/kg-graph.test.ts` | ✅ (extend existing) |
| KG-09 | `toGraphData` threads `community` from entity → KgNode | unit | `npx vitest run src/lib/kg-graph.test.ts` | ✅ (extend existing) |
| KG-09 | `ForceGraphCanvas` with community nodes calls `d3Force("clusterX", ...)` on mount | unit | `npx vitest run src/components/graph/ForceGraphCanvas.test.tsx` | ✅ (extend existing) |
| KG-09 | `ForceGraphCanvas` with no-community nodes does NOT call `d3Force("clusterX", ...)` (SC#4) | unit | `npx vitest run src/components/graph/ForceGraphCanvas.test.tsx` | ✅ (extend existing) |
| KG-09 | `paintNode` draws halo for community-bearing node, skips for null-community node | unit | `npx vitest run src/components/graph/ForceGraphCanvas.test.tsx` | ✅ (extend existing) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/kg-graph.test.ts src/lib/kgApi.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/kg/KGSearchResults.test.tsx` — covers KG-08 result rendering, gated/error states, row click
- [ ] `src/components/kg/KGControls.test.tsx` — covers 5th lens tab, input gating (lens=search vs lens=entity), SC#1 distinctness

*(Existing files `src/lib/kg-graph.test.ts`, `src/lib/kgApi.test.ts`, `src/components/graph/ForceGraphCanvas.test.tsx` are extended with new test cases — no new file needed for those.)*

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Custom cluster force plugin | `forceX`/`forceY` with per-community centroid targets | Already in d3-force-3d 3.x; no plugin needed |
| `d3.forceSimulation` direct | Via `react-force-graph-2d` ref `.d3Force()` accessor | No direct simulation access; all mutations go through the accessor |

**Deprecated/outdated:**
- `d3-force` (plain): not installed in this project; `d3-force-3d` is the installed variant (a superset, compatible API). Do not `import { forceX } from "d3-force"` — it won't resolve.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ástríðr `/api/kg/search` will use a GET with `query` + `entity_type` + `agent_id` query params | API Contract | Low — contract is consumer-defined (D-01 discretion); Ástríðr must conform when it ships |
| A2 | Ástríðr `/api/kg/search` response will include `subjectName` (not just `subjectId`) as the focus target for result-click | API Contract | Medium — if Ástríðr only returns `subjectId`, the consumer must reverse-map to name before calling `buildFocusUrl`. Plan should note this risk and add a `subjectName` requirement in the cross-repo SEED. |
| A3 | `forceX`/`forceY` strength 0.15 produces visually legible clustering without destroying organic layout | Cluster Force Tuning | Low — purely visual; easily tuned post-implementation with no API contract implications |

---

## Open Questions

1. **Does `fetchSearch` need POST instead of GET for large queries?**
   - What we know: All existing `kgGet` fetchers are GET. KG full-text queries are likely short strings.
   - What's unclear: Whether the Ástríðr endpoint uses GET query params or a POST body.
   - Recommendation: Default to GET (consistent with `kgGet` pattern). Document in `fetchSearch` header that Ástríðr may require a POST if queries exceed URL length limits. This is a SEED task detail.

2. **Does the Search lens show a mini subgraph preview of matched entities?**
   - What we know: UI-SPEC flags this as a layout fork for the planner to resolve. CONTEXT Claude's Discretion notes it.
   - What's unclear: Whether the results panel alone is sufficient or whether a graph canvas alongside helps operators orient.
   - Recommendation: Ship results-only panel in the Search lens (simpler, cleaner, click-to-ego covers the graph need). A mini subgraph is a Phase 87 candidate.

3. **Should `KgLens = "search"` be persisted to idb?**
   - What we know: All 4 existing lenses are persisted. Adding "search" is straightforward.
   - What's unclear: Whether a persisted "search" lens with a stale query is good UX.
   - Recommendation: Persist the lens but NOT the search query (clear `searchQuery` on mount or on lens-switch away). This is consistent with the entity lens (entityName persists but feels intentional; search query is more ephemeral).

---

## Security Domain

> `security_enforcement` is not explicitly set in `.planning/config.json` — treat as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No new auth surfaces |
| V3 Session Management | No | No session state changes |
| V4 Access Control | No | Read-only KG, no mutations |
| V5 Input Validation | Yes | Search query passed to Ástríðr API — validate/trim on client; Ástríðr validates on server |
| V6 Cryptography | No | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Open redirect via `?from` param in result-click URL | Spoofing / Elevation | `decodeFromParam` same-origin guard already ships in `focus-url.ts`; result-click uses `buildFocusUrl` which constructs in-app URLs only — no external redirect path |
| Injected search query displayed unsanitized | Tampering (XSS) | Matched-term emphasis uses React element (`<span>`) not `dangerouslySetInnerHTML`; snippet rendered as React text content — safe by default |
| Search query forwarded without length limit | Denial of Service | Add min query length (1-2 chars) and debounce (250ms per UI-SPEC) client-side; Ástríðr enforces server-side limit |

---

## Sources

### Primary (HIGH confidence — verified from live source code)
- `src/lib/kgApi.ts` — kgGet pattern, AstridrApiError constructor, existing fetcher shapes [VERIFIED: live source]
- `src/lib/kg-graph.ts` — KgNode interface, ENTITY_TYPE_COLORS, toGraphData [VERIFIED: live source]
- `src/components/graph/ForceGraphCanvas.tsx` — ForceGraphHandle, paintNode pattern, d3 integration [VERIFIED: live source]
- `src/lib/focus-url.ts` — buildFocusUrl signature and FocusTarget union [VERIFIED: live source]
- `src/hooks/useFocusParam.ts` — UseFocusParamOptions, one-shot guard, exact-match behavior [VERIFIED: live source]
- `src/pages/KnowledgeGraph.tsx` — paintNode callback, legend pattern, useFocusParam usage [VERIFIED: live source]
- `src/components/graph/CodeVaultGraph.tsx:L562-L568` — community read-only display [VERIFIED: live source]
- `convex/schema.ts:L1685` — `community: v.optional(v.float64())` on graphSnapshotNodes [VERIFIED: live source]
- `node_modules/react-force-graph-2d/dist/react-force-graph-2d.d.ts` — d3Force / d3ReheatSimulation type signatures [VERIFIED: npm registry + live node_modules]
- `node_modules/d3-force-3d/package.json` + runtime verify — forceX/forceY/forceCollide available [VERIFIED: node execution]
- `node_modules/force-graph/package.json` — d3-force-3d is transitive dep of force-graph@1.51.4 [VERIFIED: live node_modules]
- `86-UI-SPEC.md` — community palette hex values, halo geometry, copy elements, layout contract [VERIFIED: live source]
- `86-CONTEXT.md` — all locked decisions D-01 through D-05 [VERIFIED: live source]

### Secondary (MEDIUM confidence — from package.json / installed versions)
- `package.json` — react-force-graph-2d@1.29.1, confirmed installed [VERIFIED: package.json]
- `vitest.config.ts` + existing test files — test framework, patterns, mock strategy for react-force-graph-2d [VERIFIED: live source]

### Tertiary (LOW confidence — assumed)
- `/api/kg/search` wire contract — consumer-defined; marked [ASSUMED] where noted

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from live node_modules; no new packages
- Architecture: HIGH — all integration points verified from live source code
- d3-force cluster pattern: HIGH — `d3Force`/`d3ReheatSimulation` confirmed in .d.ts; `forceX`/`forceY`/`forceCollide` confirmed via node execution
- Phase 85 reuse: HIGH — `buildFocusUrl`, `useFocusParam`, `decodeFromParam` all verified from live source with exact signatures
- API wire contract: MEDIUM — consumer shape is planner discretion; Ástríðr emitter doesn't exist yet
- Pitfalls: HIGH — all derived from inspecting the live codebase (vault node community:null, simulation cooling, etc.)

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable stack; d3-force-3d API is stable)
