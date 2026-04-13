---
status: partial
phase: 03-interaction-layer
source: [03-VERIFICATION.md]
started: 2026-04-13T18:00:00-04:00
updated: 2026-04-13T18:00:00-04:00
---

## Current Test

[awaiting human testing]

## Tests

### 1. Insights Chat LLM path
expected: With OPENAI_API_KEY in Convex env, ask "What is my current total cost?" — metric block and LLM summary should appear in chat
result: [pending]

### 2. Cmd+K live search filtering
expected: Press Cmd+K, type an agent name — cmdk filters CommandItems correctly with live Convex data, selecting a result navigates to the target page
result: [pending]

### 3. Live Run Widget streaming
expected: Trigger an agent run, verify accordion rounds appear in RunTimeline with amber stripe on active round, stop button toggles correctly
result: [pending]

### 4. Approval Block in Agent Chat
expected: When Astridr emits run.block with type "approval", approve/reject buttons appear in ChatBubble, clicking one collapses the card to confirmation text
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
