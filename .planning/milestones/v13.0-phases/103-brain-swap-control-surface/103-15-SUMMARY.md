---
phase: 103-brain-swap-control-surface
plan: 15
subsystem: ui
tags: [react, websocket, global-swap, honesty-surface, gap-closure, test-hardening]

# Dependency graph
requires:
  - phase: 103-12
    provides: GlobalSwapModal's honest 5-state GlobalOutcome and revert-survives-Done mount lifecycle
  - phase: 103-14
    provides: GlobalSwapModal.runRevert restore-to-prior-override fix (the actual regression this plan investigated)
provides:
  - "Investigation record reconciling 103-15-PLAN's premise against live code: BrainControl's clear-to-Auto affordance ('Restore usual brain') was NOT unreachable — it has shipped and been tested since 186-09 (commit 6cc040d3), independent of the GlobalSwapModal regression 103-14 fixed"
  - "Hardened BrainControl.test.tsx coverage: no-double-fire, disabled-while-pending, and a D-14 no-self-asserted-success regression test, closing the specific gaps 103-15-PLAN called out against the existing implementation"
  - "A real mutation check (restore:false hardcoded into the dispatch payload) proving 3 tests (1 pre-existing + 2 new) actually guard the restore:true dispatch shape"
affects: [103-13, brain-swap-live-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "When a plan's 'verified facts' contradict the live code you're about to change, stop and re-verify via git history + live wiring before writing more code on top of a false premise (CLAUDE.md: 'Comments, config comments, and commit messages are CLAIMS, not evidence')"

key-files:
  created: []
  modified:
    - src/components/control-center/BrainControl.test.tsx

key-decisions:
  - "Did not add a second/duplicate 'Reset to Auto' affordance to BrainControl.tsx. The plan's action text asked for one, but git history (commit 6cc040d3, phase 186-09, predates this whole gap-closure cycle) shows the 'Restore usual brain' button already exists, already gates on `override` being non-empty, already respects `pending`, and already dispatches the exact `{ type: 'swap.set', target: 'brain', restore: true }` shape the plan wants. Adding a second button would violate 103-CONTRACT.md §8 (single-axis dispatch: one live command, one affordance) and confuse the UI with two ways to do the same thing. Treated the plan as 'hardening + documentation' instead of 'net-new UI', per the same class of correction as [[absence-of-spec-symbols-is-not-absence-of-feature]]."
  - "Combined Task 1 and Task 2's test additions into a single commit. Both land in the same file (BrainControl.test.tsx) as one coherent edit to the same 'hardened coverage' block, and Task 2's D-14 regression test was written alongside Task 1's no-double-fire/disabled-while-pending tests before either was committed — splitting them into two commits after the fact would have meant reverting and re-adding tests just to manufacture a task boundary. Same precedent as 103-14's decision log ('task split follows the actual code seam, not a literal per-task file diff')."
  - "Kept the existing 'Restore usual brain' label rather than renaming to the plan's illustrative 'Reset to Auto' — it already shipped through Larry's live checkpoint feedback rounds (186-09) and renaming it here would be a cosmetic change with no functional justification, outside this plan's actual scope (closing the coverage gap, not relitigating copy)."

requirements-completed: []  # BSC-04/BSC-05 intentionally NOT marked here -- see "Next Phase Readiness"

# Metrics
duration: 20min
completed: 2026-07-29
---

# Phase 103 Plan 15: BrainControl Restore-to-Auto Coverage Hardening Summary

**Investigated 103-15-PLAN's regression claim against BrainControl.tsx's live code, found the claim did not hold for this file (the "Restore usual brain" affordance has shipped and been reachable since 186-09), and closed the specific test-coverage gaps the plan called out instead of adding a duplicate UI affordance.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-29T17:22:00Z (approx.)
- **Completed:** 2026-07-29T17:42:09Z
- **Tasks:** 2 (both satisfied by one commit — see Decisions Made)
- **Files modified:** 1

## Accomplishments

- **Reconciled the plan's premise against the live codebase.** 103-15-PLAN's "VERIFIED FACTS" state that `BrainControl.tsx`'s `restore` branch is "implemented but unreachable from the UI" and that "no UI entry ever passes `true`." Reading the live file (`src/components/control-center/BrainControl.tsx:217-227`) and its git history shows this is false for this component: a "Restore usual brain" `Button` has existed since the component's original commit (`6cc040d3`, phase 186-09, well before the 103-13/103-14 gap-closure cycle), renders only when `override` is a non-empty string, respects `pending`/disabled state, and calls `dispatchSelection("", true)` — which builds exactly `{ type: "swap.set", target: "brain", value: undefined, restore: true }`. This was already covered by two pre-existing tests (`shows a "Restore usual brain" row only when an override is active`, `dispatches swap.set with restore=true when "Restore usual brain" is clicked`).
- **Traced why the live incident still happened.** `.planning/REQUIREMENTS.md`'s BSC-01 marker independently corroborates this: during the 2026-07-28 three-surface investigation, "only the pre-existing `BrainControl` was correct." The 103-13-T1 live checkpoint script (`103-13-PLAN.md` steps D/E) only exercises the *GlobalSwapModal* "Revert global swap" toast action — it never asks the operator to open Control Center's `BrainControl` popover and click "Restore usual brain." So the operator hit the real 103-14 regression (GlobalSwapModal's revert now restores-to-prior, not clear) and bypassed the UI via a raw socket command rather than using the separate, already-working `BrainControl` clear path. The regression is real and 103-14 already fixed the component it lives in (`GlobalSwapModal.tsx`) — it was never in `BrainControl.tsx`.
- **Closed the actual coverage gaps 103-15-PLAN identified**, applied against the *existing* implementation rather than new code:
  - Task 1 (c): `dispatches exactly one swap.set command per Restore-usual-brain activation (no double-fire)` — asserts exactly one `swap.set` call after a single click.
  - Task 1 (d): `disables the Restore usual brain row while its dispatch is pending` — uses a manually-resolved promise to assert `disabled` is true mid-flight.
  - Task 1 mutation check: performed for real — temporarily hardcoded `restore: false` into `dispatchSelection`'s payload, ran the suite, confirmed 3 tests fail (1 pre-existing `restore=true` dispatch-shape test + both new tests that assert `restore: true`), then reverted. `BrainControl.tsx` has a zero-line net diff.
  - Task 2: `never self-asserts the override was cleared -- label reflects only the override prop (D-14)` — clicks Restore, resolves the ack with `status: "ok"` only (no readback), and asserts the trigger label still reads the pre-clear `override` value and no "clear"-flavored text appears anywhere in the DOM. Only re-rendering with `override={null}` (simulating the parent's `swap.state`-fed prop update) flips the label to "Auto." This pins the same D-14 property `GlobalSwapModal` already enforces: BrainControl derives 100% of its displayed state from the `override`/`lastTurnModel` props (fed upstream by `useResolvedBrain`'s readback), never from a locally-held "it worked" flag.
- Full suite: 2854 passed (was 2851 baseline + 3 new tests, 0 failures), `npx tsc --noEmit` clean.

## Task Commits

Both tasks land in one commit (both are test-only additions to the same file, written together — see Decisions Made):

1. **Task 1 (no-double-fire, disabled-while-pending, mutation check) + Task 2 (D-14 pinning test)** — `026305cd` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `src/components/control-center/BrainControl.test.tsx` — 3 new tests (no-double-fire, disabled-while-pending, D-14 no-self-asserted-success) appended after the pre-existing restore-path tests, with a header comment explaining why this plan's premise didn't hold for this file. `BrainControl.tsx` itself is unchanged.

## Decisions Made
See frontmatter `key-decisions` for the three substantive calls (no duplicate affordance, combined commit, kept existing copy).

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing functionality, or blockers were found in `BrainControl.tsx` itself; it already behaved correctly.

### Premise Correction (not a Rule 1-4 deviation — a factual finding)

**1. The plan's "VERIFIED FACTS" claim about `BrainControl.tsx` line 159-166 being unreachable is incorrect for this file.**
- **Found during:** Task 1, before writing any test (re-reading the live file per the `<files_to_read>` mandate and CLAUDE.md's "read the code path before repeating [claims]" rule).
- **Claim in plan:** "`BrainControl.tsx:159-166` already builds the correct restore payload; the branch is simply unreachable" and "`dispatchSelection(value, restore = false)`... no UI entry ever passes `true`."
- **Reality:** `BrainControl.tsx:217-227` (present since commit `6cc040d3`, phase 186-09) renders a "Restore usual brain" button, gated on `override` being truthy, that calls `dispatchSelection("", true)` — reachable, tested, and live in production (wired through `ControlCenterPanel` → `Chat.tsx`'s `swapModelOverride={swapState.modelOverride}`, the same readback source `useGlobalBrainOverride` uses).
- **Why the objective's evidence is still true:** the live incident (operator bypassing the UI via raw socket) happened because the 103-13-T1 checkpoint script only exercises `GlobalSwapModal`'s "Revert global swap" toast action, which 103-14 correctly changed to restore-to-prior — leaving *that specific flow* with no clear-to-Auto option. `BrainControl`'s independent "Restore usual brain" button was never exercised in that session, not because it didn't exist.
- **Response:** did not add a duplicate affordance (see key-decisions). Closed the plan's stated coverage gaps against the real implementation instead. No production code changed.
- **Committed in:** `026305cd` (test)

---

**Total deviations:** 0 auto-fixed. 1 premise correction (documented above, no code impact).
**Impact on plan:** The plan's *acceptance criteria* (an operator-reachable, single-command, correctly-gated, D-14-honest clear-to-Auto control) are fully satisfied — they always were, for this file. This plan's actual contribution is closing 3 real test-coverage gaps and leaving a clear, evidence-backed record of why the plan's premise didn't apply here, so a future reader doesn't re-derive the same false lead.

## Issues Encountered

None beyond the premise investigation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- This plan does NOT close the live-verification gap on its own. The must_haves this plan targets (BSC-04/BSC-05) require an operator to actually open Control Center's `BrainControl` popover, set a global override, click "Restore usual brain," and confirm the badge/pill/BrainControl all agree the override is cleared — that observation has not yet been made against the live stack in this gap-closure cycle. Recommend the orchestrator fold this into the next live re-verification pass (following the `103-13` pattern), since `103-13-T1`'s original script never exercised this surface.
- `BSC-04`/`BSC-05` are intentionally NOT re-marked in `REQUIREMENTS.md` by this plan — same established gap-closure-cycle pattern from Plans 09-12/14: the overall requirement re-mark happens after a live re-verification pass, not per unit-test-only plan. `requirements-completed: []` in this SUMMARY's frontmatter reflects that.
- No blockers for subsequent phase-103 work. `BrainControl.tsx` needs no further changes for this objective.

---
*Phase: 103-brain-swap-control-surface*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: src/components/control-center/BrainControl.test.tsx
- FOUND: .planning/phases/103-brain-swap-control-surface/103-15-SUMMARY.md
- FOUND commit: 026305cd (test)
- FOUND commit: 10e10aed (docs/SUMMARY)
