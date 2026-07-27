---
phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa
plan: 03
subsystem: ui
tags: [react, websocket, hitl-approval, chat, inbox, page-header]

# Dependency graph
requires:
  - phase: 96-01
    provides: "src/components/PageHeader.tsx (shared F7 header component)"
provides:
  - "Correct, ack-checked Chat.tsx approval sender (F6 fix — was sending a malformed payload the server rejected)"
  - "src/components/ApprovalActions.tsx — shared useApprovalActions(sendCommand) hook (D-11), sole owner of the approval.respond wire shape"
  - "Chat + Inbox migrated to <PageHeader> with max-h-[500px] caps removed (F7)"
affects: [96-04, 96-05, 96-06, 96-07, 96-08, 96-09, 96-10, 96-11, 96-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared WS-command hook (useApprovalActions) as the single source of truth for a Pydantic-mirrored wire payload — callers decide post-ack side effects from the boolean return, the hook owns the toast"

key-files:
  created:
    - src/components/ApprovalActions.tsx
    - src/pages/__tests__/Chat.test.tsx
  modified:
    - src/pages/Chat.tsx
    - src/pages/Inbox.tsx
    - src/components/BlockRenderer.tsx
    - src/components/ChatBubble.tsx

key-decisions:
  - "useApprovalActions returns Promise<boolean> (not void) so Inbox can gate its optimistic 'mark item read' state update on ack success, matching Inbox's pre-existing (correct) behavior exactly"
  - "Payload objects built with `satisfies ApprovalRespondPayload` rather than an explicit `: ApprovalRespondPayload` annotation — avoids a TS2345 'missing index signature' error when passing to sendCommand(cmd: Record<string, unknown>), while still getting compile-time validation against the Pydantic-mirrored interface"
  - "ApprovalBlock.tsx (Chat's inline approval card, not in this plan's files_modified) was left unchanged — its onApprove?.(id) call is fire-and-forget by design and structurally accepts the new Promise<void>-returning handler (TS void-return compatibility), so no edit was required for either behavior or type-checking"

requirements-completed: [F6, D-11, F7]

# Metrics
duration: ~30min
completed: 2026-07-13
---

# Phase 96 Plan 03: Chat Approval Fix + Shared ApprovalActions + Header Migration Summary

**Fixed Chat.tsx's malformed `approval.respond` payload (server-rejected `{requestId, approved}` → correct `{request_id_target, decision}`), extracted a single shared `useApprovalActions` hook now consumed by both Chat and Inbox, and migrated both pages to `<PageHeader>` with their anomalous `max-h-[500px]` caps removed.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-07-13
- **Tasks:** 3/3 completed
- **Files modified:** 6 (1 new component, 1 new test, 4 modified)

## Accomplishments

- Closed the phase's one access-control (V4) fix: Chat's approve/reject buttons now send the Ástríðr-server-correct `ApprovalRespondCommand` shape and await the ack, so a rejected/errored command no longer shows a false "Approved" success toast (T-96-03-01 repudiation bug fixed).
- Extracted `src/components/ApprovalActions.tsx` — a `useApprovalActions(sendCommand)` hook that is now the ONLY place in the codebase that constructs the `approval.respond` wire payload, with a compile-time TS type (`ApprovalRespondPayload`) mirroring the Pydantic `ApprovalRespondCommand` 1:1 (T-96-03-03).
- Inbox.tsx refactored to consume the same shared hook (its behavior was already correct; this just removes the duplicated inline sendCommand logic — D-11 satisfied).
- Chat.tsx and Inbox.tsx headers standardized on `<PageHeader>` (F7); both pages' `max-h-[500px]` wrapper caps removed so the panels fill full available height.
- 4 new regression tests (`Chat.test.tsx`) encode the correct contract and would catch any future regression back to the broken shape or an unconditional success toast.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED test for Chat approval payload + ack handling** - `607d336` (test)
2. **Task 2: Extract shared ApprovalActions; fix Chat + rewire Inbox (GREEN)** - `1f31d42` (feat)
3. **Task 3: Migrate Chat + Inbox headers to PageHeader; remove max-h caps (F7)** - `2a2ee29` (refactor)

_TDD gate compliance: RED (`607d336`, `test(96-03):...`) confirmed 3/4 tests failing against the broken Chat.tsx before GREEN (`1f31d42`, `feat(96-03):...`) made all 12 tests (4 Chat + 8 Inbox) pass. See "TDD Gate Compliance" below._

## Files Created/Modified

- `src/components/ApprovalActions.tsx` - New shared `useApprovalActions(sendCommand)` hook; owns the `ApprovalRespondPayload` type and the ack-checked approve/reject + toast logic
- `src/pages/__tests__/Chat.test.tsx` - New regression test: payload shape (request_id_target/decision, not requestId/approved) + ack-branching toast behavior
- `src/pages/Chat.tsx` - Broken `handleApprove`/`handleReject` replaced with calls into the shared hook; header migrated to `<PageHeader>`; `max-h-[500px]` removed
- `src/pages/Inbox.tsx` - `handleApprove`/`handleReject` refactored to consume the shared hook (gates the "mark item read" update on the hook's boolean return); header migrated to `<PageHeader>`; `max-h-[500px]` removed
- `src/components/BlockRenderer.tsx` - `onApprove`/`onReject` prop types updated from sync `void` to async `Promise<void>` to match the standardized signature
- `src/components/ChatBubble.tsx` - Same prop-type update (pass-through to `BlockRenderer`), required for type consistency down the `Chat.tsx` → `ChatBubble` → `BlockRenderer` chain

## Decisions Made

See `key-decisions` in frontmatter above:
- `useApprovalActions` returns `Promise<boolean>` so callers (specifically Inbox) can gate side effects on ack success without duplicating the ack-check logic.
- Payload objects use `satisfies ApprovalRespondPayload` instead of an explicit type annotation to satisfy both compile-time contract validation and `sendCommand`'s `Record<string, unknown>` parameter type.
- `ApprovalBlock.tsx` intentionally left untouched (out of this plan's file scope; TS's void-return compatibility rule means no type error results from the signature change upstream).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated ChatBubble.tsx prop types alongside BlockRenderer.tsx**
- **Found during:** Task 2 (Extract shared ApprovalActions; fix Chat + rewire Inbox)
- **Issue:** The plan's files list for Task 2 named `BlockRenderer.tsx` for the `onApprove`/`onReject` signature update but not `ChatBubble.tsx`, which declares an identical, independently-typed `onApprove`/`onReject` prop pair and passes them straight through to `BlockRenderer`. Leaving it as `(requestId: string) => void` would have been an inconsistent, stale type one level up the same prop chain.
- **Fix:** Updated `ChatBubble.tsx`'s `onApprove`/`onReject` prop types to `Promise<void>`-returning, matching `BlockRenderer.tsx` and `InboxCard.tsx`.
- **Files modified:** `src/components/ChatBubble.tsx`
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run src/pages/__tests__/Chat.test.tsx src/pages/__tests__/Inbox.test.tsx` green (12/12)
- **Committed in:** `1f31d42` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking/type-consistency)
**Impact on plan:** Necessary for type consistency across the prop chain; no behavior change, no scope creep.

## TDD Gate Compliance

- RED gate: `607d336` `test(96-03): RED test for Chat approval payload + ack handling` — 3 of 4 tests failed against the pre-fix Chat.tsx (confirmed live before writing the fix).
- GREEN gate: `1f31d42` `feat(96-03): extract shared ApprovalActions; fix Chat approval payload (F6, D-11)` — all 4 Chat tests + all 8 existing Inbox tests pass (12/12).
- REFACTOR gate: Task 3 (`2a2ee29`) is a separate `auto` task (header migration), not part of this TDD cycle's refactor step; no refactor-only commit was needed for the approval-payload fix itself since Task 2 already left the code in its target shape.

Gate sequence present in git log — compliant.

## Issues Encountered

None. Re-verified the server contract against `C:\Users\mandr\astridr-repo\astridr\api\ws_commands.py:95-100` before building the shared component, per the plan's `<interfaces>` instruction — `ApprovalRespondCommand`'s fields (`type`, `request_id`, `request_id_target`, `decision`, `comment`) matched the plan's documented shape exactly; no drift found.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Chat's HITL approval gate is now reachable and correct end-to-end on the client side; the plan's own verification block flags a **Manual-Only** live round-trip against a running astridr instance (per 96-VALIDATION) as the remaining check — not run here (no live astridr backend available in this execution context).
- `ApprovalActions.tsx` is now the reusable extension point for any future surface that needs to send `approval.respond` (e.g. a notifications panel or command palette action) — consume `useApprovalActions(sendCommand)` rather than re-inlining the payload shape.
- No blockers for subsequent 96-xx plans in this wave.

---
*Phase: 96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa*
*Plan: 03*
*Completed: 2026-07-13*

## Self-Check: PASSED

- FOUND: src/components/ApprovalActions.tsx
- FOUND: src/pages/__tests__/Chat.test.tsx
- FOUND: .planning/phases/96-ui-deep-dive-cleanup-ia-restructure-command-palette-drift-fa/96-03-SUMMARY.md
- FOUND: 607d336 (test commit)
- FOUND: 1f31d42 (feat commit)
- FOUND: 2a2ee29 (refactor commit)
