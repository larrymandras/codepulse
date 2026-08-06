---
phase: 103-brain-swap-control-surface
plan: 12
subsystem: ui
tags: [react, convex, websocket, brain-swap, sonner, dialog]

# Dependency graph
requires:
  - phase: 103-09
    provides: src/hooks/useResolvedBrain.ts (useGlobalBrainOverride snapshot+subscribe, resolveActiveBrain global-first precedence)
  - phase: 103-11
    provides: BrainPicker.tsx handleActivate keyboard-activation branch, BrainPickerRow event.stopPropagation guards
provides:
  - GlobalSwapModal.tsx reports the real, awaited swap.set ack + swap.state readback as its single result row, never the deferred per-profile gateway.model.set fan-out
  - BrainPicker.tsx decouples GlobalSwapModal's mount lifecycle (globalTarget) from its visibility (globalDialogOpen), so "Revert global swap" fired from the post-Done toast reopens a live instance
  - BrainPickerRow's isCurrent highlight is scope-aware (global override vs per-profile engine)
affects: [103-13]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-command result axis: one dispatched command -> one GlobalOutcome (pending/confirming/confirmed/accepted/error), never a per-row map when there is only one command"
    - "D-14/D-15 ack-vs-readback: an ack transitions to 'confirming', only the useGlobalBrainOverride() swap.state push transitions to 'confirmed'; a bounded setTimeout is the honest fallback when no push arrives"
    - "Mount-vs-visibility decoupling for a revert-capable modal: a mount guard state (only ever replaced, never nulled) plus a separate visibility boolean whose onOpenChange maps directly onto it in both directions"

key-files:
  created: []
  modified:
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx

key-decisions:
  - "Task 1's whole-file grep gates (gateway.model.set == 0, BRAINS_STUB_ACTIVE == 0) forced runRevert's dispatch mechanics to convert to the single-await-command model in the SAME commit as runSwap, even though the plan's Task 2 action text also describes that conversion — the two tasks were split at the actual seam: Task 1 owns both functions' DISPATCH mechanics (single command, real ack/readback reporting) and the copy/render changes; Task 2 owns the MOUNT-LIFECYCLE fix (BrainPicker's globalDialogOpen decoupling + GlobalSwapModal's reset-effect keyed on target.id instead of open) and WR-02."
  - "D-11's confirm-phase copy changed from 'will be overwritten' to 'will be shadowed while this global override is in force' per 103-CONTEXT.md's [AMENDED gap-closure 2026-07-28] entry — pin icons and the computed count are unchanged, only the verb."
  - "GlobalOutcome has 5 states, not the 3 sketched in the plan's must_haves (pending/ok/error): pending, confirming (ack ok, awaiting swap.state), confirmed (readback matched), accepted (bounded-timeout fallback, GLOBAL_SWAP_CONFIRM_TIMEOUT_MS=4000ms), error. The richer shape was necessary to satisfy the plan's own explicit D-14/D-15 requirement that an ack alone never renders a success claim, and that a missing readback resolve to an honest 'accepted, unconfirmed' state rather than hanging."
  - "The informational affected-profiles list in the result phase is retained verbatim (Pin icons, display names) but its label is lastAction-aware ('Profiles now governed by the global override' during a swap vs 'Profiles returning to their own defaults' during a revert) since the two directions describe genuinely different relationships to the same list."
  - "BrainPicker.test.tsx mocks useGlobalBrainOverride directly at the module level rather than driving it through the already-mocked useAstridrWS().sendCommand seam — this was necessary to avoid the WR-02 dependency's mount-time swap.get_state hydration call from consuming the existing WR-01 staleness test's mockSendCommand.mockImplementationOnce() sequencing, which is keyed to call ORDER, not argument shape."
  - "The GlobalSwapModal mock in BrainPicker.test.tsx now always renders (mount) with a data-open attribute for visibility, replacing the old open ? <div>...</div> : null shape — needed so the new mount-lifecycle tests can assert MOUNT and VISIBILITY as two independently observable facts, matching what the real fix actually changed."

