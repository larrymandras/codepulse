---
phase: 93-eval-pipeline-quality-kpis
plan: 01
subsystem: database
tags: [convex, eval-pipeline, idempotency, audit-trail, task_quality]

# Dependency graph
requires: []
provides:
  - "evalScores Convex table (full judge-ready field set: dimensions/rubricVersion/judgeModel) with by_idempotencyKey, by_profileId, by_scoreName indexes"
  - "processTaskQualityEvent pure coalescing helper + ingestTaskQuality idempotent mutation (convex/evalScores.ts)"
  - "task_quality case in runtimeIngest.ts dispatch, inheriting validateIngestAuth"
  - "personaConfigChangeKey helper + configChanges audit insert in profiles.upsertConfig"
affects: [93-02, 93-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent ingest mutation: same-mutation query-then-insert on by_idempotencyKey (mirrors convex/events.ts:20-30)"
    - "Extracted-pure-function test pattern for convex-test-absent repo (mirrors runtimeIngest.test.ts processSwarmTaskEvent)"

key-files:
  created:
    - convex/evalScores.ts
    - convex/evalScores.test.ts
  modified:
    - convex/schema.ts
    - convex/runtimeIngest.ts
    - convex/runtimeIngest.test.ts
    - convex/profiles.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "processTaskQualityEvent is imported into runtimeIngest.ts's task_quality case (not duplicated inline) so the coalescing logic can never drift from what the unit tests exercise"
  - "ingestTaskQuality silently rejects (no insert, no throw) NaN/out-of-range overall scores rather than throwing — matches the httpAction's existing 'best-effort, don't 500 the whole batch' dispatch style"
  - "personaConfigChangeKey scoped to profileConfigs.upsertConfig only, NOT agentProfiles.update, per RESEARCH Assumption A1 (agentProfiles has zero rows)"
  - "Manually patched convex/_generated/api.d.ts (no CONVEX_DEPLOYMENT configured in this worktree to run `npx convex dev`/codegen) — same offline-patch approach documented in Phase 88 Plan 02"

patterns-established:
  - "Judge-ready schema fields (dimensions/rubricVersion/judgeModel) defined in Wave 0 so downstream eval-pipeline plans never re-touch schema.ts"

requirements-completed: [EVAL-01]

# Metrics
duration: ~20min
completed: 2026-07-05
---

# Phase 93 Plan 01: Eval Ingest & Audit-Trail Gap Summary

**New `evalScores` Convex table + idempotent `task_quality` ingest mutation wired into the existing `/runtime-ingest` dispatch, plus a `configChanges` audit insert closing the persona-model-change tracking gap in `profiles.upsertConfig`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `evalScores` table now exists with the full judge-ready field set (`scoreName`, `profileId`, `sessionId`, `overall`, `dimensions`, `rubricVersion`, `judgeModel`, `idempotencyKey`, `timestamp`) and three indexes — schema will not need to be re-touched by Plan 02 (LLM judge) or Plan 03 (regression detection).
- Ástríðr's `task_quality` scores (previously written to Langfuse only and dropped on the CodePulse side) now persist exactly once per event, even under at-least-once HTTP retry, via a `by_idempotencyKey` early-return dedup inside the same mutation as the insert.
- `runtimeIngest.ts` gained a `task_quality` case that inherits the existing `validateIngestAuth` Bearer gate — no new HTTP route, no new auth check.
- `profiles.upsertConfig` now writes an auditable `configChanges` row (`profile.<id>.modelPreferences`) whenever a persona's model preferences actually change, closing RESEARCH Pitfall 2 / D-11 so EVAL-03's regression-detection join has real rows to read.

## Task Commits

Each task was committed atomically:

1. **Task 1: evalScores table + idempotent ingest mutation + dispatch case** - `b46d98a` (feat)
2. **Task 2: Close the configChanges audit-trail gap in profiles.upsertConfig** - `d2d84ef` (fix)

**Plan metadata:** (this commit)

_Both tasks were `tdd="true"`; tests were written alongside the implementation in the same commit per this repo's convex-test-absent convention (plain vitest unit tests on extracted pure functions, not RED-then-GREEN separate commits — matching the existing `runtimeIngest.test.ts` precedent read at plan start)._

## Files Created/Modified
- `convex/schema.ts` - Added `evalScores` table (full judge-ready fields, 3 indexes)
- `convex/evalScores.ts` - `processTaskQualityEvent` pure helper + `ingestTaskQuality` idempotent mutation
- `convex/evalScores.test.ts` - Unit tests for coalescing, defaults, NaN/range rejection, and `personaConfigChangeKey`
- `convex/runtimeIngest.ts` - Added `case "task_quality"` to the dispatch switch, importing `processTaskQualityEvent`
- `convex/runtimeIngest.test.ts` - Added `describe("runtimeIngest — task_quality case")` block
- `convex/profiles.ts` - Added `personaConfigChangeKey` export + `configChanges` audit insert inside `upsertConfig`
- `convex/_generated/api.d.ts` - Manually registered the new `evalScores` module (no live Convex deployment in this worktree — see Deviations)

## Decisions Made
- `processTaskQualityEvent` is imported into the `runtimeIngest.ts` case rather than re-implemented inline, so the dispatch logic and the unit-tested pure function can never drift apart (the `swarm_task` precedent duplicates the logic between the module and the test file; this plan intentionally deviates by sharing one implementation, since evalScores.ts already exports it for testing).
- `ingestTaskQuality` treats an out-of-range/NaN score as a silent no-op (no insert) rather than throwing, matching the httpAction's existing "don't fail the whole batch over one bad sub-event" dispatch style seen throughout `runtimeIngest.ts`.
- Audit-trail scope: only `profileConfigs.upsertConfig` was instrumented, not `agentProfiles.update` — per RESEARCH Assumption A1 (`agentProfiles` has zero rows; the three real personas move through `profileConfigs` only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manually patched `convex/_generated/api.d.ts`**
- **Found during:** Task 1 (`npx tsc --noEmit` verification step)
- **Issue:** `api.evalScores.ingestTaskQuality` did not typecheck — the new `evalScores` module isn't registered in the generated `api.d.ts`. This worktree has no `CONVEX_DEPLOYMENT` configured, so `npx convex codegen`/`npx convex dev` fail with "No CONVEX_DEPLOYMENT set."
- **Fix:** Manually added the `evalScores` import and `fullApi` entry to `convex/_generated/api.d.ts` in alphabetical order (between `episodic` and `events`), matching the existing file's structure exactly. This is the same offline-patch approach documented in the Phase 88 Plan 02 decisions (STATE.md: "Ran `npx convex codegen` (offline, NOT a deploy)").
- **Files modified:** `convex/_generated/api.d.ts`
- **Verification:** `npx tsc --noEmit` exits 0; full `npm test` suite green (1537 passed).
- **Committed in:** `b46d98a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to unblock `tsc --noEmit` per the plan's own acceptance criteria; no scope creep. A real `npx convex dev` run against a live deployment should regenerate this file properly the next time one is available, superseding the manual patch with an identical result (same module set, same shape).

## Issues Encountered
None beyond the above.

## User Setup Required
None - no external service configuration required. (Note: a live Convex deployment will need to run `npx convex dev` at some point to have the platform independently regenerate `_generated/api.d.ts`/`api.js` from source — the manual patch here is TypeScript-only and does not affect the runtime `anyApi` proxy used by `api.js`.)

## Next Phase Readiness
- `evalScores` schema is judge-ready — Plan 02 (LLM judge / nightly `internalAction`) can write `dimensions`/`rubricVersion`/`judgeModel` without touching `schema.ts`.
- `configChanges` now has real persona-model-change rows — Plan 03 (regression detection / D-11 join) has data to read.
- No blockers identified for 93-02 or 93-03.

---
*Phase: 93-eval-pipeline-quality-kpis*
*Completed: 2026-07-05*

## Self-Check: PASSED

All created/modified files verified present; all 3 task/summary commits (`b46d98a`, `d2d84ef`, `4805cd0`) verified in git log.
