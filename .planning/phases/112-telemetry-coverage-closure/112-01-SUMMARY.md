---
phase: 112-telemetry-coverage-closure
plan: 01
subsystem: docs
tags: [astridr-contract, telemetry, cross-repo, documentation]

# Dependency graph
requires: []
provides:
  - "astridr-repo/docs/astridr-contract.md sections 2.20-2.24 marked NOT EMITTED - aspirational, in place, with dated banners citing v1.6.0/2026-03-09/new_claude_capabilities.md"
  - "Three unfirable critical-events rows (worktree_lifecycle, batch_execution, loop_lifecycle) removed from the operator-alerting table"
affects: [112-02, 112-03, 112-04, 112-05, 112-06, 112-07]

# Tech tracking
tech-stack:
  added: []
  patterns: ["control-paired fixed-string emitter search (subject vs known-present control, run in the same command batch) before asserting an absence in prose"]

key-files:
  created: []
  modified:
    - "C:/Users/mandr/astridr-repo/docs/astridr-contract.md"

key-decisions:
  - "D-07/D-08/D-09 implemented exactly as scoped: in-place banners, no renumbering, three critical-events rows dropped."
  - "Task 1's search was widened beyond the plan's literal grep -rF form: a bare substring match on `worktree_lifecycle` returned tests/unit/tools/test_delegate_task.py, which on inspection is a test *function name* (`test_worktree_lifecycle_on_success`), not an emitter call site. Re-ran with a quoted-string-literal pattern (the actual shape an emitter call site takes) to discriminate; that form returned zero for all five Group A kinds and 2 real call sites for the governor_decision control, so the zero-emitter claim holds and was not weakened."

requirements-completed: [TELE-01]

# Metrics
duration: ~15min
completed: 2026-08-12
---

# Phase 112 Plan 01: Group A Contract Correction (astridr-repo) Summary

**Marked astridr-repo's 5 never-emitted Group A event kinds (§2.20-§2.24) aspirational in place with dated banners, and removed the 3 critical-events rows that promised alerts on those same unfirable kinds — one commit, one file, in a second repository.**

## Performance

- **Duration:** ~15 min (not separately instrumented at plan start; commit landed 2026-08-12T14:06:52Z / 10:06:52 ET)
- **Tasks:** 3
- **Files modified:** 1 (`C:/Users/mandr/astridr-repo/docs/astridr-contract.md`)

## Accomplishments

- Established the zero-emitter fact for all five Group A kinds with a control-paired search, before writing any prose.
- Inserted five dated `NOT EMITTED - aspirational` banners in place under §2.20-§2.24, preserving section numbering §2.19-§2.40 exactly (verified by heading grep).
- Removed the three critical-events rows that could never fire (`worktree_lifecycle`, `batch_execution`, `loop_lifecycle`), leaving `mcp_connection` and `subagent_job` untouched.
- Committed once in astridr-repo, named-path-only, and read `git show --stat HEAD` to confirm the commit touched exactly one file.

## Task Commits

Both edits (Task 2 banners + Task 3 row removal) were landed in a single astridr-repo commit per the plan's own Task 3 instruction ("commit" appears only in Task 3; Task 2 is edit-then-verify with no commit step). This matches the plan's `<verify>`/`<acceptance_criteria>` design, where Task 2's acceptance criteria are checked via `git diff --numstat` against the *working tree*, not a prior commit.

1. **Task 1: Establish the zero-emitter fact with a paired control** — no commit (read-only search task; `git status --short` confirmed no modification).
2. **Task 2: Insert the five dated NOT EMITTED banners in place** — staged into the same commit as Task 3 below.
3. **Task 3: Remove the three unfirable critical-events rows, verify, commit** — astridr-repo commit `7f61ba1d554568264bdd55797890cd0b9c00a31c`.

**CodePulse plan-metadata commit:** recorded below (this SUMMARY.md + STATE.md + ROADMAP.md), separate from the astridr-repo content commit.

## Task 1 Evidence — Six Search Counts (Verbatim)

Command form actually run (fixed-string, source extensions, `docs/` excluded), executed from `C:\Users\mandr\astridr-repo`:

```bash
grep -rF --include=*.py --include=*.ts --include=*.js -l "<STRING>" . 2>/dev/null | grep -v '^\./docs/'
```

| Subject | Bare-substring file count | Notes |
|---|---|---|
| `governor_decision` (CONTROL) | **3** (`astridr/automation/governor.py`, `tests/unit/automation/test_subagent_jobs.py`, `tests/unit/tools/test_delegate_task.py`) | Control non-zero — search is discriminating. |
| `instructions_loaded` | **0** | |
| `loop_lifecycle` | **0** | |
| `worktree_lifecycle` | **1** (`tests/unit/tools/test_delegate_task.py`) | See deviation below — investigated, not an emitter. |
| `batch_execution` | **0** | |
| `auto_memory` | **0** | |

