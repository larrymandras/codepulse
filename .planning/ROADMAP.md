# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- 🔄 **v6.0 Knowledge Graph Observability & Hardening** — Phases 71-74 (in progress)

## Phases

<details>
<summary>✅ v4.0 Operational Excellence (Phases 1-7, 58) — SHIPPED 2026-04-14</summary>

- [x] Phase 1: UI Foundation (4/4 plans) — Paperclip design language
- [x] Phase 2: Bidirectional Telemetry (4/4 plans) — WebSocket consumer + command sender
- [x] Phase 3: Interaction Layer (6/6 plans) — Inbox, Command Palette, Agent Chat, Live Run
- [x] Phase 4: Task Management (6/6 plans) — Kanban, Ideation, Config Editor, Cron
- [x] Phase 5: Data Pipeline (5/5 plans) — Aggregation, retention, pagination
- [x] Phase 6: Alert Routing (5/5 plans) — Rules, webhooks, lifecycle management
- [x] Phase 7: Intelligence Layer (5/5 plans) — Cost forecasting, briefings, anomaly detection
- [x] Phase 58: Infrastructure Layer (1/1 plan) — Command catalog on Capabilities page

See: [milestones/v4.0-ROADMAP.md](milestones/v4.0-ROADMAP.md)

</details>

<details>
<summary>✅ v5.0 Advanced Visualization & Integrations (Phases 59-70) — SHIPPED 2026-05-25</summary>

- [x] Phase 59: Schema Foundation (2/2 plans) — completed 2026-05-18
- [x] Phase 60: Context Window Animation (outside GSD) — completed 2026-05-23
- [x] Phase 61: Token Sunburst (outside GSD) — completed 2026-05-23
- [x] Phase 62: Email Digest (schema → Phase 70) — completed 2026-05-25
- [x] Phase 63: Call Graph (infra → Phase 70) — completed 2026-05-25
- [x] Phase 64: PagerDuty (schema → Phase 70) — completed 2026-05-25
- [x] Phase 65: GitHub Actions (outside GSD) — completed 2026-05-23
- [x] Phase 66: Gateway Compatibility (4/4 plans) — completed 2026-05-21
- [x] Phase 67: Multi-Provider Pricing (3/3 plans) — completed 2026-05-22
- [x] Phase 68: Gateway Observability (5/5 plans) — completed 2026-05-22
- [x] Phase 69: SDK Spend Guard & UX (5/5 plans) — completed 2026-05-23
- [x] Phase 70: External Integrations & Call Graph (4/4 plans) — completed 2026-05-25

See: [milestones/v5.0-ROADMAP.md](milestones/v5.0-ROADMAP.md)

</details>

### v6.0 Knowledge Graph Observability & Hardening (Phases 71-74)

- [ ] **Phase 71: CI & Production Hardening** - Green up Gitleaks + Supabase drift CI checks and document CODEPULSE_ALLOWED_ORIGIN for production CORS
- [ ] **Phase 72: UI Polish & Traceability** - Complete Lucide icon standardization across all dashboard surfaces and reconcile REQUIREMENTS traceability tables
- [ ] **Phase 73: Knowledge Graph — Wave 1 (Core)** - Ship the /knowledge-graph page with always-on summary cards plus Overview and Entity (ego) lenses, backed by the shared ForceGraphCanvas and the kgApi + kg-graph data layer
- [ ] **Phase 74: Knowledge Graph — Wave 2 (Depth)** - Add the Temporal (as-of scrubber) and Contradiction lenses plus the KGDetailsPanel with provenance deep-links into the episodic Memory view

## Phase Details

### Phase 71: CI & Production Hardening
**Goal**: The master branch CI pipeline runs clean and production deployments use the correct CORS origin
**Depends on**: Nothing — no external dependencies
**Requirements**: OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. The Gitleaks secret-scan workflow completes green on master with no suppressed findings
  2. The Supabase migration-drift workflow completes green on master, reflecting the current schema state
  3. `CODEPULSE_ALLOWED_ORIGIN` is set in the Convex cloud deployment environment and a deploy checklist in the repo documents the required value and the procedure to set it
  4. A local developer following the deploy checklist can correctly configure CORS for a non-local origin without guessing at the correct value
**Plans**: TBD

### Phase 72: UI Polish & Traceability
**Goal**: Every dashboard icon is a Lucide icon and the REQUIREMENTS traceability tables accurately reflect what shipped in v4.0 and v5.0
**Depends on**: Nothing — no external dependencies
**Requirements**: UI-09, QA-01
**Success Criteria** (what must be TRUE):
  1. Every icon rendered across all 15 dashboard pages is a Lucide icon — no other icon libraries visible in any dashboard surface
  2. The v4.0 and v5.0 archive traceability tables list the correct phase number for every shipped requirement
  3. The active REQUIREMENTS.md traceability table is populated with phase assignments for all v6.0 requirements
  4. A phase-completion step is documented so the active traceability table stays current going forward
