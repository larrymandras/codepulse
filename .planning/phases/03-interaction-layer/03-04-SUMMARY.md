---
phase: 03-interaction-layer
plan: "04"
subsystem: ui
tags: [react, typescript, websocket, generative-ui, keyboard-navigation, tdd]

requires:
  - phase: 03-02
    provides: BlockRenderer component and GenerativeBlock types established in Plan 02

provides:
  - ChatBubble supports both GenerativeBlock arrays (block path) and markdown strings (content path)
  - Chat.tsx subscribes to run.block WS events and accumulates blocks per assistant message
  - Approve/reject handlers wired from Chat.tsx through ChatBubble to BlockRenderer/ApprovalBlock
  - Inbox page with full keyboard navigation (ArrowDown/Up, Enter, A, R, Escape)
  - Keyboard hints caption below InboxFilterBar
  - 8 passing Vitest tests for Inbox keyboard navigation

affects: [agent-chat, inbox, generative-ui, hitl-approval]

tech-stack:
  added: []
  patterns:
    - "Dual-path rendering: blocks[] takes priority over content string in ChatBubble — backward compatible extension"
    - "run.block WS event accumulates blocks into last streaming assistant message or creates new one"
    - "Keyboard handler useEffect depends on focusedIndex + filteredItems (useMemo stable ref)"
    - "scrollIntoView guarded with typeof check for jsdom test compatibility"
    - "TDD: RED commit of test stubs → GREEN commit of implementation"

key-files:
  created:
    - src/pages/__tests__/Inbox.test.tsx
  modified:
    - src/components/ChatBubble.tsx
    - src/pages/Chat.tsx
    - src/pages/Inbox.tsx

key-decisions:
  - "ChatBubble makes blocks[] the priority rendering path when present, falls back to ReactMarkdown for string content — no breaking change to existing callers"
  - "run.block handler appends to last streaming assistant message if session_id matches, otherwise creates new message — handles interleaved block/text streams"
  - "Inbox keyboard handler reads filteredItems from useMemo to avoid stale closures"
  - "scrollIntoView guarded with typeof check rather than polyfill — keeps test environment clean"

patterns-established:
  - "Dual-mode component pattern: check blocks && blocks.length > 0 before falling back to content string"
  - "WS event type narrowing: cast event to concrete type inline rather than annotating subscribeEvent callback parameter"

requirements-completed: [IL-02, IL-03]

duration: 25min
completed: 2026-04-13
---

# Phase 03 Plan 04: Generative UI Blocks in ChatBubble and Inbox Keyboard Navigation Summary

**ChatBubble upgraded to render GenerativeBlock arrays via BlockRenderer with backward-compatible markdown fallback; Inbox gains full keyboard navigation (ArrowDown/Up/Enter/A/R/Escape) with focus ring and keyboard hints caption, verified by 8 passing TDD tests.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-13T17:30:00Z
- **Completed:** 2026-04-13T17:40:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- ChatBubble.tsx extended with `blocks?: GenerativeBlock[]` and `onApprove`/`onReject` props; BlockRenderer dispatched when blocks array present
- Chat.tsx imports ChatMessage type from generative-blocks.ts (removes duplicate local type), subscribes to `run.block` WS events, accumulates blocks into streaming assistant messages; handleApprove/handleReject wired to sendCommand
- Inbox.tsx adds focusedIndex state, keyboard handler useEffect (ArrowDown/Up/Enter/A/R/Escape), focus ring wrapper divs, keyboard hints caption, and useMemo for filteredItems stability
- 8 Vitest tests written TDD-style (RED → GREEN) covering all keyboard interactions

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ChatBubble for GenerativeBlocks** - `57d4e03` (feat)
2. **Task 2 RED: Failing Inbox keyboard navigation tests** - `f059d58` (test)
3. **Task 2 GREEN: Inbox keyboard navigation implementation** - `30bc0cd` (feat)
4. **Task 2 fix: TypeScript type for mock.calls** - `daf4c69` (fix)

## Files Created/Modified

- `src/components/ChatBubble.tsx` — Extended with blocks prop, BlockRenderer import, dual rendering paths, onApprove/onReject callbacks
- `src/pages/Chat.tsx` — Replaced local ChatMessage type with import, added run.block subscription, handleApprove/handleReject handlers, blocks/onApprove/onReject passed to ChatBubble
- `src/pages/Inbox.tsx` — Added keyboard navigation state, handler useEffect, scroll-into-view effect, focus ring wrapper divs, keyboard hints caption, useMemo for filteredItems
- `src/pages/__tests__/Inbox.test.tsx` — 8 TDD tests for Inbox keyboard navigation (all passing)

## Decisions Made

- ChatBubble blocks[] path takes priority over content string — existing callers passing only `content` unaffected
- run.block event handler checks last message session_id match before appending, creates new message otherwise — handles interleaved block/text streams correctly
- scrollIntoView guarded with `typeof` check rather than adding a polyfill — keeps test setup minimal
- useMemo used for filteredItems to give keyboard handler a stable reference without causing stale closures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed subscribeEvent callback type annotation**
- **Found during:** Task 1 (Chat.tsx run.block subscription)
- **Issue:** TypeScript rejected typed callback parameter `(event: { session_id: string; block: GenerativeBlock })` — subscribeEvent expects `(event: Record<string, unknown>) => void`
- **Fix:** Used untyped `(event)` parameter and cast inline: `const data = event as { session_id: string; block: GenerativeBlock }`
- **Files modified:** src/pages/Chat.tsx
- **Verification:** `npx tsc --noEmit` — no errors in Chat.tsx
- **Committed in:** 57d4e03 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed scrollIntoView not available in jsdom**
- **Found during:** Task 2 GREEN (Inbox.tsx scroll effect)
- **Issue:** jsdom doesn't implement scrollIntoView — threw TypeError blocking 4 tests
- **Fix:** Guarded call with `typeof el.scrollIntoView === "function"` check
- **Files modified:** src/pages/Inbox.tsx
- **Verification:** All 8 tests pass after fix
- **Committed in:** 30bc0cd (Task 2 commit)

**3. [Rule 1 - Bug] Fixed approval_request event shape mismatch**
- **Found during:** Task 2 (tests vs Inbox.tsx event handler)
- **Issue:** Original Inbox.tsx only read from `event.data` envelope; tests inject flat events directly
- **Fix:** Inbox.tsx handler reads flat shape first (`event` itself) when `event.data` is absent
- **Files modified:** src/pages/Inbox.tsx
- **Verification:** approval items appear in DOM during tests; A/R key tests call sendCommand
- **Committed in:** 30bc0cd (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 bugs)
**Impact on plan:** All fixes necessary for type safety and test compatibility. No scope creep.

## Issues Encountered

- TypeScript's `subscribeEvent` callback signature (`TopicCallback`) is typed as `(event: Record<string, unknown>) => void` — cannot annotate callback parameters with concrete types. Resolved by inline cast after the parameter.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ChatBubble now fully supports Generative UI Blocks from run.block WS events
- Inbox keyboard navigation complete with all 6 bindings and visual focus indicators
- Both components ready for integration testing against live Ástríðr WebSocket

---
*Phase: 03-interaction-layer*
*Completed: 2026-04-13*
