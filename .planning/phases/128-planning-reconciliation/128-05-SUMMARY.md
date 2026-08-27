---
phase: 128-planning-reconciliation
plan: 05
subsystem: testing
tags: [ci, github-actions, vitest, git-ancestry, ratchet]

# Dependency graph
requires:
  - phase: 128-planning-reconciliation
    provides: "src/requirementsDrift.ratchet.test.ts's stalePartialOffenders mechanism (128-04)"
provides:
  - "CI checkout with full git history (fetch-depth: 0) so the ratchet's ancestry comparison can resolve in CI, not just on a developer machine"
  - "Real, commit-backed red/green proof that the RECON-04 mechanism reaches the live .planning/REQUIREMENTS.md and .planning/ROADMAP.md files, not just the fake-oracle fixtures 128-04 built"
affects: [129, 130, 131, 132, 133, 134, 135, 136, 137, 138]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proving a git-history-bisecting function against real files requires a real (throwaway) commit, not just a working-tree edit — completionCommitFor reads git log/git show, never the working tree"
    - "Undo a throwaway proof commit with `git reset --soft <prior HEAD>` plus an explicit `git reset <prior HEAD> -- <paths>` to resync the index (soft reset alone leaves the index at the pre-reset tree, producing a false positive diff against working tree)"

key-files:
  created:
    - .planning/phases/128-planning-reconciliation/128-RATCHET-EVIDENCE.md
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Chose the plan's own Task 1 commit (ee6ac6b5) as the ANCESTOR stamp and a fresh empty commit as its child as the DESCENDANT stamp, rather than searching for pre-existing repo commits with the right relationship — this makes the ancestry relationship unambiguous by construction and verifiable with a single is-ancestor call each way."
  - "Committed only .planning/ROADMAP.md's mutation (never .planning/REQUIREMENTS.md's) as the throwaway completion commit, since collectRequirements() reads REQUIREMENTS.md from the working tree directly and never needs a commit to be visible to the check."

requirements-completed: [RECON-04]

# Metrics
duration: ~12min
completed: 2026-08-27
---

# Phase 128 Plan 05: RECON-04 CI Reachability and Live Mutation Proof Summary

**Gave CI's checkout `fetch-depth: 0` so the RECON-04 ancestry check can run there, then proved
the mechanism fires against the real `.planning/REQUIREMENTS.md`/`ROADMAP.md` files with a real,
commit-backed red/green mutation — not just the fake-oracle fixtures 128-04 shipped.**

## Performance

- **Duration:** ~12 min of committed work — 11m31s from first task commit `ee6ac6b5`
  (18:04:39-04:00) to final task commit `d18ebe9a` (18:16:10-04:00), or 14m13s to the branch
  tip `b3d1a8b7` (18:18:52-04:00). Exact wall-clock session start was not separately captured
  before file reads began, so this is a lower bound on total elapsed time, not a measurement
  of it.
  (CORRECTED 2026-08-27: this line originally read "~20 min" while citing those same two
  timestamps, which subtract to 11m31s. Found by the phase-128 adversarial claims audit.
  Nothing else in this SUMMARY depended on the figure.)
- **Tasks:** 2/2
- **Files modified:** 2 (`.github/workflows/ci.yml`, plus the new
  `128-RATCHET-EVIDENCE.md`)

## Accomplishments

- `.github/workflows/ci.yml`'s checkout step now carries `fetch-depth: 0` with a comment naming
  the ratchet, verified by a real YAML parse (`js-yaml`) rather than string matching, and by a
  shallow-vs-full clone control (`is-shallow-repository` reads `true` in a depth-1 clone of this
  worktree, `false` in the working repository).
- Proved `stalePartialOffenders` fires RED against a genuinely stale `Partial` row in the real
  `.planning/REQUIREMENTS.md` Traceability table, when the phase it maps to is really marked
  `Complete` in `.planning/ROADMAP.md`, using the unmodified real git-backed oracle
  (`execFileSync("git", ...)` against this repository, not a fake oracle).
- Proved the opposite control GREEN on the same real files, changing only the stamp SHA from an
  ancestor to a descendant of the same completion commit.
- Restored both mutated files to their exact pre-mutation byte content (SHA-256-verified) and
  reset the branch past the two throwaway commits the proof required, leaving no trace in the
  final branch history.

## Task Commits

