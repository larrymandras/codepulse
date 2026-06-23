# Phase 87: Saved Views + Temporal Diff — Research

**Researched:** 2026-06-23
**Domain:** React / Convex / Canvas — KG view persistence, URL-based sharing, client-side diff, animation loop
**Confidence:** HIGH (all claims sourced from live codebase read in this session)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Storage is a new Convex `savedKgViews` table. idb-only was rejected.
- **D-02:** Global-to-deployment scope — no owner/user field. Do NOT add per-user scoping.
- **D-03:** Share links use a short opaque random `shareToken` stored alongside the view; URL shape is `?view=<token>`.
- **D-04:** On page load, `KnowledgeGraph.tsx` reads `?view`, resolves by `shareToken`, applies one-shot using the appliedFocusRef guard pattern. Token absent/expired → silent fallback (no error banner).
- **D-05:** A saved view captures: lens + filters (without searchQuery) + focus (entityName) + hops. The UI-SPEC's `useSavedViews` shape dropped focus and hops — CORRECTION: schema and save/load round-trip MUST include them.
- **D-06:** Exclude `searchQuery` from saved views.
- **D-07:** Animation frames are client-synthesized over a user-picked range + interval. ZERO cross-repo dependency. No `fetchSnapshotDates()` / no new Ástríðr endpoint. `useKgAnimation` derives frames from `{rangeStart, rangeEnd, interval}`. `KGAnimateControls` needs a start/end range picker + interval selector feeding the scrubber.
- **D-08:** Graceful-degrade, no hard block. If an as-of fetch for a given frame or diff date fails (404/network), show inline error copy and keep Point + Diff working.
- **D-09:** Frame cache + prefetch: cache by `asOf` key, prefetch ~2 frames ahead, LRU-cap at 20 entries.
- **D-10:** A node is "changed" (amber) if its attributes/fact values differ OR its set of incident current edges differs between snapshot A and B.
- **D-11:** Edges are diffed independently — each edge gets its own added/removed/changed state. Independent classification wins.
- **D-12:** Diff is client-side, node-id-based, computed over two `fetchOverview({ asOf })` snapshots. No new backend/Ástríðr endpoint.

### Claude's Discretion

- Animation frame interval/granularity UX: exact interval options and auto-fit logic, within D-07. Sensible default: small granularity select, cap total frames for LRU sanity. Playback speed (0.5×/1×/2×) is separate from frame interval.
- All visual/token/copy/layout decisions locked by `87-UI-SPEC.md` except where D-05 and D-07 correct it.

### Deferred Ideas (OUT OF SCOPE)

- Real Ástríðr-provided KG snapshot dates (`/api/kg/snapshots` endpoint).
- Per-user view ownership / sharing permissions.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KG-10 | Operator saves named, reusable graph views (lens + filters + focus + hops) and shares them via a link — beyond the existing last-state idb auto-persist | Convex `savedKgViews` table + `useSavedViews` hook + `?view=<shareToken>` URL hydration via appliedFocusRef pattern |
| KG-11 | Operator diffs the KG between two as-of points and/or animates its evolution over time, building on the existing single-point as-of "temporal" lens | `fetchOverview({ asOf })` already supports point-in-time queries; diff is client-side set comparison over `KgNode.id`; animation is client-synthesized frame sequence with LRU cache |

</phase_requirements>

---

## Summary

Phase 87 extends the existing KG Explorer page (`src/pages/KnowledgeGraph.tsx`) and its control bar (`src/components/kg/KGControls.tsx`) — no new route, no new page. Both features build entirely on the existing `fetchOverview({ asOf })` fetcher in `src/lib/kgApi.ts` (line 198), which already accepts a nullable `asOf` ISO timestamp. The Convex + React infrastructure for adding a new domain table, hook, and mutation is well-established and consistent across ~90 prior Convex domain files.

**KG-10 (Saved Views)** adds a `savedKgViews` Convex table with CRUD mutations and a `useSavedViews` hook, a Views popover in KGControls, and a `?view=<shareToken>` URL hydration path in KnowledgeGraph.tsx that mirrors the existing `?focus` one-shot guard exactly. The view shape captures `{name, lens, filters (minus searchQuery), focus (entityName), hops, shareToken, createdAt}`. Share tokens use `crypto.randomUUID()` — the same utility already used in 8 places across this codebase (`src/pages/Chat.tsx:26`, `src/components/forge/ForgeLaunchModal.tsx:172`, et al.).

**KG-11 (Temporal Diff + Animation)** adds two sub-modes under the existing Temporal lens. Diff computes added/removed/changed node and edge sets by comparing two `fetchOverview({ asOf })` responses client-side — pure set arithmetic over `node.id` and `link.id`. Animation synthesizes an evenly-spaced frame sequence from `{rangeStart, rangeEnd, interval}`, fetching each frame lazily via `fetchOverview({ asOf })` with a 2-frame prefetch and a 20-entry LRU cache. Both paths are CodePulse-side only; no Ástríðr delta required.

