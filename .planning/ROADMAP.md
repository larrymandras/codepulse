# Roadmap: CodePulse Command Center

## Milestones

- ✅ **v4.0 Operational Excellence** — Phases 1-7, 58 (shipped 2026-04-14)
- ✅ **v5.0 Advanced Visualization & Integrations** — Phases 59-70 (shipped 2026-05-25)
- ⏸️ **v6.0 Agentic OS Front-End** — Phases 71-77 (**parked** 2026-06-16; 71/72/73/74/76 shipped, **75 + 77 pending** on Ástríðr Surface-Substrate gates)
- 🔄 **v7.0 Forge Integration** — Phases 78-82 (**active**; 78/79 shipped, 80/81/82 in planning) — Forge→CodePulse Surface-Substrate fold-in

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
<summary>⏸️ v6.0 Agentic OS Front-End (Phases 71-77) — PARKED 2026-06-16 (75 + 77 pending)</summary>

> **Reframed 2026-06-09**, **parked 2026-06-16** in favor of the active v7.0 Forge Integration milestone. Phases 71/72/73/74/76 shipped (light-mode execution); **Phase 75 (Agent Console)** is blocked on Ástríðr M1.P0 + M1.P3 and **Phase 77 (CI & Prod Hardening)** is 2/3 plans complete. Both re-activate once Forge Integration ships and/or the Ástríðr Surface-Substrate gates clear. Requirements (DS/GAL/MCP/KG/CON/HUB/OPS) are retained in REQUIREMENTS.md — nothing dropped.

- [x] Phase 71: Unified Design System — shipped (light)
- [x] Phase 72: Tool / Capability Galaxy — shipped (light)
- [x] Phase 73: MCP Inventory + Health — shipped (light)
- [x] Phase 74: Temporal-KG Explorer — shipped (light)
- [ ] **Phase 75: Agent Console** — ⛔ parked (Ástríðr M1.P0 + M1.P3)
- [x] Phase 76: Unified Graph Hub — shipped (light)
- [ ] **Phase 77: CI & Production Hardening** — ⏸️ parked (2/3 plans; 77-03 deploy checklist + CODEPULSE_ALLOWED_ORIGIN remaining)

See full detail + success criteria in git history (`5c5c85a:.planning/ROADMAP.md`) and `.planning/REQUIREMENTS.md`.

</details>

---

## v7.0 Forge Integration (ACTIVE — activated 2026-06-16)

**Milestone goal:** Make Forge a first-class CodePulse module so all coding-agent work happens in one application — without moving Forge's execution engine off the local machine.

**Core constraint:** Forge's engine must stay LOCAL (spawns local CLIs, manages local processes, reads local workspace files/artifacts, tails local logs — Convex cloud cannot). So this is a **cloud-frontend ↔ local-backend bridge** via the Surface-Substrate pattern: Forge runs as a local daemon emitting state UP via an `/ingest`-style httpAction (same role Ástríðr plays), and CodePulse sends commands DOWN via a Convex command queue the daemon polls. Clerk-gated. **Rejected:** a cloud tab calling `http://localhost` directly (mixed-content blocked).

Phases are sequenced so each ships independently and the riskiest unknown (live-log streaming) is isolated late.

### Phase 78: Forge Emitter + Convex Schema (read-only foundation) — ✅ SHIPPED
**Goal**: A local Forge daemon emits job/workspace state UP to Convex; CodePulse stores and can query it. No UI, commands, or logs yet.
**Requirements**: FI-01 (forge schema), FI-02 (emitter + `/forge-ingest`), FI-03 (read query API)
**Depends on**: Forge Phase 5 (shipped)
**Cross-repo**: paired with Forge's own roadmap Phase 6 "Event Emitter" (emitter half lands in the `forge` repo)
**Artifacts**: `phases/078-forge-emitter-convex-schema/` (CONTEXT + PLAN + SUMMARY)

