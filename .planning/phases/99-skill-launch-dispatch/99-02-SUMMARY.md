---
phase: 99-skill-launch-dispatch
plan: 02
subsystem: ui
tags: [react, react-router, convex, tdd, chat]

# Dependency graph
requires:
  - phase: 99-skill-launch-dispatch (plan 01)
    provides: "src/lib/skillRun.ts AutoSendHandoff contract, useAstridrChat.sendMessage profile passthrough"
provides:
  - "Chat.tsx mount-triggered auto-send effect — reads router-state AutoSendHandoff and fires a real chat.send, never a prefilled composer (D-05/D-06)"
  - "recordSkillLaunch({ name }) firing exactly once, only after sendMessage resolves (D-12), shared by the future Chat and Ástríðr targets (Plan 03)"
  - "Honest toast.error when the WS settles disconnected before a handoff ever sends (Pitfall 3)"
affects: [99-03, 99-04, 99-05, 99-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "firedRef one-shot guard for StrictMode-safe mount effects (mirrors AstridrWSContext's guarded-connect precedent)"
    - "Router-state handoff cleared via navigate(location.pathname, { replace: true, state: {} }) after firing, so a manual refresh cannot re-send"

key-files:
  created:
    - src/pages/Chat.test.tsx
  modified:
    - src/pages/Chat.tsx
    - src/pages/__tests__/Chat.test.tsx

key-decisions:
  - "Task 1 implemented the send+toast+guard mechanics without recordSkillLaunch (no test file existed yet); Task 2's RED test then targeted specifically the recordSkillLaunch gap, keeping a genuine RED→GREEN split even though most of the mount-effect behavior was already correct after Task 1."
  - "Mocked useAstridrChat directly (not AstridrWSContext) for the new Chat.test.tsx, per the plan's explicit direction — isolates the mount-effect contract from the real hook's streaming/TTS/approval internals, which are already covered by useAstridrChat.test.ts and the pre-existing __tests__/Chat.test.tsx."
  - "Chat.tsx's own useAstridrWS() call (config.get/swap.get_state hydration, unrelated to the chat engine) still needed its own AstridrWSContext mock in the new test file — both mocks coexist without conflict."

requirements-completed: [LAUNCH-01, LAUNCH-03]

# Metrics
duration: 30min
completed: 2026-07-23
---

# Phase 99 Plan 02: Chat Auto-Send Receiver Summary

**Chat.tsx now fires a real, StrictMode-safe `chat.send` from router-state on mount (never a prefilled composer) and records exactly one `recordSkillLaunch` after the send resolves, with an honest toast when the WS never connects.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-23T17:31:00Z (approx, continuing from Plan 01)
- **Completed:** 2026-07-23T18:01:00Z
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Added a mount-triggered `useEffect` in `Chat.tsx` that reads `location.state?.autoSend` (typed `AutoSendHandoff` from Plan 01's `src/lib/skillRun.ts`) and fires `chat.sendMessage(handoff.text, handoff.profile ? { profile: handoff.profile } : undefined)` when the WS is connected — the composer's `draft`/`setDraft` state is never touched by the handoff (D-05).
- `firedRef` one-shot guard (mirroring `AstridrWSContext`'s guarded-connect pattern) makes the effect StrictMode-safe: mount→cleanup→remount cannot double-send.
- When the WS settles to a terminal `"disconnected"` state before a handoff ever sends, the effect surfaces `toast.error("Couldn't send — Ástríðr isn't connected. Try again.")` instead of silently dropping the launch (Pitfall 3).
- After firing (either branch), router state is cleared via `navigate(location.pathname, { replace: true, state: {} })` so a manual refresh cannot replay the launch.
- `recordSkillLaunch({ name: handoff.skillName })` fires exactly once, only after `sendMessage` resolves — the shared D-12 recording point both the Chat and (Plan 03's) Ástríðr targets will route through.
- New `src/pages/Chat.test.tsx` (5 tests) covers: connected send + record, profile forwarding, no-op with no handoff, StrictMode single-fire, and the honest-disconnect toast path.

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount-triggered auto-send effect in Chat.tsx** - `e3e0d1c` (feat)
2. **Task 2: recordSkillLaunch on confirmed send + Chat.test.tsx** - `483c370` (test, RED) → `ff45358` (feat, GREEN)

_Task 2 is a genuine TDD RED→GREEN pair: the RED commit's test suite had 4/5 tests passing already (Task 1's mechanics were correct) and 1/5 failing (the missing `recordSkillLaunch` call) — confirmed by running the suite before adding the implementation line._

## Files Created/Modified
- `src/pages/Chat.tsx` - Mount-triggered auto-send effect (`firedRef` guard, `location.state?.autoSend`, `sendMessage`, `toast.error`, `recordSkillLaunch`, router-state clear via `navigate`)
- `src/pages/Chat.test.tsx` - New: 5 tests covering the auto-send-on-mount contract
- `src/pages/__tests__/Chat.test.tsx` - Added a `convex/react` `useMutation` no-op mock (Rule 1 fix — see Deviations)

## Decisions Made
- Split Task 1/Task 2 exactly as the plan specified: Task 1 landed the send/toast/guard mechanics (verified by `tsc` only, no test file existed yet); Task 2 added `recordSkillLaunch` and the test suite. This produced a real RED phase for Task 2 focused specifically on the recordSkillLaunch gap, rather than a trivially-green test file.
- Mocked `@/hooks/useAstridrChat` directly (not `@/contexts/AstridrWSContext`) in the new `Chat.test.tsx`, per the plan's explicit `<action>` direction, plus a separate `AstridrWSContext` mock for the page's own `config.get`/`swap.get_state` hydration calls (unrelated to the chat engine, but also called via `useAstridrWS()` inside `Chat.tsx`).
- `recordSkillLaunch` is awaited before clearing router state (not fire-and-forget) so a failed mutation surfaces in the promise chain rather than clearing state on an unconfirmed record — no plan requirement specified this ordering explicitly, but it keeps the "confirmed execution only" guarantee (D-12) intact end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing `__tests__/Chat.test.tsx` broke once Chat.tsx called `useMutation` directly**
- **Found during:** Task 2, GREEN phase verification (ran the broader test suite after wiring `recordSkillLaunch`)
- **Issue:** `Chat.tsx` now calls `useMutation(api.registry.recordSkillLaunch)` unconditionally on every render. The pre-existing `src/pages/__tests__/Chat.test.tsx` (approval-payload regression suite) doesn't wrap `<Chat />` in a `ConvexProvider` and doesn't mock `convex/react`, so 7 of its tests started failing with "Could not find Convex client!"
- **Fix:** Added the same no-op `useMutation` mock `ForgeLaunchModal.test.tsx` already uses (`vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }))`) to `__tests__/Chat.test.tsx`. That suite never exercises the auto-send/router-state path, so a no-op mutation is sufficient.
- **Files modified:** `src/pages/__tests__/Chat.test.tsx`
- **Verification:** `npx vitest run src/pages/__tests__/Chat.test.tsx src/hooks/useAstridrChat.test.ts src/pages/Chat.test.tsx` — 25/25 passed. Broader sweep (`src/pages src/hooks/useAstridrChat.test.ts src/components/forge`) — 226 passed, 0 failed.
- **Committed in:** `ff45358` (part of the Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug caused directly by this plan's own change)
**Impact on plan:** Necessary to avoid a regression in an existing, unrelated test suite. No scope creep — the fix is a one-line mock addition matching an already-established codebase convention.

## Issues Encountered

None beyond the auto-fixed regression above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 (Skills page wiring: chooser popover → `navigate('/chat', { state: { autoSend } })`) can now rely on Chat.tsx as a correctly-behaving receiver: any navigation carrying an `AutoSendHandoff` in router state will produce a real executed send, a single `recordSkillLaunch`, and an honest toast on a settled-disconnected WS.
- `npx tsc --noEmit` clean across the repo.
- No blockers for downstream plans (03-06).

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*

## Self-Check: PASSED

Verified `src/pages/Chat.test.tsx` exists on disk; verified all 3 commits (`e3e0d1c`, `483c370`, `ff45358`) present in `git log --oneline`.
