# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- ✅ **v6.0 Agentic OS Front-End** — Phases 71-77 (71/72/73/74 shipped light; 77 complete 2026-06-18; **75 Agent Console superseded by v7.0 Forge** 2026-06-18; **76 Unified Graph Hub deferred to v8.0 and DELIVERED there (phases 83/84/85, GH-01..04)** — reconciled 2026-06-29)
- ✅ **v7.0 Forge Integration** — Phases 78-82 (**shipped 2026-06-17**) — Forge→CodePulse Surface-Substrate fold-in — [archive](milestones/v7.0-ROADMAP.md)
- ✅ **v8.0 Graph/KG Consolidation** — Phases 83-87 (**shipped 2026-06-23**) — unified Graphs hub + KG depth features — [archive](milestones/v8.0-ROADMAP.md)
- ✅ **v9.0 Readability & Experience** — Phases 88-92 (**shipped 2026-06-29**) — durable analytics rollup, readable theme system + editorial skin, Agent Room, 3D Memory Galaxy, voice command palette — [archive](milestones/v9.0-ROADMAP.md)
- ✅ **v10.0 Eval & Trace Observability + Hardening** — Phases 93-96 (**shipped 2026-07-07**; Phase 96 UI deep-dive cleanup addendum completed 2026-07-13) — eval pipeline + ingest, native trace waterfall, security audit + key rotation + dependency majors, UI truth/consistency sweep — [archive](milestones/v10.0-ROADMAP.md)
- ✅ **v11.0 Skills Command Center — Full Lifecycle & Launch** — Phases 97-100 (**shipped 2026-07-25**, 22/22 requirements; tagged `v11.0`) — real skill intake, full lifecycle mutations (archive/restore/move/delete), skill launch/dispatch to Chat/Forge-agent/Ástríðr, control-surface UX — cross-repo Forge daemon executor — [archive](milestones/v11.0-ROADMAP.md) · [audit](milestones/v11.0-MILESTONE-AUDIT.md)
- ✅ **v12.0 Personal Productivity — Reminders & Calendar** — Phases 101-102 (**shipped 2026-07-23**, 10/10 plans; tagged `v12.0`) — profile-segmented reminders (personal/business/consulting) with bidirectional CodePulse↔Ástríðr sync, recurrence, proactive nudges, and a read-only Google Calendar overlay per profile — cross-repo (codepulse + astridr-repo) — [archive](milestones/v12.0-ROADMAP.md)
- ✅ **v13.0 Brain-Swap Control, Cost Intelligence & Consolidation** — Phases 103-107 (**shipped 2026-08-06**, 53 plans, 14/15 requirements — BSC-01 PARTIAL by design) — CodePulse control surface for Ástríðr's on-the-fly reasoning-engine swap, per-model cost intelligence + budget alerts, tool/trace observability, and a consolidation/hardening pass — [archive](milestones/v13.0-ROADMAP.md)
- 🚧 **v14.0 Per-Agent Engine Visibility, Convex Durability & Mission Board** — Phases 108-113 (**in progress**, formalized 2026-08-06) — closes BSC-01's deferred per-agent axis (cross-repo astridr emitter + scoped `swap.set`), Convex durability (aggregates pruning, retention verification, memory-growth root cause), a frontend-only mission board, telemetry-coverage closure, and a small-debt sweep
- 📋 **Queued: Borealis Console UI overhaul** — earmarked as v15.0 (held whole — do not pull pieces into v14.0) — see `Skill("sketch-findings-codepulse")` + CLAUDE.md Design Findings
- 📋 **Queued: Project Lifecycle Cockpit** (version TBD, after Borealis or merged at planning time) — Mission Control Slice 3 (dispatch composer + unified session Inbox) + Project Factory (New Project wizard → `C:\dev` + GitHub + relayed GSD kickoff) + Projects lifecycle view (Active/Archived/Scrapped tiers; archive/restore/scrap/purge with safety preflights) + ship gates + tailnet cockpit — **gated on Forge v4.0 Interactive Sessions** — brief: [seeds/SEED-004-project-lifecycle-cockpit.md](seeds/SEED-004-project-lifecycle-cockpit.md), full spec in vault `runbooks/agentic-os-project-runbook.md`; formalize via `/gsd-new-milestone` when Forge v4.0 lands

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

> **Reframed 2026-06-09**, **parked 2026-06-16** in favor of the active v7.0 Forge Integration milestone. Phases 71/72/73/74 shipped (light-mode execution); **Phase 76 (Unified Graph Hub) was deferred to v8.0 and FULLY DELIVERED there — v8.0 phases 83 (Snapshot Receiver, GH-01), 84 (Graphs Hub + Code/Vault Render, GH-02/03), 85 (Cross-Graph Navigation, GH-04); 8/8 reqs, audit PASSED. The live `/graphs` hub (3 tiles + Code/Vault snapshot hero) is that work. Reconciled 2026-06-29 against live UI + git.** **Phase 77 (CI & Prod Hardening) is ✅ complete (3/3, verified 2026-06-18 — OPS-01/02 done, OPS-03 N/A).** **Phase 75 (Agent Console) is SUPERSEDED by v7.0 Forge (decided 2026-06-18).** Its gates — Ástríðr M1.P0 (scoped token) + M1.P3 (gateway browse) — cleared 2026-06-10, but the Agent Console capability (launch/stop + live logs + file preview) was instead delivered through the **Forge daemon + Convex bridge** (v7.0, phases 80-82), a more robust transport than browser-direct-to-localhost. The 6 planned-but-unexecuted Phase 75 plans are retired (see `phases/75-agent-console/75-SUPERSEDED.md`). Requirements (DS/GAL/MCP/KG/CON/HUB/OPS) retained in REQUIREMENTS.md — nothing dropped.

- [x] Phase 71: Unified Design System — shipped (light)
- [x] Phase 72: Tool / Capability Galaxy — shipped (light)
- [x] Phase 73: MCP Inventory + Health — shipped (light)
- [x] Phase 74: Temporal-KG Explorer — shipped (light)
- [~] **Phase 75: Agent Console** — 🔁 superseded by v7.0 Forge (2026-06-18); gates M1.P0+M1.P3 cleared, capability delivered via Forge bridge
- [x] Phase 76: Unified Graph Hub — ✅ delivered by v8.0 phases 83/84/85 (GH-01..04); live at `/graphs`. Open gap: tile index covers 3 of ~6 surfaces — missing Capabilities, 3D Memory Galaxy (Phase 91), Hive/Swarm (tracked for next milestone). Reconciled 2026-06-29.
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

**Status**: ✅ ACTIVE
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

<details>
<summary>✅ v8.0 Graph/KG Consolidation (Phases 83-87) — SHIPPED 2026-06-23</summary>

> Unified Graphs hub + KG depth features. Receiver for Ástríðr's nightly `graph_snapshot` (GH-01), `/graphs` hub replacing the placeholder nav stub (GH-02/03), cross-graph navigation (GH-04), community-cluster layout (KG-09), full-text Search lens (KG-08), saved/shareable views (KG-10), and temporal Diff/Animate (KG-11). 8/8 requirements; milestone audit PASSED (`v8.0-MILESTONE-AUDIT.md`). Full detail + per-phase success criteria archived in [milestones/v8.0-ROADMAP.md](milestones/v8.0-ROADMAP.md).

- [x] Phase 83: Graph Snapshot Receiver (3/3 plans) — GH-01 — 2026-06-18
- [x] Phase 84: Graphs Hub + Code/Vault Render (3/3 plans) — GH-02, GH-03 — 2026-06-22
- [x] Phase 85: Cross-Graph Navigation (4/4 plans) — GH-04 — 2026-06-22
- [x] Phase 86: KG Full-Text Search + Clustering (3/3 plans) — KG-08, KG-09 — 2026-06-23
- [x] Phase 87: Saved Views + Temporal Diff (4/4 plans) — KG-10, KG-11 — 2026-06-23

</details>

---

## v9.0 Readability & Experience

<details>
<summary>✅ v9.0 Readability & Experience (Phases 88-92) — SHIPPED 2026-06-29</summary>

> 19/19 requirements (TH-01..06, AR-01..03, ROOM-01..04, G3D-01..02, VOX-01..04). Full per-phase detail + success criteria archived in [milestones/v9.0-ROADMAP.md](milestones/v9.0-ROADMAP.md). The 2026-06-26 milestone audit captured a mid-flight `gaps_found` snapshot (Phases 90/91 then unbuilt); both shipped 2026-06-27..29.

**Milestone goal:** Make CodePulse readable and richer to operate — a readability-first theme system plus three experience surfaces (Agent Room, 3D graph mode, durable analytics).

**Phase summary:**

- [x] **Phase 88 — Analytics Rollup** — Durable Convex 16 MiB read-limit fix via ingest-time rollups (completed 2026-06-24)
- [x] **Phase 89 — Readable Themes & Editorial Skin Toggle** — Token-driven theming + Midnight Aubergine skin + no-flash switcher + WCAG-AA pass
 (completed 2026-06-24)

- [x] **Phase 90 — Agent Room / War Room** — ✅ COMPLETE (8/8, operator live sign-off 2026-06-29). Live participant identity + bounded listing + real operator Join + seq-ordered transcript — plus the cross-repo live integration that was never closed at scoping (LiveKit war-room profile, Convex deploy, astridr room/transcript ingest, delete-room feature, dialog/upsert fixes — see `phases/90-agent-room-war-room/90-INTEGRATION-NOTES.md` + `90-08-SUMMARY.md`).
- [x] **Phase 91 — 3D Memory Galaxy** — Opt-in `react-force-graph-3d` render mode on `CodeVaultGraph`, lazy-loaded, theme-aware (completed 2026-06-29)
- [x] **Phase 92 — Voice-Activated Command Palette (Jarvis Mode)** — Browser wake-word (openWakeWord ONNX on `onnxruntime-web`, Apache-2.0, no Picovoice/account/key) opens the command palette in voice mode; Web Speech STT → existing `chat.send`; streamed reply auto-played via shared `useTtsPlayback`
 (completed 2026-06-25)

