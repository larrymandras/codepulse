---
status: partial
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
source: [96-VERIFICATION.md]
started: 2026-07-13T15:45:00Z
updated: 2026-07-13T15:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Chat approval round-trip against running Ástríðr backend

expected: With the Ástríðr backend running, trigger an approval request that surfaces in CodePulse Chat. Clicking Approve/Deny sends `approval.respond` with `{request_id_target, decision}` — the backend's Pydantic `ApprovalRespondCommand` accepts it (no validation error in backend logs). The Chat block stays pending until the ack resolves, then flips to approved/denied. Force a rejection (e.g., respond to an expired/unknown request) and confirm an error toast appears and the block does NOT show false success. Cross-check the same flow from Inbox (shared `useApprovalActions` hook).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
