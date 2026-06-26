---
phase: 90
plan: "03"
subsystem: convex-war-room
tags: [convex, bounded-listing, seq-ordering, tdd-green, ROOM-02, ROOM-04]
one_liner: "Bounded listRooms {active,closed,hasMore} with idle-as-closed + race-free per-room seq in insertWarRoomEvent"

dependency_graph:
  requires: ["90-01 (by_room_seq index live)", "90-02 (RED tests exist)"]
  provides: ["bounded warRooms listing", "seq-ordered warRoomEvents reads", "server-side seq assignment"]
  affects: ["convex/warRoom.ts", "convex/v6Mutations.ts", "src/pages/WarRoom.tsx"]

tech_stack:
  added: []
  patterns:
    - "Convex OCC read-max-then-insert for monotonic seq (mirrors forge.ts:634-641)"
    - "take(limit+1) overflow sentinel for bounded pagination with hasMore"
    - "Dual-status query merge (closed + idle sorted by createdAt desc)"
    - "In-memory Convex test harness (analyticsRollup.test.ts pattern)"

key_files:
  modified:
    - convex/warRoom.ts
    - convex/v6Mutations.ts
    - convex/warRoom.test.ts
    - convex/v6Mutations.test.ts
    - src/pages/WarRoom.tsx

decisions:
  - "idle treated as closed (N6 / Open Question 2): idle rooms appear in bounded closed section alongside closed rooms"
  - "closedLimit default=20, hard cap=200; hard cap prevents DOS via unbounded arg (T-90-DOS)"
  - "seq NOT an input arg to insertWarRoomEvent — server-computes it, clients cannot forge ordering (T-90-INJ accepted)"
  - "by_room legacy index kept in getRoomEvents switch — only changes index name, backcompat rows sort before seq=0"

metrics:
  duration_minutes: 8
  completed_date: "2026-06-26"
  tasks_completed: 2
  files_changed: 5
---

# Phase 90 Plan 03: Bounded War Room Convex Layer Summary

Bounded `listRooms` returning `{ active, closed, hasMore }` with idle-as-closed semantics; monotonic per-room `seq` assigned server-side in `insertWarRoomEvent`; `getRoomEvents` switched to `by_room_seq` index for deterministic ordering. Turns both RED gate test files GREEN (10/10 tests).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Bounded listRooms + seq-ordered getRoomEvents | 5519f09 | convex/warRoom.ts, convex/warRoom.test.ts |
| 2 | Seq-assigning insertWarRoomEvent + WarRoom.tsx fix | 9f7318d | convex/v6Mutations.ts, convex/v6Mutations.test.ts, src/pages/WarRoom.tsx |

## Verification

- `npx vitest run convex/warRoom.test.ts convex/v6Mutations.test.ts` — **10/10 GREEN**
- `npx tsc --noEmit` — **clean**
- `grep by_room_seq convex/v6Mutations.ts convex/warRoom.ts` — confirmed in both files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WarRoom.tsx flat-array API consumer broke on listRooms signature change**
- **Found during:** Task 2 tsc --noEmit run
- **Issue:** `src/pages/WarRoom.tsx` called `useQuery(api.warRoom.listRooms)` with no args and treated the result as a flat array (`.find()`, `.filter()`). Changing `listRooms` to return `{ active, closed, hasMore }` broke 8 type errors.
- **Fix:** Wired `useQuery(api.warRoom.listRooms, { closedLimit })` with `useState(20)` for closedLimit; replaced `rooms.find/filter` with direct `roomsData.active`, `roomsData.closed`, `roomsData.hasMore`; computed `allRooms = [...active, ...closed]` for `selectedRoom` lookup.
- **Files modified:** src/pages/WarRoom.tsx
- **Commit:** 9f7318d
- **Note:** PATTERNS.md §convex/warRoom.ts already described this exact replacement — planned work, not a surprise.

## Known Stubs

None. Both queries return real Convex data; no placeholder values.

## Threat Surface Scan

No new network endpoints or trust boundaries introduced. All changes are Convex query/mutation internal logic. T-90-DOS, T-90-ORD, T-90-INJ all mitigated as planned.

## Self-Check: PASSED

- [x] convex/warRoom.ts exists and contains `by_room_seq` and `hasMore`
- [x] convex/v6Mutations.ts exists and contains `by_room_seq` seq computation
- [x] Commits 5519f09 and 9f7318d exist in git log
- [x] 10/10 tests GREEN
- [x] tsc --noEmit clean
