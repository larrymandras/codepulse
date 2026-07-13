---
status: complete
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
source: [96-VERIFICATION.md]
started: 2026-07-13T15:45:00Z
updated: 2026-07-13T19:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Live Chat approval round-trip against running Ástríðr backend

expected: With the Ástríðr backend running, trigger an approval request that surfaces in CodePulse Chat. Clicking Approve/Deny sends `approval.respond` with `{request_id_target, decision}` — the backend's Pydantic `ApprovalRespondCommand` accepts it (no validation error in backend logs). The Chat block stays pending until the ack resolves, then flips to approved/denied. Force a rejection (e.g., respond to an expired/unknown request) and confirm an error toast appears and the block does NOT show false success. Cross-check the same flow from Inbox (shared `useApprovalActions` hook).
result: issue
reported: "Sent 'Please send an email to test@example.com saying hello' in CodePulse Chat. No approval block appeared; agent replied 'I've sent an email...' immediately. Nothing in Telegram either."
severity: major
diagnosis: |
  Root-caused during the session (three independent gaps, all confirmed with file:line evidence):
  1. BACKEND (astridr-repo): CodePulse `chat.send` bypasses the security pipeline entirely.
     `_handle_chat_send` (astridr/api/ws_commands.py:443) → `_ws_agent_launcher`
     (astridr/engine/bootstrap/wiring.py:105-142) calls `sub_loop.run()` directly. The ONLY
     caller of `pipeline.process_inbound` is astridr/channels/security_runner.py:73 (channel
     path, e.g. Telegram). So a chat message from CodePulse can never trip the HITL gate,
     even though `hitl_block_on_escalation=True` is hardcoded at boot
     (astridr/engine/bootstrap/security.py:61) and the message matched the `email_send`
     trigger (astridr/security/hitl_gate.py:63-66).
  2. CODEPULSE: Chat.tsx:198 subscribes to `run.block` (singular); the backend only emits
     `run.blocks` (plural — agent/loop.py:1435, agent/post_turn_pipeline.py:432,
     engine/ws_telemetry.py:59). The Chat ApprovalBlock subscription can never fire live;
     it is only exercised by tests (Chat.test.tsx injects `run.block` directly).
  3. BACKEND: no producer of approval-type generative blocks exists anywhere in astridr —
     nothing ever emits a block with `type: "approval"`. The only live approval surface is
     Inbox via the `approval_request` telemetry event (_dashboard_approval_callback,
     astridr/engine/bootstrap/wiring.py:163+).
  Net: the Chat half of this test is untestable live (backend gaps #1/#3 are astridr scope;
  #2 is CodePulse-side dead code / event-name drift). The Inbox half remains testable by
  triggering the HITL gate via Telegram.

  INBOX HALF — tested live via Telegram trigger:
  - HAPPY PATH PASSED: Telegram-triggered email_send escalation surfaced as Inbox card
    (risk badge, profile, payload). Dashboard Approve round-tripped cleanly — backend log
    `hitl_gate.respond approved=True` + `hitl_gate.resolved decided_by=dashboard
    decision=Approved` (request 1d834597), NO Pydantic validation error. The F6
    `request_id_target` payload fix is confirmed working live.
  - ERROR PATH: request aba9870e resolved via Telegram first; dashboard click 1s later
    correctly rejected server-side (`ws_command.handler_error: No pending request found`)
    and the error toast appeared (shared useApprovalActions hook works). BUT the InboxCard
    still flipped to "Approved" — FALSE SUCCESS. Root cause: InboxCard.tsx:150-158 calls
    `await onApprove(...)` then `setApproved(true)` UNCONDITIONALLY; Inbox.tsx:191-202
    handleApprove returns Promise<void>, swallowing the hook's boolean. The T-96-03-01
    false-success fix was applied to Chat's ApprovalBlock (which correctly gates:
    ApprovalBlock.tsx:51 `if (await onApprove(...)) setStatus("approved")`) but NOT to
    InboxCard. This is a genuine phase-96 gap (D-11 intended both consumers to gate on
    the ack boolean).

## Summary

total: 1
passed: 0
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Approval request triggered from CodePulse Chat surfaces as a pending ApprovalBlock; Approve/Deny round-trips `approval.respond` and flips state only on server ack"
  status: failed
  reason: "User reported: no approval block appeared in Chat; agent replied 'I've sent an email...' with no gate; nothing in Telegram"
  severity: major
  test: 1
  artifacts:
    - "astridr-repo: astridr/api/ws_commands.py:443 (_handle_chat_send launches agent directly)"
    - "astridr-repo: astridr/engine/bootstrap/wiring.py:105-142 (_ws_agent_launcher — no process_inbound call)"
    - "astridr-repo: astridr/channels/security_runner.py:73 (only process_inbound caller — channel path only)"
    - "codepulse: src/pages/Chat.tsx:198 (subscribes to 'run.block' — backend emits only 'run.blocks')"
  missing:
    - "astridr: route chat.send messages through security pipeline process_inbound (or a tool-exec gate that emits into chat)"
    - "astridr: emitter for approval-type generative blocks into the chat session (run.block/run.blocks)"
    - "codepulse: align Chat.tsx subscription with the real backend event name once one exists"

- truth: "Inbox approval card only shows Approved/Rejected when the server ack'd the decision (no false success)"
  status: failed
  reason: "User reported: error toast 'No pending request found' appeared correctly, but the stale card still flipped to 'Approved'"
  severity: major
  test: 1
  artifacts:
    - "codepulse: src/components/InboxCard.tsx:150-158 (setApproved(true) unconditional after await onApprove)"
    - "codepulse: src/pages/Inbox.tsx:191-215 (handleApprove/handleReject return Promise<void>, swallow hook boolean)"
    - "codepulse: src/components/blocks/ApprovalBlock.tsx:51 (correct pattern — gates on boolean)"
  missing:
    - "Inbox.tsx handleApprove/handleReject must return the hook's boolean"
    - "InboxCard.tsx must gate setApproved/setRejected on that boolean (mirror ApprovalBlock.tsx)"
    - "test: server-rejected approve/reject leaves InboxCard pending (mirror Chat.test.tsx false-success specs)"
