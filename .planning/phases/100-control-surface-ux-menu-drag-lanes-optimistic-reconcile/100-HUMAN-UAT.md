---
status: partial
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
source: [100-VERIFICATION.md]
started: 2026-07-24T14:00:00Z
updated: 2026-07-24T14:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Forge daemon drag round-trip
expected: Drag an active-global skill onto Cold (archive), an active-global skill onto Project (pick a workspace in the dialog), and a cold skill onto Global (restore). Each drop enqueues the correct lifecycle command against a real daemon, paints the pending overlay immediately, and reconciles honestly to "done" on success. Forcing a failure/expiry (e.g. disconnect the daemon mid-command) clears the pending overlay and surfaces the real refusal/expiry toast — never a false success.
result: [pending]

### 2. CR-02 fix — shadowed-row Cold Storage no-op (live)
expected: Drag a shadowed-merged skill (dormant copy + active copy elsewhere) out of the Cold Storage view and drop it back onto the Cold Storage rail entry. No mutation fires (same-scope no-op) — must NOT archive the skill's live active copy. Covered by unit tests at every layer; needs one live end-to-end gesture against real shadowed-origin data.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
