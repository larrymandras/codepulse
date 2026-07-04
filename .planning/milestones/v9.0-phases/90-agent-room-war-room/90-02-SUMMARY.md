---
phase: 90-agent-room-war-room
plan: 02
subsystem: testing
tags: [livekit, vitest, red-tests, tdd, war-room, identity, voice, deep-link]

# Dependency graph
requires:
  - phase: 90-01
    provides: "livekit-client install + warRoomEvents.seq schema + by_room_seq index"
provides:
  - "src/__mocks__/livekit-client.ts — canonical jsdom-safe stub for Room/RoomEvent/Track/ConnectionState"
  - "src/test/setup.ts vi.mock('livekit-client') registration — inline factory with full Room class shape"
  - "AgentAvatar.getColor exported — reusable by warRoomIdentity and transcript color logic"
  - "src/lib/warRoomIdentity.ts skeleton — resolveParticipant + resolveAgentColor interfaces (Plan 05 fills)"
  - "src/hooks/useWarRoomVoice.ts skeleton — join/leave/toggleMute + VoiceConnectionState type (Plan 04 fills)"
  - "convex/warRoom.test.ts — 5 RED tests for listRooms shape (ROOM-02) + getRoomEvents seq order (ROOM-04)"
  - "convex/v6Mutations.test.ts — 4 RED tests for insertWarRoomEvent seq assignment (ROOM-04)"
  - "src/components/AgentVoiceCard.test.tsx — 8 RED tests for resolveParticipant identity contract (ROOM-01)"
  - "src/hooks/useWarRoomVoice.test.ts — 6 RED + 2 passing skeleton initial-state tests (ROOM-03)"
  - "src/pages/WarRoom.test.tsx — 5 RED tests for deep-link auto-select + closed-room banner (ROOM-04)"
