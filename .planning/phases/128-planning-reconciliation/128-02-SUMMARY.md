---
phase: 128-planning-reconciliation
plan: 02
subsystem: planning
tags: [gsd, todo-reconciliation, requirements-drift, evidence]

# Dependency graph
requires:
  - phase: 128 plan 01
    provides: the 5 sibling todo files (folded/already-fixed) this plan does not own
provides:
  - 128-TODO-OPEN-EVIDENCE.md, a 13-row re-derivation ledger (evidence, verdicts, D-05 findings)
  - 3 todos closed to .planning/todos/completed/ (inbox undercount, polish-geometry cold-page, sidebar overflow)
  - 10 todos left open, each with a dated Re-derivation section and live file:line evidence or a D-07 deferral
  - checks/open-todos.mjs, a mutation-proven structural guard on pending-todo evidence
affects: [phase-129, phase-130, phase-131, phase-132, phase-133, phase-136, phase-138]

# Tech tracking
tech-stack:
  added: []
  patterns: ["evidence ledger per re-derivation pass", "D-07 live-measurement deferral with named owning phase"]

key-files:
  created:
    - .planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md
    - .planning/phases/128-planning-reconciliation/checks/open-todos.mjs
    - .planning/todos/completed/inbox-page-undercounts-held-behind-200-cap.md
    - .planning/todos/completed/polish-geometry-spec-measures-cold-page.md
    - .planning/todos/completed/sidebar-4px-horizontal-overflow-separator.md
  modified:
    - .planning/todos/pending/a11y-02-widened-scan-42-route-backlog.md
    - .planning/todos/pending/alert-rules-engine-rows-overlap.md
    - .planning/todos/pending/forge-analytics-visual-polish.md
    - .planning/todos/pending/forge-job-list-column-clips-card-rows.md
    - .planning/todos/pending/ideationrow-text-white-raw-palette-class.md
    - .planning/todos/pending/kg-answer-sync-glxy02-test-flake.md
    - .planning/todos/pending/phase-state-missing-array-never-encodes-ui-spec.md
    - .planning/todos/pending/public-repo-exposes-user-path-and-operational-posture.md
    - .planning/todos/pending/test-isolation-full-suite-only-failures.md
    - .planning/todos/pending/vitest-suite-nondeterministic-one-random-failure-per-run.md

key-decisions:
  - "Task 1's own title said 'eight statically-settleable todos' but its own table/read_first name seven (Yes=6, Partly=1) — produced the actual population (7) rather than forcing an eighth; total row count (13) is unaffected"
  - "Flake family: REQUIREMENTS.md says 4 filings are one family; 3 are filed in this repo (the 4th lives in astridr-repo). Of the 3, kg-answer-sync-glxy02 and vitest-suite-nondeterministic name the SAME KnowledgeGraph GLXY-02 failure from two vantage points; test-isolation is a genuinely different AvatarAura.browser failure. Each still gets its own ledger row and file update (checker is per-file)"
  - "a11y-02-widened-scan-42-route-backlog verdict SPLIT: the ownership half (A11Y-03 now owns the triage) is settled by reading REQUIREMENTS.md; the population half (does 96/966 still hold) requires a live axe re-scan and is deferred to Phase 133 per D-07 — the todo stays open either way"

requirements-completed: [RECON-01]

# Metrics
duration: ~55min
completed: 2026-08-27
---

# Phase 128 Plan 02: Todo Re-Derivation (non-128-01 pending todos) Summary

**Re-derived all 13 non-128-01 pending todos against live code: 3 were already fixed by Phase 126
(and REQUIREMENTS.md was found stale on all three), 4 remain genuinely open with fresh file:line
evidence, 1 splits into a settled ownership half and a deferred population half, and 6 (3 visual, 3
flake filings) are recorded as explicit D-07 live-measurement deferrals rather than guessed at.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-27
- **Tasks:** 3 (Task 1: 7 statically-settleable verdicts; Task 2: 6 deferrals; Task 3: apply to
  todo files + build the structural guard)
- **Files modified:** 15 (1 ledger created, 1 checker script created, 3 todos moved
  pending→completed, 10 todos updated in place)

## Accomplishments

- Wrote `128-TODO-OPEN-EVIDENCE.md`, a 13-row evidence ledger with `## Method`, `## Verdicts`,
  `## Findings (D-05)`, and `## Live-measurement gaps` sections, every citation resolving to a
  real file:line in this worktree.