`worktree_lifecycle`'s one bare-substring hit is `test_worktree_lifecycle_on_success`/`test_worktree_lifecycle_on_failure` — pytest function names describing generic worktree create/cleanup behavior, not a call site emitting an event literally named `worktree_lifecycle`. Confirmed by reading `tests/unit/tools/test_delegate_task.py:225-260`: the test bodies assert `wt_manager.create`/`wt_manager.cleanup` mock calls, with no reference to an event type string.

To resolve the ambiguity without weakening the claim, the search was re-run in quoted-string-literal form (the actual shape an emitter call site takes, matching how the control's own real call sites appear — `"governor_decision"` at `governor.py:470,564`):

```bash
grep -rEn --include=*.py --include=*.ts --include=*.js '["'"'"']<STRING>["'"'"']' . 2>/dev/null | grep -v '^\./docs/'
```

| Subject | Quoted-literal file/line count | Result |
|---|---|---|
| `governor_decision` (CONTROL) | **2 real call sites** (`governor.py:470`, `governor.py:564`), plus 2 comment mentions in tests | Non-zero, confirms search discriminates at the emitter-call-site level too. |
| `instructions_loaded` | **0** | |
| `loop_lifecycle` | **0** | |
| `worktree_lifecycle` | **0** | Confirms the bare-substring hit was a false positive from the test function name, not an emitter. |
| `batch_execution` | **0** | |
| `auto_memory` | **0** | |

**Conclusion:** all five Group A kinds have zero emitter call sites under both search forms except `worktree_lifecycle`'s bare-substring form, which was investigated and shown to be a non-emitter test-name coincidence, not a real call site — the quoted-literal form (the form an actual emitter uses) returns zero for it too. `git status --short` in astridr-repo showed no modification after Task 1 (confirmed — the only entry was the pre-existing untracked file belonging to another session).

## Task 2 Evidence — Banner Insertion

- Baseline `NOT EMITTED` count before edit: **0** (confirmed via `grep -cF`, exit code 1).
- Post-edit `NOT EMITTED` count: **5**.
- `grep -cF "new_claude_capabilities.md" docs/astridr-contract.md` = **6** (5 banners + 1 pre-existing changelog citation at line ~1954 post-edit).
- Section heading listing (`grep -nE "^### 2\.(19|20|21|22|23|24|25|40) "`), original numbers and event names, unchanged:
  ```
  651:### 2.19 `version_bump`
  674:### 2.20 `instructions_loaded`
  717:### 2.21 `loop_lifecycle`
  764:### 2.22 `worktree_lifecycle`
  807:### 2.23 `batch_execution`
  854:### 2.24 `auto_memory`
  895:### 2.25 `prompt_assembly`
  1323:### 2.40 `governor_decision`
  ```
- `git diff --numstat docs/astridr-contract.md` after Task 2 (before Task 3's row deletion): `70  0  docs/astridr-contract.md` — pure insertions, zero deletions, matching 5 banners x 14 lines each.
- Each of the five banners verified to contain `v1.6.0`, `2026-03-09`, and `new_claude_capabilities.md` (spot-checked via full-file `grep -cF` counts: `v1.6.0` = 10 total = 5 pre-existing field-note mentions + 5 new banner mentions; `2026-03-09` = 6 = 1 changelog + 5 banners).
- Used the Edit tool exclusively (no shell heredoc, no PowerShell `Get-Content`/`Set-Content` round-trip) per the plan's encoding-corruption warning.

## Task 3 Evidence — Row Removal, Verify, Commit

- Located the critical-events table by content (banners shifted line numbers): the three target rows were at lines 1855-1857 post-Task-2-edit, immediately preceded by `mcp_connection` (1854) and immediately followed by `subagent_job` (1858).
- After deletion: `grep -cE "^\| \`(worktree_lifecycle|batch_execution|loop_lifecycle)\` \|" docs/astridr-contract.md` = **0**.
- `grep -cE "^\| \`(subagent_job|mcp_connection)\` \|" docs/astridr-contract.md` = **2** (both neighbours intact).
- `Framework implementation: Check \`_is_critical()\`` note still present (count 1).
- `NOT EMITTED` count still **5** after the row deletions (unaffected, as expected).

### Commit

```
git add docs/astridr-contract.md
git commit -m "docs(contract): mark Group A event kinds aspirational, drop unfirable critical-event rows (CodePulse TELE-01)"
```

`git show --stat HEAD` output:
```
commit 7f61ba1d554568264bdd55797890cd0b9c00a31c
Author: Larry Mandras <mandrasle@gmail.com>
Date:   Wed Aug 12 10:06:52 2026 -0400

    docs(contract): mark Group A event kinds aspirational, drop unfirable critical-event rows (CodePulse TELE-01)

 docs/astridr-contract.md | 73 ++++++++++++++++++++++++++++++++++++++++++++++--
 1 file changed, 70 insertions(+), 3 deletions(-)
```

Exactly one file listed: `docs/astridr-contract.md`. 70 insertions (5 banners x 14 lines) + 3 deletions (the three removed rows), net +70/-3 against the stat line's 73 total changed lines. `git log -1 --format=%H` = `7f61ba1d554568264bdd55797890cd0b9c00a31c`. No `--amend` was run at any point (verified: only one commit was created, and this SUMMARY quotes the hash created by the single `git commit` invocation above).

Post-commit `git status --short` in astridr-repo:
```
?? .planning/phases/188.5-watch-pulse-fetch-window-duplicate-residual-inserted/.review-fix-recovery-pending.json
```
Only the pre-existing untracked file belonging to the concurrent session remains — not staged, not touched, not committed.

## Files Created/Modified

- `C:/Users/mandr/astridr-repo/docs/astridr-contract.md` — 5 in-place `NOT EMITTED - aspirational` banners under §2.20-§2.24; 3 critical-events table rows removed (worktree_lifecycle, batch_execution, loop_lifecycle). Committed as `7f61ba1d` on `feature/brain-swap` in astridr-repo (branch not switched, per plan constraint).

## Decisions Made

- Implemented D-07 (in-place correction, no renumbering), D-08 (drop the three unfirable critical-events rows), D-09 (banner cites v1.6.0/2026-03-09/Claude Code Feb-Mar 2026 release alignment/`new_claude_capabilities.md`) exactly as scoped in `112-CONTEXT.md`.
- Widened Task 1's search methodology beyond the plan's literal `grep -rF` instruction: after the bare-substring form produced one ambiguous hit for `worktree_lifecycle`, added a quoted-string-literal pass to discriminate a real emitter call site from a coincidental test-function-name substring match. This is a strengthening of the verification, not a change to what was claimed — the final zero-emitter conclusion for all five kinds is unchanged and is now backed by two independent search forms instead of one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1-adjacent verification strengthening, not a bug fix] Investigated a non-zero Task 1 search hit before treating the zero-emitter claim as settled**
- **Found during:** Task 1 (paired-control search)
- **Issue:** The plan's literal `grep -rF` command form returned 1 file for `worktree_lifecycle` (`tests/unit/tools/test_delegate_task.py`), which on its face looks like a non-zero emitter count that the plan says should STOP the plan and report.
- **Investigation:** Read the matched lines (225-260) — the hit is two pytest function names (`test_worktree_lifecycle_on_success`, `test_worktree_lifecycle_on_failure`) describing generic create/cleanup behavior, with no event-type string, no `emit`/`send`/`record` call, and no reference to `"worktree_lifecycle"` as a literal. Re-ran the same six-way search using a quoted-string-literal pattern (the shape an actual emitter call site takes, confirmed against the control's own two real call sites in `governor.py:470,564`); this form returns zero for `worktree_lifecycle` and all four other Group A kinds, while the control still returns 2 real call sites.
- **Outcome:** Did not stop the plan — the non-zero hit was a false positive from bare-substring matching against a test function name, not a real emitter. The banner's factual claim ("nothing emits `worktree_lifecycle`") holds under the stricter, more discriminating search. No prose was written until this was resolved.
- **Files modified:** None (search-only; no code or doc change from this investigation).
- **Verification:** Both search forms and their full output are quoted in this SUMMARY's Task 1 section above.
- **Committed in:** N/A (search-only task, no commit).

---

**Total deviations:** 1 (verification strengthening within Task 1; no scope change, no architectural change, no Rule 4 escalation needed).
**Impact on plan:** None on scope or output. The plan's own acceptance criteria ("Each of the five Group A event-type strings returns zero matching source files outside `docs/`") is satisfied under the more rigorous quoted-literal search; the bare-substring form's one hit is disclosed and explained rather than silently reconciled.

## Issues Encountered

None beyond the Task 1 investigation documented above.

## User Setup Required

None — no external service configuration required. No build, restart, or deploy was performed in astridr-repo, per the plan's explicit prohibition.

## Next Phase Readiness

- TELE-01 is closed: astridr-repo's contract no longer presents the five Group A kinds as live behaviour, and the three unfirable critical-events rows are gone.
- No CodePulse source file was modified by this plan (only this SUMMARY.md, plus STATE.md/ROADMAP.md/REQUIREMENTS.md updates below).
- Plans 112-02 through 112-07 (schema, domain routing, ingest dispatch, UI surface, disposition const, live deploy) are unaffected by and do not depend on this plan's astridr-repo-only change — wave 1 concurrency confirmed by the plan's own `depends_on: []`.

---
*Phase: 112-telemetry-coverage-closure*
*Completed: 2026-08-12*
