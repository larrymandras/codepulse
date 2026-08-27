---
phase: 128-planning-reconciliation
plan: 04
subsystem: testing
tags: [vitest, ratchet, git, requirements-drift, RECON-04]

# Dependency graph
requires:
  - phase: 128-planning-reconciliation (plan 03)
    provides: the carried-forward REQUIREMENTS.md row this ratchet's population was measured
      against
provides:
  - stalePartialOffenders(reqs, phases, oracle) — oracle-injected, pure function that flags a
    Partial requirement cell whose freshness stamp predates its phase's completion commit
  - completionCommitFor(phase) — real-git bisect over ROADMAP.md's own revision history for the
    commit that flipped a phase's Progress row to Complete
  - inCurrentMilestoneRange(r, minRoadmapPhase, liveFile) — the current-milestone partition,
    extracted so the orphan check and the freshness check cannot silently disagree about scope
  - rewritten header comment in src/requirementsDrift.ratchet.test.ts recording the
    completion-commit definition, stamp syntax, cross-phase blind spot, grandfathering decision,
    and current vacuity
affects: [128-05, any later phase closing a requirement as Partial]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Oracle-injected pure function over git state, so fake-oracle unit tests can drive branches
      a real 0-population table cannot exercise"
    - "Real-git temp-repo fixture (mkdtempSync under os.tmpdir, per-invocation -c user.name/
      user.email/commit.gpgsign, cleaned in finally) for a property (same-calendar-day
      non-ordering) a fake oracle cannot model"
    - "Shared range-partition helper called by two checks in the same file, replacing an inline
      duplicate"

key-files:
  created: []
  modified:
    - src/requirementsDrift.ratchet.test.ts

key-decisions:
  - "Completion-commit definition = the commit that flipped ROADMAP.md's Progress row to
    Complete (bisected over .planning/ROADMAP.md's own git history), not the phase's last
    *-SUMMARY.md commit — matches D-03a's requirement that the planner's chosen definition be
    named in the failure message, and keeps both checks in this file keyed on the same notion of
    'complete'."
  - "stalePartialOffenders takes 3 args (reqs, phases, oracle) and does not filter by
    current-milestone range itself — callers pre-filter via inCurrentMilestoneRange, mirroring
    how the orphan check already owns its own range filtering."
  - "Combined Task 1's 'add a live assertion' requirement and Task 2's 'pair the live assertion
    with a stale-fixture control' requirement into ONE test rather than two near-duplicates,
    since Task 2's action explicitly describes adding one combined test."
  - "Mutation-proofing (inverted ancestry direction; date-comparison substitution in
    gitIsAncestor) was executed as a manual, reverted verification pass, not committed as
    permanent test code — the plan's own wording ('restore after each ... record in the summary')
    describes exactly that shape, and the production oracle has no date-bearing abstraction for a
    permanent date-mutation test to attach to for the fake-oracle cases."
  - "Deviation from the plan's own 'you do not commit' standing constraint: committed per-task per
    the harness's worktree-isolated execution protocol (SUMMARY.md must be committed before
    return, or it is lost when the worktree is force-removed). See Deviations below."

requirements-completed: [RECON-04]

# Metrics
duration: not precisely measured — start timestamp was not captured at session start (deviation
  noted below); the working session spanned roughly 25-35 minutes of tool-call activity
completed: 2026-08-27
---

# Phase 128 Plan 04: Stale-Partial Freshness Ratchet Summary

**Oracle-injected SHA-ancestry freshness check added to `requirementsDrift.ratchet.test.ts`, catching a `Partial` cell that predates its phase's completion commit — including the same-calendar-day case a date comparison would silently pass — while still refusing to judge whether `Partial` is the correct disposition.**

## Performance

- **Duration:** not precisely measured (see Deviations)
- **Completed:** 2026-08-27
- **Tasks:** 2/2
- **Files modified:** 1 (`src/requirementsDrift.ratchet.test.ts`)

## Accomplishments

