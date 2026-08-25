# Deferred Items — Phase 127

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule (fix the class you
touched, not everything you notice). Not fixed here.

## 127-05: `AvatarAura.browser.test.tsx` fails to import (pre-existing, unrelated)

- **Found during:** `npm test` full-suite run at the end of plan 127-05 (ideation janitor tests).
- **Symptom:** `Failed to import test file ... AvatarAura.browser.test.tsx` /
  `TypeError: Cannot read properties of undefined (reading 'config')` at
  `src/components/voice/AvatarAura.browser.test.tsx:100`, plus many
  `Not implemented: HTMLCanvasElement's getContext()` console warnings from unrelated
  WebGL-backed tests in the same run (those are warnings, not failures — 364/365 suites passed).
- **Scope:** Entirely unrelated to `convex/ideation.ts` or `convex/retentionCursor.ts`. Last
  touched by commit `828a5b08` (`test(193): make the D-18.1 modulation guard actually
  discriminate`) — a different phase, not this worktree's base or this plan's `files_modified`.
- **Not fixed:** Out of this plan's scope boundary (`convex/ideation.test.ts` only). Left for a
  separate phase/plan that owns `src/components/voice/`.
