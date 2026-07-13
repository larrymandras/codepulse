---
gsd_state_version: 1.0
milestone: v10.0
milestone_name: Eval & Trace Observability + Hardening
status: Awaiting next milestone
stopped_at: Phase 96 UI-SPEC approved
last_updated: "2026-07-13T12:47:47.808Z"
last_activity: 2026-07-07 — Milestone v10.0 completed and archived
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 15
  completed_plans: 15
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** Planning next milestone — v10.0 shipped & archived 2026-07-07. Run `/gsd-new-milestone` to start the next cycle.

## Current Position

Phase: Milestone v10.0 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-07 — Milestone v10.0 completed and archived

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-29 (all non-blocking — see v9.0 audit reconciliation):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | Phase 80 80-HUMAN-UAT.md | passed (0 pending — false positive) |
| uat_gap | Phase 84 84-HUMAN-UAT.md | passed (0 pending — false positive) |
| uat_gap | Phase 85 85-HUMAN-UAT.md | passed (0 pending — false positive) |
| verification_gap | Phase 89 89-VERIFICATION.md | human_needed (operator signed off 2026-06-24; flag unflipped) |
| verification_gap | Phase 92 92-VERIFICATION.md | human_needed (live-verified 2026-06-25; flag unflipped) |
| quick_task | 260603-or6-codepulse-register-opus-4-8-in-cost-mode | missing (stale, unrelated to v9.0) |
| context_questions | Phase 078 078-CONTEXT.md | 3 open Qs (answered during v7.0 execution, unmarked) |
| context_questions | Phase 89 89-CONTEXT.md | 3 open Qs (answered during execution, unmarked) |

**Accepted tech debt:** Phases 88 & 90 have no formal `VERIFICATION.md` — 88 covered by Nyquist VALIDATION (47/47 tests), 90 by operator live sign-off (`90-08-SUMMARY`).

**v10.0 close-out cleanup (2026-07-07) — ALL RESOLVED (`audit-open` now reports 0 open items):**

These were completed work flagged only by naming / status-marker mismatches, not real gaps. All quick-task dirs moved to `.planning/quick-archive/` (out of the audit scan); `95-VALIDATION.md` finalized.

| Category | Item | Resolution |
|----------|------|------------|
| quick_task | 260603-or6-codepulse-register-opus-4-8-in-cost-mode | ✅ DONE 2026-06-03 — registered `claude-opus-4-8` @ $5/$25 in `modelPricing.ts` + fixed a latent 3× Opus over-pricing bug; archived |
| quick_task | 260629-close-crossnav | ✅ DONE (commit b0253b3); archived |
| quick_task | 260629-hive-task-agent-link | ✅ DONE (commit b7b8e84); archived |
| quick_task | 260629-mem-event-deeplink | ✅ DONE (commit 58b999f); archived |
| quick_task | 260629-nnf-graphs-hub-tile-index | ✅ DONE (commit 2d9df13); archived |
| quick_task | 260629-oki-reverse-cross-graph-links | ✅ DONE (commit 6cffbae); archived |
| validation_gap | Phase 95 95-VALIDATION.md | ✅ FINALIZED — `status: complete`, `nyquist_compliant: true`; all gates green, both manual checks operator-verified, cross-referenced by 95-VERIFICATION (16/16) |

The `v10.0-MILESTONE-AUDIT.md` (2026-07-06, `gaps_found`) was a stale **mid-flight snapshot** predating Phases 94/95; superseded by the three phase VERIFICATION.md files (all passed) and the archived REQUIREMENTS (9/9 complete).

## v10.0 Roadmap

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 93 | Eval Pipeline & Quality KPIs | EVAL-01, EVAL-02, EVAL-03 | ✅ Complete (6/6 plans) |
| 94 | Trace Waterfall | TRACE-01, TRACE-02 | ✅ Complete (5/5 plans) |
| 95 | Hardening — Security, Key Rotation, Dependency Majors | HARD-01, HARD-02, HARD-03, HARD-04 | ✅ Complete (4/4 plans) |

**Execution order:** 93 and 94 are independent (separate schemas, both ride existing ingest paths) — either order or parallel. 95 is independent of both and sequenced last as audit/cleanup work.