- Found 3 todos ALREADY FIXED and closed them to `.planning/todos/completed/` with a `##
  Resolution (128-02, ...)` section each: the inbox Held-tab undercount (Phase 126 SWEEP-01/03,
  `convex/inbox.ts`'s `countHeldUnacked`), the `polish-geometry.spec.ts` cold-page measurement
  (Phase 126-04 SWEEP-07's settle-and-agree loop), and the sidebar's 4px horizontal-overflow
  separator (Phase 126-04 SWEEP-06's wrapper-padding fix).
- Found and recorded 3 D-05 findings: `REQUIREMENTS.md`'s `FIX-03`, `FIX-05`, and `FIX-09` all
  still read `- [ ]` (Pending) and describe defects that are, per the code, already fixed —
  REQUIREMENTS.md itself has drifted, which is exactly this phase's own theme.
- Confirmed 4 todos genuinely STILL OPEN with fresh evidence (`ideationrow`'s raw `text-white`,
  `phase-state.json`'s constant-`missing`-array mechanism, the public-repo posture decision, plus
  the `a11y-02` SPLIT's ownership half) and 6 as D-07 deferrals (3 visual, 3 flake filings — none
  presented with a code citation as if it proved the defect's live presence).
- Verified all 13 filed `resolves_phase` values against `.planning/REQUIREMENTS.md`'s
  Traceability table — zero disagreements; nothing needed correcting.
- Built `checks/open-todos.mjs`: parses ROADMAP.md's Progress table for real phase numbers (never
  hardcoded), requires `id`/`status`/`resolves_phase`/`last_reviewed` frontmatter plus a dated
  `## Re-derivation (Phase 128` section carrying either a resolvable `path:line` or a valid
  `REQUIRES LIVE MEASUREMENT — deferred to Phase NNN` line, defaults to this plan's 13 files, and
  reports every other pending todo (including plan 128-01's 5) as a non-fatal ADVISORY line.
  Mutation-proven in both directions (bad `resolves_phase`; missing heading), both restored by
  re-editing the exact string, never `git checkout`.

## Task Commits

1. **Task 1 + Task 2: Re-derive 13 todos, write evidence ledger** - `7a938617` (docs)
2. **Task 3: Apply verdicts to todo files, build + mutation-prove the structural guard** -
   `553c499b` (docs)

_Note: the evidence ledger for both statically-settleable (Task 1) and D-07-deferred (Task 2)
verdicts was written in a single pass/commit since both tasks populate the same file; Task 3's
per-file updates and the checker are a separate, later commit._

## Files Created/Modified

- `.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md` — the 13-row
  re-derivation ledger.
- `.planning/phases/128-planning-reconciliation/checks/open-todos.mjs` — structural guard,
  mutation-proven.
- `.planning/todos/completed/inbox-page-undercounts-held-behind-200-cap.md` — closed (already
  fixed).
- `.planning/todos/completed/polish-geometry-spec-measures-cold-page.md` — closed (already
  fixed).
- `.planning/todos/completed/sidebar-4px-horizontal-overflow-separator.md` — closed (already
  fixed).
- 10 files under `.planning/todos/pending/` — each gained a dated `## Re-derivation (Phase 128,
  2026-08-27)` section and an updated `last_reviewed` frontmatter field;
  `vitest-suite-nondeterministic-one-random-failure-per-run.md` additionally had its frontmatter
  normalized to carry the same key set as its siblings.

## Decisions Made

- **Corrected a miscount in the plan's own task framing** (documented in the ledger's `##
  Method`): Task 1's title said "eight statically-settleable todos," but its own table and
  `<read_first>` list name seven (`Yes`=6, `Partly`=1). Produced the population the table actually
  names (7) rather than forcing an eighth row — the total (13) and every downstream acceptance
  criterion are unaffected, since the checker counts files, not table rows.
- **Flake-family count, stated rather than assumed**: `REQUIREMENTS.md` calls the flake family
  "four separate filings"; three are filed in this repo. Within those three,
  `kg-answer-sync-glxy02-test-flake.md` and `vitest-suite-nondeterministic-one-random-failure-per-run.md`
  both describe the SAME `KnowledgeGraph.test.tsx` GLXY-02 failure from two different observation
  contexts — likely one defect filed twice, not two independent ones — while
  `test-isolation-full-suite-only-failures.md` is a genuinely different `AvatarAura.browser`
  failure. All three still get their own ledger row and file update, since Task 3's checker
  operates per pending-todo-file.
- **`a11y-02-widened-scan-42-route-backlog.md` verdict is SPLIT, not a single disposition**: the
  claim that A11Y-03 now owns the triage is settled by reading `REQUIREMENTS.md` (it does); the
  claim that the 96-object/966-node figure still holds today cannot be settled by reading code at
  all and is deferred to Phase 133 per D-07. The todo stays in `pending/` either way, since D-06
  requires evidence to CLOSE a todo and the population half has none.

## Deviations from Plan

None that changed scope or required a checkpoint — the corrections below are documentation
precision, not Rule 1-4 auto-fixes, since this plan performs no code changes.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ledger citations initially failed the automated verify script's dead-path check**
- **Found during:** Task 1/2 self-verification (running the plan's own `<verify>` node script
  against the freshly-written ledger)
- **Issue:** Several citations were written as bare `REQUIREMENTS.md:NNN` or `DashboardLayout.tsx:NNN`
  (readable in prose, but not resolvable relative to the repo root the checker resolves against)
  instead of the full relative path.
- **Fix:** Regex-normalized every bare citation to its full relative path
  (`.planning/REQUIREMENTS.md:NNN`, `src/layouts/DashboardLayout.tsx:NNN`).
- **Files modified:** `.planning/phases/128-planning-reconciliation/128-TODO-OPEN-EVIDENCE.md`
- **Verification:** Re-ran the plan's own `<verify>` node script; `dead: []`, `citedPaths=10`.
- **Committed in:** `7a938617` (Task 1+2 commit — caught before commit, not a separate fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, citation-path precision, caught pre-commit)
**Impact on plan:** None on scope or substance — the underlying evidence and verdicts were
unchanged; only the citation format was corrected so the automated checker could resolve them.

## Issues Encountered

None. All three named source files for the "known already-fixed by scoping sweep" expectation
(inbox undercount, sidebar overflow, polish-geometry) were genuinely re-derivable from code with
clear, unambiguous evidence — no case required a judgment call between "fixed" and "not fixed."

## Todos Closed: 3 of 13 (not zero)

Stating explicitly per the plan's own instruction: **3 of the 13 todos this plan owns were closed
as ALREADY FIXED** (`inbox-page-undercounts-held-behind-200-cap.md`,
`polish-geometry-spec-measures-cold-page.md`, `sidebar-4px-horizontal-overflow-separator.md`), all
three by Phase 126 work that landed after each was filed. This is not "checked and all still
open" — it is "checked, and the code had already moved."

## Mutation-Proof Runs (both, recorded verbatim)

**(a) Bad `resolves_phase`:** mutated `ideationrow-text-white-raw-palette-class.md`'s frontmatter
`resolves_phase: 131` → `resolves_phase: 999`, ran the checker:
```
FAIL: 1 in-scope todo(s) did not satisfy the evidence-or-deferral rule:
  - ideationrow-text-white-raw-palette-class.md: resolves_phase '999' has no matching row in ROADMAP.md's Progress table
EXIT=1
```
Restored by re-editing the exact string back to `131` (never `git checkout`).

**(b) Missing `## Re-derivation` heading:** mutated
`public-repo-exposes-user-path-and-operational-posture.md`'s heading to
`## MUTATED-HEADING-FOR-PROOF (Phase 128, 2026-08-27)`, ran the checker:
```
FAIL: 1 in-scope todo(s) did not satisfy the evidence-or-deferral rule:
  - public-repo-exposes-user-path-and-operational-posture.md: no '## Re-derivation (Phase 128' section
EXIT=1
```
Restored by re-editing the exact string back to `## Re-derivation (Phase 128, 2026-08-27)`.

**Post-restore confirmation:** re-ran the checker after both restores — `evidence-backed: 3,
deferrals: 7, failed: 0, PASS, EXIT=0` — byte-identical to the pre-mutation clean run.

## D-05 Findings (disagreements with REQUIREMENTS.md's prose)

Full detail in the ledger's `## Findings (D-05)` section. Summary: `FIX-03`, `FIX-05`, and
`FIX-09` in `.planning/REQUIREMENTS.md` all still read `- [ ]` (Pending) and describe present-tense
defects that the corresponding todo's code re-derivation shows are already fixed (all three by
Phase 126). Not fixed here — `REQUIREMENTS.md` is outside this plan's `files_modified` and Task
3's scope is the todo files only. Recorded so Phases 130/131/132 (the owning phases for
FIX-03/05/09 respectively) do not re-derive the same population from scratch.

No disagreements were found with any filed `resolves_phase` value — all 13 matched
`.planning/REQUIREMENTS.md`'s Traceability table exactly.

## Threat Flags

None. This plan touches only `.planning/**` markdown and one new `.mjs` checker script; no new
network endpoint, auth path, file-access pattern, or schema surface was introduced. The
`checks/open-todos.mjs` script reads files under `.planning/` only and takes no untrusted input
(argv is developer-controlled, used only to select a scope subset).

## Next Phase Readiness

- Phases 130 (FIX-03), 131 (FIX-04/05/06/07/08), 132 (FIX-09), 133 (A11Y-03), 136 (FLAKE-01/02),
  and 138 (GATE-01/02) each inherit a todo with either closed status, live evidence, or a named
  live-measurement gap — no phase needs to re-derive from scratch.
- Phases 130/131/132 should additionally flip `FIX-03`/`FIX-05`/`FIX-09` from Pending to Complete
  in `REQUIREMENTS.md` as part of their own close, per the D-05 findings above — this plan
  deliberately did not touch `REQUIREMENTS.md`.
- No blockers. Plan 128-01 (the sibling plan in the same wave) owns 5 other pending todo files not
  touched here; `checks/open-todos.mjs` reports those as non-fatal ADVISORY lines and does not
  depend on plan 128-01's completion to pass.

---
*Phase: 128-planning-reconciliation*
*Completed: 2026-08-27*

## Self-Check: PASSED

- All 6 created files verified present on disk (`ls` confirmed each individually).
- Both task commit hashes (`7a938617`, `553c499b`) verified present in `git log --oneline --all`.
- No missing items.
