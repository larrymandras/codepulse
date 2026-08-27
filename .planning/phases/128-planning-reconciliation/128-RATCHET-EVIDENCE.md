# 128-05: RECON-04 ratchet — CI reachability and live mutation proof

Plan: `128-05-PLAN.md`. All commands below were run from the plan's own worktree
(`C:\Users\mandr\codepulse\.claude\worktrees\agent-a6bae7f4534213042`), branch
`worktree-agent-a6bae7f4534213042`, based on `e6af2965`.

## What this proves and what it does not

`src/requirementsDrift.ratchet.test.ts`'s own controls (128-04's fake-oracle logic table —
eleven cases — and the real-git same-day fixture) prove that `stalePartialOffenders` and
`completionCommitFor` **discriminate correctly as pure functions**: given a stamp SHA and a
completion SHA, the function correctly classifies STALE / fresh-descendant / fresh-equal /
unrelated-history / no-stamp / unresolved-SHA / unresolvable-completion / shallow-repo, including
the same-day case where date comparison cannot order two real commits but SHA ancestry can. That
evidence is complete and does not need repeating here.

What those controls **cannot** prove, because they never touch the filesystem or read
`.planning/`, is that the two real parsers (`REQ_ROW` against the live `.planning/REQUIREMENTS.md`
Traceability table, `PHASE_ROW` against the live `.planning/ROADMAP.md` Progress table) actually
match the real row formats, that `collectRequirements()`/`collectPhaseStatus()` join on the real
phase numbers, and that a genuinely stale row in the **real files** actually reaches
`stalePartialOffenders` and turns the real `npx vitest run` invocation red. That is what this
document proves: a real commit-backed mutation of `.planning/REQUIREMENTS.md` and
`.planning/ROADMAP.md`, run through the unmodified real oracle (`realOracle`, built from
`execFileSync("git", ...)` against this actual repository), with the files restored afterward.

Also re-confirmed here, not newly established: the live in-range `Partial` population is
currently **zero** (46/46 Traceability rows `Pending`, as recorded in the file's own
GRANDFATHERING comment and re-verified independently below). So the ordinary `npm test` run
proves the table is clean today, not that the mechanism discriminates — that discrimination is
carried entirely by 128-04's controls plus this document's real-git mutation.

## Completion commit resolution

`completionCommitFor(128)` is defined by bisecting `.planning/ROADMAP.md`'s own git revision
history (`git log --follow -- .planning/ROADMAP.md`) for the first commit where Phase 128's
Progress row reads `Complete`. Before this plan's mutation, Phase 128 had never been `Complete`
in this repository's history, so the function could not resolve anything for it — a working-tree
edit alone is invisible to `git log`. The mutation therefore had to include a real commit.

Sequence (verbatim commands, run from the worktree):

1. Edited `.planning/ROADMAP.md`'s Phase 128 Progress row to `Complete`, `2026-08-27` (fixture
   text, not a real disposition).
2. Committed **only** `.planning/ROADMAP.md` (not `.planning/REQUIREMENTS.md`, which stayed
   uncommitted throughout this whole procedure — `collectRequirements()` reads it via
   `readFileSync` from the working tree, so it never needed a commit):
   ```
   git add .planning/ROADMAP.md
   git commit -m "THROWAWAY-128-05-MUTATION-PROOF: Phase 128 -> Complete (fixture, will be reset)"
   ```
   Resulting commit — this is the resolved completion commit:
   `ea53c014478eacedb7a2728753db8f83eddf2f4a`
