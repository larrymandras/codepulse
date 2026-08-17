# Deferred Items — Phase 116 (Galdr Prompt Library)

## 116-02 — RESOLVED, not a Phase 116 item (corrected by orchestrator 2026-08-10)

116-02's executor recorded a `tsc --noEmit` error in `src/hooks/useAstridrVoice.test.ts`
(`Property '__astridrForceRecognizerReset' does not exist on type 'Window & typeof globalThis'`)
and deferred it as out-of-scope. Its scoping decision was correct — the file is not in this
plan's `files_modified` and it did not touch it.

The attribution was not. This was never a Phase 116 defect and is not deferred work:

- A **concurrent Claude Code session** was editing `src/hooks/useAstridrVoice.ts` /
  `.test.ts` in this shared checkout while 116-02 ran, alongside two untracked scratch
  files (`src/hooks/__scratch_injector.test.ts`, `src/contexts/AstridrWSContext.test.tsx`).
  The executor observed that session's transient mid-edit state.
- `npx tsc --noEmit` run from the repo root immediately after 116-02 completed exits **0
  with no output**. The error does not reproduce.
- 116-01, executing minutes earlier on the same tree, also reported `tsc --noEmit` clean —
  the two reports only conflict if the cause is transient and external, which it was.

Nothing to fix and nothing to carry forward. Recorded here rather than deleted so the
contradiction between 116-01's and 116-02's tsc reports has a written resolution.

**Standing note for later plans in this phase:** this checkout is shared with an active
concurrent session. Stage only explicit paths, never `git add -A`, and re-run
`git show --stat HEAD` after each commit. Do not treat unrelated dirty files or transient
type errors as phase-116 defects without first re-running the check from the repo root.
