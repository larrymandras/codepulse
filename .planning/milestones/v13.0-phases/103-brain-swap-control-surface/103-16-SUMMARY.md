---
phase: 103-brain-swap-control-surface
plan: 16
subsystem: ui
tags: [react, brain-swap, dialog, testing, gap-closure, code-review]

# Dependency graph
requires:
  - phase: 103-12
    provides: GlobalSwapModal's mount-vs-visibility decoupling (CR-03 — the modal instance survives "Done" so a later Revert can reopen it) and the `target.id`-keyed reset guard this plan replaces
  - phase: 103-14
    provides: GlobalSwapModal's restore-to-prior revert branch (`priorOverrideRef`), preserved unchanged by this plan's reset-effect rekey
provides:
  - "GlobalSwapModal.tsx: a `selectionNonce` prop, bumped by BrainPicker on every global-scope activation (including a repeat of the same brain), replacing `target.id` as the reset effect's guard"
  - "BrainPicker.tsx: `globalSelectionNonce` state, incremented unconditionally in handleSelect's global branch"
  - "BrainPicker.test.tsx: a `globalSwapModalMode` mock toggle ('mock' | 'real') letting specific tests render the ACTUAL GlobalSwapModal against this file's already-mocked hook seams, plus 5 new tests covering the reselect-same-brain path end-to-end"
