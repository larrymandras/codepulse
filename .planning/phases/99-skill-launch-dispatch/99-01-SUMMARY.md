---
phase: 99-skill-launch-dispatch
plan: 01
subsystem: ui
tags: [typescript, react, convex, tdd, contracts]

# Dependency graph
requires: []
provides:
  - "src/lib/skillRun.ts — RunTarget/AutoSendHandoff types + last-pick localStorage helpers (codepulse-skills-run-target)"
  - "src/lib/profiles.ts — hoisted PROFILES/ProfileId single source (D-08)"
  - "useAstridrChat.sendMessage optional profile passthrough onto chat.send (D-14a)"
  - "ForgeLaunchModal initialPrompt prop prefilling the prompt textarea (D-11)"
affects: [99-02, 99-03, 99-04, 99-05, 99-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared contract module (src/lib/*.ts) defined once, imported verbatim by all downstream consumers — no per-surface reinvention"
    - "Optional-spread passthrough on WS command objects (`...(opts?.x ? { x: opts.x } : {})`) to keep undefined keys off the wire"

key-files:
  created:
    - src/lib/skillRun.ts
    - src/lib/profiles.ts
  modified:
    - src/pages/Reminders.tsx
    - src/hooks/useAstridrChat.ts
    - src/hooks/useAstridrChat.test.ts
    - src/components/forge/ForgeLaunchModal.tsx
    - src/components/forge/ForgeLaunchModal.test.tsx

key-decisions:
  - "PROFILES/ProfileId moved byte-identical from Reminders.tsx into src/lib/profiles.ts; Reminders.tsx re-exports both so QuickAdd.tsx's existing `from \"@/pages/Reminders\"` import keeps resolving with zero drift risk (D-08)."
  - "AutoSendHandoff.profile is typed ProfileId (imported from ./profiles) rather than a bare string, so downstream Ástríðr-target callers get compile-time narrowing."
  - "useAstridrChat's new opts.profile stays a plain `string` (not ProfileId) — the hook itself sends nothing scope-specific this plan; Plan 03's caller is responsible for constraining it to the ProfileId union before send, per the plan's own threat-model note (T-99-01)."

requirements-completed: [LAUNCH-01, LAUNCH-02, LAUNCH-03]

# Metrics
duration: 25min
completed: 2026-07-23
---

# Phase 99 Plan 01: Shared Launch Contracts Summary

**Established the RunTarget/AutoSendHandoff/ProfileId contracts and two additive interface changes (`useAstridrChat.sendMessage` profile passthrough, `ForgeLaunchModal.initialPrompt`) that Waves 2-5 build against — zero user-visible behavior changed.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-23T17:31:00Z
- **Completed:** 2026-07-23T17:34:30Z
- **Tasks:** 3 completed
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Created `src/lib/skillRun.ts` (RunTarget, AutoSendHandoff, `RUN_TARGET_STORAGE_KEY`, `isValidRunTarget`/`loadStoredRunTarget`/`storeRunTarget`) — the exact interface specified in the plan's `<interfaces>` block.
- Created `src/lib/profiles.ts` (PROFILES/ProfileId), hoisted byte-identical from `Reminders.tsx`; `Reminders.tsx` now imports + re-exports so existing importers (`QuickAdd.tsx`) are unaffected (D-08).
- `useAstridrChat.sendMessage` forwards an optional `profile` onto the `chat.send` `sendCommand` call via the same optional-spread style as the adjacent `swapHandled` field (D-07/D-14a) — TDD RED→GREEN, 2 new tests.
- `ForgeLaunchModal` accepts `initialPrompt?: string`; the reset-on-open effect now calls `setPrompt(initialPrompt ?? "")` with `initialPrompt` added to its dependency array (D-11) — TDD RED→GREEN, 3 new tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared contracts — skillRun.ts + profiles.ts, rehome PROFILES** - `511e5f5` (feat)
2. **Task 2: Add profile passthrough to useAstridrChat.sendMessage** - `3bcb4e0` (test, RED) → `cceddbb` (feat, GREEN)
3. **Task 3: Add initialPrompt prop to ForgeLaunchModal** - `f4a1a72` (test, RED) → `a9c1b5d` (feat, GREEN)

_TDD tasks (2, 3) each have a separate RED test commit and GREEN implementation commit, per plan._

## Files Created/Modified
- `src/lib/skillRun.ts` - RunTarget/AutoSendHandoff types + last-pick localStorage helpers
- `src/lib/profiles.ts` - Hoisted PROFILES/ProfileId single source
- `src/pages/Reminders.tsx` - Imports + re-exports PROFILES/ProfileId from the new lib module
- `src/hooks/useAstridrChat.ts` - `sendMessage` opts gains `profile?: string`, spread onto `chat.send`
- `src/hooks/useAstridrChat.test.ts` - 2 new tests for the profile passthrough (D-14a)
- `src/components/forge/ForgeLaunchModal.tsx` - `initialPrompt?: string` prop, reset effect prefills from it
- `src/components/forge/ForgeLaunchModal.test.tsx` - 3 new tests for `initialPrompt` (D-11)

## Decisions Made
- `AutoSendHandoff.profile` is typed `ProfileId` (compile-time narrowed) while `useAstridrChat`'s own `opts.profile` stays a plain `string` — the hook is a thin passthrough; narrowing to the union is the caller's job (Plan 03), matching the plan's threat-model disposition (T-99-01: "Callers constrain it to the ProfileId union before send — this plan only adds the passthrough, sends nothing itself").
- Reminders.tsx keeps a re-export (`export { PROFILES }; export type { ProfileId };`) rather than requiring `QuickAdd.tsx` to be updated in this plan — avoids an unplanned edit to a file outside this plan's `files_modified` list while still satisfying D-08's "single source" requirement.

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their `<read_first>` guidance, `<action>` specs, and `<acceptance_criteria>` were followed verbatim; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three shared contracts (`skillRun.ts`, `profiles.ts`, `sendMessage.profile`, `ForgeLaunchModal.initialPrompt`) exist exactly as specified and are ready for Waves 2-5 (Plans 02-06) to import verbatim.
- `npx tsc --noEmit` clean across the repo; `npx vitest run src/lib src/hooks/useAstridrChat.test.ts src/components/forge/ForgeLaunchModal.test.tsx src/pages/Reminders.test.tsx` — 26/27 test files passed (1 skipped, pre-existing/unrelated), 342 passed + 14 todo, zero regressions.
- No blockers for downstream plans.

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*