requirements-completed: [BSC-04, BSC-03, BSC-01]

# Metrics
duration: ~55min
completed: 2026-07-29
---

# Phase 103 Plan 12: GlobalSwapModal Honest Result Reporting + Revert Survives Done Summary

**GlobalSwapModal now awaits the real swap.set ack and swap.state readback for its single result row instead of discarding it behind a deferred per-profile fan-out, and BrainPicker keeps the modal mounted past "Done" so a Revert click fires into a live instance.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test — no new files)

## Accomplishments

- Closed defect #5 (103-VALIDATION.md / 103-VERIFICATION.md): `GlobalSwapModal` no longer discards the real, live `swap.set` ack via `.catch(() => {})`, and no longer dispatches the deferred astridr-Phase-184.1 `gateway.model.set` axis at all for the global scope — a direct 103-CONTRACT.md §8 compliance fix.
- Closed CR-03 (103-REVIEW.md): "Revert global swap," the toast action offered after every successful swap, now fires into a component instance `BrainPicker` deliberately keeps mounted, reopens the dialog before dispatching, and renders a real, visible result — never a silent WS command into a dead fiber.
- Closed WR-02 (103-REVIEW.md): the picker's row highlight (`isCurrent`) is scope-aware — "All profiles" scope compares against the live global override, "This profile" scope keeps comparing against the per-profile engine.
- D-14/D-15 applied to the global axis for the first time: success is rendered only once the `swap.state` readback confirms the resulting model, with a bounded 4-second fallback to an honest "accepted, unconfirmed" reading if the push never arrives — closing the exact "ack-equals-switched" shortcut that made the modal report failure for swaps that had actually landed live.
- D-11's confirm-modal copy corrected to match its 2026-07-28 amendment: pinned defaults are now described as "shadowed" rather than "overwritten," since removing the deferred fan-out means nothing writes `profileConfigs.modelPreferences` during a global swap at all.

## Task Commits

Each task was committed atomically:

1. **Task 1: Report the real swap.set outcome and stop the §8-violating fan-out (103-12-T1)** — `e95f425b` (fix)
2. **Task 2: Make revert survive "Done" and render its own result (103-12-T2)** — `9f8607e6` (fix)

_Note: Task 1's commit necessarily includes both `runSwap` and `runRevert`'s dispatch-mechanics conversion (single awaited command, no fan-out) because its own acceptance criteria grep the whole file for `gateway.model.set`/`BRAINS_STUB_ACTIVE` at zero occurrences — see Decisions above. Task 2's commit is the mount-lifecycle piece specifically: `BrainPicker`'s `globalDialogOpen` decoupling, `GlobalSwapModal`'s reset-effect keyed on `target.id` instead of `open`, and WR-02._

## Files Created/Modified

- `src/components/brains/GlobalSwapModal.tsx` — Single-command dispatch + D-14/D-15 ack-vs-readback result reporting; mount-surviving revert; D-11-amended confirm copy; no `BRAINS_STUB_ACTIVE` on this surface.
- `src/components/brains/GlobalSwapModal.test.tsx` — Rewritten: §8-compliance assertion (`mockDispatchSwap` never called), ack-vs-readback distinction, error path, bounded-timeout fallback, revert-survives-Done flow with the exact `{ type: "swap.set", target: "brain", restore: true }` frame.
- `src/components/brains/BrainPicker.tsx` — `globalDialogOpen` visibility state decoupled from `globalTarget` mount guard; WR-02 scope-aware `isCurrent`.
- `src/components/brains/BrainPicker.test.tsx` — `useGlobalBrainOverride` mocked directly; `GlobalSwapModal` mock always renders with a `data-open` attribute; new mount-lifecycle and row-highlight test suites.

## Decisions Made