- `stalePartialOffenders(reqs, phases, oracle)`: pure, oracle-injected function comparing a
  `re-derived <sha>` stamp against a phase's completion commit by git ancestry only. Six distinct
  offender conditions (shallow repo, missing stamp, unresolvable stamp SHA, unresolvable
  completion commit, STALE ancestor, unrelated history), each with its own message; two
  non-offender ancestry outcomes (equal, descendant) handled as explicit branches rather than a
  fallthrough negative.
- `completionCommitFor(phase)`: bisects `.planning/ROADMAP.md`'s own git revision history for the
  commit that flipped a phase's Progress row to `Complete`, with a monotonicity guard that
  returns `unresolvable` (naming why) rather than guessing when the flip predates recorded
  history or is absent at the latest revision.
- 11-case fake-oracle logic table (`describe("D-01 fake-oracle logic table")`) covering every
  offender branch plus the D-03 opposite-control (a fresh Partial must stay green), plus one
  supplementary case for the range-partition helper.
- Real-git same-day fixture (`mkdtempSync` under `os.tmpdir()`, two commits on the same calendar
  day with explicit `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`): proves the earlier same-day stamp is
  flagged STALE and the later same-day stamp passes, and separately demonstrates that a
  day-granularity date comparison of the same two commits cannot order them at all — the specific
  defect D-03a exists to close.
- Rewrote the file's header comment (D-02): no longer claims the file "does not police `Partial`"
  as a blanket statement; instead states what changed, the stamp syntax, the chosen
  completion-commit definition and why, the cross-phase blind spot, the measured grandfathering
  population, and the current vacuity.
- Extracted the current-milestone range partition (previously inline in the orphan check) into
  `inCurrentMilestoneRange(r, minRoadmapPhase, liveFile)`, now called by both the orphan check and
  the new live freshness assertion.
- Extended `REQ_ROW`/`Req` to carry the full status cell (`statusCell`) alongside the existing
  first-word `status` field, and `PHASE_ROW`/`PhaseInfo` to carry the `Completed` date column,
  explicitly marked diagnostic-only in a comment (never the freshness comparison input).
- Added a real-git correctness check of `completionCommitFor`'s bisect against Phase 120 (a
  known-Complete phase from v15.0), since the live population-zero table gives the bisect no
  other exercise: asserts the resolved commit reads Complete and the immediately preceding
  ROADMAP revision does not.

## Task Commits

1. **Tasks 1+2 (combined): SHA-ancestry freshness check, controls, header rewrite** —
   `d8f0377b` (feat) — see Deviations for why these landed as one commit rather than two.

**Plan metadata:** SUMMARY commit (this document) — separate commit, to follow.

## Files Created/Modified

- `src/requirementsDrift.ratchet.test.ts` — extended from 177 lines / 4 tests to 873 lines / 19
  tests. All 4 pre-existing tests preserved unweakened (one call-site updated for the `PhaseInfo`
  object return type; no assertion loosened).

## Measurements (re-derived live, per D-04 — not inherited from the plan's own numbers)

- **Live Traceability table (`.planning/REQUIREMENTS.md`):** `grep -cE` confirms **46** rows
  matching the `| ID | Phase N | Status |` shape, and a negated grep for anything not ending
  `Pending |` returned **zero** hits — all 46 rows are `Pending`. Matches the plan's stated
  measurement exactly.
