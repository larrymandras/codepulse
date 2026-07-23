---
phase: 101-reminders-calendar-command-center
plan: 04
subsystem: automation
tags: [astridr, cron, google-calendar, telemetry, calendar-cache, cal-01]

# Dependency graph
requires:
  - phase: 101-reminders-calendar-command-center (plan 02)
    provides: "POST /calendar-ingest authed httpAction (calendarAccount required, upsert-by-googleEventId + scoped stale prune)"
provides:
  - "astridr/automation/calendar_cache.py — refresh() per-profile Google Calendar fetch (read-only) -> normalize -> POST /calendar-ingest, bounded 60-day forward window, per-profile isolation (D-02/D-03/D-06/D-10)"
  - "calendar:cache_refresh periodic CronJob (every 20 min) registered in the real scheduler (cron_builders.py + cron_dispatcher.py), the calendar-cache source half of CAL-01"
affects: ["101-05 (nudge cron — same jobs.py file-scope correction likely applies)", "101-06 (Reminders page reads calendarEvents.listByProfile, now kept fresh)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-profile Google actions reuse the existing google_<alias> per-account tools from the shared registry (astridr/engine/bootstrap/tools.py), the SAME tools google:contacts_sync uses — never a bare Google API client or a new OAuth path."
    - "Bounded forward window without modifying the shared GoogleWorkspaceTool: fetch up to a result-count limit (Google returns events ordered by startTime), then post-filter normalized events by now+window_days. Avoids touching the Eta-owned tools/google_workspace.py file."
    - "Periodic non-agent-loop jobs are registered as ordinary CronJob entries (cron_builders.py's _register_cron_jobs) and routed by name in CronDispatcher.dispatch() -> a dedicated _run_* method that delegates to the module's own async function, mirroring the existing graph:snapshot / google:contacts_sync precedent."

key-files:
  created:
    - astridr/automation/calendar_cache.py (astridr-repo)
    - tests/automation/test_calendar_cache.py (astridr-repo)
  modified:
    - astridr/engine/bootstrap/cron_builders.py (astridr-repo)
    - astridr/engine/bootstrap/cron_dispatcher.py (astridr-repo)
    - tests/unit/engine/bootstrap/test_cron_dispatcher.py (astridr-repo)

key-decisions:
  - "File-scope correction (Rule 3): the plan named astridr/automation/jobs.py as the file to modify for Task 2, but jobs.py is JobManager (execution-tracking only) with no periodic-job-registration surface. The real registration point — verified against the live graph:snapshot / google:contacts_sync precedent — is astridr/engine/bootstrap/cron_builders.py (_register_cron_jobs) + astridr/engine/bootstrap/cron_dispatcher.py (CronDispatcher.dispatch). Modified these two files instead so the job actually runs at boot; jobs.py was not touched."
  - "Interface adaptation (Rule 1): the plan's <interfaces> block described a list_events(account_alias, time_min, time_max) signature, but the shipped GoogleWorkspaceTool._calendar_list has no time-window params — only a result-count limit, always starting from 'now'. Reproduced the bounded-forward-window requirement (D-10) by fetching up to 250 upcoming events and post-filtering normalized events against now + window_days, without modifying the shared (Eta-owned) tool."
  - "Push mechanism uses ConvexHandler.send_to('/calendar-ingest', 'calendar_batch', {...}) per the plan's own <key_links> hint, not a bespoke HTTP client — reuses the existing telemetry seam instead of duplicating CONVEX_URL/ASTRIDR_INGEST_API_KEY plumbing already centralized in ConvexHandler."

requirements-completed: [CAL-01]

# Metrics
duration: 28min
completed: 2026-07-19
---

# Phase 101 Plan 04: Ástríðr Calendar Cache Cron Summary

**A per-profile Ástríðr cron (`calendar:cache_refresh`, every 20 min) that reads each of personal/business/consulting's real Google Calendar read-only via the existing `google_<alias>` per-account tools, normalizes events to a bounded 60-day forward window, and pushes them to CodePulse's `/calendar-ingest` — the CAL-01 source half, completing the calendar-cache pipeline plan 02 built the sink for.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-07-19T17:55:00-04:00 (approx.)
- **Completed:** 2026-07-19T18:24:11-04:00
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified) in astridr-repo; 1 created in codepulse (this SUMMARY)

