# CodePulse — Requirements

**Current milestone:** v6.0 Knowledge Graph Observability & Hardening
**Prior milestones:** v4.0 (`.planning/milestones/v4.0-REQUIREMENTS.md`), v5.0 (`.planning/milestones/v5.0-REQUIREMENTS.md`)

---

## v6.0 Requirements

### Knowledge Graph (KG)

> Visualizes Ástríðr's temporal knowledge graph. **Gated on Ástríðr Phase 126** (the read API
> these consume). Design authority: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`.

- [ ] **KG-01**: Operator sees always-on KG summary cards (entities by type, current vs historical triples, contradiction count, last-extraction time), rendered from pushed `kg_summary` telemetry so they show even when Ástríðr is offline
- [ ] **KG-02**: Operator browses a bounded whole-graph overview of entities + current relationships, filterable by entity type and agent, with truncation explicitly indicated when the cap is hit
- [ ] **KG-03**: Operator searches an entity by name and explores its ego graph (current facts + related entities) out to a selectable number of hops (1–3)
- [ ] **KG-04**: Operator scrubs an "as-of" date to view the KG as it was at a past time, with superseded facts rendered visually distinct from current ones
- [ ] **KG-05**: Operator reviews flagged contradictions (conflicting current beliefs) as a dedicated lens
- [ ] **KG-06**: Selecting an entity or edge shows its details (type, facts, confidence, validity window) and links each fact back to its source episodic memory in the existing Memory view (provenance)
- [ ] **KG-07**: Entities render as type-colored nodes with a legend; entity→entity triples render as labeled directed edges (confidence-weighted, current vs superseded styling); literal-object facts render as node attributes, not graph nodes

### UI Polish (UI)

- [ ] **UI-09**: All remaining dashboard icons standardized to Lucide, completing the partial UI-08 coverage across every dashboard surface

### Production Hardening (OPS)

- [ ] **OPS-01**: `CODEPULSE_ALLOWED_ORIGIN` is set in the Convex cloud deployment and a deploy checklist documents it, so production CORS is correct for a non-local origin
- [ ] **OPS-02**: The Gitleaks secret-scan CI workflow passes (green) on `master`
- [ ] **OPS-03**: The Supabase migration-drift CI check passes (green) on `master`

### Quality / Traceability (QA)

- [ ] **QA-01**: The REQUIREMENTS traceability tables (v4.0/v5.0 archives) are reconciled to actual shipped state, and a phase-completion step keeps the active traceability table current going forward

---

## Future Requirements (Deferred)

- KG graph clustering / community-detection layout for very large graphs (only if the bounded overview proves insufficient)
- KG saved/named views and shareable graph snapshots
- KG full-text fact search (beyond entity-name search)
- Vault-name override for the (deferred) Obsidian `obsidian://` deep links

---

## Out of Scope

- Editing or adjudicating KG triples from CodePulse — read-only; adjudication stays in Ástríðr's morning-briefing flow (D-09)
- Real-time streaming of KG graph changes — summary cards refresh via telemetry; interactive graph is fetch-on-demand
- Full-graph dumps — `/overview` is always bounded (top-N by degree, `minDegree`, truncation reported)
- Mirroring the full KG into Convex — interactive graph data is fetched on-demand from Ástríðr (hybrid path)
- Building the Ástríðr-side KG read API — that is astridr-repo work (Phase 126, tracked by SEED-001); CodePulse v6.0 is the consumer
- Obsidian vault graph enhancements — deferred; Obsidian's native graph covers them (see `2026-06-01-obsidian-graph-enhancements-design.md`)

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| KG-01 | Phase 73 | Pending |
| KG-02 | Phase 73 | Pending |
| KG-03 | Phase 73 | Pending |
| KG-04 | Phase 74 | Pending |
| KG-05 | Phase 74 | Pending |
| KG-06 | Phase 74 | Pending |
| KG-07 | Phase 73 | Pending |
| UI-09 | Phase 72 | Pending |
| OPS-01 | Phase 71 | Pending |
| OPS-02 | Phase 71 | Pending |
| OPS-03 | Phase 71 | Pending |
| QA-01 | Phase 72 | Pending |
