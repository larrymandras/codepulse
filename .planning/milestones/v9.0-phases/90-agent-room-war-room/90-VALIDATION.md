---
phase: 90
slug: agent-room-war-room
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-26
---

# Phase 90 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `90-RESEARCH.md` § Validation Architecture (HIGH confidence).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + jsdom |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run <affected test file>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds (full suite) |

**Mock strategy for `livekit-client`:** Add a shared `src/__mocks__/livekit-client.ts` exporting stub `Room`, `RoomEvent`, `Track`, `ConnectionState`, and register it in `src/test/setup.ts` (which already mocks Three.js, Tone.js, React Flow, etc.). Keeps tests fast and avoids WebRTC APIs in jsdom.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` on the affected module's test file.
- **After every plan wave:** Run `npm test` (full suite).
- **Before `/gsd:verify-work`:** Full suite must be green.
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

> Task IDs assigned by the planner; rows below are requirement-anchored from research. `File Exists ❌ W0` = test file created in Wave 0.

| Task | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| identity-known | — | ROOM-01 | — | N/A | unit | `npx vitest run src/components/AgentVoiceCard.test.tsx` | ❌ W0 | ⬜ pending |
| identity-unknown | — | ROOM-01 | — | Never render raw id; deterministic "Agent #xxxx" + avatar | unit | `npx vitest run src/components/AgentVoiceCard.test.tsx` | ❌ W0 | ⬜ pending |
| listing-shape | — | ROOM-02 | — | N/A | unit | `npx vitest run convex/warRoom.test.ts` | ❌ W0 | ⬜ pending |
| listing-hasmore | — | ROOM-02 | — | Bounded read (no unbounded `.collect()`) | unit | `npx vitest run convex/warRoom.test.ts` | ❌ W0 | ⬜ pending |
| voice-join-flow | — | ROOM-03 | T-90-AUTH | Token fetch sends `Authorization: Bearer` | unit | `npx vitest run src/hooks/useWarRoomVoice.test.ts` | ❌ W0 | ⬜ pending |
| voice-join-muted | — | ROOM-03 | T-90-MIC | Mic NOT enabled on connect (join muted) | unit | `npx vitest run src/hooks/useWarRoomVoice.test.ts` | ❌ W0 | ⬜ pending |
| voice-toggle-mute | — | ROOM-03 | T-90-MIC | `toggleMute()` calls `setMicrophoneEnabled` | unit | `npx vitest run src/hooks/useWarRoomVoice.test.ts` | ❌ W0 | ⬜ pending |
| seq-assign | — | ROOM-04 | — | `seq = max(roomId)+1` race-free in mutation | unit | `npx vitest run convex/v6Mutations.test.ts` | ❌ W0 | ⬜ pending |
| seq-unique | — | ROOM-04 | — | Concurrent inserts → unique seq | unit | `npx vitest run convex/v6Mutations.test.ts` | ❌ W0 | ⬜ pending |
| seq-read-order | — | ROOM-04 | — | `getRoomEvents` returns events ascending by seq (by_room_seq read switch) | unit | `npx vitest run convex/warRoom.test.ts` | ❌ W0 | ⬜ pending |
| deeplink-select | — | ROOM-04 | — | `/war-room/:roomId` auto-selects room | unit (RTL) | `npx vitest run src/pages/WarRoom.test.tsx` | ❌ W0 | ⬜ pending |
| deeplink-closed | — | ROOM-04 | — | Closed/invalid → "Room Ended", Join disabled | unit (RTL) | `npx vitest run src/pages/WarRoom.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__mocks__/livekit-client.ts` — shared stub (`Room`, `RoomEvent`, `Track`, `ConnectionState`); register in `src/test/setup.ts`
- [ ] `src/components/AgentVoiceCard.test.tsx` — ROOM-01 known + unknown identity rendering
- [ ] `convex/warRoom.test.ts` — ROOM-02 bounded `{ active, closed, hasMore }` listing
- [ ] `convex/v6Mutations.test.ts` (extend existing or add) — ROOM-04 seq assignment + uniqueness
- [ ] `src/hooks/useWarRoomVoice.test.ts` — ROOM-03 join/muted/toggle behavior
- [ ] `src/pages/WarRoom.test.tsx` — ROOM-04 deep-link select + closed-room state

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real two-way LiveKit audio (operator hears agents; agents hear operator after unmute) | ROOM-03 | WebRTC media path cannot run in jsdom; needs a live LiveKit room + real mic | Start a war room via Ástríðr, open `/war-room/:roomId`, click Join, confirm connection-state reaches `connected`, unmute, confirm two-way audio |
| `POST /api/war-room/{room}/token` returns a valid token + ws URL for an existing room | ROOM-03 / D-02 | Cross-repo astridr-repo endpoint; integration depends on running Ástríðr | `curl` the endpoint with `Authorization: Bearer $VITE_ASTRIDR_API_KEY` against a live room; assert 200 + `{ token, url }` |
| Transcript ordering under genuinely concurrent ingest | ROOM-04 | Convex OCC race behavior is best confirmed against the live deployment | Fire concurrent `/transcript-ingest` posts; confirm rendered order is monotonic by `seq` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
