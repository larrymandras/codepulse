# Phase 90: Agent Room / War Room - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the ~70–75%-built War Room into a usable, bounded, robust multi-persona surface. Four capabilities, mapped to ROOM-01..04:

1. **Real agent identity** (ROOM-01) — replace the hardcoded `name={pid}` / `avatar={null}` / `roleBadge="Agent"` placeholders in `WarRoom.tsx` with live roster data from `useRosterAgents()`.
2. **Bounded, populated listing** (ROOM-02) — replace the unbounded `.collect()` in `warRoom.ts:listRooms`; confirm the `/war-room-ingest` path populates rooms from real Ástríðr events.
3. **Genuine operator Join** (ROOM-03) — a real LiveKit voice join, not the current cosmetic `setIsJoined(true)`.
4. **Transcript robustness** (ROOM-04) — a `/war-room/:roomId` deep-link + deterministic transcript ordering via a `seq` field.

**Not in scope:** new War Room features beyond these four (multi-persona moderator/turn-taking, meeting-bot, mission-control changes). Scope is wiring + hardening the existing surface.
</domain>

<decisions>
## Implementation Decisions

### ROOM-03 — Operator Join (the headline decision)
- **D-01: Full two-way voice join.** The operator joins the live LiveKit room with real audio — publishing mic + subscribing to agent audio — not listen-only and not a symbolic presence signal. This is the real boardroom-participation feature.
- **D-02: Add a token-for-existing-room endpoint to astridr-repo.** Full voice join needs a LiveKit token for a room that already exists (the existing `POST /api/war-room` only mints a token at *creation* time). Add a new route — e.g. `POST /api/war-room/{room}/token` — that wraps the existing `astridr/channels/war_room/token.py::generate_participant_token` (which already grants `room_join + can_publish + can_subscribe`, room-scoped, 3600s TTL, per T-70-08). This is cross-repo work in `astridr-repo` and lets the operator join ANY live room, not just session-created ones.
- **D-03: Join muted by default; explicit unmute.** The operator connects with mic muted; they must click to unmute. No accidental hot mic into a live agent boardroom. Mirrors the Phase 92 "voice OFF by default" safety posture. Reuse the existing `VoiceControlBar` `isMuted` toggle.

### ROOM-01 — Identity resolution
- **D-04: Map `participantId` → `useRosterAgents()` agent** for name, avatar (`avatarData.color` / `avatarData.emoji` / `avatarData.imageStorageId`), color, and role badge (`tier`). Feed these into `AgentVoiceCard` (props `name`/`avatar`/`roleBadge`) and into transcript chunk `agentColor` (currently hardcoded `undefined`).
- **D-05: Unknown participants get a deterministic generated avatar + color from the id.** When a `participantId` doesn't resolve to a roster agent (dynamic one-off agents, or the operator), hash the id → a stable color + initials/emoji. Never render a raw id string; never collapse multiple unknowns to one identical placeholder.

### ROOM-04 — Deep-link & transcript ordering
- **D-06: Closed/invalid deep-links render a read-only "room ended" state.** `/war-room/:roomId` for a closed or non-existent room shows the room with its full transcript, clearly labeled closed/ended, with Join disabled — preserving the transcript's archival value. (Not a redirect, not a 404.)
- **D-07: Add a `seq` field to `warRoomEvents` for deterministic ordering.** The table is currently indexed `["roomId","timestamp"]` with no `seq` (seq exists only on Forge tables today). Add a monotonic `seq` (per room) populated at ingest, and order the transcript by it so concurrent ingest can't render out of order. Merge persisted events + live chunks by `seq`, not array-append order.

### ROOM-02 — Listing scope
- **D-08: Bounded listing = all active rooms + the last N closed (e.g., 20), with "show more" to page further back.** Replace `listRooms`' unbounded `.collect()`. Keep live rooms always visible; make recent history accessible without loading the entire table.

