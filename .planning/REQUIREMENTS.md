# CodePulse — Requirements

**Active milestone:** none — v7.0 Forge Integration **shipped 2026-06-17** (archived). Next: start a new milestone (`/gsd-new-milestone`) or resume parked v6.0.
**Parked milestone:** v6.0 Agentic OS Front-End — phases 71/72/73/74/76 shipped; **75 (Agent Console) + 77 (CI/Prod Hardening, 2/3 plans) parked** pending Ástríðr Surface-Substrate gates. Requirements retained below, re-activate later.
**Prior milestones:** v4.0 (`.planning/milestones/v4.0-REQUIREMENTS.md`), v5.0 (`.planning/milestones/v5.0-REQUIREMENTS.md`), v7.0 (`.planning/milestones/v7.0-REQUIREMENTS.md`)
**Companion plan:** `C:\Users\mandr\html-out\agentic-os-milestones.md` (the two-milestone Agentic OS plan; CodePulse = the rendering/control half)

---

## v7.0 Forge Integration Requirements — ✅ SHIPPED 2026-06-17

All 14 requirements (FI-01 … FI-14) satisfied and verified live. Archived to [milestones/v7.0-REQUIREMENTS.md](milestones/v7.0-REQUIREMENTS.md).

---

## v6.0 Requirements

### Design System (DS) — Phase 71

> The unified "Agentic OS" visual language and IA refactor — the foundation every later UI phase renders against. Absorbs the old UI-09 (icon standardization) and QA-01 (traceability).

- [ ] **DS-01**: A documented design-token layer (color, type, spacing, elevation, motion) backs the dashboard, derived from an audit of the *live* current styling — resolving the doc conflict (PROJECT.md "shadcn New York + oklch Paperclip" vs CLAUDE.md "Tailwind-only + Cinzel/Geist") to one ground-truth system
- [ ] **DS-02**: A documented set of shared primitives/conventions (MetricCard, EntityRow, panels, chart wrappers, status colors) covers the patterns repeated across the 15 pages
- [ ] **DS-03**: The nav/IA is refactored to add a *Graphs* cluster and an *Agents/Console* cluster without breaking existing routes
- [ ] **DS-04**: A UI-SPEC + visual sketch of the unified language is approved by Larry before the 15-page migration begins

### Tool / Capability Galaxy (GAL) — Phase 72

> Depends on the Ástríðr **M1.P1 callGraphEdges emitter** (✅ built — `tool_executed` → `callGraphEdges`), so the table is no longer sparse.

- [ ] **GAL-01**: The graph renders nodes for discoveredTools + mcpServers + kits and agent↔tool edges from callGraphEdges, as a navigable force/R3F galaxy
- [ ] **GAL-02**: Node glow/size encodes usage frequency + recency from callGraphEdges (callCount/errorCount/status)
- [ ] **GAL-03**: Installed-but-unused tools (no edges) are visually flagged as orphans
- [ ] **GAL-04**: Filtering by agent/persona and by MCP server works without a full reload

### MCP Inventory + Health (MCP) — Phase 73

- [ ] **MCP-01**: Every MCP server and its tools are listed with status pills (connected / error / unused)
- [ ] **MCP-02**: Per-tool health (last call, error rate from callGraphEdges) is visible
- [ ] **MCP-03**: A per-tool prune/disable affordance (chip) exists — governance-focused, not a marketplace clone

### Knowledge Graph (KG) — Phase 74

> Visualizes Ástríðr's temporal knowledge graph (consolidates the original KG Wave 1 + Wave 2). **Gated on Ástríðr Phase 125 (backfill) + Phase 126** (the read API these consume). Design authority: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`.

- [ ] **KG-01**: Operator sees always-on KG summary cards (entities by type, current vs historical triples, contradiction count, last-extraction time), rendered from pushed `kg_summary` telemetry so they show even when Ástríðr is offline
- [ ] **KG-02**: Operator browses a bounded whole-graph overview of entities + current relationships, filterable by entity type and agent, with truncation explicitly indicated when the cap is hit
- [ ] **KG-03**: Operator searches an entity by name and explores its ego graph (current facts + related entities) out to a selectable number of hops (1–3)
- [ ] **KG-04**: Operator scrubs an "as-of" date to view the KG as it was at a past time, with superseded facts rendered visually distinct from current ones
- [ ] **KG-05**: Operator reviews flagged contradictions (conflicting current beliefs) as a dedicated lens
- [ ] **KG-06**: Selecting an entity or edge shows its details (type, facts, confidence, validity window) and links each fact back to its source episodic memory in the existing Memory view (provenance)
- [ ] **KG-07**: Entities render as type-colored nodes with a legend; entity→entity triples render as labeled directed edges (confidence-weighted, current vs superseded styling); literal-object facts render as node attributes, not graph nodes

