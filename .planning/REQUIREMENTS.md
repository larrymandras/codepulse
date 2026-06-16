# CodePulse — Requirements

**Current milestone:** v7.0 Forge Integration *(activated 2026-06-16; promoted 2026-06-13 from backlog 999.1)*
**Parked milestone:** v6.0 Agentic OS Front-End — phases 71/72/73/74/76 shipped; **75 (Agent Console) + 77 (CI/Prod Hardening, 2/3 plans) parked** pending Ástríðr Surface-Substrate gates. Requirements retained below, re-activate later.
**Prior milestones:** v4.0 (`.planning/milestones/v4.0-REQUIREMENTS.md`), v5.0 (`.planning/milestones/v5.0-REQUIREMENTS.md`)
**Companion plan:** `C:\Users\mandr\html-out\agentic-os-milestones.md` (the two-milestone Agentic OS plan; CodePulse = the rendering/control half)

---

## v7.0 Forge Integration Requirements

> **Goal:** Make Forge (the local coding-agent runner) a first-class CodePulse module so all coding-agent work happens in one application — without moving Forge's execution engine off the local machine. Forge runs as a local daemon emitting state UP via an `/ingest`-style httpAction (the Surface-Substrate pattern Ástríðr already uses); CodePulse sends commands DOWN via a Convex command queue the daemon polls. Clerk-gated. *(Rejected: a cloud tab calling `http://localhost` directly — mixed-content blocked.)*

### Forge Foundation (FI) — Phase 78 ✅ shipped

- [x] **FI-01**: New Convex `forgeJobs` + `forgeWorkspaces` tables mirror the Forge job/workspace model (host-scoped, idempotent upsert keyed by `(hostId, forgeJobId)`) — Phase 78
- [x] **FI-02**: A local Forge emitter POSTs job state-change + periodic workspace sync to a bearer-authed `/forge-ingest` httpAction (server-to-server `FORGE_INGEST_API_KEY`; 401 on bad key, 400 on malformed body) — Phase 78
- [x] **FI-03**: Read query API (`listJobs`, `getJob`, `listWorkspaces`) returns persisted Forge state in the shape the UI consumes — Phase 78

### Forge UI Tab (FI) — Phase 79 ✅ shipped

- [x] **FI-04**: A `/forge` route + CONSOLE nav entry (Flame icon) renders jobs/status/detail from `useQuery(api.forge.*)`, view-only — Phase 79
- [x] **FI-05**: StatusBadge / JobList / JobDetail / MetadataPanel ported ~1:1 from `forge/web/src`, re-skinned to CodePulse tokens, action controls stripped (read-only) — Phase 79

### Command Bridge (FI) — Phase 80

- [x] **FI-06**: A Convex `forgeCommands` queue that the local daemon long-polls; an enqueued launch/stop command is delivered exactly once and its execution status reflects back into `forgeJobs`
- [x] **FI-07**: Operator can launch a new Forge job (port NewJobModal) and stop a running job from the `/forge` UI, with the action round-tripping through the command queue to the daemon — *launch path shipped in 80-03; stop path shipped in 80-04 (ForgeStopConfirmDialog + ForgeJobDetail wiring)*
- [x] **FI-08**: Command-issuing mutations are Clerk-gated (no unauthenticated launch/stop); the bridge never exposes a write path that bypasses auth

### Live Log Streaming (FI) — Phase 81 *(design locked in `081-SPEC.md`, 2026-06-15 — supersedes the original SSE/WebSocket-spike approach)*

- [x] **FI-09**: A bearer-authed `POST /forge-log-ingest` appends scrubbed log lines to an append-only `forgeLogChunks` table; a monotonic per-job `seq` makes re-delivery idempotent (`(hostId, forgeJobId, seq)` unique), 400 on bad body / 401 on bad bearer / CORS preflight (reuses `FORGE_INGEST_API_KEY`, D-3)
- [x] **FI-10**: The Phase 79 Forge UI tab renders a per-job log pane from a reactive `forge.listJobLogs` query ordered by `seq` and **updates live** as chunks land — no SSE/WebSocket transport to build (Convex reactivity is the stream)
- [x] **FI-11**: A scheduled retention sweep enforces a 7-day TTL **and** a per-job byte/chunk cap (drop-oldest), bounding both total storage and any single runaway job — verified by a cron/cleanup test (D-2)

### Files + Artifact Preview + Hardening (FI) — Phase 82

- [ ] **FI-12**: Operator can browse a job's workspace files and preview artifacts in the `/forge` UI (port FileBrowser / ArtifactPreview)
- [ ] **FI-13**: Artifact/file content is reachable from the cloud UI without direct-localhost access (daemon tunnel or local-https path — not mixed-content `http://localhost`)
- [ ] **FI-14**: End-to-end Clerk gating across the Forge surface + polish; the full launch→run→logs→artifacts path is auth-correct and production-ready

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
| FI-01 | Phase 78 | ✅ Shipped |
| FI-02 | Phase 78 | ✅ Shipped |
| FI-03 | Phase 78 | ✅ Shipped |
| FI-04 | Phase 79 | ✅ Shipped (PR #20) |
| FI-05 | Phase 79 | ✅ Shipped (PR #20) |
| FI-06 | Phase 80 | Complete |
| FI-07 | Phase 80 | Complete (launch 80-03 + stop 80-04) |
| FI-08 | Phase 80 | Complete |
| FI-09 | Phase 81 | Complete |
| FI-10 | Phase 81 | Complete |
| FI-11 | Phase 81 | Complete |
| FI-12 | Phase 82 | Pending |
| FI-13 | Phase 82 | Pending |
| FI-14 | Phase 82 | Pending |
