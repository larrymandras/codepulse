# Ástríðr Knowledge Graph Visualization (CodePulse) — Design

**Date:** 2026-06-01
**Status:** Approved (design); implementation GATED on Ástríðr Phase 125 (backfill) + Phase 126
(retrieval surface). Build as a Phase-126 consumer.
**Component:** CodePulse — new top-level `/knowledge-graph` page
**Spans two repos:** Ástríðr (read API + summary telemetry, folded into Phase 126) and CodePulse
(the view).
**Related:** supersedes the deferred `2026-06-01-obsidian-graph-enhancements-design.md` as the
"graph effort" — visualizes *Ástríðr's* knowledge, not the personal Obsidian vault.

## Problem / Opportunity

Ástríðr's v16.0 temporal knowledge graph (`entities` + `knowledge_triples` in Supabase) is the
agent's actual model of Larry's world — what it believes, how facts connect, how they supersede
over time, and where it holds contradictions. Nothing surfaces it today. CodePulse, as Ástríðr's
operational command center, is the right place to *observe* it. The just-built `react-force-graph-2d`
renderer can be reused.

This is squarely on CodePulse's mission ("see Ástríðr's state"), unlike the personal Obsidian vault
graph (which Obsidian itself already visualizes — hence that enhancement was deferred).

## Goals

A `/knowledge-graph` page offering four lenses over Ástríðr's KG:
1. **Entity-centric (ego graph)** — pick an entity → its current facts + related entities to N hops.
2. **Whole-graph overview** — bounded top-N entities + current triples, colored by entity type.
3. **Temporal** — an "as-of" date scrubber; show superseded facts (uses `triples_as_of`).
4. **Contradiction review** — surface `contradiction_flag` triples for inspection.

Plus always-on summary cards and provenance links back to the source episodic memory.

## Non-Goals (YAGNI)

