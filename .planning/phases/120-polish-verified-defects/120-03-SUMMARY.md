---
phase: 120-polish-verified-defects
plan: 03
subsystem: ui
tags: [react, shadcn, alert-dialog, radix, vitest, confirm-gate]

# Dependency graph
requires:
  - phase: none (D-12/D-14 sites were pre-existing; alert-dialog.tsx primitive already existed)
    provides: n/a
provides:
  - "MoveToActionConfirmDialog — timeout-free AlertDialog gating Tasks.tsx's move-to-action-column WS dispatch"
  - "DeleteWarRoomDialog — timeout-free AlertDialog gating WarRoom.tsx's destructive room+transcript delete"
  - "src/ is free of window.confirm and 5-second auto-dismissing toast confirms"
  - "120-SANCTIONED-PATTERNS.md recording GlobalSwapModal.tsx's post-swap undo toast as D-13-sanctioned"
affects: [122-token-system, phase-124-shell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled AlertDialog confirm gate: open/onOpenChange/onConfirm props, no internal mutation, e.preventDefault() on AlertDialogAction so a rejected onConfirm keeps the dialog open (copied from DeleteSkillDialog.tsx)"
    - "Pending-value-plus-open-flag state shape for a page-level confirm gate (matches Tasks.tsx's existing selectedTask/detailOpen convention)"

key-files:
  created:
    - src/components/tasks/MoveToActionConfirmDialog.tsx
    - src/components/warroom/DeleteWarRoomDialog.tsx
    - src/components/tasks/MoveToActionConfirmDialog.test.tsx
    - src/components/warroom/DeleteWarRoomDialog.test.tsx
    - .planning/phases/120-polish-verified-defects/120-SANCTIONED-PATTERNS.md
  modified:
    - src/pages/Tasks.tsx
    - src/pages/WarRoom.tsx

key-decisions:
  - "Doc comments inside the two new dialog components and inside WarRoom.tsx that literally contained the substrings 'autoFocus' or 'window.confirm' were reworded — the acceptance-criteria greps for those exact substrings are anti-pattern detectors and cannot distinguish a comment from live code, so a self-documenting comment naming the banned pattern tripped its own gate. Reworded to describe the same fact without the literal substring."
  - "WarRoom.tsx right-panel GlassPanel: transition-transform duration-300 removed along with hover:scale-[1.01] (no other transform utility on that line, per plan's own instruction to read the line and decide)."
  - "WarRoom.tsx left-panel GlassPanel: transition-transform duration-300 kept with an inline comment, since it drives the F8 mobile drawer's translate-x-0/-translate-x-full slide."

patterns-established:
  - "Cancel-calls-onConfirm-zero-times is the load-bearing control for any confirm-dialog test in this repo, not merely 'dialog closes' or 'button vanishes'."

requirements-completed: [POLISH-01, POLISH-03]

# Metrics
duration: ~45min
completed: 2026-08-17
---

# Phase 120 Plan 03: Destructive Confirms → AlertDialog Summary

**Replaced Tasks.tsx's 5-second auto-dismissing toast confirm and WarRoom.tsx's `window.confirm` with two controlled, timeout-free shadcn AlertDialogs, each proven load-bearing by a break-and-refail control; also removed WarRoom.tsx's two remaining `hover:scale-[1.01]` occurrences and recorded GlobalSwapModal's post-swap undo toast as D-13-sanctioned.**

## Performance

- **Tasks:** 3/3 completed
- **Files modified:** 2 (`src/pages/Tasks.tsx`, `src/pages/WarRoom.tsx`)
- **Files created:** 5 (2 dialog components, 2 test files, 1 sanctioned-patterns doc)

## Accomplishments

- `MoveToActionConfirmDialog` and `DeleteWarRoomDialog` created — both controlled AlertDialogs
  copying `DeleteSkillDialog.tsx`'s structure (open/onOpenChange props, no trigger,
  `e.preventDefault()` + explicit `onOpenChange(false)`-on-success so a rejected `onConfirm`
  keeps the dialog open). Neither contains a `setTimeout`, a `duration:`, an auto-focus-and-confirm
  shortcut, or any countdown. Neither calls a Convex mutation — each holds only the gate.
