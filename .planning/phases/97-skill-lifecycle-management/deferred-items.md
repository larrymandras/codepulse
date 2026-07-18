# Deferred Items — Phase 97

Out-of-scope findings discovered during plan execution. Not fixed (per scope boundary rule) — logged for future triage.

## 97-01: `forge/src/workspace/classes.test.ts` — `verifyDriveMount` tests time out (pre-existing)

**Found during:** Plan 97-01, Task 2 verification (`npm test` full-suite run in `forge`).

**Symptom:** Three tests in `describe('verifyDriveMount', ...)` (`throws a clear named error for a non-existent drive`, `thrown message mentions the drive letter`, `thrown error is a standard Error (not an unhandled re-throw)`) time out after 5000ms instead of throwing synchronously as expected. They construct a path against a non-existent `Z:\nope\forge-workspaces` drive letter.

**Scope determination:** Confirmed pre-existing and unrelated to 97-01's changes — reproduced identically after `git stash` reverted all 97-01 working-tree changes back to the Task-1 commit (`c77ad1d`), before any Task-2 edits existed. `workspace/classes.ts` was not touched by this plan.

**Not fixed** (out-of-scope per plan's scope-boundary rule: "Only auto-fix issues DIRECTLY caused by the current task's changes"). Likely environment-dependent (drive-letter enumeration behaving differently than expected on this host, or a synchronous check that unexpectedly become async/blocking). Needs its own investigation in a future plan/quick-fix.
