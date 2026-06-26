---
phase: 90-agent-room-war-room
plan: "04"
subsystem: voice
tags: [livekit, voice, war-room, cross-repo, ROOM-03]
dependency_graph:
  requires: ["90-01", "90-02", "90-03"]
  provides: ["useWarRoomVoice hook (ROOM-03)", "POST /api/war-room/{room}/token", "VoiceControlBar connection-state UI"]
  affects: ["src/hooks/useWarRoomVoice.ts", "src/components/VoiceControlBar.tsx", "C:/Users/mandr/astridr-repo/astridr/api/war_room_routes.py"]
tech_stack:
  added: ["__mocks__/livekit-client.ts (root-level manual mock)"]
  patterns: ["Room-on-mount lifecycle (create once, connect/disconnect on demand)", "vi.fn().mockImplementation constructor tracking", "VITE_* test sentinel in vitest.config.ts env"]
key_files:
  created: ["__mocks__/livekit-client.ts"]
  modified:
    - src/hooks/useWarRoomVoice.ts
    - src/components/VoiceControlBar.tsx
    - src/test/setup.ts
    - src/__mocks__/livekit-client.ts
    - vitest.config.ts
    - C:/Users/mandr/astridr-repo/astridr/api/war_room_routes.py (UNCOMMITTED — see cross-repo section)
decisions:
  - "Room created on mount (useEffect) not inside join() — required so toggleMute() has localParticipant before join is called (ROOM-03 test contract)"
  - "vi.fn().mockImplementation not vi.fn(class) — vi.fn(impl) does not bind this correctly for new-operator calls; mockImplementation does"
  - "Root-level __mocks__/livekit-client.ts required — Vitest npm-package mock lookup is project-root-relative, not src/-relative"
  - "VITE_ASTRIDR_API_KEY=test-api-key added to vitest.config.ts env — authHeaders() only adds Authorization when key is truthy; T-90-AUTH test requires the header"
  - "war_room_routes.py left UNCOMMITTED in astridr-repo — repo has unrelated uncommitted changes; operator commits through astridr workflow"
metrics:
  duration: "~45 minutes"
  completed_date: "2026-06-26"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 7
---

# Phase 90 Plan 04: LiveKit Voice Hook + Token Endpoint Summary

One-liner: LiveKit Room lifecycle hook (join-muted, subscribe audio, clean teardown), Bearer-auth token endpoint in astridr-repo, and VoiceControlBar connection-state + muted-default UI.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | astridr-repo POST /{room_name}/token endpoint | UNCOMMITTED (astridr-repo) | war_room_routes.py |
| 2 | useWarRoomVoice LiveKit lifecycle hook | f818bf9 | useWarRoomVoice.ts, setup.ts, __mocks__/livekit-client.ts, vitest.config.ts |
| 3 | VoiceControlBar connection-state UI + muted-default | 3ec1a9c | VoiceControlBar.tsx |

## Verification

- `npx vitest run src/hooks/useWarRoomVoice.test.ts` — 8/8 GREEN
- `npx tsc --noEmit` — clean
- `python -c "import ast; ast.parse(open('...war_room_routes.py').read())"` — OK
- Full suite: 1453 passed, 2 test files with pre-existing RED gates (Plan 05 / Plan 06)

---

## Cross-repo follow-up (astridr-repo)

**File:** `C:/Users/mandr/astridr-repo/astridr/api/war_room_routes.py`

**Endpoint added:** `POST /api/war-room/{room_name}/token`

**What it does:**
1. Validates `room_name` against `^[A-Za-z0-9-]+$` — returns HTTP 400 for path traversal or special chars (T-90-PATH)
2. Calls `_require_war_room()` for 503 guard (same as sibling routes)
3. Calls `generate_participant_token(room_name, identity)` unchanged (room_join + can_publish + can_subscribe, 3600s TTL)
4. Reads `LIVEKIT_PUBLIC_URL` env (default `ws://localhost:7880` in dev)
5. Logs `api.war_room.token_issued` with room_name + identity; token is never logged (T-90-TOK)
6. Returns `{ "token": "<jwt>", "url": "<ws://...>" }`

