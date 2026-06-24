# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- ✅ **v6.0 Agentic OS Front-End** — Phases 71-77 (71/72/73/74 shipped light; 77 complete 2026-06-18; **75 Agent Console superseded by v7.0 Forge** 2026-06-18; **76 Unified Graph Hub NOT shipped → deferred to v8.0** per 2026-06-18 reconciliation)
- ✅ **v7.0 Forge Integration** — Phases 78-82 (**shipped 2026-06-17**) — Forge→CodePulse Surface-Substrate fold-in — [archive](milestones/v7.0-ROADMAP.md)
- ✅ **v8.0 Graph/KG Consolidation** — Phases 83-87 (**shipped 2026-06-23**) — unified Graphs hub + KG depth features — [archive](milestones/v8.0-ROADMAP.md)
- 🌱 **v9.0 Readability & Experience** — Phases 88-91 (**active, started 2026-06-23**) — durable analytics rollup, readable theme system + editorial skin, Agent Room, 3D Memory Galaxy

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

## v9.0 Readability & Experience — ACTIVE (started 2026-06-23)

**Milestone goal:** Make CodePulse readable and richer to operate — a readability-first, fully token-driven theme system with the "Midnight Aubergine" editorial skin, a durable Convex analytics rollup, the Agent Room completed into a real multi-persona surface, and an opt-in 3D render mode for the code/vault/KG graph.

**Phase summary:**

- [x] **Phase 88 — Analytics Rollup** — Durable Convex 16 MiB read-limit fix via ingest-time rollups (completed 2026-06-24)
- [x] **Phase 89 — Readable Themes & Editorial Skin Toggle** — Token-driven theming + Midnight Aubergine skin + no-flash switcher + WCAG-AA pass (completed 2026-06-24)
- [ ] **Phase 90 — Agent Room / War Room** — Wire live participant identity + bounded listing + real operator Join + transcript robustness
- [ ] **Phase 91 — 3D Memory Galaxy** — Opt-in `react-force-graph-3d` render mode on `CodeVaultGraph`, lazy-loaded, theme-aware
- [ ] **Phase 92 — Voice-Activated Command Palette (Jarvis Mode)** — Browser wake-word (Porcupine) opens the command palette in voice mode; Web Speech STT → existing `chat.send`; streamed reply spoken in a Norse persona voice

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
**Plans**: TBD

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
**Plans**: TBD
**UI hint**: yes

---

### Phase 92: Voice-Activated Command Palette (Jarvis Mode)
**Goal**: An operator can summon Ástríðr hands-free from anywhere in CodePulse by speaking a wake word, speak a command, and hear the streamed reply in a Norse persona voice — entirely through the existing command palette and WebSocket `chat.send` path, with zero Ástríðr backend changes.
**Depends on**: Phase 2 (WebSocket command sender — shipped) and Phase 3 (Command Palette — shipped). No hard dependency on 89/90/91. Requires a browser-target Picovoice Porcupine `.ppn` keyword + `porcupine_params.pv` placed in `public/` (operator-supplied via Picovoice Console; same AccessKey as Ástríðr server-side, exposed as `VITE_PICOVOICE_ACCESS_KEY`).
**Requirements**: VOX-01, VOX-02, VOX-03, VOX-04
**Success Criteria** (what must be TRUE):
  1. With voice mode enabled, speaking the wake word anywhere in the app reliably opens the command palette in a "listening" voice mode within ~1s — detection runs continuously in a Web Worker via `@picovoice/porcupine-web` and does not require the palette to already be open (`DashboardLayout.tsx` wake handler + existing ⌘K toggle coexist).
  2. After wake, the operator's spoken command is transcribed via the browser Web Speech API (reusing the recognition logic in `ChatInput.tsx`), shown as a live transcript, and on a final result is sent verbatim through the existing `sendCommand({type:"chat.send", message})` over `AstridrWSContext` — no new transport.
  3. The streamed reply renders in the palette (`run.text`) and the `run.tts` `audio_url` auto-plays in the selected Norse persona's ElevenLabs voice via a shared `useTtsPlayback` hook extracted from `Chat.tsx` (Chat and palette share one playback path; no duplicate logic). Persona→voice resolution remains Ástríðr-side (`VoiceIdentityResolver`) — no CodePulse voice config.
  4. Voice mode is privacy-honest: always-on listening is OFF by default, requires an explicit operator toggle, shows a persistent "listening" indicator while active, and a missing/invalid `.ppn`/AccessKey degrades gracefully (clear disabled state, no crash, no silent always-on mic).
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
| 80. Command Bridge | v7.0 | 4/4 | Complete | 2026-06-16 |
| 81. Live Log Streaming | v7.0 | 4/4 | Complete | 2026-06-17 |
| 82. Files + Preview + Hardening | v7.0 | 4/4 | Complete | 2026-06-17 |
| 83. Graph Snapshot Receiver | v8.0 | 3/3 | Complete | 2026-06-18 |
| 84. Graphs Hub + Code/Vault Render | v8.0 | 3/3 | Complete | 2026-06-22 |
| 85. Cross-Graph Navigation | v8.0 | 4/4 | Complete | 2026-06-22 |
| 86. KG Full-Text Search + Clustering | v8.0 | 3/3 | Complete | 2026-06-23 |
| 87. Saved Views + Temporal Diff | v8.0 | 4/4 | Complete | 2026-06-23 |
| 88. Analytics Rollup | v9.0 | 4/4 | Complete   | 2026-06-24 |
| 89. Readable Themes & Editorial Skin Toggle | v9.0 | 7/7 | Complete   | 2026-06-24 |
| 90. Agent Room / War Room | v9.0 | 0/? | Not started | — |
| 91. 3D Memory Galaxy | v9.0 | 0/? | Not started | — |
| 92. Voice-Activated Command Palette (Jarvis Mode) | v9.0 | 0/? | Not started | — |

*Last updated: 2026-06-24 — Phase 92 (VOX-01..04) added to v9.0: browser-side voice-activated command palette (Porcupine wake word + Web Speech STT → existing chat.send → persona TTS). Independent of 89/90/91; reuses shipped Phase 2 WebSocket sender + Phase 3 palette. Requires operator-supplied Picovoice Web-target .ppn + porcupine_params.pv in public/ and VITE_PICOVOICE_ACCESS_KEY. Execution order: 88 → 89 → 90 → 91 → 92. Next: `/gsd-discuss-phase 92` (in progress) → `/gsd-plan-phase 92`.*
