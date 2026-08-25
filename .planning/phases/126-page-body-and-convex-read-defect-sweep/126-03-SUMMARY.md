---
phase: 126-page-body-and-convex-read-defect-sweep
plan: 03
subsystem: frontend
tags: [automation, cron, convex-subscriptions, vitest, d-07, d-09, d-10]

# Dependency graph
requires: []
provides:
  - "schedulesToCronJobs() exported from src/lib/cronSchedules.ts (moved from Automation.tsx) -- the real catalog-to-row mapping, now driven by real tests instead of a hand-copied mirror"
  - "CronJobList only calls cronToHuman()/offers the edit affordance when isValidCron(job.expression) is true (D-09/D-10)"
  - "A precise, reproducible measurement of the /automation stat-card delay (cold vs. warm Convex query subscription, ~9-10s vs. ~4ms), narrowing the open todo from 'unknown, 3 tiles never resolve' to a specific, falsifiable next probe"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gate a formatter/parser call behind the validity predicate it already assumes (isValidCron before cronToHuman), rather than trusting the caller's field name"
    - "WS-frame-level Playwright instrumentation (correlate ModifyQuerySet Add queryId -> Transition QueryUpdated) to measure Convex client subscription timing directly, independent of DOM render timing"

key-files:
  created:
    - src/components/CronJobList.test.tsx
  modified:
    - src/lib/cronSchedules.ts
    - src/pages/Automation.tsx
    - src/components/CronJobList.tsx
    - src/pages/__tests__/Automation.test.tsx
    - .planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md

key-decisions:
  - "Task 1b (D-10): implemented the dead-edit-affordance retirement INSIDE CronJobList via the same isValidCron(job.expression) predicate Task 1 already introduced, not by having Automation.tsx conditionally omit the onEdit prop for the whole list. Documented as a deviation below -- the plan's own acceptance criteria (one render, mixed catalog + real-cron rows, per-row behavior) cannot be satisfied by a single list-wide onEdit toggle."
  - "Task 2/3 (D-07): measurements show the stat cards DO resolve -- after a highly reproducible ~9-10s COLD SUBSCRIPTION delay, not never. Neither Branch A (read-ceiling breach) nor Branch B (client wiring bug) is justified by the evidence. Took Branch C: no source fix, todo updated with full measurements and a narrowed next probe."

requirements-completed: [SWEEP-05]

# Metrics
duration: ~2h10min
completed: 2026-08-24
---

# Phase 126 Plan 03: Automation Page -- Cron Parse Fix, Dead Edit Affordance, and Stat-Card Measurement Summary

**Twelve `/automation` schedule rows now render their real schedule once instead of "Invalid expression" (D-09), catalog rows that can never be saved no longer invite an edit click (D-10), and the three stuck stat cards are measured -- they resolve after a reproducible ~9-10s cold-subscription delay, not never, with the mechanism behind that delay left honestly unsettled (D-07).**

## Performance

- **Duration:** ~2h10min
- **Tasks:** 4/4 (Task 1, Task 1b, Task 2 measurement, Task 3 Branch C)
- **Files modified:** 5 (4 source/test + 1 todo)
- **Commits:** 1 (Task 1 + Task 1b combined, since both touch the same files; Task 2/3 made no source changes to commit)

## Accomplishments

### Task 1 -- D-09 parse fix

