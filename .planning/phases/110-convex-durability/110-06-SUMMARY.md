---
phase: 110-convex-durability
plan: 06
subsystem: database
tags: [convex, retention, self-hosted, live-evidence, scheduled-functions]

# Dependency graph
requires:
  - phase: 110-05
    provides: "listRetentionPolicy live, retention-health-check.ps1 reading the live 19-table policy, DUR-02 leg 2 closed on coverage"
provides:
  - "DUR-02 leg 1: a complete nightly prune pass proven from the durable _scheduled_functions record (268 pruneBatchV3 invocations, table indices 0..18, all success, inside the 09:00-09:20 UTC cron window)"
  - "DUR-01 live confirmation: oldest daily aggregates row unchanged, oldest hourly row's _creationTime moved forward ~49.9 days, bounded daily count unchanged, rotation cursor exactly one row"
  - "Amended the stale 2026-08-10 CORRECTION block in 110-DUR-EVIDENCE.md — the aggregates overhang ALERT does clear, via a concurrent session's predicate-aware probe (96a1df68), verified against today's health-check log"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "durable-record substitution for ephemeral evidence: when a log line cannot be recovered, prove the same claim from a system table (_scheduled_functions) that survives restarts and cannot rotate away"
    - "ambiguous single-value corroboration (rotation cursor value 0) stated explicitly as ambiguous, decisive only in combination with a second independent signal (tableIndex coverage set)"

key-files:
  created:
    - .planning/phases/110-convex-durability/110-06-SUMMARY.md
  modified:
    - .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md

key-decisions:
  - "Task 1's container-log unavailability finding (established by the plan-correction commits before this executor started) was independently re-verified rather than transcribed: all four chain log-string greps re-run fresh against today's log tail, npx convex logs --history re-run with its own bounded-kill harness. Results matched the plan-correction's structural finding even though the exact hit counts differ (today's tail is wider), which is expected and does not weaken the control."
  - "The DUR-01 hourly control probe returned a DIFFERENT document than the plan-04 baseline (different metric_type: cost -> tokens) at the SAME bucket_start -- investigated and recorded as expected: by_period_bucket orders by (period, bucket_start) not _creationTime, and multiple metric_type rows share a bucket_start, so once the baseline's row was deleted the query surfaces whichever remaining row sorts first. The _creationTime-moved-forward signal, which is what the plan's control actually requires, is unaffected by this and was satisfied (~49.9 days forward)."
  - "Amended (not replaced) the 2026-08-10 CORRECTION block asserting the aggregates ALERT 'does not clear, persists and grows forever' -- that claim was falsified within hours of being written by a concurrent session's deploy of commit 96a1df68 (summarizeOverhangProbe / oldestPrunableDoc). Verified live: today's 05:30 UTC health-check run reports aggregates as 'caught up', not ALERT. Original reasoning preserved verbatim per the dispatch instruction; a dated follow-up appended below it."

requirements-completed: []  # DUR-01 and DUR-02 are NOT marked complete by this summary -- Task 3 (operator sign-off, blocking checkpoint) has not yet run. See "Next Phase Readiness."

# Metrics
duration: ~45min (Tasks 1-2 only; Task 3 checkpoint pending)
completed: 2026-08-11
---

# Phase 110 Plan 06: DUR-02 Leg 1 + DUR-01 Live Confirmation Summary (Tasks 1-2 of 3 — checkpoint pending)

**A complete 09:00 UTC nightly prune pass is proven from `_scheduled_functions` (268 invocations spanning table indices 0-18, all success), and DUR-01's daily-rows-survive / hourly-rows-age-out claim is confirmed against the plan-110-04 baseline — both independently re-derived, not transcribed from the orchestrator's prior findings.**

## Performance

- **Duration:** ~45 min (container-log re-verification, `_scheduled_functions` probe development and query, three baseline-probe re-runs, rotation-cursor query, evidence write-up, commit)
- **Tasks:** 2 of 3 complete. Task 3 is a blocking `checkpoint:human-verify` (`autonomous: false`) — **not executed**, per dispatch instructions. This executor does not self-approve it.
- **Files modified:** 1 (`110-DUR-EVIDENCE.md`)

## Accomplishments

