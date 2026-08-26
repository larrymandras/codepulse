---
phase: 127-ack-aware-retention-janitors
plan: 05
subsystem: testing
tags: [convex, vitest, janitor, retention, ideationFindings, mutation-testing]

requires:
  - phase: 127-03
    provides: "internal.ideation.autoCloseAndPrune -- the bounded, cursor-seeked, self-rescheduling two-step janitor for ideationFindings, plus shouldAutoDismiss/shouldDeleteDismissed named predicates"
provides:
  - "convex/ideation.test.ts -- the first tests convex/ideation.ts has ever had: Verifications A, B, C, D and R-01's mandatory zero-row log assertion, each with a discriminating control"
  - "Two live mutation proofs (performed and reverted, not committed) proving the R-01 log assertion and the unit-scale control can each fail"
affects: [127-07 (manual mutation-testing control, second half of T-127-18), 127-08 (schema push + deploy; Verification F greps for R-01's exact log marker)]

tech-stack:
  added: []
  patterns:
    - "makeIdeationJanitorMockCtx: a hand-rolled ctx.db fake that threads the REAL .eq/.gte/.lt bounds through a real filter and reimplements the absent-field index exclusion as explicit lines, per media.test.ts:513's convention -- not a shared fixture (this repo has no convex-test harness and no shared conftest-equivalent)"
    - "Two-invocation chain simulation: dismiss at nowSec, then re-invoke the delete step at nowSec + grace-period to exercise the full dismiss-then-delete lifecycle within one test, since a janitor-dismissed row's dismissedAt is never old enough to delete in the same tick it was set"

key-files:
  created:
    - convex/ideation.test.ts
  modified: []

key-decisions:
  - "Split the file into two commits matching the plan's two tasks (Task 1: fixture + Verification A + R-01 + unit-scale control; Task 2: Verifications B, C, D), even though it was authored and verified as one coherent file, to preserve per-task atomic-commit traceability"
  - "Both mutation proofs were performed live against convex/ideation.ts and reverted before committing -- convex/ideation.ts is byte-identical to its pre-plan state (confirmed via git diff --stat returning nothing), so the proofs are evidence, not a code change"
  - "Verification B's dismiss-then-delete test advances simulated time by DISMISSED_GRACE_SEC_TEST + 1 day between the two chain invocations, rather than pre-seeding an already-dismissed-long-ago row, so the SAME test exercises both the dismiss write and the delete read against the row it itself wrote"

patterns-established:
  - "Independent restatement of age/grace thresholds in the test file (DAY_SEC-based AUTO_DISMISS_AGE_SEC_TEST, DISMISSED_GRACE_SEC_TEST) rather than importing the real constants, mirroring media.test.ts's THIRTY_DAYS_MS discipline, so these tests are a real check on the threshold values"

requirements-completed: [JANITOR-02]

duration: ~35min
completed: 2026-08-25
---

# Phase 127 Plan 05: Ideation Findings Janitor Tests Summary

**`convex/ideation.test.ts` (new, 14 tests) -- the first behavioral evidence that `convex/ideation.ts`'s ack-aware janitor works: structural exclusion of undismissed rows from the delete-step query, the critical/high carve-out (including the human-dismissed-critical asymmetry a reused predicate would get wrong), cursor advancement on an all-carved-out batch, full/short/ceiling batch semantics, the dismissing-to-deleting transition carrying `batchesDone` forward, and the mandatory zero-row log line that is the only evidence this janitor is alive during its ~83-day dormant window before 2026-11-16.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-25T20:33:04Z
- **Tasks:** 2
- **Files modified:** 1 (`convex/ideation.test.ts`, new)

## Accomplishments
- `makeIdeationJanitorMockCtx(rows)` -- a fixture that ACTUALLY APPLIES the `.eq("dismissed", ...)` / `.gte(...).lt(...)` bounds the handler passes into `withIndex`, filtering the supplied rows the same way the real `by_dismissed` and `by_dismissedAt` indexes would, and reimplements as explicit lines the two index behaviours the handler depends on: a range bound never matches an absent field, and the `by_dismissed` equality composes as a genuine AND with the `createdAt` range. `patch`/`delete` mutate the in-memory fixture in place so a single test can drive the two-step chain across two invocations.
- Verification A (structural): an undismissed row (no `dismissedAt`) is excluded from the delete step's raw query batch even though it would fall inside the range if `dismissedAt` were `0`; the `dismissedAt: 0` control row IS returned. The test file states the known limitation from `127-VALIDATION.md`: this proves the handler asks for the right range, not that Convex's real index excludes `undefined`.
- R-01: a zero-row run still logs a stable, greppable marker (`"ideation"` + `"auto-close/prune"`) and a rendered cutoff whose year is the current year, not 1970.
- Unit-scale control: a finding created this instant is not auto-dismissed; a 181-day-old finding is, with the 180-day threshold restated independently rather than imported.
- Verification B (carve-out): direct predicate assertions for `shouldAutoDismiss`/`shouldDeleteDismissed`; critical/high rows survive the dismissing step while a same-batch medium row is dismissed and, after the grace period elapses, deleted; the delete-step asymmetry case -- a HUMAN-dismissed critical row IS deleted, paired with an undismissed critical row that survives in the same fixture.
- Verification C: a full batch of entirely carved-out critical rows still advances the cursor and does not reschedule with an unchanged cursor.
- Verification D: full batch reschedules the same step with `batchesDone: 1`; short batch does not reschedule; `batchesDone` already at the ceiling does zero work; a full batch reaching the ceiling on this invocation still does its own work but does not reschedule; the dismissing-to-deleting transition carries `batchesDone` forward, asserted literally (`{ step: "deleting", cursor: 0, batchesDone: 1 }`).
- No assertion anywhere touches `status: "converted"`/`convertedAt` (D-10) -- confirmed by `grep -n "converted" convex/ideation.test.ts` returning nothing, with `grep -c "dismissed"` (38 hits) as the non-vacuous control.

## Task Commits

1. **Task 1: Fixture, Verification A, R-01's log assertion, unit-scale control** - `e1f0f8a9` (test)
2. **Task 2: Verifications B, C, D** - `5f618594` (test)
3. **Deferred-items log (pre-existing, unrelated `npm test` failure)** - `5ebbd9db` (docs)

_No separate plan-metadata commit -- orchestrator owns STATE.md/ROADMAP.md writes for this wave; this SUMMARY.md is committed by the executor per the worktree protocol._

## Verification Results

- `npx vitest run convex/ideation.test.ts` -- **14/14 passed**, both standalone (after Task 1 alone: 5/5) and combined (after Task 2: 14/14).
- `npx vitest run convex/ideation.test.ts -t "structural"` -- **2 passed** (>= 2 required).
- `npx vitest run convex/ideation.test.ts -t "carve-out"` -- **3 passed** (>= 3 required).
- `npx vitest run convex/ideation.test.ts -t "cursor advances on skip"` -- **1 passed**.
- `npx vitest run convex/ideation.test.ts -t "batch"` -- **9 passed** (>= 5 required; higher because "batch" also matches Verification C's title and a docstring phrase in Verification B).
- `npx tsc --noEmit` -- clean, no errors, run twice (after Task 1 and after Task 2).
- `npm test` (full suite) -- **5139 tests passed**, 364/365 test files passed. One pre-existing, unrelated failure: `src/components/voice/AvatarAura.browser.test.tsx` (last touched by commit `828a5b08`, an unrelated Phase 193 change) -- logged to `deferred-items.md`, not fixed here (out of this plan's scope boundary).

### Mutation Proofs (both performed live against `convex/ideation.ts`, both reverted before committing)

**Proof 1 -- R-01's log assertion.** Wrapped the mandatory `console.log(...)` call inside `if (stepResult.actedCount > 0) { ... }`. Re-ran `npx vitest run convex/ideation.test.ts -t "R-01"`: **FAILED** as expected --
`AssertionError: expected "log" to be called at least once`. Restored the original unconditional `console.log`. `git diff --stat convex/ideation.ts` after restoring returns **nothing** (byte-identical).

**Proof 2 -- the unit-scale control.** Changed `const cutoff = nowSec - IDEATION_AUTODISMISS_AGE_SEC;` to `const cutoff = (nowSec - IDEATION_AUTODISMISS_AGE_SEC) * 1000;` in `runIdeationAutoDismissStep`. Re-ran `npx vitest run convex/ideation.test.ts -t "unit-scale"`: **FAILED** as expected -- the "brand-new" row (created `nowSec`, i.e. this instant) was wrongly auto-dismissed (`patch` called with `{ dismissed: true, dismissedAt: 1800000000 }`), because the mutated cutoff arithmetic put every row's `createdAt` below the (now enormous) cutoff. Restored the original arithmetic. `git diff --stat convex/ideation.ts` after restoring returns **nothing**.

### Exact greppable marker (for plan 127-08's Verification F)

Per `127-03-SUMMARY.md`'s recorded template, the janitor's unconditional log line is:
```
ideation: auto-close/prune ran step "${step}", acted on ${stepResult.actedCount} row(s), cutoff ${fmtCutoffSec(cutoffSec)}${rescheduled ? `, rescheduled to step "${nextStep}"` : ""}
```
The R-01 test asserts on the substrings `"ideation"` and `"auto-close/prune"` both being present in the same log line, plus a rendered `YYYY-MM-DDTHH:MM:SS` cutoff whose year is within one of the current year. Plan 127-08's `docker logs convex-backend | grep -i "ideation"` will match this line.

## Files Created/Modified
- `convex/ideation.test.ts` -- new file, 14 tests across 11 `describe` blocks. `convex/ideation.ts` itself was NOT modified (both mutation-proof edits were reverted; the export-keyword deviation noted in the wave context was not needed, since no test in this file references `IDEATION_JANITOR_RESCHEDULE_MS`).

## Decisions Made
- Split the single coherent test file into two commits along the plan's task boundary (fixture/A/R-01/unit-scale vs. B/C/D) to preserve per-task atomic-commit traceability, even though both were authored and validated together.
- Simulated the grace period elapsing between two chain invocations within Verification B's dismiss-then-delete test (`nowSec` then `nowSec + DISMISSED_GRACE_SEC_TEST + DAY_SEC`), rather than pre-seeding an already-dismissed-long-ago row, so the test exercises the janitor's own write feeding its own subsequent read.
- Did not add the `export` keyword to `IDEATION_JANITOR_RESCHEDULE_MS` in `convex/ideation.ts` (noted as optional in the wave context) -- no test needed it, so `convex/ideation.ts` stays untouched, matching this plan's `files_modified: [convex/ideation.test.ts]` exactly.

## Deviations from Plan

**None affecting scope or correctness.** One process note: `convex/inbox.test.ts` in this worktree's base (`ae4fff46`, wave 2's merge point) is still the pre-127-04 `SWEEP-01` version -- plan 127-04 (the sibling suite this plan's `<interfaces>` section pointed at "after plan 127-04") is executing concurrently in a separate worktree and was not merged into this worktree's base. Per the plan's own interfaces guidance ("Do NOT import its fixture; write a local one, per this repo's convention"), this did not block the work: `makeIdeationJanitorMockCtx` was written fresh, following `media.test.ts:513-560`'s pattern directly, matching what 127-03-SUMMARY.md records having done for the same reason.

## Issues Encountered

One pre-existing, unrelated `npm test` failure: `src/components/voice/AvatarAura.browser.test.tsx` fails to import (`TypeError: Cannot read properties of undefined (reading 'config')` / a dynamic-import fetch failure on the second run). Confirmed via `git log --oneline -1 -- src/components/voice/AvatarAura.browser.test.tsx` that the file was last touched by `828a5b08` (`test(193): make the D-18.1 modulation guard actually discriminate`) -- an unrelated phase, not this worktree's base, not this plan's `files_modified`. Logged to `.planning/phases/127-ack-aware-retention-janitors/deferred-items.md` per the scope-boundary rule; not fixed.

## User Setup Required

None -- no external service configuration required. Note per `127-03-SUMMARY.md`: the schema indexes these tests exercise in mock form (`by_dismissed` widened, `by_dismissedAt` new) are NOT yet pushed to the self-hosted backend; that push remains plan 127-08's blocking human-gated task. These tests being green is evidence about the handler's logic, not about the live deployed index.

## Next Phase Readiness

- `convex/ideation.test.ts` exists, is green, type-checks cleanly, and both mandatory mutation proofs were performed and reverted.
- Plan 127-07's manual mutation-testing control (the second half of T-127-18, per `127-VALIDATION.md`'s "Manual-Only Verifications" table) can now run against a codebase that already has an automated carve-out suite to compare its manual findings against.
- Plan 127-08's Verification F can grep `docker logs convex-backend` for the exact marker recorded above.
- No blockers for 127-07/127-08 from this plan's side.

---
*Phase: 127-ack-aware-retention-janitors*
*Completed: 2026-08-25*

## Self-Check

- `convex/ideation.test.ts` -- FOUND, created in `e1f0f8a9`, extended in `5f618594`.
- `.planning/phases/127-ack-aware-retention-janitors/deferred-items.md` -- FOUND, added in `5ebbd9db`.
- Commit `e1f0f8a9` -- FOUND in `git log --oneline`.
- Commit `5f618594` -- FOUND in `git log --oneline`.
- Commit `5ebbd9db` -- FOUND in `git log --oneline`.
- `convex/ideation.ts` -- confirmed byte-identical to pre-plan state (`git diff --stat convex/ideation.ts` returns nothing after both mutation proofs were reverted).

## Self-Check: PASSED