- Both components have 7 tests each (14 total, all passing), including the mandated Cancel
  control (`onConfirm` called exactly 0 times) and a 60-second fake-timer test.
- **Both Cancel-gate tests were proven load-bearing by a break-and-refail control**: I temporarily
  wired `AlertDialogCancel`'s `onClick` to call `onConfirm` (simulating a gate that fires on every
  close path) in both components, re-ran the two test files, and confirmed exactly the Cancel
  test in each file went RED (`expected "vi.fn()" to be called +0 times, but got 1 times`) while
  all 12 other tests stayed green. Restored both files from a pre-mutation backup and re-ran —
  back to 14/14 passing. See "Break-and-refail control" below for the exact commands and output.
- `Tasks.tsx`'s `handleMoveTask` action-column branch now opens `MoveToActionConfirmDialog`
  instead of showing a 5-second toast; the confirm handler (`handleConfirmMove`) awaits
  `moveColumn` before calling `dispatch`, preserving the confirm-then-dispatch order (D-14). The
  non-action branch is unchanged — it still moves immediately with no dialog. Both `onMoveTask`
  and `onMove` call sites keep working since `handleMoveTask`'s `(taskId, newColumn) =>
  Promise<void>` signature is unchanged.
- `WarRoom.tsx`'s `handleDeleteRoom` is now a synchronous callback that stores the pending room
  and opens `DeleteWarRoomDialog`; the confirm handler (`handleConfirmDeleteRoom`) preserves the
  exact prior body — best-effort `closeWarRoom` in its own try/catch when `room.status ===
  "active"`, then `deleteWarRoom`, then clearing `selectedRoomId` if it matched, then
  `toast.success`, with the outer catch still toasting failures. `window.confirm` is gone from
  `src/` entirely (confirmed by a repo-wide `git grep`, paired with an `AlertDialogAction` count
  control — see verification below).
- WarRoom.tsx's two `hover:scale-[1.01]` occurrences removed: the left-panel (room list / F8
  drawer) panel keeps `transition-transform duration-300` with an inline comment explaining why
  (it drives the drawer's `translate-x-0`/`-translate-x-full` slide); the right-panel (room
  detail) panel had no other transform utility on that class string, so both
  `hover:scale-[1.01]` and `transition-transform duration-300` were removed together per the
  plan's own "read the line and decide" instruction.
- `120-SANCTIONED-PATTERNS.md` created, recording `GlobalSwapModal.tsx:494-508`'s "Revert global
  swap" toast action as D-13-sanctioned. I read the live code myself before writing this (not
  transcribed from the plan): `handleDismiss()` only reaches that toast when `lastAction ===
  "swap"` and `outcome.status !== "error"` — i.e. the swap has already resolved to `"confirmed"`
  or `"accepted, unconfirmed"`, both post-swap states. It is an undo affordance fired at dismiss
  time after the change already happened, not a pre-action gate, so POLISH-03 does not apply.
  `git diff --stat` for this plan's changes does not include `GlobalSwapModal.tsx`.

## Files Created/Modified

- `src/components/tasks/MoveToActionConfirmDialog.tsx` — controlled AlertDialog for the
  move-to-action-column confirm.
- `src/components/warroom/DeleteWarRoomDialog.tsx` — controlled AlertDialog for the war-room
  delete confirm.
- `src/components/tasks/MoveToActionConfirmDialog.test.tsx` — 7 tests incl. Cancel-zero-calls
  control and 60s fake-timer test.
- `src/components/warroom/DeleteWarRoomDialog.test.tsx` — 7 tests incl. Cancel-zero-calls control
  and 60s fake-timer test.
- `src/pages/Tasks.tsx` — `handleMoveTask` rewired to open the dialog instead of a toast;
  `handleConfirmMove` added; dialog rendered alongside the file's other dialogs.
- `src/pages/WarRoom.tsx` — `handleDeleteRoom`/`handleConfirmDeleteRoom` split, `window.confirm`
  removed, dialog rendered; two `hover:scale-[1.01]` occurrences removed.
- `.planning/phases/120-polish-verified-defects/120-SANCTIONED-PATTERNS.md` — new artifact
  recording the D-13 sanctioned pattern.

## Decisions Made

- Reworded three doc comments (2 in the new dialog components mentioning "autoFocus", 1 in
  `WarRoom.tsx`/`DeleteWarRoomDialog.tsx` mentioning "window.confirm") because the plan's own
  acceptance-criteria greps are literal substring matches with no code-vs-comment distinction — a
  comment documenting the absence of the banned pattern by naming it literally is
  indistinguishable, to that grep, from the pattern being present. Reworded to "auto-focus-and-
  confirm shortcut" and "browser-native confirm() prompt" respectively, preserving the intent
  without tripping the gate. This is a plan-authority correction, not a scope change — no
  behavior differs, only comment wording.
- Followed the plan's explicit instruction to read WarRoom.tsx's second `hover:scale-[1.01]` line
  before deciding whether to keep its paired `transition-transform duration-300`: that class
  string carries no other transform utility (unlike the left-panel drawer), so both were removed.

## Deviations from Plan

None — plan executed as written, aside from the comment-wording corrections documented above
under "Decisions Made" (not a Rule 1-4 deviation; no behavior changed).

## Break-and-refail control (mandated by plan_authority)

For each dialog, before restoring the final version:

1. Backed up both source files.
2. Edited `<AlertDialogCancel>Cancel</AlertDialogCancel>` to
   `<AlertDialogCancel onClick={() => void onConfirm()}>Cancel</AlertDialogCancel>` in both
   `MoveToActionConfirmDialog.tsx` and `DeleteWarRoomDialog.tsx` — simulating a gate that fires
   `onConfirm` on every close path, the exact trap the plan warns about.
3. Ran `npx vitest run src/components/tasks/MoveToActionConfirmDialog.test.tsx
   src/components/warroom/DeleteWarRoomDialog.test.tsx`.
4. **RED, as expected:** both files reported exactly 1 failure each —
   `MoveToActionConfirmDialog — confirm/cancel gate (T-120-07) > THE CONTROL: calls onConfirm ZERO
   times when Cancel is clicked` and the equivalent in `DeleteWarRoomDialog.test.tsx` — with the
   message `expected "vi.fn()" to be called +0 times, but got 1 times`. All 12 other tests (6 per
   file) stayed green, i.e. the break was isolated to exactly the intended assertion.
5. Restored both files from backup.
6. Re-ran the same command: 14/14 passing (GREEN), confirming the restore was byte-identical to
   the pre-mutation version and the control is genuinely load-bearing.

## Verification — literal command output

```
$ npx tsc --noEmit
(no output — exit 0)