**Execution order:** 88 → 89 → 90 → 91 → 92 (88 is independent; 89 token cleanup gates 91's theme-aware node colors; 90 cross-repo audit recommended before 91 starts but can run in parallel with 91 if audit clears fast; 92 is independent — reuses shipped Phase 2 WebSocket sender + Phase 3 command palette, no hard dependency on 89/90/91)

## Phase Details

### Phase 88: Analytics Rollup

**Goal**: Analytics queries read pre-aggregated rollup buckets instead of scanning raw event documents — eliminating the Convex 16 MiB/exec read-limit risk permanently.
**Depends on**: Nothing — Convex-only, no UI surface, lowest regression risk.
**Requirements**: AR-01, AR-02, AR-03
**Success Criteria** (what must be TRUE):

  1. Every analytics query (`activityHeatmap`, `toolFlowSankey`, `errorRateTrend`, `tokenSunburst`, `tokenWaterfall`) reads well under 16 MiB at any event volume — no `.take()` count caps remain once rollups are authoritative.
  2. Rollup increments are idempotent: at-least-once ingest retries do not double-count; a one-time historical backfill action populates rollups for pre-existing events.
  3. Heatmap, sankey, and error-trend data fidelity is no longer bounded by the capped `.take()` limits restored after the quick-unblock (heatmap ≤1000, sankey ≤1000, errorRateTrend ≤300×3).
  4. Archival/retention sweeps in `dataRetention.ts` do not inflate or corrupt rollup counts (rollups remain consistent after events are archived or deleted).

**Plans**: 4 plans (4 waves)

  - [x] 88-01-PLAN.md — Wave 0: extract shared sankey classifier (convex/lib/sankeyClassify.ts) + scaffold 3 Nyquist test files (AR-01/02/03)
  - [x] 88-02-PLAN.md — Wave 1 (atomic deploy): idempotencyKey schema+index, in-mutation dedup + ingest-time event/sankey increments, remove computeHourly event/error branches, paginate cost cron, backfill action, httpAction key pass-through (AR-01, AR-02)
  - [x] 88-03-PLAN.md — Wave 2: run one-time historical backfill (operator checkpoint) + dataRetention aggregates-safety verify/test (AR-02)
  - [x] 88-04-PLAN.md — Wave 3: rewrite heatmap/sankey/error-trend/sunburst to read aggregates, remove all .take() count caps, keep tokenWaterfall raw-bounded + render verify (AR-01, AR-03)

---

### Phase 89: Readable Themes & Editorial Skin Toggle

**Goal**: Operators can switch between a readable WCAG-AA theme, the Midnight Aubergine editorial skin, and Matrix Emerald — with zero flash on hard refresh and full token coverage across every surface including canvas-rendered graphs.
**Depends on**: Phase 71 design tokens (foundation exists; TH-01 token cleanup is the internal first step).
**Requirements**: TH-01, TH-02, TH-03, TH-04, TH-05, TH-06
**Success Criteria** (what must be TRUE):

  1. The saved skin (Electric Cyan / Matrix Emerald / Midnight Aubergine) applies before first paint on hard refresh — no visible flash of unstyled or wrong-theme content (FOUC eliminated; blocking inline `<script>` in `index.html`; the two stale localStorage keys consolidated into one).
  2. `axe-core/playwright` reports zero WCAG-AA contrast violations on the five highest-traffic pages (Dashboard, Live Run, Analytics, Forge, Graphs) for every shipped theme.
  3. Canvas-rendered graphs (`ForceGraphCanvas`, `CodeVaultGraph`, KG Explorer) respect the active theme — no hardcoded `#06b6d4` cyan or `#10b981` emerald nodes remain; node colors read CSS custom properties via `useThemeColors()`.
  4. The Midnight Aubergine editorial skin renders with its full token set (warm aubergine background, cream text, gold/emerald/plum accents, paper-grain overlay) — distinct from and coexisting with the other two skins via `[data-theme="aubergine"]`.
  5. Scanline / matrix-grid / heavy glow animations are disabled for users with `prefers-reduced-motion` enabled; the default skin remains Electric Cyan (readable theme is opt-in).

**Plans**: 7 plans (waves 0-3)

- [x] 89-01-PLAN.md — Wave 0: install @axe-core/playwright, useThemeColors() hook + hexToRgba, seed e2e/unit test scaffolds (TH-01, TH-06)
- [x] 89-02-PLAN.md — Wave 1: Readable + Aubergine token blocks, --vault-node-color on all themes, aubergine surface effects, effect suppression, in-CSS chrome tokenization (TH-01..04)
- [x] 89-03-PLAN.md — Wave 1: migrate glow/shadow to glow tokens in 14 top-level components (TH-01)
- [x] 89-04-PLAN.md — Wave 1: migrate glow/shadow in 9 hr/skills components + 7 pages (TH-01)
- [x] 89-05-PLAN.md — Wave 2: no-FOUC pre-paint script, 4-theme switcher, key consolidation, remove dark/light toggle + dead classes (TH-05, TH-01)
- [x] 89-06-PLAN.md — Wave 2: route useThemeColors() into ForceGraphCanvas/CodeVaultGraph/KnowledgeGraph; violet vault token (TH-01)
- [x] 89-07-PLAN.md — Wave 3: axe WCAG-AA contrast (20 cases) + no-FOUC + reduced-motion e2e + operator manual sign-off (TH-06, TH-02..05)

**UI hint**: yes

---

### Phase 90: Agent Room / War Room

**Goal**: The War Room surface shows real agent identity and gives the operator a genuine Join pathway — completing the ~70-75% built scaffolding into a usable, bounded, robust multi-persona room.
**Depends on**: Phase 88 (recommended — no hard dependency, but analytics stability reduces noise). Cross-repo: `astridr-repo` `POST /api/war-room` existence confirmed; participant-join surface must be audited before planning.
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04
**Success Criteria** (what must be TRUE):

  1. The War Room renders real participant identity — agent names, avatars, colors, and role badges sourced from `useRosterAgents()` data, not the four hardcoded placeholder props in `WarRoom.tsx`.
  2. Room listing is bounded (no unbounded `.collect()` on `warRooms`) and rooms are visibly populated from real Ástríðr→Convex ingest events (the `warRooms` ingest path confirmed live).
  3. The operator's "Join" button sends a real signal to Ástríðr (not cosmetic) — confirmed against the `astridr-repo` participant-join/voice surface; if real-time voice is unavailable in this phase, observer mode ships with an honest label.
  4. Each room has a stable deep-link URL (`/war-room/:roomId`) and transcript chunks render in deterministic order via a `seq` field (no out-of-order rendering under concurrent ingest).

**Plans**: 8 plans in 6 waves

- [x] 90-01-PLAN.md — Wave 1: pin livekit-client@2.20.0 (legitimacy gate) + warRoomEvents.seq + by_room_seq index + Convex redeploy (ROOM-03, ROOM-04)
- [x] 90-02-PLAN.md — Wave 2: livekit mock + getColor export + warRoomIdentity/useWarRoomVoice skeletons + 5 RED test files (ROOM-01..04)
- [x] 90-03-PLAN.md — Wave 3: bounded listRooms {active,closed,hasMore} + seq-assigning insertWarRoomEvent + seq-ordered getRoomEvents (ROOM-02, ROOM-04)
- [x] 90-04-PLAN.md — Wave 3: astridr POST /{room}/token (validated) + useWarRoomVoice LiveKit hook (join muted) + VoiceControlBar connection-state UI (ROOM-03)
- [x] 90-05-PLAN.md — Wave 3: resolveParticipant + resolveAgentColor identity helper (ROOM-01)
- [x] 90-06-PLAN.md — Wave 4: WarRoom deep-link route + auto-select + real identity wiring + bounded listing UI (ROOM-01, ROOM-02, ROOM-04)
- [x] 90-07-PLAN.md — Wave 5: WarRoom real Join wiring + room-change disconnect + Room Ended state + seq transcript merge (ROOM-03, ROOM-04)
- [x] 90-08-PLAN.md — Wave 6: operator manual verification (live token endpoint, two-way audio, concurrent-ingest ordering) — ✅ signed off 2026-06-29 (ROOM-03, ROOM-04)

---

### Phase 91: 3D Memory Galaxy

**Goal**: Operators can toggle an opt-in 3D render mode on `CodeVaultGraph` that renders the full ~4,038-node production graph at acceptable frame rates — without shipping three.js to users who stay in 2D mode.
**Depends on**: Phase 89 (TH-01 `useThemeColors()` resolver required for G3D-02 theme-aware node colors — hard dependency; 91 must come after 89 is complete).
**Requirements**: G3D-01, G3D-02
**Success Criteria** (what must be TRUE):

  1. The 3D toggle is visible on `CodeVaultGraph`; switching to 3D renders the graph using `react-force-graph-3d` and switching back to 2D restores `ForceGraphCanvas` — the 2D render path is unchanged and no regression exists on the default 2D view.
  2. The 2D bundle does not include three.js — `vite build` chunk manifest confirms `three` is isolated to its own lazy chunk; the 2D path loads zero three.js code.
  3. The 3D mode renders the ~4,038-node production graph at ≥30 FPS (validated against the live snapshot from the Convex `graphSnapshots` table before shipping).
  4. Toggling 2D↔3D disposes the WebGL context cleanly — no memory leak on repeated toggle (verified via DevTools memory snapshot or equivalent); the toggle state persists across page reloads via `idb-keyval`.
  5. 3D node colors respect the active theme — colors read from the Phase 89 `useThemeColors()` resolver, not hardcoded hex values.

**Plans**: 5 plans (4 waves)

- [x] 91-01-PLAN.md — Wave 0: install react-force-graph-3d (three transitive) + ForceGraph3D.test.tsx Nyquist RED scaffold (SC#1/#4/#5) (G3D-01, G3D-02)
- [x] 91-02-PLAN.md — Wave 1: ForceGraph3D.tsx lazy 3D wrapper + ForceGraph3DHandle + centerNode3DWhenReady in graph-center.ts (G3D-01, G3D-02)
- [x] 91-03-PLAN.md — Wave 2: CodeVaultGraph host — 2D|3D toggle + idb-keyval persist + lazy swap + theme-aware 3D color/size callbacks + focus 3D branch (makes Wave 0 tests GREEN) (G3D-01, G3D-02)
- [x] 91-04-PLAN.md — Wave 3: SC#2 build-manifest chunk-isolation check (no three.js in main bundle) (G3D-01)
- [x] 91-05-PLAN.md — Wave 3: manual gates — SC#3 ≥30 FPS at live ~4,038-node snapshot + SC#4 WebGL no-leak on repeat toggle (G3D-02)

**UI hint**: yes

---

### Phase 92: Voice-Activated Command Palette (Jarvis Mode)

**Goal**: An operator can summon Ástríðr hands-free from anywhere in CodePulse by speaking a wake word, speak a command, and hear the streamed reply in a Norse persona voice — entirely through the existing command palette and WebSocket `chat.send` path, with zero Ástríðr backend changes.
**Depends on**: Phase 2 (WebSocket command sender — shipped) and Phase 3 (Command Palette — shipped). No hard dependency on 89/90/91. Requires a custom-trained **openWakeWord** "Hey Astrid" model (ONNX) + the shared openWakeWord melspectrogram/embedding ONNX models placed in `public/`. No third-party account, key, or quota (Picovoice rejected the account; openWakeWord is open-source/Apache-2.0 and runs in-browser via `onnxruntime-web`).
**Requirements**: VOX-01, VOX-02, VOX-03, VOX-04
**Success Criteria** (what must be TRUE):

  1. With voice mode enabled, speaking the wake word ("Hey Astrid") anywhere in the app reliably opens the command palette in a "listening" voice mode within ~1s — detection runs continuously and locally in a Web Worker / AudioWorklet via openWakeWord ONNX models on `onnxruntime-web` (no audio leaves the machine for wake detection), and does not require the palette to already be open (`DashboardLayout.tsx` wake handler + existing ⌘K toggle coexist).
  2. After wake, the operator's spoken command is transcribed via the browser Web Speech API (reusing the recognition logic in `ChatInput.tsx`), shown as a live transcript, and on a final result is sent verbatim through the existing `sendCommand({type:"chat.send", message})` over `AstridrWSContext` — no new transport.
  3. The streamed reply renders in the palette (`run.text`) and the `run.tts` `audio_url` auto-plays in the selected Norse persona's ElevenLabs voice via a shared `useTtsPlayback` hook extracted from `Chat.tsx` (Chat and palette share one playback path; no duplicate logic). Persona→voice resolution remains Ástríðr-side (`VoiceIdentityResolver`) — no CodePulse voice config.
  4. Voice mode is privacy-honest: always-on listening is OFF by default, requires an explicit operator toggle, shows a persistent "listening" indicator while active, and missing/failed-to-load wake-word ONNX models degrade gracefully (clear disabled state, no crash, no silent always-on mic).

**Plans**: TBD
**UI hint**: yes

</details>

---

<details>
<summary>✅ v10.0 Eval & Trace Observability + Hardening (Phases 93-96) — SHIPPED 2026-07-07; Phase 96 addendum completed 2026-07-13</summary>

> **Started 2026-07-04** via `/gsd-new-milestone` (seeded from `.planning/todos/pending/eval-and-trace-observability-v10.md`, the 2026-06-30 cross-repo capability audit). Continues phase numbering from 93. Both observability features ride existing `llmMetrics`/ingest transport — no new emitter protocol from Ástríðr.

**Milestone goal:** Close the loop on agent-output quality and per-call traceability — receive and judge the quality scores Ástríðr already emits, render LLM call chains natively — and harden the platform (security audit, key rotation, major dependency migrations).

**Phase summary:**

- [x] **Phase 93: Eval Pipeline & Quality KPIs** — `evalScores` ingest (idempotent), nightly LLM-as-judge `internalAction`, per-persona quality KPI + regression detection
 (completed 2026-07-06)

- [x] **Phase 94: Trace Waterfall** — `traceId` grouping on `llmMetrics` + in-app call-chain waterfall UI (replaces dead-link `LangfuseTraceLink.tsx`)
 (completed 2026-07-06)

- [x] **Phase 95: Hardening — Security, Key Rotation, Dependency Majors** — `/cso` audit + remediation, Forge ingest-key rotation, TypeScript 6 + react-day-picker 10 migrations
 (completed 2026-07-07)

- [x] **Phase 96: UI Deep-Dive Cleanup (post-ship addendum)** — CONSOLE cluster dissolved, CommandPalette single-sourced from navRegistry, fabricated readouts/trust signals removed, orphan pages deleted, both approval consumers gated on server ack against the verified Ástríðr contract, one PageHeader across all pages; 13/13 plans, re-verified 16/16 after 96-13 gap closure; SECURITY 35/35 threats closed
 (completed 2026-07-13)

**Execution order:** 93 and 94 are independent of each other — both ride existing ingest paths with no shared schema — and can run in either order or in parallel. 95 is independent of both (its own audit/rotation/dependency-bump surface) and is sequenced last since it is hardening/cleanup work rather than new-feature delivery; HARD-03/04 close out dependabot PRs already CI-red, and HARD-01 may surface remediation work that adds scope once run.

## Phase Details

### Phase 93: Eval Pipeline & Quality KPIs

**Goal**: Ástríðr's task-quality scores are captured instead of silently dropped, sampled sessions are LLM-judged nightly against a rubric, and operators can see per-persona quality trends and catch regressions tied to persona changes.
**Depends on**: Nothing — new `evalScores` table and ingest path, no dependency on existing schema.
**Requirements**: EVAL-01, EVAL-02, EVAL-03
**Success Criteria** (what must be TRUE):

  1. `task_quality` scores POSTed by Ástríðr's `langfuse_eval.py` to a bearer-authed ingest endpoint are stored in `evalScores` exactly once even under at-least-once retry (idempotent) — scores are no longer silently dropped on the floor.
  2. A nightly Convex `internalAction` runs unattended, samples sessions, LLM-judges them against a rubric, and writes the resulting scores into `evalScores`.
  3. Operator can view a per-persona quality KPI/trend on a dashboard surface.
  4. A quality regression following a persona's model or instruction change (joined against `profileSwitches`/`configChanges`) is flagged or alerted to the operator, not silently absorbed into the trend line.

**Plans**: 6 plans (5 waves)

- [x] 93-01-PLAN.md — Wave 1: evalScores table (full schema) + idempotent task_quality ingest case + close configChanges audit gap in profiles.upsertConfig (EVAL-01)
- [x] 93-02-PLAN.md — Wave 2: nightly LLM judge — eval config slot + digest builder + dual-provider caller + zod validation + sampling internalAction + 05:00 cron (EVAL-02)
- [x] 93-03-PLAN.md — Wave 2: cross-repo Ástríðr langfuse_eval.py fire-and-forget task_quality mirror POST (EVAL-01, D-01)
- [x] 93-04-PLAN.md — Wave 3: regression detection (before/after window means, >=5/side, delivered alert) + KPI read queries (EVAL-03)
- [x] 93-05-PLAN.md — Wave 4: Quality page + persona detail + trend chart + hooks + regression badge + nav/route (EVAL-03)
- [x] 93-06-PLAN.md — Wave 5: live E2E completion bar (D-04) + judge calibration reference set (checkpoints)

**UI hint**: yes

---

### Phase 94: Trace Waterfall

**Goal**: Operators can open any session and see exactly how its LLM call chain executed — ordered timing, per-call cost, and cache hits — inside CodePulse, replacing the dead Langfuse reference.
**Depends on**: Nothing — extends existing `llmMetrics` rows already ingested; independent of Phase 93.
**Requirements**: TRACE-01, TRACE-02
**Success Criteria** (what must be TRUE):

  1. New `llmMetrics` rows carry a `traceId` grouping field (schema + ingest pass-through); existing rows without `traceId` continue to render without error — no backward-compatibility break.
  2. Operator can open a session's LLM call chain as an in-app trace waterfall with calls rendered as timing bars in correct chronological order.
  3. Each call bar in the waterfall shows cost-per-call and a cache-hit/miss annotation.
  4. The dead-link `LangfuseTraceLink.tsx` is replaced by the in-app waterfall — no more link out to a trace store that was never stood up.

**Plans**: 5 plans (4 waves)

- [x] 94-01-PLAN.md — Wave 1: llmMetrics.traceId schema + recordCall arg + /runtime-ingest alias + sessionCalls query + tests + codegen (TRACE-01)
- [x] 94-02-PLAN.md — Wave 1: Ástríðr cross-repo emitter — _current_trace_id contextvar trio + _process_inner insertion + attach at anthropic/openrouter/ollama providers (TRACE-01, D-01)
- [x] 94-03-PLAN.md — Wave 2: TraceWaterfall component — client-side traceId grouping, bar math (seconds/ms), 3-state cache badge, cost dash, MetricCard strip, live useQuery (TRACE-02)
- [x] 94-04-PLAN.md — Wave 3: SessionDetail Trace tab + ?tab=trace deep-link + Analytics "View Trace" cross-link + LangfuseTraceLink deletion (TRACE-02, D-06/07/08)
- [x] 94-05-PLAN.md — Wave 4: live E2E completion bar (D-05) — operator-gated prod Convex deploy + astridr rebuild + grouped-trace/legacy-fallback verification

**UI hint**: yes

---

### Phase 95: Hardening — Security Audit, Key Rotation, Dependency Majors

**Goal**: The platform's security posture, secrets, and major dependencies are current and verified — no live placeholder secrets, no unremediated confirmed findings, no CI-red dependency PRs blocking future work.
**Depends on**: Nothing — independent of Phases 93/94; can run in parallel or any order, sequenced last as audit/cleanup work.
**Requirements**: HARD-01, HARD-02, HARD-03, HARD-04
**Success Criteria** (what must be TRUE):

  1. `/cso` code-security audit is run against the repo and every confirmed finding (with `file:line` evidence, zero-false-positive precision bar) is remediated — no open confirmed findings remain.
  2. The Forge ingest key placeholder (`<new-strong-secret>`, recorded in memory `forge-deployment-tidy-whale-981`) is replaced by a real rotated secret live in both the Convex env and the Forge daemon config, with a live ingest round-trip confirming the new key works end to end.
  3. TypeScript 6.0 migration lands green — `tsc --noEmit`, the full Vitest suite, and `vite build` all pass with zero errors (was CI-red as dependabot PR #50, closed 2026-07-04).
  4. react-day-picker 10 migration lands green — all calendar-consuming surfaces are manually verified to render and interact correctly (was CI-red as dependabot PR #49, closed 2026-07-04).

**Plans**: 4 plans (3 waves)

- [x] 95-01-PLAN.md — Wave 1: delete dead react-day-picker (HARD-04) + TypeScript 6.0.3 via tsconfig node-globals fix + remove redundant @types (HARD-03) + REQUIREMENTS wording
- [x] 95-02-PLAN.md — Wave 2: verify already-merged D-10 majors + delete 6 stale dependabot branches + react-easy-crop@6 UI checkpoint (HARD-03)
- [x] 95-04-PLAN.md — Wave 2: HARD-02 close-out — Forge-daemon env check + live real-emitter round trip + records update (HARD-02)
- [x] 95-03-PLAN.md — Wave 3: /cso audit + npm audit + secret scan → 95-SECURITY-AUDIT.md (inventory→confirm→fix) certifying the shipped tree (HARD-01)

### Phase 96: UI deep-dive cleanup — IA restructure, command palette drift, fake telemetry, and consistency fixes

**Goal:** Every UI surface tells the truth and follows one standard — the CONSOLE nav cluster is dissolved, the command palette reaches every page, no header/security/automation readout shows a fabricated number, orphaned pages and dead UI are gone, the two divergent approval flows are unified against the verified Ástríðr contract, and all 35 pages share one PageHeader.
**Requirements**: F1–F10 (FINDINGS.md) / D-01–D-11 (CONTEXT.md) — no formal REQ IDs; cleanup phase
**Depends on:** Phase 95
**Plans:** 13/13 plans complete

Plans:
**Wave 1**

- [x] 96-01-PLAN.md — Wave 1: shared PageHeader component + contract test (F7 foundation)
- [x] 96-02-PLAN.md — Wave 1: DashboardLayout IA restructure (dissolve CONSOLE) + real/hidden header telemetry + iconComponents export (F1/D-03, F3/D-04, F2 enabler)
- [x] 96-13-PLAN.md — Wave 1 (gap closure, from 96-HUMAN-UAT): Inbox ack-boolean gating (no false success) + Chat run.blocks event alignment (D-11) — completed 2026-07-13

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 96-03-PLAN.md — Wave 2: F6 approval fix — Chat payload/ack correctness + shared ApprovalActions (Chat+Inbox) + headers (F6/D-11)
- [x] 96-04-PLAN.md — Wave 2: Tasks+MissionControl merge (view toggle, typed api) + orphan deletions + App.tsx redirects (F1/D-01/D-02/D-08, F7/F10)
- [x] 96-05-PLAN.md — Wave 2: CommandPalette + HeroStatsBar sourced from navItems/iconComponents; stale links fixed (F2)
- [x] 96-06-PLAN.md — Wave 2: F4 honesty — Security badge/allowlist, Automation cron count, Infrastructure placeholder + headers (D-05/D-06/D-07)
- [x] 96-07-PLAN.md — Wave 2: shared FactsTable (Memory+Dreaming) + Dreaming dead-code + headers (D-09, F9/D-10, F7)
- [x] 96-08-PLAN.md — Wave 2: MeetingBot live roster + Skills no-op delete removal + headers (D-10, F9, F7)
- [x] 96-09-PLAN.md — Wave 2: F8 mobile master-detail collapse (ForgePage, WarRoom) + WarRoom header (F8, F7)
- [x] 96-10-PLAN.md — Wave 2: F10 minors — DocComments tokens/header, ThemeSwitcher aria-label, KG/ToolGalaxy bg token, Analytics dead UI (F10, F9/D-10)
- [x] 96-11-PLAN.md — Wave 2: F7 header sweep A — 5 hr/* + Dashboard/Alerts/Briefings/Capabilities/Settings/SelfHealing
- [x] 96-12-PLAN.md — Wave 2: F7 header sweep B — Executions/Ideation/ConfigPage/InsightsChat/LiveRun/WhatsApp/Hive/GraphsHub/McpInventory/Quality/QualityDetail/SessionDetail

</details>

---

## v11.0 Skills Command Center — Full Lifecycle & Launch — ✅ SHIPPED (2026-07-25)

> Shipped 2026-07-25, tagged `v11.0`. 4 phases (97–100), 23 plans, 22/22 requirements. Full requirements archived in [milestones/v11.0-REQUIREMENTS.md](milestones/v11.0-REQUIREMENTS.md); this section in [milestones/v11.0-ROADMAP.md](milestones/v11.0-ROADMAP.md); audit (`tech_debt`, 0 blockers, 3 queued follow-ups) in [milestones/v11.0-MILESTONE-AUDIT.md](milestones/v11.0-MILESTONE-AUDIT.md). Phase dirs archived under `milestones/v11.0-phases/`.

> **Started 2026-07-17** via `/gsd-new-milestone`. Continues phase numbering from 96. Phase 97 was already promoted from backlog 999.1 (2026-07-17) as **"Skill Lifecycle Management"** (archive/restore/delete via Forge daemon); that scope is folded into **Phase 98** below now that the daemon-executor + real-intake foundation is sequenced first per the dependency analysis (nothing mutates the host without the daemon executor existing — Phase 97 is re-themed, its context carried forward, nothing dropped or duplicated).

**Milestone goal:** Turn the Skills page from a read-only catalog into a real control surface — add, move, archive, restore, delete, and *launch* skills live, executed on the host by the Forge daemon.

**Phase summary:**

- [x] **Phase 97 — Real Skill Intake & Daemon Foundation** — execute today's dry-run install (upload / GitHub URL) to global/project/cold storage; Forge daemon executes intake + rescans the registry; advertises supported command types (completed 2026-07-19)
- [x] **Phase 98 — Skill Lifecycle Mutations** — archive / restore / move / delete, archive-first, `isShadowing`-aware, honest when the daemon is offline (completed 2026-07-21)
- [x] **Phase 99 — Skill Launch / Dispatch** — real Run to Chat (auto-send) / Forge agent / Ástríðr, not just a prefilled composer (completed 2026-07-23)
- [x] **Phase 100 — Control-Surface UX** — per-row ⋯ menu + drag across scope lanes + optimistic reconcile + in-app Cold Storage restore (5/5 plans code-complete 2026-07-24; manual live-Forge-daemon UAT outstanding)

**Execution order:** 97 → 98 (98 reuses the daemon command-execution + registry-rescan plumbing 97 builds) · 99 is independent of 97/98 (rides existing chat/Forge/Ástríðr channels, no daemon dependency) and can run in parallel · 100 depends on **both** 98 (lifecycle mutations) and 99 (Run target picker) since the ⋯ menu and drag lanes wire against both, so it is sequenced last.

## Phase Details

### Phase 97: Real Skill Intake & Daemon Foundation

**Goal**: A skill upload (file or GitHub URL) actually lands on the host filesystem in the chosen scope and the Skills page reflects it automatically — closing today's "validation only, nothing is written" dry-run gap — powered by a Forge daemon that executes intake commands and rescans the registry.
**Depends on**: Nothing new — extends the existing `forgeCommands` queue, optimistic rows, TTL/expiry, and Clerk fail-closed auth already shipped for Forge launch/stop/logs/files (Phases 80-82). Precursor: the Skills command-center Cold Storage rail view (PR #67, shipped 2026-07-17) supplies the read-only scope lanes this phase makes live. Pinning down where the daemon code lives (separate `forge` repo vs astridr-repo) is execution step 1.
**Requirements**: INTAKE-01, INTAKE-02, INTAKE-03, INTAKE-04, DAEMON-01, DAEMON-03, DAEMON-04
**Success Criteria** (what must be TRUE):

  1. User uploads a SKILL.md, picks a destination scope (global / project / cold storage), and the file lands on the host filesystem in the correct location — not a "validation only, nothing is written" report.
  2. User installs from a GitHub URL (with optional `subpath`), and the file lands correctly; a malformed URL shape or a path-traversal attempt is rejected before anything is written.
  3. Immediately after a successful install, the skill appears on the Skills page with correct origin/scope — no manual refresh, no stale registry (daemon-driven rescan).
  4. A failed install (bad file, bad URL, daemon-side validation failure) surfaces the daemon's real execution/validation report as an actionable error and leaves no partial skill directory behind on disk.
  5. Intake commands are only dispatched to daemons that advertise support for them (`supportedTypes` / `resolveClaimTypes`) — an older daemon build is never handed a command type it cannot execute.

**Plans**: 6 plans (3 waves)

- [x] 97-01-PLAN.md — Wave 1 (forge): real-write argv (--write / --allow-unrecoverable, never --allow-overwrite) + exit-code 4-9 classification with stdout refusal extraction (DAEMON-01, INTAKE-04)
- [x] 97-02-PLAN.md — Wave 1 (forge): DAEMON-03 registry-rescan module — walk 3 skill roots + SKILL.md frontmatter parse + fire-and-forget POST to /scan (INTAKE-03, DAEMON-03)
- [x] 97-04-PLAN.md — Wave 1 (codepulse): install-language UI copy on IntakeModal/IntakeSheet/SkillCollectionPicker + D-06 confirm + D-07 error copy (INTAKE-01, INTAKE-02, INTAKE-04)
- [x] 97-03-PLAN.md — Wave 2 (forge): rescan trigger in command-poller after successful write + DAEMON-04 supportedTypes regression guard (DAEMON-03, DAEMON-04)
- [x] 97-05-PLAN.md — Wave 2 (codepulse): Convex-side refusal-reason adapter in ackCommand — synthetic finding + verdict flip (INTAKE-04)
- [x] 97-06-PLAN.md — Wave 3 (operator): cold-storage marker checkpoint + live end-to-end round-trip (INTAKE-01, INTAKE-02, INTAKE-03)

**UI hint**: yes

---

### Phase 98: Skill Lifecycle Mutations (Archive / Restore / Move / Delete)

**Goal**: An operator can archive, restore, move, and delete skills from the UI, with every mutation executed atomically on the host by the daemon and reflected back through a registry rescan — archive-first, `isShadowing`-aware, and honest when the daemon is offline.
**Depends on**: Phase 97 — reuses the same daemon command-execution + registry-rescan mechanism; the command-routing/advertising groundwork (DAEMON-04) and rescan (DAEMON-03) established there extend naturally to lifecycle command types.

*(Supersedes/renumbers the backlog-promoted "Phase 97: Skill Lifecycle Management" (2026-07-17) — same scope and design cautions carried forward unchanged: the browser/Convex app cannot touch the filesystem, so mutations flow through the `forgeCommands` channel (same pattern as intake; `IntakeDestination` already includes `"cold"`); dormant↔active moves must respect `isShadowing` (a dormant copy shadowed by an active same-name skill); delete defaults to archive-not-delete per the "treat the vault as unrecoverable / archive, don't rm" house rule, with true deletion behind an explicit confirm; the daemon-absent case must degrade gracefully — command expires, UI says so, mirroring intake's expired path. Cross-repo: codepulse (UI actions on SkillRow/ColdStorageView + Convex command enqueue/status) + astridr-repo (daemon handler performing the move/delete + registry rescan).)*

**Requirements**: LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, DAEMON-02
**Success Criteria** (what must be TRUE):

  1. User archives an active skill to cold storage from the UI; the host file moves to `.claude/skills-available/` and the skill is tracked as dormant (no longer counted toward active context/token load).
  2. User restores a dormant/cold skill back to active (global or project); if an active same-name skill would be shadowed, restore is blocked/flagged rather than silently overwriting it (`isShadowing`).
  3. User moves a skill between global and project scope from the UI, and the host file relocates on disk to match.
  4. Deleting a skill defaults to archive (reversible); true file deletion on disk is a separate action requiring an explicit confirmation.
  5. When the Forge daemon is offline, lifecycle actions queue and the UI visibly shows the command will expire — no false-success state is ever shown (mirrors the intake expired-command path).

**Plans**: 5 plans (4 build + 1 gap-closure)
Plans:
**Wave 1**

- [x] 98-01-PLAN.md — Convex substrate: forgeCommands lifecycle type + payload, enqueueLifecycle with pre-flight checks, ack refusal adapter, list query
- [x] 98-02-PLAN.md — Forge daemon (C:/Users/mandr/forge): native-TS lifecycle-exec (cross-volume move, host-truth re-check, cold-only delete), executeLifecycle poller branch, fresh-workspace fix

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 98-03-PLAN.md — UI building blocks: dropdown-menu primitive, useLifecycle hook, MoveToProjectDialog, DeleteSkillDialog (type-to-confirm)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 98-04-PLAN.md — Assembly: scope-gated SkillLifecycleMenu (shadow + multi-scope guards), always-visible menu trigger on SkillRow, Cold Storage copy refresh

**Gap-closure addendum** *(from 98-HUMAN-UAT test 1)*

- [x] 98-05-PLAN.md — Rescan reconciles emptied origins: forge scannedOrigins manifest + computeSkillPrunes prunes declared-but-empty origins (stale project row after a move); reachability-gated so a transient unmount never over-prunes

**UI hint**: yes

---

### Phase 99: Skill Launch / Dispatch

**Goal**: The Run affordance actually executes a skill live — auto-sent to Chat, launched as a Forge agent run, or dispatched to Ástríðr / a persona — instead of today's "prefills `/skillname` in the composer" dead end.
**Depends on**: Nothing new — rides existing channels (`chat.send`, `enqueueLaunch`, Ástríðr dispatch); independent of the daemon/intake/lifecycle work in Phases 97-98 and can be built in parallel with either.
**Requirements**: LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04
**Success Criteria** (what must be TRUE):

  1. User runs a skill in Chat and the invocation is actually sent and executed via `chat.send` (auto-send) — not merely prefilled in the composer.
  2. User launches a skill as a Forge agent run — picking agent / workspace / mode, with the skill as the instruction (reuses `enqueueLaunch`).
  3. User dispatches a skill to Ástríðr / a chosen persona and it executes there.
  4. The Run affordance lets the user pick the target (Chat / Forge agent / Ástríðr) at launch time, and each launch updates the skill's `useCount` / `lastUsedAt`.

**Plans**: 7 plans (5 waves + 99-07 gap closure) — all complete 2026-07-23; code review (99-REVIEW.md) found 2 blockers (phantom launch-recording on a failed Chat/Ástríðr send + on an optimistic Forge enqueue), both fixed in 99-07 with TDD; verified 10/10 must-haves (99-VERIFICATION.md).

- [x] 99-01-PLAN.md — Wave 1: launch contracts — `skillRun.ts` (RunTarget/AutoSendHandoff + last-pick localStorage), `profiles.ts` (hoisted PROFILES), `useAstridrChat` profile passthrough, `ForgeLaunchModal` initialPrompt (LAUNCH-01/02/03)
- [x] 99-02-PLAN.md — Wave 2: Chat auto-send receiver — mount-triggered StrictMode-safe effect + recordSkillLaunch on confirmed send (LAUNCH-01/03)
- [x] 99-03-PLAN.md — Wave 2: Run popovers — RunChatPopover + RunAstridrPopover (deliberate pre-send capture, persona picker, honest no-persona-claim) (LAUNCH-01/03)
- [x] 99-04-PLAN.md — Wave 3: launch orchestration — SkillLaunchProvider (page-level Forge modal + Forge recording) + RunTargetChooser/useRunLaunch (last-pick chooser) (LAUNCH-02/04)
- [x] 99-05-PLAN.md — Wave 4: Run entry points — SkillLifecycleMenu Run submenu + QuickDeck primary-click Run / copy-secondary / stop-recording (LAUNCH-04)
- [x] 99-06-PLAN.md — Wave 5: integration + honest-recording sweep — Skills.tsx provider wrap + retire copy-recording & the /chat?skill= dead-end across SkillRow/palette/containers (LAUNCH-04)

**UI hint**: yes
**Cross-repo note (2026-07-20)**: astridr's planned Mission Control (astridr SEED-023) PAIRS WITH this phase — 99 launches skills; the mission jobs board (live stream-json telemetry, cost, confirm cards) is a separate surface seeded as `.planning/seeds/SEED-002-mission-control-jobs-board.md`. Keep launch plumbing (`chat.send` / `enqueueLaunch` / dispatch) reusable for mission briefs.

---

### Phase 100: Control-Surface UX (⋯ Menu, Drag Lanes, Optimistic Reconcile)

**Goal**: The Skills page becomes a complete, efficient control surface — every row exposes the right actions for its scope, drag-and-drop across lanes fires the right mutation, in-flight actions show honest optimistic state, and Cold Storage restore never sends the operator to a terminal.
**Depends on**: Phase 98 (lifecycle mutations) and Phase 99 (Run/launch target picker) — this phase wires the UI control surface over both.
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):

  1. Every skill row exposes an overflow (⋯) menu showing only the actions valid for its current scope (Move / Restore / Archive / Delete / Run), each wired to its mutation or launch.
  2. Global / Project / Cold Storage lanes accept drag targets; dragging a skill across lanes fires the corresponding move / archive / restore command (extends today's drag-to-category).
  3. A mutating action shows an optimistic/pending row state that reconciles to success, failure, or expiry once the server command resolves (reuses the intake optimistic-row pattern).
  4. The Cold Storage view offers in-app Restore — the "run `/manage-skills` in a terminal" dead-end is gone.

**Plans**: 5 plans (3 waves) — planned 2026-07-24

  - [x] 100-01-PLAN.md — Wave 1: extract shared `resolveLifecycleActions` + `resolveScopeDrop` pure helpers (drag matrix = source of truth) + behavior-preserving SkillLifecycleMenu refactor (UX-01, UX-02) — completed 2026-07-24, see 100-01-SUMMARY.md
  - [x] 100-02-PLAN.md — Wave 1: `usePendingLifecycleMoves` commandId-correlated optimistic hook + status-aware reconcile + `SkillControlSurfaceProvider` context (UX-03) — completed 2026-07-24, see 100-02-SUMMARY.md
  - [x] 100-03-PLAN.md — Wave 2: `ScopeRail` component — 3 always-visible Global/Project/Cold drop targets, valid/invalid/idle states + inline reject hint (UX-02) — completed 2026-07-24, see 100-03-SUMMARY.md
  - [x] 100-04-PLAN.md — Wave 3: Skills.tsx integration — `handleDropOnScope` dispatch, paint-before-await + LAYER-1 `.catch()` rollback, page-level Project dialog wiring, `MoveToProjectDialog.onMoved(commandId)` (UX-02, UX-03) — completed 2026-07-24, see 100-04-SUMMARY.md
  - [x] 100-05-PLAN.md — Wave 2: SkillRow pending overlay (70% + info-bar) + dragging-skill reporting + UX-01/UX-04 menu-consistency & no-`/manage-skills` completeness audit (UX-01, UX-03, UX-04) — completed 2026-07-24, see 100-05-SUMMARY.md

**UI hint**: yes
**Cross-repo note (2026-07-20)**: armory tiles + tool-receipts display (tools_used/tool_errors under chat answers) from the JARVIS v5/TARS analysis were **deferred out of this phase** (D-07 — different surface, scope creep for a Skills control-surface phase) — see `.planning/seeds/SEED-002-mission-control-jobs-board.md` and astridr SEED-024; route to backlog / its own phase.

---

<details>
<summary>✅ v12.0 Personal Productivity — Reminders & Calendar (Phases 101-102) — SHIPPED 2026-07-23</summary>

> **Defined 2026-07-19**, executed as an interleaved side-quest while v11.0 (Skills, Phases 97-100) remained in progress. 2 phases (101-102), 10 plans, 9/9 requirements, cross-repo (codepulse + astridr-repo). Milestone audit `tech_debt` (0 blockers; the 2 flagged items were closed by Phase 102). Full per-phase detail + success criteria archived in [milestones/v12.0-ROADMAP.md](milestones/v12.0-ROADMAP.md); requirements in [milestones/v12.0-REQUIREMENTS.md](milestones/v12.0-REQUIREMENTS.md); audit in [milestones/v12.0-MILESTONE-AUDIT.md](milestones/v12.0-MILESTONE-AUDIT.md).

**Milestone goal:** A sleek, profile-organized Reminders command center — personal / business / consulting reminders creatable and editable from both CodePulse and an Ástríðr conversation, always in sync, with recurrence, proactive due-nudges, and a read-only Google Calendar overlay per profile.

- [x] **Phase 101 — Reminders & Calendar Command Center** (7/7 plans, incl. 101-07 UAT gap closure) — Convex-backed reminders store (source of truth), authed Ástríðr sync endpoints + `reminders` tool, recurrence, proactive nudges via `ProactiveMessenger`, per-profile read-only Google Calendar cache + overlay, and the profile-segmented Reminders page — completed 2026-07-20, live-verified
- [x] **Phase 102 — Address tech debt: reminders dead code + astridr comment cleanup** (3/3 plans) — deleted the orphaned `dueSoon`/`overdue` queries + `by_dueAt` index (codepulse) and the dead `CodePulsePoster` class + stale two-backend narrative (astridr-repo); live-verified via self-hosted index-drop deploy + one real calendar tick (75 events pushed, 0 failed) — completed 2026-07-23, verification 10/10

</details>

---

## v13.0 Brain-Swap Control, Cost Intelligence & Consolidation — ✅ SHIPPED (2026-08-06)

> Shipped 2026-08-06, tagged `v13.0`. 5 phases (103–107), **53 plans**, **14/15 requirements satisfied — 1 PARTIAL (BSC-01, per-agent axis deliberately deferred, not a defect)**. Suite 3506 passing. Full requirements archived in [milestones/v13.0-REQUIREMENTS.md](milestones/v13.0-REQUIREMENTS.md); this section in [milestones/v13.0-ROADMAP.md](milestones/v13.0-ROADMAP.md); audit in [milestones/v13.0-MILESTONE-AUDIT.md](milestones/v13.0-MILESTONE-AUDIT.md). Phase dirs archived under `milestones/v13.0-phases/`.

> **Started 2026-07-27** via `/gsd-new-milestone`. Continues phase numbering from 102.

**Milestone goal:** See and drive Ástríðr's reasoning engine from CodePulse, make spend legible per model/provider, make tool behaviour observable, and close out the accumulated tech debt.

**Phase summary:**

- [x] **Phase 103 — Brain-Swap Control Surface** (18 plans) — global engine swap live end-to-end with server-confirmed results; the integration gate closed *during* execution per the Phase-90 lesson
- [x] **Phase 104 — Cost Intelligence** (11 plans) — per-model/provider spend over time, budget thresholds, alerts through the existing routing layer
- [x] **Phase 105 — Tool & Trace Observability** (9 plans) — per-call tool rows, `toolPolicyEvents` with fail-open-only alerting, trace waterfall nesting tools under their LLM round; every capped read states truncation on screen
- [x] **Phase 106 — Consolidation & Hardening** (8 plans) — `anyApi` swept, cloud Convex `tidy-whale-981` retired (602,932-row archive, deployment deleted **and** subscription cancelled), entry chunk −73.8%, all three deferred manual UAT sequences run live
- [x] **Phase 107 — Aggregates Rollup Sharding** (7 plans) — `OCC-01` closed on the second attempt: 0 conflicts across 11.6 h / 176 ingests

**Worth carrying forward:** Phase 107 **failed once before it succeeded**. 107-03 sharded the write target and 107-06 measured the result as *worse*; the read set was still the whole bucket, and Convex OCC conflicts on documents read from **or** written to. The root cause of that miss was the **test harness** — the fake `withIndex()` ignored the index entirely, so read-set *width* was untestable and a wrong fix stayed green. Separately, the measuring instrument itself lied three ways (`docker logs --since` returning zero for any post-start window; a large `--tail` silently serving the *rotated* file), and the replacement method was calibrated against a known-good answer before being trusted. See the audit.

**Open, non-blocking:** convex-backend memory growth (root cause OPEN; proven *not* data volume — `db.sqlite3` byte-identical across a ~4× climb; mitigated by a nightly health-gated restart), skill-registry prune churn, 7 astridr event kinds without domain routes, and one intermittent test whose three candidate causes were refuted rather than masked.

---

*Last updated: 2026-08-06 — **v13.0 CLOSED**. 5 phases, 53/53 plans, 14/15 requirements (BSC-01 PARTIAL by design). Closed by hand — no `gsd-sdk milestone.complete` — with all counters re-derived from disk and git rather than copied from STATE.md; they matched exactly, which they only did because each phase close hand-reconciled them. The close itself caught two marker defects that a narrative-driven audit would have missed: `OCC-01` carried **no verdict marker at all** in REQUIREMENTS.md despite being proven PASS and recorded in four other places, and `BSC-03` was satisfied but phrased un-machine-checkably. Next: `/gsd-new-milestone`.*

## v14.0 Per-Agent Engine Visibility, Convex Durability & Mission Board — 🚧 IN PROGRESS

> **Started 2026-08-06** via `/gsd-new-milestone`. Continues phase numbering from v13.0 (103–107) → **Phases 108-113**. No research/SUMMARY.md exists for this milestone — every requirement is grounded in repo evidence recorded in REQUIREMENTS.md's "Scoping evidence" table (gathered 2026-08-06, before any requirement was written).
>
> **Appended 2026-08-08 → Phases 114-119** (two approved design workstreams, requirements to be derived at each phase's discuss/plan step, not in this milestone's REQUIREMENTS.md): 114-115 from the agentic-os-second-brain design (vault `02-projects/agentic-os-second-brain.md`, approved 2026-08-07); 116-119 from the Seiðr Suite design (`docs/proposals/2026-08-07-seidr-suite-design.md` + SEED-005, approved 2026-08-08).

**Milestone goal:** Finish the per-agent half of brain-swap that v13.0 deliberately deferred (BSC-01), make the self-hosted Convex instance durable rather than nightly-restarted, and turn the leftover jobs surface into a real mission board.

**Phase summary:**

- [x] **Phase 108 — Per-Profile Engine Telemetry (astridr backend)** — real per-profile active-engine telemetry, a scoped `swap.set`, and a `control_verb_swap` domain route, verified live before the dependent UI is built (completed 2026-08-07)
- [x] **Phase 109 — Per-Agent Engine UI** — the already-built picker/badge/confirm-modal surfaces light up on real telemetry with honest server-confirmed swap status (completed 2026-08-10; ticked 2026-08-11 at Phase 111 close — the box lagged the work. Evidence: `109-VERIFICATION.md` status=passed, 10 plans/10 summaries.)
- [x] **Phase 110 — Convex Durability** — `aggregates` bounded by the existing batch-capped retention machinery, a verified full nightly prune pass, and the memory-growth root cause documented (completed 2026-08-11)
- [x] **Phase 111 — Mission Board** — `JobsPanel`/`subagentJobs` became a truthful **post-hoc history board** over terminal-state rows, and every affordance asserting a mission state the data cannot back was removed (`ActiveAgentsPanel` deleted outright) (completed 2026-08-11). *(Description corrected at phase close: the milestone line still carried the pre-2026-08-10 goal — "live cards, humanized tool labels, honest orphan recovery" — all three of which were struck or deferred when the scope was narrowed on probe evidence. Ticking that text would have made the checklist assert delivery of exactly the work D-03/D-04 deferred to SEED-007.)*
- [x] **Phase 112 — Telemetry Coverage Closure** — the contract doc corrected for Group A, every remaining Group B kind given a justified disposition — **COMPLETE 2026-08-13**, verified `passed` (9/9 must-haves), 8/8 plans
- [x] **Phase 113 — Debt Sweep** — skill-registry prune churn, the intermittent `Chat.test.tsx` failure, and `convex-selfhost/` under version control (completed 2026-08-12; ticked 2026-08-13 — the box lagged the work. Evidence: `113-VERIFICATION.md` status=`passed-with-amended-criterion` covering DEBT-05/06/07, 8 plans/8 summaries, and this file's own Progress table already recorded "Complete (DEBT-06 GUARDED) 2026-08-12".)
- [ ] **Phase 114 — Workspace Map view** — ARMS radial map on `ForceGraphCanvas`, two switchable lenses (Larry's workspace ↔ Ástríðr's world)
- [x] **Phase 115 — Workspace scanner** — host-side classifier over workspace roots, versioned `kind:"workspace"` snapshot ingest — **COMPLETE 2026-08-13**, 10/10 plans. Live: 4,912 classified directories ingested to the self-hosted backend, `activeVersion` 10 with `storedVersions` held at 3 by the prune, nightly task registered 04:15. *(D-05's unattended firing is OPEN, due 2026-08-14 morning — a manual trigger proves the ACTION works, not that the SCHEDULER fires it. The phase is closed; that decision is not.)*
- [x] **Phase 116 — Galdr prompt library** — `prompts` tables + `/galdr` live-fetch skills + send-to-Chat/clipboard (Seiðr Suite) (completed 2026-08-10; ticked 2026-08-11 at Phase 111 close — the box lagged the work. Evidence: `116-VERIFICATION.md` status=passed, 8 plans/8 summaries.)
- [x] **Phase 117 — Bifrost link hub** — `links` table, command-palette jump, liveness dots (Seiðr Suite; /gsd-quick-shaped) (completed 2026-08-10; ticked 2026-08-13 — the box lagged the work. Evidence: `117-VERIFICATION.md` status=`passed`, 4/4 goal clauses, 0 overrides; shipped with a phase-level `117-SUMMARY.md` rather than per-plan PLAN/SUMMARY files, which is why plan-counting verbs under-report it.)
- [ ] **Phase 118 — Studio media gallery** — media-vault + sidecar provenance, thumbs-only in Convex, watcher, styles/models, G-drive backup (Seiðr Suite)
- [x] **Phase 119 — Loom curated pipelines** — `pipelines`/`pipelineRuns` + React Flow view + step-event emits over Convex subscriptions (Seiðr Suite) (completed 2026-08-11; ticked 2026-08-13 — the box lagged the work. Evidence: `119-VERIFICATION.md` status=`passed`, 4/4 goal clauses, 0 overrides; shipped with a phase-level `119-SUMMARY.md` rather than per-plan PLAN/SUMMARY files.)

**Execution order:** 108 → 109 (109 depends on 108's real telemetry + scoped swap.set — the D-14 boundary forbids a config-sourced current-engine column) · 110, 111, 113 are each independent of everything else in this milestone and can run in any order · 112 depends on 108 (reuses the per-kind routing precedent set by TELE-02/`control_verb_swap`). · **114-119 (appended 2026-08-08):** despite the auto-generated "Depends on: previous phase" lines in their detail stubs, 116-119 are independent of everything (order 116 → 117 → 118 → 119 is daily-value preference, not dependency); 114 pairs with 115 (115 feeds 114's workspace lens; 114 can start against fixtures) and 114's Ástríðr lens waits on astridr v29 A3 — sequencing, not a blocker.

## Phase Details

### Phase 108: Per-Profile Engine Telemetry (astridr backend)

**Goal**: Ástríðr's per-profile engine axis genuinely exists — real telemetry, a scoped swap command, and a queryable swap-history route — verified live before CodePulse UI work depends on it.
**Depends on**: Nothing (first phase of milestone)
**Requirements**: ENGINE-01, ENGINE-02, ENGINE-05 *(TELE-02 reassigned to Phase 109 on 2026-08-07 — see below)*

*(Sequencing note — TELE-02: `control_verb_swap` shares its emit channel with ENGINE-01 — both events originate from the same astridr swap code path this phase is already touching (`astridr/engine/control_verbs/swap_model.py`), so building its domain route alongside the telemetry emitter avoids a second pass through the same ingest dispatch code. ~~The requirement's "surfaced as per-profile swap history" half is satisfied here as a minimal readout, not a full page — Phase 109 owns the richer current-engine UI.~~ **CORRECTED 2026-08-07:** that last sentence turned out to be wrong, and the routing rationale above is unaffected — Phase 108 did build the whole domain route. But the "surfaced" half could not be delivered here: D-15 chose `GlobalSwapModal` as the readout's host without cross-referencing 103-CONTRACT.md §8, which had already established that modal as the ALL-PROFILES axis with no per-profile scope. It has exactly one mount site app-wide and `listByScope` requires a non-optional `profileId` while global swaps store `scope: null`, so the query cannot serve that host at all. **TELE-02 is therefore reassigned to Phase 109**, which owns the per-profile surfaces this readout needs. Phase 108 keeps and completes the routing half; the hook, pure helpers and their tests all ship here and are forward-compatible. See the corrected D-15 in `phases/108-per-profile-engine-telemetry-astridr-backend/108-CONTEXT.md`.)*

**Success Criteria** (what must be TRUE):

  1. A profile's engine resolution or swap on the running astridr stack produces a telemetry row carrying a real `profileId` and model id — never an `unknown` sentinel — and an unresolved value is refused at emit, not written. (Contrast: v13.0's 93 pruned rows were *all* `{profileId:"unknown", model:"unknown"}` — the axis has never carried one valid row.)
  2. `swap.set` accepts an explicit profile scope and swaps only that profile's engine; an unscoped call still produces today's global behaviour byte-identical.
  3. `control_verb_swap` events route to a queryable domain table (not just the generic `runtime_events` log) and can be listed as per-profile swap history.
  4. The per-profile emit and the scoped `swap.set` are exercised against the live running stack — a real profile swap observed producing a real telemetry row and a real swap-history entry — before Phase 109 begins, closing ENGINE-05.

**Plans**: 7 plans (4 waves) — cross-repo (astridr-repo `feature/brain-swap` + codepulse `master`)

**Wave 1**

- [x] 108-01-PLAN.md — astridr: profile ContextVar lifecycle repair (both live set-points) + `_emit_model_routing` profileId / refuse-to-emit / `selectedModel`→`model` rename + `mode` derivation + emit-on-change (ENGINE-01; D-01, D-02, D-09, D-11, D-12)
- [x] 108-02-PLAN.md — codepulse: `controlVerbSwaps` table + internal-only domain module + bounded read + `RETENTION_DAYS` entries for both engine-axis tables (TELE-02; D-10, D-13, D-14)

**Wave 2**

- [x] 108-03-PLAN.md — codepulse: `case "control_verb_swap"` ingest route + `status:"failed"` skip on `model_routing` + first-ever tests for both cases (TELE-02, ENGINE-01; D-13, D-14)
- [x] 108-04-PLAN.md — astridr: per-profile override store + `_resolve_model` precedence rung + scoped `swap.set` with fail-closed validation; **+ codepulse: 103-CONTRACT.md corrected in place** (ENGINE-02; D-04, D-05, D-06, D-08)

**Wave 3**

- [x] 108-05-PLAN.md — astridr: scope-aware `swap_model` set/restore + `scope` on all four swap-history emits + D-03 boot seed (ENGINE-01, ENGINE-02, TELE-02; D-03, D-07, D-13)
- [x] 108-06-PLAN.md — codepulse: `useControlVerbSwaps` hook + swap-history section in the existing `GlobalSwapModal` (TELE-02; D-15)

**Wave 4**

- [x] 108-07-PLAN.md — **ENGINE-05 gate, `autonomous: false`**: self-hosted Convex deploy → astridr rebuild (`prod,war-room`) → in-container freshness probe → live scoped swap + profiled turn + **unscoped control** + fail-closed negative control, evidence pasted as rows (ENGINE-05; D-16) — Task 4 operator sign-off received 2026-08-07; ENGINE-05/ENGINE-01/ENGINE-02 marked Complete

---

### Phase 109: Per-Agent Engine UI

**Goal**: Operators see and control each profile's current engine in CodePulse, sourced from real telemetry rather than config or optimistic state.
**Depends on**: Phase 108 (needs real telemetry rows and a working scoped `swap.set` to bind against)
**Requirements**: ENGINE-03, ENGINE-04, TELE-02 *(TELE-02 reassigned from Phase 108 on 2026-08-07)*

*(TELE-02 inheritance note: Phase 108 shipped the entire **routed** half — the `controlVerbSwaps` table with retention bounds, the `control_verb_swap` ingest case, `scope` on all four emits, and a `useControlVerbSwaps` hook with pure `filterBrainSwaps`/`describeSwapOutcome` helpers, all tested. What remains is the **surfaced** half only: give that readout a host with a real per-profile scope. Phase 108's D-15 chose `GlobalSwapModal` and was falsified — that modal is the all-profiles axis. The surfaces named in criterion 1 below are the natural home. **Decide before planning:** per-profile only, in which case `convex/controlVerbSwaps.ts`'s `listByScope` works as-is; or a combined/global view, in which case its non-optional `profileId: v.string()` needs a signature change to reach the `scope: null` rows a global swap writes. Discovering that mid-execution is expensive; it is a five-minute decision at plan time.)*

**Success Criteria** (what must be TRUE):

  1. The "This profile" picker scope, the header badge, and the pre-swap confirm modal's current-engine column each show a profile's actual current engine, sourced from telemetry — never from a config read.
  2. Triggering a per-profile swap shows honest live status (in-flight → success/failure) and reconciles to the *resulting* active engine read back from Ástríðr — no optimistic-only success state, matching the global axis's BSC-04 contract.
  3. A profile with no engine telemetry yet renders an honest absent/unknown state, not a fabricated current engine.

**Plans**: 9 plans (7 waves) — cross-repo (astridr-repo `feature/brain-swap` + codepulse `master`)

**Wave 1**

- [x] 109-01-PLAN.md — astridr: `ModelRouter` override enumerators + `profile_overrides` on `build_swap_state_payload` + `default_profile_id` on the `swap.catalogue` ack (ENGINE-03, ENGINE-04; D-03, D-05)
- [x] 109-02-PLAN.md — codepulse Convex: bounded `listGlobal` (matches absent `scope`, not `null`) + `mergeSwapHistory` on the WR-02-safe side + 103-CONTRACT.md §3/§8/§9 corrected in place (TELE-02; D-11)

**Wave 2**

- [x] 109-03-PLAN.md — retire the D-16 stub seam whole: flag/adapter/fixtures/registrar/validator/e2e spec deleted, one `useBrainCatalogue`, real scoped `swap.set` dispatch (ENGINE-03, ENGINE-04; D-01, D-02, D-04)

**Wave 3**

- [x] 109-04-PLAN.md — `useProfileBrainOverrides` + the override rung above global, fleet-only `lastTurn`, canonical "Not reported", confirm-column + Settings row on one resolver (ENGINE-03; D-06, D-07, D-14)

**Wave 4**

- [x] 109-05-PLAN.md — `modelIdsMatch` applied at all SEVEN model-id equality sites with a behavioral guard each (ENGINE-03; D-08)

**Wave 5**

- [x] 109-06-PLAN.md — `useProfileSwap`: the 5-state server-confirmed outcome machine, confirming against the override slot, with the bounded "not yet confirmed" state on all four surfaces (ENGINE-04; D-05)

**Wave 6**

- [x] 109-07-PLAN.md — D-13 vendor mapping + Unclassified group/chip/`costTier` + the hoisted scope-aware confirm gate with a mouse/keyboard parity test (ENGINE-03; D-09, D-13)
- [x] 109-08-PLAN.md — combined bounded history read, one shared `SwapHistoryList`, and the collapsible per-profile section on Settings with a live-derived pinned note (TELE-02; D-10, D-11, D-12)

**Wave 7**

- [x] 109-09-PLAN.md — **operator-attended live gate, `autonomous: false`**: astridr rebuild + in-container freshness probe, then D-03/D-05/D-06/D-11 probes each paired with a control, evidence pasted as rows (ENGINE-03, ENGINE-04, TELE-02) — **7 pass · 1 partial · 1 failed leg** (2026-08-10). ENGINE-03 and TELE-02 signed; ENGINE-04 held pending. Evidence: `109-LIVE-EVIDENCE.md`.

**Wave 8**

- [x] 109-10-PLAN.md — **gap closure, `autonomous: false`**: `unmountedRef` reset with a StrictMode-remount regression guard (proven RED first), then Probe D re-run live on `:5173` (all four legs) and Probe F closed via a new `profiles.removeConfig` — **ENGINE-04 signed 2026-08-10** (ENGINE-04, ENGINE-03)

**UI hint**: yes

---

### Phase 110: Convex Durability

**Goal**: The self-hosted Convex instance is durable by design rather than nightly-restarted by mitigation — every table (including `aggregates`) is actually pruned, and the memory-growth driver is understood.
**Depends on**: Nothing (independent of ENGINE/MISSION/TELE work)
**Requirements**: DUR-01, DUR-02, DUR-03

**Success Criteria** (what must be TRUE):

  1. `aggregates` rows past its retention window are pruned in the same batch-capped, cursor-seeked manner as the 15 other tables in `RETENTION_DAYS` — no bulk delete, no new tombstone storm.
  2. Operator can observe a complete nightly prune pass across *every* table in `RETENTION_DAYS` (aggregates included) on the live self-hosted instance — confirmed from the running system, not just read from code.
  3. The convex-backend memory-growth root cause is documented with supporting evidence, or genuinely fixed — and `ConvexNightlyRestart` is recorded as a deliberate, understood mitigation rather than an unexplained workaround. *(Does not presuppose a code fix exists — DUR-03 may legitimately close as "root cause identified and documented.")*

**Plans**: 6 plans in 5 waves

**Wave 1**

- [x] 110-01-PLAN.md — pure prune-chain helpers (`partitionBatchForPrune`, `resolveRotationStart`, `planRotationWrite`) with the Pitfall-1 all-skipped-batch regression, mutation-tested (DUR-01; D-02, D-05, D-06)
- [x] 110-02-PLAN.md — **`autonomous: false`**: control-paired knob probe of the live backend, upstream `#495`/`#522`/`#525` status re-verified at write-up time, `110-MEMORY-EVIDENCE.md` + the D-11 CLAUDE.md bullet (DUR-03; D-09, D-10, D-11)

**Wave 2**

- [x] 110-03-PLAN.md — `aggregates: 90` + `PRUNE_PREDICATES` + predicate-aware delete loop, rotation cursor on one patched `agentConfigs` row, `listRetentionPolicy`, self-describing terminal log line, and the 5-site stale-comment sweep (DUR-01, DUR-02; D-01, D-02, D-03, D-04, D-05, D-06)

**Wave 3**

- [x] 110-04-PLAN.md — **`autonomous: false`**: pre-deploy baseline with its absence controls, operator-authorized production deploy to `127.0.0.1:3210`, deployed-policy readback cross-checked by key count (DUR-01, DUR-02; D-01, D-06, D-08)

**Wave 4**

- [x] 110-05-PLAN.md — **`autonomous: false`**: `retention-health-check.ps1`'s 14-entry hand-copied policy deleted for a live read with a hard non-zero exit on failure; DUR-02 leg 2 captured with a three-way table-count control (DUR-02; D-07, D-08)

**Wave 5**

- [x] 110-06-PLAN.md — **`autonomous: false`, gated on a real 09:00 UTC cron run**: DUR-02 leg 1 proven from the durable `_scheduled_functions` record (table indices 0..18, all-success, inside the cron window) after container logs were shown with controls to be structurally unable to carry it — Convex UDF `console.log` never reaches container stdout and the self-hosted backend retains no queryable log history; DUR-01 daily-survival confirmed against the pre-deploy baseline with its hourly control (DUR-01, DUR-02; D-01, D-05, D-06, D-08)

**UI hint**: no

---

### Phase 111: Mission Board

**Goal**: ~~The leftover `JobsPanel`/`subagentJobs` surface becomes a real mission board operators can trust, built entirely on data that streams today.~~ **CORRECTED 2026-08-10 (Stale Docs rule) — the struck goal rested on a premise that a live probe falsified.** The surface becomes a truthful **post-hoc history board** over terminal-state rows, and every affordance app-wide that asserts a mission state the data cannot support is removed.
**Depends on**: ~~Nothing (frontend-only, independent of every other v14.0 phase)~~ Nothing — **still frontend-only under the narrowed scope**, but *not* because the data streams: it does not. See below.
**Requirements**: MISSION-01 *(partial — see D-04)*, ~~MISSION-02~~ *(deferred, D-03)*, MISSION-03

*(**Scope narrowed 2026-08-10** at discuss time, on evidence, operator-approved. Probe of `subagentJobs` on the live self-hosted instance: **7 rows ever**, `{failed:2, cancelled:3, completed:2}` — **zero `queued`, zero `running`**; **`submittedAt === finishedAt` in 7 of 7**; **newest row 2026-07-07**, ~34 days stale; **0 rows** carrying a `sessionId`/`traceId`; and `subagentJobs` **absent** from `retention.ts` (control: `toolExecutions` present), so those 7 are lifetime history rather than a pruned window. Corroborated by `runtimeIngest.ts:594-596`, which routes **terminal-state events only** — "never queued/running, those live only in Supabase". Consequences: criterion 1's *live*, *duration* and *orphan* clauses each lack backing (`submittedAt` is a synthetic copy of `finishedAt`; a `running` row cannot arrive, making the orphan clause vacuous); criterion 2 has **no data path at all** — `toolExecutions` carries no `jobId` and `subagentJobs` no `sessionId`/`traceId`, and `toolExecutions` is on 14-day retention anyway. Criterion 3 is the only fully satisfiable one and becomes the phase's acceptance spine. The live board is **not abandoned** — it moves to a new cross-repo phase that first repairs the astridr emitter (real `submittedAt`, non-terminal states, a correlation key). Full evidence and the 13 locked decisions: `phases/111-mission-board/111-CONTEXT.md`.)*

**Success Criteria** (what must be TRUE):

  1. Background missions render as an honest **history** — per-mission status and "finished X ago", with no duration figure and no live/streaming chrome implying data that is not arriving. *(Was: "live cards carrying status and duration … orphaned … renders honestly as failed". The orphan and duration halves defer with the emitter phase per D-04.)*
  2. ~~Tool activity on a mission renders as humanized labels ("reading Gmail…", "Write index.html") rather than raw tool/function names.~~ **Deferred to the emitter phase (D-03)** — no join key exists between a mission and its tool rows.
  3. No per-mission cost, confirm-card, or squad-grouping affordance appears anywhere on the board — each stays fully absent rather than showing as empty or zeroed. **Extended (D-06/D-07):** this applies to *every* consumer of `subagentJobs`, not just `JobsPanel` — including `ActiveAgentsPanel` (`Chat.tsx:1054`), which filters `status === "running"` against a table that never receives one and therefore renders "No agents running." permanently and unconditionally.

**Plans**: 3 plans in 2 waves

**Wave 1** (parallel, no file overlap)

- [x] 111-01-PLAN.md — JobsPanel becomes a mission history surface: prune the queued/running icon map, replace the dual-meaning elapsed formatter with a single-meaning "finished X ago" incl. a day tier, strip the pulsing dot and BACKGROUND JOBS label, hex→token fix, plus a new JobsPanel.test.tsx (MISSION-01, MISSION-03; D-05, D-08, D-09, D-10, D-13)
- [x] 111-02-PLAN.md — delete ActiveAgentsPanel outright (component, test, import, mount + its SectionErrorBoundary) and repair Chat.test.tsx's six exposed seven-panel claims (MISSION-03; D-01, D-07, D-13)

**Wave 2**

- [x] 111-03-PLAN.md — **`autonomous: false`**: correct REQUIREMENTS.md so the traceability table stops asserting what Phase 111 cannot deliver, plant SEED-007 to own the deferred emitter work, audit both non-goals with controls, and an operator checkpoint against the running app (MISSION-03; D-02, D-03, D-04, D-06, D-11, D-12)

**UI hint**: yes

---

### Phase 112: Telemetry Coverage Closure

**Goal**: astridr's telemetry contract documentation matches what the system actually emits, and every remaining ambiguous event kind has a recorded, justified disposition.
**Depends on**: Phase 108 (reuses the per-kind routing precedent and decision record established for `control_verb_swap`/TELE-02)
**Requirements**: TELE-01, TELE-03

**Success Criteria** (what must be TRUE):

  1. `docs/astridr-contract.md` no longer documents the 5 Group A kinds (`instructions_loaded`, `loop_lifecycle`, `worktree_lifecycle`, `batch_execution`, `auto_memory`) as live behaviour — each entry is corrected to reflect the zero-emitter reality or explicitly marked aspirational.
  2. Every remaining Group B event kind (excluding `control_verb_swap`, already disposed in Phase 108) has a recorded disposition — routed to a domain table and surfaced, or explicitly kept generic-table-by-design — with a stated reason per kind, none left ambiguous.
  3. `governor_decision` (the one kind confirmed arriving live) is evaluated as the strongest routing candidate, and whatever disposition it receives is justified in writing rather than built purely for switch-coverage symmetry.

**Plans**: 8 plans in 5 waves (112-08 added mid-execution as a wave-4 gap-closure plan, after adversarial verification of 112-04 confirmed a live silent-drop on `tool_executed.round`)

Plans:
**Wave 1** *(parallel, no file overlap - different repos / different files)*

- [x] 112-01-PLAN.md - TELE-01, astridr-repo docs only: five dated NOT EMITTED banners in place on sections 2.20-2.24 plus removal of the three unfirable critical-events rows (TELE-01; D-07, D-08, D-09) — complete 2026-08-12, astridr-repo commit `7f61ba1d`, see `112-01-SUMMARY.md`
- [x] 112-02-PLAN.md - governorDecisions + messageRoutes tables in schema.ts, both bounded in RETENTION_DAYS with dated reasons, plus a mutation-proven drift assertion (TELE-03; D-06) — complete 2026-08-12, commits `65a4870e`/`bb3b4099`/`4314916a`, see `112-02-SUMMARY.md`

**Wave 2** *(blocked on 112-02)*

- [x] 112-03-PLAN.md - domain modules: internalMutation writes + bounded .take() reads for both tables, CR-01 and bounded-read guard tests, Convex API codegen (TELE-03; D-04, D-13) — complete 2026-08-12, commits `4649ec93`/`dd64983d`/`947908fa`/`35e4493c`, see `112-03-SUMMARY.md`

**Wave 3** *(blocked on 112-03; the two plans below run in parallel - no file overlap)*

- [x] 112-04-PLAN.md - ingest routing: resolveGovernorDecisionEvent / resolveMessageRoutedEvent + both dispatch cases, with held_reason null-normalization from the first commit and three-wire-shape tests (TELE-03; D-04, D-05, D-13, D-14) — complete 2026-08-12, commits `0e4a3150`/`60ea4727`/`ba64bcc3`, see `112-04-SUMMARY.md`
- [x] 112-05-PLAN.md - the approved UI surface: GovernorDecisionLog on the Settings notifications tab with honest loading/empty/error states (TELE-03; D-04, D-13) — complete 2026-08-12, commits `f25f297d`/`72fbe0f4`, see `112-05-SUMMARY.md`

**Wave 4** *(blocked on 112-04)*

- [x] 112-06-PLAN.md - the D-10/D-11 disposition record: GROUP_B_DISPOSITIONS const + three-layer drift guard, mutation-proven against three distinct drifts (TELE-03; D-01, D-03, D-05, D-10, D-11, D-12) — complete 2026-08-12, commits `5420f694`/`f8d27799`, see `112-06-SUMMARY.md`
- [x] 112-08-PLAN.md - gap closure: normalize `tool_executed.round`'s explicit-null wire shape (confirmed live via `loop.py:2090-2097`/`get_round_context()`), plus `noFallthroughCasesInSwitch` (added mid-execution, not in the original 7-plan count) — complete 2026-08-12, commits `13afcadf`/`05312b01`/`3846a2d3`, see `112-08-SUMMARY.md`

**Wave 5** *(blocked on 112-04, 112-05, 112-06, 112-08)*

- [x] 112-07-PLAN.md - **`autonomous: false`**: [BLOCKING] `--env-file` deploy to the self-hosted backend, then live control-paired arrival proof where an empty result is a FAILURE, plus an operator checkpoint (TELE-03; D-02, D-04, D-13, D-14) — complete 2026-08-13, operator-authorized deploy exited 0 to `http://127.0.0.1:3210` (no `tidy-whale-981`); D-14 proven live over ~19.75h with 50 generic == 50 domain and **identical timestamp multisets**, 0 rows storing `heldReason === null`; D-13 recorded **OPEN** (surface deployed + control-paired, 0 rows, explained by its measured ~0.7-1.2 rows/day); operator approved the UI checkpoint. See `112-07-SUMMARY.md` / `112-LIVE-EVIDENCE.md`

---

### Phase 113: Debt Sweep

**Goal**: Three small, independent tech-debt items are closed — none blocks the other v14.0 work, so this phase can run at any point in the sequence.
**Depends on**: Nothing (independent of every other v14.0 phase)
**Requirements**: DEBT-05, DEBT-06, DEBT-07

**Success Criteria** (what must be TRUE):

  1. `computeSkillPrunes` no longer drops live plugin skills on a transient/partial catalog scan — the skill count stays stable across a scan cycle that previously showed 185 → 131 → 185.
  2. **CLOSED GUARDED (2026-08-12) — the original bar was not met and was deliberately amended, not quietly satisfied.** The intermittent `Chat.test.tsx` brain-pill failure did not reproduce across **80 clean full-suite iterations** (tiered 30 + 50, the budget Larry set), so no captured failure ever existed to diagnose from and the "fixed from a captured root cause" criterion as originally written is **unmet**. Delivered instead: query-site instrumentation that records the match count, each match's `textContent`, and the body HTML length, so the next occurrence is self-diagnosing. The `waitFor` half of the criterion **was** met and is asserted mechanically — `src/pages/Chat.test.tsx` is untouched, its `waitFor` count is unchanged at 23, and it contains no added `{ timeout:`. The defect remains latent. See `phases/113-debt-sweep/113-FLAKE-EVIDENCE.md`.
  3. `convex-selfhost/`'s compose `logging:` block and restart scripts are committed to version control and reproducible from a fresh checkout.

**Carried forward from this phase:** `SEED-009` — `src/App.test.tsx`'s `/memory` lazy-route timeout, caught once in 86 full-suite soak iterations and **not** DEBT-06 (different test, different file). Cause unidentified; both leading hypotheses refuted by evidence rather than left open. See `seeds/SEED-009-app-lazy-route-timeout.md`.

**Plans**: 8 plans in 3 waves

Plans:
**Wave 1**

- [x] 113-01-PLAN.md - DEBT-05 producer: plugin origin split + per-sub-source coverage declaration on the /scan wire (wave 1)
- [x] 113-02-PLAN.md - DEBT-05 server: coverage-declaration prune guard on both call sites + refusal alerts (wave 1)
- [x] 113-03-PLAN.md - DEBT-05 frontend: eight origin-coupling sites accept the plugin origin (wave 1)
- [x] 113-05-PLAN.md - DEBT-06: query-site DOM capture + per-iteration soak runner, both control-proven (wave 1)
- [x] 113-07-PLAN.md - DEBT-07: ignore set before git init, INSTANCE_SECRET parameterized, key-name template (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 113-04-PLAN.md - DEBT-05 migration: one-shot dry-run-by-default re-origin of existing plugin rows (wave 2)
- [x] 113-08-PLAN.md - DEBT-07: bootstrap README, preflight validator, reviewed first commit, temp-clone proof (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 113-06-PLAN.md - DEBT-06: tiered 30/50 full-suite soak and honest disposition (wave 3)

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 108. Per-Profile Engine Telemetry (astridr backend) | 7/7 | Complete    | 2026-08-07 |
| 109. Per-Agent Engine UI | 10/10 | Complete    | 2026-08-10 |
| 110. Convex Durability | 6/6 | Complete   | 2026-08-11 |
| 111. Mission Board | 3/3 | Complete    | 2026-08-11 |
| 112. Telemetry Coverage Closure | 8/8 | Complete | 2026-08-13 |
| 113. Debt Sweep | 8/8 | Complete (DEBT-06 GUARDED) | 2026-08-12 |
| 115. Workspace Scanner | 10/10 | Complete - verified passed-with-concerns (D-17 blocker remediated: redacted + unpushed history rewritten; residual public Phase 93 mentions accepted by Larry); D-05 unattended firing OPEN until 2026-08-14 | 2026-08-13 |

### Phase 114: Workspace Map view

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 113
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 114 to break down)

### Phase 115: Workspace scanner

**Goal:** Larry's declared workspace roots are walked nightly and stored as a versioned, department-classified directory map in Convex — with secret-classified file paths structurally unable to leave the host, and no snapshot transmitted until a dry-run report has been reviewed and approved.
**Requirements**: none mapped — design-doc-driven phase (`Mandras/02-projects/agentic-os-second-brain.md` § "CodePulse" bullet C2). The acceptance-bearing units are the 17 locked decisions D-01..D-17 in `115-CONTEXT.md`; plans are traced to those instead of REQ-IDs, following Phase 116's precedent.
**Depends on:** Nothing. *(Corrected 2026-08-12: this line previously read "Phase 114", which is the dependency **inverted**. The approved design's own dependency graph — `Mandras/02-projects/agentic-os-second-brain.md:48` — states "C2 → enables C1's workspace lens", where C2 is this phase and C1 is Phase 114. The scanner produces the data the map view renders, so 115 comes first. The original line was a sequential default from `gsd-phase add`, not a real constraint. See `115-CONTEXT.md` § Phase Boundary.)*
**Plans:** 10 plans

Plans:

**Wave 1** *(no dependencies — four fully parallel plans, zero `files_modified` overlap, verified mechanically)*

- [x] 115-01-PLAN.md - Extract `scanner.mjs`'s inline POST-with-bearer block into shared `hooks/ingestPost.mjs` so D-04's "import, don't copy" becomes possible (wave 1) — complete 2026-08-12, extraction landed (no fallback needed), see `115-01-SUMMARY.md`
- [x] 115-02-PLAN.md - Split classification config (D-08 + D-17) and its fail-closed two-half loader, plus the `.gitignore` rules keeping the sensitive half out of this public repo (wave 1) — complete 2026-08-12, 61 local roots declared, loader mutation-proven twice, see `115-02-SUMMARY.md`
- [x] 115-03-PLAN.md - D-12's structural dry-run gate as pure functions, with the mandatory mutation test proving the refusal fires (wave 1) — complete 2026-08-12, mutation-proven RED (7 failed/17 passed) then GREEN (24/24), see `115-03-SUMMARY.md`
- [x] 115-04-PLAN.md - Versioned `workspace*` tables and the `internalMutation` that ingests a snapshot with an inline, batch-capped prune (wave 1) — complete 2026-08-12, pointer-flip-last + inline prune reading candidates from the meta doc only, mutation-proven, see `115-04-SUMMARY.md`

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 115-05-PLAN.md - The pure classifier `(path, config) → {department, access, isSecret}` and the compose-mount derivation `access` reads from (wave 2, depends on 115-02) — complete 2026-08-12, deny-by-default proven against the 4 measured leaks, D-09 proven against the real compose file at 18 mounts, 52 tests/17 suites mutation-proven twice, see `115-05-SUMMARY.md`
- [x] 115-06-PLAN.md - `POST /workspace-ingest` route and handler, reusing the existing ingest auth surface, dispatching to 115-04's `internalMutation` (wave 2, depends on 115-04) — complete 2026-08-12, fail-closed auth first (line 103 vs first ctx.* access at line 191), full field validation, dispatch exclusively via `internal.workspace.upsertWorkspaceSnapshot`, 16 vitest tests, no deploy — see `115-06-SUMMARY.md`

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 115-07-PLAN.md - The read-incapable filesystem walk, per-directory rollup, snapshot payload and D-12 dry-run report (wave 3, depends on 115-02 + 115-05) — complete 2026-08-12, deps destructuring exactly {readdirSync, statSync, mountedSet} (line 72), content-read grep = 1, 27 tests/11 fixture suites, 4 mutation proofs confirmed RED then GREEN, see `115-07-SUMMARY.md`

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 115-08-PLAN.md - Entry-point wiring (load → walk → classify → report → **gate** → POST) and D-12 case 5, proving the refusal precedes the network call (wave 4, depends on 115-01 + 115-03 + 115-07) — complete 2026-08-12, runWorkspaceScan + isDirectRun CLI branch, gate strictly precedes the single postSnapshot call site (line 710 < 729), 11 new tests + 4 mutation proofs closing the mandatory five-case table, verified live against Larry's real tree (15647 dirs/274660 files), no deploy — see `115-08-SUMMARY.md`

**Wave 5** *(blocked on Wave 4 completion — `autonomous: false`, attended)*

- [x] 115-09-PLAN.md - [BLOCKING] deploy to the self-hosted instance, Larry's review of the real dry-run report, first genuine ingest, and 115-04's `it.todo` markers converted to live evidence (wave 5, depends on 115-06 + 115-08) — complete 2026-08-13. Deploy named `http://127.0.0.1:3210` with `No indexes are deleted by this push`; Larry reviewed over THREE rounds and approved; eight live ingests; all four `it.todo` markers converted, incl. the deferred-remainder self-heal genuinely exercised. Three blocking defects found by running it: D-11's inline prune could not execute at ANY cap (isolated by a payload-size control after TWO wrong diagnoses), `MAX_DIRS_PER_INGEST` sat above the ceiling its own comment cited, and D-12's hash covered the file inventory. See `115-09-SUMMARY.md` + `115-LIVE-EVIDENCE.md`

**Wave 6** *(blocked on Wave 5 completion — `autonomous: false`, attended)*

- [x] 115-10-PLAN.md - D-05's nightly scheduled task: logging wrapper plus an installer routing around this machine's two known Task Scheduler traps (wave 6, depends on 115-09) — complete 2026-08-13. `CodePulse-WorkspaceScan` registered daily **04:15** (NOT the plan's 03:15, which sat between ConvexBackup 03:00 and ConvexBackupFull 03:30); read-back control resolved so its six PASS lines are trustworthy; Larry confirmed no window appears and both triggers logged `EXIT=0`, cross-checked against the DB (activeVersion 8→10). **D-05's unattended firing remains OPEN, due 2026-08-14.** See `115-10-SUMMARY.md`

Cross-cutting constraints:

- **D-01/D-03 hold by construction, not by omission** — no file-content read exists anywhere in the walk path, and secret-classified paths are omitted entirely rather than flagged, since a filename is itself a disclosure.
- **Every gate carries a passing control** — four `false` results are indistinguishable from an always-false function, so each mutation test pairs its negatives with a positive.
- **Self-hosted Convex safety** — no `import --replace-all`, no bulk delete or bulk patch; the prune is batch-capped by construction, not by a schedule that can be silently disabled.
- **The deploy is [BLOCKING] and asserts on the instance name** — `npx convex deploy --env-file C:\Users\mandr\convex-selfhost\selfhosted.envfile`; build and typecheck pass whether or not the schema reached the live backend.

### Phase 116: Galdr prompt library

**Goal:** Galdr is a live, Convex-spined prompt library: a prompt saved from one Claude Code session is fetchable by slug from any other session with every `{{variable}}` filled in before injection, and the same library is browsable, editable and versioned at `/galdr` in CodePulse.
**Requirements**: none mapped — this is a design-doc-driven phase (`docs/proposals/2026-08-07-seidr-suite-design.md` §4.1). The acceptance-bearing units are the 16 locked decisions D-01..D-16 in `116-CONTEXT.md`; plans are traced to those instead of REQ-IDs.
**Depends on:** Nothing. (The "Phase 115" line here was an auto-generated stub artifact — the execution-order note above records that 116-119 are independent of everything; 116 -> 117 -> 118 -> 119 is daily-value preference, not dependency.)
**Plans:** 8 plans in 6 waves

Plans:
**Wave 1**

- [ ] 116-01-PLAN.md — schema tables, D-13 retention exemption, `validateGaldrAuth` (wave 1)
- [ ] 116-02-PLAN.md — shared pure `{{variable}}` + slug contract (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 116-03-PLAN.md — `convex/galdr.ts` domain module: collision refusal, append-only versions, count-cap prune, archive (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 116-04-PLAN.md — four bearer-authed HTTP routes with no CORS and no OPTIONS (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 116-05-PLAN.md — [BLOCKING] deploy the schema to the live self-hosted instance (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 116-06-PLAN.md — FillVariablesDialog, SendSplitButton, PromptEditorDrawer (wave 5)
- [ ] 116-07-PLAN.md — the `/galdr` + `/galdr-save` Claude Code skill and its install (wave 5)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 116-08-PLAN.md — `/galdr` page, nav registry entry, route, e2e (wave 6)

### Phase 117: Bifröst link hub

**Goal:** A `links` table backs a categorized `/bifrost` hub whose entries are jumpable from the command palette, and whose container-bound local services carry a liveness dot that reflects real service state rather than a decoration.
**Requirements**: none mapped — design-doc-driven phase (`docs/proposals/2026-08-07-seidr-suite-design.md` §4.2). The acceptance-bearing units are the 6 locked decisions D-01..D-06 in `117-CONTEXT.md`, same convention as Phase 116.
**Depends on:** Nothing. (The auto-generated "Phase 116" stub line was an artifact — the design doc's §5 states 116-119 are independent of each other and of 109-115; the ordering is daily-value preference, not dependency.)
**Plans:** 0 plans — **executed via `/gsd-quick`, by design.** The design doc's §5 phasing table sizes this phase `S (/gsd-quick-shaped)`, so plan-phase was deliberately skipped rather than missed. This is why the phase carries a CONTEXT, SUMMARY and VERIFICATION but no PLAN.md, and why the milestone's plan counter reads two lower than its summary count (Phase 119 is the other).

Plans:

- *(none — quick-path execution; see above)*

**Status: COMPLETE and VERIFIED `passed`, 4/4 goal clauses (`117-VERIFICATION.md`, 2026-08-10).** Verified against the design doc's own gate, on live probes rather than code reading: the `links` table deployed to `127.0.0.1:3210` with `by_category`/`by_order` added and zero `.convex.cloud`; `/bifrost` reachable and rendering, proven by an `e2e/navigation.spec.ts` click-through rather than a unit test; the palette jump asserted on the resulting popup URL, not merely on the item being clickable; and liveness resolved by CONTAINER NAME (D-02, a deliberate departure from the design doc's host:port join) with a green/absent control pair. One case is unit-only — see the report's gaps section.

### Phase 118: Studio media gallery

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 117
**Plans:** 0 plans

Plans:

- [ ] TBD (run /gsd-plan-phase 118 to break down)

### Phase 119: Loom curated pipelines

**Goal:** `pipelines` and `pipelineRuns` back a React Flow view at `/loom` that renders a curated pipeline definition-first, with per-step docs served from the row rather than from disk, and a live run driven by real step-event emits over Convex subscriptions animating the same nodes — an error rendering distinctly from a clean run.
**Requirements**: none mapped — design-doc-driven phase (`docs/proposals/2026-08-07-seidr-suite-design.md` §4.4). The acceptance-bearing units are the 8 locked decisions D-01..D-08 in `119-CONTEXT.md`, same convention as Phase 116.
**Depends on:** Nothing. (The auto-generated "Phase 118" stub line was an artifact — §5 of the design doc states 116-119 are mutually independent; the Ástríðr cron lens only *improves* after v29 A3, it does not gate this phase.)
**Plans:** 0 plans — **executed without plan-phase. This is a deviation, not a design choice.** Unlike Phase 117 (sized `S (/gsd-quick-shaped)` in §5 and therefore correctly quick-executed), §5 sizes Loom `M/L` — the same tier as Phase 116, which was broken into 8 plans across 6 waves. Recorded here rather than smoothed over: the phase shipped and verified, but it skipped the planning step its own sizing called for, and that is the second of the two reasons the milestone's plan counter reads lower than its summary count.

Plans:

- *(none recorded — see the deviation note above)*

**Status: COMPLETE and VERIFIED `passed`, 4/4 goal clauses (`119-VERIFICATION.md`, 2026-08-11).** Verified against the design doc's own gate on live evidence: both tables deployed to `127.0.0.1:3210` with `by_slug`/`by_pipelineSlug`/`by_startedAt` added; `/loom` rendering 3 React Flow nodes with zero page errors and reachable from the sidebar via `e2e/navigation.spec.ts`; and six real emits through `hooks/loom-emit.mjs` producing an errored run (`["complete","error","pending"]`) against a second clean run (`["complete","complete","complete"]`) on the same pipeline and components — a genuine control pair where only the run differs, not two separate assertions.

---

*Last updated: 2026-08-08 — **Phases 114-119 appended to v14.0** via `gsd-sdk query phase.add` ×6 (114-115: agentic-os-second-brain workspace map/scanner; 116-119: Seiðr Suite — Galdr/Bifröst/Studio/Loom, SEED-005). Milestone now 12 phases (108-119); requirements for 114-119 derive at each phase's discuss/plan step. Prior: 2026-08-06 — v14.0 started via `/gsd-new-milestone`, 6 phases (108-113) from 17 requirements (ENGINE-01..05, DUR-01..03, MISSION-01..03, TELE-01..03, DEBT-05..07), 100% coverage; v13.0 SHIPPED & ARCHIVED 2026-08-06 (5 phases 103-107, 53 plans, 14/15 requirements, tagged `v13.0`).*
