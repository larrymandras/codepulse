/**
 * retentionCursor.test.ts — guards the fix for the self-defeating nightly prune.
 *
 * The defect being prevented: every batch re-scanned from the HEAD of the creation-time index, so it
 * had to walk past all the tombstones its predecessors had just made. Combined with a ~30-minute run
 * against a 30-minute tombstone GC window, that degraded until `pruneBatchV3` SystemTimeout'd — and
 * since the abort skips the reschedule, the whole chain died at table index 0 (`runtime_events`),
 * leaving the other 13 tables unpruned every night.
 *
 * The property that matters is therefore not "it deletes things" but **the cursor advances
 * monotonically and never returns to the head**.
 */

import { describe, it, expect } from "vitest";
import {
  planNextPruneStep,
  partitionBatchForPrune,
  resolveRotationStart,
  planRotationWrite,
  type PlanPruneStepArgs,
} from "./retentionCursor";

const BATCH_SIZE = 200;
const MAX_BATCHES = 600;

function step(overrides: Partial<PlanPruneStepArgs> = {}) {
  return planNextPruneStep({
    batchLength: BATCH_SIZE,
    lastCreationTime: 1_000,
    cursorMs: 0,
    tableIndex: 0,
    tableCount: 14,
    batchesUsed: 0,
    maxBatches: MAX_BATCHES,
    batchSize: BATCH_SIZE,
    ...overrides,
  });
}

describe("planNextPruneStep — chain advancement", () => {
  it("continues the same table when the batch came back full", () => {
    const s = step({ batchLength: BATCH_SIZE, lastCreationTime: 5_000 });
    expect(s.action).toBe("continue-table");
    expect(s.tableIndex).toBe(0);
  });

  it("moves to the next table when the batch was short, resetting the cursor", () => {
    const s = step({ batchLength: 12, tableIndex: 3 });
    expect(s.action).toBe("next-table");
    expect(s.tableIndex).toBe(4);
    expect(s.cursorMs).toBe(0);
  });

  it("moves on when the batch was empty", () => {
    const s = step({ batchLength: 0, lastCreationTime: null, tableIndex: 3 });
    expect(s.action).toBe("next-table");
    expect(s.tableIndex).toBe(4);
  });

  it("reports done after the last table drains", () => {
    const s = step({ batchLength: 5, tableIndex: 13, tableCount: 14 });
    expect(s.action).toBe("done");
  });

  it("stops at the nightly ceiling instead of running forever", () => {
    const s = step({ batchesUsed: MAX_BATCHES - 1 });
    expect(s.action).toBe("cap-reached");
    // The cursor is preserved so the operator can see where it stopped.
    expect(s.cursorMs).toBe(0);
  });
});