$ npx vitest run src/components/tasks/MoveToActionConfirmDialog.test.tsx src/components/warroom/DeleteWarRoomDialog.test.tsx
Test Files  2 passed (2)
     Tests  14 passed (14)

$ npx vitest run   # full suite
Test Files  334 passed | 17 skipped (351)
     Tests  4668 passed | 197 todo (4865)

$ grep -cE 'setTimeout|duration:|autoFocus' src/components/tasks/MoveToActionConfirmDialog.tsx src/components/warroom/DeleteWarRoomDialog.tsx
src/components/tasks/MoveToActionConfirmDialog.tsx:0
src/components/warroom/DeleteWarRoomDialog.tsx:0

$ grep -c 'useMutation' src/components/tasks/MoveToActionConfirmDialog.tsx src/components/warroom/DeleteWarRoomDialog.tsx
src/components/tasks/MoveToActionConfirmDialog.tsx:0
src/components/warroom/DeleteWarRoomDialog.tsx:0

$ grep -c 'duration: 5000' src/pages/Tasks.tsx
0

$ grep -cE 'label: "Confirm"' src/pages/Tasks.tsx
0

$ grep -c 'MoveToActionConfirmDialog' src/pages/Tasks.tsx
2

$ grep -c 'ACTION_COLUMNS' src/pages/Tasks.tsx
2

$ grep -c 'TASK_COLUMNS.includes' src/pages/Tasks.tsx
1

$ git grep --untracked -c 'window.confirm' -- src/
(no match — 0)

