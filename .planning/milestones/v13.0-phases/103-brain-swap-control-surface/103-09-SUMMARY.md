---
phase: 103-brain-swap-control-surface
plan: 09
subsystem: ui
tags: [react, websocket, convex, brain-swap, gap-closure]

# Dependency graph
requires:
  - phase: 103-brain-swap-control-surface (plans 01-08)
    provides: brainsApi adapter seam, useActiveEngine/deriveMixedState, BrainPicker, GlobalSwapModal, BrainHeaderBadge, Chat composer pill, live global swap.set/swap.catalogue/swap.state axis
provides:
  - src/hooks/useResolvedBrain.ts — the one shared "what brain is actually running" resolution order (useGlobalBrainOverride, pure resolveActiveBrain, useResolvedBrain)
  - BrainHeaderBadge and the Chat composer pill both rewired onto that shared resolver, replacing two independently-wrong global-axis reads
  - Global-override precedence corrected to match 103-CONTRACT.md §9 (global wins outright over per-profile/mixed readings, not the other way around)
affects: [103-10, 103-11, 103-12, 103-13, 104]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared resolution-order hook (useResolvedBrain) composing a snapshot-pull + push-subscribe global axis with a pure precedence function, consumed identically by every brain surface"
    - "Snapshot-on-every-connected-transition (not mount-only) as the fix for 'change-event-only' staleness bugs"

key-files:
  created:
    - src/hooks/useResolvedBrain.ts
    - src/hooks/useResolvedBrain.test.tsx
  modified:
    - src/components/brains/BrainHeaderBadge.tsx
    - src/components/brains/BrainHeaderBadge.test.tsx
    - src/pages/Chat.tsx
    - src/pages/Chat.test.tsx

key-decisions:
  - "resolveActiveBrain's mode field type is derived from ActiveEngineMap (NonNullable<ActiveEngineMap[string]>[\"mode\"]) rather than importing ActiveEngine from src/lib/brainsApi.ts, so the module has zero brainsApi dependency and cannot be masked by the D-16 stub flag either way"
  - "Global override now wins outright over BOTH a real per-profile reading and a real Mixed-brains reading (103-CONTRACT.md §9: global is rung 2, ahead of per-profile's rung 4) — this intentionally reverses 103-08's per-profile-always-wins precedence, which WAS the BSC-01 trap this plan closes"
  - "No singleton/shared React state across useGlobalBrainOverride instances — the badge and the composer pill each own an independent hook instance (same shared module/algorithm, not a shared network cache), so a connect event fires one swap.get_state pull per consumer on the page, not one pull for the whole app"
  - "isConfirmedLive pulse stays stub-gated for profile readings only; the global axis pulses live regardless of VITE_BRAINS_STUB, since VITE_BRAINS_STUB gates only the per-profile seam"

requirements-completed: [BSC-01]

# Metrics
duration: 15min
completed: 2026-07-29
---

# Phase 103 Plan 09: Shared Global-Brain Resolution Module Summary

**New `useResolvedBrain` hook closes the exact 2026-07-28 live regression — a global override active before page load now shows correctly on the header badge and Chat composer pill, qualified as global, instead of "No brain reported"/"Auto"**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-29T08:52:00-04:00 (approx, context load)
- **Completed:** 2026-07-29T09:06:00-04:00
- **Tasks:** 3/3
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Created `src/hooks/useResolvedBrain.ts`: `useGlobalBrainOverride()` (sends `swap.get_state` on every `connected` transition, THE FIX, plus a `swap.state` push subscription), the pure `resolveActiveBrain()` (global-first precedence order per 103-CONTRACT.md §9), and `useResolvedBrain(profileId?)` composing both with `useActiveEngine`.
- `BrainHeaderBadge.tsx` no longer holds its own subscribe-only global fallback (`useGlobalEngineFallback` deleted entirely) — every visual (label, dot, "Global" chip, aria-label, confirmed-live pulse, entryScope, session/pinned line) now derives from `resolved.source`.
- `Chat.tsx`'s page-level `swapState` (feeding `BrainControl`) and the `BrainComposerPill` both read through the same shared module — `swap.get_state` now appears in exactly one source file in the whole codebase.
- Corrected the resolution precedence to match the live `router.py` order: a global override now wins outright even when per-profile telemetry or a genuine Mixed-brains disagreement is present — this reverses 103-08's incorrect per-profile-always-wins fallback, which was itself the root of the BSC-01 trap this plan exists to close.

## Task Commits

