/**
 * retentionCursor.ts — the chain-advancement decision for the nightly retention prune.
 *
 * Extracted 2026-07-30 while fixing a prune that had been failing silently for at least two
 * consecutive nights (`SystemTimeout` on `retention.js:pruneBatchV3`, 2026-07-29T12:34 and
 * 2026-07-30T09:26).
 *
 * ## Why the old prune defeated itself
 *
 * `pruneBatchV3` fetched each batch with `ctx.db.query(table).order("asc").take(200)` — a scan from
 * the HEAD of the creation-time index, every batch. Deleted docs leave MVCC tombstones that stay in
 * the index until `DOCUMENT_RETENTION_DELAY` collects them (env on convex-backend, currently
 * **1800s = 30 min**). So batch *k* had to walk past the ~200×(k−1) tombstones its own predecessors
 * had just created before reaching a live doc.
 *
 * The pacing guaranteed it could never escape: `RESCHEDULE_DELAY_MS = 3000` × up to 600 batches is a
 * ~30-minute run, and the cron fires at 09:00 UTC — the 2026-07-30 timeout landed at 09:26:25, about
 * 528 batches in. A ~26-minute run sits *entirely inside* the 30-minute tombstone window, so not one
 * tombstone the run created was ever GC'd while the run was still going. The scan degraded
 * monotonically until an isolate exceeded its time limit.
 *
 * And the failure is worse than one lost table: a SystemTimeout aborts the mutation, so it never
 * enqueues its own continuation — the whole chain dies. `startNightlyPrune` always restarts at
 * index 0, and index 0 is the `runtime_events` firehose, so the remaining 13 tables were never
 * pruned at all, every night.
 *
 * ## The fix
 *
 * Carry a cursor forward. Each batch seeks straight to `_creationTime >= cursor` via the built-in
 * `by_creation_time` index, so the tombstones it just made all sit BELOW the seek point and are
 * never walked again. Batch cost stops depending on how many batches came before it.
 *
 * This module owns the cursor/advancement arithmetic so it is directly testable — the surrounding
 * mutation is not, since this repo has no `convex-test` harness (see `runtimeIngest.test.ts`). It is
 * deliberately dependency-free: no `convex/values`, no `./_generated/*`.
 */

/** What the chain should do after a batch. */
export type PruneAction =
  | "continue-table" // same table, more docs remain past the cursor
  | "next-table" // this table is drained, move on
  | "done" // last table drained
  | "cap-reached"; // nightly ceiling hit, remainder deferred to tomorrow

export interface PruneStep {
  action: PruneAction;
  /** Table to process next (unchanged for continue-table). */
  tableIndex: number;
  /**
   * Lower bound for the next batch's index seek, INCLUSIVE.
   *
   * Inclusive (`>=`) rather than exclusive on purpose: `_creationTime` is not guaranteed unique, and
   * an exclusive bound would silently skip a doc sharing the last one's timestamp. Re-seeking to an
   * already-deleted doc costs one tombstone, whereas skipping a live doc would leave it unprunable
   * forever.
   */
  cursorMs: number;
}

export interface PlanPruneStepArgs {
  /** How many docs the just-completed batch actually returned. */
  batchLength: number;
  /** Greatest `_creationTime` seen in that batch, or null when the batch was empty. */
  lastCreationTime: number | null;
  /** The cursor the just-completed batch used. */
  cursorMs: number;
  tableIndex: number;
  tableCount: number;
  /** Batches consumed BEFORE this one. */
  batchesUsed: number;
  maxBatches: number;
  batchSize: number;
}

/**
 * Decides where the prune chain goes next.
 *
 * A full batch means more eligible docs may remain in this table, so continue it with the cursor
 * advanced past what we just deleted. A short batch means the table is drained (the query is already
 * range-bounded by the cutoff, so every returned doc was eligible), so move to the next table with
 * the cursor reset.
 */
export function planNextPruneStep(args: PlanPruneStepArgs): PruneStep {
  const {
    batchLength,
    lastCreationTime,
    cursorMs,
    tableIndex,
    tableCount,
    batchesUsed,
    maxBatches,
    batchSize,
  } = args;

  // The nightly ceiling is checked against batches ALREADY consumed plus this one.
  if (batchesUsed + 1 >= maxBatches) {
    return { action: "cap-reached", tableIndex, cursorMs };
  }

  if (batchLength >= batchSize) {
    // THE FIX: advance past the batch we just deleted so the next seek starts beyond our own
    // tombstones. Never fall back to 0 — that is precisely the head re-scan this replaces.
    //
    // `Math.max` makes the no-rewind property structural rather than merely expected. The index
    // range already guarantees `lastCreationTime >= cursorMs`, so this clamp should be unreachable
    // — but a cursor that can rewind is exactly the bug being fixed, and a defect that reintroduces
    // it should fail loudly in tests rather than quietly resurrect the tombstone re-scan.
    return {
      action: "continue-table",
      tableIndex,
      cursorMs: Math.max(lastCreationTime ?? cursorMs, cursorMs),
    };
  }

  if (tableIndex + 1 < tableCount) {
    return { action: "next-table", tableIndex: tableIndex + 1, cursorMs: 0 };
  }

  return { action: "done", tableIndex, cursorMs: 0 };
}