- **DUR-02 leg 1 closed on a durable record.** Re-verified (not transcribed) that all four chain log strings (`nightly prune started`, `all tables pruned`, `done, pruned`, `nightly batch cap`) return zero hits from `docker logs convex-backend --tail 20000`, with both positive controls re-run fresh: 436 `T09:0x`-timestamped lines proving the retained window covers the fire, and 100 `udf|function_log` hits proving UDF-adjacent output does reach stdout while none of it is this chain's application logs. `npx convex logs --history 3000` re-run with a 12s bounded-kill harness — confirmed no queryable history, goes straight to live streaming.
- Queried `_scheduled_functions` via `ctx.db.system.query(...)` (the plain `ctx.db.query(...)` form is rejected server-side — confirmed by a failing first attempt) bounded at `take(1000)`, descending. Result: 268 `pruneBatchV3` invocations in the `09:00:00Z`-`09:20:00Z` window, distinct `tableIndex` set `[0..18]` (19 values, matching `K=19` independently re-derived from `RETENTION_DAYS`), `stateCounts: {"success": 268}`, zero non-success rows. `oldestScheduledTimeInBoundedSet` fell 3 days before the window, confirming the bounded read wasn't truncated before reaching it.
- Rotation cursor presented as corroboration with its ambiguity stated explicitly (`planRotationWrite` returns `0` for both `done` and `cap-reached` at index 0) — decisive only alongside the `tableIndex` coverage set, never alone.
- Independent corroboration: re-read `retention-health.log`'s `2026-08-11 05:30:26 verdict=OK tables=19` line directly from disk — all 19 tables caught up or sub-hour overhang, 15 minutes after the chain's last invocation.
- **DUR-01 confirmed.** All three plan-110-04 baseline probes re-run byte-identical. Oldest `period:"daily"` row is byte-for-byte identical to the baseline (`_creationTime 1778029200021.6772`) — hard gate passed. Oldest `period:"hourly"` row's `_creationTime` moved forward ~49.9 days (`1778001143716.9412` → `1782314125926.0588`) — control satisfied. Bounded daily count unchanged at the `take(1000)` cap. Rotation cursor: exactly one row, `value: 0`, `source: "runtime"`, `updatedAt 1786439716.834` read as epoch seconds = `2026-08-11T09:15:16.834Z`, inside the run window and 0.615s after the window's own `lastScheduledTime`.
- **Amended a stale claim** the orchestrator wrote into `110-DUR-EVIDENCE.md` on 2026-08-10 (the `aggregates` overhang ALERT "does not clear ... persists and grows"). Verified live: a concurrent session deployed a predicate-aware overhang probe (`96a1df68`, `summarizeOverhangProbe`/`oldestPrunableDoc`) the same evening; today's health-check log shows `aggregates -> caught up`, not `ALERT`. Original reasoning preserved verbatim; a dated follow-up appended below it, not a silent rewrite.

## Task Commits

1. **Task 1 + Task 2 (evidence sections) + correction amendment** — `6e75c623` (docs) — this executor. `git show --stat HEAD` read after the commit: exactly `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md`, 432 insertions / 0 deletions, no foreign file swept in.

## Files Created/Modified

- `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` — appended `## DUR-02 leg 1`, `## DUR-01 live confirmation`, a credential-shape scan and bounding/mutation discipline self-check for this plan, and a dated follow-up amendment to the 2026-08-10 CORRECTION block.
- `.planning/phases/110-convex-durability/110-06-SUMMARY.md` — this file.

## Decisions Made

See `key-decisions` in frontmatter above (container-log re-verification approach, the hourly-probe metric_type discrepancy, and the CORRECTION-block amendment).

## Deviations from Plan

### Auto-fixed / Directed Issues

**1. [Rule 3 — blocking issue, resolved inline] `ctx.db.query()` on a system table is rejected**
- **Found during:** Task 1, first `_scheduled_functions` probe attempt
- **Issue:** `ctx.db.query('_scheduled_functions')` errors server-side: `"System tables can only be accessed from db.system.query()."`
- **Resolution:** Switched to `ctx.db.system.query('_scheduled_functions')`, which the plan's interfaces section did not spell out explicitly. Confirmed working on the next attempt.
- **Files modified:** none (query-shape correction only, not a plan or code change)
- **Verification:** the corrected query returned the expected shape and is what's pasted in the evidence file.
- **Committed in:** `6e75c623`