See `key-decisions` in frontmatter above for the full rationale on each. Summary:
- Task split follows the actual code seam (dispatch mechanics vs. mount lifecycle), not a literal Task-1/Task-2 file diff, because Task 1's own acceptance criteria force the whole file clean of the deferred axis.
- `GlobalOutcome` is a 5-state type (pending/confirming/confirmed/accepted/error), richer than the plan's illustrative 3-state sketch, to satisfy the plan's own explicit narrative requirement that an ack never renders success and a missing readback resolves to an honest fallback rather than hanging.
- `BrainPicker.test.tsx` mocks `useGlobalBrainOverride` at the module level to avoid disturbing the existing WR-01 staleness test's call-order-sensitive mock sequencing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — doc-comment/grep-gate collision] Reworded GlobalSwapModal.tsx's top docstring**
- **Found during:** Task 1, immediately after first grep-gate verification pass
- **Issue:** The docstring's own prose explaining the pre-103-12 defect quoted the literal strings `gateway.model.set`, `.catch(() => {})`, and `overwritten` — the same strings the task's own acceptance-criteria greps check for zero occurrences, so the initial grep run reported 1 hit each even though the actual code was already correct. Same recurring failure class as 103-01/103-03/103-07/103-09's prior doc-comment-vs-grep-gate collisions (see STATE.md LESSONS).
- **Fix:** Reworded the three sentences to describe the defect without using the literal grepped substrings (e.g., "per-profile 'set the gateway model' commands," "union-tag-invalid failures," "a swallowed-error dispatch," "the overwrite verb to a shadowing one").
- **Files modified:** `src/components/brains/GlobalSwapModal.tsx`
- **Verification:** Re-ran all 5 acceptance greps — 0/0/2/0/0 as required.
- **Committed in:** `e95f425b` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, doc-comment/grep-gate literal collision)
**Impact on plan:** Cosmetic docstring wording only — no behavior or test change. No scope creep.

## Issues Encountered

None beyond the documented deviation above.

## Mutation Checks (both required, both performed live)

1. **Task 1 (discarded-ack regression):** Temporarily reverted `runSwap`'s awaited dispatch to a fire-and-forget `.catch(() => {})` with a hardcoded `{ status: "ok" }`, re-ran `GlobalSwapModal.test.tsx` — the error-reporting test failed as expected (1 failed / 14 passed), confirming the test suite would catch this exact regression. Restored from a scratchpad backup, re-verified 15/15 passing.
2. **Task 2 (mount-lifecycle regression):** Temporarily reinstated `onOpenChange={(next) => { setGlobalDialogOpen(next); if (!next) setGlobalTarget(null); }}` in `BrainPicker.tsx`, re-ran `BrainPicker.test.tsx` — exactly the 2 new mount-lifecycle tests failed (2 failed / 27 passed), confirming the guard is load-bearing. Restored from a scratchpad backup, re-verified 29/29 passing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `npx tsc --noEmit` clean. Full suite: **2846/2846 passing** (7 new tests over the 2839 baseline: +4 `GlobalSwapModal.test.tsx`, +3 `BrainPicker.test.tsx`), 0 failures. `npm run build` clean.
- Both blocker-severity defects from `103-VERIFICATION.md`/`103-REVIEW.md` closed for the global axis: defect #5 (discarded ack, §8-violating fan-out) and CR-03 (revert fires into an unmounted component). WR-02 closed alongside since it lives in the same file this plan already edits.
- `103-13` (wave 3, operator-attended live re-verification of BSC-05's global dispatch/readback/revert leg) is next and unblocked — this plan is the code-side fix that checkpoint depends on. A green unit suite here is explicitly NOT accepted as proof of the live fix per `103-VERIFICATION.md`; 103-13's live checkpoint is the authoritative evidence.
- `BSC-04`/`BSC-03`/`BSC-01` not re-marked in `REQUIREMENTS.md` this plan — same established gap-closure-cycle pattern as Plans 09/10/11: the overall requirement re-mark happens after the full cycle and 103-13's live re-verification, not per-plan.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

All claimed files exist (`GlobalSwapModal.tsx`, `GlobalSwapModal.test.tsx`, `BrainPicker.tsx`, `BrainPicker.test.tsx`, this SUMMARY.md) and both task commits (`e95f425b`, `9f8607e6`) are present in git history.