### Claude's Discretion
- Exact `N` for the closed-room window and "show more" page size (start ~20).
- Whether unknown-participant identity uses initials vs emoji for the generated avatar.
- Deep-link auto-scroll/auto-select behavior on load (lean toward auto-select the room and scroll transcript to newest).
- The precise LiveKit client library + connection-state UI states (researcher/planner pick; `livekit-client` is the expected SDK).
- Exact new endpoint path/shape in astridr-repo (suggest `POST /api/war-room/{room}/token`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & requirements
- `.planning/ROADMAP.md` § "Phase 90: Agent Room / War Room" — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` § "Agent Room / War Room (ROOM) — Phase 90" — ROOM-01..04 definitions + traceability.

### CodePulse — War Room surface (to modify)
- `src/pages/WarRoom.tsx` — main surface; hardcoded identity props at lines 190-199, cosmetic Join at lines 36/112-113, transcript merge at lines 92-105 (`agentColor: undefined` at line 63).
- `convex/warRoom.ts` — `listRooms` unbounded `.collect()` (lines 4-11); `getRoomEvents` (lines 13-21).
- `convex/warRoomIngest.ts` — `/war-room-ingest` (room.created/updated, participant.joined/left) + `/transcript-ingest` (transcript.chunk → `warRoomEvents`). Inserts have no `seq` today.
- `convex/schema.ts` — `warRooms` (lines 1279-1288) and `warRoomEvents` (lines 1290-1299, index `by_room: ["roomId","timestamp"]`). `seq` field to be added here.
- `src/hooks/useRosterAgents.ts` — identity source: `{id, name, avatarData:{color,emoji,imageStorageId}, tier, status}`.
- `src/components/AgentVoiceCard.tsx`, `src/components/VoiceControlBar.tsx`, `src/components/TranscriptPanel.tsx`, `src/components/RoomListItem.tsx` — existing presentational components to wire.
- `src/App.tsx` — routes; only `/war-room` exists (line 118), `/war-room/:roomId` to be added.

### Ástríðr (astridr-repo) — cross-repo Join surface
- `astridr/api/war_room_routes.py` — only `POST /api/war-room` (create, returns browser join token) + `DELETE /api/war-room/{room_name}` (close). NO join endpoint — D-02 adds one here.
- `astridr/channels/war_room/token.py::generate_participant_token` — mints room-scoped LiveKit token (`room_join + can_publish + can_subscribe`, TTL 3600); the function D-02's endpoint wraps.
- `astridr/channels/war_room/dispatcher.py::create_war_room` — LiveKit room creation + agent dispatch; "return browser join token" pattern to mirror.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useRosterAgents()` — full identity data already assembled (API agents + Convex fallback + avatars + pending approvals). Direct source for ROOM-01.
- `AgentVoiceCard` / `VoiceControlBar` / `TranscriptPanel` / `RoomListItem` — presentational components already built; this phase feeds them real data + wires Join.
- `useAstridrWS()` — already used in `WarRoom.tsx` for `transcript.chunk` + `room.participant_speaking` subscriptions.
- `token.py::generate_participant_token` — token-minting already exists in astridr-repo; D-02 only adds the HTTP route.
- `authHeaders()` / `VITE_ASTRIDR_API_KEY` — all new astridr-repo calls (the token fetch) must send `Authorization: Bearer` (per CodePulse CLAUDE.md).

### Established Patterns
- Ingest dispatch-by-`type` httpActions with `validateIngestAuth` + CORS (`warRoomIngest.ts`) — the `seq`-populating change follows this shape.
- Convex `withIndex(...).take(limit)` bounded reads (`getRoomEvents`) — the listing bound (D-08) follows this over the current `.collect()`.
- LiveKit is the voice substrate: agents use `livekit.agents` + deepgram (STT) + elevenlabs (TTS) + silero (VAD). The operator joins the same LiveKit room via the JS client.
- The Forge `seq` pattern (`schema.ts:1545`, `by_host_job_seq` index, "monotonic per (host,job) — ordering + dedup") is the precedent for D-07's `warRoomEvents.seq`.

### Integration Points
- `WarRoom.tsx` participant cards ← `useRosterAgents()` (ROOM-01).
- `warRoom.ts:listRooms` ← bounded query (ROOM-02).
- New `livekit-client` connection in CodePulse ← token from new `astridr-repo` endpoint (ROOM-03).
- `App.tsx` route `/war-room/:roomId` + `warRoomEvents.seq` ordering (ROOM-04).

</code_context>

<specifics>
## Specific Ideas

- Full two-way voice was chosen deliberately over the ROADMAP's "observer mode" fallback — Larry wants the real boardroom join, accepting the LiveKit-client lift.
- Safety posture is explicitly inherited from Phase 92 (voice OFF/muted by default).
- Unknown-participant cards must always "look intentional" (generated avatar), never expose raw ids.

</specifics>

<deferred>
## Deferred Ideas

- **Real-time multi-persona moderator / turn-taking** in the War Room — listed under REQUIREMENTS.md "Future Requirements"; its own phase.
- **Listen-only observer mode** as a separate join tier — not needed now that full voice is the choice; could be a future toggle.
- **Push-to-talk** mic interaction — considered and set aside in favor of join-muted + explicit unmute.

None of these block Phase 90.

</deferred>

---

*Phase: 90-agent-room-war-room*
*Context gathered: 2026-06-26*
