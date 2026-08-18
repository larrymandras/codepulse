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

## v14.0 Per-Agent Engine Visibility, Convex Durability & Mission Board — ✅ SHIPPED (2026-08-17)

> Shipped 2026-08-17, tagged `v14.0`. 12 phases (108–119), **86 plans**, **15/17 requirements satisfied — 1 PARTIAL (MISSION-01, duration + orphan recovery deferred to SEED-007 by D-04) and 1 REASSIGNED OUT (MISSION-02, blocked on astridr, no join key exists)**. All 12 phases carry a VERIFICATION.md. Suite 4654 passing / 0 failing. Full requirements archived in [milestones/v14.0-REQUIREMENTS.md](milestones/v14.0-REQUIREMENTS.md); this section in [milestones/v14.0-ROADMAP.md](milestones/v14.0-ROADMAP.md); audit in [milestones/v14.0-MILESTONE-AUDIT.md](milestones/v14.0-MILESTONE-AUDIT.md). Phase dirs archived under `milestones/v14.0-phases/`.

> **Started 2026-08-06** via `/gsd-new-milestone` with 6 phases (108–113) from 17 requirements. **Phases 114–119 were appended 2026-08-08** via `gsd-sdk query phase.add` ×6 — 114/115 the agentic-OS workspace map + scanner, 116–119 the Seiðr Suite (Galdr / Bifröst / Studio / Loom, SEED-005). Those six are **design-doc-driven**: their acceptance units are per-phase `D-NN` decisions in each phase's CONTEXT.md, not REQUIREMENTS.md IDs. Closed **BY HAND** per the standing rule — no `gsd-sdk milestone.complete`.

**Milestone goal:** See and drive each Ástríðr *agent's* reasoning engine individually (closing v13.0's one PARTIAL, BSC-01), make the self-hosted Convex instance durable and its memory growth explained rather than merely mitigated, surface background missions honestly on the data that actually exists — then build out the Seiðr Suite of operator surfaces on top.

**Phase summary:**

- [x] **Phase 108 — Per-Profile Engine Telemetry (astridr backend)** (7 plans) — the per-profile emit + scoped `swap.set`, with the integration gate closed *during* execution; three real defects found live before sign-off
- [x] **Phase 109 — Per-Agent Engine UI** (10 plans) — "This profile" picker scope, header badge, pre-swap confirm column, all sourced from telemetry and never from config; TELE-02's surfacing half landed here after D-15 was falsified mid-execution
- [x] **Phase 110 — Convex Durability** (6 plans) — `aggregates` bounded and batch-capped, a full verified prune pass across every `RETENTION_DAYS` table, and the memory-growth root cause documented with evidence (upstream `convex-backend#495`) rather than left as an unexplained nightly restart
- [x] **Phase 111 — Mission Board** (3 plans) — honest status/history on the data that exists; every affordance asserting an unbacked figure removed from **both** consumers rather than zeroed
- [x] **Phase 112 — Telemetry Coverage Closure** (8 plans) — 5 Group A kinds corrected in the contract doc as aspirational, every Group B kind given a machine-readable disposition, and one confirmed-live null-drop defect normalized
- [x] **Phase 113 — Debt Sweep** (8 plans) — skill-catalog prune made fail-closed; DEBT-06 **closed guarded** with its criterion honestly reworded after 80 clean soak iterations produced no reproduction; `convex-selfhost/` brought under version control
- [x] **Phase 114 — Workspace Map view** (11 plans) — 18/18 decisions verified
- [x] **Phase 115 — Workspace scanner** (10 plans) — deny-by-default classification, zero content reads in the walk path; verified *passed-with-concerns*, recorded rather than rounded away
- [x] **Phase 116 — Galdr prompt library** (8 plans) — versioned prompt library with a capped version history
- [x] **Phase 117 — Bifröst link hub** (phase-level summary, 0 per-plan files) — operator link hub
- [x] **Phase 118 — Studio media gallery** (15 plans) — media-vault + sidecar provenance, content-hash identity, ≤200KB thumbnails, and **three genuinely different generator backends each proven end-to-end**; 16/16 decisions verified. Nine defective checks were found and fixed *inside* this phase — each had passed while blind to what it existed to assert
- [x] **Phase 119 — Loom curated pipelines** (phase-level summary, 0 per-plan files) — pipeline run tracking with capped step events

