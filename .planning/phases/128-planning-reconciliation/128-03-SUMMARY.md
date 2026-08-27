---
phase: 128-planning-reconciliation
plan: 03
subsystem: planning
tags: [seed-reconciliation, requirements-drift, gsd-metadata, absorbed-status]

requires:
  - phase: 128-planning-reconciliation
    provides: "128-CONTEXT.md's D-08/D-09 seed status vocabulary decision"
provides:
  - "Nine seed files re-derived against code, not D-09's mapping on trust"
  - "status: absorbed vocabulary with absorbed_by referential-integrity checker"
  - "Carried-forward disposition table corrected (item 7 was over-claimed)"
affects: ["gsd-new-milestone seed scan", "future phase 129+ planning against REQUIREMENTS.md"]

tech-stack:
  added: []
  patterns:
    - "Hand-rolled frontmatter line parser (not a YAML library) that takes the first token of a value, tolerating trailing `#` evidence comments on the same line"
    - "Dual-field seed status (status: shipped + absorbed_by) for seeds where part of the content shipped and a distinct part was separately scoped"

key-files:
  created:
    - .planning/phases/128-planning-reconciliation/128-SEED-RECONCILIATION.md
    - .planning/phases/128-planning-reconciliation/checks/seed-status.mjs
  modified:
    - .planning/seeds/SEED-002-mission-control-jobs-board.md
    - .planning/seeds/SEED-003-cache-aware-cost-pricing.md
    - .planning/seeds/SEED-004-project-lifecycle-cockpit.md
    - .planning/seeds/SEED-005-seidr-suite.md
    - .planning/seeds/SEED-006-wcag-contrast-remediation.md
    - .planning/seeds/SEED-007-mission-emitter-revival.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "SEED-002's absorbed verdict is recorded PARTIAL (squad grouping + self-critique deploy-follow-up card have no v16.0 requirement) rather than rounded up to full absorption"
  - "SEED-006 given a dual shipped + absorbed_by status, decided from the seed's OWN scope text (its 20-cell matrix) rather than the topic, per the plan's explicit guidance"
  - "SEED-007's shipped half is scoped to ONLY the submittedAt gap (astridr e435f71a) — the other two emitter gaps plus D-11/D-12 remain open and unabsorbed, documented rather than silently dropped"
  - "Carried-forward item 7 (Nyquist coverage) corrected: Phase 119 closed, Phase 117 remains deliberately PARTIAL with a named, accepted, open gap — the filed table's blanket 'closed' over-claimed it"

requirements-completed: [RECON-02, RECON-03]

duration: ~25min
completed: 2026-08-27
---

# Phase 128 Plan 03: Seed Reconciliation Summary

**Re-derived all nine seed statuses against live code rather than applying D-09's proposed
mapping on trust — found three of nine needed a correction beyond a simple status-label swap,
introduced `status: absorbed` with a mutation-proven referential checker, and corrected one
carried-forward item that had over-claimed a phase as fully closed when it was deliberately
PARTIAL.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-27
- **Tasks:** 3/3 completed
- **Files modified:** 8 (1 ledger created, 1 checker created, 6 seeds edited, 1 requirements
  correction)

## Accomplishments

- Wrote `128-SEED-RECONCILIATION.md` with a nine-row seed-verdict table, a `## Findings (D-05)`
  section recording three real divergences from D-09, and a nine-row carried-forward audit
  (RECON-03) re-deriving every item in `.planning/REQUIREMENTS.md`'s dissolved v14.0 list against
  its own cited artifact.
- Applied `status: absorbed`/`shipped` (including two dual-field cases) to six seed files, each
  with an `absorbed_by`/evidence line naming the requirement IDs or phase/commit that justifies
  it, and left the three unchanged seeds (SEED-001, SEED-008, SEED-009) confirmed but untouched.
- Wrote `checks/seed-status.mjs` — a hand-rolled frontmatter parser (not a YAML library, because
  this corpus deliberately is not strict YAML) that enforces the status vocabulary and
  `absorbed_by` referential integrity against `.planning/REQUIREMENTS.md`, mutation-proven in
  both directions.
