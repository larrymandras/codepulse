---
phase: 127-ack-aware-retention-janitors
plan: 02
subsystem: convex-inbox
tags: [retention, janitor, inbox, cursor, ack-aware]
dependency-graph:
  requires:
    - "127-01: partitionBatchForPrune cursor-field extractor, inbox.closedAt + by_closedAt index"
  provides:
    - "internal.inbox.autoCloseAndPrune — two-step self-rescheduling ack-aware janitor"
  affects:
    - "127-04 (behavioral/regression tests for this janitor)"
    - "127-07 (manual mutation-testing control on the two carve-out predicates)"
    - "127-08 (blocking human deploy — wires this into convex/crons.ts and pushes schema)"
tech-stack:
  added: []
  patterns:
    - "Two distinct named carve-out predicates (never one reused boolean) read via partitionBatchForPrune's cursor-field extractor"
    - "Single by_closedAt index serves both an .eq(undefined) scan (closing step) and a range scan (deleting step)"
    - "batchesDone carried across a step transition inside one self-rescheduling chain, mirroring media.ts's pruneTrashBatch template"
key-files:
  created: []
  modified:
    - convex/inbox.ts
decisions:
  - "shouldAutoClose(row) = itemType !== 'held' AND (ackedAt != null OR priority !== 'money') — money blocks only silent closure, per D-03's own wording"
  - "shouldDeleteClosed(row) = itemType !== 'held', kept as an explicit second guard rather than relying solely on the invariant that held rows never acquire closedAt"
  - "Patch object in the closing step names ONLY closedAt — ackedAt is read (shouldAutoClose) and never written anywhere in this file's new code (R-02, T-127-04)"
  - "Logs unconditionally on every invocation (including zero-work runs), deliberately diverging from media.ts's pruneTrashBatchHandler which logs only when deletedCount > 0 — required by R-01/Verification F reading docker logs"
metrics:
  duration: "~35 min"
  completed: 2026-08-25
---

# Phase 127 Plan 02: Inbox Ack-Aware Auto-Close/Prune Janitor Summary

One-liner: Built `internal.inbox.autoCloseAndPrune` — a bounded, cursor-seeked, two-step
self-rescheduling chain that stamps `closedAt` on stale-open or already-acked `inbox` rows
(never touching `ackedAt`) and permanently deletes rows 14 days past that stamp, with `held`
excluded unconditionally and `money` blocked only from silent closure.

## What Was Built

**Task 1** (`convex/inbox.ts`, commit `a55b1d48`) — constants, the two carve-out predicates, and
the closing step:
- `JanitorCtx` type (`{ db: any; scheduler: { runAfter } }`) — `db` typed `any` deliberately,
  matching `media.ts`'s own `MediaCtx` (`media.ts:58`), because the two-field `by_closedAt`
  chained-builder queries below need forms the existing narrow `InboxDb` interface does not
  describe.
- `INBOX_AUTOCLOSE_AGE_SEC = 30d`, `INBOX_CLOSED_GRACE_SEC = 14d`, `INBOX_JANITOR_BATCH_SIZE =
  200`, `INBOX_JANITOR_MAX_BATCHES = 100`, `INBOX_JANITOR_RESCHEDULE_MS = 3000` — the batch-size
  comment re-derives the read-cost arithmetic (200 read + up to 200 patch/delete-as-read = ~400
  reads/invocation) against the real **4,096-read** ceiling this self-hosted deployment enforces,
  never the 16,000/32,000 figures on Convex's published limits page.
- `shouldAutoClose(row)`: `itemType !== "held" && (ackedAt != null || priority !== "money")`.
- `shouldDeleteClosed(row)`: `itemType !== "held"`.
- `runClosingStep(ctx, cursor, nowSec)`: reads `by_closedAt` via
  `q.eq("closedAt", undefined).gte("createdAt", cursor).lt("createdAt", nowSec -
  INBOX_AUTOCLOSE_AGE_SEC)`, ordered ascending, `.take(INBOX_JANITOR_BATCH_SIZE)`; splits with
  `partitionBatchForPrune<any>(batch, shouldAutoClose, (doc) => doc.createdAt)`; patches
  `{ closedAt: nowSec }` — nothing else — on every row `partitionBatchForPrune` returns; advances
  the cursor from `lastCursorValue`, not from the patched set.

