# Phase 90: Agent Room / War Room - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 90-agent-room-war-room
**Areas discussed:** Join depth (ROOM-03), Unknown participant identity (ROOM-01), Deep-link & closed rooms (ROOM-04), Room listing scope (ROOM-02)

---

## Join depth (ROOM-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Listen-only observer | LiveKit subscribe-only — hear agents, no mic, honest "Observer" label (ROADMAP fallback) | |
| Full two-way voice | Operator publishes mic + subscribes — real boardroom participation; biggest lift | ✓ |
| Signal-only presence | POST "observing" signal, no audio — lightest, but symbolic | |

**User's choice:** Full two-way voice
**Notes:** Chosen over the ROADMAP's named "observer mode" fallback. Larry wants the real join, accepting the LiveKit-client + WebRTC lift.

### Join token (ROOM-03 follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Add token endpoint to astridr-repo | New `POST /api/war-room/{room}/token` wrapping existing `token.py` — join ANY live room | ✓ |
| Session-created rooms only | Reuse create-response token; no cross-repo change, but Join disabled for pre-existing rooms | |
| You decide | Defer to planning | |

**User's choice:** Add token endpoint to astridr-repo
**Notes:** Accepts cross-repo work; `token.py::generate_participant_token` already exists, only the route is missing.

### Mic default (ROOM-03 follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Join muted, explicit unmute | Connect muted; click to unmute — safest, matches Phase 92 OFF-by-default | ✓ |
| Join live (unmuted) | Mic publishes immediately — faster, risks hot mic | |
| Push-to-talk | Mic only while holding — most deliberate, heavier to build | |

**User's choice:** Join muted, explicit unmute

---

## Unknown participant identity (ROOM-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Generated avatar + color from id | Deterministic hash → stable color + initials/emoji; always looks intentional | ✓ |
| Generic "Unknown agent" placeholder | Single neutral card; several unknowns look identical | |
| Raw participant id | Show raw id string (current behavior); honest but unpolished | |

**User's choice:** Generated avatar + color from id

---

## Deep-link & closed rooms (ROOM-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only "room ended" state | Render transcript, labeled closed, Join disabled — preserves archival value | ✓ |
| Redirect to room list | Bounce to /war-room with a toast; loses closed-room transcript view | |
| 404 / not-found page | Strictest, least useful for history | |

**User's choice:** Read-only "room ended" state

---

## Room listing scope (ROOM-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Active + recent closed, show-more | All active + last N closed with paging — balances live focus and history | ✓ |
| Active rooms only | Closed reachable only by deep-link; cleanest but hides history | |
| Fixed newest-N cap | Single bounded query of newest N regardless of status | |

**User's choice:** Active + recent closed, show-more

---

## Claude's Discretion

- Exact `N` for the closed-room window + "show more" page size (start ~20).
- Initials vs emoji for generated unknown-participant avatars.
- Deep-link auto-scroll/auto-select on load.
- Specific LiveKit client library + connection-state UI.
- Exact new endpoint path/shape in astridr-repo (suggested `POST /api/war-room/{room}/token`).

## Deferred Ideas

- Real-time multi-persona moderator / turn-taking (Future Requirements — own phase).
- Listen-only observer mode as a separate join tier (not needed now full voice is chosen).
- Push-to-talk mic interaction (set aside in favor of join-muted + explicit unmute).
