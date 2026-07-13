# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- ✅ **v6.0 Agentic OS Front-End** — Phases 71-77 (71/72/73/74 shipped light; 77 complete 2026-06-18; **75 Agent Console superseded by v7.0 Forge** 2026-06-18; **76 Unified Graph Hub deferred to v8.0 and DELIVERED there (phases 83/84/85, GH-01..04)** — reconciled 2026-06-29)
- ✅ **v7.0 Forge Integration** — Phases 78-82 (**shipped 2026-06-17**) — Forge→CodePulse Surface-Substrate fold-in — [archive](milestones/v7.0-ROADMAP.md)
- ✅ **v8.0 Graph/KG Consolidation** — Phases 83-87 (**shipped 2026-06-23**) — unified Graphs hub + KG depth features — [archive](milestones/v8.0-ROADMAP.md)
- ✅ **v9.0 Readability & Experience** — Phases 88-92 (**shipped 2026-06-29**) — durable analytics rollup, readable theme system + editorial skin, Agent Room, 3D Memory Galaxy, voice command palette — [archive](milestones/v9.0-ROADMAP.md)
- ✅ **v10.0 Eval & Trace Observability + Hardening** — Phases 93-95 (**shipped 2026-07-07**) — eval pipeline + ingest, native trace waterfall, security audit + key rotation + dependency majors — [archive](milestones/v10.0-ROADMAP.md)

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

**Milestone goal:** Make CodePulse readable and richer to operate — a readability-first, fully token-driven theme system with the "Midnight Aubergine" editorial skin, a durable Convex analytics rollup, the Agent Room completed into a real multi-persona surface, and an opt-in 3D render mode for the code/vault/KG graph.

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

## v10.0 Eval & Trace Observability + Hardening

> **Started 2026-07-04** via `/gsd-new-milestone` (seeded from `.planning/todos/pending/eval-and-trace-observability-v10.md`, the 2026-06-30 cross-repo capability audit). Continues phase numbering from 93. Both observability features ride existing `llmMetrics`/ingest transport — no new emitter protocol from Ástríðr.

**Milestone goal:** Close the loop on agent-output quality and per-call traceability — receive and judge the quality scores Ástríðr already emits, render LLM call chains natively — and harden the platform (security audit, key rotation, major dependency migrations).

**Phase summary:**

- [x] **Phase 93: Eval Pipeline & Quality KPIs** — `evalScores` ingest (idempotent), nightly LLM-as-judge `internalAction`, per-persona quality KPI + regression detection
 (completed 2026-07-06)

- [x] **Phase 94: Trace Waterfall** — `traceId` grouping on `llmMetrics` + in-app call-chain waterfall UI (replaces dead-link `LangfuseTraceLink.tsx`)
 (completed 2026-07-06)

- [x] **Phase 95: Hardening — Security, Key Rotation, Dependency Majors** — `/cso` audit + remediation, Forge ingest-key rotation, TypeScript 6 + react-day-picker 10 migrations
 (completed 2026-07-07)

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
**Plans:** 12 plans (2 waves)

Plans:
**Wave 1**

