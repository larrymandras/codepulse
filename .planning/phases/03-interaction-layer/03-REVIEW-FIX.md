---
phase: 03-interaction-layer
fixed_at: 2026-04-13T21:58:43Z
review_path: .planning/phases/03-interaction-layer/03-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-13T21:58:43Z
**Source review:** .planning/phases/03-interaction-layer/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 critical, 5 warnings)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Stop button sends malformed command — `action` instead of `type`

**Files modified:** `src/pages/LiveRun.tsx`
**Commit:** 9bd5396
**Applied fix:** Changed `sendCommand({ action: "run.stop" })` to `void sendCommand({ type: "run.stop" })` so the WS dispatcher receives the correct routing key, matching all other commands in the codebase.

### WR-01: InsightsChat allows concurrent sends — second question fires while first is loading

**Files modified:** `src/pages/InsightsChat.tsx`
**Commit:** 365fcd1
**Applied fix:** Added `|| loading` guard to `handleSend` early-return condition and added `loading` to the `useCallback` dependency array, preventing concurrent `askInsights` calls when a response is already in flight.

### WR-02: Second LLM call in `insightsChat.ts` re-sends TOOLS definitions, enabling additional tool calls

**Files modified:** `convex/insightsChat.ts`
**Commit:** 519adcc
**Applied fix:** Added optional `assistantToolCallMessage` parameter to `callLLM`. In the messages assembly, the assistant's `tool_calls` turn is now inserted before tool result messages when provided. Updated the Step 3 call site to pass `choice` as the assistant message, satisfying the OpenAI multi-turn tool call protocol.

### WR-03: Keyboard 'R' key in Inbox immediately fires rejection without reason — no confirm step

**Files modified:** `src/pages/Inbox.tsx`
**Commit:** 1e6bca3
**Applied fix:** Changed the `r` keypress handler to call `setExpandedId(item.id)` instead of `void handleReject(item.requestId)`. This expands the card so the user can fill in an optional reason and confirm via the UI, matching the mouse-driven rejection flow.

### WR-04: `cardRefs` array in Inbox is not pruned when items are removed — stale refs corrupt keyboard focus

**Files modified:** `src/pages/Inbox.tsx`
**Commit:** aa6ea50
**Applied fix:** Added a `useEffect` keyed on `filteredItems.length` that (1) prunes `cardRefs.current` to the current list length via `slice`, and (2) clamps `focusedIndex` to `Math.max(0, filteredItems.length - 1)` so focus never points past the end of the list after items are removed.

### WR-05: TableBlock sort comparison is unsafe for mixed cell types

**Files modified:** `src/components/blocks/TableBlock.tsx`
**Commit:** 7e9a9b0
**Applied fix:** Replaced the single `av < bv` comparison with a type-aware comparator: numeric subtraction (`av - bv`) when both values are numbers, and `String(av) < String(bv)` lexicographic comparison otherwise. This prevents unreliable JS type coercion when a column contains a mix of numbers and strings such as `"N/A"`.

---

_Fixed: 2026-04-13T21:58:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