## Accomplishments
- `astridr/automation/calendar_cache.py` — `refresh()` iterates all three profiles, calling each one's own `google_<alias>` per-account tool (`service="calendar", action="list_events"` only — never `create_event`, D-02/T-101-08) with a 250-event fetch, normalizes Google's `{dateTime}`/`{date}` event shapes to epoch-seconds `start`/`end` + `allDay`, filters to the bounded 60-day forward window (D-10), and pushes each profile's batch to `/calendar-ingest` via `ConvexHandler.send_to` using that profile's REAL Google account email as `calendarAccount` (D-06: `personal`→`mandrasle@gmail.com`, `business`→`lmandras@myprotectall.com`, `consulting`→`lemandras@forgedinai.ai`)
- Per-profile isolation: each profile's fetch+normalize+push runs inside its own try/except — an auth/permission/HTTP failure on one account is logged and skipped, the others still refresh (RELI, T-101-10); verified with both a raised exception and a well-formed `ToolResult(success=False)` permission-denied response
- `calendar:cache_refresh` registered as a real periodic `CronJob` (named `CALENDAR_CACHE_SCHEDULE = "*/20 * * * *"` constant) in `cron_builders.py`, gated on `config.google_workspace.accounts` being configured, and routed in `cron_dispatcher.py`'s `dispatch()` to a new `_run_calendar_cache_refresh` method that delegates to `calendar_cache.refresh()` — fail-closed, mirrors `_run_graph_snapshot` exactly (never raises into the cron loop)
- 25/25 new/updated tests green: 10 in `tests/automation/test_calendar_cache.py` (per-profile push+list_events-only, isolation on exception, isolation on failed ToolResult, all-day/timed normalization, location carry-through, bounded-window filtering, no-telemetry no-op, cron-job registration) + 2 new in `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (dispatch wiring writes one jobs row, delegates to `calendar_cache.refresh()` with the dispatcher's registry+telemetry) + 13 pre-existing dispatcher tests unaffected
- Full astridr-repo bootstrap+automation suite (1026 tests: `tests/unit/engine/bootstrap/`, `tests/automation/`, `tests/unit/automation/`, `tests/integration/test_automation_wiring.py`, `tests/tools/test_reminders.py`) green, 0 regressions; `ruff check` clean on both new files

## Task Commits

Both tasks followed RED → GREEN (tdd="true"):

1. **Task 1: per-profile fetch + normalize + push** — `1de62838` (test, RED — confirmed `ImportError` with `calendar_cache.py` absent) → `859d9448` (feat, GREEN — 10/10 tests pass)
2. **Task 2: register the periodic job** — `3fb1c4a9` (test, RED — confirmed dispatch falls through to the LLM-task else-arm, `calendar_cache.refresh` never awaited) → `500e8059` (feat, GREEN — job registered + routed, 15/15 targeted tests pass, full suite 1026/1026)

**Plan metadata:** pending (this commit, codepulse)

## Files Created/Modified
- `astridr/automation/calendar_cache.py` (astridr-repo) — `refresh()`, `_normalize_event()`/`_epoch_from_google_time()` (all-day vs timed), `register_cron_job()`, `PROFILE_ACCOUNTS`, `DEFAULT_WINDOW_DAYS=60`, `CALENDAR_CACHE_SCHEDULE`, `CRON_JOB_NAME`
- `tests/automation/test_calendar_cache.py` (astridr-repo) — 10 tests covering fetch/push, isolation, normalization, windowing, and cron registration
- `astridr/engine/bootstrap/cron_builders.py` (astridr-repo) — registers `calendar:cache_refresh` via `calendar_cache.register_cron_job()`, gated on configured Google accounts
- `astridr/engine/bootstrap/cron_dispatcher.py` (astridr-repo) — `dispatch()` elif arm for `calendar:cache_refresh` + new `_run_calendar_cache_refresh()` method
- `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (astridr-repo) — 2 new tests for the dispatch wiring

## Decisions Made
- **File-scope correction (Rule 3)**: see key-decisions above — jobs.py has no registration surface; used the real `cron_builders.py`/`cron_dispatcher.py` mechanism instead.
- **Interface adaptation (Rule 1)**: bounded the forward window via post-filtering rather than a `time_min`/`time_max` param that doesn't exist on the shared tool.
- **`ConvexHandler.send_to` over a bespoke HTTP client**: matches the plan's own `<key_links>` and avoids re-deriving `CONVEX_URL`/`ASTRIDR_INGEST_API_KEY` plumbing already centralized in telemetry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the Task 2 registration file from jobs.py to the real scheduler wiring**
- **Found during:** Task 2 (register the periodic job)
- **Issue:** The plan's `<files>` and `<interfaces>` named `astridr/automation/jobs.py` as the periodic-job registration point. `jobs.py` contains only `JobManager` (execution-tracking: create/update_status/cleanup_stale) — no cron-expression scheduling exists there. The actual mechanism (verified against the live `graph:snapshot`/`google:contacts_sync` precedent) is `CronManager.add(CronJob(...))` in `astridr/engine/bootstrap/cron_builders.py`, dispatched by name in `CronDispatcher.dispatch()` (`cron_dispatcher.py`).
- **Fix:** Registered `calendar:cache_refresh` in `cron_builders.py` (gated on `config.google_workspace.accounts`) and added the matching `dispatch()` elif arm + `_run_calendar_cache_refresh()` method in `cron_dispatcher.py`, exactly mirroring the two existing precedents. `jobs.py` was not modified.
- **Files modified:** `astridr/engine/bootstrap/cron_builders.py`, `astridr/engine/bootstrap/cron_dispatcher.py`
- **Verification:** RED confirmed against unmodified `cron_dispatcher.py` (2 new tests failed — dispatch fell through to the LLM-task else-arm); GREEN confirmed after the fix (15/15 targeted tests, 1026/1026 full suite)
- **Committed in:** `3fb1c4a9` (test, RED) → `500e8059` (feat, GREEN)

