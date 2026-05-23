---
phase: 69-sdk-spend-guard-multi-provider-ux
fixed_at: 2026-05-23T18:51:07Z
review_path: .planning/phases/69-sdk-spend-guard-multi-provider-ux/69-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 69: Code Review Fix Report

**Fixed at:** 2026-05-23T18:51:07Z
**Source review:** .planning/phases/69-sdk-spend-guard-multi-provider-ux/69-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (1 Critical + 5 Warning; Info findings excluded per fix_scope)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Subagent events double-dispatched via .includes() substring matching

**Files modified:** `convex/ingest.ts`
**Commit:** 813b062
**Applied fix:** Replaced `eventType.includes("SubagentStart")` and `eventType.includes("SubagentStop")` with strict equality checks (`=== "SubagentStart"` and `=== "SubagentStop"`) in section 3. This eliminates unintended matching of any superset string (e.g. "PreSubagentStart", "BatchSubagentStart") that would call `api.agents.register` with garbage agentId values.

---

### WR-01: TaskCompleted handler re-inserts event into events table (duplicate write)

**Files modified:** `convex/ingest.ts`
**Commit:** f8bfc71
**Applied fix:** Deleted the `if (eventType === "TaskCompleted")` block (formerly lines 207-218) that called `api.events.ingest` a second time. The generic insert at line 35 already stores every event including TaskCompleted. The duplicate block created two identical rows per TaskCompleted event, corrupting event counts in SessionComparison and ActiveSessions.

---

### WR-02: session_stop incorrectly mapped to "errored"; no guard against status regression

**Files modified:** `convex/ingest.ts`, `convex/sessions.ts`
**Commit:** 8b24ffb
**Applied fix:** Changed `status: eventType === "session_end" ? "completed" : "errored"` to `status: "completed"` — both `session_end` and `session_stop` are normal lifecycle ends. Added a no-regression guard in `markCompleted` in `sessions.ts`: `if (session.status === "completed") return;` prevents a race between a `session_stop` and a `Stop` hook event from downgrading a completed session back to errored.

---

### WR-03: Math.max(...spread) crash risk and loading-state flash in SessionComparison

**Files modified:** `src/components/SessionComparison.tsx`
**Commit:** a3b82d6
**Applied fix:** Replaced `Math.max(...sessions.map(...))` with `sessions.reduce((max, s) => Math.max(max, s.eventCount), 0)` to avoid V8's argument-count limit. Switched from `useSessionList` (which coalesces `undefined` to `[]`) to direct `useQuery(api.sessions.listAll, { limit: 50 })` so `undefined` (loading) is distinguishable from `[]` (empty). Added a separate loading branch that shows "Loading..." during the Convex loading transient, eliminating the false "No sessions yet." flash.

Note: WR-03 and WR-04 were applied in the same file rewrite and committed together.

---

### WR-04: SessionComparison uses window.location.href bypassing React Router

**Files modified:** `src/components/SessionComparison.tsx`
**Commit:** a3b82d6
**Applied fix:** Replaced `onClick={() => { window.location.href = \`/sessions/${session.sessionId}\`; }}` with `onClick={() => navigate(\`/sessions/${session.sessionId}\`)}` using `useNavigate()` from react-router-dom. Avoids full page reload, Convex WebSocket teardown/reconnect, and hard navigation history entries. Also removed the unused `useSessionList` import and the unused `formatTimestamp` import (IN-01 removed as a side effect of the rewrite).

---

### WR-05: SessionHeader applies mask after truncate — short truncated paths may escape masking

**Files modified:** `src/components/SessionHeader.tsx`
**Commit:** 37579b7
**Applied fix:** Swapped operation order from `maskFilePath(truncatePath(session.cwd))` to `truncatePath(maskFilePath(session.cwd))`. The full path is now masked first (preserving all segments for maskPath to operate on correctly), then the already-masked string is truncated for display. The title tooltip already used `maskFilePath(session.cwd)` (correct order) and was left unchanged.

---

_Fixed: 2026-05-23T18:51:07Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