**Primary recommendation:** Implement in four sequential plans: (1) `savedKgViews` Convex table + `useSavedViews` hook, (2) KGViewsPopover + KGControls Views/Save buttons + `?view` hydration in KnowledgeGraph.tsx, (3) `useKgDiff` + KGDiffControls + `paintNodeDiff` + diff legend, (4) `useKgAnimation` + KGAnimateControls.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| View persistence (CRUD) | API / Backend (Convex) | — | Must survive sessions and be shareable across sessions — idb cannot share |
| Share token generation | Browser / Client | — | `crypto.randomUUID()` is browser-native; token is stored in Convex alongside the view |
| `?view` URL hydration | Frontend (React) | — | Same-session URL param read-on-mount, mirrors existing `?focus` pattern |
| As-of graph fetching (diff A/B, animation frames) | Browser / Client → Ástríðr API | — | `fetchOverview({ asOf })` is a client-side fetch from the browser to Ástríðr's `/api/kg/overview` |
| Diff computation | Browser / Client | — | Client-side set arithmetic over two already-fetched `KgGraphData` objects (D-12) |
| Animation frame sequencing + LRU cache | Browser / Client | — | Hook-local `Map<string, KgGraphData>` cache ref (D-09) |
| Canvas diff painting | Browser / Client | — | `paintNode` variant passed to ForceGraphCanvas; no server involvement |
| Diff legend overlay | Browser / Client | — | Appended to existing floating legend div in KnowledgeGraph.tsx:379 |

---

## Standard Stack

### Core (no new packages — all already installed)

| Library | Version (installed) | Purpose | Evidence |
|---------|-------------------|---------|----------|
| `convex` | project-wide | `savedKgViews` table + queries/mutations | `convex/schema.ts`, `convex/_generated/api.d.ts` |
| `convex/react` | project-wide | `useQuery` / `useMutation` in `useSavedViews` | `src/hooks/useKgSummary.ts:1`, `src/hooks/useTeamPresets.ts:1` |
| `react` + `react-router-dom` | 19 / v7 | `useSearchParams` for `?view` hydration | `src/pages/KnowledgeGraph.tsx:2` |
| `idb-keyval` | project-wide | Existing idb auto-persist in `useKnowledgeGraph` — NOT used for saved views (D-01) | `src/hooks/useKnowledgeGraph.ts:2` |
| `sonner` | project-wide | Toast notifications (`View "{name}" saved`, `View link copied`) | `src/layouts/DashboardLayout.tsx:12`, `src/hooks/useTeamPresets.ts:3` |
| shadcn/ui | project-wide | `Popover`, `Input`, `Button`, `Slider`, `Select` — all already in `src/components/ui/` | `src/components/ui/popover.tsx`, `src/components/ui/slider.tsx` |

[VERIFIED: live codebase read in this session — all packages confirmed present]

### No New Packages Required

No `npx shadcn add` commands needed. The UI-SPEC Registry Safety section confirms: all required shadcn primitives (`popover`, `input`, `button`, `slider`, `select`, `toast/sonner`) are already installed from Phase 71. No third-party animation, diff, or LRU library is needed — all logic is bespoke TypeScript over existing data types.

**LRU cache:** implement as a `Map<string, KgGraphData>` + insertion-order eviction (JS Maps maintain insertion order, so oldest = `map.keys().next().value`). Zero dependency.

---

## Package Legitimacy Audit

No new packages are installed in this phase. All libraries used are already present in `package.json`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Operator action (Save View / Load View / Share)
       │
       ▼
  KGControls.tsx (Views button + Save button)
       │                          │
       ▼                          ▼
KGViewsPopover              inline Input expand
(list, delete,              (name entry)
 copy-link)                      │
       │                         ▼
       └──────► useSavedViews hook
                  │   useQuery(api.savedKgViews.list)
                  │   useMutation(api.savedKgViews.save)
                  │   useMutation(api.savedKgViews.remove)
                  ▼
            Convex savedKgViews table
                  ▲
                  │  resolve by shareToken
KnowledgeGraph.tsx  ◄── ?view=<token> URL param (page load)
  (appliedViewRef one-shot guard)
       │
       ▼
  setLens() + setFilter() × N
  (same as manual load)

─────────────────────────────────────────────────────
Operator action (Diff or Animate)
       │
       ▼
  KGControls.tsx (Point|Diff|Animate sub-mode toggle)
       │
  ┌────┴─────┐
  │          │
  ▼          ▼
KGDiffControls    KGAnimateControls
(From/To pickers) (range picker + interval + scrubber + play)
  │                    │
  ▼                    ▼
useKgDiff           useKgAnimation
  │                    │
  ▼                    ▼
