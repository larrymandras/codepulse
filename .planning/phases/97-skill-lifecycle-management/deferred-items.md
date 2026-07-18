# Deferred Items — Phase 97

Out-of-scope findings discovered during plan execution. Not fixed (per scope boundary rule) — logged for future triage.

## 97-01: `forge/src/workspace/classes.test.ts` — `verifyDriveMount` tests time out (pre-existing)

**Found during:** Plan 97-01, Task 2 verification (`npm test` full-suite run in `forge`).

**Symptom:** Three tests in `describe('verifyDriveMount', ...)` (`throws a clear named error for a non-existent drive`, `thrown message mentions the drive letter`, `thrown error is a standard Error (not an unhandled re-throw)`) time out after 5000ms instead of throwing synchronously as expected. They construct a path against a non-existent `Z:\nope\forge-workspaces` drive letter.

**Scope determination:** Confirmed pre-existing and unrelated to 97-01's changes — reproduced identically after `git stash` reverted all 97-01 working-tree changes back to the Task-1 commit (`c77ad1d`), before any Task-2 edits existed. `workspace/classes.ts` was not touched by this plan.

**Not fixed** (out-of-scope per plan's scope-boundary rule: "Only auto-fix issues DIRECTLY caused by the current task's changes"). Likely environment-dependent (drive-letter enumeration behaving differently than expected on this host, or a synchronous check that unexpectedly become async/blocking). Needs its own investigation in a future plan/quick-fix.

## 97-04: `src/pages/Skills.tsx:225` — page-level "Validate skill" button still opens the now-renamed "Install skill" modal

**Found during:** Plan 97-04, post-task grep sweep for remaining dry-run strings repo-wide (`grep -rln "Validate skill" src/`).

**Symptom:** `Skills.tsx` renders `<Button onClick={() => setIntakeModalOpen(true)}>Validate skill</Button>` — the page-level entry point that opens `IntakeModal`. Plan 97-04 renamed the modal's own `DialogTitle`/submit-button/footer copy to install language ("Install skill"), so the button that launches it now reads "Validate skill" while the dialog it opens reads "Install skill" — an inconsistent, misleading UI (same house-honesty concern as T-97-10, INTAKE-01/04).

**Scope determination:** `Skills.tsx` is not in 97-04's `files_modified` frontmatter (`IntakeModal.tsx`, `IntakeSheet.tsx`, `SkillCollectionPicker.tsx` + their tests only) and the executor's explicit EXECUTION_NOTES restricted edits to those three components. Not fixed here per scope boundary.

**Not fixed.** Needs a 1-line copy fix (`Validate skill` → `Install skill`, plus a matching `Skills.test.tsx` assertion update if one exists) — trivial to pick up in a follow-up plan or as a quick fix before Phase 97 is considered fully house-honest end-to-end.
