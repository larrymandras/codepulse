# Phase 84: Graphs Hub + Code/Vault Render - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the **`/graphs` hub landing + the code/vault graph render** — the CodePulse-side consumer of the Phase 83 receiver. Two requirements:

1. **GH-02** — A `/graphs` route renders Ástríðr's pushed **code (graphify) + vault (Obsidian)** graph from Convex via `getProjectGraph` (Phase 83 read API), reusing `ForceGraphCanvas`, with **truncation explicitly indicated**.
2. **GH-03** — A **unified Graphs hub**: KG Explorer, Tool Galaxy, MCP Inventory, and the new code/vault graph are all reachable from one hub with consistent interactions, replacing the `placeholder:true` "Graphs Hub" nav stub (`src/layouts/DashboardLayout.tsx`).

**Out of scope (later phases, do NOT build here):**
- **Cross-graph navigation** (tool → owning agent → KG entity deep-links) — Phase 85 (GH-04). Node click in this phase shows a detail panel **with no cross-graph links**.
- **Full-text fact search + clustering/community layout** — Phase 86 (KG-08/KG-09). No in-graph search box this phase; `community` field is persisted but NOT used for layout/coloring yet.
- **Saved/named views + temporal diff/animation** — Phase 87 (KG-10/KG-11).
- **Any Ástríðr-side change.** The producer + the Convex receiver (Phase 83) already ship; this phase is pure CodePulse frontend consuming `getProjectGraph` / `listSnapshots`.
- **Rebuilding the 3 existing standalone graph pages** (`/tool-galaxy`, `/mcp-inventory`, `/knowledge-graph`) — they stay as-is; the hub links to them, does not absorb them.

</domain>

<decisions>
## Implementation Decisions

HOW-only decisions from discussion. GH-02 + GH-03 (see canonical refs) stay the scope anchors.

### Hub IA & landing (GH-03)
- **D-01: `/graphs` = hub index with the code/vault graph as inline hero.** The route is a landing page that hosts the net-new code/vault render AND links to the other surfaces. Existing standalone routes (`/tool-galaxy`, `/mcp-inventory`, `/knowledge-graph`, `/capabilities`) are **untouched**. Convert the `placeholder:true` "Graphs Hub" nav entry (`DashboardLayout.tsx` GRAPHS group, ~L156) into a real `to: "/graphs"` route. Follow the established new-page pattern (page in `src/pages/` → `<Route>` in `App.tsx` → nav entry already exists, flip placeholder). Mirrors the recent HivePage composition.
- **D-02: Live summary tiles for the other three surfaces.** Each tile = icon + title + a **live metric** pulled from the existing hook (Tool Galaxy → tool count + orphan count via `useToolGalaxy`; MCP Inventory → server count + error count via `useMcpHealth`; KG Explorer → entities/triples via `useKgSummary`) + click-through to its route. Not plain nav cards, not mini-graph previews (too expensive on the landing).
- **D-03: Layout = compact summary-tile row on top, large full-width code/vault graph below, with an expand-to-fullscreen affordance on the canvas.** No separate `/graphs/code-vault` route — the hero is the full graph, expandable for dense exploration.

### Code/vault graph encoding (GH-02 render)
- **D-04: Primary node color encoding = by source (code vs vault).** The graphify (`graphify:<repo>:`) vs vault (`vault:`) split is the headline distinction. `type` and `community` are NOT the primary encoding this phase (community-based coloring/layout is Phase 86).
- **D-05: Dual "Matrix" palette.** Emerald family (`#10b981`, the theme accent / `ForceGraphCanvas` DEFAULT_COLOR) for **code**; a contrasting accent (e.g. violet/cyan — exact hue at plan/build time) for **vault**. Two clearly distinct families with a legend.
- **D-06: Source filter = Code / Vault / Both toggle chips, client-side (no reload).** Follows the GAL-04 precedent (client-side filtering of bounded graph data). The payload from `getProjectGraph` is already bounded, so filtering is pure client-side.

### Truncation & freshness (GH-02 explicit requirement + Phase 83 D-05 carryover)
- **D-07: Truncation indicator = summary line + per-source chips.** A header "X of Y nodes" (total), plus one chip per source (each graphify repo + vault) showing its emitted/total counts with a **"truncated" badge** when that source's `sources[].truncated` is set. Reads the authoritative producer `sources[]` (Phase 83 D-05).
- **D-08: Integrity signal surfaced only on divergence.** When the receiver's `storedNodeCount` / `storedLinkCount` is **less than** the producer-emitted counts (dangling links dropped), show a subtle warning (e.g. "N links dropped as dangling"). Stay silent when they match — it's a data-quality signal, not normal-state info.
- **D-09: Freshness = relative time + stale badge.** Show "Updated 6h ago" from `generatedAt`; if older than **~36h** (a missed nightly cron), show an amber **"stale"** badge. Threshold tunable at plan time.