<details>
<summary>Prior milestone (v9.0) Roadmap — SHIPPED 2026-06-29</summary>

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 88 | Analytics Rollup | AR-01, AR-02, AR-03 | ✅ Complete (4/4 plans) |
| 89 | Readable Themes & Editorial Skin Toggle | TH-01..TH-06 | ✅ Complete (7/7 plans) |
| 90 | Agent Room / War Room | ROOM-01..ROOM-04 | ✅ Complete (8/8 plans; live sign-off 2026-06-29) |
| 91 | 3D Memory Galaxy | G3D-01, G3D-02 | ✅ Complete (5/5 plans; FPS≥30 + WebGL-leak operator sign-off 2026-06-29) |
| 92 | Voice-Activated Command Palette (Jarvis Mode) | VOX-01..VOX-04 | ✅ Complete (6/6 plans) |

**Execution order:** 88 → 89 → 92 → 90 → 91 (all done). All five v9.0 phases complete; milestone shipped & archived.

</details>

## Accumulated Context

### Roadmap Evolution

- Phase 96 added (2026-07-13): UI deep-dive cleanup — IA restructure (dissolve CONSOLE cluster), command palette nav drift, fake header telemetry, hardcoded trust signals, orphaned pages, header/layout consistency. Full audit findings in `.planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/FINDINGS.md`.

### Decisions

See PROJECT.md Key Decisions table for full history.

**v10.0 scoping decisions (2026-07-04):**

- **3-phase roadmap** — EVAL-01..03 clustered into one phase (Phase 93) since they share the `evalScores` table (ingest, judge action, and KPI/regression UI are a single coherent delivery boundary, not three separable slices). TRACE-01/02 form Phase 94 (schema gates UI, same phase since the waterfall is unusable without `traceId`). HARD-01..04 form Phase 95 (independent audit/rotation/dependency-bump work, no shared schema with 93/94).
- **95 sequenced last** — not a hard dependency, but hardening is audit/cleanup work rather than new-feature delivery; HARD-01 (`/cso`) may surface remediation scope once run, so it isn't gating the eval/trace feature work.
- **No new Ástríðr transport** — both EVAL and TRACE ride existing `/runtime-ingest`-family paths; confirmed no emitter-protocol changes needed cross-repo.

**v9.0 scoping decisions (2026-06-23):**

- **Reverse "3D out of scope"** — opt-in mode on `CodeVaultGraph` only (not a new page); `react-force-graph-3d` not R3F (near-identical prop API, manages own WebGLRenderer).
- **Phase 89 sub-sequence** — token cleanup (77 hex sites) → no-flash script → key consolidation → Aubergine tokens → WCAG-AA axe audit. `class="dark"` stays permanent (all v9.0 themes are dark variants).
- **Phase 90 cross-repo gate** — confirm `POST /api/war-room` ingest path and `warRooms` Convex population before writing any ROOM code. If Join isn't feasible, ship observer mode with honest label.
- **Phase 88 quick-unblock** — `.take()` caps deployed `edb614c` are fragile; this phase replaces them with ingest-time rollups in `convex/analyticsRollup.ts` (new file) + wired from `ingest.ts` / `runtimeIngest.ts`.

**Phase 88 Plan 01 decisions (2026-06-24, Wave 0):**

- **Classifier extracted VERBATIM** into shared `convex/lib/sankeyClassify.ts` (sole source of `categoryOf`/`outcomeOf`, read+write paths; `payload` param dropped per OQ-2). The plan's `<behavior>` examples assumed case-INSENSITIVE `outcomeOf` (`"ToolError"→"Error"`); the real code is case-SENSITIVE (`.includes("error")`), so capitalized forms classify as `"Success"`. Kept the classifier byte-identical (T-88-01) and corrected the TEST expectations instead (`tool_error`/`tool_fail`→`"Error"`).
- **Cross-plan RED-scaffold pattern** — not-yet-built Convex modules are loaded behind a non-literal `@vite-ignore` dynamic import + a loose local module type, so dependent tests RED cleanly without breaking Vite transform or `tsc --noEmit`. Used for the Plan-02 (`incrementEventBucket`/dedup) and Plan-04 (aggregates-backed queries) targets.
- **AR-01/02/03 NOT marked complete** — they are phase-level and only complete at Plan 04; Plan 01 is scaffolding + extraction only.

**Phase 88 Plan 02 decisions (2026-06-24, Wave 1):**