- Moved `schedulesToCronJobs()` from `Automation.tsx` into `src/lib/cronSchedules.ts` and exported it, so tests drive the real catalog-to-row mapping instead of a hand-copied mirror. `Automation.tsx` now imports it.
- `CronJobList.tsx` imports `isValidCron` alongside `cronToHuman` and only calls the parser when `isValidCron(job.expression)` is true. `CRON_SCHEDULES[].interval` is a human-readable label by design ("Every 5 min", "Daily 03:00 UTC"); the machine truth lives in separate `intervalSeconds`/`dailyUTC` fields the row never used for display. Non-cron rows now render their label once, in the existing muted style, with no parser call.
- Created `src/components/CronJobList.test.tsx` (103 lines) exercising the REAL, unmocked `CRON_SCHEDULES` catalog -- no `vi.mock` of `cronSchedules` or `cronToHuman` (`grep -c "vi.mock" src/components/CronJobList.test.tsx` matches only a comment line explaining that absence, zero actual `vi.mock(` calls).
- **Enumerated measurement (the diagnosis restated as data, all 12 rows, all `false`):**
  ```
  ["stale sessions","Every 5 min",false]
  ["alert evaluation","Every 1 min",false]
  ["metric rollup","Every 5 min",false]
  ["docker poll","Every 2 min",false]
  ["supabase poll","Every 1 hour",false]
  ["llm cost rollup","Every 10 min",false]
  ["stale agents","Every 10 min",false]
  ["profile summary","Every 15 min",false]
  ["memory prune","Daily",false]
  ["purge old telemetry events","Daily 03:00 UTC",false]
  ["purge old heartbeat alerts","Daily 03:15 UTC",false]
  ["purge old memory events","Daily 03:30 UTC",false]
  ```
- The `purge old telemetry events` row renders the exact text `Daily 03:00 UTC` **once** within that row (`within(row).getAllByText("Daily 03:00 UTC")` has length 1; `within(row).queryByText("Invalid expression")` is null).
- Positive control: `{name:"real", expression:"0 3 * * *"}` renders both `0 3 * * *` and `Every day at 3:00`.
- **Mutation proof (manual, via Bash, not a permanent test):** temporarily set `const editable = true` (bypassing the `isValidCron` guard, reproducing the pre-fix "call the parser unconditionally" behaviour). Re-ran `npx vitest run src/components/CronJobList.test.tsx`:
  ```
  Test Files  1 failed (1)
       Tests  3 failed | 4 passed (7)
  FAIL > the "purge old telemetry events" row renders "Daily 03:00 UTC" exactly once
  FAIL > no catalog row ever renders the string "Invalid expression"
  FAIL > clicking a catalog row (non-cron expression) does NOT invoke onEdit
  ```
  Reverted the guard; re-ran: `Test Files 2 passed (2) / Tests 9 passed (9)` (GREEN, both `CronJobList.test.tsx` and `Automation.test.tsx`).

### Task 1b -- D-10 dead edit affordance