1. **Task 1: Create the one shared brain-resolution module** - `4ba0510f` (feat)
2. **Task 2: Rewire BrainHeaderBadge onto the shared resolver** - `f2f94426` (feat)
3. **Task 3: Rewire Chat.tsx composer pill + page-level swap state onto the shared resolver** - `8ae6fa66` (feat)

_No separate plan-metadata commit — this SUMMARY + STATE/ROADMAP/REQUIREMENTS updates land in the final commit per this repo's established anti-clobber workaround (STATE.md updated by hand, no `gsd-sdk state.*` write verbs run)._

## Files Created/Modified

- `src/hooks/useResolvedBrain.ts` - the shared global-override snapshot+subscribe hook, pure resolution function, and composed `useResolvedBrain` hook
- `src/hooks/useResolvedBrain.test.tsx` - 12 tests: snapshot-on-connect, reconnect re-pull (mutation-verified), swap.state push, malformed-payload coercion, out-of-provider degrade, the exact live regression, and 5 `resolveActiveBrain` precedence unit cases
- `src/components/brains/BrainHeaderBadge.tsx` - deleted `useGlobalEngineFallback`; consumes `useResolvedBrain()` (no profileId); all visuals derive from `resolved.source`
- `src/components/brains/BrainHeaderBadge.test.tsx` - 2 pre-existing 103-08 tests rewritten for the corrected global-wins precedence; 2 new tests for the live regression and the honest mixed reading with no global override
- `src/pages/Chat.tsx` - page-level `swapState` now `useGlobalBrainOverride()`; `BrainComposerPill` now `useResolvedBrain(profileId)` with a "Global" qualifier/chip and a `resolved.source`-keyed title
- `src/pages/Chat.test.tsx` - updated the WR-07 reconnect re-pull test for the new two-independent-consumer architecture (page-level + composer pill each own a hook instance)

## Decisions Made

