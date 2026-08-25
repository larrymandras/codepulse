# Deferred Items — Phase 127

## `AvatarAura.browser.test.tsx` — reported as a pre-existing failure, and that was WRONG

Plans 127-04 and 127-05 each logged this as a pre-existing, unrelated repo defect. Both were
mistaken, and the entry is kept (rather than deleted) because the way they were mistaken is
the reusable part.

**What they reported:** `Failed to import test file ... src/components/voice/AvatarAura.browser.test.tsx`
/ `TypeError: Cannot read properties of undefined (reading 'config')` at line 100. Both
attributed it to commit `828a5b08` (`test(193): ...`), Phase 193, via
`git log --oneline -1 -- <path>`.

**What is actually true.** Measured by the orchestrator on the merged main checkout at
`ec4cdd4b`, after all six wave 1-3 plans were merged:

- `npx vitest run src/components/voice/AvatarAura.browser.test.tsx` → **1 file passed, 3 tests
  passed.** It runs in real browser mode via `@vitest/browser`.
- Full `npm test` → **365 files passed | 17 skipped; 5,158 passed | 4 skipped | 195 todo;
  0 failed.**

So the test does not fail on this repo. There is no pre-existing defect to fix, and no Phase
193 regression.

**Where the reasoning went wrong — two separate errors, both worth carrying forward:**

1. **A negative result is a claim about the probe, not about the system.** Both observations
   were made INSIDE git worktrees, while multiple executors were running concurrently. The
   discriminating control is the main checkout, where it passes. Note the third executor
   (127-06) ran the full suite in its own worktree and reported 0 failed — so this is not
   simply "worktrees break browser tests" either. The likeliest remaining explanation is
   contention between concurrent browser-mode runs (127-04 and 127-05 overlapped; 127-06
   finished before them), but that mechanism is NOT established here and is recorded as a
   hypothesis, not a finding.

2. **`git log -1 -- <path>` answers "who last touched this file", never "why does it fail".**
   Both executors treated it as causal evidence and reached the same wrong attribution
   independently. Their agreement felt like corroboration and was not — two probes sharing a
   defect agree with each other exactly as readily as two correct probes do.

**Accompanying noise, correctly identified as noise by both:** the repeated
`Not implemented: HTMLCanvasElement's getContext() method` lines are warnings from unrelated
WebGL-backed jsdom tests, not failures.

**Action required: none.** Nothing is deferred, because nothing is broken. No approval is
needed under CLAUDE.md § "Error Triage" — the error was investigated and found not to exist
on the main tree.