- **Rollup WRITE PATH landed atomically.** `events.ingest` now dedups on `by_idempotencyKey` (early return) and, on a fresh insert, increments the `"events"` + two `"sankey_edge"` buckets — all in ONE OCC mutation (D-01/D-04). Un-keyed events always counted (D-05). The 4 write-path RED tests from Plan 01 (idempotency / no-key-counted / patch-or-insert / backfill-count-equality) are now GREEN.
- **`computeHourly` event-count + error-count branches DELETED (D-02)** in the same wave that adds ingest-time increments — Convex per-deploy atomicity means co-locating them is the only way to avoid a double-count transition tick (Pitfall 1 / T-88-04). Cost read replaced unbounded `.collect()` with a paginated cursor loop (`LLM_PAGE_SIZE 500`, D-03/T-88-05, 16 MiB-safe).
- **`incrementBatch` is `internalMutation`, never public** (T-88-03 — a public increment endpoint = unauthenticated tampering). `backfillHistorical` action exists but is NOT run here (run = Plan 03, operator-gated). `idempotencyKey = body/d.idempotencyKey ?? event_id` wired through both httpActions; neither writes `ctx.db` rollups.
- **Ran `npx convex codegen` (offline, NOT a deploy)** to regenerate `_generated/api.d.ts` for the new `analyticsRollup` module; annotated `backfillHistorical`'s runQuery result as `PaginationResult<Doc<"events">>` to break a tsc TS7022 inference cycle (events↔rollup cross-import).
- **2 remaining RED tests** in `analytics.test.ts` are the Plan-04 read-path targets (`activityHeatmapFromAggregates`/`errorRateTrendFromAggregates`), documented RED-pending Plan 04 — NOT regressions from Plan 02.

**Phase 89 Plan 01 decisions (2026-06-24, Wave 0):**

- **`@axe-core/playwright` operator-approved legitimacy gate** — installed at 4.12.1 after operator confirmed npmjs.com listing (Deque Systems `@axe-core` org, dequelabs/axe-core-npm, millions weekly downloads). Required for TH-06 WCAG-AA contrast audit.
- **`resolveThemeColors` exported module-level** (not inside hook) — shared by the lazy `useState` initializer and the MutationObserver callback; avoids creating a new closure on each render.
- **`waitFor()` required for MutationObserver test** — jsdom fires MutationObserver callbacks asynchronously; `act()` alone does not flush them. Added `await waitFor(() => expect(...))` in the re-resolve test.
- **ThemeSwitcher amber option removed; readable + aubergine added** — per PATTERNS.md §ThemeSwitcher changes; trigger width widened to `w-[160px]`.
- **e2e specs seeded RED-pending** — all 3 e2e specs (contrast, no-fouc, reduced-motion) are scaffolded with `RED-pending: <plan>` comments; they correctly fail until Plans 02-04 ship token blocks, inline script, and CSS suppression rules.
- [Phase ?]: AgentCard amber shadow preserved as status identity
- [Phase ?]: CategoryGrid COLOR_HEX map EXEMPT
- [Phase 89]: Canvas legibility, aubergine grain, vault-node violet, and no-flash classified as manual-only (axe cannot audit canvas/perceptual behaviors); T-89-15 repudiation mitigated — operator sign-off received 2026-06-24 — Per 89-VALIDATION §Manual-Only Verifications; five checks approved by operator; no axe exclusions applied across all 20 WCAG-AA contrast cases
- [Phase ?]: seq optionality for backcompat
- [Phase ?]: livekit-client exact pin + audit clean

**Phase 90 Plan 03 decisions (2026-06-26, Wave 3):**

- **idle treated as closed** — `listRooms` queries both `status="closed"` and `status="idle"` via `by_status`, merges and sorts by `createdAt` desc, bounded to `closedLimit` (default 20, cap 200). Critical Note N6 / Open Question 2 resolved.
- **seq NOT a public arg** — `insertWarRoomEvent` computes `seq` server-side via OCC read-max-then-insert (mirrors `forge.ts:634-641`); clients cannot forge ordering (T-90-INJ accepted disposition confirmed).

**Phase 90 Plan 06 decisions (2026-06-26, Wave 4):**

- **Deep-link auto-select race guard** — `useEffect` fires only when `allRooms.length > 0 && !selectedRoomId`; prevents premature setSelectedRoomId before Convex resolves the room list (Pitfall 6). Dep list uses `allRooms.length` not `allRooms` to avoid re-firing on reference changes.
- **agentsRef stable-closure pattern** — `agentsRef.current = agents` kept in sync each render; WebSocket transcript event callback reads `agentsRef.current` instead of capturing `agents` in closure, avoiding resubscription on every 30 s roster poll cycle.
- **Operator identity constant "operator"** — `pid === "operator"` is the isOperatorSelf check, matching the LiveKit join identity set in Plan 04 token request body.
- **Rule 3: useRosterAgents api-namespace guard** — `(api as any).ns?.list` optional chaining prevents TypeError when partial test mocks omit namespaces (approvalQueue, agentConfigVersions, agentProfiles); production unaffected since all namespaces exist there.
- **listRooms normalization in component** — WarRoom.tsx normalizes the `useQuery` result with `Array.isArray` check to support both the real `{active,closed,hasMore}` Convex shape and the flat-array test mock, without modifying test file or Convex layer.

