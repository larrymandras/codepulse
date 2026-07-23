---
phase: 99-skill-launch-dispatch
plan: 07
subsystem: ui
tags: [react, convex, vitest, tdd, honesty-invariant, forge, astridr-chat]

# Dependency graph
requires:
  - phase: 99-skill-launch-dispatch
    provides: Plans 01-06 (Run target chooser, Chat/Ástríðr auto-send, Forge launch modal wiring, SkillLaunchProvider) plus 99-REVIEW.md's two BLOCKER findings (CR-01, CR-02)
provides:
  - useAstridrChat.sendMessage returning Promise<boolean> (true only on a confirmed server ok-ack)
  - Chat.tsx auto-send gating recordSkillLaunch on that boolean instead of on "the promise resolved"
  - ForgeLaunchModal.onLaunchConfirmed — a new confirmed-enqueue callback fired only after `await launch(...)` resolves
  - SkillLaunchProvider wiring recordSkillLaunch to onLaunchConfirmed instead of the optimistic onLaunched
affects: [gap-closure-verification, any-future-forge-or-chat-launch-path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Success-signal return contract: an async function whose promise always resolves (never rejects) must expose a boolean/enum success signal — callers cannot treat 'resolved' as 'succeeded'."
    - "Optimistic-paint vs. confirmed-mutation split: two distinct callback props (onLaunched = pre-await paint, onLaunchConfirmed = post-await confirmation) so usage-recording only wires the confirmed one."

key-files:
  created: []
  modified:
    - src/hooks/useAstridrChat.ts
    - src/pages/Chat.tsx
    - src/components/forge/ForgeLaunchModal.tsx
    - src/components/skills/SkillLaunchProvider.tsx
    - src/hooks/useAstridrChat.test.ts
    - src/pages/Chat.test.tsx
    - src/components/forge/ForgeLaunchModal.test.tsx
    - src/components/skills/SkillLaunchProvider.test.tsx

key-decisions:
  - "sendMessage's success contract is a plain boolean (not a thrown error) — matches the existing swallow-all-errors-into-a-transcript-bubble UX; no behavior change to what the user sees, only to what gets recorded."
  - "ForgeLaunchModal keeps onLaunched firing first (unchanged optimistic paint) and adds onLaunchConfirmed as a NEW, additive, optional prop — zero impact on ForgePage.tsx's independent (non-recording) use of the same modal."
  - "Folded WR-02 (unhandled recordSkillLaunch rejection stranding router state) into the CR-01 rewrite via try/finally, since the review explicitly recommended folding it in and the touched code was already being rewritten."

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-07-23
---

# Phase 99 Plan 07: Gap Closure — Skill Launch Honesty Invariant Summary

**Fixed two BLOCKER findings from 99-REVIEW.md that let a failed Chat/Ástríðr send or a rejected Forge enqueue still record a skill launch — both closed via TDD RED→GREEN, zero regressions across 2447 tests.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (CR-01, CR-02), each as a RED→GREEN pair
- **Files modified:** 8 (4 source, 4 test)

## Accomplishments

- **CR-01 fixed:** `useAstridrChat.sendMessage` now returns `Promise<boolean>` — `true` only after a confirmed `ack.status === "ok"` reaches the `setStreaming(true)` success path; `false` on the early guard (blank text/streaming/disconnected), a rejected ack, and the network-throw `catch`. `Chat.tsx`'s auto-send effect awaits that result and only calls `recordSkillLaunch` when it's `true`; on `false` it surfaces `toast.error(...)` instead and always clears the router state (folded in the WR-02 fix via try/finally).
- **CR-02 fixed:** `ForgeLaunchModal` gained a new optional `onLaunchConfirmed?: () => void` prop, invoked inside the existing `try` block immediately after `await launch(...)` resolves — before the `catch`. `onLaunched` (the optimistic pre-await paint) is unchanged and still fires first. `SkillLaunchProvider` moved `recordSkillLaunch` off `handleLaunched` (now a no-op stub, since the provider holds no row-paint state of its own) onto a new `handleLaunchConfirmed`, wired as `onLaunchConfirmed` on the modal.
- Both fixes proven via genuine RED→GREEN cycles: 9 new tests written first and confirmed failing against the unfixed code, then made to pass by the fix — no test was retrofitted to match already-passing behavior.
- `convex/forge.ts`'s Clerk fail-closed auth gate (T-99-10) is untouched — confirmed via `git diff` showing zero changes to that file across all three commits in this plan.
- Full project test suite (`npx vitest run`, no path filter): **2447 passed, 0 failed** (211 test files, 17 skipped, 193 todo — pre-existing). `npx tsc --noEmit`: clean, zero errors.

## Task Commits

Each stage was committed atomically:

1. **RED — failing tests for both bugs** — `2f86f49` (test)
   - `src/hooks/useAstridrChat.test.ts`: 4 new tests asserting the true/false return contract (ok-ack / rejected-ack / early-guard / network-throw)
   - `src/pages/Chat.test.tsx`: updated default mock to resolve `true` (matching the new contract) + 1 new test asserting no recording on a resolved-`false` send
   - `src/components/skills/SkillLaunchProvider.test.tsx`: split "Test 3" into an onLaunched-must-not-record assertion + a new "Test 3b" for onLaunchConfirmed-must-record; added an `onLaunchConfirmed` stub button to the mocked modal
   - `src/components/forge/ForgeLaunchModal.test.tsx`: 3 new tests exercising a controllable `mockLaunch` (pending/resolved/rejected) asserting onLaunchConfirmed's timing and failure-exclusivity
   - Confirmed RED: 9/9 new tests failed against the unfixed code (ran the full suite, verified the exact 9 failing test names before touching source)
2. **GREEN — CR-01 fix** — `1cfb715` (fix)
   - `src/hooks/useAstridrChat.ts`: `sendMessage` return type `Promise<boolean>`, explicit `return false`/`return true` at each terminal path
   - `src/pages/Chat.tsx`: auto-send effect rewritten from an unguarded `.then()` chain to an `await`-gated `if (sent) { record } else { toast.error }`, wrapped in `try/finally` so `navigate(...)` always runs
   - Verified: `Chat.test.tsx` + `useAstridrChat.test.ts` (23/23 pass), pre-existing `src/pages/__tests__/Chat.test.tsx` (7/7 pass, unaffected — no `autoSend` router state exercised there), `useAstridrVoice.test.ts` (57/57 pass — its 4 `sendMessage` call sites `await`/`void` the promise without reading the return value, so the additive boolean is a no-op for them)
3. **GREEN — CR-02 fix** — `6d364ed` (fix)
   - `src/components/forge/ForgeLaunchModal.tsx`: new `onLaunchConfirmed?: () => void` prop, invoked post-`await launch(...)` inside the existing `try`
   - `src/components/skills/SkillLaunchProvider.tsx`: `recordSkillLaunch` moved from `handleLaunched` to new `handleLaunchConfirmed`, wired as `onLaunchConfirmed`
   - Verified: `SkillLaunchProvider.test.tsx` + `ForgeLaunchModal.test.tsx` + `ForgePage.test.tsx` (27/27 pass — `ForgePage.tsx`'s independent, non-recording use of the modal is unaffected since the new prop is optional and additive)

**Plan metadata:** (this commit) `docs(99-07): complete gap closure plan`

## Files Created/Modified

- `src/hooks/useAstridrChat.ts` — `sendMessage` now resolves a real success/failure boolean instead of always resolving
- `src/pages/Chat.tsx` — auto-send effect gates `recordSkillLaunch` on that boolean; honest toast on failure; router-state clear moved to `finally`
- `src/components/forge/ForgeLaunchModal.tsx` — new `onLaunchConfirmed` callback fired post-confirmed-enqueue
- `src/components/skills/SkillLaunchProvider.tsx` — `recordSkillLaunch` rewired from the optimistic `onLaunched` to the new `onLaunchConfirmed`
- `src/hooks/useAstridrChat.test.ts`, `src/pages/Chat.test.tsx`, `src/components/forge/ForgeLaunchModal.test.tsx`, `src/components/skills/SkillLaunchProvider.test.tsx` — RED tests for both bugs, now passing GREEN

## Decisions Made

- Kept `sendMessage`'s existing swallow-and-append-error-bubble UX exactly as-is; the only change is the return value it hands back, so no user-visible chat behavior changed beyond the new failure toast in the auto-send path specifically (which previously had no honest failure signal at all).
- Left `ForgePage.tsx`'s existing (non-recording) `ForgeLaunchModal` usage untouched — `onLaunchConfirmed` is optional, so that call site needed zero changes and was verified via its own test suite.
- Did not touch `convex/forge.ts` — the fix is entirely about *which client-side callback fires when*, not the enqueue mutation or its auth gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical, folded per review's own suggestion] Fixed WR-02 (unhandled recordSkillLaunch rejection stranding router state)**
- **Found during:** CR-01 GREEN implementation
- **Issue:** The review's WR-01/WR-02 findings noted the original `.then()` chain had no rejection handler — if `recordSkillLaunch` itself rejected, `navigate(...)` (which clears the consumed `location.state.autoSend`) would never run, leaving stale state that could survive a same-route re-render. The review explicitly suggested folding this into the CR-01 rewrite.
- **Fix:** Wrapped the auto-send body in `try { ... } catch (err) { console.warn(...) } finally { navigate(...) }` so the router-state clear always runs regardless of which step failed.
- **Files modified:** `src/pages/Chat.tsx`
- **Verification:** Existing Chat.test.tsx suite (including the new CR-01 failure test) all pass with this structure.
- **Committed in:** `1cfb715` (part of the CR-01 fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 2, review-recommended fold-in)
**Impact on plan:** Directly in scope of the file already being rewritten for CR-01; no scope creep — WR-02 was flagged in the same review section as CR-01 and the review itself proposed folding the fix in.

## Issues Encountered

None — both RED cycles reproduced the exact failure modes described in 99-REVIEW.md on the first attempt, and both GREEN fixes passed on the first implementation without iteration.

## Explicitly Out of Scope

Per the gap-closure objective, WR-01 (`useAstridrChat.ts:188-191` stale `isStreamingRef` on the `run.text` done branch, aka "CR-03" in this task's framing) was NOT touched — it is a pre-existing issue outside the CR-01/CR-02 blocker scope of this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The D-12 honesty invariant ("a skill launch is recorded exactly once, and only on a genuinely successful send/enqueue") now holds for all three launch paths reviewed in 99-REVIEW.md: Chat auto-send, Ástríðr persona dispatch (same `sendMessage` contract), and Forge agent-run enqueue.
- No blockers for closing out Phase 99. WR-01 remains open as a separately-trackable pre-existing item if a future phase wants to pick it up.

---
*Phase: 99-skill-launch-dispatch*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: src/hooks/useAstridrChat.ts
- FOUND: src/pages/Chat.tsx
- FOUND: src/components/forge/ForgeLaunchModal.tsx
- FOUND: src/components/skills/SkillLaunchProvider.tsx
- FOUND: .planning/phases/99-skill-launch-dispatch/99-07-SUMMARY.md
- FOUND commit: 2f86f49 (test — RED)
- FOUND commit: 1cfb715 (fix — CR-01 GREEN)
- FOUND commit: 6d364ed (fix — CR-02 GREEN)