**Task 2** (`convex/inbox.ts`, commit `4377d485`) — the delete step, the chain transition, and the
`internalMutation` wrapper:
- `runDeletingStep(ctx, cursor, nowSec)`: reads the SAME `by_closedAt` index via
  `q.gte("closedAt", cursor).lt("closedAt", nowSec - INBOX_CLOSED_GRACE_SEC)`, ordered ascending,
  `.take(INBOX_JANITOR_BATCH_SIZE)`; splits with `partitionBatchForPrune<any>(batch,
  shouldDeleteClosed, (doc) => doc.closedAt ?? 0)`; permanently `ctx.db.delete()`s every returned
  row.
- `autoCloseAndPruneHandler(ctx, args, nowSec)`: entry guard refuses all work once `batchesDone >=
  INBOX_JANITOR_MAX_BATCHES`; otherwise runs the step named by `args.step` (default `"closing"`)
  and applies the four-way transition table from the plan (closing/full → continue closing;
  closing/short → move to deleting with `cursor: 0`; deleting/full → continue deleting;
  deleting/short → done). `batchesDone` is carried unchanged across the closing→deleting move and
  only ever incremented, never reset. Every reschedule is additionally gated on `batchesUsedAfter <
  INBOX_JANITOR_MAX_BATCHES`. Logs one line on every invocation, zero-work included.
- `autoCloseAndPrune` — the `internalMutation` wrapper: `v.optional(v.union(v.literal("closing"),
  v.literal("deleting")))` / `v.optional(v.float64())` / `v.optional(v.float64())` args, calling
  `autoCloseAndPruneHandler(ctx as JanitorCtx, args, Date.now() / 1000)`.

## Chained-builder form verified

The plan asked for the exact chained-builder form of the two-field `by_closedAt` query to be
verified against another two-field range query already live in this repo rather than transcribed
from RESEARCH.md. Verified against `convex/aggregates.ts:457` — `q.eq("period",
"hourly").gte("bucket_start", dayStart).lt("bucket_start", dayStart + 86400)` — which chains one
`.eq()` prefix constraint followed by `.gte()/.lt()` on the trailing index field, the exact shape
both `runClosingStep` (`q.eq("closedAt", undefined).gte("createdAt", cursor).lt("createdAt",
cutoff)`) and `runDeletingStep` (`q.gte("closedAt", cursor).lt("closedAt", cutoff)`) use. A broader
grep across `convex/*.ts` (`agentConfigVersions.ts`, `alertMutes.ts`, `alertRuleCustom.ts`, etc.)
confirmed this `.eq(...).eq/gte/lt(...)` chaining is the repo's standing idiom, not a one-off.

## Predicates as shipped

```ts
export function shouldAutoClose(row: {
  itemType: string;
  priority: string;
  ackedAt?: number;
}): boolean {
  if (row.itemType === "held") return false;
  return row.ackedAt != null || row.priority !== "money";
}

export function shouldDeleteClosed(row: { itemType: string }): boolean {
  return row.itemType !== "held";
}
```

## No behavioral test has run

