---
phase: 97-skill-lifecycle-management
plan: 01
subsystem: infra
tags: [forge-daemon, skill-intake, cross-repo, vitest, cli-adapter]

# Dependency graph
requires: []
provides:
  - "buildAdmitArgs (forge/src/process/intake-exec.ts) appends --write on every invocation and --allow-unrecoverable for global/project only, never cold, never --allow-overwrite"
  - "mapExitCodeToResult classifies exit codes 4-9: router refusals (4-7) return status 'failed' with report parsed verbatim and error write-refused:<kind>:<message> extracted from stdout; post-placement warnings (8-9) return status 'done' with error post-placement-warning:<kind>:<message>"
  - "intake-types.ts IntakeResult doc comment updated to note error may be set on status 'done' for the 8/9 case"
affects: [97-05 (Convex ackCommand adapter that maps the write-refused:/post-placement-warning:<kind> prefix to house copy)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Machine-readable structured error string prefix (write-refused:<kind>:, post-placement-warning:<kind>:) as the seam a downstream Convex adapter maps to UI copy — no house copy composed in the daemon itself"
    - "Never-throw discriminated IntakeResult contract preserved through the exit-code-4-9 extension"

key-files:
  created: []
  modified:
    - "C:\\Users\\mandr\\forge\\src\\process\\intake-exec.ts"
    - "C:\\Users\\mandr\\forge\\src\\process\\intake-exec.test.ts"
    - "C:\\Users\\mandr\\forge\\src\\emit\\intake-types.ts"
    - "C:\\Users\\mandr\\forge\\src\\emit\\intake-runner.test.ts (downstream regression fix, not in plan's files_modified — see Deviations)"

key-decisions:
  - "extractRefusalMessage() takes everything after the first stdout line (the ReportEnvelope JSON), joined and trimmed — matches the CLI's documented output shape (typer.echo(report) then typer.echo(write-plan/outcome text)) with no attempt at more granular line-by-line parsing"
  - "REFUSAL_KIND (4:unrecoverable, 5:collision, 6:cold-marker, 7:project-git) and WARNING_KIND (8:catalog, 9:ledger) implemented as plain Record<number,string> lookup tables for the machine-readable <kind> discriminant"
  - "If the first stdout line fails to parse as JSON for exit 4-9 (defensive-only; RESEARCH says this is always present in practice), `report` is simply omitted rather than the function throwing or fabricating a placeholder — preserves D-P8-10 (never synthesize report)"

patterns-established:
  - "write-refused:<kind>:<message> / post-placement-warning:<kind>:<message> structured error string is the frozen seam Plan 05's Convex ackCommand adapter parses to compose house copy"

requirements-completed: [DAEMON-01, INTAKE-04]

# Metrics
duration: ~35min
completed: 2026-07-18
---

# Phase 97 Plan 01: Real-Write Argv + Exit-Code 4-9 Classification Summary

**Turned the Forge daemon's `intake-exec.ts` from dry-run-only into a real writer: `buildAdmitArgs` now always appends `--write` (plus conditional `--allow-unrecoverable` for global/project, never `--allow-overwrite`), and `mapExitCodeToResult` classifies all ten exit codes (0-9), extracting router-refusal and post-placement-warning text from stdout instead of the empty stderr.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-18T14:40:02Z
- **Tasks:** 2
- **Files modified:** 4 (3 named in plan + 1 direct downstream regression fix)

## Accomplishments
- `buildAdmitArgs` emits a real-write argv: `--write` unconditional, `--allow-unrecoverable` for `global`/`project` only, `--allow-overwrite` never appended under any destination (D-07 collision guard preserved)
- `mapExitCodeToResult` extended to cover exit codes 4-9: router refusals (4-7) carry the `ReportEnvelope` verbatim plus a `write-refused:<kind>:<message>` error extracted from stdout (never stderr, which is empty for these codes); post-placement warnings (8-9) resolve `status: 'done'` (skill IS on disk, not rolled back) with `post-placement-warning:<kind>:<message>`
- `intake-types.ts` doc-comment-only update noting `error` may now also populate on `status: 'done'`
- Fixed a direct downstream regression in `intake-runner.test.ts` (two argv assertions written against the old dry-run-only shape)
- forge `master` HEAD confirmed unchanged at `a364adf` before editing (pre-flight check passed)

## Task Commits

Each task was committed atomically in the **forge** repo (`C:\Users\mandr\forge`, not codepulse):

1. **Task 1: Real-write argv in buildAdmitArgs** - `c77ad1d` (feat, TDD RED→GREEN)
2. **Task 2: Classify exit codes 4-9 with stdout refusal extraction** - `52fb75a` (feat, TDD RED→GREEN; includes the intake-runner.test.ts regression fix, see Deviations)

**Plan metadata:** this SUMMARY.md + STATE.md/ROADMAP.md updates are committed in **codepulse** (owned by the orchestrator per cross-repo instructions).

## Files Created/Modified
- `C:\Users\mandr\forge\src\process\intake-exec.ts` - `buildAdmitArgs` real-write argv; `mapExitCodeToResult` exit-4-9 classification; updated file-header exit-code contract doc comment
- `C:\Users\mandr\forge\src\process\intake-exec.test.ts` - Rewrote `buildAdmitArgs` describe block for new argv shape + D-07 regression guard; added 9 new `mapExitCodeToResult` cases for exit 4-9 (including a stderr-vs-stdout mutation guard) + a 0/1/2/3 regression case
- `C:\Users\mandr\forge\src\emit\intake-types.ts` - Doc-comment-only: `IntakeResult.error` may populate on `status: 'done'` for exit 8/9
- `C:\Users\mandr\forge\src\emit\intake-runner.test.ts` - Updated 2 argv assertions (cases "2" and "2b") to the new real-write argv shape (direct downstream regression, see Deviations)

## Decisions Made
- `extractRefusalMessage()` joins all stdout lines after the first (JSON) line and trims — matches the CLI's documented `typer.echo(report)` then `typer.echo(write-plan/outcome text)` shape exactly; no attempt to isolate just `outcome.message` from the multi-line write-plan text, since the plan's acceptance criteria only require the message to be present and sourced from stdout, not stderr
- Used two small `Record<number,string>` lookup tables (`REFUSAL_KIND`, `WARNING_KIND`) rather than a switch statement, for a compact, easily-extended `<kind>` mapping
- For exit 4-9, if the first stdout line fails to parse as JSON (should never happen per RESEARCH, but handled defensively), `report` is simply omitted from the result rather than throwing — preserves the "never throw" contract and D-P8-10 (never synthesize a report)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed downstream `intake-runner.test.ts` regression caused by the intended `buildAdmitArgs` argv change**
- **Found during:** Task 1/2 verification (`npm test` full forge suite)
- **Issue:** Two existing tests in `src/emit/intake-runner.test.ts` (`createIntakeRunner` cases "2" and "2b") asserted the exact `admitArgs` array produced by `buildAdmitArgs`, written against the pre-existing dry-run-only shape (no `--write`/`--allow-unrecoverable`). Once `buildAdmitArgs` was correctly extended per the plan, these two assertions became stale and failed — not a bug in the new code, but a direct, mechanical consequence of the intended behavior change that the plan's `files_modified` list didn't anticipate.
- **Fix:** Updated the two `toEqual(...)` assertions to the new real-write argv shape (`--write` for cold; `--write`, `--allow-unrecoverable` for global). No behavioral/logic changes to `intake-runner.ts` itself were needed — `createIntakeRunner` already delegates argv construction to `buildAdmitArgs` unchanged.
- **Files modified:** `C:\Users\mandr\forge\src\emit\intake-runner.test.ts`
- **Verification:** `npx vitest run src/emit/intake-runner.test.ts src/process/intake-exec.test.ts` — 47/47 passing; full `npm test` — only the pre-existing, unrelated `classes.test.ts` failures remain (confirmed via `git stash`/`stash pop` that they reproduce identically on the Task-1-only baseline, before any Task-2 edits).
- **Committed in:** `52fb75a` (Task 2 commit, forge repo) — bundled with the Task 2 commit rather than the exact 3 files named in the plan's `files_modified` frontmatter, since this file was not itself part of this plan's scope but was a direct, mechanical, in-scope consequence of the change under Rule 1 ("Only auto-fix issues DIRECTLY caused by the current task's changes").

---

**Total deviations:** 1 auto-fixed (Rule 1 - direct downstream test regression)
**Impact on plan:** Necessary to satisfy the plan's own explicit verification bar ("full forge suite `npm test` green"). No scope creep beyond the two stale assertions; no production code outside the plan's 3 named files was touched.

## Issues Encountered
- `src/workspace/classes.test.ts`'s `verifyDriveMount` describe block has 3 pre-existing test timeouts (`Test timed out in 5000ms`, testing behavior against a non-existent `Z:\nope\forge-workspaces` drive letter), unrelated to this plan's changes. Confirmed pre-existing by stashing all Task-2 working-tree changes and re-running against the Task-1-only commit (`c77ad1d`) — identical 3 failures. Out of scope per the scope-boundary rule (this plan never touches `workspace/classes.ts`); logged to `.planning/phases/97-skill-lifecycle-management/deferred-items.md` for future triage, not fixed.

## User Setup Required
None - no external service configuration required. (Note: the phase-level `~/.claude/skill-intake.toml` cold-storage marker manual setup step from 97-RESEARCH.md Pitfall 2 is NOT this plan's concern — it gates live cold-storage writes at execution time, not this plan's pure-function unit-test surface.)

## Next Phase Readiness
- `forge/src/process/intake-exec.ts` is now a real writer with full exit-code-0-9 classification — ready for Plan 05's Convex `ackCommand` adapter to consume the `write-refused:<kind>:`/`post-placement-warning:<kind>:` structured error prefix and compose house copy/synthetic findings.
- No blockers. `forge` `master` HEAD is now `52fb75a` (2 commits ahead of the `a364adf` research baseline) — future plans touching `forge` should re-verify HEAD before editing, per this plan's own pre-flight pattern.
- Pre-existing `classes.test.ts` timeout failures (unrelated) remain open — see `deferred-items.md`.

## Self-Check: PASSED

Verified:
- `C:\Users\mandr\forge\src\process\intake-exec.ts` — FOUND, contains `--allow-unrecoverable` and the exit-4-9 classification logic
- `C:\Users\mandr\forge\src\process\intake-exec.test.ts` — FOUND, 34 tests, all passing
- `C:\Users\mandr\forge\src\emit\intake-types.ts` — FOUND, doc-comment updated
- `C:\Users\mandr\forge\src\emit\intake-runner.test.ts` — FOUND, updated assertions
- Commit `c77ad1d` — FOUND in `forge` `git log`
- Commit `52fb75a` — FOUND in `forge` `git log`

---
*Phase: 97-skill-lifecycle-management*
*Completed: 2026-07-18*