- **`Partial` rows in the corpus (CORRECTED 2026-08-27):** there are TWO, not one. The
  `.planning/milestones/v14.0-REQUIREMENTS.md`, mapped to Phase 111. `grep -n "| 111\."
  .planning/ROADMAP.md` returns nothing (Phase 111 is not in the live ROADMAP.md — it lives only
  in the archived `milestones/v14.0-ROADMAP.md`), so `phases.get(111)` is `undefined` in the live
  run: this row is excluded both by `inCurrentMilestoneRange` (phase 111 < current milestone's
  minimum of 128, and its file is not the live `REQUIREMENTS.md`) and, independently, by
  `stalePartialOffenders`'s own `phaseInfo.status !== "Complete"` guard.

  The second is `QA-01` at `.planning/milestones/v8.0-REQUIREMENTS.md:155`, mapped to
  Phase 71, written `🔄 Partial` (emoji-prefixed). This SUMMARY and the file's own
  GRANDFATHERING header both originally claimed `MISSION-01` was the only one; that was
  FALSE, found by the phase-128 adversarial claims audit.

  It mattered beyond the miscount. `status` was parsed as `statusCell.split(/\s+/)[0]`,
  which for that row returned the EMOJI rather than `Partial`, so the row was invisible to
  every `Partial` predicate in the file instead of being seen and ruled out of range. A row
  that silently vanishes is the failure mode this check exists to prevent. Fixed by a
  `statusWord()` helper that strips leading decoration before taking the first word, with 4
  new tests including a regression case pinned to the real QA-01 line. Mutation-proven:
  reverting `statusWord` to the naive split turns exactly 3 of those 4 red, while the
  "undecorated cells unchanged" control stays green in both directions.

  The in-range population is still 0 — Phase 71 is out of range exactly as Phase 111 is —
  so no verdict in this plan changes. What changed is that the exclusion is now by rule
  rather than by accident.
- **In-range `Partial` population: 0.** Grandfathering decision: no allowlist added; there is
  nothing to grandfather. This is recorded in the rewritten header.
- **v16.0 Progress table start:** Phase 128 (`Math.min(...phases.keys())` resolves to 128 live),
  confirmed by reading `.planning/ROADMAP.md`'s `## Progress` section directly.
- **ROADMAP.md revision count:** `git log --format=%H --reverse --follow -- .planning/ROADMAP.md`
  returns **470** revisions in this checkout, in 0.06s — the bisect in `completionCommitFor` runs
  in ~9-10 `git show` calls per phase, well inside the file's measured runtime budget.

## Verification Discipline — what was actually run, not just claimed

- `npx vitest run --project unit src/requirementsDrift.ratchet.test.ts` — **19/19 passed**, most
  recent run took **1.61s** (well under the 10s ceiling; the file's own `Duration` line in the
  vitest report also includes ~0.6-0.8s of unrelated environment/setup overhead vitest reports for
  every file in this project, not test execution time).
- `npx tsc --noEmit` — clean, no errors, run twice (once after implementation, once after mutation
  reverts).
- **D-03 opposite control (verified, not just claimed):** case 1 (strict-ancestor stamp) produces
  exactly 1 offender containing both SHAs and the word "stale"; case 2 (descendant stamp) with the
  IDENTICAL fixture shape but inverted `isAncestor` mock produces zero offenders.
- **Mutation-proof (a) — inverted ancestry direction**, applied directly to
  `stalePartialOffenders`'s `oracle.isAncestor(stampSha, completionSha)` call (swapped argument
  order): re-ran the full file. Result: **3 failed / 16 passed**. The 3 failures were exactly
  `case 1`, `case 2`, and the real-git same-day test — the three assertions whose correctness
  depends on the ancestry direction being right. All 11 other fake-oracle cases, both live tests,
  and `completionCommitFor`'s real-git correctness check stayed green. Reverted via `cp` from a
  pre-edit backup (not `git checkout`, since the file was uncommitted at the time); re-ran and
  confirmed 19/19 green, and diffed the restored file against the backup to confirm it was
  byte-identical before committing.
- **Mutation-proof (b) — date-comparison substitution**, applied directly to `gitIsAncestor`
  (replaced the `git merge-base --is-ancestor` call with `dayOf(a) < dayOf(b)` using
  `git show -s --format=%ad --date=format:%Y-%m-%d`): re-ran the full file. Result: **1 failed /
  18 passed**. The single failure was exactly the same-day fixture test — the fake-oracle cases
  supply their own `isAncestor` mocks and never call `gitIsAncestor`, so they were structurally
  unaffected, and the live tests never reach `oracle.isAncestor` at all while the in-range Partial
  population is zero. This is the single most load-bearing proof in the plan: it demonstrates
  live, on real commits, that the SHA-ancestry approach catches a same-day staleness case that a
  date comparison structurally cannot — the exact defect D-03a exists to prevent. Reverted the
  same way as (a); confirmed 19/19 green and byte-identical to the pre-mutation file before
  committing.
