# Deferred Items — Phase 127

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule (fix the class you
touched, not everything you notice). Not fixed here.

## `AvatarAura.browser.test.tsx` fails to import (pre-existing, unrelated)

Found INDEPENDENTLY by both plan 127-04 and plan 127-05, in separate worktrees, each running
its own full `npm test`. Both traced it to the same origin commit without seeing each other's
finding — that convergence is why this is recorded as one item rather than two.

- **Symptom:** `Failed to import test file ... src/components/voice/AvatarAura.browser.test.tsx`
  / `TypeError: Cannot read properties of undefined (reading 'config')` at
  `src/components/voice/AvatarAura.browser.test.tsx:100`.
- **Accompanying noise (NOT the failure):** repeated
  `Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm
  package` warnings from unrelated WebGL-backed tests in the same run. These are warnings, not
  failures — 364 of 365 suites passed. Do not conflate them with the import failure.
- **Origin:** last touched by commit `828a5b08` (`test(193): make the D-18.1 modulation guard
  actually discriminate`), Phase 193. Both executors confirmed this via
  `git log --oneline -1 -- <path>` before logging. That commit predates and is unrelated to
  every file Phase 127 touches.
- **Shape:** a Playwright/chromium browser-mode test requiring a real canvas context. It fails
  at IMPORT, i.e. it never runs an assertion — a collection error, not a failed assertion.
- **Why not fixed here:** outside every Phase 127 plan's `files_modified`. No plan in this phase
  owns `src/components/voice/`.

**This is a deliberate deferral and it has NOT been approved.** This repo's CLAUDE.md § "Error
Triage" says a runtime/test error found during a phase should be root-caused and fixed rather
than classified as pre-existing, and that deferral requires explicit user approval. The
root-cause trace above is done; the fix is not. Raised at the wave 3 boundary — if Larry
declines to fold it into this phase, that decision belongs here, next to this entry.