- Found and corrected one real over-claim in the carried-forward disposition table: item 7 said
  "Nyquist coverage (117/119) closed," but Phase 117's own `117-VALIDATION.md` records a
  still-open, deliberately-accepted gap (the container-name liveness-dot join). Phase 119 alone
  closed on 2026-08-27 (`7a782bfa`); Phase 117 did not.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-derive the status of all nine seeds and write the verdict ledger** — `bbfa1a0b`
   (docs)
2. **Task 2: Apply the verdicts to the seed files and guard the vocabulary** — `0aa7e2e7` (feat)
3. **Task 3: Verify the carried-forward dissolution, row by row (RECON-03)** — `6e14986c` (docs)

_No TDD tasks in this plan — all three are `type="auto"` re-derivation/documentation tasks._

## Files Created/Modified

- `.planning/phases/128-planning-reconciliation/128-SEED-RECONCILIATION.md` — Method, nine-row
  seed-verdict table, `## Findings (D-05)`, nine-row carried-forward audit, closing statement.
- `.planning/phases/128-planning-reconciliation/checks/seed-status.mjs` — vocabulary +
  `absorbed_by` referential-integrity checker; exits non-zero if seeds parsed is zero or resolved
  `absorbed_by` count is zero (the paired non-zero control).
- `.planning/seeds/SEED-002-mission-control-jobs-board.md` — `dormant` → `absorbed` (BOARD-01/02/03),
  documented PARTIAL.
- `.planning/seeds/SEED-003-cache-aware-cost-pricing.md` — `dormant` → `absorbed` (COST-04/05/06),
  full coverage.
- `.planning/seeds/SEED-004-project-lifecycle-cockpit.md` — `dormant` → `absorbed`
  (COCKPIT-01..06), full coverage.
- `.planning/seeds/SEED-005-seidr-suite.md` — `dormant` → `shipped` (v14.0 Phases 116-119, all
  `Complete`).
- `.planning/seeds/SEED-006-wcag-contrast-remediation.md` — `dormant` → dual `shipped` +
  `absorbed_by` (A11Y-03/04/05).
- `.planning/seeds/SEED-007-mission-emitter-revival.md` — `dormant` → dual `shipped` (submittedAt
  half only) + `absorbed_by` (BOARD-01/02), with the three still-open gaps documented in prose.
- `.planning/REQUIREMENTS.md` — carried-forward table item 7 corrected; no other lines touched
  (`git diff` confirmed confined to that one row).

## Decisions Made

- **SEED-002 recorded PARTIAL absorption, not full.** BOARD-01/02/03 cover the live-board,
  humanized-tool-activity, and HITL-confirm-card thirds of the seed. Squad grouping ("phase two,
  astridr MC-2") and the self-critique `{critique, follow_up}` "deploy follow-up" card have no
  requirement anywhere in v16.0. Per this plan's own T-128-08 mitigation, this is recorded as a
  finding rather than rounded up to full absorption — those two pieces remain genuinely unscoped.
- **SEED-006 given a dual `shipped` + `absorbed_by` status**, decided against the seed's OWN scope
  text (a 4-theme x 5-page / 20-cell matrix, matching `e2e/theme-contrast.spec.ts`'s scope at
  planting time) rather than the broader accessibility topic. That 20-cell scope shipped in full
  (v15.0 Phases 122/123, 0 violations across all 20 criterion cells). The seed's own "measure
  everything, size the fix" instruction was only partially executed — Phase 122 sampled 5 of 47
  routes — so the wider-app remainder is `absorbed_by: [A11Y-03, A11Y-04, A11Y-05]`.
- **SEED-007's `shipped` status is scoped narrowly to the submittedAt fix alone**, not the whole
  "repair half" D-09's table implied. Re-reading `convex/runtimeIngest.ts`'s live `subagent_job`
  case handler and `convex/subagentJobs.ts` directly (rather than trusting the commit message)
  showed two of the seed's three named emitter gaps (non-terminal states, the tool-correlation
  key) plus D-11 (retention binding) and D-12 (bounding `listRecent`) are all still open and
  covered by no v16.0 requirement. Recorded in the seed file's own prose so Phase 146/147 planners
  inherit the caveat.
