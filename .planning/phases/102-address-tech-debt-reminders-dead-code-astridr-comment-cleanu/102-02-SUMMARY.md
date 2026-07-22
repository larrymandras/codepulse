---
phase: 102-address-tech-debt-reminders-dead-code-astridr-comment-cleanu
plan: 02
subsystem: astridr-cron
tags: [python, astridr, calendar-cron, tech-debt, dead-code-removal]

# Dependency graph
requires:
  - phase: 101-personal-productivity-reminders-calendar
    provides: "calendar_cache.py cron + cron_dispatcher.py dispatch table + tools/reminders.py Convex client"
provides:
  - "Dead CodePulsePoster class + its 4 orphaned module constants deleted from astridr/automation/calendar_cache.py"
  - "cron_dispatcher.py's _run_calendar_cache_refresh now passes self._telemetry (shared ConvexHandler) to refresh(), matching every other cron"
  - "test_cron_dispatcher.py's calendar-cache dispatch test asserts shared-telemetry passthrough, no CodePulsePoster import"
  - "astridr/tools/reminders.py's stale two-backend/404/transitional narrative comment rewritten to single-local-backend truth"
affects: [102-03-PLAN.md]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Cron handlers pass the shared ConvexHandler (self._telemetry) directly rather than a bespoke duck-typed poster class — single-telemetry-path convention across all cron dispatch methods"]

key-files:
  created: []
  modified:
    - "astridr-repo (worktree astridr-wt-183): astridr/automation/calendar_cache.py"
    - "astridr-repo (worktree astridr-wt-183): astridr/engine/bootstrap/cron_dispatcher.py"
    - "astridr-repo (worktree astridr-wt-183): astridr/tools/reminders.py"
    - "astridr-repo (worktree astridr-wt-183): tests/unit/engine/bootstrap/test_cron_dispatcher.py"

key-decisions:
  - "Module comment L46-48 in calendar_cache.py (the 'CONVEX TARGET — see astridr/tools/reminders.py' note) was left as-is per the plan's explicit interfaces guidance — it references env var names (CONVEX_URL/CODEPULSE_CONVEX_URL), not the deleted Python constants (_CP_URL/_LOCAL_URL/_CODEPULSE_URL/_INGEST_KEY), so it doesn't meet the 'delete only if it references the now-deleted constants' bar"
  - "Both `os` and `get_pool` imports removed from calendar_cache.py — grep-confirmed zero remaining references after the class + constants were deleted"
  - "Test renamed from test_calendar_cache_refresh_calls_module_refresh_with_deps to test_calendar_cache_refresh_passes_shared_telemetry per plan instruction"
  - "Inventory grep (Task 2) confirmed astridr/tools/reminders.py is the sole in-scope narrative site; all other 'tidy-whale/404/escape hatch' hits (web.py:839 CORS default, ugc/doctor/temporal_graph escape hatches, test fake URLs) are pre-triaged out-of-scope and left untouched"

requirements-completed: [AUDIT-TD-02]

# Metrics
duration: ~25min
completed: 2026-07-22
---

# Phase 102 Plan 02: Astridr CodePulsePoster Dead Code + Two-Backend Narrative Cleanup Summary

**Deleted the dead CodePulsePoster class from astridr's calendar cron, switched it to the shared ConvexHandler telemetry path, and swept the stale two-backend/404 narrative out of astridr/tools/reminders.py — all in the astridr-wt-183 worktree on `main`**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 4 (all in astridr-repo, via worktree astridr-wt-183)

