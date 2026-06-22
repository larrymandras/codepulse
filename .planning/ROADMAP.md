# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- ✅ **v6.0 Agentic OS Front-End** — Phases 71-77 (71/72/73/74 shipped light; 77 complete 2026-06-18; **75 Agent Console superseded by v7.0 Forge** 2026-06-18; **76 Unified Graph Hub NOT shipped → deferred to v8.0** per 2026-06-18 reconciliation)
- ✅ **v7.0 Forge Integration** — Phases 78-82 (**shipped 2026-06-17**) — Forge→CodePulse Surface-Substrate fold-in — [archive](milestones/v7.0-ROADMAP.md)
- 🟦 **v8.0 Graph/KG Consolidation** — Phases 83-87 (**started 2026-06-18**) — unified Graphs hub + KG depth features

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

<details>
<summary>✅ v6.0 Agentic OS Front-End (Phases 71-77) — CLOSED 2026-06-18 (75 superseded by Forge)</summary>

> **Reframed 2026-06-09**, **parked 2026-06-16** in favor of the active v7.0 Forge Integration milestone. Phases 71/72/73/74 shipped (light-mode execution); **Phase 76 (Unified Graph Hub) was NOT shipped — reconciliation 2026-06-18 found only the 3 standalone graph pages exist; HUB-01/02/03 deferred to v8.0.** **Phase 77 (CI & Prod Hardening) is ✅ complete (3/3, verified 2026-06-18 — OPS-01/02 done, OPS-03 N/A).** **Phase 75 (Agent Console) is SUPERSEDED by v7.0 Forge (decided 2026-06-18).** Its gates — Ástríðr M1.P0 (scoped token) + M1.P3 (gateway browse) — cleared 2026-06-10, but the Agent Console capability (launch/stop + live logs + file preview) was instead delivered through the **Forge daemon + Convex bridge** (v7.0, phases 80-82), a more robust transport than browser-direct-to-localhost. The 6 planned-but-unexecuted Phase 75 plans are retired (see `phases/75-agent-console/75-SUPERSEDED.md`). Requirements (DS/GAL/MCP/KG/CON/HUB/OPS) retained in REQUIREMENTS.md — nothing dropped.

- [x] Phase 71: Unified Design System — shipped (light)
- [x] Phase 72: Tool / Capability Galaxy — shipped (light)
- [x] Phase 73: MCP Inventory + Health — shipped (light)
- [x] Phase 74: Temporal-KG Explorer — shipped (light)
- [~] **Phase 75: Agent Console** — 🔁 superseded by v7.0 Forge (2026-06-18); gates M1.P0+M1.P3 cleared, capability delivered via Forge bridge
- [ ] Phase 76: Unified Graph Hub — ❌ NOT shipped (only the 3 standalone graph pages exist); HUB-01/02/03 deferred to v8.0 (reconciled 2026-06-18)
- [x] **Phase 77: CI & Production Hardening** — ✅ complete (3/3; OPS-01 `CODEPULSE_ALLOWED_ORIGIN` + `docs/DEPLOY.md`, OPS-02 gitleaks green on master, OPS-03 N/A) — verified 2026-06-18

See full detail + success criteria in git history (`5c5c85a:.planning/ROADMAP.md`) and `.planning/REQUIREMENTS.md`.

</details>

---

## v7.0 Forge Integration — ✅ SHIPPED (2026-06-17)

**All 5 phases (78–82) complete + verified live.** Forge folded into CodePulse via the Surface-Substrate bridge (state UP via httpActions, commands DOWN via a Convex queue). Full archive + stats: [milestones/v7.0-ROADMAP.md](milestones/v7.0-ROADMAP.md) · requirements: [milestones/v7.0-REQUIREMENTS.md](milestones/v7.0-REQUIREMENTS.md).

<details>
<summary>v7.0 phase detail (archived 2026-06-17)</summary>

**Milestone goal:** Make Forge a first-class CodePulse module so all coding-agent work happens in one application — without moving Forge's execution engine off the local machine.

**Core constraint:** Forge's engine must stay LOCAL (spawns local CLIs, manages local processes, reads local workspace files/artifacts, tails local logs — Convex cloud cannot). So this is a **cloud-frontend ↔ local-backend bridge** via the Surface-Substrate pattern: Forge runs as a local daemon emitting state UP via an `/ingest`-style httpAction (same role Ástríðr plays), and CodePulse sends commands DOWN via a Convex command queue the daemon polls. Clerk-gated. **Rejected:** a cloud tab calling `http://localhost` directly (mixed-content blocked).

