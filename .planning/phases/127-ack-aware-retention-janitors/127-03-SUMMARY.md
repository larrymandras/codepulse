---
phase: 127-ack-aware-retention-janitors
plan: 03
subsystem: database
tags: [convex, retention, janitor, cursor-pagination, ideationFindings]

requires:
  - phase: 127-01
    provides: "partitionBatchForPrune optional cursor-field extractor; ideationFindings.by_dismissed widened + by_dismissedAt index"
provides:
  - "internal.ideation.autoCloseAndPrune — bounded, cursor-seeked, batch-capped, self-rescheduling two-step (dismiss/delete) janitor for ideationFindings"
  - "shouldAutoDismiss / shouldDeleteDismissed named predicates for T-127-09's mutation-testing control"
affects: [127-04 (crons wiring), 127-05 (behavioral tests), 127-07 (manual mutation-testing control), 127-08 (schema push + deploy)]

tech-stack:
  added: []
  patterns:
    - "Two-step self-rescheduling janitor chain sharing partitionBatchForPrune's cursor-field extractor, mirrored from the sibling inbox janitor's shape without sharing code (D-01)"
    - "Unconditional per-invocation log line as the sole evidence of a dormant-but-correct janitor during a long inert window (R-01)"

key-files:
  created: []
  modified:
    - convex/ideation.ts

key-decisions:
  - "shouldAutoDismiss and shouldDeleteDismissed are two distinct named predicates (never one shared boolean) so a future edit that folds them together is visible in the diff (T-127-09)"
  - "autoCloseAndPruneHandler's returned `step` field is the NEXT step to run (forward-looking, matching nextCursor's semantics), not the step just processed"
  - "No closedAt field introduced for ideationFindings — dismissed/dismissedAt asymmetry with inbox's closedAt is deliberate (D-01, R-02)"

patterns-established:
  - "Cutoff rendered via fmtCutoffSec (ISO string) in every janitor log line so a seconds/milliseconds unit bug is immediately visible as a wrong year, not silently vacuous"

requirements-completed: [JANITOR-02]

duration: ~20min
completed: 2026-08-25
---

# Phase 127 Plan 03: Ideation Findings Ack-Aware Janitor Summary

**`internal.ideation.autoCloseAndPrune` — a bounded, cursor-seeked, self-rescheduling two-step chain that auto-dismisses `ideationFindings` open past 180 days (excluding critical/high severity) and permanently deletes findings dismissed for over 90 days, logging unconditionally on every invocation.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-25T20:08:38Z
- **Tasks:** 2
- **Files modified:** 1 (`convex/ideation.ts`)

## Accomplishments
- Constants (`IDEATION_AUTODISMISS_AGE_SEC` = 180d, `IDEATION_DISMISSED_GRACE_SEC` = 90d, batch size 200, chain cap 100) with the read-ceiling arithmetic re-derived against the transcribed live error text at `convex/graphSnapshots.ts:505` ("Too many reads in a single function execution (limit: 4096)"), not the 16,000/32,000-document figures on Convex's published limits page.
- Two distinct named predicates — `shouldAutoDismiss` (D-04's critical/high carve-out) and `shouldDeleteDismissed` (unconditionally true, no delete-step carve-out) — so a future edit collapsing them into one shared boolean would be visible in the diff, satisfying T-127-09's disposition.
- `runIdeationAutoDismissStep`: cursor-seeked `by_dismissed` range read (`eq("dismissed", false).gte("createdAt", cursor).lt("createdAt", cutoff)`), patches `{ dismissed: true, dismissedAt: nowSec }` together on matching rows, advances the cursor from `lastCursorValue` over every iterated row including carved-out ones (D-08).
- `runIdeationDeletePruneStep`: cursor-seeked `by_dismissedAt` range read (`gte("dismissedAt", cursor).lt("dismissedAt", cutoff)`), permanently deletes matching rows, same D-08 cursor discipline.
- `autoCloseAndPruneHandler`: one carried batch budget across both steps (`batchesDone` only ever increments; only the cursor resets on the dismissing→deleting transition), entry guard before any read, and R-01's mandatory unconditional log line.
- `internal.ideation.autoCloseAndPrune` — the `internalMutation` wrapper. No public caller anywhere (T-127-13).

## Task Commits

1. **Task 1: Constants, predicates, and the auto-dismiss step** - `028351aa` (feat)
2. **Task 2: The delete step, the chain, the wrapper, and R-01's mandatory inert-run log** - `23c08008` (feat)

_No separate plan-metadata commit — orchestrator owns STATE.md/ROADMAP.md writes for this wave; this SUMMARY.md is committed by the executor per the worktree protocol._

## Files Created/Modified
- `convex/ideation.ts` — added the janitor section (constants, two predicates, two step functions, the chain handler, the `internalMutation` wrapper). All five pre-existing exports (`recordFinding`, `dismissFinding`, `listFindings`, `findingStats`, `updateFindingStatus`, `linkTask`) are byte-unchanged — confirmed via `git diff convex/ideation.ts` showing zero hits for `linkTask`/`convertedAt`/`recordFinding`/`dismissFinding`/`listFindings`/`findingStats` (nothing in those regions was touched, so no diff hunk exists for them).

## Verified Query Forms (recorded per plan's `<output>` spec)

**Auto-dismiss step's chained-builder form** (three-bound range on the widened `by_dismissed` index, verified against `convex/retention.ts:341-347`'s `.gte(...).lt(...)` shape and corrected against the live tree, not `127-RESEARCH.md`'s illustrative draft):
```ts
ctx.db
  .query("ideationFindings")
  .withIndex("by_dismissed", (q) =>
    q.eq("dismissed", false).gte("createdAt", cursor).lt("createdAt", cutoff)
  )
  .order("asc")
  .take(IDEATION_JANITOR_BATCH_SIZE)
```

**Delete step's range form** (single-field `by_dismissedAt` index; undismissed rows structurally excluded because Convex sorts an absent field under `undefined`, below any real cursor value — cited at `convex/controlVerbSwaps.ts:109`):
```ts
ctx.db
  .query("ideationFindings")
  .withIndex("by_dismissedAt", (q) => q.gte("dismissedAt", cursor).lt("dismissedAt", cutoff))
  .order("asc")
  .take(IDEATION_JANITOR_BATCH_SIZE)
```

**R-01's exact unconditional log line text** (template, interpolated at runtime):
```
ideation: auto-close/prune ran step "${step}", acted on ${stepResult.actedCount} row(s), cutoff ${fmtCutoffSec(cutoffSec)}${rescheduled ? `, rescheduled to step "${nextStep}"` : ""}
```
`fmtCutoffSec` renders the epoch-seconds cutoff as `new Date(cutoffSec * 1000).toISOString()` — an accidental seconds/milliseconds swap would show up immediately as a 1970-something date rather than passing silently. This line is unconditional: it sits after the entry-guard's early return but before nothing else gates it, so it fires on every invocation that performs a step, including a zero-`actedCount` one. (A separate, distinct log line exists in the entry-guard branch for the `batchesDone >= IDEATION_JANITOR_MAX_BATCHES` case, mirroring `media.ts`'s `pruneTrashBatchHandler` cap-reached message.)