**Plans**: TBD
**UI hint**: yes

### Phase 73: Knowledge Graph — Wave 1 (Core)
**Goal**: Operators can see always-on KG health summary cards and browse Ástríðr's knowledge graph via the Overview and Entity (ego) lenses on the new /knowledge-graph page
**Depends on**: Phase 72 (sequenced after hardening/polish phases; no functional dependency)
**External dependency**: Ástríðr Phase 126 (HTTP KG read API: /api/kg/summary, /api/kg/overview, /api/kg/entity + kg_summary telemetry emitter) AND Ástríðr Phase 125 (backfill — graph must contain real data). Implementation is BLOCKED until both ship.
**Design authority**: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`
**Requirements**: KG-01, KG-02, KG-03, KG-07
**Success Criteria** (what must be TRUE):
  1. The /knowledge-graph page displays always-on summary cards (total entities by type, current vs historical triples, contradiction count, last-extraction time) sourced from the Convex kgSummary table — cards render even when Ástríðr is offline because they come from pushed kg_summary telemetry
  2. The Overview lens renders a bounded force-directed graph of the top-N entities and their current relationships, filterable by entity type and agent; a truncation notice appears when the node cap is hit
  3. The Entity (ego) lens accepts an entity name search and renders that entity's ego graph out to a selectable 1–3 hops, showing connected entities and the triples between them
  4. Entity nodes are colored by type using the 10-color stable palette and sized by degree; a legend maps colors to entity types; entity→entity triples render as directed labeled edges with confidence-proportional width and solid (current) or dashed-dim (superseded) styling; literal-object facts do NOT appear as graph nodes
  5. The shared ForceGraphCanvas component is extracted from ObsidianGraph.tsx and ObsidianGraph continues to pass all its existing tests after the refactor
  6. kgApi.ts (typed API fetchers) and kg-graph.ts (pure graph-transform logic) exist as separate modules, each covered by their own test files
**Plans**: TBD
**UI hint**: yes

### Phase 74: Knowledge Graph — Wave 2 (Depth)
**Goal**: Operators can view the knowledge graph as it existed at any past date, review all flagged contradictions as a dedicated lens, and trace any belief back to the episodic memory that created it
**Depends on**: Phase 73 (Wave 1 — ForceGraphCanvas, kgApi, kg-graph, page skeleton, and summary cards must exist)
**External dependency**: Ástríðr Phase 126 (HTTP KG read API: /api/kg/contradictions + asOf param on entity/overview endpoints) AND Ástríðr Phase 125 (backfill). Same external gate as Phase 73.
**Design authority**: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`
**Requirements**: KG-04, KG-05, KG-06
**Success Criteria** (what must be TRUE):
  1. The Temporal lens exposes a date scrubber; moving it re-fetches the graph as of that date, with superseded facts rendered as dashed/dimmed edges visually distinct from solid current edges
  2. The Contradiction lens renders all contradiction-flagged triples as a dedicated graph view, and the KGDetailsPanel lists each contradicting pair with subject, predicate, conflicting objects, and confidence
  3. Selecting any entity or edge opens the KGDetailsPanel showing its type, all associated facts (entity-edge triples and literal attributes), confidence, and validity window
  4. Each fact in the KGDetailsPanel that carries a sourceEventId shows a clickable provenance link that navigates to that event in the existing Memory view
  5. The always-on contradiction count summary card is styled in alert color (amber/red) when the count is greater than zero
**Plans**: TBD
**UI hint**: yes

## Execution Order

```
Phase 71 (CI & Production Hardening)    Execute now — no blockers
Phase 72 (UI Polish & Traceability)     Execute now — no blockers (parallel-safe with 71)
                                                 |
Phase 73 (KG Wave 1 — Core)             BLOCKED on Ástríðr Phase 125 + 126
                                                 |
Phase 74 (KG Wave 2 — Depth)            After Phase 73
```

**Critical path:** Phase 73 is gated on Ástríðr Phase 125 (backfill) + Phase 126 (KG read API).
**Immediately executable:** Phases 71 and 72 have no dependencies and can run in either order.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7, 58 | v4.0 | 36/36 | Complete | 2026-04-14 |
| 59-70 | v5.0 | 23/23 | Complete | 2026-05-25 |
| 71. CI & Production Hardening | v6.0 | 0/TBD | Not started | - |
| 72. UI Polish & Traceability | v6.0 | 0/TBD | Not started | - |
| 73. KG Wave 1 — Core | v6.0 | 0/TBD | Not started (ext. blocked) | - |
| 74. KG Wave 2 — Depth | v6.0 | 0/TBD | Not started (ext. blocked) | - |

---

*Last updated: 2026-06-01 — v6.0 roadmap created: 4 phases (71-74), 12 requirements mapped*
