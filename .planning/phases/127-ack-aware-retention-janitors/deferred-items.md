# Deferred Items — Phase 127

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule (not fixed, not this plan's concern).

## From plan 127-04

- **`src/components/voice/AvatarAura.browser.test.tsx` fails on `npm test`** — pre-existing,
  unrelated to this plan. `Error: Failed to import test file ... TypeError: Cannot read
  properties of undefined (reading 'config')` at line 100, preceded by repeated
  `Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm
  package` warnings. This is a Playwright/chromium browser-mode test requiring a real canvas
  context; introduced in commit `828a5b08` "test(193): make the D-18.1 modulation guard
  actually discriminate" (Phase 193), which predates and is unrelated to Phase 127's
  `convex/inbox.ts`/`convex/inbox.test.ts` work. Confirmed via `git log --oneline -1 -- <path>`
  before logging here. Not fixed — out of scope for JANITOR-01.
