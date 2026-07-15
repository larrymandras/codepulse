---
phase: quick-260713-q9k
plan: 01
subsystem: ui
tags: [react, chat, generative-blocks, approval, websocket, vitest]

requires:
  - phase: astridr 178.1
    provides: "ApprovalBlock Pydantic model (agent/response.py) that emits a PENDING approval block on gate, then a RESOLUTION block with the same requestId and an updated status (approved/rejected/expired)"
provides:
  - "ApprovalBlockData.status optional wire field (pending|approved|rejected|expired)"
  - "ApprovalBlock renders an externally-supplied resolved status with the same visual states as a local click, and suppresses Approve/Reject buttons when not pending"
  - "Chat run.blocks handler flips a matching-requestId approval card in place instead of appending a duplicate"
affects: [chat, inbox, generative-blocks]

tech-stack:
  added: []
  patterns:
    - "Update-by-requestId merge: partition an incoming block array into UPDATES (matching-requestId approval blocks, replaced in place preserving array position) and APPENDS (everything else), so ChatBubble's key={idx} keeps the same component instance and the card flips instead of remounting."
    - "Effective status derivation in a stateful card: effective = (local state resolved) ? local state : (wire status ?? pending) — lets local click-driven resolution take precedence while still allowing an external wire-status flip to drive the same resolved render paths."

key-files:
  created:
    - src/components/blocks/__tests__/ApprovalBlock.test.tsx
  modified:
    - src/types/generative-blocks.ts
    - src/components/blocks/ApprovalBlock.tsx
    - src/pages/Chat.tsx
    - src/pages/__tests__/Chat.test.tsx

key-decisions:
  - "requestId match in Chat.tsx is global (not session_id-scoped) — requestId is server-minted globally unique per response.py, so scoping by session would risk missing a resolution routed on a different session_id."
  - "Effective status in ApprovalBlock defers to local state only once it has left 'pending' (i.e. only after a real local click), so a still-pending local click never overrides a matching external wire status."
  - "A resolution-only run.blocks event (all blocks matched as UPDATES, appends empty) never seeds a new empty assistant message — returns the update-applied array as-is."

requirements-completed: [D-05]

duration: 6min
completed: 2026-07-13
---

# Quick Task 260713-q9k: ApprovalBlock update-by-id in Chat Summary

**Chat's `run.blocks` handler now flips an existing approval card in place on a matching-requestId resolution event, and `ApprovalBlock` renders the wire-supplied `status` with the same resolved visual states as a local click — closing the D-05 consumer side of the astridr↔CodePulse approval-block contract.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-13T18:58:43-04:00
- **Completed:** 2026-07-13T19:04:44-04:00
- **Tasks:** 2 completed
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- `ApprovalBlockData` gained an optional `status?: "pending"|"approved"|"rejected"|"expired"` field, matching the unaliased wire key confirmed live against `astridr/agent/response.py`.
- `ApprovalBlock` now derives an "effective status" (local resolution takes precedence once resolved, otherwise falls back to `block.status ?? "pending"`), added an `"expired"` resolved render, and naturally suppresses Approve/Reject buttons for any non-pending effective status (they only render in the pending branch).
- `Chat.tsx`'s `run.blocks` handler now partitions incoming blocks into UPDATES (approval blocks whose `requestId` already exists in `messages`) and APPENDS (unseen-requestId approvals + all non-approval blocks); UPDATES replace the existing block in place (spread-merge, position preserved) so `ChatBubble`'s `key={idx}` keeps the same component instance and the card flips instead of duplicating.

## Task Commits

Each task followed RED → GREEN TDD:

1. **Task 1: Add status to the wire type and make ApprovalBlock render external resolved status**
   - `eb79cc5` (test) — failing test for approved/rejected/expired/pending rendering + button gating + local-click regression
   - `5a307d8` (feat) — effective-status derivation, expired render, buttons naturally gated
2. **Task 2: run.blocks update-by-requestId merge in Chat**
   - `7221bdf` (test) — failing test for in-place flip; unknown-requestId append and non-approval append tests passed immediately (pre-existing append-only behavior), confirmed as regression guards
   - `307b90a` (feat) — UPDATES/APPENDS partition + in-place merge, resolution-only events never seed an empty message

**Plan metadata:** this commit (docs: complete plan, SUMMARY.md)

## Files Created/Modified
- `src/types/generative-blocks.ts` - added optional `status` field to `ApprovalBlockData`
- `src/components/blocks/ApprovalBlock.tsx` - effective-status derivation, `"expired"` resolved render, extended `ApprovalStatus` union
- `src/components/blocks/__tests__/ApprovalBlock.test.tsx` - new component test (5 cases) for external status + button gating + local click
- `src/pages/Chat.tsx` - reworked `run.blocks` handler: requestId lookup, UPDATES/APPENDS partition, in-place merge, resolution-only no-seed
- `src/pages/__tests__/Chat.test.tsx` - extended `injectApprovalBlock` to merge extra fields, added `injectResolutionBlock`/`injectMarkdownBlock` helpers, added 3 new regression tests (a/b/c)

## Decisions Made
See `key-decisions` in frontmatter above. Notably: requestId matching is global (not session-scoped) per the server-minted-globally-unique guarantee in `response.py`, and a resolution-only event must never seed an empty assistant message.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<interfaces>` block wire-key claims were confirmed directly against `C:/Users/mandr/astridr-repo/astridr/agent/response.py` before coding (unaliased `status`, camelCase `requestId`/`riskLevel`/`agentName` serialization aliases) and matched exactly.

## TDD Gate Compliance

Both tasks are `tdd="true"`. Git log confirms the required gate sequence for each:
- Task 1: `test(260713-q9k)` (eb79cc5) → `feat(260713-q9k)` (5a307d8)
- Task 2: `test(260713-q9k)` (7221bdf) → `feat(260713-q9k)` (307b90a)

RED was verified for each task by running the new test against the pre-implementation code (Task 1: 3/5 new cases failed as expected; Task 2: test (a) failed as expected, tests (b)/(c) passed immediately since the append-only baseline already satisfied those regression guards — this is expected, not a RED-skip, since (b)/(c) encode *unchanged* behavior).

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- D-05 consumer side of the astridr↔CodePulse approval-block contract is closed: a resolution `run.blocks` event with a matching `requestId` flips the existing card in place, an unseen `requestId` still appends (resolution-only fallback intact), and non-approval blocks are never update-matched.
- Verification commands: `npx vitest run src/components/blocks/__tests__/ApprovalBlock.test.tsx src/pages/__tests__/Chat.test.tsx` (12/12 passed) and `npx tsc --noEmit` (clean). Full suite also run (177 test files passed, 17 skipped — pre-existing/unrelated).
- No blockers for downstream work.

---
*Quick task: 260713-q9k*
*Completed: 2026-07-13*

## Self-Check: PASSED

All 6 claimed files found on disk; all 4 claimed commit hashes (eb79cc5, 5a307d8, 7221bdf, 307b90a) found in git log.