fetchOverview({asOf:A})   frame sequence [{asOf},...] synthesized
fetchOverview({asOf:B})   fetchOverview({asOf:frame}) per frame
  │                    │    (2-frame prefetch, 20-entry LRU Map)
  ▼                    ▼
client-side diff    current frame KgGraphData
{added,removed,     passed to canvas
 changed} Sets
  │
  ▼
KnowledgeGraph.tsx
  paintNodeDiff() instead of paintNode()
  linkColorDiffFn() instead of linkColorFn()
  diff legend appended to floating overlay (KnowledgeGraph.tsx:379)
```

### Recommended Project Structure — new files only

```
convex/
├── savedKgViews.ts           # queries + mutations for savedKgViews table
src/hooks/
├── useSavedViews.ts          # useQuery(api.savedKgViews.list) + mutations wrapper
├── useKgDiff.ts              # fetches A + B, computes diff sets
├── useKgAnimation.ts         # frame synthesis, LRU cache, play/pause/step
src/components/kg/
├── KGViewsPopover.tsx        # Popover with saved view list + KGViewRow items
├── KGDiffControls.tsx        # From/To date pickers + Compare button
├── KGAnimateControls.tsx     # scrubber + play/pause + speed select
├── KGViewsPopover.test.tsx   # unit: CRUD interactions, share URL, empty state
├── useKgDiff.test.ts         # unit: diff set computation (pure function)
├── useKgAnimation.test.ts    # unit: frame synthesis, LRU eviction
```

Modified files:
- `convex/schema.ts` — add `savedKgViews` table definition
- `src/components/kg/KGControls.tsx` — Views button, Save button, sub-mode toggle
- `src/pages/KnowledgeGraph.tsx` — `?view` hydration, diff paint/legend swap, callbacks

### Pattern 1: Convex domain module + hook wrapper

The project has ~90 Convex domain modules. The canonical pattern is:
1. Export named `query`/`mutation` functions from `convex/domain.ts`
2. Wrap in a single `useDomain` hook in `src/hooks/useDomain.ts` that calls `useQuery(api.domain.fn)` and `useMutation(api.domain.fn)`
3. Return typed view objects (not raw Convex docs)

Reference implementation (closest analogue — multi-item CRUD with toast):

```typescript
// Source: src/hooks/useTeamPresets.ts:27-50 (live code)
export function useTeamPresets() {
  const teams = useQuery(api.teamPresets.list) as TeamPreset[] | undefined;
  const createMutation = useMutation(api.teamPresets.create);
  const removeMutation = useMutation(api.teamPresets.remove);

  const create = async (args: { name: string; ... }) => {
    try {
      const id = await createMutation(args);
      toast.success("Team created");
      return id;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
      throw err;
    }
  };
  // ...
}
```

`useSavedViews` follows this exactly: `useQuery(api.savedKgViews.list)`, mutations for save/remove, `toast.success` / `toast.error`, and a `buildShareUrl(shareToken)` helper that returns `${window.location.origin}/knowledge-graph?view=${shareToken}`.

### Pattern 2: One-shot URL param hydration guard

The `?view=<shareToken>` load path mirrors the existing `?focus` guard at `KnowledgeGraph.tsx:98-124` exactly. The same three conditions apply:

```typescript
// Source: KnowledgeGraph.tsx:99-124 (live code — mirror for ?view)
const appliedViewRef = useRef(false);

useEffect(() => {
  if (!viewToken) return;           // no param
  if (appliedViewRef.current) return; // already applied
  if (!hydrated) return;            // wait for idb hydration

  appliedViewRef.current = true;
  // resolve view by shareToken → apply setLens + setFilter
}, [viewToken, hydrated, /* stable callbacks */]);
```

Key detail: the `?view` resolution requires a Convex query result (not just idb hydration). The guard should also wait for `views !== undefined` (Convex loading) before applying. The `hydrated` flag (from idb) and `views !== undefined` (from Convex) are both needed.

### Pattern 3: ShareToken generation

```typescript
// Source: src/pages/Chat.tsx:26 (live pattern — crypto.randomUUID is standard)
// In convex/savedKgViews.ts save mutation:
const shareToken = crypto.randomUUID(); // Convex runtime has crypto global
```

Convex mutation handlers run in the Convex runtime (not Node.js/browser), but `crypto.randomUUID()` is available in the Convex runtime environment. [ASSUMED — not explicitly verified for Convex runtime, but `crypto` is a standard Web Crypto API available in modern JS runtimes including Convex's V8 isolates]

Alternative if needed: generate the token client-side before calling the mutation, pass as an arg. This is simpler to verify and avoids the runtime-availability question.

### Pattern 4: Diff computation (client-side set arithmetic)

```typescript
// Pseudocode — no library needed
function computeDiff(graphA: KgGraphData, graphB: KgGraphData): KgDiffSets {
  const idsA = new Set(graphA.nodes.map(n => n.id));
  const idsB = new Set(graphB.nodes.map(n => n.id));

  const added = new Set([...idsB].filter(id => !idsA.has(id)));
  const removed = new Set([...idsA].filter(id => !idsB.has(id)));
  const changed = new Set<string>();

  for (const id of idsB) {
    if (!idsA.has(id)) continue; // already in added
    const nA = graphA.nodes.find(n => n.id === id)!;
    const nB = graphB.nodes.find(n => n.id === id)!;
    // D-10: changed if attributes differ OR incident current-edge set differs
    if (attributesDiffer(nA, nB) || incidentCurrentEdgesDiffer(id, graphA, graphB)) {
      changed.add(id);
    }
  }
  // Edge diff — independent (D-11)
  const edgeDiff = computeEdgeDiff(graphA.links, graphB.links);
  return { added, removed, changed, edgeDiff };
}
```

`attributesDiffer`: compare `node.attributes` array by predicate+value+confidence — a JSON.stringify or shallow field compare works given the data sizes expected.

`incidentCurrentEdgesDiffer`: build a `Set<linkId>` of current (not superseded) edges for the node in each snapshot, compare set equality. This is the "relationship gain/loss" detection from D-10.

Edge diff: compare `link.id` sets between graphA.links and graphB.links. An edge with the same `id` in both that has changed `current` or `validTo` state is "changed".

### Pattern 5: LRU cache (Map insertion-order eviction)

```typescript
// In useKgAnimation — no library needed
const cacheRef = useRef<Map<string, KgGraphData>>(new Map());
const MAX_CACHE = 20; // D-09