$ git grep --untracked -c 'AlertDialogAction' -- src/ | awk -F: '{s+=$2} END{print s}'
23   # >= 4 control satisfied; note this count is only visible with --untracked
     # since the two new dialog files are not yet staged/committed in this
     # shared-checkout, orchestrator-commits workflow — a plain `git grep`
     # (no --untracked) undercounts until the orchestrator commits them.

$ git grep --untracked -cF 'hover:scale-[1.01]' -- src/pages/WarRoom.tsx
(no match — 0)

$ git grep -n 'transition-transform duration-300' -- src/pages/WarRoom.tsx
src/pages/WarRoom.tsx:307 (comment) / 311 (the surviving drawer className)

$ git grep -c 'closeWarRoom' -- src/pages/WarRoom.tsx
2   # import + the try/catch call site inside handleConfirmDeleteRoom — unchanged from before

$ git grep -c 'DeleteWarRoomDialog' -- src/pages/WarRoom.tsx
2   # import + render

$ git diff --stat
 src/pages/Tasks.tsx   | 57 +++++++++++++++++++++-------------
 src/pages/WarRoom.tsx | 84 +++++++++++++++++++++++++++++++++------------------
 2 files changed, 91 insertions(+), 50 deletions(-)
 # GlobalSwapModal.tsx is NOT in this list, confirming it was not touched.
```

**Note on the `git grep` untracked caveat:** this plan does not commit anything (orchestrator
owns commits per the plan's own `<output>` instruction), so the two new dialog components and
their tests are untracked at the time this SUMMARY is written. A plain `git grep` without
`--untracked` searches only tracked files and would undercount `AlertDialogAction` and miss the
new files' content entirely — I used `--untracked` throughout to get the true post-plan count.
Once the orchestrator commits these files, a plain `git grep -c 'AlertDialogAction' -- src/`
will independently reproduce the 23 figure above.

## Attended check (NOT performed — no live browser session available to this executor)

The plan's `<verification>` names one attended check that is explicitly "not automatable here":
running `dev:noauth`, dragging a task to `running`/confirming the dialog persists after a minute
of inactivity and that Cancel leaves the task unmoved, then opening a war room's delete dialog and
confirming it is themed (not a browser-native modal) and Cancel leaves the room present. I did not
have a live browser/dev-server session in this execution context to perform this, and per the
plan-authority instruction I am reporting this plainly rather than fabricating four observations.
**This attended check is outstanding and should be performed before this plan is considered fully
verified end-to-end** — the jsdom test suite proves the gate logic (Cancel calls onConfirm zero
times, no timer fires) but does not prove the dialog renders themed and legible in a real browser
across the app's five `data-theme` blocks.

## Issues Encountered

None beyond the comment-wording/acceptance-criteria-grep interaction documented above under
"Decisions Made".

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- POLISH-03's two verified defect sites are closed; no destructive or command-dispatching confirm
  remains in a toast or `window.confirm` anywhere in `src/`.
- `120-SANCTIONED-PATTERNS.md` is available for later phases (and later sweeps within this phase)
  to consult before "fixing" `GlobalSwapModal.tsx`'s undo toast.
- Outstanding: the attended dev:noauth browser check above should be run by an operator (or a
  future executor with browser tooling) before this defect class is considered closed
  end-to-end.

---
*Phase: 120-polish-verified-defects*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 6 claimed artifacts verified present on disk:
- FOUND: src/components/tasks/MoveToActionConfirmDialog.tsx
- FOUND: src/components/warroom/DeleteWarRoomDialog.tsx
- FOUND: src/components/tasks/MoveToActionConfirmDialog.test.tsx
- FOUND: src/components/warroom/DeleteWarRoomDialog.test.tsx
- FOUND: .planning/phases/120-polish-verified-defects/120-SANCTIONED-PATTERNS.md
- FOUND: .planning/phases/120-polish-verified-defects/120-03-SUMMARY.md (this file)

No commit hashes are claimed anywhere in this SUMMARY (orchestrator owns commits per this plan's
`<output>` instruction), so there is nothing to verify via `git log`. Confirmed via `git status
--short` that `.planning/STATE.md` and `.planning/ROADMAP.md` carry zero diff, and `git diff
--cached --name-only` returns empty (nothing staged).
