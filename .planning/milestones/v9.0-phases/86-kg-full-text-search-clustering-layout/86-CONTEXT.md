# Phase 86: KG Full-Text Search + Clustering Layout - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **KG-08 + KG-09**, CodePulse-side:

1. **KG-08 — Full-text KG search.** Operators search across KG **fact text/values and relationship labels** (not just entity name), via a **net-new Ástríðr `/api/kg/search` endpoint**. Surfaced as a **5th "Search" lens** in the KG Explorer (locked in `86-UI-SPEC.md`), with a scrollable **results list panel** (subject · predicate · matched snippet); clicking a result focuses that entity in the graph. Results must be **distinct** from the existing entity-name search (SC#1).
2. **KG-09 — Community-cluster layout.** Graphs whose nodes carry a `community` field render with co-community nodes **visually clustered** — both **color-coded halos** *and* **d3-force spatial grouping** (Q3-C, locked in UI-SPEC), using a **separate ≤8-slot community palette** (`community % 8`) distinct from entity-type colors. Graphs **without** `community` keep the existing force-directed layout — **no regression** (SC#4).

**This phase is the consumer.** Two Ástríðr-side deltas are dependencies, not built here:
- `/api/kg/search` (net-new HTTP endpoint) — **gated, graceful-degrade** (D-01).
- `community` on `/api/kg/overview` entities — **does not exist yet**; the KG graph gets clustering automatically once it does (D-10).

**Out of scope (do NOT build here):**
- The Ástríðr `/api/kg/search` endpoint itself, and adding `community` to the KG read API — **astridr-repo work** (cross-repo SEED candidates; see Deferred).
- Saved/named/shareable views + temporal diff — **Phase 87** (KG-10/KG-11).
- Editing/adjudicating KG triples — read-only (REQUIREMENTS § Out of Scope).
- Mirroring interactive KG data into Convex — the search path is fetch-on-demand, like the existing KG lenses.
- Re-specifying the visual/interaction contract — **owned by `86-UI-SPEC.md`** (results panel, Search lens, color+spatial encoding, auto-hide legend). This CONTEXT covers backend wiring only.

</domain>

<decisions>
## Implementation Decisions

HOW-only decisions. KG-08/KG-09 + the four ROADMAP success criteria stay the scope anchors. The four UI/interaction decisions (results-list panel, 5th Search lens, color+spatial encoding, auto-hide legend) are **already locked in `86-UI-SPEC.md`** — not repeated here.

### Cross-repo endpoint gating (SC#2)
- **D-01: Graceful-degrade behind a gate.** Add a `fetchSearch()` fetcher to `src/lib/kgApi.ts` following the existing `kgGet` pattern (Bearer-authed via `authHeaders()`, `AstridrApiError` on non-2xx). `/api/kg/search` **does not exist on Ástríðr yet** (confirmed: no fetcher today, no `search` route in the live `kg_read_api.py` surface). On `404` / `501` / network failure, the Search lens shows **informational** copy ("search not available on this build yet" — UI-SPEC copy element), **not** a hard error, and the existing **entity-name search remains the documented fallback**. The UI ships behind this gate so it **lights up automatically** the moment Ástríðr deploys the endpoint. The planner MUST mark this as a cross-repo task and not block the phase on it.

### Search interaction
- **D-02: Result click → focus entity in the Entity (ego) lens.** Search result rows are facts/relationships (subject · predicate · object). Clicking a row **reuses the Phase 85 focus infrastructure** (`buildFocusUrl` / `useFocusParam`) to center the result's **subject entity** and switch to the **Entity (ego) lens**. This reuses shipped plumbing (Phase 85 explicitly flagged "search-to-focus reuses the same focus mechanism"), gives graph context, and stays consistent with cross-graph navigation. **Rejected:** highlight-in-place only (no ego context, weak reuse); both/highlight+open (extra affordances, more UI).
- **D-03: Search respects the active filter row.** The Search lens **honors the shared entity-type + agent-id filters** and passes them to `/api/kg/search`, so search is scoped consistently with the other lenses (agent scope is meaningful in a multi-agent KG). **Rejected:** always-global (inconsistent with the shared filter row) and global+toggle (most UI for least gain). Note: distinctness from entity-name search (SC#1) comes from **searching fact text + relationship labels**, not from scope.

### Clustering layout
- **D-04: Generic, data-gated cluster renderer.** Build the community layout **inside `ForceGraphCanvas`**, keyed on `node.community` (color halo via `paintNode` + a d3-force cluster force). It **activates wherever community data exists** and falls back to the existing force-directed layout where it doesn't — exactly the UI-SPEC gate `nodes.some(n => n.community != null)`. Code/vault snapshot nodes **already carry `community`** (`convex/schema.ts:1685`; surfaced read-only in `CodeVaultGraph` detail panel today), so clustering ships **real value on the code/vault graph this phase**. The KG graph lights up automatically once Ástríðr adds `community` to `/api/kg/overview` (D-10) — **no hard KG dependency, no second blocker**. **Rejected:** code/vault-only-by-fiat (same renderer, artificially scoped) and pushing the KG community delta into this phase (larger cross-repo scope, blocks on Ástríðr).
- **D-05: Thread `community` through `KgNode`.** `KgNode` (`src/lib/kg-graph.ts`) gains an optional `community?: number | null` field threaded through `toGraphData`. KG overview entities don't supply it yet, so KG nodes resolve to `null` (force-directed) until the API emits it — consistent with D-04's data-gated activation.

### Claude's Discretion (planner/executor)
- Search ergonomics: debounce interval, min query length, result cap/pagination, and exactly which response fields render in a result row (subject/predicate/snippet) — beyond what the UI-SPEC copy fixes.
- The `/api/kg/search` request/response wire shape (the planner defines the consumer's expected contract; Ástríðr's emitter is the source of truth once live — mirror the `kgApi.ts` convention of documenting where the consumer shape may differ from the spec).
- d3-force cluster-force tuning (cluster strength, gravity-well centers, collision) and the exact halo geometry/opacity — within the UI-SPEC's "both color + spatial" + ≤8-palette contract.
- Whether the Search lens shows its own result-driven subgraph or leaves the existing overview canvas in place while the results panel drives focus — one layout fork the UI-SPEC flagged for resolution at plan time (results panel vs. graph within `grid-cols-[1fr_320px]`).
- `hops` default for an inbound search→ego jump (1 is a reasonable start, mirroring Phase 85).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / milestone scope (the anchor)
- `.planning/REQUIREMENTS.md` § "Knowledge Graph — Depth (KG)" — **KG-08** (full-text fact/relationship search via `/api/kg/search`) and **KG-09** (clustering/community-detection layout leveraging the `community` field in the snapshot payload).
- `.planning/ROADMAP.md` § "Phase 86: KG Full-Text Search + Clustering Layout" — Goal + the four success criteria (SC#1 distinct-from-entity-name, SC#2 endpoint-backed + cross-repo gated, SC#3 community-clustered render, SC#4 no-regression fallback).
- `.planning/REQUIREMENTS.md` § "Out of Scope" — read-only KG, fetch-on-demand interactive path, building the Ástríðr KG read API is astridr-repo work.

### The locked design contract (read FIRST for anything visual)
- `.planning/phases/86-kg-full-text-search-clustering-layout/86-UI-SPEC.md` — **PRIMARY UI contract.** Locks: results-list panel (`KGSearchResults`, new), 5th "Search" lens, color halos + d3-force spatial clustering with a separate ≤8 community palette, auto-hide community legend, all copy elements, and the cross-repo graceful-degradation mandate. Do NOT re-derive visual decisions.
- `.planning/phases/071-unified-design-system/UI-SPEC.md` — the inherited design-token layer (Matrix-Emerald; emerald `#10b981`, zinc neutrals, Geist/JetBrains Mono, `0.5rem` radius, 8-pt spacing, Lucide). Referenced by the Phase 86 UI-SPEC, not re-specified.

### Phase 85 (the focus infra this phase reuses)
- `.planning/phases/85-cross-graph-navigation/85-CONTEXT.md` — **D-01/D-02** (the `useFocusParam` + `buildFocusUrl` URL-driven focus mechanism this phase's result-click reuses, D-02 here), **D-04** (normalized-exact / precision-over-recall bias — applies to search result→node resolution). Phase 85 deferred list explicitly names "search-to-focus reuses the same focus mechanism" = this phase.

### KG consumer surfaces (read before wiring search + clustering)
- `src/lib/kgApi.ts` — the Bearer-authed `/api/kg/*` client (`kgGet`, `AstridrApiError`). Add `fetchSearch()` here (D-01). Header comment documents the live emitter (`astridr/channels/kg_read_api.py`) and where consumer shapes differ from the spec — mirror that for `/search`.
- `src/components/kg/KGControls.tsx` — the `LENSES` array (4 lenses → add "Search"); the entity-name search input (entity lens only) is the fallback (D-01) and the SC#1 contrast point; the shared filter row (`entityType` / `agentId`) is what Search must honor (D-03).
- `src/hooks/useKnowledgeGraph.ts` — `KgLens` / `KgFilters` types, `selectNode` / `focusSet`, name-driven entity lens — the inbound search→ego focus target (D-02).
- `src/lib/kg-graph.ts` — `KgNode` + `toGraphData` normalizer; add `community?: number | null` (D-05); `entityTypeColor` is the *entity-type* palette (the community palette must be separate).
- `src/pages/KnowledgeGraph.tsx` — KG Explorer page composition; hosts the new Search lens + results panel within the existing grid.

### Clustering renderer + community data
- `src/components/graph/ForceGraphCanvas.tsx` — generic force-graph wrapper; `paintNode` (halo color) + d3-force (spatial cluster force) is where D-04 lands; `ForceGraphHandle.centerAt`/`zoomToFit` for inbound focus.
- `convex/schema.ts:1678-1685` — `community: v.optional(v.float64())` on snapshot nodes (vault nodes emit `community: null`). This is the **only** live source of community data this phase (code/vault graph).
- `src/components/graph/CodeVaultGraph.tsx` — code/vault hero already reads `selectedNode.community` (read-only display, ~L562); this graph is where clustering visibly ships first.

### API integration rule
- `CLAUDE.md` § "Ástríðr API Integration" — all `/api/*` calls MUST send `Authorization: Bearer` via `authHeaders()` from `src/lib/astridrApi.ts`. Applies to the new `fetchSearch()`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`kgApi.ts` `kgGet` + `AstridrApiError`** — the new `/api/kg/search` fetcher slots straight into this pattern; `AstridrApiError(status, detail)` is exactly what the graceful-degrade gate (D-01) keys on (`404`/`501` → info copy).
- **Phase 85 focus infra (`buildFocusUrl` / `useFocusParam`)** — result-click → center entity reuses it wholesale (D-02); no new deep-link plumbing.
- **`ForceGraphCanvas` `paintNode` + d3-force** — the cluster renderer (color halo + spatial grouping) is a `ForceGraphCanvas` enhancement, applied generically (D-04) — both the KG graph and the code/vault hero render through compatible force-graph wrappers.
- **`KGControls` lens pattern** — adding the 5th "Search" lens is an additive change to the `LENSES` array + a lens-gated filter block; the entity-name input stays as the documented fallback.

### Established Patterns
- **Fetch-on-demand, Bearer-authed** — interactive KG data is fetched live from Ástríðr (not mirrored to Convex); the always-on summary cards read Convex. Search follows the interactive path.
- **Data-gated rendering** — UI features degrade silently when their backing data is absent (`truncated` flags, optional `sourceEventId`, `community: null` vault nodes). The clustering gate (`nodes.some(n => n.community != null)`) and the search gate (endpoint 404 → fallback) both follow this established convention → satisfies SC#4 no-regression.
- **Separate palettes** — `entityTypeColor` already owns the entity-type palette; the community palette is a distinct ≤8-slot set (UI-SPEC) so the two encodings never collide.
- **Precision bias (Phase 85 D-04)** — search result → node resolution should prefer a missing/ambiguous result over a wrong jump, consistent with the zero-false-positive review rule.

### Integration Points
- `src/lib/kgApi.ts` — new `fetchSearch()` (+ wire types) and its error-gated consumer.
- `src/lib/kg-graph.ts` — `KgNode.community` threaded through `toGraphData` (D-05).
- `src/components/kg/KGControls.tsx` + `src/pages/KnowledgeGraph.tsx` — Search lens + results panel (`KGSearchResults`, new per UI-SPEC).
- `src/components/graph/ForceGraphCanvas.tsx` — the cluster layout + halo paint; consumed by both the KG graph and `CodeVaultGraph`.
- Phase 85 focus helpers (`src/lib/` + `src/hooks/`) — result-click focus target.

</code_context>

<specifics>
## Specific Ideas

- **Ship dark; light up on deploy.** The whole Search lens ships behind the graceful-degrade gate so that the day Ástríðr deploys `/api/kg/search`, search works with zero CodePulse change. The "not available on this build yet" state is a real, designed state — not a stack trace.
- **Distinctness is about *what* is searched, not scope** (SC#1): full-text search hits fact text + relationship labels; entity-name search hits names. Both can honor the same filters (D-03) and still be visibly distinct.
- **Clustering's first real home is the code/vault graph**, because that's the only surface with live `community` data today — demo/verify there. The KG graph is correctly wired but renders force-directed until Ástríðr emits community.
- **Verification bar** (per global rules): "done" = in the running app on real Convex/Ástríðr data —
  1. **Search:** with `/api/kg/search` live, typing a term in the Search lens returns fact-text/relationship matches **distinct** from entity-name results; clicking a result centers that entity in the ego lens. With the endpoint absent (today), the lens shows the designed "not available" state and the entity-name fallback still works — **observed, not assumed**.
  2. **Clustering:** the code/vault graph renders co-community nodes spatially grouped + halo-colored with the community legend visible; a graph with no `community` renders force-directed with the legend **absent** and no layout regression — **observed** on real data.

</specifics>

<deferred>
## Deferred Ideas

- **Ástríðr `/api/kg/search` endpoint** — net-new astridr-repo HTTP surface (full-text over fact text + relationship labels). This phase is the gated consumer; the producer is a cross-repo dependency (likely a SEED for astridr-repo, mirroring how Phase 74 consumed the Phase 135 KG read API).
- **`community` on the Ástríðr KG read API (`/api/kg/overview` entities)** — astridr-repo delta. Once it lands, the KG graph clusters automatically via D-04/D-05; no further CodePulse work. Deferred out of this phase to avoid a second cross-repo blocker.
- **Saved/named/shareable graph views + temporal diff** — Phase 87 (KG-10/KG-11); builds on the same focus-param URL-state foundation.

None of these are losses — all map to already-planned later phases or explicit cross-repo dependencies.

</deferred>

---

*Phase: 86-kg-full-text-search-clustering-layout*
*Context gathered: 2026-06-22*