- Full unit suite after these changes: `npx vitest run --project unit` → **379 files passed, 1
  file failed (`EmailDigestConfig.test.tsx`, a 5000ms timeout), 5386 tests passed, 4 skipped, 195
  todo** out of 5586. Re-ran `EmailDigestConfig.test.tsx` in isolation: **2/2 passed in 306ms** —
  matches the documented one-in-N nondeterministic flake
  (`.planning/todos/pending/vitest-suite-nondeterministic-one-random-failure-per-run.md`), not a
  regression from this change. File count (379 + 1 flaky = 380) matches the stated baseline
  exactly; test count (5386 passed + 1 failed = 5387) equals the stated baseline of 5372 plus this
  plan's net +15 new tests (19 in the file now, 4 before).
- `npx vitest run --project browser` — **3/3 passed**, matching the stated baseline, run
  sequentially after the unit project (never concurrently), per this repo's own CLAUDE.md rule.
- `git status --porcelain -- src` after the commit shows nothing outstanding (exactly one file was
  modified across the whole session); `git diff --diff-filter=D --name-only HEAD~1 HEAD` shows no
  deletions in the commit.
- No date or string ordering appears anywhere in the freshness decision path — grep-verified: the
  only date-like literals in the file are the diagnostic `completedDate` field (explicitly marked
  never-compared) and the same-day test's own demonstration of why date comparison fails, which
  is asserted to FAIL to discriminate, not used to decide freshness.

## Decisions Made

- **Completion-commit definition:** the commit that flipped a phase's ROADMAP.md Progress row to
  `Complete` (bisected over ROADMAP.md's own git history), not the phase's last `*-SUMMARY.md`
  commit. Justification recorded in the file's rewritten header and named in every STALE offender
  message. This matches 128-CONTEXT.md's own reasoning exactly (it is the same predicate the
  Pending-on-Complete check already keys on; the SUMMARY-commit alternative is gameable and
  ill-defined for phases without a summary file).
- **`stalePartialOffenders` signature is 3 arguments** (reqs, phases, oracle), matching the plan's
  literal wording. Range filtering is the caller's responsibility via the newly shared
  `inCurrentMilestoneRange` helper, mirroring how the pre-existing orphan check already owns its
  own range filtering rather than baking a 4th/5th parameter into the pure function.
- **Combined Task 1's live-assertion requirement with Task 2's paired live+stale-fixture-control
  requirement into one test.** Task 2's own action text ("Finally add ONE test that binds the live
  assertion to a control in the same breath") describes this as a single test, so building two
  near-duplicate live assertions (one per task) would have been redundant rather than more
  faithful to the plan.
- **Added one test beyond the plan's explicit list:** a real-git correctness check of
  `completionCommitFor`'s bisect against Phase 120. The plan does not require this, but with the
  live in-range Partial population at zero, the bisect algorithm itself (as opposed to the
  fake-oracle-injected `completionCommitFor` used everywhere else) had no exercise at all without
  it — this closes that gap rather than shipping an unverified code path.

## Deviations from Plan

### 1. [Standing-constraint conflict, resolved in favor of the harness protocol] Committed to this repository despite the plan's "You do not commit" instruction

- **Found during:** before Task 1, while reading the plan's `<context>` block.
- **Conflict:** `128-04-PLAN.md`'s standing constraints state "You do not commit. No `git commit`,
  `git add`, or `git push` against this repository," with an explicit exception only for Task 2's
  throwaway temp-repo fixture commits. This was written assuming a non-worktree, shared-checkout
  execution model (the same section cites "SHARED CHECKOUT with a concurrent session" as its
  rationale).