**Known deferred at close:** MISSION-01's duration + orphan-recovery halves and MISSION-02 in full, both to SEED-007 and both blocked on data shape rather than effort — no `running` row can arrive and no job↔tool join key exists. Plus `message_routed` routed but deliberately unsurfaced (needs its own UI pass), the `links` table's unrecorded retention decision, and the parked `llm-analytics-rollup` CR-01. None blocking; all in [milestones/v14.0-MILESTONE-AUDIT.md](milestones/v14.0-MILESTONE-AUDIT.md).

---

## v15.0 "Borealis Console" Premium UI Overhaul

> **Started 2026-08-17** via `/gsd-new-milestone`, consuming `MILESTONE-CONTEXT.md` (prepared 2026-08-07). Continues phase numbering from v14.0 (108–119) → **Phases 120–125**. The design law is already decided (variant B "Borealis blend", approved 2026-08-07 against three model proposals) — phases consume it from `Skill("sketch-findings-codepulse")` and `.planning/sketches/001-dashboard-quiet-control-room/index.html`; they do not re-litigate it.

**Milestone goal:** Make CodePulse look and feel genuinely premium — calm layered matte surfaces, colour spent only on state, two signature layers (aurora Signal Horizon + Pulse ECG hero), Ástríðr's serif voice — while raising usability through honest states, quiet badges, a 3-zone header and a 4-domain sidebar.

**Phase summary:**