## Accomplishments
- Removed `CodePulsePoster` (a bespoke duck-typed Convex poster class) and its 4 orphaned module constants (`_CP_URL`/`_LOCAL_URL`/`_CODEPULSE_URL`/`_INGEST_KEY`) from `astridr/automation/calendar_cache.py`, along with the now-unused `os` and `get_pool` imports
- `cron_dispatcher.py`'s `_run_calendar_cache_refresh` now passes `self._telemetry` (the shared `ConvexHandler`) to `refresh()`, exactly like `_run_reminder_nudge` and every other cron in the dispatcher — closing the gap where the calendar cron alone used a separate, dead-code posting path
- Fixed `test_cron_dispatcher.py`'s calendar-cache dispatch test to assert the shared-telemetry passthrough instead of `isinstance(telemetry, CodePulsePoster)`, and renamed it `test_calendar_cache_refresh_passes_shared_telemetry`
- Swept the stale "two-backend / local-404 / transitional escape hatch / History (2026-07-20)" narrative out of `astridr/tools/reminders.py`'s module comment, replacing it with the current truth: one local self-hosted Convex backend serves `/calendar-ingest`, `/reminders-ingest`, and `/reminders-read`
- Confirmed via a repo-wide inventory grep that no other in-scope narrative sites exist; out-of-scope sites (`web.py:839`'s war-room CORS default, fake test URLs, unrelated 404 handling in ugc/doctor/temporal_graph) were left untouched

## Task Commits

Both tasks committed atomically in the astridr repo (worktree `astridr-wt-183`, branch `main`):

1. **Task 1: Delete CodePulsePoster + orphaned constants, switch the cron to self._telemetry, fix the dispatcher test** - `3820edfd` (fix)
2. **Task 2: Sweep the stale two-backend narrative repo-wide and prove the static bar** - `0f97c8d3` (docs)

**Plan metadata:** this commit (docs: complete plan) — codepulse repo, `master`

## Files Created/Modified
- `astridr/automation/calendar_cache.py` (astridr-repo) - Deleted `CodePulsePoster` class + 4 orphaned module constants + now-unused `os`/`get_pool` imports; `refresh()` unchanged
- `astridr/engine/bootstrap/cron_dispatcher.py` (astridr-repo) - `_run_calendar_cache_refresh` now passes `telemetry=self._telemetry`; dropped `CodePulsePoster` import + stale inline comment
- `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (astridr-repo) - Dispatch test asserts shared-telemetry passthrough; renamed test; dropped `CodePulsePoster` import
- `astridr/tools/reminders.py` (astridr-repo) - Rewrote the module comment block to the current single-local-backend truth; live `_CP_URL`/`_LOCAL_URL`/`_CONVEX_URL`/`_INGEST_KEY` constants untouched

## Decisions Made
- Left `calendar_cache.py`'s L46-48 module comment as-is per the plan's explicit rule (it names env vars, not the deleted Python constants) — see key-decisions above
- Removed `os`/`get_pool` imports since both became fully unused after the class+constants deletion (grep-confirmed before removal, per plan's own conditional instruction)
- Followed the plan's literal rename instruction for the dispatcher test

## Deviations from Plan

None — plan executed exactly as written. The one judgment call (module comment L46-48 disposition) was made per the plan's own explicit conditional rule, not a deviation from it.

## Issues Encountered

**Full-suite pytest run surfaced 6 pre-existing failures, all environment-dependent and unrelated to this plan's edits:**
- `tests/memory/test_kg_vs_vector_benchmark.py::test_kg_vs_vector_benchmark`
- `tests/ugc/test_rls_isolation.py::test_cross_tenant_read_returns_zero`
- `tests/ugc/test_rls_isolation.py::test_tenant_sees_own_children`
- `tests/ugc/test_ugc_ad_async_enqueue.py::test_precleared_tool_row_drives_without_second_cost_gate_check`
- `tests/ugc/test_ugc_routes.py::test_post_runs_completes_via_worker`
- `tests/ugc/test_ugc_routes.py::test_get_runs_shows_in_flight_stage_progress`

Traced each to root cause (not dismissed blind): all raise `NonRetryableHttpError: 401 Unauthorized` against `http://localhost:55431/rest/v1/...` — a live local Supabase instance that isn't running in this environment. None touch `calendar_cache.py`, `cron_dispatcher.py`, `tools/reminders.py`, or `test_cron_dispatcher.py`. Out of scope per the deviation rules' scope boundary (pre-existing failures in unrelated files/modules — `ugc/`, `memory/` benchmark). The scoped verification commands the plan actually gates on (`tests/unit/engine/bootstrap/test_cron_dispatcher.py tests/automation/` and `tests/tools/test_reminders.py`) both passed 100% (34/34 and 30/30 respectively).

Running the failing `test_kg_vs_vector_benchmark` test also mutated two unrelated result-artifact files (`RESULTS.json`/`RESULTS.md` under a `.planning/quick/` archive dir) as a side effect of test execution — reverted via `git checkout --` before committing Task 2, since they were not part of this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Static bar (D-03/D-04/D-06) is met: zero `CodePulsePoster` references, zero stale two-backend narrative in astridr source+tests, live constants in `tools/reminders.py` untouched, dispatcher test passthrough verified
- Deleting the class changes which object the live calendar cron calls in production — the actual live cron-tick proof (assert `pushed>0, failed=0` + events render on `/reminders`) is deferred to plan 102-03 as planned
- No blockers for 102-03

---
*Phase: 102-address-tech-debt-reminders-dead-code-astridr-comment-cleanu*
*Completed: 2026-07-22*