1. **Task 1: Give the CI checkout the history the ancestry comparison needs** - `ee6ac6b5` (fix)
2. **Task 2: Live red/green mutation proof against the real planning files** - `d18ebe9a` (docs)

_Note: Task 2 also created and then discarded two throwaway commits
(`ea53c014478eacedb7a2728753db8f83eddf2f4a`, the completion-commit fixture, and
`e0847201ece76857bd69787597be6d24fcbba2cd`, an empty descendant marker) as part of the live
proof — see "Deviations from Plan" below. Neither is reachable from the final branch tip; both
are documented with their full SHAs in `128-RATCHET-EVIDENCE.md`._

## Files Created/Modified

- `.github/workflows/ci.yml` - Added `fetch-depth: 0` to the checkout step, with a comment naming
  `requirementsDrift.ratchet.test.ts` as the reason. The two sequential vitest steps and the
  pinned checkout SHA are byte-unchanged (`git diff -- .github/workflows/ci.yml` shows only the
  intended addition).
- `.planning/phases/128-planning-reconciliation/128-RATCHET-EVIDENCE.md` - New. Records the
  completion-commit resolution, both `is-ancestor` exit codes, the raw RED/GREEN/restore-verify
  vitest output, the byte-identical restore proof (SHA-256 before/after, diff against scratchpad
  copies, post-restore `git diff` equal to the empty pre-flight baseline), the CI reachability
  evidence, and the full sequential-suite result after restore.

## Decisions Made

- **Real commit required for the completion-commit resolution.** `completionCommitFor` in
  `src/requirementsDrift.ratchet.test.ts` bisects `.planning/ROADMAP.md`'s own **committed** git
  history (`git log --follow`, `git show <rev>:<path>`) — it never reads the working tree. A plain
  uncommitted edit to `ROADMAP.md`'s Phase 128 row is invisible to it. So proving a real
  completion-commit resolution (not a fake-oracle one) required actually committing the ROADMAP
  mutation, resolving the SHA it produced, then undoing the commit afterward. This is recorded in
  `128-RATCHET-EVIDENCE.md`'s "Completion commit resolution" section with the exact commands and
  verified boundary (`git show <completion>:.planning/ROADMAP.md` reads `Complete`; the
  immediately preceding revision does not).
- **`.planning/REQUIREMENTS.md` was never committed.** `collectRequirements()` reads it via
  `readFileSync` from the working tree regardless of git status, so the RECON-02 mutation stayed
  an uncommitted working-tree edit throughout both RED and GREEN, minimizing the git-history
  footprint of the proof to exactly what was structurally necessary (the ROADMAP completion
  commit and one empty descendant marker).

## Deviations from Plan

### Auto-fixed / discovered-during-execution

**1. [Rule 3 - Blocking, resolved without architectural change] The completion commit the
mutation creates could not be resolved from an uncommitted working-tree edit alone**
- **Found during:** Task 2, pre-flight for the live mutation proof
- **Issue:** The plan's action text says "resolve it first and print it, rather than assuming
  which commit that will be," which presupposes a resolvable completion commit exists once the
  mutation is made. But `completionCommitFor` is defined entirely in terms of git history
  (`git log`/`git show`), so a working-tree-only edit to `ROADMAP.md` (uncommitted) is invisible
  to it — `completionCommitFor(128)` would return `unresolvable` ("does not read Complete at the
  latest recorded ROADMAP.md revision"), not a resolved SHA, if the mutation were never committed.
- **Fix:** Committed only the `.planning/ROADMAP.md` mutation as a throwaway commit
  (`ea53c014478eacedb7a2728753db8f83eddf2f4a`), which became the real, verified completion commit
  (confirmed by direct inspection of `git show <sha>:.planning/ROADMAP.md`, independent of trusting
  the test's own bisect logic). Created a second throwaway empty commit
  (`e0847201ece76857bd69787597be6d24fcbba2cd`) as a real descendant of the completion commit, to
  serve as the GREEN step's descendant stamp (a real descendant was needed and none pre-existed,
  since the completion commit did not exist before this proof). Both commits were removed from
  the branch's reachable history afterward via `git reset --soft ee6ac6b5` (this plan's own Task 1
  commit, the HEAD immediately before the mutation began) plus an explicit
  `git reset ee6ac6b5 -- .planning/REQUIREMENTS.md .planning/ROADMAP.md` to resync the index (a
  soft reset alone leaves the index at the pre-reset, mutated tree — the first restore check after
  the soft reset showed a false-positive diff for exactly this reason, caught and corrected before
  concluding the restore was complete).