**Phase 90 Plan 07 decisions (2026-06-26, Wave 5):**

- **Real Join replaces cosmetic state** — `WarRoom.tsx` dropped local `isJoined/isMuted` for `useWarRoomVoice()`; room-change effect calls `voice.leave()` (fixes T-90-LEAK audio leak on room switch).
- **Closed-room read-only (D-06)** — `isRoomEnded` (status≠active OR deep-link to non-existent room) renders the "Room Ended" notice + dimmed grid + disabled Join (Surface D); `TranscriptPanel live={false}`.
- **Live-chunk dedup (D-07)** — live transcript chunks filtered against persisted events by (timestamp, speakerId); persisted events carry `seq` for ordering.

**Phase 90 LIVE INTEGRATION GAP-CLOSURE (2026-06-27..29) — the cross-repo gate that was never closed:**

The 8 build plans were all GREEN in `convex-test`/jsdom, but the feature had **never been run end-to-end against the live stack**. The "Phase 90 cross-repo gate" (confirm `POST /api/war-room` ingest + `warRooms` Convex population) was flagged in scoping but **not actually closed before execution**. Running it live surfaced five layered gaps, each now fixed + committed:

1. **LiveKit + agent workers never started** — `livekit` server and the 5 `war-room-*` workers are behind the `war-room` Docker compose profile; a bare `docker compose up` skips them, so `create_war_room` got `ClientConnectorDNSError: livekit:7880` → HTTP 500 ("launch does nothing"). Fix: `docker compose --profile war-room up -d` (livekit + workers healthy; astridr creds already `devkey`/`secret`).
2. **Phase-90 Convex functions never deployed** — `listRooms` etc. were committed but not pushed; the live deployment ran the OLD array-returning `listRooms` → "Server Error" on the page. Fix: `npx convex dev --once` (deploys to `tidy-whale-981`).
3. **astridr never populated CodePulse's `warRooms`** — `/war-room-ingest` existed on CodePulse but **nothing in astridr ever called it**, so launched rooms never appeared in the list. Fix (commit astridr `97c63643`): `create_war_room`/`close_war_room` fire-and-forget `room.created`/`room.updated` to `${CONVEX_URL}/war-room-ingest` (mirrors the existing Supabase pattern). CodePulse `upsertWarRoom` made to preserve `name`/`createdAt` on update (commit `e09ce37`).
4. **Transcripts never streamed** — agents only wrote to Supabase. Fix (astridr `26874fac`): each Norse agent mirrors its committed response to `${CONVEX_URL}/transcript-ingest` → seq-ordered `warRoomEvents` (ROOM-04). Added `CONVEX_URL`+`ASTRIDR_INGEST_API_KEY` to the `x-war-room-env` compose anchor (workers lacked them).
5. **Two CodePulse bugs found while testing** — (a) launch dialog wiped the form on every parent re-render (effect keyed on the unstable `initialParticipantIds=[]` literal; now `[open]`-only + stable `EMPTY_IDS` ref + regression test) — commit `4c3372d`; (b) no way to delete a room — added `deleteWarRoom` mutation + trash affordance + `closeWarRoom` client; `room.updated` is now patch-only (`insertIfMissing=false`) so a late close can't resurrect a deleted room — commit `1189ff5`.

**Also learned:** rebuilding the `war-room-*` workers **evicts agents from any already-open room** (agents only join at dispatch/creation; a restarted worker does not auto-rejoin) — a live room goes silent after a worker rebuild; launch a fresh room. The astridr `POST /api/war-room/{room}/token` endpoint (commit `4093aec`) is live, Bearer-enforced, malformed-name→400.

**Phase 91 Plan 02 decisions (2026-06-29, Wave 1):**

