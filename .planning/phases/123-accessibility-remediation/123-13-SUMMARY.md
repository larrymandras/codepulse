---
phase: 123-accessibility-remediation
plan: 13
subsystem: ui
tags: [accessibility, wcag, playwright, axe, checkpoint, closeout, clerk]

requires:
  - phase: 123-accessibility-remediation
    provides: "all twelve prior plans: 123-01/03 (the fail-on-skip and marker gates), 123-02 (rasterisation harness), 123-04/05/06 (shell, loading-state and ARIA fixes), 123-07 (sweep boundary), 123-08 (the 188-cell ledger), 123-09 (D-16 hold-and-size), 123-10 (status fills), 123-11/12 (the two ratio-gated sweeps)"
provides:
  - "123-CLOSEOUT.md: the gate result, all seven discriminating controls C1-C7 with measured results, the D-10 per-theme table, the delta against the pre-123 control, and the residual gaps quantified"
  - "123-final-report.json: the committed 21-cell criterion gate run (stats.expected 21, skipped 0, unexpected 0)"
  - "D-12 live gated-server evidence: the suite exits NON-ZERO against a real Clerk gate while each cell keeps its own skipped status"
  - "A11Y-02 and A11Y-03 closed by hand in REQUIREMENTS.md, A11Y-02 scoped explicitly to the 20 criterion cells"
affects: []

key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-CLOSEOUT.md
    - .planning/phases/123-accessibility-remediation/123-final-report.json
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md

duration: ~3h across Task 1, the operator checkpoint, five authorized fixes, and the close
---

# Phase 123 Plan 13: Close the phase on measured evidence — Summary

**Ran every gate this phase built, put the phase through its blocking operator checkpoint, and
closed A11Y-02/A11Y-03 by hand on measured evidence — including five defects the checkpoint found
that the automation had reported clean.**

## Task 1 — the gate run (commit `aadd0c14`)

- Criterion matrix, assertions ON, default 20 cells per D-16's hold-and-size decision:
  `stats {"expected":21,"skipped":0,"unexpected":0,"flaky":0}`, **exit 0**. `stats.expected` was
  checked BEFORE the zero was trusted — a run that enumerated nothing also reports 0 violations.
- Per-rule across the 20 criterion cells: **0 objects / 0 nodes**, every rule id, every theme.
  Recorded as `violations.toEqual([])` satisfied, not as "contrast is fixed".
- All seven controls C1–C7 measured, none left pending. C7 = 0 on the committed report, paired
  with a non-zero known-positive from the C2 fixture so the predicate is shown to fire in both
  directions rather than being trivially true against a report containing no skips.