describe("planNextPruneStep — the cursor must never re-scan its own tombstones", () => {
  it("advances the cursor past the batch it just deleted", () => {
    const s = step({ cursorMs: 1_000, lastCreationTime: 9_999 });
    expect(s.action).toBe("continue-table");
    expect(s.cursorMs).toBe(9_999);
  });

  it("NEVER returns the cursor to the head while continuing a table", () => {
    // This is the regression itself: a cursor of 0 on a continue means the next batch seeks from the
    // start of the index and walks every tombstone again.
    for (const last of [1, 500, 12_345, Number.MAX_SAFE_INTEGER]) {
      const s = step({ cursorMs: 42, lastCreationTime: last, batchLength: BATCH_SIZE });
      expect(s.action).toBe("continue-table");
      expect(s.cursorMs).not.toBe(0);
      expect(s.cursorMs).toBeGreaterThanOrEqual(42);
    }
  });

  it("holds the cursor steady rather than rewinding if a full batch reports no timestamp", () => {
    const s = step({ batchLength: BATCH_SIZE, lastCreationTime: null, cursorMs: 7_777 });
    expect(s.cursorMs).toBe(7_777);
  });

  it("is monotonic across a long simulated run — the property the old code violated", () => {
    // Simulate 600 batches of a firehose table, the shape that timed out in production.
    let cursor = 0;
    let batchesUsed = 0;
    let tableIndex = 0;
    const seen: number[] = [];

    for (let batch = 0; batch < MAX_BATCHES - 1; batch++) {
      // Each batch's newest doc is later than the last — a real ascending scan.
      const lastCreationTime = (batch + 1) * 1_000;
      const s = planNextPruneStep({
        batchLength: BATCH_SIZE,
        lastCreationTime,
        cursorMs: cursor,
        tableIndex,
        tableCount: 14,
        batchesUsed,
        maxBatches: MAX_BATCHES,
        batchSize: BATCH_SIZE,
      });
      if (s.action === "cap-reached") break;
      expect(s.action).toBe("continue-table");
      // Strictly forward, every single batch.
      expect(s.cursorMs).toBeGreaterThan(cursor);
      cursor = s.cursorMs;
      tableIndex = s.tableIndex;
      seen.push(cursor);
      batchesUsed++;
    }

    // Under the OLD head-rescan behavior every batch would have started from 0 again; here the seek
    // point only ever moves forward, so no tombstone is ever walked twice.
    expect(seen.length).toBeGreaterThan(500);
    const sorted = [...seen].sort((a, b) => a - b);
    expect(seen).toEqual(sorted);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("resets to the head only when switching tables, where there are no tombstones of ours yet", () => {
    const s = step({ batchLength: 3, cursorMs: 999_999, tableIndex: 0 });
    expect(s.action).toBe("next-table");
    expect(s.cursorMs).toBe(0);
  });
});

// Phase 110 D-02: fake docs need only the two fields partitionBatchForPrune's generic bound
// requires. String ids, no Convex types imported — this file stays as dependency-free as the
// module it tests.
function fakeBatch(n: number, startMs = 1_000, stepMs = 1_000) {
  return Array.from({ length: n }, (_, i) => ({
    _id: `doc-${i}`,
    _creationTime: startMs + i * stepMs,
  }));
}

describe("partitionBatchForPrune — Phase 110 D-02 predicate-aware batch split", () => {
  it("with no predicate, puts every doc in toDelete and reports the last doc's timestamp", () => {
    const batch = fakeBatch(5);
    const { toDelete, lastCreationTime } = partitionBatchForPrune(batch);
    expect(toDelete).toEqual(batch);
    expect(lastCreationTime).toBe(batch[batch.length - 1]._creationTime);
  });

  it("Pitfall-1 regression: a full batch where the predicate rejects every doc still reports a non-null lastCreationTime", () => {
    const batch = fakeBatch(BATCH_SIZE);
    const { toDelete, lastCreationTime } = partitionBatchForPrune(batch, () => false);
    expect(toDelete).toHaveLength(0);
    expect(lastCreationTime).toBe(batch[BATCH_SIZE - 1]._creationTime);
  });

  it("Pitfall-1 regression, end-to-end: an all-skipped batch's real result still advances planNextPruneStep's cursor despite zero deletions", () => {
    const batch = fakeBatch(BATCH_SIZE);
    const startCursor = batch[0]._creationTime;
    const { lastCreationTime } = partitionBatchForPrune(batch, () => false);
    const next = planNextPruneStep({
      batchLength: batch.length,
      lastCreationTime,
      cursorMs: startCursor,
      tableIndex: 0,
      tableCount: 14,
      batchesUsed: 0,
      maxBatches: MAX_BATCHES,
      batchSize: BATCH_SIZE,
    });
    expect(next.action).toBe("continue-table");
    expect(next.cursorMs).toBeGreaterThan(startCursor);
  });

  it("the negative control proving the test above is not vacuous: feeding a null lastCreationTime (the pre-fix behavior) into the same planNextPruneStep call leaves the cursor UNCHANGED", () => {
    // Guard the guard, matching convex/retention.test.ts's harness-liveness convention: if this
    // control ever showed the cursor advancing, planNextPruneStep would no longer be defending
    // against a null lastCreationTime at all, and the regression test above would prove nothing.
    const batch = fakeBatch(BATCH_SIZE);
    const startCursor = batch[0]._creationTime;
    const next = planNextPruneStep({
      batchLength: batch.length,
      lastCreationTime: null,
      cursorMs: startCursor,
      tableIndex: 0,
      tableCount: 14,
      batchesUsed: 0,
      maxBatches: MAX_BATCHES,
      batchSize: BATCH_SIZE,
    });
    expect(next.cursorMs).toBe(startCursor);
  });

  it("splits a mixed batch correctly and still reports the final doc's timestamp even when the final doc is skipped", () => {
    const batch = fakeBatch(4); // _creationTime: 1000, 2000, 3000, 4000
    const { toDelete, lastCreationTime } = partitionBatchForPrune(
      batch,
      (doc) => doc._creationTime !== 4000 // reject only the last doc
    );
    expect(toDelete.map((d) => d._creationTime)).toEqual([1000, 2000, 3000]);
    expect(lastCreationTime).toBe(4000);
  });

  it("returns an empty toDelete and a null lastCreationTime for an empty batch", () => {
    const { toDelete, lastCreationTime } = partitionBatchForPrune([]);
    expect(toDelete).toEqual([]);
    expect(lastCreationTime).toBeNull();
  });
});

describe("partitionBatchForPrune — Phase 127 optional cursor-field extractor", () => {
  it("regression control: default path (no extractor) is unchanged for every existing case, and lastCursorValue mirrors lastCreationTime", () => {
    const batch = fakeBatch(5);
    const result = partitionBatchForPrune(batch);
    expect(result.toDelete).toEqual(batch);
    expect(result.lastCreationTime).toBe(batch[batch.length - 1]._creationTime);
    expect(result.lastCursorValue).toBe(result.lastCreationTime);
  });

  it("regression control: an all-skipped default-path batch still reports a non-null lastCreationTime, and lastCursorValue matches it", () => {
    const batch = fakeBatch(BATCH_SIZE);
    const result = partitionBatchForPrune(batch, () => false);
    expect(result.toDelete).toHaveLength(0);
    expect(result.lastCreationTime).toBe(batch[BATCH_SIZE - 1]._creationTime);
    expect(result.lastCursorValue).toBe(result.lastCreationTime);
  });

  it("regression control: an empty default-path batch reports both lastCreationTime and lastCursorValue as null", () => {
    const result = partitionBatchForPrune([]);
    expect(result.lastCreationTime).toBeNull();
    expect(result.lastCursorValue).toBeNull();
  });

  it("extractor path: lastCursorValue is the extracted field of the LAST iterated doc, independent of lastCreationTime", () => {
    const batch = [
      { _id: "a", _creationTime: 100, createdAt: 5_000 },
      { _id: "b", _creationTime: 200, createdAt: 6_000 },
      { _id: "c", _creationTime: 300, createdAt: 7_000 },
    ];
    const result = partitionBatchForPrune(batch, undefined, (doc) => doc.createdAt);
    expect(result.lastCursorValue).toBe(7_000);
    expect(result.lastCreationTime).toBe(300);
    expect(result.lastCursorValue).not.toBe(result.lastCreationTime);
  });

  it("D-08's trap: an all-skipped batch with an extractor still reports a non-null lastCursorValue equal to the last doc's extracted field", () => {
    const batch = [
      { _id: "a", _creationTime: 100, createdAt: 5_000 },
      { _id: "b", _creationTime: 200, createdAt: 6_000 },
      { _id: "c", _creationTime: 300, createdAt: 7_000 },
    ];
    const result = partitionBatchForPrune(
      batch,
      () => false,
      (doc) => doc.createdAt
    );
    expect(result.toDelete).toEqual([]);
    expect(result.lastCursorValue).toBe(7_000);
    expect(result.lastCursorValue).not.toBeNull();
  });

  it("empty batch with an extractor: both lastCreationTime and lastCursorValue are null", () => {
    const result = partitionBatchForPrune(
      [] as Array<{ _id: string; _creationTime: number; createdAt: number }>,
      undefined,
      (doc) => doc.createdAt
    );
    expect(result.lastCreationTime).toBeNull();
    expect(result.lastCursorValue).toBeNull();
  });
});

describe("resolveRotationStart — Phase 110 D-05/D-06 rotation-start resolution", () => {
  it("returns the raw value for an in-range integer", () => {
    expect(resolveRotationStart(5, 14)).toBe(5);
    expect(resolveRotationStart(0, 14)).toBe(0);
    expect(resolveRotationStart(13, 14)).toBe(13);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["NaN", NaN],
    ["a non-number string", "3"],
    ["a non-integer", 2.5],
    ["a negative number", -1],
    ["a value equal to tableCount", 14],
  ])("resolves %s to 0 rather than throwing or skipping tables", (_label, rawValue) => {
    expect(resolveRotationStart(rawValue, 14)).toBe(0);
  });
});

describe("planRotationWrite — Phase 110 D-06 rotation write decision", () => {
  it("returns tableIndex for cap-reached, so tomorrow resumes exactly where tonight stopped", () => {
    expect(planRotationWrite("cap-reached", 7)).toBe(7);
  });

  it("returns 0 for done, wrapping for a fresh full pass", () => {
    expect(planRotationWrite("done", 7)).toBe(0);
  });

  it("returns null at both interior actions — no per-batch agentConfigs write can be introduced", () => {
    expect(planRotationWrite("continue-table", 7)).toBeNull();
    expect(planRotationWrite("next-table", 7)).toBeNull();
  });
});
