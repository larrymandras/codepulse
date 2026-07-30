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