affects: [90-03, 90-04, 90-05, 90-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-memory Convex test harness: inline ctx.db stub (no _generated/server imports) with index-aware sorting — mirrors Phase 88 RED-scaffold pattern"
    - "vi.mock factory in setup.ts for npm packages: inline factory (not bare vi.mock) to guarantee correct class shape for overloaded return types"
    - "Interface-first skeletons: export full typed interface, stub bodies throw 'not implemented (Plan N)' — imports resolve + tsc clean but tests fail on behavior"
    - "Nyquist compliance: all 5 test requirements gated before any implementation plan runs"

key-files:
  created:
    - src/__mocks__/livekit-client.ts
    - src/lib/warRoomIdentity.ts
    - src/hooks/useWarRoomVoice.ts
    - convex/warRoom.test.ts
    - convex/v6Mutations.test.ts
    - src/components/AgentVoiceCard.test.tsx
    - src/hooks/useWarRoomVoice.test.ts
    - src/pages/WarRoom.test.tsx
  modified:
    - src/test/setup.ts
    - src/components/AgentAvatar.tsx

key-decisions:
  - "Inline vi.mock factory in setup.ts (not bare vi.mock + src/__mocks__) — Vitest 4 auto-resolves manual mocks from rootDir/__mocks__ not src/__mocks__; factory guarantees Room class shape with localParticipant.setMicrophoneEnabled"
  - "In-memory ctx.db harness mirrors handler logic without Convex _generated imports — avoids transform boundary; by_room_seq sorted by seq, by_room sorted by timestamp so RED/GREEN distinction is mechanical"
  - "useWarRoomVoice.test.ts declares vi.mock('livekit-client') in-file (re-declaration) for self-documentation + isolation isolation even though setup.ts already registers it globally"
  - "WarRoom.test.tsx heading matcher changed from regex /Active Room/i to exact string 'Active Room' — regex matched sidebar 'Active Rooms' SectionHeader (false positive)"

patterns-established:
  - "RED gate scaffold: 5 test files installed before any implementation plan; each future plan has a failing gate to turn GREEN"
  - "Skeleton throw pattern: export function foo(...) { throw new Error('foo: not implemented (Plan N)') } — keeps tsc clean while ensuring behavioral RED"

requirements-completed: [ROOM-01, ROOM-02, ROOM-03, ROOM-04]

# Metrics
duration: 35min
completed: 2026-06-26
---

# Phase 90 Plan 02: Agent Room War Room — Wave-0 Test Scaffolding Summary

**Five RED test files, livekit-client jsdom mock, getColor export, and two interface skeletons give every downstream Wave-2+ plan an automated gate before any implementation runs**

## Performance

- **Duration:** ~35 min (split across two sessions due to context boundary)
- **Started:** 2026-06-26T14:42:00-04:00
- **Completed:** 2026-06-26T15:16:13-04:00
- **Tasks:** 3 of 3
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- Shared `livekit-client` mock registered in `src/test/setup.ts` via inline vi.mock factory — all War Room tests now run in jsdom without WebRTC errors
- `AgentAvatar.getColor` exported for deterministic color hashing reuse by identity helper and transcript components
- `warRoomIdentity.ts` + `useWarRoomVoice.ts` skeletons compile clean (`tsc --noEmit` passes); imports resolve so test files can import contracts and fail RED on behavior, not on missing modules
- 28 RED behavioral assertions installed across 5 test files; 1438 existing tests continue to pass (no regressions)

## Task Commits

1. **Task 1: livekit-client mock + getColor export + interface skeletons** - `ecab4ca` (feat)
2. **Task 2: RED tests — convex backend (ROOM-02 + ROOM-04)** - `4cc7efc` (test)
3. **Task 3: RED tests — identity, voice hook, deep-link page (ROOM-01/03/04)** - `da8ad0a` (test)

## Files Created/Modified

- `src/__mocks__/livekit-client.ts` — Canonical jsdom-safe stub: Room class with vi.fn() connect/disconnect/on/emit/setMicrophoneEnabled, ConnectionState/RoomEvent/Track const objects
- `src/test/setup.ts` — Added item 5: vi.mock('livekit-client') with inline factory matching canonical stub
- `src/components/AgentAvatar.tsx` — Single change: `function getColor` → `export function getColor` (behavior unchanged)
- `src/lib/warRoomIdentity.ts` — Skeleton: resolveParticipant + resolveAgentColor typed exports, both throw "not implemented (Plan 05)"
- `src/hooks/useWarRoomVoice.ts` — Skeleton: VoiceConnectionState type, UseWarRoomVoiceReturn interface, join/leave/toggleMute throw "not implemented (Plan 04)"; initial state 'disconnected'/false correct
- `convex/warRoom.test.ts` — 5 RED + 1 GREEN: listRooms shape contract (ROOM-02), getRoomEvents seq order (ROOM-04); in-memory store with index-aware sorting
- `convex/v6Mutations.test.ts` — 4 RED: insertWarRoomEvent seq=0 first, seq=max+1 pattern, unique seqs, per-room scoping (ROOM-04)
- `src/components/AgentVoiceCard.test.tsx` — 8 RED: KNOWN/UNKNOWN identity resolution + AgentVoiceCard smoke renders (ROOM-01)
- `src/hooks/useWarRoomVoice.test.ts` — 2 GREEN (initial state) + 6 RED: Bearer-authed POST token fetch, join-muted, toggleMute, leave (ROOM-03)
- `src/pages/WarRoom.test.tsx` — 5 RED: deep-link auto-select, detail panel heading, Room Ended banner, disabled Join for closed room, non-existent roomId (ROOM-04)

## Decisions Made

- **Inline vi.mock factory over src/__mocks__ bare call:** Vitest 4 auto-resolves manual mocks from `<rootDir>/__mocks__` (project root), not `src/__mocks__`. The canonical `src/__mocks__/livekit-client.ts` serves as documented reference for Plan 04, but the active mock registration is the inline factory in setup.ts to guarantee the correct Room class shape.
- **In-memory ctx.db harness (no _generated imports):** Importing `mutation`/`query` from Convex's generated server module crosses a Vite transform boundary in test context. Mirroring the handler logic inline with an in-memory store avoids the boundary while keeping the RED/GREEN distinction mechanical (by_room sorts by timestamp → wrong order; by_room_seq sorts by seq → correct order).
- **vi.mock re-declaration in useWarRoomVoice.test.ts:** Even though setup.ts registers the mock globally, each test file declares `vi.mock('livekit-client')` for self-documentation and to ensure correct behavior when the file runs in isolation.
- **WarRoom.test.tsx exact heading match:** Changed regex `/Active Room/i` to exact string `"Active Room"` after discovering the regex matched the sidebar's "Active Rooms" SectionHeader — would have been a false positive GREEN, undermining the RED gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed false-positive heading assertion in WarRoom.test.tsx**
- **Found during:** Task 3 (RED test — identity, voice hook, deep-link page)
- **Issue:** `screen.getByRole("heading", { name: /Active Room/i })` matched the sidebar "Active Rooms" SectionHeader (substring match), causing the test to PASS when it should fail RED
- **Fix:** Changed to exact string match `{ name: "Active Room" }` — only matches the detail panel `<h2>` which only renders when a room is auto-selected
- **Files modified:** `src/pages/WarRoom.test.tsx`
- **Committed in:** da8ad0a (Task 3 commit)

**2. [Rule 1 - Bug] Fixed TS7006 in convex/warRoom.test.ts (implicit `any`)**
- **Found during:** Task 3 (pre-commit tsc --noEmit check)
- **Issue:** `.map((e) => e.seq)` — TypeScript inferred `e` as `any` in strict mode; `noImplicitAny` flagged it
- **Fix:** Added `Record<string, unknown>` type annotation: `.map((e: Record<string, unknown>) => e.seq)`
- **Files modified:** `convex/warRoom.test.ts`
- **Committed in:** da8ad0a (Task 3 commit, combined with frontend files)

**3. [Rule 1 - Bug] Fixed TS2345 in src/pages/WarRoom.test.tsx (overloaded mockImplementation)**
- **Found during:** Task 3 (pre-commit tsc --noEmit check)
- **Issue:** `vi.mocked(useQuery).mockImplementation((query: any) => {...})` — TypeScript strict: callback signature `(query: any)` incompatible with useQuery's variadic overload `(...args: [q, args?] | [q, args]) => any`
- **Fix:** Changed to `(query: any, ..._args: any[]) => {...}` to match variadic overload signature
- **Files modified:** `src/pages/WarRoom.test.tsx`
- **Committed in:** da8ad0a (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs found during pre-commit tsc + test review)
**Impact on plan:** All fixes required for correctness (1 false-positive RED → would have given wrong test signal; 2 TypeScript errors → would have broken `tsc --noEmit` gate). No scope creep.

## Issues Encountered

- **Context boundary split:** Session ran out of context mid-Task 3, after files were written but before tsc errors were fixed and the commit was made. Continuation session picked up at the two tsc errors and completed the commit. No data loss — all files survived the context boundary.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plans 03–06 now each have automated RED gates to turn GREEN
- Plan 03 (Convex query updates): `convex/warRoom.test.ts` gates listRooms shape + getRoomEvents seq ordering
- Plan 04 (useWarRoomVoice): `src/hooks/useWarRoomVoice.test.ts` gates Bearer auth, join-muted, toggleMute
- Plan 05 (warRoomIdentity): `src/components/AgentVoiceCard.test.tsx` gates KNOWN/UNKNOWN identity resolution
- Plan 06 (WarRoom deep-link): `src/pages/WarRoom.test.tsx` gates auto-select + closed-room banner
- `tsc --noEmit` clean — no TypeScript debt entering the implementation wave

---
*Phase: 90-agent-room-war-room*
*Completed: 2026-06-26*