3. Confirmed the bisect boundary directly, independent of the test's own internal bisect:
   ```
   $ git show ea53c014:.planning/ROADMAP.md | grep "^| 128\."
   | 128. Planning Reconciliation | v16.0 | 0/5 | Complete | 2026-08-27 | 128-05 MUTATION-PROOF FIXTURE — see 128-RATCHET-EVIDENCE.md, must be reverted |

   $ git show ee6ac6b5:.planning/ROADMAP.md | grep "^| 128\."
   | 128. Planning Reconciliation | v16.0 | 0/5 | Not started | - | |
   ```
   `ea53c014` is the most recent commit touching `.planning/ROADMAP.md`
   (`git log --format=%H --reverse -- .planning/ROADMAP.md | tail -1` == `ea53c014...`), and the
   immediately preceding revision (`ee6ac6b5`, this plan's Task 1 commit) does not read `Complete`
   — so `ea53c014` is exactly the boundary the bisect must return, verified by direct inspection
   rather than by trusting the test's internal logic.

### `is-ancestor` exit codes for the chosen stamps

Both measured explicitly, not assumed:

```
$ git merge-base --is-ancestor ee6ac6b5 ea53c014; echo "exit_code=$?"
exit_code=0
```
`ee6ac6b5` (this plan's own Task 1 commit — chosen as the ANCESTOR stamp) is a real ancestor of
the completion commit `ea53c014`.

```
$ git merge-base --is-ancestor ea53c014 e0847201; echo "exit_code=$?"
exit_code=0
```
`e0847201ece76857bd69787597be6d24fcbba2cd` (an empty commit created as a direct child of
`ea53c014` — chosen as the DESCENDANT stamp) is a real descendant of the completion commit.

## Mutation proof

### RED — stamp = ancestor SHA (`ee6ac6b5`)

Edited line, `.planning/REQUIREMENTS.md`:
```
| RECON-02 | Phase 128 | Partial — 128-05 mutation-proof fixture, not a real disposition (re-derived ee6ac6b5) |
```
(uncommitted working-tree edit; `.planning/ROADMAP.md`'s Phase 128 row already read `Complete`
via the committed `ea53c014` from the previous section)

Command: `npx vitest run --project unit src/requirementsDrift.ratchet.test.ts`

Raw output (verbatim):
```
 RUN  v4.1.11 C:/Users/mandr/codepulse/.claude/worktrees/agent-a6bae7f4534213042

stdout | src/requirementsDrift.ratchet.test.ts > D-01 (RECON-04): no in-range Partial predates its phase's completion commit > live assertion — every in-range Partial cell's freshness stamp is a descendant of (or equal to) its phase's completion commit
[D-01 population] 1 in-range Partial row(s) measured live (current-milestone range starts at Phase 120).

 ❯ |unit| src/requirementsDrift.ratchet.test.ts (23 tests | 2 failed) 1601ms
     × no requirement sits at Pending while its phase is marked Complete 6ms
     × live assertion — every in-range Partial cell's freshness stamp is a descendant of (or equal to) its phase's completion commit 279ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |unit| src/requirementsDrift.ratchet.test.ts > planning drift ratchet — REQUIREMENTS.md must not contradict ROADMAP.md > no requirement sits at Pending while its phase is marked Complete
AssertionError: A requirement cannot be Pending on a phase that shipped. Re-derive its status from the CODE and set it to Complete or Partial-with-a-reason. Do NOT mass-flip to Complete — that is the phase.complete false-green this repo has been bitten by. Offenders:
  RECON-01 (Phase 128) is 'Pending' but Phase 128 is 'Complete'
  RECON-03 (Phase 128) is 'Pending' but Phase 128 is 'Complete'
  RECON-04 (Phase 128) is 'Pending' but Phase 128 is 'Complete': expected [ …(3) ] to deeply equal []

 FAIL  |unit| src/requirementsDrift.ratchet.test.ts > D-01 (RECON-04): no in-range Partial predates its phase's completion commit > live assertion — every in-range Partial cell's freshness stamp is a descendant of (or equal to) its phase's completion commit
AssertionError: A Partial requirement predates its phase's completion commit. RE-DERIVE the cell from the current code and update its stamp — do NOT flip it to Complete; that is the phase.complete false-green in another costume. Offenders:
  RECON-02 (Phase 128): STALE — stamp ee6ac6b5 is an ancestor of completion commit ea53c014478eacedb7a2728753db8f83eddf2f4a (the commit that flipped Phase 128's ROADMAP Progress row to Complete). Re-derive RECON-02 from the current code and update its stamp — do NOT flip it to Complete; that is the phase.complete false-green in another costume.: expected [ Array(1) ] to deeply equal []

 Test Files  1 failed (1)
      Tests  2 failed | 21 passed (23)
   Start at  18:10:49
   Duration  2.45s (transform 42ms, setup 88ms, import 27ms, tests 1.60s, environment 617ms)
```
Exit status: `1`.

The D-01 offender message names `RECON-02`, both SHAs (`ee6ac6b5`, `ea53c014478eacedb7a2728753db8f83eddf2f4a`)
and the completion-commit definition (`"the commit that flipped Phase 128's ROADMAP Progress row
to Complete"`), exactly as required.

**Collateral, disclosed rather than hidden:** a SECOND, pre-existing test in the same file
(`"no requirement sits at Pending while its phase is marked Complete"`) also failed, flagging
`RECON-01`, `RECON-03`, `RECON-04` — because Phase 128 maps to four requirements and the fixture
marks the whole phase `Complete` while only `RECON-02` was given a `Partial` disposition; the
other three remained `Pending`. This is a real, correct firing of the OLDER Pending-on-Complete
check, not a defect introduced by this mutation or by `stalePartialOffenders` — it is disclosed
here so the RED count (2 failing tests, not 1) is not mistaken for something wrong with the new
mechanism. The specific assertion this plan exists to prove (`D-01`'s live assertion) failed with
exactly the message quoted above.

### GREEN — stamp = descendant SHA (`e0847201ece76857bd69787597be6d24fcbba2cd`) — the ONLY value changed

Edited line, `.planning/REQUIREMENTS.md` (the only change from RED — same file, same row,
stamp value only):
```
| RECON-02 | Phase 128 | Partial — 128-05 mutation-proof fixture, not a real disposition (re-derived e0847201ece76857bd69787597be6d24fcbba2cd) |
```

Command: `npx vitest run --project unit src/requirementsDrift.ratchet.test.ts`

Raw output (verbatim):
```
 RUN  v4.1.11 C:/Users/mandr/codepulse/.claude/worktrees/agent-a6bae7f4534213042

 ❯ |unit| src/requirementsDrift.ratchet.test.ts (23 tests | 1 failed) 1486ms
     × no requirement sits at Pending while its phase is marked Complete 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  |unit| src/requirementsDrift.ratchet.test.ts > planning drift ratchet — REQUIREMENTS.md must not contradict ROADMAP.md > no requirement sits at Pending while its phase is marked Complete
AssertionError: A requirement cannot be Pending on a phase that shipped. ... Offenders:
  RECON-01 (Phase 128) is 'Pending' but Phase 128 is 'Complete'
  RECON-03 (Phase 128) is 'Pending' but Phase 128 is 'Complete'
  RECON-04 (Phase 128) is 'Pending' but Phase 128 is 'Complete': expected [ …(3) ] to deeply equal []

 Test Files  1 failed (1)
      Tests  1 failed | 22 passed (23)
   Start at  18:11:42
   Duration  2.33s (transform 41ms, setup 84ms, import 27ms, tests 1.49s, environment 610ms)
```
Exit status: `1` (the same pre-existing, unrelated `RECON-01/03/04` Pending-on-Complete collateral
from the fixture's whole-phase mutation persists — this is not the assertion under test).

**The assertion this step is actually testing** — `D-01`'s live assertion,
`"live assertion — every in-range Partial cell's freshness stamp is a descendant of (or equal
to) its phase's completion commit"` — is **absent from the failed-tests list** in this run (it
was present and failing in RED); the passing-test count rose from 21/23 to 22/23, and the single
value that changed between RED and GREEN was the stamp SHA (`ee6ac6b5` → `e0847201...`, an
ancestor swapped for its own descendant). This is D-03's opposite control, run against the real
files rather than a fake oracle: the mechanism correctly reverses its verdict on the same row,
same file, same completion commit, changing only the ancestry relationship of the stamp.

## Restore proof

Pre-flight baseline (before any mutation in this plan):
```
$ git diff -- .planning/REQUIREMENTS.md .planning/ROADMAP.md
(empty — no output)
```
So the restore target is an empty diff, not a preserved sibling edit — there was nothing else
dirty in either file at plan start.

Pre-mutation SHA-256 (captured before any edit, copies made to the session scratchpad — restore
source was these scratchpad copies, never `git checkout --`):
```
03f46266a54b9b9df67e0bc6320105dbb21a12fa5b328e3e7cef8dba8222195e  .planning/REQUIREMENTS.md
394dd5418e06c72f328bd7cda71baa0bfc1dd3cc3cabcf5338096224f12accd0  .planning/ROADMAP.md
```

Restore sequence:
1. `git reset --soft ee6ac6b5` — moved HEAD back past both throwaway commits
   (`ea53c014` completion-commit fixture, `e0847201` empty descendant marker), which are now
   unreachable from the branch tip (still present as dangling objects; not pushed, not merged).
2. Copied both files back from the scratchpad (`cp <scratchpad>/128-05-*.orig .planning/*.md`),
   not `git checkout --`, per the plan's explicit prohibition (this repo's shared-checkout
   discipline: `checkout --` reverts to HEAD, which is safe here only because the baseline was
   already empty, but the rule is followed regardless).
3. `git reset --soft` leaves the INDEX at the pre-reset (mutated) tree, so a first `git diff`
   check after the file copy showed a spurious diff (index still mutated, working tree already
   restored). Reconciled with `git reset ee6ac6b5 -- .planning/REQUIREMENTS.md .planning/ROADMAP.md`
   to sync the index to HEAD for exactly these two paths, disclosed here rather than silently
   fixed, since it is a real step in the sequence.

Post-restore SHA-256:
```
03f46266a54b9b9df67e0bc6320105dbb21a12fa5b328e3e7cef8dba8222195e  .planning/REQUIREMENTS.md
394dd5418e06c72f328bd7cda71baa0bfc1dd3cc3cabcf5338096224f12accd0  .planning/ROADMAP.md
```
Identical to pre-mutation. `diff <scratchpad copy> <restored file>` for both files produced no
output (byte-identical).

Post-restore `git diff` against baseline:
```
$ git diff -- .planning/REQUIREMENTS.md .planning/ROADMAP.md
(empty — no output)

$ git diff --cached -- .planning/REQUIREMENTS.md .planning/ROADMAP.md
(empty — no output)

$ git status --short
(empty — no output)
```
Identical to the pre-flight baseline (empty), neither larger (a surviving mutation) nor smaller
(a destroyed sibling edit — there was none to destroy here).

Branch history after restore (`git log --oneline -5`):
```
ee6ac6b5 fix(128-05): give CI checkout the history the ratchet's ancestry needs
e6af2965 fix(128-04): an emoji-prefixed Partial row must not be invisible to the check
b5adc7da chore: merge executor worktree (128-04)
16fc6ad2 docs(128-04): plan 04 summary — stale-Partial freshness ratchet
d8f0377b feat(128-04): stale-Partial freshness ratchet with SHA-ancestry comparison
```
The two throwaway commits are not in this list — no commit for the mutation proof, per plan.

Re-ran the ratchet after restore to confirm it returns to the recorded baseline:
```
$ npx vitest run --project unit src/requirementsDrift.ratchet.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)
```
Matches the 23-test baseline exactly.

`src/requirementsDrift.ratchet.test.ts` unmodified by this plan:
```
$ git diff --stat -- src
(empty — no output)
```

## CI reachability

`.github/workflows/ci.yml`'s checkout step now carries `fetch-depth: 0` with a comment naming
`requirementsDrift.ratchet.test.ts`, added in this plan's Task 1 commit
(`ee6ac6b5`, `fix(128-05): give CI checkout the history the ratchet's ancestry needs`):

```diff
+      # fetch-depth: 0 (full history) is required because
+      # requirementsDrift.ratchet.test.ts resolves a phase's completion commit
+      # by bisecting ROADMAP.md's own revision history and compares stamp
+      # ancestry against it (`git merge-base --is-ancestor`) — a depth-1
+      # checkout leaves that unanswerable and the ratchet's shallow-repository
+      # branch fails loudly rather than silently passing.
       - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7
+        with:
+          fetch-depth: 0
       - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6
```
The two sequential vitest steps (`--project browser` then `--project unit`) and the pinned
checkout SHA are unchanged; `git diff -- .github/workflows/ci.yml` shows only this addition.

Verified two ways, per the plan:

1. **Real YAML parse** (not grep), using `js-yaml` (already present in `node_modules`):
   ```
   checkout step: {"uses":"actions/checkout@9c091bb...","with":{"fetch-depth":0}}
   fetch-depth === 0: true
   vitest steps: [ 'npx vitest run --project browser', 'npx vitest run --project unit' ]
   ```
   This asserts on the parsed step object in the job that runs the tests, not on a string that
   could also match inside a comment or a different job.

2. **Shallow-vs-full control.** Made a real `git clone --depth 1` of this worktree into the
   session scratchpad and compared `is-shallow-repository` against the working repository:
   ```
   $ git clone --depth 1 "file:///C:/Users/mandr/codepulse/.claude/worktrees/agent-a6bae7f4534213042" <scratchpad>/shallow-clone-test
   Cloning into '...'... done.

   $ git -C <scratchpad>/shallow-clone-test rev-parse --is-shallow-repository
   true

   $ git rev-parse --is-shallow-repository
   false
   ```
   This is the control the ratchet's own `gitIsShallow()` probe relies on: it proves the probe
   actually distinguishes a depth-1 clone from a full one, rather than returning a constant. The
   temp clone was removed afterward (`rm -rf <scratchpad>/shallow-clone-test`), confirmed by
   listing the scratchpad directory with the entry absent.

## Full sequential suite result (after restore)

Run the project's way — `--project unit` then `--project browser`, sequentially, never a bare
`vitest run` — matching `npm test`'s own script (`package.json`: `"test": "vitest run --project
unit && vitest run --project browser"`):

```
$ npx vitest run --project unit
 Test Files  380 passed | 17 skipped (397)
      Tests  5391 passed | 4 skipped | 195 todo (5590)
   Duration  49.57s
```
Matches the recorded baseline exactly (380 files / 5391 tests passed / 0 failed).

```
$ npx vitest run --project browser
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  13.05s
```
Matches the recorded baseline exactly (3 passed).

No unrelated failures appeared; nothing to attribute or defer.