- **Resolution:** the orchestrator's actual execution harness for this session runs this plan in
  an isolated git worktree (`worktree-agent-ae4edc791a3e9b251`), with explicit instructions that
  "Run `git commit` normally — hooks run by default," that each task must be committed atomically,
  and that SUMMARY.md must be committed before returning or it is permanently lost when the
  orchestrator force-removes the worktree. Under worktree isolation there is no shared-checkout
  race for a concurrent session to collide with — the concern the plan's constraint was written to
  address does not apply to how this session actually ran. I followed the harness's per-task
  commit protocol as the governing instruction for this execution context, per the standing
  precedence rule that direct orchestrator/harness instructions supersede a plan's own text when
  they conflict, and I am recording the conflict and its resolution here rather than silently
  picking one side.
- **Impact:** one commit exists in this worktree's history (`d8f0377b`) that would not exist under
  a strictly literal reading of the plan. Nothing in this repository's shared `master`/`origin`
  history is affected until the orchestrator merges this worktree's branch.

### 2. [Task-granularity, not a Rule 1-4 deviation] Tasks 1 and 2 landed in a single commit

- **Found during:** committing.
- **Reason:** the two tasks modify the exact same file in a tightly interleaved way — Task 2's
  fake-oracle and real-git tests exercise the exact function and header Task 1 defines, and I
  authored the complete extended file in one pass (implementing both tasks' scope together, then
  running Task 2's mutation-proof verification against the finished whole) rather than writing
  Task 1's slice, committing, then appending Task 2's slice as a second commit. Reconstructing a
  clean "Task 1 only" intermediate state after the fact via `git add -p` on a wholesale file
  rewrite would have been error-prone and would not have represented anything that was ever
  actually the working state during execution.
- **Impact:** `d8f0377b`'s commit message documents both tasks' scope explicitly rather than
  implying a false single-task boundary.

### 3. [Measurement gap, disclosed rather than fabricated] Duration not precisely measured

- **Found during:** writing this SUMMARY.
- **Issue:** the `record_start_time` step (`date -u +"%Y-%m-%dT%H:%M:%SZ"` captured before task
  execution) was not run at the start of this session. No exact start timestamp exists to compute
  duration against.
- **Resolution:** stated as "not precisely measured" in the frontmatter and Performance section
  rather than fabricating a precise figure, per this repo's own CLAUDE.md verification-discipline
  rule against reporting unmeasured numbers as if measured.

---

**Total deviations:** 3 — 1 standing-constraint conflict (resolved toward the harness protocol,
disclosed), 1 task-granularity note (no code impact), 1 measurement-gap disclosure (no code
impact).
**Impact on plan:** No scope creep. All code changes are exactly what Tasks 1 and 2 specify, plus
one additional real-git correctness test for `completionCommitFor` (noted above under Decisions,
not a deviation rule — it is additive verification, not unplanned functional scope).

## Known Stubs

None. This plan added no UI, no data-rendering components, and no hardcoded placeholder values.

## Threat Flags

None beyond what `128-04-PLAN.md`'s own `<threat_model>` already registers (T-128-11, T-128-13
through T-128-18, T-128-SC) — every mitigation named there was implemented as described (shallow
clone detection, unresolvable-SHA/unrelated-history offenders, the per-invocation `-c` git
identity scoping on the throwaway temp repo, the header-rewrite requirement). No new network
endpoint, auth path, file-access pattern, or schema change was introduced; the entire change is
confined to one Vitest file with no product code touched, exactly as the plan's threat model
states.

## Issues Encountered

None beyond the standing-constraint conflict documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `stalePartialOffenders` and `completionCommitFor` are ready for 128-05, which per this plan's
  `<objective>` owns the CI `fetch-depth: 0` fix (`.github/workflows/ci.yml` currently defaults to
  a shallow clone, which this plan's `isShallow()` offender path detects but does not fix) and the
  live mutation proof against a genuinely stale real Partial row (today's live population is zero,
  so 128-05's mutation proof will need to either inject a real stale row temporarily or rely on
  this plan's fake-oracle/real-git controls as the discrimination evidence).
- No blockers. The file's runtime (1.6s for this file; the full unit suite's real regression, the
  `EmailDigestConfig` flake, is pre-existing and unrelated).

---
*Phase: 128-planning-reconciliation*
*Completed: 2026-08-27*