- **Carried-forward item 7 corrected in place**, not silently — the table now states both what
  closed (Phase 119, `7a782bfa`) and what did not (Phase 117's accepted, named, still-open gap),
  citing `117-VALIDATION.md`'s own "PARTIAL, improved" verdict rather than overriding it.

## Deviations from Plan

None — plan executed exactly as written. The three findings above (SEED-002, SEED-006, SEED-007)
and the one carried-forward correction (item 7) are the plan's OWN explicit purpose (D-04/D-05
re-derivation), not unplanned work — the plan's Task 1/Task 3 instructions anticipated exactly
this shape of outcome ("If your verdicts match D-09 exactly on all nine, say so explicitly... a
silent match is indistinguishable from a copied table" / "Where a claim does not hold, do NOT
quietly fix the table. Record the finding with evidence").

## Mutation Proofs (Task 2 acceptance criterion)

Both run and recorded, in order, against the live checker:

**(a) Fabricated `absorbed_by` ID.** Temporarily changed SEED-003's `absorbed_by` from
`[COST-04, COST-05, COST-06]` to `[COST-04, COST-05, NOPE-99]`. Checker output:
```
FAIL:
  - SEED-003-cache-aware-cost-pricing.md: absorbed_by lists "NOPE-99", which does not appear in .planning/REQUIREMENTS.md
EXIT=1
```
Restored to the exact original string (re-edit, not `git checkout`).

**(b) Out-of-vocabulary status.** Temporarily changed SEED-004's `status: absorbed` to
`status: pending`. Checker output:
```
FAIL:
  - SEED-004-project-lifecycle-cockpit.md: status "pending" is outside the vocabulary {dormant, shipped, absorbed, resolved}
EXIT=1
```
Restored to the exact original string.

**Reconfirmed exit 0** after both restores:
```
seeds parsed: 9
status counts: {"shipped":4,"absorbed":3,"resolved":1,"dormant":1}
absorbed_by IDs resolved: 17
OK — vocabulary valid, absorbed_by referential integrity holds, non-zero controls satisfied.
```
`git diff .planning/seeds/SEED-003-cache-aware-cost-pricing.md .planning/seeds/SEED-004-project-lifecycle-cockpit.md`
after the restores contains no trace of `NOPE` or `pending` — confirmed both files returned
byte-identical to their post-Task-2 state before staging.

## Issues Encountered

None. The only friction was the Task 1 verification script's ID-pattern regex initially matching
a stray `A11Y-02` reference in the ledger's prose (a v15.0 requirement, not present in the v16.0
`.planning/REQUIREMENTS.md` this script checks against) — reworded the sentence to avoid citing
the bare ID pattern while keeping the same evidence, and the script passed clean.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

`/gsd-new-milestone`'s seed scan can no longer re-propose SEED-002/003/004/005/006/007 as new
work — all six now read `absorbed` or `shipped` rather than `dormant`. Only SEED-001 (`shipped`,
unchanged), SEED-008 (`resolved`, unchanged) and SEED-009 (`dormant`, confirmed still
untriggered) remain outside the absorbed/shipped set, and SEED-009's own text already explains
why it should stay dormant. `checks/seed-status.mjs` is available for any later phase or CI step
that wants to re-verify this corpus stays internally consistent as new seeds are planted.

Two follow-on caveats worth carrying into the phases that inherit affected requirements, neither
requiring action from this plan:
- **BOARD-01/Phase 146** inherits SEED-007's undocumented dependency on astridr shipping
  non-terminal `queued`/`running` states — today's live board would render honest-but-incomplete
  data without that emitter work, which no v16.0 requirement currently tracks.
- **Phase 117 (Bifröst)** has one open, accepted, cosmetic gap (the liveness-dot join) that no
  v16.0 requirement currently owns either — flagged in `128-SEED-RECONCILIATION.md`'s
  carried-forward audit item 7, not re-scoped here per this plan's explicit "do not re-scope"
  constraint.

---
*Phase: 128-planning-reconciliation*
*Completed: 2026-08-27*

## Self-Check: PASSED

- FOUND: `.planning/phases/128-planning-reconciliation/128-SEED-RECONCILIATION.md`
- FOUND: `.planning/phases/128-planning-reconciliation/checks/seed-status.mjs`
- FOUND: `.planning/phases/128-planning-reconciliation/128-03-SUMMARY.md`
- FOUND commit `bbfa1a0b` (Task 1)
- FOUND commit `0aa7e2e7` (Task 2)
- FOUND commit `6e14986c` (Task 3)
- FOUND commit `2afb59bd` (this SUMMARY)