See frontmatter `key-decisions`. Most notable: the plan's must-have "global override wins even when per-profile telemetry exists" required correcting two pre-existing tests in `BrainHeaderBadge.test.tsx` whose assertions encoded the OLD (103-08) per-profile-always-wins behavior — those tests now assert the corrected, contract-accurate precedence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `resolveActiveBrain`'s `mode` field type import tripped the plan's own zero-hit `brainsApi` grep gate**
- **Found during:** Task 1, acceptance-criteria verification
- **Issue:** `import type { ActiveEngine } from "../lib/brainsApi"` (needed only for the `mode` field's type) made `grep -c "brainsApi" src/hooks/useResolvedBrain.ts` return 1, violating the plan's explicit anti-stub-masking proof.
- **Fix:** Derived the `mode` type from `ActiveEngineMap` (`NonNullable<ActiveEngineMap[string]>["mode"]`) instead, eliminating the import.
- **Files modified:** src/hooks/useResolvedBrain.ts
- **Verification:** Re-ran the grep (0 hits), `tsc --noEmit` clean, all 12 tests still pass.
- **Committed in:** 4ba0510f (Task 1 commit)

**2. [Rule 1 - Bug] A doc-comment literal in `useResolvedBrain.ts` also tripped the same grep gate**
- **Found during:** Task 1, same verification pass
- **Issue:** A comment explaining the zero-dependency design quoted the literal substring `src/lib/brainsApi.ts`.
- **Fix:** Reworded to paraphrase around the literal string (same failure class as 103-01/103-03/103-07's prior doc-comment-vs-grep-gate deviations documented in STATE.md).
- **Files modified:** src/hooks/useResolvedBrain.ts
- **Verification:** Re-ran the grep (0 hits).
- **Committed in:** 4ba0510f (Task 1 commit)

**3. [Rule 1 - Bug] Two pre-existing `BrainHeaderBadge.test.tsx` tests encoded the OLD (103-08) precedence and failed against the corrected implementation**
- **Found during:** Task 2, test run
- **Issue:** "keeps showing the per-profile reading and never uses the global fallback when per-profile data is present" and "never lets the global fallback replace a real Mixed-brains reading" both asserted that a live `swap.state` push must NOT override an existing per-profile/mixed reading — exactly the behavior 103-CONTRACT.md §9 (and this plan's own must-haves) require to be reversed.
- **Fix:** Rewrote both tests to assert the corrected precedence (global wins outright), with updated names explaining the intentional behavior change.
- **Files modified:** src/components/brains/BrainHeaderBadge.test.tsx
- **Verification:** All 25 tests in the file pass; `tsc --noEmit` clean.
- **Committed in:** f2f94426 (Task 2 commit)

**4. [Rule 1 - Bug] A pre-existing `Chat.test.tsx` WR-07 reconnect test hard-coded "exactly 1 swap.get_state pull"**
- **Found during:** Task 3, test run
- **Issue:** Before this plan, exactly one component (the page-level inline `swapState`) called `swap.get_state`. After rewiring both the page-level state AND `BrainComposerPill` onto independent `useGlobalBrainOverride`/`useResolvedBrain` instances, a single connect event now fires one pull per consumer (2 on this page), not one pull for the whole page — an intentional, architecturally-expected consequence of the plan's per-instance (not singleton) hook design.
- **Fix:** Updated the test to assert the invariant that actually matters (no pull while disconnected, a fresh full round of pulls on every reconnect) as a stable multiple of the initial pull count, rather than a hard-coded "1".
- **Files modified:** src/pages/Chat.test.tsx
- **Verification:** All 35 tests in Chat.test.tsx + ControlCenterPanel.test.tsx pass; full suite 2827/2827.
- **Committed in:** 8ae6fa66 (Task 3 commit)

**5. [Rule 1 - Bug] A `useResolvedBrain.test.tsx` doc comment collided with the plan's own overall-verification grep**
- **Found during:** Post-Task-3, running the plan's `<verification>` block command (`grep -rn 'subscribeEvent("swap.state"' src/ | grep -v useResolvedBrain.ts`)
- **Issue:** The test file's own header comment quoted the literal `subscribeEvent("swap.state", ...)` string, and since `useResolvedBrain.test.tsx` does not match the `-v useResolvedBrain.ts` exclusion pattern (the `.test` suffix breaks the substring match), it showed up as a false-positive extra "subscription owner."
- **Fix:** Reworded the comment to avoid the literal pattern while keeping the same meaning.
- **Files modified:** src/hooks/useResolvedBrain.test.tsx
- **Verification:** Re-ran the exact plan verification grep — zero rows outside the shared module.
- **Committed in:** 8ae6fa66 (Task 3 commit)

---

**Total deviations:** 5 auto-fixed (2 grep-gate/doc-comment collisions, 1 corrected-precedence test rewrite, 1 architecturally-expected test update, 1 verification-grep doc-comment collision)
**Impact on plan:** All auto-fixes were necessary to satisfy the plan's own literal acceptance criteria or to keep the test suite honestly reflecting the corrected, contract-accurate behavior. No scope creep — no files outside the plan's declared `files_modified` list were touched.

## Issues Encountered

None beyond the deviations documented above.

## Mutation-Test Proof (acceptance criterion)

Per Task 1's acceptance criteria, the reconnect-rehydration guard was mutation-tested: narrowing `useGlobalBrainOverride`'s snapshot effect dependency array from `[status, sendCommand]` to `[]` (mount-only) was applied locally, confirmed the "issues a SECOND swap.get_state after a connected -> disconnected -> connected transition" test fails (`expected "vi.fn()" to be called 2 times, but got 1 times`), then the mutation was reverted and all 12 tests re-confirmed green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BSC-01's badge/pill blindness (defects 6a/6b) is closed. `BrainControl` (Control Center) already read correctly before this plan and continues to via the unchanged `swapModelOverride`/`swapVoiceOverride` prop wiring — all three surfaces now read one shared value.
- Live-stack re-verification of this fix (per `103-VERIFICATION.md`'s "a green suite alone is explicitly NOT accepted as proof for this gap") is Group E's job in `103-13`, not this plan.
- `103-10` (recordRouting → internalMutation), `103-11` (CommandItem.onSelect), and `103-12` (GlobalSwapModal axis/lifecycle fix) are unaffected by this plan's file scope (no overlap) and remain independently executable.
- `REQUIREMENTS.md` untouched this plan — BSC-01 was already marked satisfied in Plan 07 based on a claim that `103-VERIFICATION.md` subsequently found false; this plan is the actual fix for that gap but does not itself flip any requirement checkbox (that's this gap-closure cycle's overall job, not a single plan's).

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: `.planning/phases/103-brain-swap-control-surface/103-09-SUMMARY.md`
- FOUND: `src/hooks/useResolvedBrain.ts`
- FOUND: `src/hooks/useResolvedBrain.test.tsx`
- FOUND commit: `4ba0510f`
- FOUND commit: `f2f94426`
- FOUND commit: `8ae6fa66`