function cacheSet(key: string, value: KgGraphData) {
  if (cacheRef.current.has(key)) cacheRef.current.delete(key); // re-insert as newest
  cacheRef.current.set(key, value);
  if (cacheRef.current.size > MAX_CACHE) {
    // Evict oldest: Map.keys() is insertion-order
    const oldest = cacheRef.current.keys().next().value;
    cacheRef.current.delete(oldest);
  }
}
```

### Pattern 6: paintNodeDiff canvas function

Replace `paintNode` with `paintNodeDiff` when `temporalSubMode === "diff"`. The diff color table from UI-SPEC:

```typescript
// Source: 87-UI-SPEC.md Color section
const DIFF_COLORS = {
  added:     { fill: "#22c55e", glow: "#22c55e", alpha: 1.0 },
  removed:   { fill: "#ef4444", glow: "#ef4444", alpha: 1.0 },
  changed:   { fill: "#eab308", glow: "#eab308", alpha: 1.0 },
  unchanged: { fill: null,      glow: null,      alpha: 0.35 }, // use node.color at 35% alpha
};
// Edge strokes from UI-SPEC:
// added:     rgba(34,197,94,0.55)   solid
// removed:   rgba(239,68,68,0.40)   dashed [4,3]
// changed:   rgba(234,179,8,0.55)   solid
// unchanged: rgba(161,163,170,0.15) solid
```

`paintNodeDiff` accepts an additional `diffState: "added"|"removed"|"changed"|"unchanged"` param. Selection ring and hover behavior unchanged — selected node shows diff color + white fill on hover. The function is a near-copy of `paintNode` (KnowledgeGraph.tsx:212-256) with color logic swapped.

### Anti-Patterns to Avoid

- **Storing searchQuery in savedKgViews:** D-06 explicitly forbids it. The `filters` object stored must strip `searchQuery`.
- **Using `_id` as the share param:** D-03 chose opaque `shareToken` because `_id` exposes internals and isn't revocable.
- **Fetching Ástríðr `/api/kg/snapshots` for animation frames:** D-07 forbids this. The animation range is operator-specified, not server-dictated.
- **Server-side diff:** D-12 is client-side only. No new Convex mutations or Ástríðr endpoints for diff.
- **Blocking the UI on frame fetch failure:** D-08 mandates graceful-degrade per frame — show inline error copy for the failed frame, keep navigation working.
- **Adding `?view` param to the URL on load:** The interaction contract says loading a saved view does NOT update the URL. Only the initial share URL carries `?view`. After hydration, the param should be stripped or ignored (standard SPA pattern: navigate(`/knowledge-graph`) without the param after applying, or just leave it inert — consult interaction contract: "The URL does NOT update" on manual load, suggesting the `?view` on the initial share URL can remain in the address bar without harm since it's a one-shot apply).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover UI for views list | Custom dropdown/modal | shadcn `Popover` (already installed, `src/components/ui/popover.tsx`) | Radix handles focus trap, escape dismiss, portal mounting, ARIA |
| Toast notifications | Custom snackbar | `sonner` `toast.success/error` (already in `DashboardLayout.tsx:12`) | Already wired globally via `<Toaster />` — just call `toast()` |
| LRU cache | npm `lru-cache` package | `Map` + insertion-order eviction (see Pattern 5) | 8 lines of code; no new dependency for a 20-entry cache |
| Diff algorithm | `deep-diff`, `jsondiffpatch` | Client-side set arithmetic over `node.id` / `link.id` (see Pattern 4) | KgGraphData is already normalized; set ops are O(N) and sufficient |
| Share token | `nanoid`, `uuid` package | `crypto.randomUUID()` (browser/Convex standard, used in 8 places already) | Zero new dependency |
| Date range input | custom date picker | `<Input type="date">` (already used in KGControls.tsx:131 for as-of scrubber) | Consistent with existing UI; no new component |
| Animation loop | `requestAnimationFrame` manual loop | `setInterval` / `useEffect` with cleanup | Simpler for 1fps cadence; frame advance is ~1s not 60fps so rAF overhead unwarranted |

**Key insight:** Every building block for this phase already exists in the codebase. The value added is new composition and domain logic — not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Race between idb hydration and Convex view resolution on `?view` load

**What goes wrong:** The `?view` hydration effect fires when `hydrated === true` (idb done) but `views` (Convex query result) is still `undefined`. The view is silently dropped because `shareToken` can't be matched.

**Why it happens:** Two async sources — idb (`useKnowledgeGraph` internal) and Convex (`useQuery(api.savedKgViews.list)`) — settle at different times. The existing `?focus` guard only waits for `hydrated` because focus resolution uses the already-fetched graph nodes, not a separate Convex query.

**How to avoid:** Add `views !== undefined` as a third guard condition in the `appliedViewRef` effect, alongside `!hydrated`. The effect will re-run when Convex resolves.

**Warning signs:** In development, the URL carries `?view=<token>` but the lens stays on Overview — classic "effect fired before data".

### Pitfall 2: Saving `searchQuery` in the view (violates D-06)

**What goes wrong:** The `filters` object in `useKnowledgeGraph` includes `searchQuery`. If the save mutation is called with `filters` spread verbatim, `searchQuery` is persisted and restores a stale full-text query string.

**How to avoid:** Destructure explicitly in the save call: `const { searchQuery: _sq, ...persistable } = filters; saveView(name, lens, persistable, entityName, hops)`. This is the same pattern used by `useKnowledgeGraph.ts:149` for idb persistence.

### Pitfall 3: Diff "unchanged" nodes not dimmed on canvas

**What goes wrong:** `paintNodeDiff` is called for every node but the `diffState` for unchanged nodes defaults to the standard paint path (full alpha). The visual distinction (0.35 alpha for unchanged) is critical for reading the diff.

**How to avoid:** The diff sets `{added, removed, changed}` cover all non-unchanged nodes. The `paintNodeDiff` function must explicitly handle the `undefined`/absent case as `"unchanged"` with `ctx.globalAlpha = 0.35`. Mirror the existing dimming logic in `paintNode` (KnowledgeGraph.tsx:222: `ctx.globalAlpha = opts.dimmed ? 0.18 : 1`).

### Pitfall 4: Animation frame fetch storms when scrubbing

**What goes wrong:** The operator drags the scrubber rapidly across 20 frames. Each position change triggers a `fetchOverview({ asOf })` call. Without cache-check-before-fetch, all 20 fire concurrently and overwhelm Ástríðr's API.

**How to avoid:** The LRU cache (D-09) must be checked before issuing any fetch. The fetch effect in `useKgAnimation` must pattern-match: `if (cache.has(frameKey)) { setCurrentGraph(cache.get(frameKey)); return; }`. The monotonic request token pattern (already used in `useKnowledgeGraph.ts:116`) should be applied to drop stale in-flight fetches when the frame changes faster than they resolve.

### Pitfall 5: `?view` param composed with `?focus` creates double-hydration conflict

**What goes wrong:** A share URL is `/knowledge-graph?view=<token>&focus=<entity>`. Both guards fire. The `?focus` guard applies an entity lens; the `?view` guard applies a different lens. Last-write wins (unpredictable).

**How to avoid:** The `?view` param takes priority. If both are present, apply the view first (which sets lens+filters+focus+hops from the saved view) and suppress the `?focus` guard. Practically: set `appliedFocusRef.current = true` inside the view-hydration effect when a view is successfully applied, so the focus guard sees "already applied" and no-ops.

### Pitfall 6: Edge diff using link `id` — ID stability across snapshots

**What goes wrong:** If `link.id` is a triple UUID that stays stable across re-fetches of the same KG, edge diffing by ID works perfectly. If IDs are regenerated per-fetch (e.g., a random UUID assigned at serialization time), the diff will show every edge as added+removed with zero "changed" or "unchanged".

**What we know:** `KgLink.id` maps to `KgTriple.id` which is the triple's database ID (`id: string` in `src/lib/kgApi.ts:49`). These are Ástríðr's database primary keys — stable across fetches for the same triple.

**Confidence:** MEDIUM — verified that `id` exists on `KgTriple` and flows through to `KgLink` (`kg-graph.ts:308`), but whether Ástríðr's Python API serializes the same stable DB id vs. a synthetic id is not confirmed from this codebase. If IDs are unstable, edge diff must fall back to `(source, target, predicate)` composite key.

**Warning signs:** Diff mode shows all edges as added/removed even when nodes are unchanged.

---

## Code Examples

### Convex savedKgViews table schema addition

```typescript
// Add to convex/schema.ts after kgSummary table
savedKgViews: defineTable({
  name: v.string(),
  lens: v.string(),                    // KgLens value
  filters: v.object({                  // KgFilters minus searchQuery
    entityType: v.union(v.string(), v.null()),
    predicate:  v.union(v.string(), v.null()),
    agentId:    v.union(v.string(), v.null()),
    entityName: v.string(),
    hops:       v.float64(),
    asOf:       v.union(v.string(), v.null()),
    limit:      v.float64(),
  }),
  focus: v.string(),                   // entityName for Entity lens (D-05)
  hops:  v.float64(),                  // hop depth (D-05)
  shareToken: v.string(),              // opaque random UUID (D-03)
  createdAt: v.float64(),
})
  .index("by_shareToken", ["shareToken"])
  .index("by_createdAt", ["createdAt"]),
