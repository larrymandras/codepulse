# Deferred Items — Phase 116 (Galdr Prompt Library)

## 116-02

- **Out-of-scope tsc error in `src/hooks/useAstridrVoice.test.ts`** (lines 2927, 2936, 2938):
  `Property '__astridrForceRecognizerReset' does not exist on type 'Window & typeof globalThis'`.
  This file was already modified in the shared working tree before 116-02 started (54
  uncommitted insertions, unrelated to Galdr) and is not part of this plan's `files_modified`
  list. Left untouched per scope boundary — not fixed, not staged, not committed.