- [x] **Phase 120 — Polish & Verified Defects** — remove the unanimous 3-model kill list and fix the code-verified defects (fabricated Integrations row, destructive confirms living in a toast and a `window.confirm`, E-Stop reflow, the 900px sidebar/Settings collision); the cheapest work, done first so it clears the decoration that would otherwise confound later visual-regression and contrast measurement. *(Corrected 2026-08-17: this line previously listed "`--status-ok` identical to `--primary`" as a Phase 120 defect. `REQUIREMENTS.md:44` assigns that decoupling to TOKEN-02 / Phase 122, and Phase 120's own success criteria below never mention it.)* (completed 2026-08-18)
- [x] **Phase 121 — Analytics Query Resilience** — `/analytics` survives any single failing query, and its LLM usage queries (`costByModel`, `providerBreakdown`) move onto the `aggregates` rollups while the two consumer-less unbounded scans (`latencyOverTime`, `costByProvider`) are deleted (DEBT-08; scope amended 2026-08-18 — see the criteria below and `121-CONTEXT.md` D-06) — a hard prerequisite for the six-state tile contract, not a passenger (completed 2026-08-18)
- [ ] **Phase 122 — Tokens, Primitives & Contrast Measurement** — layered surface tokens across all 5 themes, the three-hue-owner law, motion tokens, the six-state metric-tile primitive, shared `PageHeader`/`EmptyState` — plus A11Y-01, sizing the true scope of the contrast problem before any remediation is planned
- [ ] **Phase 123 — Accessibility Remediation** — fix every violation A11Y-01 measured, and prove the contrast suite cannot report green against a page it never rendered
- [ ] **Phase 124 — Shell & Information Architecture** — the 48px 3-zone header and the 232px sidebar's 4-domain regroup, a pure `navRegistry.ts` change with no route changes
- [ ] **Phase 125 — Signature Layers** — the aurora Signal Horizon, the Pulse ECG canvas hero, and a one-surface trial of Ástríðr's serif voice

**Execution order:** 120 → 121 → 122 → 123 → 124 → 125, sequential. 120 is first because it is the cheapest work and removes the decoration that would otherwise confound Phase 122's A11Y-01 contrast measurement. 121 must land at or before 122 — 122 carries TOKEN-04's six-state tile contract, and a tile cannot render an honest `unavailable` state while a single `useQuery` throw still blanks `/analytics`; 121 has no code dependency on 120 and could run in parallel, but is sequenced second to keep the milestone linear. 123 (A11Y remediation) is sequenced immediately after 122, not at the end, per the standing rule that redoing contrast work after the palette is frozen means touching all 5 themes twice. 124 depends on 122's surface/hairline tokens. 125 depends on both 122 (the tokens the Signal Horizon and ECG hero read via `getComputedStyle`) and 124 (the shell the Signal Horizon renders on top of).

| Phase | Milestone | Plans Complete | Status | Completed | Notes |
|-------|-----------|----------------|--------|-----------|-------|
| 120. Polish & Verified Defects | v15.0 | 7/7 | Complete | 2026-08-17 | VERIFIED `passed` 6/6 (`120-VERIFICATION.md`). POLISH-04 is **Partial** by design — 3 fabrication residues assigned to Phases 122/125. Carried to 122/123/124 in `120-DESIGN-REVIEW-HANDOFF.md`: the one sub-AA badge (Forge `failed`, pre-existing), emphasis keyed to the legacy semantic bucket, and the geometry spec's 900px-only overflow assertion. |
| 121. Analytics Query Resilience | v15.0 | 7/7 | Complete | 2026-08-18 | VERIFIED `passed` 3/3 criteria, 6/6 must-haves (`121-VERIFICATION.md`); code review clean, 0 findings (`121-REVIEW.md`). Criteria 1+3 were proved LIVE against THREE real un-injected query timeouts (`activityHeatmap`, `toolFlowSankey`, `tokenSunburst`), each isolated to its own boundary with zero collateral -- stronger evidence than the injected tests. Deploy was operator-run: `npx convex deploy` is refused by the Claude Code auto-mode permission classifier, so an agent structurally cannot perform it; full record in `121-DEPLOY-EVIDENCE.md` (469 lines). Backfill ran 120 links over the full 720-hour window, 895 rows, 0 truncated hours. `ROLLUP_READ_CAP` (8000) MEASURED live at 889/1773 rows read (11%/22%) and left unchanged -- this closes `121-RESEARCH.md` Q5, which had flagged that measurement and never taken it. Follow-up filed: `todos/pending/unbounded-analytics-scans-timeout.md` -- 4 unbounded `.collect()` queries OUTSIDE this phase's scope now time out server-side (their failure is what proved criteria 1+3). Latent, untriggered: `aggregates.ts` backfill's worst-case read count can exceed the 4,096-read ceiling (pre-existing since Phase 104, ~7 rows/hour actual). |
| 122. Tokens, Primitives & Contrast Measurement | v15.0 | 2/19 | In Progress | - | Executing 2026-08-18. Wave 0 (122-01): A11Y-01 before-matrix captured, 20/20 keyless cells, 24 violation objects / 218 nodes. Wave 1 (122-02): surface ramp in all 5 theme blocks, semantic tokens re-pointed as var() aliases; verified in the SHIPPED stylesheet (5x each ramp token, 15 surface aliases, control 0). Fixed a real pre-existing defect -- emerald and amber declared no card/popover/border/input and were inheriting cyan's literals through the shared `.dark, [data-theme=cyan]` selector. |
| 123. Accessibility Remediation | v15.0 | 0/0 | Not started | - | |
| 124. Shell & Information Architecture | v15.0 | 0/0 | Not started | - | |
| 125. Signature Layers | v15.0 | 0/0 | Not started | - | |

## Phase Details

### Phase 120: Polish & Verified Defects

**Goal**: No surface in the app carries the unanimous 3-model kill-list decoration or any of the three code-verified honesty defects — the cheapest, least-confounding work, done first so later visual-regression and contrast work measures a clean surface.
**Depends on**: Nothing (first phase of milestone)
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05, POLISH-06
**Success Criteria** (what must be TRUE):

  1. A repo-wide search for the kill-list patterns (`hover:scale-[1.01]`, glitch-text, matrix-bg, CRT-by-default, `nav-active-shadow`/`nav-hover-shadow`, decorative pulse dots, cyan scrollbar glow, violet search pill) returns zero live hits.
  2. The E-Stop control holds fixed geometry and never wraps or reflows at any viewport width, from mobile to ultrawide.
  3. Deleting a task (or any other destructive action) requires confirming in a dialog — the toast-based confirm at `Tasks.tsx:144-145` no longer exists anywhere in the app. *(Corrected 2026-08-17: there is no delete at that location. `Tasks.tsx:143-160` is a **move-to-action-column** confirm on a 5-second auto-dismissing toast — genuinely the target defect, but not a delete. A second site of the same class, `WarRoom.tsx:86`'s `window.confirm` on a real delete, is also in scope. See `120-CONTEXT.md` §premise_corrections.)*
  4. `HeroStatsBar`'s Integrations row either shows a real, emitter-backed figure or is gone — no surface renders a number with no live source behind it. *(Scope note: `HeroStatsBar.tsx:141`'s synthetic "System Load" figure is the same defect class but is assigned to SIGNAL-02 / Phase 125 by `REQUIREMENTS.md:59`. Phase 120 records it rather than fixing it, so POLISH-04 is not fully closed here — verification must not read it as clean without that caveat.)*
  5. Status badges follow the quiet law (only Failed renders filled) under one unified vocabulary (Running/Succeeded/Failed/Cancelled), and the sidebar and Settings no longer collide at 900px. *(Vocabulary is confined to those four spine words; states with no honest mapping — `auth_failed`, `queued`, `pending`, `stopping_pending` — keep distinct labels per D-15, and `auth_failed` must stay visually distinct from `failed`.)*

**Plans**: 7 — planned 2026-08-17
  - `120-01` — `hover:scale-[1.01]` + paired-transition sweep (36 files) · POLISH-01 · D-01, D-02
  - `120-02` — `index.css` dead-rule deletions, scrollbar, and all `DashboardLayout` kill targets · POLISH-01 · D-03, D-04, D-05, D-06
  - `120-03` — both destructive confirms → `AlertDialog` · POLISH-01, POLISH-03 · D-12, D-13, D-14
  - `120-04` — quiet-badge fill law + spine vocabulary + D-17 inventory · POLISH-05 · D-15, D-16, D-17
  - `120-05` — Integrations row deletion + fabrication-class sweep · POLISH-01, POLISH-04 · D-07, D-08
  - `120-06` — pulse-dot triage (47 sites) + reduced-motion gating · POLISH-01 · D-09, D-10, D-11
  - `120-07` — E-Stop geometry + 900px collision + criterion-1 aggregate close-out · POLISH-02, POLISH-06 · (discretion items, no D-NN)

  Waves: 1 = `120-01`..`120-05` (zero file overlap, genuinely parallel) · 2 = `120-06` (depends on `120-01`) · 3 = `120-07` (depends on `120-02`, `120-06`; `autonomous: false` — carries a human checkpoint).
  All 17 decisions D-01..D-17 covered; POLISH-01..06 all mapped.

**UI hint**: yes — but **no UI-SPEC.md was written for this phase, deliberately** (Larry, 2026-08-17). This phase builds no new surface: the design law is already locked in `Skill("sketch-findings-codepulse")` and D-01..D-17, and `REQUIREMENTS.md:16-18` declares those inputs closed to re-litigation. Matches v14.0 precedent, where sweep phases (113-debt-sweep, 110, 115, 117, 119) had no UI-SPEC while new-surface phases did. Phases 124/125 DO build new surface and still need their own. **Phase 122 was reclassified 2026-08-18** — its discuss-phase output (`122-CONTEXT.md:14`) established that it builds no new surface either (token layer + shared primitives that existing surfaces read from), and its primitive contracts are already specified in D-07/D-13/D-14/D-17/D-19/D-20, so it too was planned with `--skip-ui` (Larry, 2026-08-18).

---

### Phase 121: Analytics Query Resilience

**Goal**: `/analytics` cannot be blanked by a single failing query, and its LLM cost/latency queries read from the durable `aggregates` rollups instead of scanning raw `llmMetrics` — the prerequisite that makes an honest six-state tile possible on that route.
**Depends on**: Nothing — independent Convex/data-layer work with no shared surface with Phase 120; sequenced second because it must land before Phase 122's TOKEN-04 tile contract is built against `/analytics`.
**Requirements**: DEBT-08
**Success Criteria** (what must be TRUE):

  1. Forcing a throw in any ONE query `/analytics` reads leaves every other panel rendering — no single failing query takes down the whole route. *(Amended 2026-08-18 per `121-CONTEXT.md` D-01/PC-1: the three originally-named queries are already inside `SectionErrorBoundary` at `Analytics.tsx:336`, so criterion 1 as first written plausibly already passed. The live vector is the ~10 `useQuery` calls hoisted into the page component body at `Analytics.tsx:52-81` — including `llm.subscriptionUsage`, the query that actually caused the 2026-08-11 blackout — which execute above every boundary. Scope is now every query the route reads, a strict superset.)*
  2. `costByModel` (`llm.ts:231`) and `providerBreakdown` (`:275`) read the `aggregates` rollups, not raw `llmMetrics` scans. *(Amended 2026-08-18 per `121-CONTEXT.md` D-06: `latencyOverTime` (`:308`) is **deleted, not migrated** — it has zero consumers, `useLatencyOverTime` at `useAnalytics.ts:4-6` is imported nowhere, and no `latency` rollup exists or is being added. `costByProvider` (`:214`) is deleted with it. Verification must read the deletion as satisfying this criterion, not as an unmet gap.)*
  3. Each surviving query can independently report its own failure without silently absorbing or masking a sibling's.

**Plans**: 7 plans

Plans:
- [x] `121-01-PLAN.md` - `metric_type: "calls"` hourly rollup in the shared `insertTokenSplitBuckets` helper, a de-latched `backfillTokenSplit` cursor, and a shared fake-`ctx.db` harness that records every queried table (D-05, D-08)
- [x] `121-02-PLAN.md` - `costByModel`/`providerBreakdown` migrated to bounded `aggregates` reads with `asOf` + coverage; `costByProvider`, `latencyOverTime`, `useLatencyOverTime` and the Phase 104 STOPGAP note deleted; `evalScores` `llmMetrics` read capped (D-06, D-07, D-09, D-10)
- [x] `121-03-PLAN.md` - eight self-fetching components created to receive the ten queries hoisted into the page body, none handling its own errors (D-02)
- [x] `121-04-PLAN.md` - `Analytics()` stripped of all fetching, Summary Row split across four boundaries, dead `subscriptionUsage` read removed, per-query fault-injection tests (D-01, D-02, D-03; criteria 1 and 3)
- [x] `121-05-PLAN.md` - AST-derived structural ratchet over `Analytics.tsx` plus its synthetic-mutation tests, each proven to parse before its failure is believed (D-04)
- [x] `121-06-PLAN.md` - `LlmAnalyticsPanel` rewired to the rollup payload plus one `as of HH:MM` freshness label (D-07, D-11)
- [x] `121-07-PLAN.md` - attended deploy to the self-hosted backend, resumed backfill chain, live read-cap measurement and `/analytics` smoke check (autonomous: false)

Waves: 1 = `121-01`, `121-03` (zero file overlap) - 2 = `121-02`, `121-04` - 3 = `121-05`, `121-06` - 4 = `121-07` (attended).
All 11 decisions D-01..D-11 covered; DEBT-08 mapped to every plan.

---

### Phase 122: Tokens, Primitives & Contrast Measurement

**Goal**: The shared token layer and primitives that 200+ components inherit from carry the Borealis surface/motion/state law, and the true size of the contrast problem is measured across the full theme × page matrix before any remediation is planned.
**Depends on**: Phase 120 (a clean surface, free of kill-list decoration, is what A11Y-01 must measure against) and Phase 121 (TOKEN-04's six-state contract needs `/analytics` to survive a failing query first).
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05, A11Y-01
**Success Criteria** (what must be TRUE):

  1. All 5 themes define the layered surface tokens (`--surface-0/1/2/3`, `--hairline`), and every surface reads them instead of a hardcoded value.
  2. `--status-ok` is visually distinct from `--primary` in every theme — the three-hue-owner law (cyan = machine, violet = Ástríðr only, `--status-*` = state) holds app-wide.
  3. Every animation is driven by the shared motion tokens (120/200/320ms, the house easing), gated on `prefers-reduced-motion`, with `readable` staying fully effect-free.
  4. A shared metric-tile primitive renders all six explicit states (loading/ready/empty/stale/unavailable/error) — no surface shows a bare "Loading…" or renders "—" as a confident value.
  5. Every route uses the shared `PageHeader` contract, and the true count of WCAG-AA contrast violations across the full 4-themes × 5-pages matrix is measured and recorded — not sized against the known single-cell figure of 234.

**Plans**: 19 plans

Plans:
- [x] `122-01-PLAN.md` — A11Y-01 BEFORE contrast capture: per-cell JSON writer added to the 4×5 axe matrix, 20 control cells committed ahead of any `index.css` edit, sampling limit named (D-21, D-22, D-24)
- [x] `122-02-PLAN.md` — per-theme surface ramps (`--surface-0/1/2/3`, `--hairline`) in all 5 themes, with `--background`/`--card`/`--popover`/`--border`/`--input` re-pointed as `var()` aliases (D-01, D-03, D-04)
- [ ] `122-03-PLAN.md` — three-hue-owner law (`--status-ok` decoupled, `--astridr` created, AA error-fill pair), motion tokens plus the three `@utility` duration blocks that make them emit CSS, `readable`'s blanket no-effects rule, then the hard checkpoint (D-05, D-06, D-08, D-09, D-10, D-11, D-28; autonomous: false)
- [ ] `122-04-PLAN.md` — sweep slice A: `src/components/` A–E, 36 files, all four buckets (palette, hex, duration, violet) with a per-file ledger (D-02)
- [ ] `122-05-PLAN.md` — sweep slice B: `src/components/` F–M, 21 files, all four buckets (D-08)
- [ ] `122-06-PLAN.md` — sweep slice C: `src/components/` N–S, 34 files, all four buckets incl. the densest non-`hr/` violet cluster
- [ ] `122-07-PLAN.md` — sweep slice D: `src/components/` T–Z plus `graph/`, `hr/`, `skills/`, `ui/`, 30 files, with the shadcn alias boundary asserted (D-01)
- [ ] `122-08-PLAN.md` — sweep slice E: remaining component subtrees, `src/layouts/` and 13 page files, 22 files, with a route-stability check
- [ ] `122-09-PLAN.md` — shared six-state module, `useMetricState`, and the new `EmptyState` primitive (D-14, D-19, D-20)
- [ ] `122-10-PLAN.md` — `StatusBadge` re-keyed to operational severity with a separate grammar for execution modes, Forge `failed` corrected to AA against `--card`, `IntakeStatusBadge`'s three filled maps brought under the law (D-06, D-07)
- [ ] `122-11-PLAN.md` — `PageHeader` grown with eyebrow/subtitle, Analytics and BuildProgress converted, named exemption register written (D-17, D-18)
- [ ] `122-12-PLAN.md` — VitalsRail's Convex dot bound to the REACTIVE `useConvexConnectionState()`, HeroStatsBar's dead interpolated class removed and its surfaces tokenised (D-16)
- [ ] `122-13-PLAN.md` — `MetricCard` rewritten in place to the six-state contract, glow/`text-white`/palette trend colours/inline rgba stripped (D-13, D-14)
- [ ] `122-14-PLAN.md` — every `MetricCard` render site declares its state, verified live against three real `/analytics` query failures (D-14, D-15)
- [ ] `122-15-PLAN.md` — bare-`Loading` sweep plus the components-root em-dash placeholders, 19 files, skeletons shaped like their content (D-15)
- [ ] `122-16-PLAN.md` — em-dash placeholders across the component subtrees and the page tier, 14 files (D-15)
- [ ] `122-17-PLAN.md` — corpus-derived ratchet over six buckets with a frozen `KNOWN_EXEMPT` record, proven by two syntactically-valid mutations including one in a file on no list (D-25, D-26)
- [ ] `122-18-PLAN.md` — population-level reduced-motion and `readable` assertions each paired with a must-differ control, plus the rasterised rendered-result spec with pre-phase git controls (D-11, D-12, D-22, D-27)
- [ ] `122-19-PLAN.md` — A11Y-01 AFTER capture, per-cell delta, completed `122-CONTRAST-BASELINE.md`, operator sign-off and hand-edited requirement marks (D-21, D-23, D-24; autonomous: false)

Waves: 0 = `122-01` · 1 = `122-02` · 2 = `122-03` (checkpoint) · 3 = `122-04`–`122-08` (5 parallel, zero file overlap) · 4 = `122-09`–`122-12` · 5 = `122-13` · 6 = `122-14`–`122-16` · 7 = `122-17`, `122-18` · 8 = `122-19` (checkpoint).
All 28 decisions D-01..D-28 covered; TOKEN-01..05 and A11Y-01 each mapped to at least one plan.
**UI hint**: yes

---

### Phase 123: Accessibility Remediation

**Goal**: Every contrast violation Phase 122 measured is fixed, and the automated suite is proven unable to report green against a page it never rendered.
**Depends on**: Phase 122 — needs A11Y-01's measured scope (which theme × page cells actually violate) before remediation can be sized or planned; sequenced immediately after the token phase, not at the end, so the palette is never touched twice.
**Requirements**: A11Y-02, A11Y-03
**Success Criteria** (what must be TRUE):

  1. `e2e/theme-contrast.spec.ts` passes with zero `wcag2a`/`wcag2aa` violations against `dev:noauth`, across every theme × page cell A11Y-01 measured.
  2. Deliberately raising the Clerk gate mid-run makes the suite fail (not skip) on the page it can no longer reach — proving the vacuous-pass guard shipped in `fee96b5d` still holds after the token rewrite.

**Plans**: TBD
**UI hint**: yes

---

### Phase 124: Shell & Information Architecture

**Goal**: Every route shares one calm 3-zone header and a 4-domain sidebar — presentation-only, with no route in the app changing address.
**Depends on**: Phase 122 — the header and sidebar are built on the surface/hairline tokens and quiet-badge law established there.
**Requirements**: SHELL-01, SHELL-02
**Success Criteria** (what must be TRUE):

  1. A 48px 3-zone header (breadcrumb / command bar / system-chip + E-Stop + overflow menu) renders on every route, replacing today's header everywhere.
  2. The 232px sidebar shows 4 collapsible domains (Command / Observe / Agents / System) with count badges and a 2px active rail.
  3. A route-list diff taken before and after the regroup is identical — the `navRegistry.ts` change is presentation-only; no URL moves.

**Plans**: TBD
**UI hint**: yes

---

### Phase 125: Signature Layers

**Goal**: The two moments that make Borealis feel like itself are live on top of the new token and shell layers, and Ástríðr's serif voice has been trialled on one real surface rather than committed app-wide.
**Depends on**: Phase 122 (the tokens the Signal Horizon and ECG hero read via `getComputedStyle`) and Phase 124 (the shell the Signal Horizon renders on top of).
**Requirements**: SIGNAL-01, SIGNAL-02, SIGNAL-03
**Success Criteria** (what must be TRUE):

  1. The aurora-textured Signal Horizon renders as a 2px shell line carrying event packets on every page, turns crimson the instant E-Stop arms, and eases back through amber over ~2.6s on disarm — static or hidden under `prefers-reduced-motion` and in `readable`.
  2. The Dashboard's synthetic "SYSTEM LOAD" bar is replaced by a Pulse ECG canvas hero driven by real events over a 60s window, reading its colours from tokens via `getComputedStyle` — one component, no Recharts, entry-chunk budget holds.
  3. Ástríðr's serif voice is live on exactly one surface (Briefings or Insights), and its evaluation is recorded before any app-wide font commit is even proposed.

**Plans**: TBD
**UI hint**: yes

---

*Last updated: 2026-08-17 — **v15.0 "Borealis Console" Premium UI Overhaul roadmapped**: 6 phases (120–125) derived from the milestone's 20 requirements — 100% coverage, zero orphans, zero duplicates. Continues phase numbering from v14.0 (108–119). Awaiting `/gsd:plan-phase 120`.*
