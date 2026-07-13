---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 13
subsystem: ui
tags: [react, convex-frontend, websocket, hitl-approval, generative-blocks]

# Dependency graph
requires:
  - phase: 96-03
    provides: "ApprovalBlock.tsx ack-gating pattern (T-96-03-01) and the shared useApprovalActions hook (D-11)"
provides:
  - "InboxCard approve/reject gated on the server ack boolean (Promise<boolean>), matching ApprovalBlock's pattern"
  - "Inbox.tsx handleApprove/handleReject return Promise<boolean> instead of Promise<void>"
  - "Chat.tsx run.blocks (plural) subscription replacing the dead run.block (singular) subscription"
affects: [chat, inbox, hitl-approval-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ack-boolean gating: UI components that show approve/reject state MUST await the shared hook's Promise<boolean> and only commit visual state (setApproved/setRejected) on true, staying pending on false/throw"
    - "Dual-shape WS payload reads: event.data ?? event to support both envelope and flat event shapes (already used by Inbox.tsx's approval_request handler, now also by Chat.tsx's run.blocks handler)"

key-files:
  created: []
  modified:
    - src/pages/Inbox.tsx
    - src/components/InboxCard.tsx
    - src/pages/__tests__/Inbox.test.tsx
    - src/pages/Chat.tsx
    - src/pages/__tests__/Chat.test.tsx

key-decisions:
  - "InboxCard prop types changed Promise<void> -> Promise<boolean>; no new toasts added (the shared useApprovalActions hook remains sole toast owner)"
  - "Chat.tsx run.blocks handler reads event.data ?? event (dual-shape) and no-ops on missing/empty blocks array (T-96-13-02 tampering mitigation)"
  - "Chat.test.tsx injectApprovalBlock now emits a one-element blocks array on the run.blocks channel so existing approval-UI tests exercise the same block through the new plural path"

patterns-established:
  - "Second HITL consumer alignment: when a new component consumes useApprovalActions, its approve/reject callback props must be Promise<boolean> and its handler must gate on the resolved value, never assume success from a resolved promise alone"

requirements-completed: [D-11]

# Metrics
duration: 5min
completed: 2026-07-13
---

# Phase 96 Plan 13: Inbox Ack-Gating + Chat run.blocks Alignment Summary

**Closed two live-UAT-confirmed CodePulse gaps: InboxCard now gates Approved/Rejected on the server ack boolean (no more false success on a server-rejected decision), and Chat subscribes to the backend's real `run.blocks` (plural) event instead of the never-emitted `run.block` (singular).**

## Performance

- **Duration:** ~5 min (commits 15:16:56 -> 15:19:43)
- **Started:** 2026-07-13T19:16:56Z
- **Completed:** 2026-07-13T19:19:43Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- Fixed the live UAT false-success bug (T-96-13-01): a server-rejected Inbox approve/reject no longer flips the card to "Approved"/"Rejected" — it stays pending with its action buttons, and the shared `useApprovalActions` hook's `toast.error` is the only feedback shown.
- `Inbox.tsx`'s `handleApprove`/`handleReject` now return `Promise<boolean>` (forwarding the shared hook's ack result) instead of swallowing it as `Promise<void>`.
- `InboxCard.tsx`'s `onApprove`/`onReject` prop types and internal handlers now mirror the `ApprovalBlock.tsx` gating pattern exactly: `if (await onApprove(...)) setApproved(true)` wrapped in try/catch/finally, staying pending on a throw.
- Fixed event-name drift (T-96-13-02): `Chat.tsx` now subscribes to `run.blocks` (the backend's real, array-shaped event per `loop.py:1440`/`post_turn_pipeline.py:437`) instead of the dead `run.block` singular subscription. The handler reads `event.data ?? event` (dual-shape, matching Inbox's `approval_request` pattern), no-ops on a missing/empty `blocks` array, and spreads every block into the target assistant message.

## Task Commits

Each task was committed atomically (Task 1 used the TDD RED -> GREEN cycle per its `tdd="true"` marker):

1. **Task 1 RED: add failing false-success gating regression** - `4dfd7da` (test)
2. **Task 1 GREEN: gate InboxCard on the ack boolean** - `ae8dc70` (feat)
3. **Task 2: align Chat subscription to run.blocks** - `4ebbebb` (fix)

_No REFACTOR commit was needed — the GREEN implementation matched the target pattern (`ApprovalBlock.tsx`) directly._

## Files Created/Modified

- `src/pages/Inbox.tsx` - `handleApprove`/`handleReject` now return `Promise<boolean>` (the shared hook's ack result) instead of `Promise<void>`
- `src/components/InboxCard.tsx` - `onApprove`/`onReject` prop types changed to `Promise<boolean>`; handlers gate `setApproved(true)`/`setRejected(true)` on the awaited boolean, staying pending on throw
- `src/pages/__tests__/Inbox.test.tsx` - new `describe("Inbox — approval false-success gating (D-11)")` block: server-rejected approve stays pending, server-rejected reject stays pending, server-ok approve commits to approved
- `src/pages/Chat.tsx` - `run.block` (singular) subscription replaced with `run.blocks` (plural); handler reads `event.data ?? event`, guards on empty/missing `blocks`, spreads the array into the message; `unsubBlock` renamed `unsubBlocks`
- `src/pages/__tests__/Chat.test.tsx` - `getRunBlockCallback`/`injectApprovalBlock` moved to the `run.blocks` channel, emitting a one-element `blocks` array so the existing approval-UI tests still drive the same block through the new plural path

## Decisions Made

- No toasts added to `InboxCard`/`Inbox.tsx` — the shared `useApprovalActions` hook (from Phase 96 Plan 03) is the sole toast owner; this plan only wires the boolean it already produces through to the UI gate.
- `Chat.tsx`'s `run.blocks` handler intentionally supports both envelope (`event.data`) and flat (`event`) shapes rather than assuming one, matching the existing dual-shape pattern in `Inbox.tsx`'s `approval_request` handler and `LiveRun.tsx`'s `run.blocks` handler (both already live in this codebase).
- Left `RunBlockEvent` (the singular `run.block` type export in `src/types/generative-blocks.ts`) untouched — it is unused dead type-only code, out of scope for this plan's acceptance criteria (which target `Chat.tsx`'s subscription, not the shared type file), and removing it risks unrelated type-import breakage not covered by this plan's tests.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` and `<acceptance_criteria>` blocks without needing additional fixes.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both CodePulse-side gaps from `96-HUMAN-UAT.md` are closed: Inbox approval false-success (Gap 1) and Chat's dead `run.block` subscription (Gap 2).
- Two Ástríðr-backend gaps remain **out of scope** for this phase and are recorded in the plan's `<handoff_notes>`: (1) `chat.send` bypasses the security pipeline so HITL never trips on a CodePulse chat message, and (2) nothing in astridr emits an approval-type generative block into `run.blocks`. Until both land, the Chat half of the live approval round-trip stays untestable live — but Chat's `run.blocks` path is now correctly wired to receive them the moment the backend emits them, and the Inbox half is fully correct and live-verifiable today.
- No blockers for closing out Phase 96.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: `.planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-13-SUMMARY.md`
- FOUND: `4dfd7da` (test: RED)
- FOUND: `ae8dc70` (feat: GREEN)
- FOUND: `4ebbebb` (fix: Task 2)
