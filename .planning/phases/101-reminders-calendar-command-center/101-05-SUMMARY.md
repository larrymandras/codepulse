---
phase: 101-reminders-calendar-command-center
plan: 05
subsystem: automation
tags: [astridr, cron, reminders, proactive-messenger, notified-at-dedupe, recurrence, rem-05]

# Dependency graph
requires:
  - phase: 101-reminders-calendar-command-center (plan 02)
    provides: "authed POST /reminders-read (listByProfile) and POST /reminders-ingest (op:markNotified, op:complete) httpActions on the shared Convex reminders table"
  - phase: 101-reminders-calendar-command-center (plan 04)
    provides: "cron_builders.py / cron_dispatcher.py real scheduler registration surface (jobs.py has none) — reused verbatim as the Task 2 registration pattern"
provides:
  - "astridr/automation/reminder_nudge.py — run() scans /reminders-read per profile, selects due reminders (open past dueAt, snoozed past snoozedUntil, notifiedAt unset), sends ONE ProactiveMessenger.send_alert to the reminder's own profileId->channel, then POSTs op:markNotified to close the dedupe loop (REM-05, D-04, D-11)"
  - "recurrence roll on pass: a due recurring reminder additionally rolls forward via op:complete (plan-01's completeReminderHandler spawns the next open occurrence, notifiedAt cleared); a due one-off is nudged but never auto-completed (D-05, REM-04)"
  - "reminder:nudge periodic CronJob (every 5 min) registered unconditionally in the real scheduler (cron_builders.py + cron_dispatcher.py), completing the reminders proactive-nudge pipeline"
