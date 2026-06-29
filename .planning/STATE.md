---
gsd_state_version: 1.0
milestone: v9.0
milestone_name: Readability & Experience — ACTIVE
status: executing
stopped_at: Phase 90 code complete (7/7 build plans) + cross-repo live integration wired (LiveKit war-room profile, Convex deploy, room + transcript ingest, delete-room feature, dialog/upsert fixes); 90-08 live operator verification pending
last_updated: "2026-06-29T00:00:00.000Z"
last_activity: 2026-06-29
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 25
  completed_plans: 24
  percent: 78
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-23)

**Core value:** Operators can see the complete operational state of Ástríðr — what's running, what's broken, what it costs — in real time, from a single dashboard, and drive its coding agents from it.
**Current focus:** Phase 90 — agent-room-war-room

## Current Position

Phase: 90 (agent-room-war-room) — EXECUTING (build complete; live verification pending)
Plan: 8 of 8 (90-01..90-07 complete + cross-repo integration done; 90-08 manual)
Status: Awaiting operator live sign-off (90-08): launch a fresh room → Join → talk → confirm agents respond + transcript fills in seq order
Last activity: 2026-06-29

Progress: [█████████░] 95% (90-08 live operator verification is the remainder)

## v9.0 Roadmap

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 88 | Analytics Rollup | AR-01, AR-02, AR-03 | ✅ Complete (4/4 plans) |
| 89 | Readable Themes & Editorial Skin Toggle | TH-01..TH-06 | ✅ Complete (7/7 plans) |
| 90 | Agent Room / War Room | ROOM-01..ROOM-04 | 🔄 Build complete (7/7) + cross-repo integration; 90-08 live verify pending |
| 91 | 3D Memory Galaxy | G3D-01, G3D-02 | Not started |
| 92 | Voice-Activated Command Palette (Jarvis Mode) | VOX-01..VOX-04 | ✅ Complete (5/5 plans) |

**Execution order:** 88 → 89 → 92 (done) → 90 → 91. Phase 90 requires cross-repo Ástríðr audit before planning (confirm `POST /api/war-room` ingest path). Phase 91 needs the FPS≥30 benchmark at ~4k nodes before shipping.

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full history.

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

### Pending Todos

- **Phase 90 — 90-08 LIVE VERIFICATION (operator):** with the full `war-room` stack up, launch a FRESH room → Join → speak to an agent → confirm: (1) token endpoint 200 + malformed→400, (2) two-way audio, muted-by-default, real roster names on cards, room-switch stops prior audio, (3) transcript renders monotonic by seq. On pass, write `90-08-SUMMARY.md`, mark Phase 90 complete, bump ROADMAP/STATE.
- **Phase 90 pre-work:** ✅ DONE — `warRooms` ingest path confirmed + BUILT this session (it did not previously exist on the astridr side; see gap-closure above).
- **Operational note:** the `war-room` Docker profile (livekit + 5 workers) must be running for War Room to work — `docker compose --profile war-room up -d`. Rebuilding workers evicts agents from open rooms.
- **Archive-name collision:** Before `/gsd-complete-milestone`, rename `milestones/v9.0-*.md` etc. (stale archives from a different Astridhr track) to `astridhr-adversarial-v9.0-*` so the completion step doesn't clobber them.

### Blockers/Concerns

- **Phase 90 cross-repo dependency (ROOM-03):** ✅ RESOLVED — real operator Join is live (astridr token endpoint + LiveKit profile + room/transcript ingest all built and verified this session). Remaining: operator live sign-off (90-08).
- **Phase 91 FPS at 4,038 nodes:** No controlled benchmark yet. FPS ≥30 is a blocking acceptance criterion — validate against the live `graphSnapshots` snapshot before shipping.

## Session Continuity

Last session: 2026-06-29
Stopped at: Phase 90 build complete (90-01..90-07) + cross-repo live integration wired (LiveKit war-room profile started; Convex deployed; astridr room.created/updated + transcript.chunk ingest built; CodePulse upsert/dialog fixes; delete-room feature). All automated tests green (tsc clean). Test/dead rooms purged.
Next action: Operator runs 90-08 live verification (launch fresh room → Join → talk → confirm agents respond + transcript fills in seq order). On pass, write 90-08-SUMMARY.md and mark Phase 90 complete.
Resume file: .planning/phases/90-agent-room-war-room/90-INTEGRATION-NOTES.md