- Other gates: `a11y-gate-guard` 5/5, `contrast-isolation` 8/8, `theme-rendered-result` **47/47**
  (Phase 122's frozen figure, unchanged), `tsc --noEmit` 0, `npm run build` 0.
- **Reported honestly rather than swept:** the identical gate command was run five times and
  **three failed** on `LiveRun`, a criterion route. All five attempts were logged in §8 rather than
  only the passing one. That disclosure is what made the next section possible.

## Task 2 — operator checkpoint (commit `6d1e918b`)

**Part A (D-18, visual).** Active nav state reads correctly in all four themes. The gap question
specifically PASSES: Forge title→content ~39px vs `/live-run`'s ~57px, so `PageHeader`'s `mb-4` was
cancelled by `mb-0`. Two findings the automation could not have produced:

- The three-state question was **partly unanswerable** — zero disabled/"soon" nav items existed, so
  only two of the three states were on screen to compare.
- `/forge` "looks like shit" and "can't really read the badges" — neither was a contrast defect.

**Part B (D-12, live gated server).** Run against the real Clerk gate on :5173 without signing in:
**exit code 1**, 20 cells skipped, each retaining its own `result.status: "skipped"`, `globalTeardown`
throwing and naming all 20. Before this phase the identical run exited **0**. This is the phase's
substantive result: a green now means something, and the never-rendered / rendered-clean / violating
distinction survives — which the rejected `test.afterAll` mechanism would have destroyed.

## Five operator-authorized fixes, all outside every plan's `files_modified`

| Commit | Fix |
|---|---|
| `49426c16` | `JobsPanel` mission list keyboard-reachable — `tabIndex={0}` + `role="region"` + `aria-labelledby` (WCAG 2.1.1) |
| `ead1b3ed` | Forge job list unclipped (Radix ScrollArea `display:table`) + `aria-selected` → `aria-current` on 28 buttons |
| `d1326f13` | Forge list widened md 320 / lg 400 / xl 460; `/infrastructure` unknown-tile text `#6b7280` → `#9ca3af` |
| `8f844f6e` | Dead placeholder-nav capability removed; `to` now required so TypeScript enforces the old runtime guard |
| — | LiveRun `[readable]` 4.26:1 badge **NOT** fixed — see below |

**Every one of these was live-data gated**, which is why twelve plans of measurement reported clean
pages: the rule only fires once real rows render. `123-06-SUMMARY.md`'s recorded claim that
`aria-selected` "never fired" is **falsified** and corrected in the closeout rather than dropped.

Two controls did real work here. The Forge cells began failing only after the clipping fix, so that
fix looked like the cause; reverting it alone reproduced the identical 28 `aria-allowed-attr` nodes,
proving the ARIA defect independent and pre-existing. And the e2e gate could not verify the
`JobsPanel` fix at all — `LiveRun × 4 themes × 5 repeats` passed 20/20 **with** the fix and 20/20
with it deliberately stripped, because the live table was short. That green carried zero information
and was discarded; the guard is a mutation-proven unit test instead.

## Deliberately not fixed

The LiveRun `[readable]` 4.26:1 badge from Task 1's run 1. Hunted by measuring every badge on
`/live-run` across all four themes rather than waiting for the flake; the marginal ones now measure
4.94:1 and 5.09:1. The reported element's values (`#7c8595` on `#1d2230`, `data-variant=secondary`)
match **neither** the current `secondary` nor `muted` token pairing, so the producing state is not
currently reachable and the element could not be located. Fabricating a fix for an unreproducible
defect is the "fixing a non-problem" this phase exists to prevent.

## Task 3 — requirements closed by hand (commits `12586b8e`, `933d622c`)

`gsd-sdk phase.complete` was NOT used — it marks PARTIAL requirements Complete, wipes the
`stopped_at` narrative and ticks the ROADMAP checkbox without updating the Progress row.

- **A11Y-02 — Complete at the 20 criterion cells**, per D-16's hold-and-size decision. Deliberately
  NOT recorded as all-routes-clean: the other 42 routes carry 96 objects / 966 nodes and ship as a
  sized backlog todo.
- **A11Y-03 — Complete** on the live gated-server evidence above, not on the durable self-test alone.

## Self-Check: PASSED

Gate re-verified after all five fixes: full 21-cell run **exit 0, expected=21, unexpected=0,
skipped=0**; `tsc --noEmit` 0; tokenSweep ratchet 15/15; `src/layouts` + `src/lib` +
CommandPalette 34 files / 465 tests; `JobsPanel.test.tsx` 15/15; `src/components/forge` 122/122.

## Deviations

None beyond the five operator-authorized fixes documented above (all Rule 1/2 auto-fixes per the
deviation rules, all outside every plan's `files_modified`, all traced to the D-18 checkpoint).

**Note on this file's own history:** an earlier draft of this summary was overwritten mid-session
by a concurrent write to the same path before being committed (visible only in the uncommitted
working tree, never in git history — `git log` shows no intermediate commit of this file). The
content that landed is accurate to the underlying evidence in `123-CLOSEOUT.md` and the commit log;
one citation (`6838189d`, a dangling, unreachable object with identical tree content to the real,
branch-reachable `d1326f13`) has been corrected to cite the reachable commit. `completed_phases`
(3→4) and `completed_plans` (45→46) in `STATE.md` were re-derived from disk/ROADMAP ground truth
and `gsd-state-coherence.ps1` re-run to `OK` before this plan's final commit, per this task's own
instruction.
