---
phase: 123-accessibility-remediation
plan: 09
subsystem: planning/accessibility
tags: [a11y, checkpoint, operator-decision, contrast]
requires: [123-08]
provides: [123-CRITERION-DECISION.md, a11y-02-widened-scan-42-route-backlog.md]
affects: [ROADMAP.md A11Y-02 criterion (confirmed unchanged), plan 123-11 scope (confirmed unchanged)]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/123-accessibility-remediation/123-CRITERION-DECISION.md
    - .planning/todos/pending/a11y-02-widened-scan-42-route-backlog.md
  modified: []
decisions:
  - "D-16 resolved: A11Y-02's pass/fail criterion stays at the 20 A11Y-01-measured cells; the 42 extra routes' violations (96 objects / 966 nodes across 168 cells) ship as a sized backlog item rather than widening this phase's gate."
metrics:
  duration: "~35min"
  completed: 2026-08-20
---

# Phase 123 Plan 09: D-16 operator checkpoint — hold the criterion at 20 cells Summary

D-16's mid-phase checkpoint asked the operator whether A11Y-02's pass/fail criterion should widen
from the 20 measured cells to all 188 (47 routes × 4 themes), now that plan 123-08 plus its
orchestrator-produced addendum had measured the full matrix (188/188, no cells unmeasured). The
operator chose to hold the criterion at 20 cells and file the other 42 routes as a sized backlog
item — recorded verbatim in `123-CRITERION-DECISION.md`.

## What was built

**Task 1 — the decision brief** (`123-CRITERION-DECISION.md`): re-verified the consolidated
188-cell numbers from `123-CONTRAST-RESULT.md` (140-cell original run) and
`123-CONTRAST-RESULT-ADDENDUM.md` (the 48-cell dev-server-gap recovery), independently summing
both source per-rule tables and confirming the addendum's own consolidated figures
(96 objects / 966 nodes; per-rule: button-name 36/857, color-contrast 28/61,
aria-input-field-name 7/15, label 8/12, select-name 4/8, aria-valid-attr-value 5/5,
link-in-text-block 4/4, scrollable-region-focusable 4/4). Named the top five non-criterion routes
by node count (Ideation 474, Alerts 260, Automation 48, ConfigPage 43, HrAgentAnalytics/
Infrastructure tied at 16), the 19/2/21 zero/1-5/>5-node route distribution, and the /chat figures
separately (0/0 in all 4 themes, now closed rather than unmeasured — out of scope for the v15.0
milestone regardless). Both named options were stated with cost and consequence, with the
statement of what the numbers point to kept separate from the recommendation-free option text, per
the plan's own instruction not to bury a suggested answer in the option prose.

**Remediation-cost honesty finding (Task 1):** the ledger does not contain file:line mapping for 7
of the 8 flagged rule categories — button-name, aria-input-field-name, label, select-name,
aria-valid-attr-value, link-in-text-block, scrollable-region-focusable (68 objects / 905 nodes
combined) — nor for 21 of the 28 color-contrast objects. Only 7 color-contrast objects have
file:line, and those are already in plan 123-11's scope. Rather than fabricate a file count for
what widening "would add," the brief states plainly that this figure is not derivable from the
ledger — a new axe-to-source triage pass (the same methodology Section 3 applied to the
`text-primary/NN` class family) would be needed first, and 123-11/123-12 are contrast-only sweeps
not built to do it.

**Task 2 — the checkpoint decision:** the operator's decision was relayed by the team lead with
the exact question asked and the exact answer given (see `<operator_decision>` in the dispatch),
recorded verbatim under `## Decision` in `123-CRITERION-DECISION.md` with the date (2026-08-20) and
option id (`hold-and-size`). Consequence applied in the same task:
- `ROADMAP.md`'s Phase 123 success criterion 1 left **unchanged** (still names the A11Y-01-measured
  cells — no edit made).
- Plan 123-11's scope confirmed **unchanged** (still the existing 33-file
  `text-primary/NN`/`text-muted-foreground/NN` sweep).
- Sized backlog filed at `.planning/todos/pending/a11y-02-widened-scan-42-route-backlog.md`,
  following the repo's existing `todos/pending/` convention (frontmatter shape matched to
  `warn-fill-foreground-pairing-sub-aa.md`), carrying the full per-rule/per-route table, the
  Ideation instability caveat, the un-triaged-remainder note, and re-measurement commands.

## Key finding carried into the backlog: Ideation's 474 nodes are not a firm number

`123-CONTRAST-RESULT.md`'s per-route table flags Ideation as theme-unstable: aubergine measured 474
button-name/color-contrast nodes, cyan/emerald/readable measured 0 for the same route — judged a
live-data timing race, not a theme-CSS effect, and explicitly "flagged, not adjudicated." 474 of
the 966-node widened total (49%) and 474 of the 857 button-name nodes (55%) come from this single
unstable measurement. Both the decision brief and the backlog item carry this caveat verbatim so no
later reader treats 857 (or 966) as a stable population without re-measuring first.

## Deviations from Plan

None. Plan executed exactly as written — Task 1 produced the brief with all required elements
(20-cell aggregate, 168-cell aggregate, /chat separately, top-five routes individually, file/
occurrence cost for option (a), neither option marked chosen), Task 2 recorded the operator's
already-made decision verbatim with date and option id and applied the `hold-and-size` consequence
(todo filed, ROADMAP/123-11 confirmed unchanged) in the same task.

One clarification beyond the plan's literal text: the plan's acceptance criteria ask for "the file
count and occurrence count that option (a) would add to plan 123-11." The honest, ledger-traceable
answer is that the **file count is not derivable** from `123-CONTRAST-RESULT.md`/its addendum for
7 of 8 rule categories — stated explicitly in §3 of the decision brief rather than fabricating a
number, consistent with the plan's own instruction that "no number appears that is not in the
ledger or derivable from it by a stated command."

## Self-Check

- `test -f .planning/phases/123-accessibility-remediation/123-CRITERION-DECISION.md` → exists
- `grep -c "^### Option" .planning/phases/123-accessibility-remediation/123-CRITERION-DECISION.md` → 2
- `test -f .planning/todos/pending/a11y-02-widened-scan-42-route-backlog.md` → exists
- `grep -c "^## Decision" .planning/phases/123-accessibility-remediation/123-CRITERION-DECISION.md` → 1
- Commit `1bc447b1` contains exactly the two new files (`git show --stat HEAD`), no unrelated files
  swept in.
