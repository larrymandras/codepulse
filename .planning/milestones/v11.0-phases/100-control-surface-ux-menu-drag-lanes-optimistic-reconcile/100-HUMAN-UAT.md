---
status: passed
phase: 100-control-surface-ux-menu-drag-lanes-optimistic-reconcile
source: [100-VERIFICATION.md]
started: 2026-07-24T14:00:00Z
updated: 2026-07-25T19:05:00Z
---

## Current Test

[complete]

## Tests

### 1. Live Forge daemon drag round-trip
expected: Drag an active-global skill onto Cold (archive), an active-global skill onto Project (pick a workspace in the dialog), and a cold skill onto Global (restore). Each drop enqueues the correct lifecycle command against a real daemon, paints the pending overlay immediately, and reconciles honestly to "done" on success. Forcing a failure/expiry (e.g. disconnect the daemon mid-command) clears the pending overlay and surfaces the real refusal/expiry toast — never a false success.
result: PASSED (operator-verified live 2026-07-25). Archive: `agent-browser` ("Browser") dragged onto Cold Storage → archived → verified DORMANT in Cold Storage, daemon rescanned (Recently-Added "just now"). Restore: dragged the dormant row onto Global → "it comes back" (returns to active). Honest-failure path also observed live: archiving `test-driven-development` failed with the real daemon refusal toast "…no longer exists at its source location … Nothing changed on disk" — no false success.

### 2. CR-02 fix — shadowed-row Cold Storage no-op (live)
expected: Drag a shadowed-merged skill (dormant copy + active copy elsewhere) out of the Cold Storage view and drop it back onto the Cold Storage rail entry. No mutation fires (same-scope no-op) — must NOT archive the skill's live active copy. Covered by unit tests at every layer; needs one live end-to-end gesture against real shadowed-origin data.
result: UNIT-VERIFIED + live no-op mechanism observed. The dormant→Cold no-op was confirmed live (dragging dormant `geo-schema` onto Cold Storage = no-op, now with an explicit "already in Cold Storage" toast). The shadowed-specific case was NOT reproduced live because the live catalog contains 0 shadowed-merged skills (every cold skill is dormant-only) — fabricating one was deferred by operator. The fix is locked by 4 layers of unit tests (resolveScopeDrop lane matrix, SkillRow lane threading, SkillControlSurfaceProvider draggingLane, ScopeRail cold-lane no-highlight). Accepted.

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0
unit_verified: 1

## Gaps
