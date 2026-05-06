---
phase: 59-rubric-inspired-observability
fixed_at: 2026-05-06T23:15:00Z
review_path: .planning/phases/59-rubric-inspired-observability-status-heartbeat-grid-cron-cal/59-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 59: Code Review Fix Report

**Fixed at:** 2026-05-06T23:15:00Z
**Source review:** .planning/phases/59-rubric-inspired-observability-status-heartbeat-grid-cron-cal/59-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: scheduledTodayCount always returns 0 -- day name format mismatch

**Files modified:** `src/lib/dayUtils.ts` (new), `src/pages/Operations.tsx`, `src/components/CronCalendarView.tsx`
**Commit:** 99896e0
**Applied fix:** Extracted `parseDays` and `todayDayIndex` into a shared `src/lib/dayUtils.ts` module. Operations.tsx now uses the shared `parseDays(entry.days).includes(todayDayIndex())` instead of comparing against full English day names. CronCalendarView's inline `parseDays` was removed in favor of the shared import. The shared function handles "daily", "*", ranges ("mon-fri"), and comma-separated lists ("mon,wed,fri") with Monday-first indexing (0=Mon..6=Sun).

### CR-02: liveEvents state grows unboundedly in PipelineFlowDiagram

**Files modified:** `src/components/PipelineFlowDiagram.tsx`
**Commit:** b8cee61
**Applied fix:** Added `MAX_LIVE_EVENTS = 200` constant. Both `step_started` and `step_completed` WebSocket event handlers now cap the `liveEvents` array by slicing to keep only the most recent 200 events when the limit is exceeded.

### WR-01: CronCalendarView popover positioning

**Files modified:** `src/components/CronCalendarView.tsx`
**Commit:** 5fbd183
**Applied fix:** Added `relative` to the outer container div's className so the absolutely-positioned slot detail popover is positioned relative to the calendar card rather than the nearest (potentially distant) positioned ancestor.

### WR-02: categorizeRhythm regex overlap

**Files modified:** `src/lib/rhythmCategories.ts`
**Commit:** e56a8ee
**Applied fix:** Tightened "health" regex from `health|check|monitor|status` to `health.check|monitor|status.update` -- now requires compound terms (e.g., "health check", "status update") instead of matching bare "check" or "status" in unrelated actions. Removed bare `digest` from "research" regex (kept `pr digest` which is specific enough). All existing test assertions verified to still pass.

### WR-03: dailyRhythm upsertEntries unbounded collect

**Files modified:** `convex/dailyRhythm.ts`
**Commit:** 9394c10
**Applied fix:** Changed `.collect()` to `.take(1000)` in the upsertEntries mutation to cap the number of rows loaded into memory when deleting existing entries for an agent type.

### WR-04: recentExecutionIds misleading limit

**Files modified:** `convex/pipelineStepEvents.ts`
**Commit:** a409c39
**Applied fix:** Changed the query to scan `targetCount * 10` raw events (instead of using `limit` directly as the scan count) and added an early-exit `break` once enough unique execution IDs are found. The `limit` parameter now controls the number of unique IDs returned, not raw events scanned.

### WR-05: StatusHeartbeatGrid 1-second interval

**Files modified:** `src/components/StatusHeartbeatGrid.tsx`
**Commit:** a5c6e01
**Applied fix:** Changed `setInterval` from 1000ms to 15000ms (15 seconds). This is sufficient granularity for a 5-minute idle threshold and eliminates 14 out of every 15 re-renders of the entire agent tile grid.

---

_Fixed: 2026-05-06T23:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