- Editing or adjudicating triples from CodePulse (read-only; contradiction *adjudication* stays in
  Ástríðr's morning-briefing flow per D-09).
- Real-time streaming of graph changes (summary cards refresh via telemetry; the interactive graph
  is fetch-on-demand / manual refresh).
- Full-graph dumps — `/overview` is always bounded (top-N, `minDegree`, truncation reported).
- Alias-graph complexity in v1 (canonical entities only in overview; aliases revealed only in ego).
- Embedding/similarity exploration UI (the `embedding` column is not exposed).
- Any write-back to the KG.

## Dependencies & sequencing

Implementation is **gated** on:
- **Phase 125 (backfill)** — until the existing corpus is backfilled, the graph is near-empty.
- **Phase 126 (retrieval surface / `GraphQueryTool`)** — provides the query logic this view consumes.

This design **adds** to the Ástríðr side: an HTTP KG read API + a summary telemetry emitter. Fold
these into Phase 126 (or a 126.x). The CodePulse work begins once that API exists and data is
backfilled.

## Architecture (Approach A — contract-first, two-sided, shared renderer)

```
ÁSTRÍÐR (Supabase + web channel)                    CODEPULSE (Convex + React)
┌─────────────────────────────────┐                ┌──────────────────────────────────┐
│ knowledge_triples / entities     │                │ Convex: kgSummary table + ingest   │
│ Phase 126 GraphQueryTool ─┐      │  summary push  │   → always-on summary cards        │
│ KG summary emitter ───────┼──────┼───telemetry───►│                                    │
│ HTTP KG API (Bearer) ◄────┘      │  on-demand     │ lib/kgApi.ts (authHeaders fetch)   │
│  /summary /entity /overview      │◄───fetch───────┤ lib/kg-graph.ts (PURE: API→graph)  │
│  /contradictions  (+asOf param)  │   GraphPayload │ useKnowledgeGraph hook             │
└─────────────────────────────────┘                │ KnowledgeGraph page (4 lenses)     │
                                                     │  + shared <ForceGraphCanvas>       │
                                                     └──────────────────────────────────┘
```

### Ástríðr KG read API (Bearer-authed JSON; implemented with Phase 126)

Uniform payload so the renderer is lens-agnostic:
```ts
GraphPayload {
  entities: { id; name; type; agentId; isCanonical }[]
  triples:  { id; subjectId; predicate; objectId?; objectLiteral?;
              confidence; validFrom; validTo|null; contradictionFlag; sourceEventId? }[]
  meta: { generatedAt; scope; truncated?: { limit; total } }
}
KGSummary {
  entitiesByType: Record<string, number>; totalEntities: number;
  currentTriples: number; historicalTriples: number; contradictions: number;
  lastExtractionAt: string | null
}
```

| Endpoint | Purpose | Wraps / notes |
|---|---|---|
| `GET /api/kg/summary` | `KGSummary` counts | cheap aggregates; ALSO pushed as `kg_summary` telemetry |
| `GET /api/kg/entity?name=&hops=1..3&agent=&asOf=` | ego graph | `match_entities` + `current_triples_for_entity` / `triples_as_of`; hops default 1, cap 3 |
| `GET /api/kg/overview?types=&agent=&limit=&minDegree=&asOf=` | bounded top-N by degree | new aggregate; default `limit≈250`; reports `meta.truncated` |
| `GET /api/kg/contradictions?agent=` | `contradiction_flag` triples + their entities | for the review lens |

- **`asOf`** is a query param on `entity`/`overview` (no separate endpoint) → powers the temporal lens.
- **Auth:** existing web-channel Bearer (`VITE_ASTRIDR_API_KEY`). **Scope:** default `agentId=''`
  (shared); `agent` param filters a persona's private facts.
- **Bounded by design:** `/overview` never dumps the whole graph.

## CodePulse modules

```
convex/
  schema.ts            + kgSummary table (latest snapshot)
  runtimeIngest.ts     + 'kg_summary' dispatch → upsert kgSummary
  kg.ts                query: latest kgSummary (for cards)
src/lib/
  kgApi.ts             typed fetchers (fetchSummary/Entity/Overview/Contradictions) via
                       authHeaders/apiRequest (astridrApi.ts); return GraphPayload / KGSummary
  kg-graph.ts          PURE: toGraphData(payload, opts) → {nodes,links}; deriveView(filters);
                       entityTypeColors (10 stable colors); getNeighbors / computeFocusSet
src/components/graph/
  ForceGraphCanvas.tsx generic force-graph extracted from ObsidianGraph (props: data, colorFn,
                       labelFn, edgeStyleFn, focusSet, onNodeClick, onBgClick)
src/components/kg/
  KGControls.tsx       lens switch + filters (type legend/toggles, predicate filter, agent
                       selector, as-of scrubber, entity search, ego hops slider)
  KGDetailsPanel.tsx   selected entity/edge details + facts list + provenance links
src/hooks/
  useKnowledgeGraph.ts lens, filters (idb-persisted), selection, per-lens fetched payload,
                       loading/error; calls kgApi; memoizes toGraphData/deriveView
src/pages/
  KnowledgeGraph.tsx   summary cards + lens-driven graph + KGControls + KGDetailsPanel
src/App.tsx            + <Route path="/knowledge-graph">
src/layouts/DashboardLayout.tsx + nav item "Knowledge Graph" (near Memory / Dreaming)
```

`ObsidianGraph` is refactored to render via the shared `<ForceGraphCanvas>` (supplying its own
obsidian colors/labels), keeping its existing tests green.

## Graph encoding (`kg-graph.ts`)

- **Node = entity**; color by `entity_type` (10 fixed colors + legend); size by degree. Overview
  shows canonical entities only; aliases (`canonicalId` set) are revealed in the ego lens.
- **Edge = entity→entity triple only** (`objectId` present): directed `subject → object`, label =
  `predicate`, width ∝ `confidence`, **current (`validTo === null`) solid / superseded dashed+dim**,
  **`contradictionFlag` → red**.
- **Literal-object triples are NOT graph elements** — they render as attributes in the details
  panel (e.g. `started_on = "2024"`), keeping the graph a clean entity-relationship view.
- `deriveView(filters)` does **client-side** filtering only — entity type, predicate, agent. Temporal
  state is **server-side** (the `asOf` fetch param re-queries via `triples_as_of`); `toGraphData`
  styles each edge from its `validTo` (solid when `null`, dashed+dim when superseded), so superseded
  edges appear whenever the payload contains non-current triples (i.e. under `asOf`).

## The four lenses (one page, lens switch in `KGControls`)

| Lens | Fetch | UX |
|---|---|---|
| Overview | `fetchOverview(filters)` | bounded top-N; type/agent/`minDegree` filters; truncation note |
| Entity (ego) | `fetchEntity(name, hops)` | entity search → ego graph; hops slider 1–3 |
| Temporal | adds `asOf` to overview/ego | date scrubber re-fetches; superseded edges dashed |
| Contradiction | `fetchContradictions()` | graph of conflicting facts; panel lists each pair (read-only) |

## Details panel + provenance

Selecting an entity → name, type, aliases, agent scope, and a facts list (entity-edges + literal
attributes), each fact showing predicate / object / confidence / valid-range / contradiction flag.
Each fact links its **`sourceEventId` back into CodePulse's existing episodic Memory view**
(deep-link to that event) — "why does Ástríðr believe this? → the memory that taught it."
Selecting an edge shows that triple's details + provenance.

## Summary cards (always-on)

Top of page, sourced from the pushed `kgSummary` (Convex) so they render even when Ástríðr is
offline or before any interactive fetch: total entities, by-type breakdown, current triples,
**contradictions (alert-colored when > 0)**, last-extraction time.

## Data flow

```
Ástríðr cron/heartbeat ─push kg_summary─► Convex kgSummary ─useQuery─► summary cards (always-on)
user picks lens/filters ─► useKnowledgeGraph ─kgApi fetch─► GraphPayload ─toGraphData─► view
                                                            │                            │
selection (entity/edge) ───────────────────────────────────┴────────────────────────────┤
                                                                                          ▼
                                          ForceGraphCanvas (renders; dims non-focus)
                                          KGControls (drives lens + filters)
                                          KGDetailsPanel (facts + provenance)
```
Filters/lens persist to idb; selection is transient.

## Testing strategy

- **`kg-graph.test.ts`** (pure, highest value): node color by type; entity-edge created vs
  literal-as-attribute (no edge); `confidence` → width; current vs superseded; `contradictionFlag`
  styling; `deriveView` (type/predicate/agent filters); `entityTypeColors` stable 10-type map;
  `getNeighbors` / `computeFocusSet`.
- **`kgApi.test.ts`**: each fetcher builds the correct URL/params and auth header (mock `fetch`);
  parses `GraphPayload`/`KGSummary`; handles errors.
- **Convex**: `kgSummary` ingest upsert + latest-summary query.
- **Component tests** (mock `react-force-graph-2d`, `@testing-library/react`): `KGControls` (lens
  switch, filters, as-of, search fire callbacks), `KGDetailsPanel` (facts list, literal-vs-edge
  rendering, provenance link href to episodic view, contradiction styling), `ForceGraphCanvas`
  (focus dim + `colorFn` applied), `KnowledgeGraph` page (cards from `kgSummary`, lens wiring).
- **Ástríðr side** (its repo / Phase 126): per-endpoint shape, bounding/truncation, auth-required,
  and `asOf` correctness tests + a summary-emitter test.
- **Browser UAT** (after 125/126): drive `/knowledge-graph` against the real KG.

## Phasing

**Prerequisite (Ástríðr):** Phase 125 backfill + Phase 126 retrieval surface, extended with the
HTTP KG API + `kg_summary` emitter defined above.

**CodePulse, two waves:**
- **Wave 1 — core:** contract types + `kgApi` + pure `kg-graph` + `<ForceGraphCanvas>` extraction +
  summary cards + **Overview & Entity** lenses + page/route/nav. Delivers the primary value.
- **Wave 2 — depth:** **Temporal** (as-of scrubber) + **Contradiction** lens + `KGDetailsPanel`
  provenance linking into the episodic Memory view.

## Assumptions

- Phase 126 exposes (or is extended to expose) the query logic behind the four endpoints; this spec
  defines the contract it must satisfy.
- The existing web-channel Bearer auth (`VITE_ASTRIDR_API_KEY`) covers the new endpoints.
- Bounded overview (~250 nodes) renders acceptably in `react-force-graph-2d` (consistent with the
  real-vault Obsidian UAT at similar scale).
- Episodic events are addressable in CodePulse's Memory view by `sourceEventId` for provenance
  deep-links (verify the episodic view supports a focused/filtered link during Wave 2).
