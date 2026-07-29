---
phase: 103-brain-swap-control-surface
plan: 14
subsystem: ui
tags: [react, websocket, global-swap, honesty-surface, gap-closure]

# Dependency graph
requires:
  - phase: 103-09
    provides: useGlobalBrainOverride() shared global-override resolution (swap.get_state snapshot + swap.state push)
  - phase: 103-11
    provides: keyboard-operable BrainPicker activation path that opens GlobalSwapModal
  - phase: 103-12
    provides: GlobalSwapModal's honest 5-state GlobalOutcome (pending/confirming/confirmed/accepted/error) and revert-survives-Done mount lifecycle (CR-03)
provides:
  - "Revert global swap" restores the global override that was in force immediately before the swap being reverted, instead of unconditionally clearing it
  - describeOutcome() distinguishes restore-to-prior copy from clear-copy across all four in-flight outcome states, naming the restored engine
  - Regression test coverage (5 new tests) for the restore branch, dispatch-time capture robustness, D-14 readback gating, and the unchanged no-prior-override clear path
affects: [103-13, brain-swap-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture-before-dispatch ref pairing (priorOverrideRef + priorOverrideDisplayNameRef) to avoid reading a live value that has already moved on by the time an async follow-up action fires"

key-files:
  created: []
  modified:
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx

key-decisions:
  - "Both tasks committed as a single atomic commit — the plan's own T1/T2 boundary (dispatch mechanics vs. result-surface copy) doesn't split cleanly in this file: revertRestoredName threads through runRevert (T1's function) and describeOutcome (T2's function) as one state variable, and T1's D-14 readback-gate acceptance criterion is only observable through T2's restore-aware copy. Same 'task split follows the actual code seam, not a literal per-task file diff' precedent already established in 103-12's decision log."
  - "Prior-override display name resolved from the pre-swap snapshot (any profile entry whose model matches the captured override) rather than a full catalogue lookup — GlobalSwapModal has no catalogue prop, and every profile mirrors the global override's model while one is in force (global override wins outright per 103-CONTRACT.md §9), so the snapshot already carries a catalogue-resolved name for it. Falls back to the raw model id, never an invented label."
  - "Extended the fix beyond describeOutcome to the result-phase 'Profiles ...' label and handleDismiss's summary toast (both said 'back to their own defaults'/'cleared' unconditionally) — same dishonesty class the plan's own objective calls out ('a surface asserting more than happened'), directly adjacent to describeOutcome, low-risk, and verified byte-unchanged for the no-prior-override case."
  - "Split the plan's illustrative T2 confirmed/timeout test into two separate tests instead of one continuous flow — the D-14 readback-gate useEffect only listens while outcome.status === 'confirming'; once the bounded timeout has already fallen back to 'accepted' it does not retroactively resolve to 'confirmed' on a later readback (existing, unchanged behavior). A single flow asserting both the timeout fallback AND a subsequent readback-confirms would have failed for a reason unrelated to this plan's fix."

requirements-completed: [BSC-04, BSC-05]

# Metrics
duration: 24min
completed: 2026-07-29
---

# Phase 103 Plan 14: Global-Swap Revert Restores Prior Override Summary

**`GlobalSwapModal.runRevert` now dispatches `swap.set` with `value: <prior>, restore: false` when a global override was in force before the swap being reverted, restoring to that exact engine instead of unconditionally clearing it — closing the OBS 7 gap found by the 2026-07-29 live checkpoint (103-13-T1).**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-29T16:15:00Z
- **Completed:** 2026-07-29T16:39:30Z
- **Tasks:** 2 (committed atomically — see Decisions Made)
- **Files modified:** 2

## Accomplishments
- `runSwap` captures `modelOverride` (and a catalogue-resolved display name for it) into refs immediately before dispatching, so `runRevert` always restores to the engine that preceded THAT specific swap — never a live-read value that has since moved on.
- `runRevert` branches: a non-null captured prior dispatches `swap.set` with `value: prior, restore: false` (a real restore, exactly mirroring a fresh swap to that engine); a null prior preserves the original `restore: true` clear behavior byte-for-byte.
- `describeOutcome` gained a `restoredTo` parameter so every in-flight and terminal state (pending/confirming/confirmed/accepted) names the engine actually being restored to instead of unconditionally claiming "Global override cleared." The clear-path copy is unchanged — proven by all 15 pre-existing tests passing without modification.
- The result-phase "Profiles ..." label and the post-Done summary toast are also restore-aware, closing the same "surface claims more than happened" gap at its other two call sites.
- D-14's readback gate is untouched in mechanism (`modelOverride === confirmTarget`) and unchanged in strength — `confirmTarget` is simply now the prior model id instead of always `null` for the restore branch.

## Task Commits

Both tasks were committed as a single atomic commit (see Decisions Made for why the T1/T2 boundary doesn't split cleanly here — `revertRestoredName` threads through both `runRevert`'s dispatch mechanics and `describeOutcome`'s copy selection as one state variable):

1. **Task 1 (dispatch mechanics) + Task 2 (result-surface copy)** — `30322807` (fix)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `src/components/brains/GlobalSwapModal.tsx` — `priorOverrideRef`/`priorOverrideDisplayNameRef` capture at dispatch time; `runRevert` branches restore-vs-clear; `describeOutcome` takes `restoredTo`; result label and dismiss toast are restore-aware.
- `src/components/brains/GlobalSwapModal.test.tsx` — 5 new tests: restore-branch dispatch shape, dispatch-time-capture survives a later live `modelOverride` change, D-14 readback gate with restore-target copy (split into a confirming→confirmed flow and a separate bounded-timeout-fallback flow — see Decisions Made), and an explicit no-prior-override clear-path regression guard.

## Decisions Made
See frontmatter `key-decisions` for the four substantive calls made during this plan (commit-atomicity rationale, display-name resolution source, copy-fix scope extension, and the timeout/readback test split).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Extended the honesty fix to two call sites `describeOutcome` doesn't cover**
- **Found during:** Task 2 (result-surface copy)
- **Issue:** The plan's action text scoped the fix to `describeOutcome`, but `handleDismiss`'s post-Done summary toast and the result-phase "Profiles returning to their own defaults:" label both independently hardcoded clear-flavored copy for every revert, reproducing the exact "surface asserting more than happened" failure class the plan's own objective names.
- **Fix:** Both now branch on `revertRestoredName` the same way `describeOutcome` does — the toast says `Reverted to ${name}.` and the label says "Profiles still governed by the global override:" when restoring, unchanged copy otherwise.
- **Files modified:** `src/components/brains/GlobalSwapModal.tsx`
- **Verification:** All 15 pre-existing tests (which exercise the no-prior-override clear path through both call sites) pass unmodified; new tests exercise the restore path through `describeOutcome`.
- **Committed in:** `30322807`

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical functionality, same honesty class as the plan's stated objective)
**Impact on plan:** No scope creep — this closes the identical class of dishonest-surface bug at two adjacent call sites the plan's own reasoning already condemns, using the same `revertRestoredName` value already threaded through the component for `describeOutcome`.

## Issues Encountered
- The plan's illustrative combined "confirmed via readback, then bounded-timeout fallback" T2 test sequence doesn't work as one flow: the existing D-14 readback `useEffect` only listens while `outcome.status === "confirming"` — once the bounded timeout has already resolved to `"accepted"`, a later matching readback does not retroactively flip it to `"confirmed"` (pre-existing, unchanged behavior, not part of this plan's fix). Split into two independent tests instead of debugging or altering that unrelated mechanism.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- This plan closes 1 of the 6 defects tracked into the gap-closure cycle's remaining live re-verification (`103-13`, wave 3, operator-attended). A green unit suite here is explicitly NOT accepted as proof of the live fix per `103-VERIFICATION.md` and this plan's own `<verification>` section — the orchestrator performs the live re-verification separately.
- `BSC-04`/`BSC-05` not re-marked in `REQUIREMENTS.md` this plan, matching the established gap-closure-cycle pattern from Plans 09-12: the overall requirement re-mark happens after `103-13`'s live re-verification, not per-plan.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: src/components/brains/GlobalSwapModal.tsx
- FOUND: src/components/brains/GlobalSwapModal.test.tsx
- FOUND: .planning/phases/103-brain-swap-control-surface/103-14-SUMMARY.md
- FOUND commit: 30322807 (fix)
- FOUND commit: 5bbff0f8 (docs/SUMMARY)