Phases are sequenced so each ships independently and the riskiest unknown (live-log streaming) is isolated late.

### Phase 78: Forge Emitter + Convex Schema
**Status**: ✅ SHIPPED (read-only foundation)
**Goal**: A local Forge daemon emits job/workspace state UP to Convex; CodePulse stores and can query it. No UI, commands, or logs yet.
**Requirements**: FI-01 (forge schema), FI-02 (emitter + `/forge-ingest`), FI-03 (read query API)
**Depends on**: Forge Phase 5 (shipped)
**Cross-repo**: paired with Forge's own roadmap Phase 6 "Event Emitter" (emitter half lands in the `forge` repo)
**Artifacts**: `phases/078-forge-emitter-convex-schema/` (CONTEXT + PLAN + SUMMARY)

### Phase 79: Forge UI Tab (read-only render)
**Status**: ✅ SHIPPED (PR #20)
**Goal**: A `/forge` route + nav entry rendering jobs/status/detail from `useQuery(api.forge.*)`, porting StatusBadge/JobList/JobDetail ~1:1 from `forge/web/src`. View-only.
**Requirements**: FI-04 (forge page + route), FI-05 (component port)
**Depends on**: Phase 78
**Plans**: 3/3 complete (3 waves) — see `phases/79-forge-ui-tab-read-only-render/`

### Phase 80: Command Bridge (launch + stop)
**Status**: ✅ COMPLETE (4/4 plans, 3 waves) — verified live 2026-06-16 (bridge launch + stop round-trip)
**Goal**: A Convex `forgeCommands` queue the daemon long-polls; launch/stop → command → daemon executes → status reflects back. Port NewJobModal. Clerk-gated mutations.
**Requirements**: FI-06 (command queue + daemon poll), FI-07 (launch/stop UI), FI-08 (auth gating)
**Depends on**: Phase 79 (shipped)
**Success Criteria** (what must be TRUE):
  1. An enqueued launch/stop command in `forgeCommands` is delivered to the daemon exactly once via long-poll, and its execution status reflects back into `forgeJobs`
  2. Operator launches a new Forge job (ported NewJobModal) and stops a running job from `/forge`, round-tripping through the queue
  3. Command-issuing mutations are Clerk-gated — no unauthenticated write path to launch/stop
**Plans**: 4 plans (2 waves)
  - [x] 80-01-PLAN.md — Convex backend: forgeCommands/forgeHosts schema, Clerk fail-closed enqueue mutations, daemon claim/ack httpActions, TTL cron, tests (FI-06, FI-08)
  - [x] 80-02-PLAN.md — Cross-repo Forge daemon CommandPoller: poll → claim → execute (launch/stop) → ack; reflect-back via existing emitter (FI-06)
  - [x] 80-03-PLAN.md — Launch UI: useForge hooks, ForgeStatusBadge variants, trimmed ForgeLaunchModal + host picker, Clerk-gated Launch button + optimistic pending rows (FI-07, FI-08)
  - [x] 80-04-PLAN.md — Stop UI: ForgeStopConfirmDialog (work-discard warning) + ForgeJobDetail Stop wiring with honest Stopping… async (FI-07, FI-08)

### Phase 81: Live Log Streaming
**Status**: ✅ COMPLETE (4/4 plans, 3 waves) — verified live 2026-06-17 (Forge→CodePulse log round-trip; closes Forge 08-HUMAN-UAT). VERIFICATION: passed (4/4 criteria).
**Goal**: Stream live job logs into the read-only Forge UI tab. **Design locked in `phases/081-live-log-streaming/081-SPEC.md` (2026-06-15)** — supersedes the original "HIGH-risk direct daemon→browser SSE/WebSocket spike." Logs flow Forge → `POST /forge-log-ingest` → append-only `forgeLogChunks` table → reactive `forge.listJobLogs` query; **Convex reactivity IS the live stream** (no SSE/WS to build). Risk dropped from HIGH to LOW.
**Requirements**: FI-09 (log-ingest endpoint + append-only `forgeLogChunks` + `seq` idempotency), FI-10 (LogViewer renders live tail via reactive `listJobLogs`), FI-11 (retention: 7-day TTL cron + per-job byte cap)
**Depends on**: Phase 80
**Locked decisions** (from 081-SPEC):
  - **D-1**: monotonic per-job `seq` (required on envelope) → deterministic ordering + idempotent re-delivery
  - **D-2**: 7-day TTL cron **+** per-job byte/chunk cap (drop-oldest) — a deliverable with a test, not deferred (~1 MB/job suggested)
  - **D-3**: reuse `FORGE_INGEST_API_KEY` (separate `FORGE_LOG_INGEST_URL` gate, shared key)
**Success Criteria** (what must be TRUE):
  1. `POST /forge-log-ingest` with `{type:"log", hostId, forgeJobId, lines, seq}` + valid bearer appends a chunk; repeat `(hostId,forgeJobId,seq)` is a no-op; bad body → 400; bad bearer → 401; OPTIONS → CORS
  2. `forge.listJobLogs({hostId, forgeJobId})` returns chunks ordered by `seq`; the Forge UI tab renders them and updates live as chunks arrive
  3. A scheduled sweep enforces the 7-day TTL AND per-job byte cap — verified by a cron/cleanup test
  4. **Cross-repo handoff** (Forge side, ~1 task): `makeLogSink` no-op → real `fetch` to `/forge-log-ingest`; set `FORGE_LOG_INGEST_URL`; live round-trip closes Forge `08-HUMAN-UAT.md`
**Plans**: 4 plans (3 waves)
  - [x] 81-01-PLAN.md — Receiver: forgeLogChunks schema + /forge-log-ingest httpAction + appendLogChunk (seq-idempotent) + listJobLogs + contract test (FI-09)
  - [x] 81-02-PLAN.md — Retention: sweepForgeLogChunks (7-day TTL + per-job ~1 MB cap, drop-oldest) + daily cron + cleanup test (FI-11)
  - [x] 81-03-PLAN.md — UI: useForgeJobLogs hook + ForgeLogPane (auto-follow tail / pause / jump-to-latest) behind a Details/Logs tab in ForgeJobDetail (FI-10)
  - [x] 81-04-PLAN.md — Cross-repo: finalize Forge makeLogSink (real fetch + seq, T-6-KEYLEAK) + live round-trip, closes Forge 08-HUMAN-UAT (FI-09/10/11)

### Phase 82: Files + Artifact Preview + Hardening
**Status**: 📋 ACTIVE
**Goal**: Browse a terminal job's workspace files and preview text/code/HTML + image artifacts in the cloud `/forge` UI, with metadata + capped bytes flowing daemon → Convex → cloud (the Surface-Substrate bridge used for logs in Phase 81 — NOT a tunnel/local-https/localhost path); plus end-to-end auth correctness, OPS-01 production CORS + deploy checklist, and empty/loading/error polish.
**Requirements**: FI-12 (files/preview), FI-13 (artifact reachability), FI-14 (hardening)
**Depends on**: Phase 81
**Success Criteria** (what must be TRUE):
  1. Operator browses a job's workspace files and previews artifacts in `/forge` (ported FileBrowser / ArtifactPreview)
  2. Artifact/file content is reachable from the cloud UI via the Convex bounded-ingest bridge (no mixed-content `http://localhost`; tunnel/local-https rejected per 82-SPEC)
  3. End-to-end auth gating across the Forge surface; the full launch→run→logs→artifacts path is auth-correct and production-ready
**Plans**: 4 plans
  - [x] 82-01-PLAN.md — Convex receiver: forgeFiles/forgeArtifacts tables, bearer-authed /forge-file-ingest, listJobFiles/getJobArtifact queries
  - [x] 82-02-PLAN.md — Retention sweep (TTL + per-job cap, blob-before-row) + daily cron + OPS-01 deploy checklist
  - [x] 82-03-PLAN.md — UI port: useForgeJobFiles hooks, FileBrowser + ArtifactPreview (sandboxed), ForgeFilesPane + Files tab
  - [x] 82-04-PLAN.md — Cross-repo forge daemon: workspace enumeration + emitFiles + live round-trip (forge repo) — listing bridge verified live (forge fix a31dca4); preview-bytes codex-sandbox ACL block **fixed in forge `dbfad91`** (icacls grant on promoteWorkspace) — **live end-to-end preview round-trip still pending operator verification** (per 82-04-SUMMARY § CHECKPOINT)

## Execution Order

```
Phase 78 (Emitter + Schema)        ✅ SHIPPED
        │
Phase 79 (UI Tab, read-only)       ✅ SHIPPED (PR #20)
        │
Phase 80 (Command Bridge)          ◀── NEXT — launch/stop queue + Clerk gating
        │
Phase 81 (Live Log Streaming)      design LOCKED (081-SPEC) — Convex-reactive, LOW risk
        │
Phase 82 (Files + Preview + Hardening)  Convex bounded-ingest bridge + e2e auth + OPS-01 + polish
```

**Critical path:** 80 → 81 → 82, strictly sequential (each builds on the prior surface). Phase 81's risk was retired by the locked SPEC.
**Cross-repo:** Forge-side counterparts land in the `forge` repo (emitter ✅ Phase 6; log sink `makeLogSink` finalization in Phase 81; command-poll daemon for Phase 80).

</details>

---

## v8.0 Graph/KG Consolidation

**Milestone goal:** Operators explore all of Ástríðr's graphs — KG, tool galaxy, MCP, and the code/vault dependency graph — from one unified Graphs hub, with deeper KG search, clustering, saved views, and temporal diff.

**Context:** Ástríðr already pushes a `graph_snapshot` event (graphify code graph + Obsidian vault wikilinks → `{nodes,links}`) nightly to Convex `/runtime-ingest` (Phase 137, shipped 2026-06-09). CodePulse has no receiver, so those snapshots are currently dropped. v8.0 builds the receiver, the `/graphs` hub, cross-graph navigation, and four KG depth features.

### Phase Summary

- [x] **Phase 83: Graph Snapshot Receiver** — Convex table + ingest dispatch for `graph_snapshot`; stops dropping Ástríðr's nightly snapshots (completed 2026-06-18)
- [x] **Phase 84: Graphs Hub + Code/Vault Render** — `/graphs` landing route + unified hub IA replacing the `placeholder:true` nav stub (3/3 plans; 7/7 must-haves + human UAT passed via Playwright on real Convex data; completed 2026-06-22 — see 84-HUMAN-UAT.md)
- [ ] **Phase 85: Cross-Graph Navigation** — deep-link tool → agent → KG entity across graph surfaces
- [ ] **Phase 86: KG Full-Text Search + Clustering Layout** — fact/relationship search backed by Ástríðr endpoint + community-aware graph layout
- [ ] **Phase 87: Saved Views + Temporal Diff** — named shareable graph views + KG diff/animation between two as-of points

## Phase Details

### Phase 83: Graph Snapshot Receiver
**Goal**: Ástríðr's nightly `graph_snapshot` events are stored in Convex instead of dropped, with a query API ready for downstream rendering
**Depends on**: Nothing (Ástríðr-side producer already ships)
**Requirements**: GH-01
**Success Criteria** (what must be TRUE):
  1. A `graph_snapshot` POST to `/runtime-ingest` populates a `graphSnapshots` Convex table — operator can verify by querying the table after Ástríðr's next nightly run
  2. Re-posting the same `snapshotId` is a no-op (idempotent full-replacement) — no duplicate rows accumulate over repeated runs
  3. `api.graphSnapshots.listSnapshots` and `api.graphSnapshots.getProjectGraph` queries return stored snapshot metadata and the active version's `{nodes,links}` payload respectively (final names reconciled in 83-RESEARCH Pattern 5)
  4. No existing `/runtime-ingest` dispatch paths are broken — all other event types continue routing correctly
**Plans**: 3 plans
- [x] 83-01-PLAN.md — Schema: graphSnapshots + graphSnapshotNodes + graphSnapshotLinks tables (row-based storage, D-01)
- [x] 83-02-PLAN.md — Receiver module (upsertGraphSnapshot versioned swap, getProjectGraph/listSnapshots, retention sweep) + dispatch case + cron + unit tests
- [x] 83-03-PLAN.md — Fixture-POST live round-trip verification (operator checkpoint)

### Phase 84: Graphs Hub + Code/Vault Render
**Goal**: The code and vault graph from Convex is visible in the UI, and all graph surfaces are reachable from one unified hub
**Depends on**: Phase 83
**Requirements**: GH-02, GH-03
**Success Criteria** (what must be TRUE):
  1. Navigating to `/graphs` shows the most recent code+vault snapshot rendered as a force-directed graph via `ForceGraphCanvas`, with a visible truncation indicator when the node cap is hit
  2. The "Graphs Hub" nav entry is no longer a `placeholder:true` stub — it routes to `/graphs` and renders real content
  3. KG Explorer, Tool Galaxy, MCP Inventory, and the code/vault graph are all reachable from `/graphs` as tabs or sections with consistent interaction patterns (zoom, pan, node selection)
  4. The hub renders gracefully when no snapshot has been stored yet (empty state) or when Ástríðr is offline
**Plans**: 3 plans (3 waves)
- [x] 84-01-PLAN.md — useProjectGraph hook + Wave 0 test scaffolding (fixture/mock + three test files) (GH-02, GH-03)
- [x] 84-02-PLAN.md — CodeVaultGraph: dual-palette render, source filter, truncation/freshness/integrity, detail panel, fullscreen (GH-02)
- [x] 84-03-PLAN.md — GraphsHub page (live tiles + hero) + /graphs lazy route + nav placeholder flip (GH-03)
**UI hint**: yes

### Phase 85: Cross-Graph Navigation
**Goal**: Selecting a node in one graph surface can navigate to the corresponding entity in another surface where the data supports the link
**Depends on**: Phase 84
**Requirements**: GH-04
**Success Criteria** (what must be TRUE):
  1. Selecting a tool node in Tool Galaxy navigates to (or highlights) its owning agent in the code/vault graph where a matching node exists
  2. Selecting an agent node navigates to related KG entities where a `{agent}` relationship exists in the KG
  3. Cross-graph links that have no data backing are silently absent — no broken nav or dead links appear
  4. Navigation preserves the originating graph's state so the operator can return to their prior context
**Plans**: 4 plans (2 waves)
  - [x] 85-01-PLAN.md — Shared focus plumbing: buildFocusUrl + normalized-exact match utils (focus-url.ts) + useFocusParam hook + from-param same-origin guard, with unit tests (GH-04)
  - [x] 85-02-PLAN.md — Tool Galaxy surface: eager tool→owning-agent link + inbound ?focus center + return chip (GH-04, SC#1)
  - [ ] 85-03-PLAN.md — CodeVaultGraph surface: eager agent→KG-entities link (via existing useKnowledgeGraph) + inbound ?focus center + return chip (GH-04, SC#2)
  - [ ] 85-04-PLAN.md — KnowledgeGraph destination: inbound entity-lens override (post-hydration) + center + return chip (GH-04, SC#2 landing)
**UI hint**: yes

### Phase 86: KG Full-Text Search + Clustering Layout
**Goal**: Operators can search across KG fact text and relationships (not just entity names), and large graphs render with legible community-cluster layout
**Depends on**: Phase 84
**Requirements**: KG-08, KG-09
**Success Criteria** (what must be TRUE):
  1. Typing a term in the KG search box returns fact-text and relationship-label matches, not just entity-name matches — results are distinct from the existing entity-name search
  2. The search is backed by the Ástríðr `/api/kg/search` endpoint; the cross-repo dependency is called out and gated appropriately in the plan
  3. Graphs with a `community` field on nodes render with co-community nodes visually clustered together (color-coded or spatially grouped), making large graphs scannable at a glance
  4. Graphs without the `community` field continue to render with the existing force-directed layout — no regression
**Plans**: TBD
**UI hint**: yes

### Phase 87: Saved Views + Temporal Diff
**Goal**: Operators can save and share named graph views, and can compare or animate the KG between two points in time
**Depends on**: Phase 84
**Requirements**: KG-10, KG-11
**Success Criteria** (what must be TRUE):
  1. Operator saves the current graph state (lens + filters + focus + hops) as a named view and retrieves it by name in a later session — beyond the existing last-state idb auto-persist
  2. A saved view can be shared via a URL or link that restores the same lens/filter/focus/hops configuration when opened
  3. Operator selects two as-of dates and sees nodes/edges that were added, removed, or changed between those dates rendered with distinct visual treatment (added/removed/changed)
  4. Operator can animate the KG forward through time, observing how the graph evolves — or step through manually
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7, 58 | v4.0 | 36/36 | Complete | 2026-04-14 |
| 59-70 | v5.0 | 23/23 | Complete | 2026-05-25 |
| 71-74 | v6.0 | shipped (light) | Complete | — |
| 75. Agent Console | v6.0 | — | 🔁 Superseded by v7.0 Forge | 2026-06-18 |
| 76. Unified Graph Hub | v6.0 | 0/3 | ❌ Not shipped → deferred to v8.0 | 2026-06-18 |
| 77. CI & Prod Hardening | v6.0 | 3/3 | ✅ Complete | 2026-06-18 |
| 78. Forge Emitter + Schema | v7.0 | ✅ | Complete | 2026-06-13 |
| 79. Forge UI Tab (read-only) | v7.0 | 3/3 | Complete (PR #20) | 2026-06-15 |
| 80. Command Bridge | v7.0 | 4/4 | Complete    | 2026-06-16 |
| 81. Live Log Streaming | v7.0 | 4/4 | Complete   | 2026-06-17 |
| 82. Files + Preview + Hardening | v7.0 | 4/4 | Complete | 2026-06-17 |
| 83. Graph Snapshot Receiver | v8.0 | 3/3 | Complete   | 2026-06-18 |
| 84. Graphs Hub + Code/Vault Render | v8.0 | 3/3 | Complete    | 2026-06-22 |
| 85. Cross-Graph Navigation | v8.0 | 2/4 | In Progress|  |
| 86. KG Full-Text Search + Clustering | v8.0 | 0/? | Not started | — |
| 87. Saved Views + Temporal Diff | v8.0 | 0/? | Not started | — |
| 88. Analytics Rollup Table | standalone | 0/? | Not started — quick unblock shipped + deployed 2026-06-20 (`edb614c`, branch `fix/analytics-convex-read-limit`) | — |

### Phase 88: Analytics Rollup Table — durable fix for Convex 16 MiB read-limit in analytics aggregation queries

**Goal:** Eliminate the Convex per-execution read-limit risk in `convex/analytics.ts` by reading pre-aggregated rollups instead of scanning raw `events` rows. The analytics queries (`activityHeatmap`, `toolFlowSankey`, `errorRateTrend`, `tokenSunburst`, `tokenWaterfall`) currently read full `events` documents whose `payload: v.any()` blobs are fat (~9 KB/row), just to aggregate `timestamp`/`eventType`. `activityHeatmap` hit the 16 MiB/exec read limit in prod (`tidy-whale-981`) and was quick-patched 2026-06-20 by lowering `.take()` caps (heatmap 5000→1000, sankey 2000→1000, errorRateTrend 500→300×3, llmMetrics `.collect()`→`.take(30000)`). That patch is fragile and count-caps fidelity — it regresses as payload sizes grow.

**Context:** Convex always reads whole documents (no column projection) and `.filter()` runs post-index-scan, so every analytics read pays the full `payload` byte cost. Quick unblock shipped to dev; this phase is the durable replacement.

**Approach (to refine in planning):** Maintain slim pre-aggregated rollup table(s) updated at ingest time (`convex/ingest.ts` / `runtimeIngest.ts`) — e.g. day-hour activity buckets, error-type counts per hour, llm token/cost totals per provider/model. Analytics queries then read O(buckets) instead of O(events). Once rollups are authoritative, restore full-fidelity analytics and remove the `.take()` caps.

**Acceptance:**
- All analytics queries read well under 16 MiB regardless of total event volume (verify via `npx convex run` byte WARN absence at scale).
- Heatmap / sankey / error-trend fidelity no longer bounded by `.take()` count caps.
- Rollups stay correct under ingest, archival, and backfill.

**Requirements**: TBD
**Depends on:** None — standalone observability hardening, independent of the v8.0 Graph/KG milestone (83–87).
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 88 to break down)

---

*Last updated: 2026-06-20 — **Phase 88 (Analytics Rollup Table) added** as standalone observability hardening after `analytics.ts` hit Convex's 16 MiB/exec read limit; quick unblock shipped + deployed (`edb614c`). v8.0 Graph/KG in progress (83 complete; 84-87 pending). Next: `/gsd-plan-phase 84` or `/gsd-plan-phase 88`.*
