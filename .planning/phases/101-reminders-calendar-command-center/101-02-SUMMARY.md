---
phase: 101-reminders-calendar-command-center
plan: 02
subsystem: api
tags: [convex, http-action, ingest-auth, calendar-cache, reminders]

# Dependency graph
requires:
  - phase: 101-reminders-calendar-command-center (plan 01)
    provides: "reminders Convex table + CRUD mutations/queries (api.reminders.create/update/complete/listByProfile) that this plan's httpActions dispatch to"
provides:
  - "POST /reminders-ingest — authed create/update/complete dispatch onto api.reminders.* (source always 'astridr' on create, D-09)"
  - "POST /reminders-read — authed profile read via api.reminders.listByProfile (D-07, never anonymous)"
  - "POST /calendar-ingest — authed upsert-by-googleEventId + scoped stale prune sink for Ástríðr's calendar cron (D-10)"
  - "calendarEvents Convex table (read-only cache) + listByProfile query"
affects: ["101-03 (Ástríðr reminders tool — writes/reads these endpoints)", "101-04 (Ástríðr calendar cron — pushes to /calendar-ingest)", "101-06 (Reminders page — reads calendarEvents.listByProfile for the overlay)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "httpAction._handler escape hatch for tests: Convex's httpAction()/mutation()/query() wrappers expose the raw handler as `._handler` (node_modules/convex/dist/cjs/server/impl/registration_impl.js), letting tests invoke the real handler with a mocked {runMutation, runQuery} ctx and a genuine Request/Response, instead of hand-duplicating the dispatch logic (the older convex/forgeIngest.test.ts precedent). Recommended for future ingest-httpAction test files in this repo."
    - "Scoped upsert+prune: calendarIngest prunes only rows matching BOTH profileId and calendarAccount from the authed push — mirrors registry.ts's per-origin skill prune pattern but scoped two levels deep instead of one."

key-files:
  created:
    - convex/calendarEvents.ts
    - convex/remindersIngest.ts
    - convex/remindersIngest.test.ts
  modified:
    - convex/schema.ts
    - convex/http.ts
    - convex/_generated/api.d.ts

key-decisions:
  - "Task 1 (schema + listByProfile) skipped a vitest RED gate, following the 101-01 Task-1 precedent — a schema-table addition with a pass-through query has no meaningful failing-behavior to assert beforehand; verified via `npx convex codegen && npx tsc --noEmit` per the plan's own <verify> block instead."
  - "Tests invoke the real httpAction handlers via Convex's `._handler` property rather than re-implementing the dispatch logic in a parallel 'simulate' function (the codebase's forgeIngest.test.ts precedent) — this closes the gap where the test and the implementation could silently drift, at the cost of one extra layer of Convex-internals knowledge documented inline in the test file."
  - "calendarIngest requires calendarAccount as well as profileId+events (400 if missing), even though the plan's acceptance-criteria bullet only named profileId/events — calendarAccount is load-bearing for the scoped prune (D-10/T-101-04); accepting a batch without it would either fail the prune scope or silently prune across accounts. Documented here as a Rule 2 (missing-critical-validation) addition, not a plan deviation in behavior."

requirements-completed: [REM-02]

# Metrics
duration: 6min
completed: 2026-07-19
---

# Phase 101 Plan 02: Reminders & Calendar Ingest HTTP Surface Summary

**Three authed, fail-closed Convex httpActions (`/reminders-ingest`, `/reminders-read`, `/calendar-ingest`) plus the read-only `calendarEvents` cache table, giving Ástríðr write/read access to the plan-01 reminders store and a scoped upsert+prune sink for Google Calendar events.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T17:43:01-04:00
- **Completed:** 2026-07-19T17:49:19-04:00
- **Tasks:** 3
- **Files modified:** 6 (convex/schema.ts, convex/calendarEvents.ts, convex/remindersIngest.ts, convex/remindersIngest.test.ts, convex/http.ts, convex/_generated/api.d.ts)

## Accomplishments
- `calendarEvents` Convex table live with `by_profile`/`by_googleEventId` indexes — a read-only cache written ONLY by `/calendar-ingest` (D-02/D-03), plus `listByProfile` for the future page overlay
- `POST /reminders-ingest` dispatches `op: "create"|"update"|"complete"` onto `api.reminders.*`, hard-coding `source:"astridr"` on every create so a client-supplied `source` can never spoof origin (D-09)
- `POST /reminders-read` authed profile read via `api.reminders.listByProfile` — reminders are never exposed to an anonymous cross-origin read (D-07)
- `POST /calendar-ingest` upserts a pushed event batch by `googleEventId` and prunes rows scoped to exactly (`profileId`, `calendarAccount`) that fell out of the push — other profiles' and other accounts' cached rows are provably untouched (D-10, T-101-04)
- All three endpoints fail CLOSED via the shared `validateIngestAuth` (T-101-01) — verified both via env-unset and wrong-key cases, not just "no header"
- 28/28 new tests green (auth gate x2 endpoints, body validation/dispatch for all 3 endpoints including throw→400, and DB-level upsert+prune correctness including the "other account untouched" and "other profile untouched" cases); full suite 2100/2100 passing (baseline 2072 + 28), 0 regressions; `npx tsc -p convex/tsconfig.json --noEmit` clean

## Task Commits

Each task was committed atomically (Tasks 2 and 3 followed RED → GREEN; the RED test file covered both, so the GREEN split lands one commit per task with the calendar half's route/handler landing in Task 3):

1. **Task 1: calendarEvents table + listByProfile query** - `0a3ec65` (feat)
2. **Task 2: /reminders-ingest + /reminders-read httpActions** - `be30b67` (test, RED — covers Tasks 2+3) → `6189034` (feat, GREEN for reminders half)
3. **Task 3: /calendar-ingest upsert + stale prune** - `69aa4d9` (feat, GREEN for calendar half — full suite confirmed passing here)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `convex/schema.ts` - added `calendarEvents` defineTable + `by_profile`/`by_googleEventId` indexes
- `convex/calendarEvents.ts` - `listByProfileHandler`/`listByProfile` query, `upsertCalendarBatchHandler`/`upsertBatch` mutation (upsert-by-googleEventId + scoped stale prune), `calendarIngest` httpAction (auth, OPTIONS, field validation, delegates to `upsertBatch`)
- `convex/remindersIngest.ts` - `remindersIngest` httpAction (op-dispatched create/update/complete onto `api.reminders.*`) and `remindersRead` httpAction (authed profile read), both mirroring the v6Ingest handler contract exactly
- `convex/remindersIngest.test.ts` - 28 tests: auth gate for both reminders endpoints and calendar-ingest (missing/blank/unset/wrong key), body-validation + dispatch for all 3 endpoints via real handler invocation (`._handler`), and DB-level `upsertCalendarBatchHandler` upsert+prune correctness against an in-memory fake `ctx.db`
- `convex/http.ts` - registered `/reminders-ingest`, `/reminders-read`, `/calendar-ingest` (+ OPTIONS) routes
- `convex/_generated/api.d.ts` - regenerated by `npx convex codegen` (twice) to register the new module exports; already dirty pre-plan from unrelated prior work, no unrelated content included in either commit

## Decisions Made
- **`._handler` test invocation over a hand-duplicated dispatch simulation**: the codebase's existing precedent (`convex/forgeIngest.test.ts`) tests a parallel "simulate" re-implementation of each handler's decision tree rather than the real handler, because Convex httpActions normally require the Convex runtime and `convex-test` isn't installed. Discovered that `httpAction()`/`mutation()`/`query()` all expose the raw handler function as `._handler` (bypassing the `dontCallDirectly` wrapper), which is directly callable with a hand-built `ctx = { runMutation: vi.fn(), runQuery: vi.fn() }` and a real `Request`. Used this for full-fidelity coverage of the actual implementation instead of a logic-duplicate that could silently drift from it. Documented inline in the test file for future ingest-endpoint test authors in this repo.
- **calendarAccount required on /calendar-ingest**: the plan's Task 3 acceptance criteria only explicitly named `profileId`/`events` as required, but `calendarAccount` is structurally required by the scoped-prune contract (D-10 prunes by `(profileId, calendarAccount)`) — accepting a push without it would make the prune scope ambiguous. Validated as a 400 alongside the other two required fields (Rule 2).
- **Task 1 skipped a vitest RED gate**: same rationale as 101-01's schema task — verified via the plan's own `npx convex codegen && npx tsc --noEmit` gate instead of a failing-test-first cycle, since a table addition + pass-through query has no pre-existing failing behavior to assert.

## Deviations from Plan

None — plan executed exactly as written. The `._handler` test-invocation choice and the `calendarAccount`-required validation are interface/robustness details the plan left implicit, not departures from specified behavior (both are additive, not behavior changes to what the plan's `<behavior>`/`<interfaces>` blocks specified).

## Issues Encountered

- **Test file spans two tasks' worth of new exports**: the plan's own `<files>` list put `remindersIngest.test.ts` under both Task 2 and Task 3, meaning the single committed RED test file imports `calendarIngest`/`upsertCalendarBatchHandler` from `convex/calendarEvents.ts` before either exists. This made a strictly per-task isolated RED→GREEN cycle structurally impossible within one test file: the reminders-half tests (auth, dispatch) only became runnable once `remindersIngest.ts` existed, but the whole file (including calendar tests) only became import-resolvable once Task 3's exports also existed. Resolved by committing Task 2's implementation as a "feat, GREEN pending Task 3" commit (explicitly noted in that commit's message) and running the full green verification once Task 3 landed — both task commits are still separately traceable and individually revertable, and the final `npx vitest run convex/remindersIngest.test.ts` (28/28) plus full-suite (2100/2100) runs confirm both halves are correct together.
- **`npx convex codegen` pushes to the cloud deployment**: per 101-CONTEXT.md, `npx convex` from codepulse targets the cloud deployment `tidy-whale-981`, not a local backend — codegen's "Uploading functions to Convex..." step is expected behavior here, not a stray deploy. Ran twice (once per schema/module addition) as directed by the plan's own `<verify>` blocks.

## User Setup Required

None — no external service configuration required. `ASTRIDR_INGEST_API_KEY` is the existing shared ingest key (already required by ~15 other endpoints per 101-CONTEXT.md's prerequisites); no new env var was introduced. Larry/Ástríðr-side wiring (actually calling these endpoints from `ConvexHandler.send_to` and the calendar cron) is 101-03/101-04's scope, not this plan's.

## Next Phase Readiness

- `/reminders-ingest`, `/reminders-read`, `/calendar-ingest` are live, authed, fail-closed, and registered in `convex/http.ts` — ready for 101-03 (Ástríðr reminders tool) to call `/reminders-ingest`/`/reminders-read`, and 101-04 (Ástríðr calendar cron) to call `/calendar-ingest`.
- `calendarEvents.listByProfile` is ready for 101-06 (Reminders page) to render the read-only overlay.
- **REM-02 marked complete** in REQUIREMENTS.md (single-plan requirement, fully satisfied by this plan). **CAL-01 left Pending** — it spans this plan (the sink) and 101-04 (the Ástríðr-side cron that actually pushes data), per the prior-wave instruction; do not mark it complete until 101-04 lands.
- No blockers. `npx vitest run convex/remindersIngest.test.ts` (28/28), full suite (2100/2100, 0 regressions), and `npx tsc -p convex/tsconfig.json --noEmit` are all clean.

---
*Phase: 101-reminders-calendar-command-center*
*Completed: 2026-07-19*

## Self-Check: PASSED

- FOUND: convex/schema.ts
- FOUND: convex/calendarEvents.ts
- FOUND: convex/remindersIngest.ts
- FOUND: convex/remindersIngest.test.ts
- FOUND: convex/http.ts
- FOUND: .planning/phases/101-reminders-calendar-command-center/101-02-SUMMARY.md
- FOUND commit: 0a3ec65 (feat — calendarEvents table + listByProfile)
- FOUND commit: be30b67 (test RED — reminders + calendar ingest httpActions)
- FOUND commit: 6189034 (feat GREEN — /reminders-ingest + /reminders-read)
- FOUND commit: 69aa4d9 (feat GREEN — /calendar-ingest upsert + prune)