affects: [103-13-live-reverification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-selection nonce (not target identity) as a React reset-effect guard: distinguishes 'the user just made a selection' from 'this open transition is something else' (a revert reopening the same instance) when both can toggle the same visible state"
    - "Mode-toggling test mock via vi.mock's importOriginal: a module-level flag lets a subset of tests swap a lightweight mock for the real component mid-file, selected via JSX (not a plain function call) so each variant keeps its own fiber and React's hook rules stay intact"

key-files:
  created: []
  modified:
    - src/components/brains/GlobalSwapModal.tsx
    - src/components/brains/GlobalSwapModal.test.tsx
    - src/components/brains/BrainPicker.tsx
    - src/components/brains/BrainPicker.test.tsx

key-decisions:
  - "Fix shape matches the plan's own prescribed nonce design, not the reviewer's illustrative 'reset on open false->true, guarded by a justSelectedRef' alternative — a per-selection nonce set in the exact handler that turns an activation into a modal open is simpler and has the same asymmetry property (a revert's own onOpenChange(true) never touches BrainPicker's state, so it can never bump the nonce) without needing a second ref to distinguish 'fresh selection reopen' from 'revert reopen.'"
  - "The interface change (GlobalSwapModalProps.selectionNonce, now required) forced a mechanical prop backfill across all 33 existing render calls in GlobalSwapModal.test.tsx, committed in the same Task 1 commit as the source fix (Rule 3: the existing suite wouldn't compile against the new required prop otherwise) — zero new test cases in that pass, substantive new coverage landed separately in Task 2."
  - "Task 2's 'REAL GlobalSwapModal' requirement was satisfied via a mode-toggling mock (globalSwapModalMode: 'mock' | 'real', selected in vi.mock's factory via importOriginal), not a second test file or vi.doUnmock — both hooks the real component depends on (useAstridrWS, useGlobalBrainOverride) were already mocked at the right level in BrainPicker.test.tsx for WR-02/103-12's own tests, so no new mocking surface was needed."
  - "The mock/real choice is made via a JSX ternary ({mode === 'real' ? <actual.GlobalSwapModal .../> : <MockGlobalSwapModal .../>}), not a plain conditional function call — keeps each variant on its own React fiber so hook rules stay intact even though only one is ever mounted per test."

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-07-29
---

# Phase 103 Plan 16: GlobalSwapModal Reset Keyed to Selection Identity Summary

**`GlobalSwapModal`'s reset effect now keys off a per-selection nonce `BrainPicker` bumps on every global-scope activation (including a repeat of the same brain) instead of `target.id` equality, closing code-review finding CR-01 without regressing CR-03's revert-survives-Done guarantee.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2
- **Files modified:** 4 (2 source, 2 test — no new files)

## Accomplishments

- Closed CR-01 (`103-REVIEW.md`), live-reproduced by the orchestrator against the running Astridr stack on 2026-07-29 before this plan was written: swapping all profiles to Claude Haiku 4.5, confirming, clicking Done, then reselecting the same brain reopened the modal showing the PREVIOUS swap's stale result verbatim (`confirm button = 0, done = 1`) instead of a fresh confirm prompt — and removed the retry path entirely after a failed swap.
- `BrainPicker` now increments a `globalSelectionNonce` in the exact handler (`handleSelect`'s global branch) that turns any global-scope activation into a modal open, and passes it to `GlobalSwapModal` as a new required `selectionNonce` prop.
- `GlobalSwapModal`'s reset effect keys off a change in `selectionNonce` instead of `target.id` equality — reselecting the same catalogue entry after a completed OR failed swap now gets a genuinely fresh `phase: "confirm"` state, restoring the retry path a failed swap previously lost.
- CR-03 (103-12's revert-survives-Done fix) is not regressed: `runRevert`'s own `onOpenChange(true)` call never touches `BrainPicker`'s state, so it can never bump `selectionNonce` — a toast-triggered revert reopen still finds its snapshot/outcome untouched and renders a real result.
- Added end-to-end coverage against the REAL `GlobalSwapModal` (not `BrainPicker.test.tsx`'s pre-existing mock, which is why this defect shipped invisibly — see Deviations/Issues below): reselect-after-completed-swap, reselect-after-failed-swap (retry restored), toast-revert-with-no-new-selection (CR-03 regression guard), and reselect-a-different-brain (pre-existing `target.id` path still works).

## Task Commits

Each task was committed atomically:

1. **Task 1: Key the modal reset to a fresh selection, not to target identity (103-16-T1)** — `ab38293a` (fix)
2. **Task 2: Cover the reselect path against a REAL modal (103-16-T2)** — `aaad66bc` (test)

## Files Created/Modified

- `src/components/brains/GlobalSwapModal.tsx` — New required `selectionNonce` prop; `prevTargetIdRef` renamed `prevSelectionNonceRef`; reset effect keyed on `selectionNonce` instead of `target.id`.
- `src/components/brains/GlobalSwapModal.test.tsx` — Mechanical prop backfill (`selectionNonce={1}` added to all 33 existing render/rerender calls) so the file compiles against the new required prop. No new test cases in this file — the plan's new coverage lives in `BrainPicker.test.tsx` per the "REAL GlobalSwapModal" requirement.
- `src/components/brains/BrainPicker.tsx` — New `globalSelectionNonce` state, incremented unconditionally in `handleSelect`'s global branch; passed to `GlobalSwapModal` as `selectionNonce`.
- `src/components/brains/BrainPicker.test.tsx` — `globalSwapModalMode` ("mock" | "real") toggle added to the existing `GlobalSwapModal` mock (via `importOriginal`); `data-selection-nonce` exposed on the mock; 1 new mock-mode test (nonce bumps on reselect) + 1 new describe block with 4 real-mode tests (scenarios a-d from the plan's Task 2 action text).

## Decisions Made

See `key-decisions` in frontmatter above for full rationale. Summary:
- Implemented the plan's own prescribed per-selection-nonce design rather than the reviewer's illustrative `open`-transition-plus-ref alternative — simpler, same asymmetry guarantee.
- The required-prop interface change forced a mechanical, no-new-assertions backfill of `GlobalSwapModal.test.tsx` into Task 1's commit (Rule 3 blocking-issue fix).
- Real-component coverage in `BrainPicker.test.tsx` used a mode-toggling mock rather than a second test file or `vi.doUnmock`, reusing hook mocks already present in the file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mechanical `selectionNonce` prop backfill in `GlobalSwapModal.test.tsx`**
- **Found during:** Task 1, immediately after adding the new required `selectionNonce` prop to `GlobalSwapModalProps`
- **Issue:** All 33 existing `<GlobalSwapModal .../>` render/rerender calls in `GlobalSwapModal.test.tsx` omitted the newly-required prop, which would fail `tsc --noEmit` and block every other test in the file from running.
- **Fix:** Added `selectionNonce={1}` to every existing render call (a scripted, mechanical regex transform — same value at every call site within a given test, since none of those tests represent a new user selection mid-flow). No behavior or assertion changes.
- **Files modified:** `src/components/brains/GlobalSwapModal.test.tsx`
- **Verification:** `npx tsc --noEmit` clean; all 15 pre-existing tests in the file still pass unmodified.
- **Committed in:** `ab38293a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3, blocking compile fix — mechanical, no behavior change)
**Impact on plan:** No scope creep — necessary consequence of the interface change Task 1 itself specifies.

## Issues Encountered

None beyond the documented deviation above. One structural note worth recording for the next reviewer (per the plan's own instruction): `BrainPicker.test.tsx` fully mocked `GlobalSwapModal` in every pre-existing test (`vi.mock("@/components/brains/GlobalSwapModal", ...)`), so no test in the repo's history could ever observe the real component's internal `phase`/`outcome` state through `BrainPicker`'s actual wiring — that mock is the direct reason CR-01 shipped invisible through the whole 103-09..103-15 gap-closure cycle. This plan's `globalSwapModalMode` toggle closes that blind spot without discarding the mock's value for every other test in the file.

## Mutation Checks (both required, both performed live)

1. **Task 1 (target.id-equality regression):** Temporarily reverted the reset guard from `selectionNonce === prevSelectionNonceRef.current` back to `target.id === prevSelectionNonceRef.current` (the exact pre-103-16 defect). Re-ran `GlobalSwapModal.test.tsx` + `BrainPicker.test.tsx` — exactly the two new reselect tests failed as expected (`(a)` completed-swap reselect, `(b)` failed-swap reselect; 2 failed / 54 passed). Restored from a scratchpad backup, re-verified `git diff` empty and 54/54 passing.
2. **Task 2 (open-transition regression, the pre-103-12 CR-03 bug):** Temporarily reverted the reset guard to `if (!open) return;` / `[open]` (resetting on every `open` transition, independent of selection). Re-ran the same two files — exactly the new CR-03 regression test failed as expected (`(c)` toast-revert-with-no-new-selection; 1 failed / 54 passed). Neither of `GlobalSwapModal.test.tsx`'s own pre-existing revert tests caught this mutation, because those tests drive `onOpenChange` as a bare spy that never feeds back into the `open` prop actually rendered — only the new real-component `BrainPicker.test.tsx` test exercises a genuine `open` false→true transition through `BrainPicker`'s own closed-loop `globalDialogOpen` state. This is direct evidence for why the plan required a REAL-component integration test. Restored from the same scratchpad backup, re-verified `git diff` empty and 54/54 passing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `npx tsc --noEmit` clean. Full suite: **2859/2859 passing** (5 new tests over the 2854 baseline: 4 real-mode `BrainPicker.test.tsx` scenarios + 1 mock-mode `selectionNonce`-bump check), 0 failures.
- Both required mutation checks performed live and restored — see above.
- **Live re-verification of this specific fix against the running Astridr stack is NOT performed by this plan** — per this plan's own `<verification>` section, a green unit suite is explicitly not accepted as proof of the live fix. That verification (repeat the orchestrator's original live reproduction: swap → confirm → Done → reselect the same brain → expect a fresh confirm prompt) is the orchestrator's job after this plan lands.
- `BSC-02`/`BSC-04` not re-marked in `REQUIREMENTS.md` this plan — same established gap-closure-cycle pattern as every prior plan except 103-13's own live-checkpoint record/restate: the overall requirement re-mark happens after a live re-verification, not per-plan.
- OBS 8 (D-11 confirm-modal per-profile accuracy, discovered by 103-13-T1, left unfixed per Larry's explicit disposition) remains the one other open item in this phase — unrelated to this plan's scope.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

All claimed files exist (`GlobalSwapModal.tsx`, `GlobalSwapModal.test.tsx`, `BrainPicker.tsx`, `BrainPicker.test.tsx`, this SUMMARY.md) and both task commits (`ab38293a`, `aaad66bc`) are present in git history.