**Auth:** Covered by web.py `auth_check` Bearer middleware at `/api/*` — no per-route auth code needed.

**Suggested commit message for astridr-repo:**
```
feat(war-room): POST /{room_name}/token join-token endpoint (ROOM-03)

Mints a room-scoped LiveKit participant token for the CodePulse operator.
- Validates room_name ([A-Za-z0-9-] only) — rejects path traversal (T-90-PATH)
- Uses generate_participant_token unchanged (room_join+can_publish+can_subscribe, 3600s)
- Reads LIVEKIT_PUBLIC_URL env (default ws://localhost:7880)
- Token never logged; only room_name+identity in structured log (T-90-TOK)
- Protected by web.py auth_check Bearer middleware — no per-route auth needed
```

**After committing:** Restart the Ástríðr web server so the new route is live. Live curl verification is in Plan 08.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest __mocks__ directory wrong location**
- **Found during:** Task 2 (all 8 tests failing with `room.disconnect is not a function`)
- **Issue:** Vitest resolves npm-package manual mocks relative to the project root (next to `node_modules`), not inside `src/`. The existing `src/__mocks__/livekit-client.ts` was never picked up by `vi.mock("livekit-client")`.
- **Fix:** Created `__mocks__/livekit-client.ts` at the project root.
- **Files modified:** `__mocks__/livekit-client.ts` (created), `src/__mocks__/livekit-client.ts` (updated to match)
- **Commit:** f818bf9

**2. [Rule 1 - Bug] vi.fn(class) does not bind `this` for new-operator calls**
- **Found during:** Task 2 (same failing run — `disconnect is not a function`)
- **Issue:** `vi.fn(class MockRoom { ... })` and `vi.fn(function MockRoom(this:any){ ... })` do not forward `this` correctly when called with `new`. Instance properties set with `this.x = ...` were lost, producing empty objects.
- **Fix:** Changed to `vi.fn().mockImplementation(function(this:any){ ... })` — this API correctly binds `this` on constructor calls and tracks instances in `mock.instances`.
- **Files modified:** `src/test/setup.ts`, `src/__mocks__/livekit-client.ts`, `__mocks__/livekit-client.ts`
- **Commit:** f818bf9

**3. [Rule 2 - Missing critical test infrastructure] VITE_ASTRIDR_API_KEY test sentinel**
- **Found during:** Task 2 (T-90-AUTH assertions require `Authorization: Bearer` header)
- **Issue:** `authHeaders()` only adds the Authorization header when `ASTRIDR_API_KEY` is truthy. Without a test value, the header is absent and the T-90-AUTH tests fail.
- **Fix:** Added `VITE_ASTRIDR_API_KEY: 'test-api-key'` to `test.env` in `vitest.config.ts`. This is a non-credential sentinel value.
- **Files modified:** `vitest.config.ts`
- **Commit:** f818bf9

**4. [Rule 2 - Security] T-90-PATH mitigation on room_name (war_room_routes.py)**
- **Found during:** Task 1 (plan threat model mandates this; RESEARCH sample omitted it)
- **Issue:** Plan explicitly flags path-traversal as a `mitigate` threat requiring input validation before token mint.
- **Fix:** Added `re.match(r"^[A-Za-z0-9-]+$", room_name)` check with HTTP 400 before calling `generate_participant_token`. Also added `import re` alongside `import os`.
- **Files modified:** `C:/Users/mandr/astridr-repo/astridr/api/war_room_routes.py` (uncommitted)

## Known Stubs

None. The hook implementation is real (fetch + LiveKit connect). Live two-way audio is verified in Plan 08.

## Threat Flags

No new security surface beyond what the plan's threat model covers (T-90-PATH, T-90-AUTH, T-90-SCOPE, T-90-MIC, T-90-TOK — all mitigated).

## Self-Check: PASSED

- `src/hooks/useWarRoomVoice.ts` — FOUND
- `src/components/VoiceControlBar.tsx` — FOUND
- `__mocks__/livekit-client.ts` — FOUND
- Commit f818bf9 — FOUND
- Commit 3ec1a9c — FOUND