/**
 * partitionBatchForPrune — the Phase 110 D-02 predicate-aware split of a batch into docs to
 * delete vs. docs to skip, expressed as data rather than a loop side effect.
 *
 * ## Why `lastCreationTime` is sourced from every doc, not just the deleted ones
 *
 * Once a per-table predicate (Phase 110 D-02, e.g. the `aggregates` period filter) can skip a doc
 * without deleting it, a full batch where every doc is skipped would — if `lastCreationTime` were
 * computed only from `toDelete` — report `lastCreationTime: null`. Feed that into
 * `planNextPruneStep` above and its `Math.max(lastCreationTime ?? cursorMs, cursorMs)` clamp at
 * line 111 resolves to the UNCHANGED cursor: the batch reports itself as `continue-table` with the
 * same `cursorMs` it started with, so the very next batch re-reads the same `BATCH_SIZE` rows,
 * finds them all skipped again, and repeats — burning the whole nightly batch cap on zero
 * progress. That is the exact head-rescan class of failure this file exists to fix (see the module
 * docstring above), self-inflicted by a predicate instead of by a query that restarts at the head.
 *
 * The fix: a predicate-skipped doc still ADVANCES the cursor. `lastCreationTime` is set from every
 * doc iterated, deleted or skipped, so it always reflects the batch's true high-water mark.
 */
export function partitionBatchForPrune<T extends { _id: unknown; _creationTime: number }>(
  batch: readonly T[],
  predicate?: (doc: T) => boolean
): { toDelete: T[]; lastCreationTime: number | null } {
  const toDelete: T[] = [];
  let lastCreationTime: number | null = null;
  for (const doc of batch) {
    if (!predicate || predicate(doc)) {
      toDelete.push(doc);
    }
    lastCreationTime = doc._creationTime;
  }
  return { toDelete, lastCreationTime };
}

/**
 * resolveRotationStart — Phase 110 D-05's nightly rotation start-index resolution.
 *
 * Today's chain always restarts at index 0 (`startNightlyPrune` hardcodes `tableIndex: 0`), so any
 * night the batch cap is hit, every table past the firehose head is silently skipped forever. D-05
 * persists where the last run stopped and resumes there instead — but that persisted value is
 * operator-editable `agentConfigs` state, and this function treats it as untrusted (D-06): a
 * missing, non-integer, negative, or out-of-range value resolves to `0` rather than throwing or
 * skipping tables, because a missing/malformed cursor is never worse than the pre-Phase-110 status
 * quo of hardcoded `0`. The `< tableCount` bound is evaluated fresh on every call against whatever
 * `RETENTION_DAYS` currently holds, so it covers both a table being added and a table being removed
 * with no special case needed.
 */
export function resolveRotationStart(rawValue: unknown, tableCount: number): number {
  if (
    typeof rawValue === "number" &&
    Number.isInteger(rawValue) &&
    rawValue >= 0 &&
    rawValue < tableCount
  ) {
    return rawValue;
  }
  return 0;
}

/**
 * planRotationWrite — Phase 110 D-06's rotation-cursor write decision.
 *
 * Returns the value that should be patched into the persisted rotation cursor, or `null` meaning
 * "write nothing." Only the two chain-TERMINAL actions ever produce a write: `"cap-reached"`
 * persists `tableIndex` so tomorrow resumes exactly where tonight stopped (D-05); `"done"` persists
 * `0` to wrap for a fresh full pass. The interior actions, `"continue-table"` and `"next-table"`,
 * MUST return `null` — writing at either of those would mean one `agentConfigs` write per batch, up
 * to `MAX_BATCHES_PER_NIGHT` writes a single night, which is exactly the per-run write growth D-08
 * rejects for a module whose entire purpose is reducing writes to the live instance.
 */
export function planRotationWrite(action: PruneAction, tableIndex: number): number | null {
  if (action === "cap-reached") return tableIndex;
  if (action === "done") return 0;
  return null;
}