### Interactions & states
- **D-10: Node click = side detail panel.** Clicking a node opens a side panel with id / label / type / source / community + a list of its **direct neighbors**. Mirrors the KG Explorer detail-panel pattern. **No cross-graph deep-links** (that is Phase 85 / GH-04).
- **D-11: Hover tooltip = label + type + source.** Via `ForceGraphCanvas` `labelFn`. (Not label-only; not the heavier neighbor-count/community tooltip.)
- **D-12: Empty/null state = explainer + diagnostic.** When `getProjectGraph` returns `null` (graceful-skip; no snapshot ingested yet), the hero shows "No graph snapshot received yet" + names what produces it (Ástríðr's **nightly `graph_snapshot` cron**) so the operator reads it as a pipeline state, not a bug. The **summary tiles still render** (they use their own hooks, independent of the snapshot).

### Claude's Discretion
- **Loading state:** skeleton/spinner for the hero while `getProjectGraph` loads; tiles load independently via their own hooks, each wrapped in `SectionErrorBoundary` (established per-widget pattern). Not asked — standard practice.
- Exact contrasting vault hue (D-05), the precise stale threshold (D-09, ~36h default), tile metric phrasing, and the detail-panel field ordering.
- The `useProjectGraph` hook shape (thin wrapper over `useQuery(api.graphSnapshots.getProjectGraph)` returning `null` during load/empty), file naming, and whether to also wrap `listSnapshots` (likely unused this phase — single snapshot).
- Whether the hero canvas reuses `ObsidianGraph` directly or composes `ForceGraphCanvas` fresh with code/vault `colorFn`/`labelFn`/`onNodeClick` — pick whichever keeps the dual-palette + detail-panel cleanest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / milestone scope (the anchor)
- `.planning/REQUIREMENTS.md` § "Graph Hub (GH)" — **GH-02** (`/graphs` renders code+vault from Convex via `useQuery`, reusing `ForceGraphCanvas`, truncation indicated) and **GH-03** (unified hub reachable from one place, replaces the `placeholder:true` stub) full definitions.
- `.planning/PROJECT.md` § "Current Milestone: v8.0" — why CodePulse is only the consumer (producer + receiver already ship).
- `.planning/STATE.md` § "Milestone v8.0 Roadmap" — sequencing; Phase 84 consumes Phase 83's read API.

### Phase 83 read API (the data contract this phase consumes)
- `convex/graphSnapshots.ts` — **`getProjectGraph({snapshotId?})`** (~L236) returns `{ snapshotId, sources[], nodeCount, linkCount, storedNodeCount, storedLinkCount, generatedAt, nodes[{id,label,type,community,source}], links[{source,target,relation}] }` or **`null`** before any ingest (graceful-skip). Default `snapshotId = "astridr-project-graph"`. **`listSnapshots()`** (~L288) enumerates snapshot metadata.
- `.planning/phases/83-graph-snapshot-receiver/83-CONTEXT.md` — full Phase 83 decisions; D-04 (read API shape), D-05 (`sources[]` verbatim is authoritative "showing X of Y"; `storedNodeCount` is the integrity cross-check) directly inform D-07/D-08 here. Producer payload shape (node ids pre-namespaced `graphify:<repo>:` / `vault:` — do NOT rewrite).

### CodePulse render + page patterns to mirror
- `src/components/graph/ForceGraphCanvas.tsx` — generic callback-driven force-graph wrapper (Phase 74). Props: `data:{nodes,links}`, `colorFn`, `labelFn`, `paintNode`, `linkColorFn/WidthFn/LineDashFn`, `focusSet`, `onNodeClick`, `onNodeHover`, `onBackgroundClick`, `className`, `backdrop`. `ForceGraphHandle` exposes `centerAt`/`zoom`/`zoomToFit`. `DEFAULT_COLOR = "#10b981"`.
- `src/components/ObsidianGraph.tsx` — renders vault graph through `ForceGraphCanvas`; reference for the vault palette + how a domain wraps the canvas.
- `src/pages/KnowledgeGraph.tsx` — the detail-panel + hover + `ForceGraphCanvas` integration pattern to mirror for D-10/D-11.
- `src/pages/HivePage.tsx` — recent new-page composition exemplar (page → route → nav).
- `src/layouts/DashboardLayout.tsx` — GRAPHS nav group (~L154-162); flip the `placeholder:true` "Graphs Hub" entry (~L156) to `to: "/graphs"`. Note `navItems` (~L204) auto-excludes placeholders, so the real route auto-registers for CommandPalette.
- `src/App.tsx` — graph routes (~L119-123, lazy-loaded with Suspense); add the `/graphs` `<Route>` here.

### Existing summary hooks for the tiles (D-02)
- `src/hooks/useToolGalaxy.ts`, `src/hooks/useMcpHealth.ts`, `src/hooks/useKgSummary.ts` — live-count sources for the three summary tiles.

### Precedent for client-side filtering (D-06)
- Tool Galaxy (`src/pages/ToolGalaxy.tsx`) — GAL-04 client-side agent/MCP filtering with no reload; the model for the Code/Vault/Both chips.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ForceGraphCanvas`** (`src/components/graph/ForceGraphCanvas.tsx`): the entire render. `getProjectGraph`'s `{nodes,links}` is already canvas-shaped. Domain encoding (dual palette, source filter, detail-panel click) is all passed via existing callbacks — no canvas changes needed.
- **`getProjectGraph` / `listSnapshots`** (`convex/graphSnapshots.ts`, Phase 83): the read API; consume via a new `useProjectGraph` hook (`useQuery(api.graphSnapshots.getProjectGraph)`).
- **`useToolGalaxy` / `useMcpHealth` / `useKgSummary`**: feed the live summary tiles (D-02) with zero new backend work.
- **`KnowledgeGraph.tsx` / `ObsidianGraph.tsx`**: detail-panel, hover, and palette patterns to mirror.

### Established Patterns
- **New page = page + route + nav** (CLAUDE.md): `src/pages/GraphsHub.tsx` (or similar) → `<Route path="/graphs">` in `App.tsx` (lazy + Suspense, like the sibling graph routes) → flip the existing placeholder nav entry.
- **Hooks wrap `useQuery(...) ?? []`/`null`** to handle the loading/empty undefined window — `useProjectGraph` returns `null` during load AND empty (both render the explainer state, D-12).
- **`SectionErrorBoundary`** wraps widget groups so one failing tile/hero doesn't take the page down — wrap the hero and the tile row.
- **Public graceful-skip reads** — `getProjectGraph` is unauthenticated/public (Phase 83 D-04), consistent with `kg.latestSummary`; no Clerk gating on the consumer.

### Integration Points
- `src/App.tsx` — new `/graphs` lazy route.
- `src/layouts/DashboardLayout.tsx` — placeholder → real route (one-line flip + ensure it stays first in the GRAPHS group).
- New `src/pages/GraphsHub.tsx` (name TBD) — composes summary tiles + code/vault hero + truncation/freshness header + detail panel.
- New `src/hooks/useProjectGraph.ts` — wraps `getProjectGraph`.
- Possibly a new `src/components/graph/CodeVaultGraph.tsx` to own the dual-palette + filter + detail-panel composition over `ForceGraphCanvas` (vs inlining in the page) — Claude's discretion.

</code_context>

<specifics>
## Specific Ideas

- The code/vault graph is the **hero** of `/graphs` — it's the net-new render and the reason the hub exists now; the tiles are supporting context, not co-equal.
- Truncation must be **explicit per-source** (D-07), not a single vague "truncated" flag — the operator should see *which* source (a specific repo, or the vault) hit its cap, reading the authoritative producer `sources[]`.
- Node ids arrive pre-namespaced (`graphify:<repo>:` / `vault:`) — derive the source family for coloring/filtering from `node.source`; do **not** rewrite ids.
- **Verification bar** (per global rules): "done" = with a real `graph_snapshot` ingested (Phase 83's verified round-trip vs `tidy-whale-981`, or a faithfully-shaped fixture), `/graphs` renders the code/vault hero with correct dual-palette coloring, working Code/Vault/Both filter, per-source truncation chips, a freshness timestamp, and a working detail panel — observed in the running app, not just "the query returned data." The null/empty explainer state must also be observed (no snapshot → explainer, tiles still render).

</specifics>

<deferred>
## Deferred Ideas

- **Lightweight in-graph node-name find/focus box** — deferred to **Phase 86** (alongside KG-08 full-text search) to avoid overlapping that scope. Source-filter chips (D-06) give a coarse narrowing in the meantime.
- **Cross-graph deep-linking from the detail panel** (node → owning agent → KG entity) — **Phase 85 (GH-04)**. The detail panel (D-10) is built link-free now.
- **Community/cluster-aware layout & coloring** — **Phase 86 (KG-09)**; `community` is persisted and shown in the detail panel but not used for layout this phase.
- **Mini-graph preview thumbnails on the tiles** — considered and rejected for the landing (render cost); could revisit if the hub gains a richer overview later.
- **A dedicated `/graphs/code-vault` full route** — considered; folded into the expand-to-fullscreen affordance (D-03) instead. Would become useful as a stable deep-link target if Phase 85 needs one.

None of these are losses — all map to already-planned later phases.

</deferred>

---

*Phase: 84-graphs-hub-code-vault-render*
*Context gathered: 2026-06-22*