### Phase 79: Forge UI Tab (read-only render) — ✅ SHIPPED (PR #20)
**Goal**: A `/forge` route + nav entry rendering jobs/status/detail from `useQuery(api.forge.*)`, porting StatusBadge/JobList/JobDetail ~1:1 from `forge/web/src`. View-only.
**Requirements**: FI-04 (forge page + route), FI-05 (component port)
**Depends on**: Phase 78
**Plans**: 3/3 complete (3 waves) — see `phases/79-forge-ui-tab-read-only-render/`

### Phase 80: Command Bridge (launch + stop) — 📋 ACTIVE (next)
**Goal**: A Convex `forgeCommands` queue the daemon long-polls; launch/stop → command → daemon executes → status reflects back. Port NewJobModal. Clerk-gated mutations.
**Requirements**: FI-06 (command queue + daemon poll), FI-07 (launch/stop UI), FI-08 (auth gating)
**Depends on**: Phase 79 (shipped)
**Success Criteria** (what must be TRUE):
  1. An enqueued launch/stop command in `forgeCommands` is delivered to the daemon exactly once via long-poll, and its execution status reflects back into `forgeJobs`
  2. Operator launches a new Forge job (ported NewJobModal) and stops a running job from `/forge`, round-tripping through the queue
  3. Command-issuing mutations are Clerk-gated — no unauthenticated write path to launch/stop
**Plans**: TBD (run `/gsd-discuss-phase 80` → `/gsd-plan-phase 80`)

### Phase 81: Live Log Streaming — 📋 ACTIVE (design locked)
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
**Plans**: TBD (SPEC ready → `/gsd-discuss-phase 81` → `/gsd-plan-phase 81`)

### Phase 82: Files + Artifact Preview + Hardening — 📋 ACTIVE
**Goal**: Port FileBrowser/ArtifactPreview; solve artifact-origin reachability from the cloud UI (daemon tunnel or local-https, NOT direct localhost); end-to-end Clerk gating; polish.
**Requirements**: FI-12 (files/preview), FI-13 (artifact reachability), FI-14 (hardening)
**Depends on**: Phase 81
**Success Criteria** (what must be TRUE):
  1. Operator browses a job's workspace files and previews artifacts in `/forge` (ported FileBrowser / ArtifactPreview)
  2. Artifact/file content is reachable from the cloud UI without mixed-content `http://localhost` (daemon tunnel or local-https path)
  3. End-to-end Clerk gating across the Forge surface; the full launch→run→logs→artifacts path is auth-correct and production-ready
**Plans**: TBD

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
Phase 82 (Files + Preview + Hardening)  artifact reachability + e2e auth + polish
```

**Critical path:** 80 → 81 → 82, strictly sequential (each builds on the prior surface). Phase 81's risk was retired by the locked SPEC.
**Cross-repo:** Forge-side counterparts land in the `forge` repo (emitter ✅ Phase 6; log sink `makeLogSink` finalization in Phase 81; command-poll daemon for Phase 80).

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-7, 58 | v4.0 | 36/36 | Complete | 2026-04-14 |
| 59-70 | v5.0 | 23/23 | Complete | 2026-05-25 |
| 71-74, 76 | v6.0 | shipped (light) | Complete | — |
| 75. Agent Console | v6.0 | 0/TBD | ⛔ Parked (ext. blocked) | — |
| 77. CI & Prod Hardening | v6.0 | 2/3 | ⏸️ Parked | — |
| 78. Forge Emitter + Schema | v7.0 | ✅ | Complete | 2026-06-13 |
| 79. Forge UI Tab (read-only) | v7.0 | 3/3 | Complete (PR #20) | 2026-06-15 |
| 80. Command Bridge | v7.0 | 0/TBD | 📋 Active (next) | — |
| 81. Live Log Streaming | v7.0 | 0/TBD | 📋 Active (SPEC locked) | — |
| 82. Files + Preview + Hardening | v7.0 | 0/TBD | 📋 Active | — |

---

*Last updated: 2026-06-16 — activated v7.0 Forge Integration (Phases 78-82); 78/79 shipped, 80/81/82 brought into the active roadmap; v6.0 parked (75 + 77 pending). 081 design locked to the Convex-reactive log-ingest path per 081-SPEC.*