This plan's own `<verification>` section says so explicitly, and it is repeated here in plain
terms: the code exists, typechecks, and every source-level grep from the plan's acceptance
criteria passes — but no test exercises the janitor's actual behavior against real or mocked
`inbox` rows (no unit test drives `autoCloseAndPruneHandler` with a fake `JanitorCtx`, and the
schema is not yet pushed to the live self-hosted backend, so `by_closedAt` does not exist there
yet either — that push is plan 127-08's blocking human task). Behavioral verification, including
the carve-out predicates' correctness on concrete rows and the D-08 all-skipped-batch cursor
guarantee, is plan 127-04's job; plan 127-07 adds a manual mutation-testing control on the two
predicates specifically because they carry no database-level backstop (T-127-05).

## Verification

- `npx tsc --noEmit` — clean, both after Task 1 and after Task 2.
- `npx vitest run convex/inbox.test.ts` — 8/8 passed (Task 1).
- `npx vitest run convex/inbox.test.ts convex/retentionCursor.test.ts` — 41/41 passed (Task 2).
- `npx vitest run convex/inbox.test.ts convex/retentionCursor.test.ts convex/retention.test.ts` —
  57/57 passed (plan-level).
- `grep -n "ackedAt" convex/inbox.ts` — every hit is inside pre-existing
  `raiseHandler`/`ackHandler`/`dismissHandler`/`dismissAllCardsHandler`/`listHeldUnacked`/
  `countHeldUnacked` code, or `shouldAutoClose`'s read-only `row.ackedAt != null` test. No
  `ctx.db.patch` argument in the new janitor code names `ackedAt`.
- `grep -n "\.collect()" convex/inbox.ts` — the same 3 pre-existing call sites this file already
  had before this plan (`listByProfileHandler`, `listHeldUnackedHandler`,
  `dismissAllCardsHandler`) plus one comment mention; zero new ones added. (The plan's acceptance
  text names only 2 of these 3 as "the D-11 call sites" — `listByProfileHandler`'s pre-existing
  `.collect()` predates D-11 and was already present at the start of this plan; the load-bearing
  assertion, "no new ones," holds regardless.)
- `git diff` across both commits shows zero changes to `listHeldUnackedHandler`,
  `countHeldUnackedHandler`, or `dismissAllCardsHandler` (D-11).
- `grep -n "_SEC" convex/inbox.ts` shows only `INBOX_AUTOCLOSE_AGE_SEC`/`INBOX_CLOSED_GRACE_SEC`
  (plus their two usage sites); `grep -n "_MS"` shows only `INBOX_JANITOR_RESCHEDULE_MS`.
- `grep -n "export const autoCloseAndPrune = internalMutation" convex/inbox.ts` — exactly one line.
- `grep -n "export async function autoCloseAndPruneHandler" convex/inbox.ts` — exactly one line.
- `grep -n "batchesDone: 0" convex/inbox.ts` — one hit, inside the handler's own doc comment
  describing the args default; zero hits inside the transition logic (which passes
  `batchesUsedAfter`, i.e. `batchesDone + 1`).
- `grep -n "scheduler.runAfter" convex/inbox.ts` — the one call site uses
  `INBOX_JANITOR_RESCHEDULE_MS` as its delay argument.
- `grep -n "patch(" convex/inbox.ts` — the one new patch call names only `closedAt`; the 3
  pre-existing patch calls (all naming `ackedAt`) are unchanged.
- `git diff --diff-filter=D --name-only HEAD~2 HEAD` — empty; no accidental deletions.
- `git diff --stat HEAD~2 HEAD -- convex/schema.ts convex/ideation.ts convex/crons.ts` — empty;
  none of the files owned by the concurrent plan or held out of scope were touched.

## Deviations from Plan

**1. [Rule 3 - blocking issue] Explicit `any[]`/`<any>` typing on the batch reads and
`partitionBatchForPrune` calls.** `ctx.db` is typed `any` (`JanitorCtx.db: any`), but passing the
`await ctx.db.query(...).take(...)` result directly into the generic
`partitionBatchForPrune<T extends { _id: unknown; _creationTime: number }>` caused `tsc` to infer
`T` from the predicate function's parameter type instead of treating the argument as `any`,
producing a type-mismatch error (`shouldAutoClose`'s `{itemType, priority, ackedAt}` parameter vs.
the constraint's `{_id, _creationTime}` default). Fixed by declaring `const batch: any[] = ...`
and calling `partitionBatchForPrune<any>(...)` explicitly at both call sites
(`convex/inbox.ts` — `runClosingStep`, `runDeletingStep`). No behavior change; purely a type
annotation fix required to reach a clean `npx tsc --noEmit`.

No other deviations. Both predicates, the batch/cap/delay constants, and the chain transition
table match `127-02-PLAN.md` and `127-CONTEXT.md`'s R-02 exactly.

## Commits

- `a55b1d48` — feat(127-02): inbox janitor constants, carve-out predicates, and the auto-close step
- `4377d485` — feat(127-02): inbox janitor delete step, chain transition, internalMutation wrapper

## Self-Check

- `convex/inbox.ts` — FOUND, modified in both `a55b1d48` and `4377d485`.
- Commit `a55b1d48` — FOUND in `git log --oneline`.
- Commit `4377d485` — FOUND in `git log --oneline`.
- `internal.inbox.autoCloseAndPrune` resolves in the self-reschedule call site — confirmed by a
  clean `npx tsc --noEmit` (this is the check that the `internal` import from `./_generated/api`
  is correct).

## Self-Check: PASSED
