---
phase: 107-aggregates-rollup-sharding
plan: 04
subsystem: infra
tags: [convex, occ, aggregates, observability, live-baseline]

# Dependency graph
requires:
  - "107-03: sharded write path shipped to the working tree (uncommitted-to-live) — this plan measures the pre-deploy state of that same live self-hosted instance"
provides:
  - "107-OCC-BASELINE.md: the pre-deploy half of the D-05 live before/after OCC evidence — WINDOW_HOURS=2, BASELINE_AGGREGATES_COUNT=290, BASELINE_RATE_PER_HOUR=145.0, BASELINE_INGEST_VOLUME=244, BUCKET_TOTAL=RAW_EVENT_COUNT=146 (control proven working pre-deploy)"
  - "A confirmed working read-limit for events:listRecent on the live self-hosted instance (1000, not 5000 — 5000 exceeds the 16MB single-execution read cap)"
affects: [107-05, 107-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Live OCC evidence uses an explicit, uptime-bounded WINDOW_HOURS + normalized per-hour rate, never --since 24h across a container whose uptime is shorter than 24h (silent truncation = false-green)"

key-files:
  created:
    - .planning/phases/107-aggregates-rollup-sharding/107-OCC-BASELINE.md
  modified: []

key-decisions:
  - "Split the single artifact into two task commits (Section A in Task 1's commit, Sections B/C in Task 2's commit) even though both tasks target the same file — matches the plan's task boundary and keeps each commit individually reviewable against its own acceptance criteria."
  - "events:listRecent {\"limit\":5000} (the plan's literal instruction) fails with a real server error (Too many bytes read, 16MB single-execution cap) on this live dataset. Retried at descending limits; {\"limit\":1000} is the first that both succeeds and satisfies the coverage guard (min returned timestamp < H0). Recorded as a plan deviation, not a plan-text assumption, and called out explicitly for plan 107-06 to reuse limit:1000 rather than repeating the same failure."

requirements-completed: []

# Metrics
duration: ~20min
completed: 2026-08-05
---

# Phase 107 Plan 04: Pre-Deploy OCC Baseline Summary

**WINDOW_HOURS=2, BASELINE_RATE_PER_HOUR=145.0/hour on the `aggregates` table (290 of 298 total OCC/conflict/retry lines, 97.3% scoped) — plan 107-05 may now deploy.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-05
- **Tasks:** 2 completed
- **Files modified:** 1 (created)

## Accomplishments

- **Task 1 (Section A)** — Captured a single `docker logs convex-backend --since 2h` window into a scratch file outside the repo, derived every number from that one capture: 298 total OCC/conflict/retry lines, 290 (97.3%) scoped to the `aggregates` table via `grep -c '"aggregates" table'`, normalized to `BASELINE_RATE_PER_HOUR: 145.0`. Recorded both container-uptime commands (`docker inspect` StartedAt + `docker ps` Status), confirming uptime ≈3h25m (3 whole hours) — comfortably above the chosen `WINDOW_HOURS: 2`. Recorded the three hottest document IDs (top one at 194/290 = 66.9%, an even sharper concentration than the 2026-08-05 09:34 EDT reference sample's 35%) and two verbatim sample lines, inspected for token-shaped values before pasting (none found). Documented the deviation from D-05's literal `--since 24h`/`1135` method per `107-VALIDATION.md`'s corrected arithmetic.
- **Task 2 (Sections B/C)** — Measured `BASELINE_INGEST_VOLUME: 244` via `eventCountsByPeriod` over the same `WINDOW_HOURS`, and confirmed a bare `npx convex run` resolves to the self-hosted `127.0.0.1:3210` instance by re-running the identical query with an explicit `--url` and observing a near-identical count (190 vs 189, consistent with ~40s of live traffic drift, not a different backend). Ran the read-total control for the most recent complete hour: `BUCKET_TOTAL` (derived from two `eventCountsByPeriod` calls whose difference isolates one hour) = 146, `RAW_EVENT_COUNT` (a direct scan of `events:listRecent`, filtered to `[H0, H1)`) = 146 — **exact match**, proving the spot-check technique is sound pre-deploy. Hit and documented a real deviation: `events:listRecent {"limit":5000}` (the plan's literal instruction) errors with "Too many bytes read... limit: 16777216 bytes" on the live dataset; `limit:1000` is the first value that both succeeds and satisfies the coverage guard (returned minimum timestamp 1785938190 < `H0` 1785942000).

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the pre-deploy OCC rate on the aggregates table (Section A)** — `e8e70b75` (docs)
2. **Task 2: Capture pre-deploy traffic volume and run the read-total control (Sections B/C)** — `8d204fb3` (docs)

## Files Created/Modified

- `.planning/phases/107-aggregates-rollup-sharding/107-OCC-BASELINE.md` (new) — the complete pre-deploy baseline: Section A (OCC rate), Section B (traffic volume), Section C (read-total control), ending `BASELINE COMPLETE — safe to deploy (plan 107-05)`.

## Decisions Made

- Used `WINDOW_HOURS: 2` (the plan's stated default) since container uptime (≈3h25m, 3 whole hours) is comfortably above both the "must be ≤ uptime" constraint and the "1–2h → W=1" fallback trigger.
- Split the artifact-writing across two commits matching the plan's two tasks (see key-decisions above), rather than writing the whole file in one shot and committing once — keeps each commit's diff auditable against its own task's acceptance criteria.
- Left the concurrent session's untracked `phase-state.json`/`.gitkeep` files alone (not created by this plan, not staged, not reverted) per the concurrent-session protocol — reported here rather than acted on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, observed not assumed] `events:listRecent {"limit":5000}` exceeds the live instance's single-execution read cap**
- **Found during:** Task 2, Section C (raw event count for the control hour)
- **Issue:** The plan's literal instruction (`{"limit":5000}`) is not itself wrong as *design intent*, but running it against the live self-hosted instance produces a real server error: `Uncaught Error: Too many bytes read in a single function execution (limit: 16777216 bytes)`. This is new, directly-observed information the plan's author could not have had without running it live — per the "plan is a draft, not ground truth" instruction, the observation overrides the plan text.
- **Fix:** Retried at descending limits (3000, 2000 — both failed identically; 1500 — WARN near the byte cap, response not cleanly parseable; 1000 — succeeded cleanly and satisfied the coverage guard on the first attempt).
- **Files modified:** None (read-only measurement; only the artifact records this).
- **Verification:** `min(timestamp)` among the 1000 returned rows = 1785938190, strictly less than `H0` (1785942000) — coverage guard passed. `RAW_EVENT_COUNT` derived from this data matched `BUCKET_TOTAL` exactly (146 = 146).
- **Committed in:** `8d204fb3` (Task 2 commit) — documented in the artifact's Section C and flagged explicitly for plan 107-06 to reuse `limit:1000`.

No other deviations — the rest of the plan's task boundaries, file scope, and measurement method were followed as written (with the pre-planned deviation from D-05's original arithmetic, which is the plan's own designed correction, not an executor deviation).

## Issues Encountered

None beyond the documented `limit:5000` failure above — no debugging, no re-runs of the OCC log capture (single capture used throughout, per the false-green discipline), no container restarts, no source file changes.

## Live Evidence Note (D-05, continued from 107-03)

This plan captures the BEFORE half only. The live self-hosted instance still runs pre-107-03 (unsharded) code throughout this plan's execution — confirmed by `git status --porcelain convex src` being empty at every checkpoint and `docker inspect -f '{{.State.StartedAt}}' convex-backend` returning the identical value (`2026-08-05T12:45:21.334055274Z`) at the start of Task 1, the end of Task 1, and the end of Task 2. The AFTER half is plan 107-06's job, after 107-05 deploys, using the identical `WINDOW_HOURS: 2` recorded here.

## Requirement Status (OCC-01 NOT marked complete)

Per this project's established "green suite != live-verified" convention (see 107-03-SUMMARY.md), `OCC-01` is not marked complete by this plan — it captures only the BEFORE evidence. `requirements.mark-complete` was not run. OCC-01 should be marked complete only after plan 107-06 confirms the post-deploy rate actually dropped against this baseline.

## Next Phase Readiness

- `.planning/phases/107-aggregates-rollup-sharding/107-OCC-BASELINE.md` exists, contains all three required sections (A, B, C), and ends `BASELINE COMPLETE — safe to deploy (plan 107-05)`.
- **Plan 107-05 (deploy) may now run.** This artifact satisfies its hard ordering gate.
- **Plan 107-06 must reuse `WINDOW_HOURS: 2` exactly**, and must use `events:listRecent {"limit":1000}` (not `{"limit":5000}`, which fails on this live dataset) for its own read-total control.
- No blockers.

## Self-Check: PASSED

- FOUND: .planning/phases/107-aggregates-rollup-sharding/107-OCC-BASELINE.md
- FOUND: e8e70b75
- FOUND: 8d204fb3
- FOUND: .planning/phases/107-aggregates-rollup-sharding/107-04-SUMMARY.md

---
*Phase: 107-aggregates-rollup-sharding*
*Completed: 2026-08-05*
