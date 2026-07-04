---
phase: 90-agent-room-war-room
plan: 08
type: execute
wave: 6
status: complete
requirements: [ROOM-03, ROOM-04]
completed_date: 2026-06-29
tasks_completed: 1
tasks_total: 1
verification: operator-signed-off
---

# Phase 90 Plan 08: Live-Stack Manual Verification — Summary

One-liner: Operator sign-off (2026-06-29, "approved") on the three live-stack checks that jsdom could not automate — confirming ROOM-03 (real operator Join + token endpoint) and the ROOM-04 ordering guarantee against the live Ástríðr + LiveKit + Convex stack.

## Outcome

**APPROVED by operator** after the full `war-room` Docker profile was brought up (LiveKit + 5 Norse agent workers) and a fresh room was launched, joined, and exercised. All three manual-only verifications passed:

1. **Token endpoint (ROOM-03 / D-02 / T-90-PATH)** — `POST /api/war-room/{room}/token` returns `{token,url}` under Bearer auth; malformed room name → HTTP 400. (astridr endpoint `4093aec`; reachability + Bearer-enforcement also confirmed programmatically — 401 unauth, route present not 404.)
2. **Two-way voice (ROOM-03 / D-03 / T-90-MIC)** — operator joined a live room, heard the agents, joined muted by default, agents responded after unmute, and switching rooms stopped the prior room's audio (no leak). At least one participant card showed a real roster name (not the "Agent #xxxx" fallback) — validates the ROOM-01 `participantId`→roster mapping (Assumption A2).
3. **Transcript ordering (ROOM-04 / D-07 / T-90-ORD)** — transcript chunks rendered monotonic by `seq` with no duplicates as agents spoke. (Server-side seq-assignment also verified directly: `/transcript-ingest` → `getRoomEvents` returned seq 0,1,2 in order.)

## How this was reached (live integration built this session)

The 8 build plans (90-01..90-07) were all GREEN in `convex-test`/jsdom, but the feature had never been run end-to-end against the live stack. Operator testing surfaced — and this session fixed — five layered cross-repo integration/infra gaps (full record: `90-INTEGRATION-NOTES.md`):

1. `war-room` Docker compose profile (LiveKit + agents) was never started → `create_war_room` 500.
2. Phase-90 Convex functions were committed but not deployed → stale `listRooms`.
3. astridr never POSTed to CodePulse's `/war-room-ingest` → built `room.created`/`room.updated` emit (astridr `97c63643`) + CodePulse `upsertWarRoom` preserve-on-update (`e09ce37`).
4. Transcripts only went to Supabase → built `transcript.chunk` emit from each agent (astridr `26874fac`).
5. Two CodePulse bugs found live: launch-dialog form-wipe (`4c3372d`) + no delete-room affordance (`1189ff5`).

## Requirements closed

- **ROOM-03** — real operator Join (token endpoint + muted-default LiveKit join + agent audio) verified live.
- **ROOM-04** — deterministic seq-ordered transcript verified live under real agent speech.

ROOM-01 (real identity) and ROOM-02 (bounded listing) were verified in 90-05/90-06 and confirmed live here (real roster name on a card; bounded `{active,closed,hasMore}` list populated from real ingest).

## Phase 90 status

**COMPLETE** — 8/8 plans. Operational note: the `war-room` Docker profile must be running (`docker compose --profile war-room up -d`); rebuilding the workers evicts agents from open rooms (launch a fresh room).