affects: ["101-06 (Reminders page, codepulse) — reads the same reminders rows this cron nudges/rolls, no direct code dependency"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level CONVEX_URL/ASTRIDR_INGEST_API_KEY env-read + get_pool() HTTP client (mirrors astridr/tools/reminders.py's _post_json/_post_read/_post_ingest helpers verbatim) chosen over ConvexHandler.send_to because send_to is fire-and-forget and cannot return a response body — this module needs to READ /reminders-read's JSON body, not just push telemetry."
    - "Per-profile isolation (mirrors calendar_cache.py): each profile's read+nudge pass runs inside its own try/except so one profile's HTTP/config failure never blocks the others; a per-reminder try/except additionally prevents one bad row from aborting the rest of that profile's batch."
    - "Channel targeting resolved per-reminder via _resolve_chat_id(config, profile_id, 'telegram') (astridr/engine/config.py) — the SAME helper operator_score/skill_health/dep_scanner cron handlers already use, so a business reminder can never reach the personal chat_id (T-101-11)."

key-files:
  created:
    - C:\Users\mandr\astridr-repo\astridr\automation\reminder_nudge.py
    - C:\Users\mandr\astridr-repo\tests\automation\test_reminder_nudge.py
  modified:
    - C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_builders.py
    - C:\Users\mandr\astridr-repo\astridr\engine\bootstrap\cron_dispatcher.py
    - C:\Users\mandr\astridr-repo\tests\unit\engine\bootstrap\test_cron_dispatcher.py

key-decisions:
  - "File-scope correction (Rule 3, same class as 101-04's finding): the plan's frontmatter named astridr/automation/jobs.py as the Task 2 registration file. jobs.py is JobManager (execution-tracking only) with no cron-scheduling mechanism. Registered reminder:nudge in the real scheduler instead — cron_builders.py's _register_cron_jobs (unconditional, no Google-account gate unlike calendar_cache since reminders are Convex-native) + cron_dispatcher.py's dispatch() elif arm and _run_reminder_nudge() — mirroring 101-04's calendar_cache precedent exactly. jobs.py was not touched."
  - "Read transport mirrors astridr/tools/reminders.py's module-level _post_json/_post_read pattern (get_pool() HTTP client, Bearer auth), NOT ConvexHandler.send_to — send_to has no return value, so it cannot deliver /reminders-read's response body back to the cron for due-filtering."
  - "Recurrence roll reuses op:'complete' (plan-01's completeReminderHandler) rather than a bespoke roll op — completing a recurring reminder already spawns the next open occurrence with notifiedAt cleared, exactly the D-05 invariant this task needs. A one-off's op:'complete' path is never invoked, so it stays open/overdue until Larry acts by hand."
  - "Dedupe uses op:'markNotified' (closed in codepulse commit 76db925, per the plan's CRITICAL_corrections block) instead of shoehorning notifiedAt through op:'update' — narrow mutation that touches only notifiedAt/updatedAt, never status or dueAt."

requirements-completed: [REM-05, REM-04]

# Metrics
duration: ~9min (commit span; TDD RED/GREEN x2)
completed: 2026-07-19
---

# Phase 101 Plan 05: Ástríðr Reminder Nudge Cron Summary

**A per-profile Ástríðr cron (`reminder:nudge`, every 5 min) that scans each of personal/business/consulting's due reminders via authed `/reminders-read`, sends exactly one `ProactiveMessenger.send_alert` to the reminder's own profile channel, stamps `notifiedAt` via `op:"markNotified"` to dedupe, and rolls a due recurring reminder forward via `op:"complete"` — closing REM-05 and the runtime half of REM-04.**

## Performance

- **Duration:** ~9 min (commit span, 18:32:58 → 18:41:51 local); 2 TDD RED/GREEN cycles
- **Started:** 2026-07-19T18:32:58-04:00
- **Completed:** 2026-07-19T18:41:51-04:00
- **Tasks:** 2
- **Files modified:** 5 (2 created astridr-repo, 3 modified astridr-repo) + 1 created codepulse (this SUMMARY)

## Accomplishments
- `astridr/automation/reminder_nudge.py` — `run()` iterates all three profiles, resolves each one's own `telegram` chat_id via `_resolve_chat_id`, reads that profile's reminders via authed `POST /reminders-read`, and selects due rows: open reminders past `dueAt`, snoozed reminders past `snoozedUntil` (future-snoozed rows are skipped), always excluding rows that already carry `notifiedAt` (REM-05 dedupe) or are `status:"done"`
- Exactly one `send_alert(channel_id="telegram", chat_id, message)` per due reminder, followed by `POST /reminders-ingest {op:"markNotified", id, notifiedAt}` — a re-scan after that stamp sends zero (T-101-12 nudge-storm mitigation), verified by a dedicated dedupe test
- Channel targeting is strictly per-reminder-profile — a business reminder resolves ONLY the business chat_id, a personal reminder ONLY the personal chat_id (T-101-11), verified with distinct chat_ids per profile in tests
- Recurrence roll (D-05/REM-04): a due recurring reminder additionally posts `op:"complete"` after its nudge, which plan-01's `completeReminderHandler` uses to spawn the next open occurrence with `notifiedAt` cleared; a due one-off is nudged but its `op:"complete"` path is never invoked, so it stays open/overdue until Larry acts
- Per-profile AND per-reminder isolation: one profile's `/reminders-read` failure (exception) is logged and skipped without blocking the other two profiles; one bad reminder within a profile's due batch doesn't abort the rest of that batch
- `reminder:nudge` registered as a real periodic `CronJob` (`REMINDER_NUDGE_SCHEDULE = "*/5 * * * *"`) in `cron_builders.py` — unconditional (no Google-account gate, unlike `calendar:cache_refresh`, since reminders are Convex-native) — and routed in `cron_dispatcher.py`'s `dispatch()` to `_run_reminder_nudge`, which delegates to `reminder_nudge.run(proactive=self._proactive, config=self._config)`, fail-closed (never raises into the cron loop)
- 9/9 new tests in `tests/automation/test_reminder_nudge.py` green (due-nudge-once, re-scan-sends-zero, business-never-personal, future-snoozed-skipped, past-snoozed-nudged, one-profile-failure-isolated, no-chat-id-skips-safely, recurring-rolls/one-off-does-not, cron-job-registration) + 2 new tests in `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (uniform jobs-row write, delegation to `reminder_nudge.run` with the dispatcher's own `proactive`/`config`) + 1026 pre-existing bootstrap/automation tests unaffected — **1037/1037** total, matching 101-04's suite count plus these 11 new tests exactly
- `ruff check` clean on both new files (`reminder_nudge.py`, `test_reminder_nudge.py`); zero NEW findings introduced in the 3 modified files — verified by diffing ruff output against the pre-edit HEAD revision of each file (identical rule/count set, only line numbers shifted from inserted code)

## Task Commits

Both tasks followed RED → GREEN (tdd="true"):

1. **Task 1: due-scan + single nudge + notifiedAt dedupe** — `12aeaedc` (test, RED — confirmed `ModuleNotFoundError` with `reminder_nudge.py` absent) → `e5df8399` (feat, GREEN — 7/7 tests pass)
2. **Task 2: recurrence roll on pass + job registration** — `42a7667e` (test, RED — confirmed `AssertionError`/`AttributeError` for the roll + `register_cron_job` targets) → `0ca7c7f9` (feat, GREEN — 9/9 reminder_nudge tests + 2/2 new dispatcher-wiring tests pass, 1037/1037 full suite)

**Plan metadata:** pending (this commit, codepulse)

## Files Created/Modified
- `astridr/automation/reminder_nudge.py` (astridr-repo) — `run()`, `_is_due()`, `_format_message()`, `_read_reminders()`/`_mark_notified()`/`_complete()` (HTTP helpers), `register_cron_job()`, `PROFILES`, `NUDGE_CHANNEL`, `REMINDER_NUDGE_SCHEDULE`, `CRON_JOB_NAME`
- `tests/automation/test_reminder_nudge.py` (astridr-repo) — 9 tests covering due-scan, dedupe, channel targeting, snooze windows, per-profile isolation, recurrence roll, and cron registration
- `astridr/engine/bootstrap/cron_builders.py` (astridr-repo) — registers `reminder:nudge` unconditionally via `reminder_nudge.register_cron_job()`
- `astridr/engine/bootstrap/cron_dispatcher.py` (astridr-repo) — `dispatch()` elif arm for `reminder:nudge` + new `_run_reminder_nudge()` method
- `tests/unit/engine/bootstrap/test_cron_dispatcher.py` (astridr-repo) — 2 new tests for the dispatch wiring

## Decisions Made
- **File-scope correction (Rule 3)**: see key-decisions above — jobs.py has no registration surface; used the real `cron_builders.py`/`cron_dispatcher.py` mechanism, mirroring 101-04's already-established precedent for this exact class of correction.
- **Read transport mirrors `astridr/tools/reminders.py`, not `ConvexHandler.send_to`**: `send_to` cannot return a response body, and this cron needs to read `/reminders-read`'s JSON to filter due reminders client-side.
- **Recurrence roll reuses `op:"complete"`** rather than inventing a dedicated roll op — the plan's own `<interfaces>` flagged this as an execution-time decision; `completeReminderHandler`'s existing next-occurrence-spawn behavior (plan 01) is exactly the D-05 invariant needed, so no new Convex mutation was added.
- **Dedupe uses `op:"markNotified"`** per the plan's `CRITICAL_corrections_to_your_plan` block (closed in codepulse commit `76db925`) — never shoehorned through `op:"update"`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected the Task 2 registration file from jobs.py to the real scheduler wiring**
- **Found during:** Task 2 (register the periodic job)
- **Issue:** The plan's `<files>` frontmatter named `astridr/automation/jobs.py` as the Task 2 file to modify. As flagged by both the plan's own coordination note and 101-04's SUMMARY, `jobs.py` contains only `JobManager` (execution-tracking: create/update_status/cleanup_stale) — no cron-expression scheduling exists there.
- **Fix:** Registered `reminder:nudge` in `cron_builders.py` (unconditional — no external-account gate, since reminders are Convex-native, unlike `calendar_cache`'s Google-account gate) and added the matching `dispatch()` elif arm + `_run_reminder_nudge()` method in `cron_dispatcher.py`, exactly mirroring the `calendar:cache_refresh` precedent from 101-04. `jobs.py` was not modified.
- **Files modified:** `astridr/engine/bootstrap/cron_builders.py`, `astridr/engine/bootstrap/cron_dispatcher.py`
- **Verification:** RED confirmed via `AttributeError: module 'astridr.automation.reminder_nudge' has no attribute 'register_cron_job'` before the fix; GREEN confirmed after (9/9 reminder_nudge tests, 2/2 new dispatcher-wiring tests, 1037/1037 full bootstrap/automation suite)
- **Committed in:** `42a7667e` (test, RED) → `0ca7c7f9` (feat, GREEN)

**2. [Rule 1 - Lint] Reordered a new import block to satisfy ruff's isort rule (I001)**
- **Found during:** Task 2 GREEN, pre-commit ruff check
- **Issue:** The new `cron_builders.py` import block (`from astridr.automation.reminder_nudge import register_cron_job as ...` then `from astridr.automation import reminder_nudge as ...`) triggered I001 (un-sorted import block) — the only NEW ruff finding introduced by this plan's edits, confirmed by diffing ruff output against the pre-edit HEAD revision of all three modified files (identical finding set otherwise, only line numbers shifted).
- **Fix:** Swapped the two import lines so the shorter module import precedes the `from X.Y import Z` form.
- **Files modified:** `astridr/engine/bootstrap/cron_builders.py`
- **Verification:** `ruff check` clean on the specific line after the fix; full-file ruff diff against HEAD confirmed zero new findings remain.
- **Committed in:** `0ca7c7f9` (feat, GREEN)

---

**Total deviations:** 2 auto-fixed (1 blocking file-path correction, 1 lint fix)
**Impact on plan:** Both were necessary — the first for the cron to actually run at boot, the second to keep the new code lint-clean. No architectural change — both fixes reuse existing, already-shipped mechanisms (CronManager/CronDispatcher) or trivial reordering. No scope creep.

## Issues Encountered
None beyond the two deviations above.

## User Setup Required

None — no new environment variables or external service configuration. Reuses the existing `ASTRIDR_INGEST_API_KEY`/`CONVEX_URL` env convention (already required by `astridr/tools/reminders.py` and `~15` other endpoints) and the `telegram` `channel_mappings` already configured for all three profiles in `config/profiles.yaml`. Manual live verification (create a reminder due in 1 min, confirm exactly one Telegram nudge on the right profile and `notifiedAt` set; confirm a recurring one spawns the next occurrence) is called out in the plan's `<verification>` block as a manual step requiring a live deploy — not run here (unit-level mocked verification only, matching this plan's autonomous scope).

## Next Phase Readiness

- `reminder:nudge` is registered and will fire every 5 minutes once astridr boots with this code deployed — the reminders proactive-nudge pipeline (REM-05) and the runtime half of recurrence (REM-04) are code-complete.
- **REM-05 and REM-04 (runtime half) marked complete** in REQUIREMENTS.md.
- 101-06 (Reminders page, codepulse) can proceed independently — it reads the same `reminders` Convex rows this cron nudges/rolls, with no direct code dependency on this plan's astridr-side changes.
- No blockers. Full astridr-repo bootstrap/automation suite (1037 tests) green; codepulse working tree unaffected by this plan (no code changes there — GSD artifacts only; pre-existing unrelated uncommitted work in voice/skills files was left untouched per the cross-repo protocol).

---
*Phase: 101-reminders-calendar-command-center*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: astridr-repo/astridr/automation/reminder_nudge.py
- FOUND: astridr-repo/tests/automation/test_reminder_nudge.py
- FOUND: astridr-repo commit 12aeaedc (test RED — due-scan + dedupe)
- FOUND: astridr-repo commit e5df8399 (feat GREEN — due-scan + dedupe)
- FOUND: astridr-repo commit 42a7667e (test RED — recurrence roll + registration)
- FOUND: astridr-repo commit 0ca7c7f9 (feat GREEN — recurrence roll + registration)
- FOUND: codepulse .planning/phases/101-reminders-calendar-command-center/101-05-SUMMARY.md
