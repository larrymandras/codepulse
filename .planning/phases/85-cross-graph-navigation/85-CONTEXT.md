# Phase 85: Cross-Graph Navigation - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement **GH-04 — cross-graph navigation**: selecting a node in one graph surface deep-links to the corresponding entity in another surface, **only where the underlying data supports the link**. This fills the gap Phase 84 deliberately left open — its CodeVaultGraph detail panel shipped link-free (84 D-10), and this phase adds the cross-surface links to that panel (and to the KG/Galaxy panels).

**Two forward links are in scope** (exactly what GH-04 / SC#1-2 name):
1. **Tool Galaxy tool → its owning agent** in the code/vault graph (where a matching node exists).
2. **Agent node → its related KG entities** (where a `{agent}` relationship / `agentId` scoping exists in the KG).

The forward chain **tool → agent → KG entity** is fully walkable.

**Out of scope (do NOT build here):**
- **Reverse / bidirectional links** — code/vault agent → Galaxy tools, KG entity → owning agent. Considered and deferred; GH-04 only specifies the two forward links.
- **Absorbing surfaces into the hub.** Tool Galaxy (`/tool-galaxy`), KG Explorer (`/knowledge-graph`), and MCP Inventory (`/mcp-inventory`) stay as standalone routes (Phase 84 D-01). The hub links to them; it does not rebuild them as tabs.
- **Full-text fact search + clustering/community layout** — Phase 86 (KG-08/KG-09).
- **Saved/named views + temporal diff** — Phase 87 (KG-10/KG-11).
- **Any Ástríðr-side / Convex backend change.** This is pure CodePulse frontend over already-shipped data (Phase 83 receiver + the existing KG / Tool Galaxy queries). Matching is client-side over data each surface already loads.

</domain>

<decisions>
## Implementation Decisions

HOW-only decisions from discussion. GH-04 + SC#1-4 stay the scope anchors.

### Navigation mechanism
- **D-01: Cross-route focus param.** A jump = `react-router` navigate to the target's **existing standalone route** carrying a focus target in the URL; the target page reads the param on mount, selects the node, and centers/zooms to it (via `ForceGraphHandle.centerAt`/`zoomToFit`). Builds the **net-new deep-link infra once** (none exists today — every graph page holds node selection in local component state only), reuses it across surfaces, keeps Phase 84's standalone-routes boundary intact, and makes jumps shareable/bookmarkable for free. **Rejected:** in-hub tabs with shared focus state (contradicts 84 D-01, large rebuild) and an imperative ref/event with no URL (only works when both surfaces are already mounted; no back-button/shareable behavior).
- **D-02: Per-surface focus params, one URL-builder helper.** A single helper (`buildFocusUrl(target)`) emits the right URL per target type, because the KG entity lens is **name-driven** (`useKnowledgeGraph` entity lens only fetches when an entity *name* is present — a bare id won't resolve):
  - code/vault hero → `/graphs?focus=<nodeId>`
  - Tool Galaxy → `/tool-galaxy?focus=<nodeId>`
  - KG entity → `/knowledge-graph?focus=<entityName>&lens=entity&hops=1`
  Each page reads the params it needs. **Rejected:** a uniform `?focus=<id>` everywhere — forces the KG to reverse-map id→name and switch lens before it can fetch (fragile; risks landing on an empty graph).

### Match resolution & link directions (SC#1-3)
- **D-03: Two forward links only** — Tool → owning agent (code/vault), agent → related KG entities. No reverse/bidirectional links this phase.
- **D-04: Normalized-exact matching, resolved eagerly.** Match on a **normalized key** — strip the namespace prefix (`graphify:<repo>:` / `vault:`) and case/whitespace-fold — requiring an **exact** hit. **No fuzzy, substring, or Levenshtein** matching (a wrong jump is worse than a missing one; conflicts with SC#3 and the zero-false-positive bias). Resolution is **eager**: compute whether the destination node exists *before* rendering the affordance, so a link only appears when its target is confirmed present. This is the concrete mechanism for SC#3 — links with no data backing are **silently absent** (the affordance simply does not render; no dead/broken nav). Join keys: agent name ↔ code/vault node `label` (after namespace strip); agent ↔ KG entities via the `{agent}` relationship / `agentId` scoping the KG already supports.

### Affordance placement
- **D-05: "Related across graphs" section in each surface's detail panel.** A labeled link section at the bottom of each surface's existing side/detail panel — the exact slot Phase 84 left open in `CodeVaultGraph` (84 D-10), mirrored in the KG Explorer and Tool Galaxy panels. Renders a labeled link **only when a match resolves** (e.g. "Owning agent: AgentX →", "3 KG entities →"). Consistent with the established detail-panel pattern, discoverable, and the eager-match rule (D-04) naturally gates visibility. **Rejected:** right-click context menu (new interaction pattern, less discoverable, harder to express "no match = absent") and inline/hover affordance (the hover tooltip is label+type+source only per 84 D-11 — too cramped, competes with selection clicks).

### Return path (SC#4)
- **D-06: Explicit return chip + origin encoded in the URL.** The jump URL carries a `from` marker that includes the **originating surface's key state** (its selected node + filters), e.g. `/graphs?focus=AgentX&from=/tool-galaxy?focus=ToolY`. The destination renders a "← Back to Tool Galaxy" chip (top-left) that navigates back and restores that prior context. To make this real, the originating surface **serializes its key state into its own URL before navigating**, so return-nav restores selection/filters rather than landing on a re-mounted, reset surface. This is the reliable path to SC#4 without every page implementing full idb persistence (KG already auto-persists last state to idb; code/vault hero and Tool Galaxy currently hold filter/selection in volatile component state). **Rejected:** browser-back-only (poor discoverability for an in-app jump; only KG would restore state) — though browser-back should still work since origin state lives in the URL.

### Claude's Discretion
- **Loading/empty state on arrival:** the destination page may finish navigating before its query resolves (esp. the name-driven KG entity fetch). Standard skeleton/spinner while loading, wrapped in `SectionErrorBoundary`; if the focused node turns out absent on arrival (data changed since the link was computed), fall back gracefully to the surface's default view rather than erroring. Not asked — standard practice.
- Exact normalization rules (which separators/casing to fold), the precise `from`-param encoding (nested query string vs. router location-state vs. base64), the return-chip copy/styling, the KG `hops` default for an inbound entity jump (1 is a starting point), and whether the agent→KG link shows an entity count in its label.
- The shared deep-link plumbing's shape — a `useFocusParam` hook (or similar) each graph page calls on mount to read+apply the focus target, and the `buildFocusUrl` helper location (`src/lib/` likely).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / milestone scope (the anchor)
- `.planning/REQUIREMENTS.md` § "Graph Hub (GH)" — **GH-04** full definition (selecting a tool → its owning agent → a related KG entity deep-links across the graph surfaces where the data supports it).
- `.planning/ROADMAP.md` § "Phase 85: Cross-Graph Navigation" — Goal + the four success criteria (SC#1 tool→agent, SC#2 agent→KG, SC#3 silently-absent unbacked links, SC#4 preserve originating state for return).
- `.planning/PROJECT.md` § "Current Milestone: v8.0" — why this is CodePulse-side only (producer + receiver already ship).

### Phase 84 (the surfaces + the link-free panel this phase extends)
- `.planning/phases/84-graphs-hub-code-vault-render/84-CONTEXT.md` — **D-01** (surfaces stay standalone, hub links not absorbs — binds D-01 scope here), **D-10** (the link-free detail panel this phase adds links to), **D-11** (hover tooltip is label/type/source only — why the affordance lives in the panel, not the tooltip).
- `src/components/graph/CodeVaultGraph.tsx` — the code/vault hero + its detail panel (~L412+ selected-node panel, neighbors section ~L481); the "Related across graphs" section attaches here. Node ids namespaced `graphify:<repo>:` / `vault:`; source derived from `node.source` (do NOT rewrite ids). `isVaultNode`/`sourceLabel` helpers present.

### Render + page surfaces involved (read before wiring focus params)
- `src/components/graph/ForceGraphCanvas.tsx` — generic force-graph wrapper. `ForceGraphHandle` exposes `centerAt`/`zoom`/`zoomToFit` (use to center the focused node on arrival); `onNodeClick`/`focusSet`/`paintNode` props.
- `src/pages/ToolGalaxy.tsx` — Tool Galaxy page; `GalaxyNode` with `kind: "agent" | "tool" | "mcpServer" | "kit"`; `onNodeClick` (~L266). Source of the Tool→agent link; reads `?focus=<nodeId>` on mount.
- `src/lib/tool-galaxy.ts` — `buildGalaxy` / `deriveAgents` / `GalaxyNode` type; agent-node identity (the name that must normalize-match a code/vault label).
- `src/pages/KnowledgeGraph.tsx` — KG Explorer; detail panel (~L260) + `selectNode` (~L251). Reads `?focus=<entityName>&lens=entity&hops=1` on mount.
- `src/hooks/useKnowledgeGraph.ts` — **entity lens is name-driven** (only fetches when `entityName` present — drives D-02); `KgFilters` has `agentId` (the agent→KG join); `selectNode`/`focusSet` (~L251, L259-281) are how an inbound jump highlights an entity.
- `src/App.tsx` — graph routes (lazy + Suspense); the three target routes already exist (`/graphs`, `/tool-galaxy`, `/knowledge-graph`). No new routes needed — only focus-param reading.

### Pattern precedents
- `src/pages/HivePage.tsx` — recent page composition exemplar (consistency reference for any new helper/hook wiring).
- `CLAUDE.md` § Ástríðr API Integration — N/A this phase (no `fetch` to Ástríðr); matching is client-side over already-loaded data. Noted to pre-empt accidental backend calls.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ForceGraphCanvas` / `ForceGraphHandle`** (`src/components/graph/ForceGraphCanvas.tsx`): `centerAt`/`zoomToFit` are exactly what an inbound focus jump needs to center the target node — no new canvas API required.
- **`CodeVaultGraph` detail panel** (`src/components/graph/CodeVaultGraph.tsx`): the link-free panel from 84 D-10; the "Related across graphs" section slots in below the neighbors block.
- **`useKnowledgeGraph`** (`src/hooks/useKnowledgeGraph.ts`): `selectNode` + `focusSet` + the name-driven entity lens are the inbound-jump primitives for the KG; `agentId` filter is the agent→KG data join.
- **`tool-galaxy.ts` `deriveAgents` / `GalaxyNode`**: agent-node identity is the source key for the Tool→agent match.

### Established Patterns
- **No deep-link infra exists yet** — selection is local component state on every graph page. This phase introduces the first URL-param-driven focus mechanism (a `useFocusParam`-style hook + `buildFocusUrl` helper). Build it generically so Phases 86/87 (saved/shareable views) can reuse it.
- **Hooks wrap `useQuery(...) ?? []`/`null`** for the loading window — the inbound focus must tolerate the node not being present yet (query still resolving) and the node being absent (data changed).
- **`SectionErrorBoundary`** wraps widget groups — wrap any new link section / return chip so a match-resolution error can't take the panel down.
- **Client-side matching** — both joins compute over data each surface already loads (no new Convex queries); mirrors the GAL-04 / 84 D-06 client-side-filtering precedent.

### Integration Points
- `src/components/graph/CodeVaultGraph.tsx`, `src/pages/ToolGalaxy.tsx`, `src/pages/KnowledgeGraph.tsx` — each gains: (a) reads its focus param on mount, (b) renders the "Related across graphs" link section + the "← Back to X" return chip in its detail panel.
- New `src/lib/` helper (`buildFocusUrl` + normalization/match utilities) and a new `useFocusParam` hook (`src/hooks/`) — the shared plumbing.
- `src/App.tsx` — no new routes; the three targets already exist. Possibly verify the routes don't strip query params.

</code_context>

<specifics>
## Specific Ideas

- The link only ever appears when its destination is **confirmed to exist** — operators should never see a link that dead-ends (SC#3). The eager-match check (D-04) is the gate; "silently absent" means the affordance simply does not render.
- A wrong jump is worse than a missing one — bias matching toward precision (normalized-exact, no fuzzy), consistent with the zero-false-positive review rule.
- Build the focus-param plumbing generically — it's the foundation Phases 86 (search-to-focus) and 87 (saved/shareable views, which are literally URL-encoded graph state) will build on.
- **Verification bar** (per global rules): "done" = in the running app on real Convex data, from Tool Galaxy select a tool whose owning agent exists in the code/vault graph → the panel shows "Owning agent →" → clicking navigates to `/graphs`, selects + centers that agent node, and a "← Back to Tool Galaxy" chip restores the prior Galaxy selection on return. Then from an agent node → "N KG entities →" → lands in the KG entity lens focused on those entities. AND: a tool/agent with **no** backing match shows **no** link (observed, not assumed). Observed behavior, not "the match function returned true."

</specifics>

<deferred>
## Deferred Ideas

- **Reverse / bidirectional cross-graph links** (code/vault agent → Galaxy tools, KG entity → owning agent) — considered; out of scope for GH-04. Natural follow-up if round-trip exploration is wanted later.
- **Pulling the standalone graph surfaces into the `/graphs` hub as tabs** — rejected here (Phase 84 D-01 boundary); the cross-route focus-param mechanism (D-01) is the chosen alternative. Could be revisited as a future hub-consolidation phase.
- **Shareable/saved graph views built on the focus-param infra** — Phase 87 (KG-10). This phase lays the URL-state foundation; saved/named views formalize it.
- **Search-to-focus (type a name → jump to that node)** — Phase 86 (KG-08), reuses the same focus mechanism.

None of these are losses — all map to already-planned later phases or were explicit scope decisions.

</deferred>

---

*Phase: 85-cross-graph-navigation*
*Context gathered: 2026-06-22*
