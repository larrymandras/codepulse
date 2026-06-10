# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- 🔄 **v6.0 Agentic OS Front-End** — Phases 71-77 (in progress; 5/7 shipped — 71-74 + 77 merged to master 2026-06-09/10; **Phase 76 built but PR #14 open**; **Phase 75 not started**; reframed 2026-06-09 from the never-started "KG Observability & Hardening" roadmap)

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

### v6.0 Agentic OS Front-End (Phases 71-77)

> **Reframed 2026-06-09.** CodePulse is the rendering/control half of the two-milestone Agentic OS plan (companion: `C:\Users\mandr\html-out\agentic-os-milestones.md`; Ástríðr "Surface Substrate" = the data-emitting half). The original v6.0 "KG Observability & Hardening" (old phases 71-74) was never executed; its work is absorbed below — old KG Waves 1+2 → Phase 74; old UI polish → Phase 71; old CI hardening → Phase 77.

- [x] **Phase 71: Unified Design System** (merged PR #10, 2026-06-09) - Formalize a cohesive "Agentic OS" visual language (design tokens, component conventions, full icon standardization) and refactor the information architecture with new *Graphs* and *Agents/Console* nav clusters; the shared foundation every later phase renders against
- [x] **Phase 72: Tool / Capability Galaxy** (merged PR #11, 2026-06-09) - A force/R3F graph over discoveredTools + mcpServers + kits + callGraphEdges, with usage/recency glow and orphan (installed-but-unused) detection
- [x] **Phase 73: MCP Inventory + Health** (merged PR #13, 2026-06-09) - A tool-governance surface (server/tool inventory pills + per-tool health and prune chips); not a marketplace clone
- [x] **Phase 74: Temporal-KG Explorer** (merged PR #12, 2026-06-09) - The differentiated showpiece: browse entities, traverse predicates, ego graphs, an as-of temporal scrubber, a contradiction lens, and a KGDetailsPanel with provenance deep-links into the Memory view (consolidates the original KG Wave 1 + Wave 2)
- [ ] **Phase 75: Agent Console** — *not started* (was gated on Ástríðr M1.P0/M1.P3, which shipped in astridr v18.0 on 2026-06-10 — now unblocked) - Drive Claude Code + Codex from the dashboard: POST a task to the gateway → live local-direct WS stream → run-reducer viz → persist the run summary to Convex
- [ ] **Phase 76: Unified Graph Hub** — *built on `feat/phase-76-unified-hub`; **PR #14 open, not merged*** - graphify + Obsidian + KG + tool graphs unified in one navigable place
- [x] **Phase 77: CI & Production Hardening** (merged PR #15, 2026-06-10) - Green up Gitleaks secret-scan CI on master (OPS-02 ✅ green + block proven live) and set/document `CODEPULSE_ALLOWED_ORIGIN` for CORS (OPS-01 ✅, local-only); Supabase-drift N/A (OPS-03 — upstream in Ástríðr)

## Phase Details

### Phase 71: Unified Design System
**Goal**: One cohesive "Agentic OS" visual language exists as a documented, token-backed system, and the dashboard's information architecture is refactored to surface the new Graphs and Agents/Console clusters
**Depends on**: Nothing — the foundation for all later UI phases
**Requirements**: DS-01, DS-02, DS-03, DS-04, UI-09, QA-01
**Success Criteria** (what must be TRUE):
  1. A documented design-token layer (color/type/spacing/elevation/motion) backs the dashboard, sourced from an audit of the *live* current styling (resolving the PROJECT.md "shadcn New York + oklch" vs CLAUDE.md "Tailwind-only + Cinzel/Geist" doc conflict to a single ground-truth system)
  2. A documented set of shared primitives/conventions (MetricCard, EntityRow, panels, chart wrappers) covers the patterns repeated across the 15 pages
  3. The nav/IA is refactored to add a *Graphs* cluster and an *Agents/Console* cluster without breaking existing routes
  4. Every icon across all dashboard surfaces is a single icon system (completes the old UI-09)
  5. The active REQUIREMENTS traceability table reflects shipped state and a phase-completion step keeps it current (old QA-01)
  6. A UI-SPEC + visual sketch is approved by Larry before the 15-page migration begins
**Plans**: TBD
**UI hint**: yes

### Phase 72: Tool / Capability Galaxy
**Goal**: Operators see all discovered tools, MCP servers, and kits as a living graph with usage/recency signal and orphan detection
**Depends on**: Phase 71 (design system); Ástríðr **M1.P1 callGraphEdges emitter** ✅ built (tool_executed → callGraphEdges) — table is no longer sparse
**Requirements**: GAL-01, GAL-02, GAL-03, GAL-04
**Success Criteria** (what must be TRUE):
  1. The graph renders nodes for discoveredTools + mcpServers + kits and edges from callGraphEdges (agent↔tool), laid out as a navigable force/R3F galaxy
  2. Node glow/size encodes usage frequency and recency from callGraphEdges callCount/errorCount/status
  3. Installed-but-unused tools (no edges) are visually flagged as orphans
  4. Filtering by agent/persona and by MCP server works without a full reload
**Plans**: TBD
**UI hint**: yes

### Phase 73: MCP Inventory + Health
**Goal**: Operators have a tool-governance surface to inventory MCP servers/tools and act on unhealthy or unused ones
**Depends on**: Phase 71 (design system); Ástríðr M1.P1 emitter ✅ built
**Requirements**: MCP-01, MCP-02, MCP-03
**Success Criteria** (what must be TRUE):
  1. Every MCP server and its tools are listed with status pills (connected/error/unused)
  2. Per-tool health (last call, error rate from callGraphEdges) is visible
  3. A per-tool prune/disable affordance exists (chip), governance-focused — not a marketplace clone
**Plans**: TBD
**UI hint**: yes

### Phase 74: Temporal-KG Explorer
**Goal**: Operators browse Ástríðr's temporal knowledge graph — summary cards, overview, entity ego graphs, an as-of temporal scrubber, a contradiction lens, and provenance deep-links into Memory (consolidates the original KG Wave 1 + Wave 2)
**Depends on**: Phase 71 (design system)
**External dependency**: Ástríðr **Phase 126** (HTTP KG read API: /api/kg/summary, /overview, /entity, /contradictions + asOf param + kg_summary telemetry emitter) AND **Phase 125** (backfill — graph must contain real data). Implementation is BLOCKED until both ship.
**Design authority**: `docs/superpowers/specs/2026-06-01-astridr-kg-visualization-design.md`
**Requirements**: KG-01, KG-02, KG-03, KG-04, KG-05, KG-06, KG-07
**Success Criteria** (what must be TRUE):
  1. Always-on summary cards (entities by type, current vs historical triples, contradiction count, last-extraction time) render from pushed kg_summary telemetry even when Ástríðr is offline
  2. The Overview lens renders a bounded force-directed top-N graph, filterable by entity type and agent, with a truncation notice when the cap is hit
  3. The Entity (ego) lens searches by name and renders the ego graph out to a selectable 1–3 hops
  4. The Temporal lens exposes an as-of date scrubber that re-fetches the graph as of that date, superseded facts dashed/dimmed
  5. The Contradiction lens renders all contradiction-flagged triples; KGDetailsPanel lists each conflicting pair with subject/predicate/objects/confidence
  6. Selecting an entity/edge opens KGDetailsPanel (type, facts, confidence, validity window); facts with a sourceEventId deep-link into the Memory view
  7. Type-colored nodes with legend; entity→entity triples as directed confidence-weighted edges (current solid / superseded dashed-dim); literal-object facts render as attributes, not nodes
  8. The shared ForceGraphCanvas is extracted from ObsidianGraph.tsx (ObsidianGraph still passes its tests); kgApi.ts (typed fetch) and kg-graph.ts (pure transform) are separate, each tested
**Plans**: TBD
**UI hint**: yes

### Phase 75: Agent Console
**Goal**: Operators drive Claude Code + Codex from the dashboard and watch runs live, with run summaries persisted
**Depends on**: Phase 71 (design system)
**External dependency**: Ástríðr **M1.P0** (access & auth spike — localhost-direct vs tunnel; scoped token) AND **M1.P3** (read-only gateway file/worktree browse routes). BLOCKED until both ship.
**Convex note**: Convex is **cloud** — it cannot reach localhost agents or stream NDJSON. Live = local-direct WS to the gateway; only the run summary is persisted to Convex.
**Requirements**: CON-01, CON-02, CON-03, CON-04
**Success Criteria** (what must be TRUE):
  1. A task POSTed from the dashboard reaches the gateway (`POST :8200/tasks`) and starts a Claude Code or Codex run
  2. The live run streams to the UI over a local-direct WS (not via Convex) into a run-reducer visualization
  3. A cross-request Stop wires to Ástríðr `estop.py` via a cancellation flag (NOT pid-kill)
  4. The completed run's summary persists to Convex for history
**Plans**: TBD
**UI hint**: yes

### Phase 76: Unified Graph Hub
**Goal**: graphify, Obsidian, KG, and tool graphs are unified in one navigable place
**Depends on**: Phase 74 (KG Explorer) AND Ástríðr **M1.P4** (graphify + Obsidian graph snapshot uploader → Convex `{nodes,links}`)
**Requirements**: HUB-01, HUB-02, HUB-03
**Success Criteria** (what must be TRUE):
  1. graphify-out and the Obsidian wikilink graph render from Convex-pushed snapshots
  2. The KG Explorer, Tool Galaxy, and code/vault graphs are reachable from one Graphs hub with consistent interactions
  3. Cross-graph navigation (e.g. tool → owning agent → KG entity) works where the data supports it
**Plans**: TBD
**UI hint**: yes

### Phase 77: CI & Production Hardening
**Goal**: The master CI pipeline runs clean and production deployments use the correct CORS origin (carried forward from the original v6.0 P71)
**Depends on**: Nothing — no external dependencies; runnable any time
**Requirements**: OPS-01, OPS-02, OPS-03
**Success Criteria** (what must be TRUE):
  1. The Gitleaks secret-scan workflow completes green on master with no suppressed findings
  2. The Supabase migration-drift workflow completes green on master, reflecting the current schema state
  3. `CODEPULSE_ALLOWED_ORIGIN` is set in the Convex cloud deployment and a deploy checklist documents the value + procedure
  4. A developer following the checklist can configure CORS for a non-local origin without guessing
  (Note: success criterion #2 — Supabase migration-drift — is N/A for CodePulse; satisfied upstream in astridr-repo `supabase-migration-check.yml`. OPS-03 marked N/A.)
**Plans**: 3 plans
- [x] 77-01-PLAN.md — Fail-closed CORS allowlist in ingestAuth.ts + 8 handler updates + unit tests (OPS-01)
- [x] 77-02-PLAN.md — Gitleaks secret-scan workflow + config (Astridr mirror) + clean full-history baseline (OPS-02)
- [ ] 77-03-PLAN.md — Deploy checklist + CODEPULSE_ALLOWED_ORIGIN in Convex prod + manual secret-block test + OPS-03 N/A (OPS-01/02/03)

## Execution Order

```
Phase 71 (Unified Design System)   Execute now — foundation, no blockers
        │
        ├──► Phase 72 (Tool Galaxy)        M1.P1 emitter ✅ built — ready after 71
        ├──► Phase 73 (MCP Inventory)      M1.P1 emitter ✅ built — ready after 71
        └──► Phase 74 (KG Explorer)        ⛔ Ástríðr Phase 125 + 126
Phase 77 (CI & Prod Hardening)     Execute any time — no blockers (parallel-safe)
Phase 75 (Agent Console)           ⛔ Ástríðr M1.P0 + M1.P3
Phase 76 (Unified Graph Hub)       After Phase 74 + Ástríðr M1.P4
```

**Critical path:** Phase 71 (design system) gates all UI phases; Phase 74 is gated on Ástríðr Phase 125 + 126; Phases 75/76 on the Ástríðr Surface Substrate access + snapshot phases.
**Immediately executable:** Phase 71 (now), then Phases 72/73 (M1.P1 already built), and Phase 77 any time.

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7, 58 | v4.0 | 36/36 | Complete | 2026-04-14 |
| 59-70 | v5.0 | 23/23 | Complete | 2026-05-25 |
| 71. Unified Design System | v6.0 | 0/TBD | Discovery | - |
| 72. Tool / Capability Galaxy | v6.0 | 0/TBD | Not started (M1.P1 ✅) | - |
| 73. MCP Inventory + Health | v6.0 | 0/TBD | Not started (M1.P1 ✅) | - |
| 74. Temporal-KG Explorer | v6.0 | 0/TBD | Not started (ext. blocked) | - |
| 75. Agent Console | v6.0 | 0/TBD | Not started (ext. blocked) | - |
| 76. Unified Graph Hub | v6.0 | 0/TBD | Not started (dep) | - |
| 77. CI & Production Hardening | v6.0 | 2/3 | In Progress|  |

---

*Last updated: 2026-06-09 — v6.0 reframed "KG Observability & Hardening" → "Agentic OS Front-End": 7 phases (71-77). Old KG Waves → Phase 74; old UI polish → Phase 71; old CI hardening → Phase 77.*