- [ ] 96-01-PLAN.md — Wave 1: shared PageHeader component + contract test (F7 foundation)
- [ ] 96-02-PLAN.md — Wave 1: DashboardLayout IA restructure (dissolve CONSOLE) + real/hidden header telemetry + iconComponents export (F1/D-03, F3/D-04, F2 enabler)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 96-03-PLAN.md — Wave 2: F6 approval fix — Chat payload/ack correctness + shared ApprovalActions (Chat+Inbox) + headers (F6/D-11)
- [ ] 96-04-PLAN.md — Wave 2: Tasks+MissionControl merge (view toggle, typed api) + orphan deletions + App.tsx redirects (F1/D-01/D-02/D-08, F7/F10)
- [ ] 96-05-PLAN.md — Wave 2: CommandPalette + HeroStatsBar sourced from navItems/iconComponents; stale links fixed (F2)
- [ ] 96-06-PLAN.md — Wave 2: F4 honesty — Security badge/allowlist, Automation cron count, Infrastructure placeholder + headers (D-05/D-06/D-07)
- [ ] 96-07-PLAN.md — Wave 2: shared FactsTable (Memory+Dreaming) + Dreaming dead-code + headers (D-09, F9/D-10, F7)
- [ ] 96-08-PLAN.md — Wave 2: MeetingBot live roster + Skills no-op delete removal + headers (D-10, F9, F7)
- [ ] 96-09-PLAN.md — Wave 2: F8 mobile master-detail collapse (ForgePage, WarRoom) + WarRoom header (F8, F7)
- [ ] 96-10-PLAN.md — Wave 2: F10 minors — DocComments tokens/header, ThemeSwitcher aria-label, KG/ToolGalaxy bg token, Analytics dead UI (F10, F9/D-10)
- [ ] 96-11-PLAN.md — Wave 2: F7 header sweep A — 5 hr/* + Dashboard/Alerts/Briefings/Capabilities/Settings/SelfHealing
- [ ] 96-12-PLAN.md — Wave 2: F7 header sweep B — Executions/Ideation/ConfigPage/InsightsChat/LiveRun/WhatsApp/Hive/GraphsHub/McpInventory/Quality/QualityDetail/SessionDetail

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7, 58 | v4.0 | 36/36 | Complete | 2026-04-14 |
| 59-70 | v5.0 | 23/23 | Complete | 2026-05-25 |
| 71-74 | v6.0 | shipped (light) | Complete | — |
| 75. Agent Console | v6.0 | — | 🔁 Superseded by v7.0 Forge | 2026-06-18 |
| 76. Unified Graph Hub | v6.0→v8.0 | 3/3 | ✅ Delivered by v8.0 (ph 83/84/85, GH-01..04) | 2026-06-29 |
| 77. CI & Prod Hardening | v6.0 | 3/3 | ✅ Complete | 2026-06-18 |
| 78. Forge Emitter + Schema | v7.0 | ✅ | Complete | 2026-06-13 |
| 79. Forge UI Tab (read-only) | v7.0 | 3/3 | Complete (PR #20) | 2026-06-15 |
| 80. Command Bridge | v7.0 | 4/4 | Complete | 2026-06-16 |
| 81. Live Log Streaming | v7.0 | 4/4 | Complete | 2026-06-17 |
| 82. Files + Preview + Hardening | v7.0 | 4/4 | Complete | 2026-06-17 |
| 83. Graph Snapshot Receiver | v8.0 | 3/3 | Complete | 2026-06-18 |
| 84. Graphs Hub + Code/Vault Render | v8.0 | 3/3 | Complete | 2026-06-22 |
| 85. Cross-Graph Navigation | v8.0 | 4/4 | Complete | 2026-06-22 |
| 86. KG Full-Text Search + Clustering | v8.0 | 3/3 | Complete | 2026-06-23 |
| 87. Saved Views + Temporal Diff | v8.0 | 4/4 | Complete | 2026-06-23 |
| 88. Analytics Rollup | v9.0 | 4/4 | Complete   | 2026-06-24 |
| 89. Readable Themes & Editorial Skin Toggle | v9.0 | 7/7 | Complete    | 2026-06-24 |
| 90. Agent Room / War Room | v9.0 | 8/8 | ✅ Complete | 2026-06-29 |
| 91. 3D Memory Galaxy | v9.0 | 5/5 | Complete    | 2026-06-29 |
| 92. Voice-Activated Command Palette (Jarvis Mode) | v9.0 | 6/6 | Complete   | 2026-06-25 |
| 93. Eval Pipeline & Quality KPIs | v10.0 | 6/6 | Complete    | 2026-07-06 |
| 94. Trace Waterfall | v10.0 | 5/5 | Complete    | 2026-07-06 |
| 95. Hardening — Security, Key Rotation, Dependency Majors | v10.0 | 4/4 | Complete   | 2026-07-07 |

*Last updated: 2026-07-07 — **v10.0 SHIPPED & ARCHIVED**. 3 phases (93-95), 15 plans, 36 tasks, 9/9 requirements (EVAL-01..03, TRACE-01/02, HARD-01..04). All 3 phases verified (`VERIFICATION.md` each; 95 = 16/16). Full detail archived to `milestones/v10.0-ROADMAP.md`. Next: `/gsd-new-milestone`.*

*Prior: 2026-06-29 — **v9.0 Readability & Experience SHIPPED & ARCHIVED** (tagged v9.0; archive `milestones/v9.0-ROADMAP.md`). 5 phases (88-92), 30 plans, 19/19 requirements. — Prior note: Phase 90 build (90-01..90-07) complete; this session closed the cross-repo LIVE-integration gap that was never closed at scoping. Five layered gaps fixed + committed: (1) `war-room` Docker profile (LiveKit + 5 agent workers) wasn't started → create_war_room 500; (2) Phase-90 Convex fns committed-but-not-deployed → listRooms error; (3) astridr never POSTed to `/war-room-ingest` → built room.created/updated emit (astridr 97c63643, codepulse e09ce37); (4) transcript.chunk ingest from agents → built (astridr 26874fac); (5) launch-dialog form-wipe fix (codepulse 4c3372d) + new delete-room feature (codepulse 1189ff5). astridr token endpoint live (4093aec). Full record: `phases/90-agent-room-war-room/90-INTEGRATION-NOTES.md`. Remaining: 90-08 operator live sign-off. — Prior note: Phase 92 (VOX-01..04) planned: 5 plans / 4 waves for the browser-side voice-activated command palette (openWakeWord ONNX wake word on onnxruntime-web, in-browser, Apache-2.0 — NO Picovoice, NO account/key/env var; Web Speech STT → existing chat.send → persona TTS via shared useTtsPlayback). Architecture: AudioWorklet capture → Web Worker ONNX pipeline (numThreads=1, no COOP/COEP) → main-thread turn loop. Independent of 89/90/91; reuses shipped Phase 2 WebSocket sender + Phase 3 palette. Custom hey_astrid.onnx classifier trained via openWakeWord Colab pipeline before VOX-01 QA (bundled "hey jarvis" model is the dev stand-in). Next: `/gsd-execute-phase 92`.*
