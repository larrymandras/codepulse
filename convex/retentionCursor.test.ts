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
import { planNextPruneStep, type PlanPruneStepArgs } from "./retentionCursor";

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