- **Files affected:** `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` (both restored to
  byte-identical pre-mutation content, SHA-256-verified; see `128-RATCHET-EVIDENCE.md`'s "Restore
  proof" section).
- **Verification:** Post-restore SHA-256 of both files identical to pre-mutation SHA-256;
  `diff <scratchpad copy> <restored file>` empty for both; post-restore `git diff` and
  `git diff --cached` for both files empty, matching the (empty) pre-flight baseline;
  `git log --oneline -5` after restore shows neither throwaway commit; re-ran the ratchet test
  after restore — 23/23 passing, matching the environment's recorded baseline.
- **Committed in:** `d18ebe9a` (Task 2 commit — the evidence document recording all of this; the
  throwaway commits themselves were never part of any commit this plan retains)

**2. [Disclosed finding, not a defect] Marking the whole Phase 128 row `Complete` also triggers
the pre-existing, unrelated Pending-on-Complete check for RECON-01/03/04**
- **Found during:** Task 2, RED step
- **Issue:** The plan's fixture design mutates only `RECON-02` to `Partial`, but Phase 128 maps to
  four requirements (RECON-01 through RECON-04) in the live Traceability table. Marking the whole
  phase `Complete` (required to exercise the D-01 stale-Partial check at all, since it only fires
  when the row's phase reads `Complete`) also makes the file's older, pre-existing
  "no requirement sits at Pending while its phase is marked Complete" test fail for RECON-01,
  RECON-03, and RECON-04, which remained `Pending`. This is a real, correct firing of a DIFFERENT
  check in the same file — not a defect in `stalePartialOffenders`, not introduced by this plan's
  mutation logic, and not something to "fix" by also mutating RECON-01/03/04 (which the plan's
  action text did not ask for and would have expanded the mutation surface beyond "change ONLY
  the stamp").
- **Disposition:** Recorded as-is in `128-RATCHET-EVIDENCE.md`'s RED/GREEN raw output and
  explained explicitly in the "Collateral, disclosed rather than hidden" note, so it is not
  mistaken for a defect in the D-01 mechanism or for a failed restoration. Not fixed; not in
  scope; `src/requirementsDrift.ratchet.test.ts` was not touched (`git diff --stat -- src` is
  empty, confirmed).

---

**Total deviations:** 1 auto-resolved (Rule 3, execution-mechanics — required to get a real,
non-fake completion commit) + 1 disclosed finding (no fix required, out of scope).
**Impact on plan:** No scope creep. The RECON-04 mechanism itself
(`src/requirementsDrift.ratchet.test.ts`) was not modified. Both required deliverables
(`.github/workflows/ci.yml`, `128-RATCHET-EVIDENCE.md`) match the plan's must-haves.

## Issues Encountered

None beyond the two items above (both explained in "Deviations from Plan").

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RECON-04 is now fully closed: the mechanism exists (128-04), can compute ancestry in CI
  (this plan's Task 1), and is proven to reach the real planning files in both directions (this
  plan's Task 2).
- The live in-range `Partial` population in `.planning/REQUIREMENTS.md` remains **zero** (46/46
  rows `Pending`) — re-confirmed, not newly discovered. `128-RATCHET-EVIDENCE.md` states this
  plainly so a future reader does not mistake the ordinary green `npm test` run for evidence the
  mechanism discriminates; that evidence lives in 128-04's fake-oracle/same-day controls plus this
  plan's real-git mutation, not in the everyday run.
- No blockers for Phases 129+. `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and
  `src/requirementsDrift.ratchet.test.ts` are all in their pre-plan state (confirmed via git
  status and SHA-256), so no cleanup is owed to sibling plans or the orchestrator.
- Full unit suite after restore: 380 files / 5391 tests passed / 0 failed (matches the
  orchestrator-provided baseline exactly). Browser project: 3/3 passed (matches baseline).

## Self-Check: PASSED

- FOUND: `.github/workflows/ci.yml`
- FOUND: `.planning/phases/128-planning-reconciliation/128-RATCHET-EVIDENCE.md`
- FOUND: `.planning/phases/128-planning-reconciliation/128-05-SUMMARY.md`
- FOUND commit `ee6ac6b5` (Task 1) in `git log --oneline --all`
- FOUND commit `d18ebe9a` (Task 2) in `git log --oneline --all`

---
*Phase: 128-planning-reconciliation*
*Completed: 2026-08-27*
