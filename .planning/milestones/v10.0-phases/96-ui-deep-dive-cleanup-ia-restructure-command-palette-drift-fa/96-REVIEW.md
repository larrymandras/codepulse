---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
reviewed: 2026-07-13T00:00:00Z
depth: standard
scope: gap-closure-delta (plan 96-13)
diff_base: 34cf6e101e9b8ab6c4ac4926abbbe809cb76bd17
delta_commits:
  - 4dfd7da
  - ae8dc70
  - 4ebbebb
files_reviewed: 5
files_reviewed_list:
  - src/pages/Inbox.tsx
  - src/components/InboxCard.tsx
  - src/pages/__tests__/Inbox.test.tsx
  - src/pages/Chat.tsx
  - src/pages/__tests__/Chat.test.tsx
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: clean
---

# Phase 96: Code Review Report — Plan 96-13 Gap-Closure Delta

**Reviewed:** 2026-07-13
**Depth:** standard
**Files Reviewed:** 5
**Status:** clean

**Note on scope:** This is a targeted delta review for gap-closure plan 96-13 only,
covering the InboxCard/Inbox ack-boolean gating fix (T-96-13-01) and the Chat
`run.block` → `run.blocks` subscription alignment (T-96-13-02), plus the tests
added/renamed for both. The full 63-file review of phase 96 already ran earlier;
its findings were fixed and committed, and that report is preserved in git
history (`git log -p -- .planning/phases/96-*/96-REVIEW.md`). This report
overwrites that file per the workflow's gap-closure convention — the prior
content is not reproduced here but remains recoverable via git.

## Summary

Reviewed the exact diff introduced by commits `4dfd7da`, `ae8dc70`, `4ebbebb`
against `diff_base` `34cf6e1`:

1. **InboxCard/Inbox ack gating (T-96-13-01):** `onApprove`/`onReject` props
   changed from `Promise<void>` to `Promise<boolean>`. `InboxCard` now only
   flips to the "Approved"/"Rejected" terminal state when the callback
   resolves `true`, and added `try/catch` so a throwing callback also leaves
   the card pending. `Inbox.tsx`'s `handleApprove`/`handleReject` now return
   `true`/`false` to match. This mirrors the already-shipped pattern in
   `src/components/blocks/ApprovalBlock.tsx` exactly (verified side-by-side —
   same `if (await onApprove(...)) setApproved(true)` / empty-catch-with-comment
   structure).

2. **Chat `run.blocks` alignment (T-96-13-02):** The subscription topic
   renamed from `run.block` (singular, single-`block` field) to `run.blocks`
   (plural, `blocks` array field), with a dual envelope-shape reader
   (`event.data ?? event`) matching the pattern already used for
   `approval_request` in `Inbox.tsx`. Verified against the live astridr
   backend (`astridr-repo`): `loop.py:1440` and `post_turn_pipeline.py:437`
   both call `telemetry.send("run.blocks", {"session_id": ..., "blocks": [...]})`
   with a flat payload (no `.data` wrapper), and `"run.block"` (singular) does
   not appear anywhere as an `event_type` in the backend — confirming the
   comment's claim that the old singular path was dead code. `run.blocks` is
   also present in `ws_telemetry.py`'s `TOPIC_EVENT_MAP` under `live-runs`
   and in the frontend's own `EVENT_TO_TOPICS`/`ALL_TOPICS`, so the
   subscription is correctly wired end-to-end.

3. **Tests:** `Inbox.test.tsx` gained a new describe block exercising both
   the server-reject and server-ok paths for approve/reject through the full
   `Inbox` → `InboxCard` render tree. `Chat.test.tsx` renamed its helper
   (`getRunBlockCallback` → `getRunBlocksCallback`) and updated the injected
   fixture to the array shape; its four approval-payload/ack tests already
   covered the false-success gating for Chat's `ApprovalBlock` path from an
   earlier gap-closure plan and continue to pass unmodified in substance.

Verification performed beyond static reading: ran
`npx vitest run src/pages/__tests__/Inbox.test.tsx src/pages/__tests__/Chat.test.tsx`
(15/15 passed), ran `npx tsc --noEmit` (no errors touching these files), and
cross-checked the wire contract against the live `astridr-repo` backend
source rather than trusting the in-code comments as fact.

No Critical or Warning findings. Two Info-level observations below — neither
blocks or degrades correctness of this delta.

## Info

### IN-01: `InboxCard`'s new catch blocks are currently unreachable

**File:** `src/components/InboxCard.tsx:159-166`, `169-182`
**Issue:** The new `try { if (await onApprove(...)) setApproved(true); } catch { /* stay pending */ }`
(and the equivalent for reject) can only execute if the `onApprove`/`onReject`
callback throws. The only production callback wired to these props
(`useApprovalActions` in `src/components/ApprovalActions.tsx:58-106`) is
documented and implemented to never throw — it catches `sendCommand`
rejections internally and resolves `false` instead. So today these catch
blocks are dead code. This is not a defect: it exactly mirrors the identical,
already-shipped defensive pattern in `src/components/blocks/ApprovalBlock.tsx:44-58`,
so it's consistent with established codebase convention rather than a new
inconsistency. Flagging only because the catch bodies are silent (no toast,
no log) — if a future `onApprove`/`onReject` implementation is wired in that
*does* throw, the failure will be invisible to the user (spinner just stops).
**Fix:** No action required for this delta. If ever exercised, consider a
generic `toast.error("Approve failed")` inside the catch for parity with the
hook's own error toasting — optional hardening, not a regression fix.

### IN-02: No test exercises multiple blocks in a single `run.blocks` event or merges across two events

**File:** `src/pages/__tests__/Chat.test.tsx:69-87`
**Issue:** `injectApprovalBlock` always sends `blocks: [ <single block> ]`.
The production merge logic being validated by this rename
(`src/pages/Chat.tsx:209-231`) supports appending an arbitrary number of
blocks from one event (`[...(last.blocks ?? []), ...blocks]`) and merging
across successive `run.blocks` events for the same streaming message. Neither
of those two paths (N>1 blocks in one event; two events both matching
`last.sessionId`) has a dedicated assertion in the delta's test additions —
the existing four tests only cover the single-block approval payload/ack
contract, which is a different concern (T-96-13-01-style gating in Chat) than
the array-merge mechanics being introduced by T-96-13-02.
**Fix:** Optional follow-up test:
```ts
test("run.blocks accumulates multiple blocks across two events into one message", () => {
  renderChat();
  const cb = getRunBlocksCallback()!;
  act(() => cb({ session_id: "s1", blocks: [{ type: "markdown", content: "a" }] }));
  act(() => cb({ session_id: "s1", blocks: [{ type: "markdown", content: "b" }] }));
  // assert the rendered assistant message reflects both blocks, not just the last
});
```

---

_Reviewed: 2026-07-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