**2. [Rule 1 - Interface mismatch] Adapted the bounded-window fetch since `list_events` has no time_min/time_max**
- **Found during:** Task 1 read_first (`astridr/tools/google_workspace.py`)
- **Issue:** The plan's `<interfaces>` block described `_calendar_list -> list_events(account_alias, time_min, time_max)`. The shipped `GoogleWorkspaceTool._calendar_list` takes only a result-count `limit`, always starting `timeMin=now` with no upper bound.
- **Fix:** Fetch up to 250 upcoming events (Google returns them ordered by `startTime`) via the existing per-account tool, then filter out any normalized event whose `start` falls beyond `now + window_days` (default 60) before pushing. Achieves the same net "bounded forward window" behavior (D-10) without touching the shared, Eta-owned `google_workspace.py`.
- **Files modified:** `astridr/automation/calendar_cache.py`
- **Verification:** `test_events_beyond_window_are_filtered_out` asserts a far-future event is dropped while a near-future one is kept
- **Committed in:** `859d9448` (feat, GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking file-path correction, 1 interface adaptation)
**Impact on plan:** Both were necessary for the cron to actually run and to satisfy D-10's bounded-window requirement; neither changes the plan's stated behavior or scope. No architectural change — both fixes reuse existing, already-shipped mechanisms (CronManager/CronDispatcher, GoogleWorkspaceTool's existing action).

## Issues Encountered
- **`consulting` account_alias enum concern (flagged in the plan/context as a risk) was already resolved**: `GoogleWorkspaceTool.parameters["account"]` has no enum constraint (free string) and `config/google-workspace.yaml` already has a `consulting` entry with `list_events` in `allowed_actions` — no code change needed, confirmed by reading both files before implementing.

## User Setup Required

None — no new environment variables or external service configuration. Reuses the existing `ASTRIDR_INGEST_API_KEY`/`CONVEX_URL` telemetry configuration (already required by ~15 other endpoints) and the existing `GOOGLE_CREDS_PERSONAL`/`GOOGLE_CREDS_BUSINESS`/`GOOGLE_CREDS_CONSULTING` OAuth tokens (already required for `google:contacts_sync` and the reminders/calendar flows shipped in 101-01..03). Manual live verification (run `refresh()` once against real Google + Convex, confirm `calendarEvents` populates for all three profiles) is called out in the plan's `<verification>` block as a manual step requiring live creds — not run here (unit-level mocked verification only, matching this plan's autonomous scope).

## Next Phase Readiness

- `calendar:cache_refresh` is registered and will fire every 20 minutes once astridr boots with this code deployed — the calendar-cache pipeline (plan 02's sink + this plan's source) is code-complete for CAL-01.
- **CAL-01 marked complete** in REQUIREMENTS.md (spanned 101-02 + 101-04, both now done).
- 101-05 (nudge cron) should NOT assume `astridr/automation/jobs.py` is the registration surface — its own coordination note anticipated a `jobs.py` edit for the same reason this plan's did; the same file-path correction (use `cron_builders.py`/`cron_dispatcher.py`) likely applies there too.
- 101-06 (Reminders page) can proceed — `calendarEvents.listByProfile` will now be kept fresh by this cron once deployed, no blockers from this plan.
- No blockers. Full astridr-repo relevant suite (1026 tests) green; codepulse working tree unaffected (no code changes there — GSD artifacts only).

---
*Phase: 101-reminders-calendar-command-center*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: astridr-repo/astridr/automation/calendar_cache.py
- FOUND: astridr-repo/tests/automation/test_calendar_cache.py
- FOUND: astridr-repo commit 1de62838 (test RED — calendar_cache)
- FOUND: astridr-repo commit 859d9448 (feat GREEN — calendar_cache.py)
- FOUND: astridr-repo commit 3fb1c4a9 (test RED — dispatch wiring)
- FOUND: astridr-repo commit 500e8059 (feat GREEN — cron_builders.py + cron_dispatcher.py)