**No behavioral test has run yet.** This plan's verification is limited to `npx tsc --noEmit`, the pre-existing `retentionCursor.test.ts`/`retention.test.ts` suites (unaffected, still 49/49 green), and static greps against acceptance criteria. Whether `shouldAutoDismiss` genuinely excludes critical/high rows, whether the cursor genuinely advances past an all-carved-out batch, and whether the dismissing→deleting transition genuinely carries `batchesDone` forward are all claims this plan makes but does NOT verify behaviorally — that is plan 127-05's (automated) and plan 127-07's (manual mutation-testing control) job, per the plan's own `<verification>` section: "Do not claim the carve-out works until 127-05 and 127-07 have run."

## Decisions Made
- **`autoCloseAndPruneHandler`'s returned `step` field is forward-looking** (the step the *next* scheduled invocation will run), matching `nextCursor`'s already-forward-looking semantics, rather than reporting the step just processed. The plan's acceptance criteria specified the return shape (`{ step, actedCount, nextCursor, rescheduled }`) but not this field's exact meaning; chose the interpretation that lets a future test assert the dismissing→deleting transition directly off the return value without needing to inspect the mocked scheduler's call args.
- No `closedAt` field was added to `ideationFindings` — confirmed by `grep -n "closedAt" convex/ideation.ts` returning zero hits (control: `grep -c "dismissedAt"` returns 6, so the zero is a real zero, not a broken grep). This preserves R-02/D-01's deliberate asymmetry between the two sibling janitors.

## Deviations from Plan

**None — plan executed as written.** One clarification worth recording: the plan's `<read_first>` for both tasks pointed at "`convex/inbox.ts` after plan 127-02" as the sibling janitor to structurally mirror. Plan 127-02 is being executed concurrently in a separate worktree (per this plan's `<parallel_execution>` instructions, which explicitly forbid touching `convex/inbox.ts`), so that file was NOT available in this worktree's merge-base and could not be read. The chain shape (entry guard → step read → partition → act → cursor advance → transition decision → reschedule → unconditional log → wrapper) was instead derived directly from `convex/media.ts`'s `pruneTrashBatchHandler`/`pruneTrashBatch` (single-step analog) and `convex/retention.ts`'s `pruneBatchV3`/`retentionCursor.ts`'s `planNextPruneStep` (the two-step-equivalent table-rotation chain doubling as the reschedule-decision template), both of which the plan also named as read-first sources. This is not a deviation from the plan's *requirements* (every `must_haves.truths` and acceptance criterion is met and independently verified below) — it is a note that one of the plan's cited *reference* sources was unreadable in this execution context, and a substitute source already named in the same plan was used instead.

## Issues Encountered

None — all `npx tsc --noEmit` runs were clean on the first pass, and `npx vitest run convex/retentionCursor.test.ts convex/retention.test.ts` passed 49/49 without modification.

## User Setup Required

None — no external service configuration required. Note per `127-01-SUMMARY.md`: the schema indexes this plan reads (`by_dismissed` widened, `by_dismissedAt` new) are NOT yet pushed to the self-hosted backend; that push is plan 127-08's blocking human-gated task. This plan's `npx tsc --noEmit` passing is not evidence those indexes exist live.

## Next Phase Readiness

- `internal.ideation.autoCloseAndPrune` exists, typechecks, and is ready to be wired into `convex/crons.ts` by a later plan (not this one — `crons.ts` is explicitly out of scope here and owned by a different parallel worktree).
- Behavioral verification (does the carve-out actually hold, does the cursor actually advance past an all-carved-out batch, does the transition actually carry `batchesDone`) is unstarted and is plan 127-05's job.
- No blockers for 127-05/127-07/127-08 from this plan's side.

---
*Phase: 127-ack-aware-retention-janitors*
*Completed: 2026-08-25*
