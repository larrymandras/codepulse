# Phase 90 — Live Integration Notes (Gap-Closure)

**Dates:** 2026-06-27 .. 2026-06-29
**Context:** All 8 build plans (90-01..90-07) passed `convex-test`/jsdom, but the War Room had **never been run end-to-end against the live Ástríðr + LiveKit + Convex stack.** The "cross-repo gate" flagged at scoping (confirm `POST /api/war-room` ingest + `warRooms` Convex population) was **not actually closed before execution.** Running it live surfaced five layered gaps, all fixed + committed below.

This file is the durable record of the cross-repo wiring that exists in **two repos** (codepulse + astridr-repo) and the operational requirements — none of it lives in a single plan SUMMARY.

## Operational requirement (must be true for War Room to work)

```bash
# In astridr-repo — LiveKit server + the 5 Norse agent workers are behind a compose profile:
docker compose --profile war-room up -d
```
- Brings up `astridr-livekit` (`livekit/livekit-server:v1.11.0 --dev`) + `war-room-{astridr,hervor,freya,gondul,ragnhildr}`.
- astridr LiveKit creds already match `--dev` (`devkey`/`secret`, `ws://livekit:7880`).
- **Rebuilding the workers evicts agents from any already-open room** (agents only join at dispatch/room-creation; a restarted worker does not auto-rejoin). After a worker rebuild, launch a FRESH room.

## The five gaps (each fixed)

| # | Gap | Symptom | Fix | Commit |
|---|-----|---------|-----|--------|
| 1 | LiveKit + workers not started (compose profile) | Launch → HTTP 500 (`ClientConnectorDNSError: livekit:7880`) — "nothing happens" | `docker compose --profile war-room up -d` | infra |
| 2 | Phase-90 Convex fns committed but not deployed | War Room page: "[CONVEX Q(warRoom:listRooms)] Server Error" | `npx convex dev --once` (→ `tidy-whale-981`) | deploy |
| 3 | astridr never POSTed to `/war-room-ingest` | Launched rooms never appear in the list | `create_war_room`/`close_war_room` fire-and-forget `room.created`/`room.updated` to `${CONVEX_URL}/war-room-ingest`; CodePulse `upsertWarRoom` preserves `name`/`createdAt` on update | astridr `97c63643`, codepulse `e09ce37` |
| 4 | Transcripts only written to Supabase | Transcript panel stays empty | Each Norse agent mirrors its committed response to `${CONVEX_URL}/transcript-ingest` → seq-ordered `warRoomEvents`; added `CONVEX_URL`+`ASTRIDR_INGEST_API_KEY` to `x-war-room-env` compose anchor | astridr `26874fac` |
| 5a | Launch dialog wiped form on every parent re-render | Couldn't add agents/topic; Launch never enabled | Reset effect keyed on `[open]` only + stable `EMPTY_IDS` ref + regression test | codepulse `4c3372d` |
| 5b | No way to delete a room | Rooms (incl. test/dead) accumulate, unremovable | `deleteWarRoom` mutation + trash affordance + `closeWarRoom` client; `room.updated` patch-only (`insertIfMissing=false`) so a late close can't resurrect a deleted room | codepulse `1189ff5` |

## Cross-repo data flow (now wired)

```
CodePulse UI (Launch dialog)
   └─ POST {ASTRIDR_API_URL}/api/war-room  (Bearer VITE_ASTRIDR_API_KEY)
        └─ astridr create_war_room: LiveKit room + agent dispatch + token
             ├─ emit room.created ─▶ {CONVEX_URL}/war-room-ingest ─▶ upsertWarRoom ─▶ warRooms  (lists in UI)
             └─ agents join room; on each reply:
                  └─ emit transcript.chunk ─▶ {CONVEX_URL}/transcript-ingest ─▶ insertWarRoomEvent(seq) ─▶ getRoomEvents (transcript panel, ROOM-04 order)
CodePulse Join ─▶ POST {ASTRIDR_API_URL}/api/war-room/{room}/token (Bearer) ─▶ LiveKit join (muted) — astridr commit 4093aec
CodePulse Delete ─▶ closeWarRoom (DELETE /api/war-room/{room}) + deleteWarRoom mutation ─▶ removes warRooms row + events
```

- Keys: CodePulse Convex validates ingest with `ASTRIDR_INGEST_API_KEY`; astridr sends `Bearer ${ASTRIDR_INGEST_API_KEY}` (== `CODEPULSE_INGEST_KEY`). `CONVEX_URL = https://tidy-whale-981.convex.site` (HTTP-actions base).

## Verified this session (automated / API-level)

- `POST /api/war-room` → 200 `{token,url,room}`; create → room appears in `listRooms.active` with topic/participants; close → moves to `closed`, **name/createdAt preserved**.
- `/transcript-ingest` → `getRoomEvents` returns chunks with monotonic seq (0,1,2).
- Fresh room → agents join LiveKit (`agent-…`) + Deepgram STT connects.
- Token route reachable + Bearer-enforced (401 unauth); malformed name → 400.
- Full Vitest suite green; `tsc --noEmit` clean. Test/dead rooms purged via `deleteWarRoom`.

## Still pending (90-08, operator-only — needs mic/ears/browser)

1. Token endpoint with real key (200 + malformed→400) against a live room.
2. Two-way audio: hear agents, muted-by-default join, unmute, room-switch stops prior audio; ≥1 card shows a real roster name.
3. Transcript renders monotonic by seq under real speech.

## Lesson

Close cross-repo **live-integration** gates (not just "does the endpoint exist") **before** executing build plans. Every failure here was integration/infra that passing unit/jsdom tests cannot catch — the build code was sound.