### Agent Console (CON) — Phase 75

> **Gated on Ástríðr M1.P0** (access & auth spike) + **M1.P3** (read-only gateway file/worktree browse). Convex is cloud → live = local-direct WS, history = Convex.

- [ ] **CON-01**: A task POSTed from the dashboard reaches the gateway (`POST :8200/tasks`) and starts a Claude Code or Codex run
- [ ] **CON-02**: The live run streams to the UI over a local-direct WS (not via Convex) into a run-reducer visualization
- [ ] **CON-03**: A cross-request Stop wires to Ástríðr `estop.py` via a cancellation flag (NOT pid-kill)
- [ ] **CON-04**: The completed run's summary persists to Convex for history

### Unified Graph Hub (HUB) — Phase 76

> **Depends on Phase 74 + Ástríðr M1.P4** (graphify + Obsidian snapshot uploader → Convex `{nodes,links}`).

- [ ] **HUB-01**: graphify-out and the Obsidian wikilink graph render from Convex-pushed snapshots
- [ ] **HUB-02**: KG Explorer, Tool Galaxy, and code/vault graphs are reachable from one Graphs hub with consistent interactions
- [ ] **HUB-03**: Cross-graph navigation (tool → owning agent → KG entity) works where the data supports it

### UI Polish (UI) — absorbed into Phase 71

- [ ] **UI-09**: All remaining dashboard icons standardized to a single icon system across every dashboard surface (completes partial UI-08; now part of the Phase 71 design system)

### Production Hardening (OPS) — Phase 77

- [ ] **OPS-01**: `CODEPULSE_ALLOWED_ORIGIN` is set in the Convex cloud deployment and a deploy checklist documents it, so production CORS is correct for a non-local origin
- [ ] **OPS-02**: The Gitleaks secret-scan CI workflow passes (green) on `master`
- [N/A] **OPS-03**: The Supabase migration-drift CI check passes (green) on `master` — **N/A (satisfied upstream).** CodePulse has no `supabase/` schema directory, so there is nothing to drift-check. The migration-drift control lives in Ástríðr (`astridr-repo/.github/workflows/supabase-migration-check.yml`).

### Quality / Traceability (QA) — absorbed into Phase 71

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
| DS-01 | Phase 71 | Pending |
| DS-02 | Phase 71 | Pending |
| DS-03 | Phase 71 | Pending |
| DS-04 | Phase 71 | Pending |
| UI-09 | Phase 71 | Pending |
| QA-01 | Phase 71 | Pending |
| GAL-01 | Phase 72 | Pending |
| GAL-02 | Phase 72 | Pending |
| GAL-03 | Phase 72 | Pending |
| GAL-04 | Phase 72 | Pending |
| MCP-01 | Phase 73 | Pending |
| MCP-02 | Phase 73 | Pending |
| MCP-03 | Phase 73 | Pending |
| KG-01 | Phase 74 | Pending |
| KG-02 | Phase 74 | Pending |
| KG-03 | Phase 74 | Pending |
| KG-04 | Phase 74 | Pending |
| KG-05 | Phase 74 | Pending |
| KG-06 | Phase 74 | Pending |
| KG-07 | Phase 74 | Pending |
| CON-01 | Phase 75 | Pending |
| CON-02 | Phase 75 | Pending |
| CON-03 | Phase 75 | Pending |
| CON-04 | Phase 75 | Pending |
| HUB-01 | Phase 76 | Pending |
| HUB-02 | Phase 76 | Pending |
| HUB-03 | Phase 76 | Pending |
| OPS-01 | Phase 77 | Pending |
| OPS-02 | Phase 77 | Pending |
| OPS-03 | Phase 77 | N/A (upstream — astridr supabase-migration-check.yml) |
| FI-01 … FI-14 | 78–82 | ✅ Shipped 2026-06-17 (v7.0 complete) — see `milestones/v7.0-REQUIREMENTS.md` |