**2. [Not a defect — recorded for completeness] Bash tool could not run the `cmd /c "npx convex run ... --inline-query \"...\" 2>&1"` one-liner form given in the dispatch**
- **Found during:** Task 1, first probe attempts
- **Issue:** Nested double-quote escaping through Bash → `cmd /c` → PowerShell-invoked JS string produced empty/garbled output (matches this project's own documented Windows-paths gotcha: Bash mangles backslash-heavy quoted command lines).
- **Resolution:** Wrote each probe as a standalone `.ps1` script (via the Write tool, so backslash paths inside the script are never bash-argv-mangled) and invoked it with `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <path>` from Bash — this is the "run it from PowerShell, not bash" instruction, adapted to this executor's available tools (no direct PowerShell tool). All probes cited in this summary and the evidence file were produced this way.
- **Files modified:** none (scratchpad-only `.ps1` files, not committed)
- **Verification:** every probe's raw JSON/text output is pasted verbatim in `110-DUR-EVIDENCE.md`.
- **Committed in:** n/a (scratchpad tooling, not part of the commit)

---

**Total deviations:** 2 (1 blocking-issue resolution, 1 tooling adaptation — neither is a plan defect)
**Impact on plan:** No scope creep, no code changes. Both evidence sections and the correction amendment are exactly what the plan specified.

## Concurrent-Session Isolation

A concurrent session (Phase 111, mission-board) was actively committing in this checkout during this plan's execution — confirmed by a `git commit` attempt failing with `Unable to create '.git/index.lock': File exists`, followed immediately by `git log` showing a new commit (`edf142c3`, `docs(111-01): complete JobsPanel mission history plan`) that this executor did not make. Recovery: re-checked `git status --short -- .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` to confirm this executor's own staged content was untouched, then committed with an explicit pathspec (`git commit -m "..." -- .planning/phases/110-convex-durability/110-DUR-EVIDENCE.md`) rather than a bare `git commit`, since the shared index had accumulated other sessions' staged changes (`D` on `ActiveAgentsPanel.tsx`/`.test.tsx`, `M` on `Chat.tsx`) in the interval — a bare commit would have swept those in. `git show --stat HEAD` after the commit confirmed exactly one file, 432 insertions, 0 deletions. `git add` was never run with `-A`, `.`, or `-a` at any point. No `--amend`, `git stash`, `checkout -- <file>`, or `reset --hard` was used.

## Verification

- `grep -c "DUR-02 leg 1" 110-DUR-EVIDENCE.md` → `7`; `grep -c "DUR-01 live confirmation" 110-DUR-EVIDENCE.md` → `3` — both sections present.
- Credential-shape scan (`grep -inE "sk_[A-Za-z0-9]|sb_[A-Za-z0-9]|gho_[A-Za-z0-9]|Bearer [A-Za-z0-9]|convex-self-hosted\|" 110-DUR-EVIDENCE.md`) — only the pre-existing false positive on "bearer" in ordinary prose (Plan 110-04 preamble); no new match from this plan's additions.
- `npx vitest run convex/retention.test.ts convex/retentionCursor.test.ts` → 2 files, 40 tests, all passed.
- `git show --stat HEAD` after commit: exactly `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md`, 432 insertions / 0 deletions — CONFIRMED.
- No `docker exec`, `npx convex run` mutation, `npx convex deploy`, `--push`, `--prod`, or scheduler call was issued anywhere in this plan's execution — every command was either a read-only `ctx.db.query`/`ctx.db.system.query` `--inline-query`, a `docker logs` read, or a `Get-Content` log read.
- The retention cron was not hand-triggered; the observed 09:00 UTC fire happened before this session began (confirmed by `_scheduled_functions` timestamps, all in the past relative to session start).
- `npx convex env list` was not run.

## Issues Encountered

None beyond the two deviations documented above (a query-shape correction and a tooling adaptation for quoting through the Bash tool). Both were resolved without needing user input.

## User Setup Required

None for Tasks 1-2. Task 3 requires the operator (Larry) to review the evidence and the live dashboard's cost charts per the checkpoint's `<how-to-verify>` steps, then respond with the resume signal.

## Next Phase Readiness

- **DUR-01 and DUR-02 are NOT yet closed.** Task 3 is a blocking `checkpoint:human-verify` gate (`autonomous: false`) and this executor stops here per its dispatch — it does not self-approve, and STATE.md/ROADMAP.md are not updated (the orchestrator owns those writes).
- Both evidence sections are complete and committed (`6e75c623`), every verdict sits below the output that produced it, and both hard-fail/control conditions this plan required (daily-unchanged, hourly-moved-forward) are satisfied on live data.
- No blockers beyond awaiting the operator's Task 3 response. See the checkpoint report returned alongside this summary for the exact resume-signal contract.

## Self-Check

- `.planning/phases/110-convex-durability/110-DUR-EVIDENCE.md` contains `## DUR-02 leg 1` and `## DUR-01 live confirmation`: FOUND (grep counts above)
- `.planning/phases/110-convex-durability/110-06-SUMMARY.md` exists: FOUND (this file)
- Commit `6e75c623` exists: FOUND (`git show --stat HEAD` above)
- `git diff HEAD -- .planning/STATE.md .planning/ROADMAP.md` — not touched by this plan (confirmed by `git show --stat HEAD` listing only the evidence file)

## Self-Check: PASSED

---
*Phase: 110-convex-durability*
*Completed: Tasks 1-2 only, 2026-08-11 — plan not yet closed, Task 3 checkpoint pending*
