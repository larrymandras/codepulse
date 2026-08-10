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

/** What an overhang probe could determine about a table's un-pruned backlog. */
export type OverhangStatus =
  | "overhang" // a doc the pruner WOULD delete is still sitting past the cutoff
  | "caught-up" // every doc past the cutoff is one the pruner is meant to keep
  | "indeterminate"; // scanned a full window of keep-forever docs; can't see past it

export interface OverhangProbe {
  status: OverhangStatus;
  /** `_creationTime` of the oldest doc the pruner would actually delete, or null. */
  oldestPrunableMs: number | null;
  /** How far past the cutoff that doc is, or null when there is none. */
  overhangHours: number | null;
  /** Docs examined — always ≤ probeLimit, and all already past the cutoff. */
  scanned: number;
}

/**
 * summarizeOverhangProbe — turns a cutoff-bounded head batch into a retention-lag verdict.
 *
 * ## Why this exists (2026-08-10)
 *
 * `retention-health-check.ps1` measured lag as "how far past the cutoff is the oldest doc in the
 * table", read straight off `by_creation_time` with no predicate. That question is only equivalent
 * to "is the prune behind?" while every doc past the cutoff is deletable — which stopped being true
 * the moment Phase 110 D-01 gave `aggregates` a predicate that keeps `period:"daily"` rows FOREVER.
 *
 * Measured on the live instance that day: 93 `aggregates` docs sat past the 90-day cutoff — 73
 * `hourly` (deletable) and 20 `daily` (protected by design). Once a nightly run removes the 73, the
 * oldest remaining doc is a *daily* row 165.4h past the cutoff, and it ages 24h further every day.
 * Against a 72h FAIL threshold that is a permanent, unclearable ALERT reporting a working pruner as
 * broken — and an alert that can never go green is one an operator learns to ignore, which costs the
 * real alerts too.
 *
 * The fix is to ask the pruner's question instead of the index's: measure the oldest doc that
 * `pruneBatchV3` WOULD delete. This shares `partitionBatchForPrune` with the pruner rather than
 * re-deriving the rule, so a predicate change moves both together by construction — the same
 * anti-drift reasoning D-07 applied to `RETENTION_DAYS`, which had already drifted once when it was
 * hand-copied into the health-check script.
 *
 * ## Why a full window of skipped docs is `indeterminate`, not `caught-up`
 *
 * The batch is range-bounded by the cutoff, so a SHORT batch means every doc past the cutoff was
 * seen: zero prunable among them is genuine caught-up. A FULL batch means the window was exhausted
 * and a prunable doc could be sitting just past it, unseen. Calling that "caught-up" would be a
 * green verdict derived from a probe that could not have observed the failure — so it reports
 * `indeterminate` and lets the caller refuse to claim health rather than manufacture it.
 */
export function summarizeOverhangProbe<T extends { _id: unknown; _creationTime: number }>(args: {
  batch: readonly T[];
  predicate?: (doc: T) => boolean;
  probeLimit: number;
  cutoffMs: number;
}): OverhangProbe {
  const { batch, predicate, probeLimit, cutoffMs } = args;
  const { toDelete } = partitionBatchForPrune(batch, predicate);

  if (toDelete.length > 0) {
    // `toDelete` preserves the batch's ascending order, so element 0 is the oldest prunable doc.
    const oldestPrunableMs = toDelete[0]._creationTime;
    const rawHours = (cutoffMs - oldestPrunableMs) / 3600000;
    return {
      status: "overhang",
      oldestPrunableMs,
      // Clamp at 0: a doc can land microseconds under the cutoff between the caller computing it
      // and the read completing, and a negative "lag" is meaningless noise in an alert body.
      overhangHours: Math.round(Math.max(rawHours, 0) * 10) / 10,
      scanned: batch.length,
    };
  }

  if (batch.length >= probeLimit) {
    return { status: "indeterminate", oldestPrunableMs: null, overhangHours: null, scanned: batch.length };
  }

  return { status: "caught-up", oldestPrunableMs: null, overhangHours: 0, scanned: batch.length };
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