- `CronJobList.tsx`'s per-row job-info `<div>` now gates both `cursor-pointer` and the `onClick={() => onEdit(job)}` handler on the same `isValidCron(job.expression)` predicate Task 1 introduced. A row whose expression is not a real cron string is neither visually nor functionally clickable.
- Test coverage in the same `CronJobList.test.tsx`: clicking the "stale sessions" catalog row does not invoke `onEdit` and its job-info div carries no `cursor-pointer` class; the control -- a row with `expression: "*/5 * * * *"` -- both carries `cursor-pointer` and invokes `onEdit` with the row's job object on click.
- **Deviation from the plan's literal option menu, documented per the plan's own instruction to correct it and say so:** the plan offered "(a) omit onEdit wiring in CronJobList for catalog-sourced rows" vs "(b) keep the row inert by not passing onEdit at all from Automation.tsx for catalog rows," and its accompanying prose leaned toward doing it at the Automation.tsx call site. Task 1b's own acceptance criteria require a SINGLE render mixing a catalog row (must not open) and a real-cron control row (must open) and asserting per-row behaviour -- that is only satisfiable if `CronJobList` itself decides per row, since `onEdit` is one callback prop shared by the whole list. Implemented via the `isValidCron(job.expression)` check already present from Task 1: this is not "hardcoding catalog rows are never editable" (the plan's own concern) -- it is a data-driven predicate (any row's expression, from any future source, that is not a real cron string is inert) that happens to currently apply to all twelve catalog rows. `CronJob`, the cron-string generator, and the `cron.trigger`/`cron.create` dispatch were all left untouched, honoring the hard constraint.

### Task 2 -- D-07 measurement (no source changes)

**Read-only against the live self-hosted deployment**, per the environment note (`npx convex run <module>:<query>`, no `--push`).

**(a)** `npx convex run automation:cronSummary '{}' --env-file C:/Users/mandr/convex-selfhost/selfhosted.envfile`:
```json
{ "avgDurationMs": 1433.8125, "failed": 0, "succeeded": 16, "totalJobs": 12, "totalRuns": 16 }
```
Returned in well under a second. No error, no read-limit or timeout text.

**(b)** Discriminating control: `npx convex run automation:recentCrons '{"limit":10}' --env-file <same>` returned 10 real `cronExecutions` rows (job names `reminder:nudge`, `calendar:cache_refresh`, real `_id`s/timestamps). **What would have pointed away from an unbounded-read story, stated before running it:** if `cronSummary` had returned an error naming a read-limit or timeout while `recentCrons` (the same table, bounded) returned cleanly, that would have implicated the unbounded `.filter().collect()` shape research flagged. Instead both returned cleanly and fast, which is evidence AGAINST that mechanism, not merely absence of evidence for it.

**(c)** Timestamp-unit sanity check, using the 10 sampled `recentCrons` rows: raw `timestamp` values (e.g. `1787615153.4557378`) interpreted as epoch **seconds** map to `2026-08-24T23:45:53.455Z` -- matches today's date. Interpreted as milliseconds they map to `1970-01-21T16:33:35.153Z` -- clearly wrong. All 10 sampled rows fall inside `cronSummary`'s one-hour window (`oneHourAgo` computed the same way the handler does: `Date.now()/1000 - 3600`); this is consistent with `cronSummary`'s own `totalRuns: 16` for the same hour -- a small, cheap-to-scan set, not a scale that would approach the 4,096-read ceiling.

**(d)** Page observation via Playwright against the `dev:noauth` server (port 5181, `VITE_CLERK_PUBLISHABLE_KEY=` issued from Git Bash) and, to rule out a dev-only artifact, a **production build** served via `vite preview` (port 4183, also built with `VITE_CLERK_PUBLISHABLE_KEY=`):

- Exactly 4 `[data-testid="metric-card"]` elements render; `[data-testid="metric-card-skeleton"]` count is 3 for a real window after page load, then drops to 0. The rest of the page (twelve schedule rows, execution history, heartbeat/job panels, checkpoint/integration panels) renders normally and immediately -- consistent with the todo's own observation that this does NOT look like a throwing-query-blanks-the-tree failure.
- No console errors, no page errors, in either dev or production build.
- **WS-frame-level instrumentation** (Playwright `page.on('websocket')`, correlating each `ModifyQuerySet` `Add` `queryId` to its later `Transition` `QueryUpdated`) shows the actual mechanism precisely:
  - A query already subscribed elsewhere in the same session -- `automation:recentCrons` with empty args `{}`, pre-warmed by shell-level hooks `src/hooks/useNavCounts.ts:22` and `src/hooks/useCommandPaletteSearch.ts:30` (both call `useQuery(api.automation.recentCrons, {})` outside the Automation page) -- delivers its first value in **25-43ms** across every run.
  - The four queries genuinely new to the session -- `automation:cronSummary {}`, `automation:recentCrons {limit:200}`, `automation:recentHeartbeats {limit:30}`, `automation:recentJobs {limit:100}` -- deliver their first value **simultaneously** (within 4ms of each other, despite different tables/complexity) after:
    - Run 1 (dev, StrictMode active): **9028ms**
    - Run 2 (dev, StrictMode active): **9117ms**
    - Run 3 (**production build**, `vite preview`, no StrictMode double-invoke): **8752-8775ms**
  - **Decisive control:** within the SAME WebSocket session, navigating away from `/automation` to `/dashboard` and back made the identical four queries resolve in **4ms** (re-subscribed at t+13051ms, updated at t+13055ms). Cold-vs-warm subscription is the discriminator -- not query cost (all four differ in table/complexity but resolve together), not React StrictMode (the delay reproduces identically, ~8.75s, in a production build with a single clean subscribe, no double-invoke churn), not table size (the CLI proved the same computation takes well under a second).

**Conclusion (Task 2), stated before any fix was attempted:** the mechanism is a **cold-subscription delay of ~9-10s specific to a query's first subscription within a WebSocket session** -- not a read-ceiling breach (ruled out by (a)/(b)/(c): the query is fast and small), not a StrictMode dev artifact (ruled out by the production-build run), and not a client-rendering bug (`useMetricState`/`MetricCard` correctly show loading, then correctly show the real value once it arrives -- there is no incorrect state transition to fix). **What is NOT established:** why a brand-new subscription takes ~9-10s server/transport round-trip when the same computation returns in well under a second via direct CLI call, and why an already-warm subscription is near-instant. That is a self-hosted-backend-or-transport-level question this plan's measurements do not reach (no backend log/source inspection was done). No conclusion here uses the word "likely" attached to an untested mechanism; the untested candidates are named explicitly as open, not asserted.

### Task 3 -- Branch C (no source fix, honest partial)

**Branch selected: C.** Quoting the Task 2 line that selects it: *"the mechanism behind the ~9s cold-subscription delay is unconfirmed... it is not a per-query computation cost... not a dev-mode artifact... and not explained by anything in `convex/automation.ts`."* Branch A (read-ceiling/unbounded-collect fix) does not apply -- (a) proved `cronSummary` returns fast and small, so bounding it would fix nothing real. Branch B (client wiring bug) does not apply either -- `useMetricState`/`MetricCard` behave exactly as designed given the raw `useQuery` value's actual timing (`loading` while `undefined`, `ready` once a value arrives); there is no incorrect state transition anywhere in that chain to patch.

- `git diff --stat` for `convex/` and `src/` after Task 2 and Task 3 combined: **empty** (verified via `git diff --stat -- src/ convex/` after Task 1's commit landed -- zero further hunks).
- Updated `.planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md` in place: marked the D-09/D-10 half RESOLVED (pointing at this plan), narrowed the remaining scope to the stat-card cold-subscription finding, embedded the full verbatim measurements above, and named a concrete next probe (inspect the self-hosted backend's subscription pipeline directly, or compare against a different self-hosted instance / Convex Cloud to isolate whether the ~9s is instance-specific).
- `npm test`: 365 test files passed, 17 skipped (382 total); 5100 tests passed, 195 todo, **0 failed**. `npx tsc --noEmit` exits 0.
- **SWEEP-05 is PARTIAL.** The "Invalid expression" and dead-edit-affordance halves (D-09/D-10) are closed. The stat-card half is measured, not fixed -- an honest partial per the plan's own instruction that a plausible fix on unsettled evidence is the wrong outcome here.
- No `convex/` file was modified by this plan at all (Task 1/1b are frontend-only), so there is nothing to flag for plan 126-09's deploy audit.

## Task Commits

1. **Task 1 + Task 1b combined (both touch the same 5 files): D-09 parse fix + D-10 dead edit affordance** - `8cd23d54` (fix)
2. **Task 2 (measurement) and Task 3 (Branch C, no fix)** - no commit; only `.planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md` changed, staged and committed as part of this plan's final metadata commit (see below).

`git show --stat 8cd23d54` confirms exactly the intended 5 files (204 insertions, 71 deletions, `src/components/CronJobList.test.tsx` created) with no sweep-in from the concurrently active session (which was editing `convex/schema.ts`, `convex/bifrost.ts`, `CommandPalette.tsx`, `Bifrost.tsx`, etc. -- none of which appear in this commit).

## Files Created/Modified

- `src/lib/cronSchedules.ts` -- added `schedulesToCronJobs()` (moved from `Automation.tsx`, verbatim body/comment)
- `src/pages/Automation.tsx` -- removed the local `schedulesToCronJobs()` declaration and the now-unused `CronJob` type import; imports the function from `cronSchedules.ts` instead
- `src/components/CronJobList.tsx` -- gates `cronToHuman()` and the row's click affordance (`onClick`/`cursor-pointer`) behind `isValidCron(job.expression)`
- `src/components/CronJobList.test.tsx` (created, 103 lines) -- real-catalog rendering + D-10 affordance tests, no `vi.mock` of `cronSchedules`/`cronToHuman`
- `src/pages/__tests__/Automation.test.tsx` -- its pre-existing `vi.mock("../../lib/cronSchedules", ...)` was broken by moving `schedulesToCronJobs` out of `Automation.tsx`; updated the mock factory to also export a `schedulesToCronJobs` mirroring its own 3-item synthetic catalog (this does not weaken coverage -- `CronJobList.test.tsx` is what exercises the real, unmocked module; this file's job was always to prove the metric count is computed, not to catch the parse defect)
- `.planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md` -- rewritten to mark the parse half resolved and carry the stat-card cold-subscription measurements forward

## Decisions Made

- **D-10 implementation location:** see "Task 1b" above -- implemented via a data-driven `isValidCron` predicate inside `CronJobList`, not a call-site-only toggle in `Automation.tsx`, because the plan's own required control (mixed catalog + real-cron rows in one render) cannot be satisfied any other way without adding a new field to `CronJob` (which was explicitly forbidden).
- **Task 3 branch selection (C):** see "Task 2 -- Conclusion" and "Task 3" above. No fix was written against unsettled evidence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] `Automation.test.tsx`'s existing `cronSchedules` mock was broken by moving `schedulesToCronJobs()` out of `Automation.tsx`**
- **Found during:** Task 1, first test run after the move (`No "schedulesToCronJobs" export is defined on the "../../lib/cronSchedules" mock`)
- **Issue:** `vi.mock("../../lib/cronSchedules", ...)` in `Automation.test.tsx` only stubbed `CRON_SCHEDULES`; once `Automation.tsx` started importing `schedulesToCronJobs` from that module, the mock factory needed to provide it too.
- **Fix:** Extended the mock factory to also return `schedulesToCronJobs: () => schedules.map(...)` over the same synthetic 3-item catalog it already used (moved the catalog array inside the factory body, since `vi.mock` factories are hoisted above module-scope `const` declarations -- a `ReferenceError: Cannot access before initialization` on the first attempt).
- **Files modified:** `src/pages/__tests__/Automation.test.tsx`
- **Verification:** `npx vitest run src/components/CronJobList.test.tsx src/pages/__tests__/Automation.test.tsx` -- 2 files, 9 tests, all passed.
- **Committed in:** `8cd23d54`

**Total deviations:** 1 auto-fixed (Rule 3, a test breakage caused directly by this plan's own refactor, not a pre-existing defect). No deviations affected Task 2/3's scope or conclusions.

## Issues Encountered

- The concurrent session working in this shared checkout had a `dev:noauth` server already running on port 5181 when Task 2's page observation began (curled 200 successfully); it stopped on its own (unrelated to this plan) between probes, and a subsequent `npm run dev:noauth` attempt from this plan correctly errored `Port 5181 is already in use` rather than silently colliding. Once the port was confirmed free (`netstat` showed no LISTENING socket), this plan started its own instance. Both that instance and a `vite preview` instance (port 4183) started for the production-build control were stopped via `taskkill` once Task 2's measurements were complete; neither interfered with any file the other session owns.
- No files outside this plan's declared scope were read, edited, or committed. `git show --stat` confirmed after the one commit landed.

## User Setup Required

None. No deploy was performed or required -- this plan modified no `convex/` file.

## Next Phase Readiness

- The `/automation` "Invalid expression" symptom and its dead edit affordance are fully closed.
- The stat-card cold-subscription finding is handed forward via the updated todo, with a concrete next probe (self-hosted backend log/source inspection, or a cross-deployment comparison) rather than a guess. No downstream plan in this phase depends on the stat cards resolving faster.
- `git diff --stat` confirms no `convex/` change from this plan -- nothing to add to plan 126-09's deploy-audit expectations.

---
*Phase: 126-page-body-and-convex-read-defect-sweep*
*Completed: 2026-08-24*

## Self-Check: PASSED

- `src/lib/cronSchedules.ts`, `src/pages/Automation.tsx`, `src/components/CronJobList.tsx`, `src/components/CronJobList.test.tsx`, `src/pages/__tests__/Automation.test.tsx` all present and match the diff described above (`git show --stat 8cd23d54`).
- Commit `8cd23d54` confirmed present: `git log --oneline --all | grep 8cd23d54` -> `8cd23d54 fix(126-03): stop /automation rows misreading as 'Invalid expression' (D-09) and retire the dead edit affordance on catalog rows (D-10)`.
- `.planning/todos/pending/automation-page-placeholder-cards-and-invalid-expression.md` present and rewritten (confirmed via Read after Write).
- `npm test` (365 files / 5100 tests, 0 failed) and `npx tsc --noEmit` (exit 0) both re-verified after all changes, including the todo rewrite.