- **ForceGraph3DLib is the sole react-force-graph-3d import site** — `ForceGraph3D.tsx` is the only file allowed to import `react-force-graph-3d`, `three`, or `3d-force-graph`; the `React.lazy` boundary in `CodeVaultGraph.tsx` keeps Three.js out of the main chunk (SC#2). Verified: `grep -rl "react-force-graph-3d" src` returns only this file.
- **cooldownTicks=150** — the library default is `Infinity`; a finite value is required so `onEngineStop` fires and `zoomToFit(400, 60)` runs on simulation settle (Pitfall 3). Value 150 matches ForceGraphCanvas's 120 ticks with a small buffer for 3D physics.
- **centerNode3DWhenReady appended without touching 2D path** — `centerNodeWhenReady` (L30-61) is byte-unchanged; the 3D function mirrors its RAF/cancel/frames/maxFrames structure exactly. `lookAt` passed as explicit node coords to prevent camera aiming at scene origin for off-center nodes (Pitfall 6).
- [Phase ?]: SC#2 PASS: three.js/react-force-graph-3d confined to ForceGraph3D-[hash].js lazy chunk; zero three.js markers in any of the 3 main index chunks
- [Phase ?]: 93-06: persona identity for Quality-page join = operational profile id stamped on session.active_profile, not shared persona_id
- [Phase ?]: 93-06: SELF-01 was never wired into AgentLoop in prod (dead since Phase 73); bootstrap now wires it, enable flag reverted post-verification (config/self-improvement.yaml)
- [Phase ?]: 93-06: Quality trends NOT trusted until E3 >=0.7 human-agreement gate closes (93-CALIBRATION.md, labels pending)
- [Phase ?]: 93-06 user-directed: astridr web chat cookie-session auth; profile-scoped /{p}/api/* auth bypass closed
- [Phase 95]: HARD-03: TS6 migration resolved via single tsconfig types:["node"] fix (Option A), not per-file globalThis casts; the four D-10 folded majors (diff@8, js-yaml@5, jsdom@29, react-easy-crop@6) were already merged to master and verified green under the new bar
- [Phase 95]: HARD-04: react-day-picker resolved by deleting the dead calendar.tsx primitive (zero consumers), not a 9->10 migration

### Pending Todos

- **v10.0 next action:** `/gsd-discuss-phase 94` (Trace Waterfall) — Phase 93 complete 2026-07-06; 94 has no dependency on 93, ready to discuss/plan.
- **Phase 95 note:** HARD-03 (TypeScript 6) and HARD-04 (react-day-picker 10) already have CI-red dependabot branches (PR #50, PR #49) — plan-phase should reuse/rebase those branches rather than starting migrations from scratch.
- **v9.0 (shipped, for reference):** ✅ COMPLETE — all 5 phases done, milestone archived 2026-06-29.
- **Operational note:** the `war-room` Docker profile (livekit + 5 workers) must be running for War Room to work — `docker compose --profile war-room up -d`. Rebuilding workers evicts agents from open rooms.
- **Archive-name collision: ✅ RESOLVED/MOOT (2026-06-29)** — verified the feared stale `milestones/v9.0-*.md`/`v10/v11` adversarial-track archives are NOT present in this repo (milestones/ holds only v4/5/7/8; git never tracked milestones/v9.0-*). The only v9.0 file is CodePulse's own `.planning/v9.0-MILESTONE-AUDIT.md`. No rename needed.

### Blockers/Concerns

- None currently blocking v10.0 — Phase 93/94 have no cross-repo dependency (both ride existing ingest); Phase 95's HARD-01 (`/cso`) may surface remediation scope once run, which would be new information, not a blocker at roadmap time.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260629-nnf | Complete Graphs Hub tile index — Capabilities, 3D Memory Galaxy, Hive/Swarm tiles | 2026-06-29 | 2d9df13 | [260629-nnf-graphs-hub-tile-index](./quick-archive/260629-nnf-graphs-hub-tile-index/) |
| 260629-oki | Reverse cross-graph deep-links (agent→tools, KG entity→owning agent) — GH-04 round-trip | 2026-06-29 | 6cffbae | [260629-oki-reverse-cross-graph-links](./quick-archive/260629-oki-reverse-cross-graph-links/) |
| 260629-ow5 | Memory ?event= deep-link focus — close the KG-provenance cross-nav target | 2026-06-29 | 58b999f | [260629-mem-event-deeplink](./quick-archive/260629-mem-event-deeplink/) |
| 260629-pcy | Hive swarm-task → agent cross-graph deep-link — Hive joins the cross-nav web | 2026-06-29 | b7b8e84 | [260629-hive-task-agent-link](./quick-archive/260629-hive-task-agent-link/) |
| 260629-qaj | Close out cross-nav — back-chip labels (Hive/Memory) + inbound agent→Hive (?goal=) | 2026-06-29 | b0253b3 | [260629-close-crossnav](./quick-archive/260629-close-crossnav/) |

## Session Continuity

Last session: 2026-07-13T12:47:47.798Z
Stopped at: Phase 96 UI-SPEC approved
Next action: `/gsd-discuss-phase 94`
Resume file: .planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-UI-SPEC.md

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
