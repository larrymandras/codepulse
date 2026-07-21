---
status: partial
phase: 98-skill-lifecycle-mutations-archive-restore-move-delete
source: [98-VERIFICATION.md]
started: 2026-07-21T18:20:00Z
updated: 2026-07-21T18:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real cross-volume move (C: global/cold ↔ G:\ project workspace)
expected: The skill directory relocates on disk (copy+delete fallback works against the live Google Drive mount) and the Skills page shows the new lane after rescan
result: [pending]

### 2. Archive / restore / permanent-delete round-trip against a live Forge daemon
expected: Archiving a global skill moves it to ~/.claude/skills-available/ and the Skills page shows it dormant after rescan; restoring moves it back and clears the dormant lane; permanently deleting a cold row (type-to-confirm) removes the directory and the row disappears
result: [pending]

### 3. Offline-daemon expiry (LIFE-06)
expected: With the daemon stopped, issuing an archive shows the command queued, then visibly expires (status badge 'expired') once the 5-minute TTL passes — never a false success state
result: [pending]

### 4. Menu scope-gating and shadow/multi-scope tooltips live in the browser
expected: Active single-scope row shows Archive + one Move item; dormant row shows Restore + Delete Permanently; shadowed dormant row shows Restore disabled with the shadow tooltip (and does NOT blank the Skills page — CR-02 regression); multi-scope row shows Archive/Move disabled with the honest reason
result: [pending]

### 5. LAYER-1 refusal toast surfaces correctly in the browser (CR-03 fix)
expected: Clicking Archive on a skill that already has a dormant cold copy shows a toast with the house-copy refusal reason instead of doing nothing
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