```

Note: `focus` and `hops` are stored at the top level (redundant with `filters.entityName` / `filters.hops`) for query convenience. Alternatively, they live only in `filters` and the top-level fields are omitted. Either is valid — the planner should pick one and be consistent in save/load.

### Convex savedKgViews mutation (save)

```typescript
// convex/savedKgViews.ts
export const save = mutation({
  args: {
    name:       v.string(),
    lens:       v.string(),
    filters:    v.any(),           // KgFilters minus searchQuery
    shareToken: v.string(),        // generated client-side (see Pitfall 3 alt)
    createdAt:  v.float64(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("savedKgViews", args);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("savedKgViews")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();
  },
});

export const remove = mutation({
  args: { id: v.id("savedKgViews") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const getByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.query("savedKgViews")
      .withIndex("by_shareToken", q => q.eq("shareToken", args.shareToken))
      .first();
  },
});
```

### ?view hydration effect in KnowledgeGraph.tsx

```typescript
// Mirror of the ?focus guard at KnowledgeGraph.tsx:107-124
const viewToken = searchParams.get("view");
const appliedViewRef = useRef(false);

useEffect(() => {
  if (!viewToken) return;
  if (appliedViewRef.current) return;
  if (!hydrated) return;           // wait for idb
  if (views === undefined) return; // wait for Convex

  const view = views.find(v => v.shareToken === viewToken);
  if (!view) return;               // silent fallback (D-04)

  appliedViewRef.current = true;
  appliedFocusRef.current = true;  // suppress ?focus guard (Pitfall 5)

  setLens(view.lens as KgLens);
  setFilter("entityName", view.filters.entityName ?? "");
  setFilter("hops",       view.filters.hops ?? 1);
  setFilter("asOf",       view.filters.asOf ?? null);
  setFilter("entityType", view.filters.entityType);
  setFilter("predicate",  view.filters.predicate);
  setFilter("agentId",    view.filters.agentId);
  setFilter("limit",      view.filters.limit ?? 100);
}, [viewToken, hydrated, views, setLens, setFilter]);
```

### useKgDiff hook skeleton

```typescript
// src/hooks/useKgDiff.ts
export function useKgDiff(dateA: string | null, dateB: string | null) {
  const [graphA, setGraphA] = useState<KgGraphData | null>(null);
  const [graphB, setGraphB] = useState<KgGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compare = useCallback(async () => {
    if (!dateA || !dateB) return;
    setLoading(true); setError(null);
    try {
      const [respA, respB] = await Promise.all([
        fetchOverview({ asOf: dateA }),
        fetchOverview({ asOf: dateB }),
      ]);
      setGraphA(toGraphData(normalizeOverview(respA)));
      setGraphB(toGraphData(normalizeOverview(respB)));
    } catch (e) {
      // D-08 graceful-degrade: show inline error, don't block
      setError(e instanceof AstridrApiError
        ? `Could not load snapshot for ${e.status === 404 ? dateA + " or " + dateB : "one of these dates"}.`
        : "Could not reach Ástríðr.");
    } finally { setLoading(false); }
  }, [dateA, dateB]);

  const diff = useMemo(() =>
    graphA && graphB ? computeDiff(graphA, graphB) : null,
    [graphA, graphB]
  );

  return { diff, graphB, loading, error, compare };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| idb-only last-state auto-persist | idb for last-state + Convex `savedKgViews` for named persistent views | Phase 87 (this phase) | Named views survive idb clears; shareable cross-session |
| Single-point temporal lens (as-of scrubber) | Single-point + Diff + Animate sub-modes under the same Temporal lens | Phase 87 (this phase) | No regression on existing KG-04 behavior |
| `fetchOverview` as a point-in-time query | `fetchOverview` called N times in parallel (diff) or sequentially (animation) | Phase 87 (this phase) | Same fetcher, new orchestration patterns |

**Deprecated/outdated in this codebase:**
- The UI-SPEC's `useSavedViews` shape `{id, name, lens, filters}` dropping focus and hops — corrected by D-05. Do not implement the UI-SPEC shape verbatim.
- The UI-SPEC's `fetchSnapshotDates()` / Ástríðr `/api/kg/snapshots` animation source — corrected by D-07. Do not implement.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `crypto.randomUUID()` is available in the Convex mutation runtime for token generation | Standard Stack / Pattern 3 | Low risk — fallback is to generate the UUID client-side and pass as a mutation arg (explicit alternative documented) |
| A2 | `KgTriple.id` / `KgLink.id` is stable (same DB primary key) across repeated `fetchOverview` calls for the same data | Pitfall 6 | If wrong, edge diff shows false-positive add/remove storm; mitigation is composite key `(source, target, predicate)` fallback |

---

## Open Questions

1. **`crypto.randomUUID()` in Convex mutation handlers**
   - What we know: Used in browser context in 8 places in this codebase. Convex runs V8 isolates with a Web Crypto API available.
   - What's unclear: Whether the specific Convex runtime version in use exposes `crypto.randomUUID` in mutation handlers without import.
   - Recommendation: Generate the share token client-side in `useSavedViews.saveView()` before calling the mutation, and pass it as an arg. This is simpler, testable, and avoids the runtime question entirely.

2. **`KgLink.id` stability across fetches**
   - What we know: `KgTriple.id` is a `string` from Ástríðr's `/api/kg/overview` response (`kgApi.ts:49`); the live `_serialize_triple` in Ástríðr sends the triple's DB primary key.
   - What's unclear: Whether all triple endpoints consistently include stable IDs or ever generate synthetic IDs at serialization time.
   - Recommendation: Implement edge diff using `link.id` as primary key. Add a fallback path using `(source, target, predicate)` composite key when `link.id` is absent/empty. Flag for UAT verification.

3. **`?view` param retention after hydration**
   - What we know: The interaction contract says "URL does NOT update" on manual view load. On share-link load, the `?view` param is in the URL.
   - What's unclear: Whether to strip `?view` from the URL after hydration (clean URL) or leave it in the address bar (simpler implementation).
   - Recommendation: Leave the `?view` param in the address bar after hydration — stripping requires a `navigate` call that could interfere with browser history. The one-shot guard prevents re-application, so the stale param is harmless.

---

## Environment Availability

Step 2.6: SKIPPED — this phase installs no new tools, services, or CLIs. All dependencies are the already-running Convex dev backend (`npm run dev:backend`) and the existing Ástríðr connection (for `fetchOverview` calls in diff/animation). Both are verified operational from prior phases.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` → treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (project-wide) |
| Config file | `vite.config.ts` (Vitest inline config) |
| Quick run command | `npx vitest run src/components/kg/ src/hooks/useKgDiff.ts src/hooks/useKgAnimation.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KG-10-a | Save a view (name + lens + filters + focus + hops) → appears in list | unit | `npx vitest run src/components/kg/KGViewsPopover.test.tsx` | ❌ Wave 0 |
| KG-10-b | Load a saved view → setLens + setFilter applied | unit | `npx vitest run src/components/kg/KGViewsPopover.test.tsx` | ❌ Wave 0 |
| KG-10-c | Share URL carries `?view=<token>`, resolves view on load | unit | `npx vitest run src/hooks/useSavedViews.test.ts` | ❌ Wave 0 |
| KG-10-d | Delete view → removed from list | unit | `npx vitest run src/components/kg/KGViewsPopover.test.tsx` | ❌ Wave 0 |
| KG-11-a | Diff computation: added/removed/changed sets correct | unit | `npx vitest run src/hooks/useKgDiff.test.ts` | ❌ Wave 0 |
| KG-11-b | `paintNodeDiff` applies correct color per diff state | unit | `npx vitest run src/components/kg/KGControls.test.tsx` | ✅ (extend existing) |
| KG-11-c | Animation frame synthesis (range + interval → frame list) | unit | `npx vitest run src/hooks/useKgAnimation.test.ts` | ❌ Wave 0 |
| KG-11-d | LRU cache evicts beyond 20 entries | unit | `npx vitest run src/hooks/useKgAnimation.test.ts` | ❌ Wave 0 |
| KG-11-e | `useKgDiff` graceful-degrade: 404 → error copy, no throw | unit | `npx vitest run src/hooks/useKgDiff.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/components/kg/ src/hooks/useKgDiff.ts src/hooks/useKgAnimation.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/components/kg/KGViewsPopover.test.tsx` — covers KG-10-a, KG-10-b, KG-10-d
- [ ] `src/hooks/useSavedViews.test.ts` — covers KG-10-c (shareToken, buildShareUrl)
- [ ] `src/hooks/useKgDiff.test.ts` — covers KG-11-a, KG-11-e (pure function + 404 degrade)
- [ ] `src/hooks/useKgAnimation.test.ts` — covers KG-11-c, KG-11-d (frame synthesis, LRU)

Existing test files that will be extended (not created):
- `src/components/kg/KGControls.test.tsx` — extend with sub-mode toggle assertions (KG-11-b)

---

## Security Domain

ASVS enforcement applies. This phase introduces no authentication, no secrets, no encryption, and no server-side user data. The only new user-controlled input is the view name and date pickers.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | No | D-02: global scope, no per-user enforcement needed |
| V5 Input Validation | Yes (view name, shareToken) | View name: max length 100 chars, reject empty (already in UI). shareToken param: validate UUID format before Convex query; malformed token → silent fallback (D-04 already handles absent/expired). |
| V6 Cryptography | No | shareToken is a non-secret opaque ID, not a cryptographic secret |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `?view=` param (XSS probe, SQL injection attempt) | Tampering | Convex query param is validated by the `by_shareToken` index — only exact UUID string match returns a result. Non-matching tokens silently return null → fallback state. No reflected content from the param. |
| Enumeration of all saved views (no auth) | Information Disclosure | Accepted by D-02 design — global scope is intentional. Single-operator deployment; all views are intentionally shared. |
| Overly long view name (storage abuse) | Denial of Service | Add `v.string()` length guard in the Convex mutation: reject names > 100 chars. |

---

## Sources

### Primary (HIGH confidence — live codebase read in this session)

- `src/pages/KnowledgeGraph.tsx` — paintNode (212-256), legend overlay (379-429), ?focus hydration guard (98-124), loading pulse (431-435), error banner (321-330), SectionErrorBoundary (302-310)
- `src/components/kg/KGControls.tsx` — lens tab active style (57-60), Temporal as-of Input (125-156), Slider (98-108), Refresh button position (66-79)
- `src/hooks/useKnowledgeGraph.ts` — KgFilters type (23-36), DEFAULT_FILTERS (38-47), idb PERSIST_KEY + hydration (49-151), setLens/setFilter/refresh patterns
- `src/lib/kgApi.ts` — `fetchOverview` (198-207), `OverviewParams.asOf` (148-152), `EntityParams.asOf` (154-159), `kgGet` helper (168-190), `AstridrApiError` import
- `src/lib/kg-graph.ts` — `KgNode` type (39-55), `KgLink` type (69-85), `KgGraphData` type (87-98), `toGraphData` (251-358), `normalizeOverview` (177-198), `computeFocusSet` (441-449)
- `src/lib/focus-url.ts` — `buildFocusUrl` (46-58), `decodeFromParam` (89-112), same-origin guard pattern
- `src/hooks/useFocusParam.ts` — one-shot `appliedRef` guard pattern (39-71)
- `convex/schema.ts` — `kgSummary` table (1023-1036), `rosterViewPrefs` table (1369-1374), overall schema patterns
- `convex/kg.ts` — `upsertSummary` + `latestSummary` pattern (single-row table)
- `convex/rosterViewPrefs.ts` — simplest Convex domain pattern (save + get, no index)
- `src/hooks/useKgSummary.ts` — `useQuery(api.kg.latestSummary)` hook wrapper pattern
- `src/hooks/useTeamPresets.ts` — `useQuery` + `useMutation` + `toast.success/error` pattern (closest analogue to `useSavedViews`)
- `src/components/ui/popover.tsx` — shadcn Popover API (Radix-backed, already installed)
- `src/layouts/DashboardLayout.tsx:12` — `<Toaster />` from sonner already wired globally

### Secondary (MEDIUM confidence)

- `87-CONTEXT.md` — all locked decisions (D-01 through D-12); canonical for this research
- `87-UI-SPEC.md` — component inventory, layout contract, color table, copy; superseded by CONTEXT.md where they conflict (D-05, D-07)
- Phase 86 graceful-degrade gate pattern (86-03-PLAN.md) — KG-08 AstridrApiError 404/501 handling; directly reused for D-08

### Tertiary (LOW confidence — not directly verified)

- Convex mutation runtime `crypto.randomUUID()` availability — [ASSUMED]; mitigation documented (generate client-side)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages confirmed present in `src/components/ui/`, `package.json` imports, `node_modules`
- Architecture: HIGH — all integration points verified from live source files with line citations
- Pitfalls: HIGH for P1/P2/P3/P4/P5 (derived from reading actual guards and patterns); MEDIUM for P6 (depends on Ástríðr runtime behavior)
- Diff semantics: HIGH — D-10/D-11/D-12 are locked decisions; implementation approach is pure client-side TypeScript

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable domain — Convex/React patterns don't change frequently; re-verify if Convex SDK major version bump)
