/**
 * Tests for convex/ideation.ts's Phase 127 (JANITOR-02) ack-aware janitor.
 *
 * `convex/ideation.ts` had ZERO tests before this file. This janitor is
 * inert by design until roughly 2026-11-16 (the oldest `ideationFindings`
 * row was 94 days old on 2026-08-21, and the auto-dismiss age threshold is
 * 180 days) -- its correctness cannot be inferred from its production
 * effects during that window, because it has none. These tests, plus the
 * R-01 log assertion below, are the only evidence it works before then.
 *
 * This repo has no `convex-test` runtime harness (documented at
 * `convex/runtimeIngest.test.ts:9`). The fixture below is a hand-rolled
 * in-memory fake `ctx.db`, following `convex/media.test.ts:513`'s
 * `makeJanitorMockCtx` convention: it threads the REAL `.eq(...)` /
 * `.gte(...).lt(...)` bounds the handler passes into `withIndex` through a
 * real filter over the supplied rows, rather than handing back a
 * pre-decided array -- so a mutation-testing control (see the SUMMARY for
 * this plan) can actually turn a test red.
 */
import { describe, it, expect, vi } from "vitest";
import {
  autoCloseAndPruneHandler,
  shouldAutoDismiss,
  shouldDeleteDismissed,
  IDEATION_JANITOR_BATCH_SIZE,
  IDEATION_JANITOR_MAX_BATCHES,
} from "./ideation";

// Independent restatements of the janitor's age thresholds -- NOT imported
// from ideation.ts -- so these tests are a real check on the threshold
// values rather than a tautological restatement of whatever the constants
// currently say. Mirrors media.test.ts's THIRTY_DAYS_MS discipline
// (media.test.ts:572).
const DAY_SEC = 24 * 60 * 60;
const AUTO_DISMISS_AGE_SEC_TEST = 180 * DAY_SEC;
const DISMISSED_GRACE_SEC_TEST = 90 * DAY_SEC;

type FakeRow = Record<string, unknown> & { _id: string };

/**
 * makeIdeationJanitorMockCtx -- a mock `ctx.db` that ACTUALLY APPLIES the
 * `.eq(...)` / `.gte(...).lt(...)` bounds `autoCloseAndPruneHandler` passes
 * into `withIndex`, filtering the supplied fixture rows the same way the
 * real `by_dismissed` and `by_dismissedAt` indexes would. Reimplements, as
 * explicit readable lines, the two index behaviours the handler depends on:
 *
 *   1. A `.gte`/`.lt` range on a field matches only rows where that field is
 *      a real number -- an ABSENT field never matches, mirroring Convex's
 *      documented ordering guarantee that an absent field sorts under
 *      `undefined`, below any real cursor value (cited at
 *      `convex/controlVerbSwaps.ts:97-117`, re-derived independently at
 *      `convex/media.ts:733-736`).
 *   2. The `by_dismissed` index's `.eq("dismissed", ...)` composes with its
 *      `createdAt` range as a genuine AND, not two independent filters
 *      silently applied to different rows.
 *
 * `patch`/`delete` mutate the in-memory `rows` array in place, so a single
 * test can drive the chain across two invocations (dismiss, then simulate
 * the grace period elapsing and delete) and see its own prior writes --
 * used by task 2's carve-out and transition tests.
 */
function makeIdeationJanitorMockCtx(rows: FakeRow[]) {
  const patch = vi.fn(async (id: unknown, args: Record<string, unknown>) => {
    const row = rows.find((r) => r._id === id);
    if (row) Object.assign(row, args);
  });
  const del = vi.fn(async (id: unknown) => {
    const idx = rows.findIndex((r) => r._id === id);
    if (idx >= 0) rows.splice(idx, 1);
  });
  const runAfter = vi.fn(async (_delayMs: number, _fnRef: unknown, _args: unknown) => "scheduled-id");

  let lastTakeArg: number | undefined;
  let lastRawBatch: FakeRow[] = [];

  const db = {
    query: (_table: string) => ({
      withIndex: (_indexName: string, cb: (q: unknown) => unknown) => {
        const bounds: {
          eqField?: string;
          eqValue?: unknown;
          rangeField?: string;
          gte?: number;
          lt?: number;
        } = {};
        const q = {
          eq: (field: string, value: unknown) => {
            bounds.eqField = field;
            bounds.eqValue = value;
            return q;
          },
          gte: (field: string, value: number) => {
            bounds.rangeField = field;
            bounds.gte = value;
            return q;
          },
          lt: (field: string, value: number) => {
            bounds.rangeField = field;
            bounds.lt = value;
            return q;
          },
        };
        cb(q);
        return {
          order: (_dir: string) => ({
            take: async (n: number) => {
              lastTakeArg = n;
              const rangeField = bounds.rangeField;
              const result = rows
                .filter((r) => {
                  if (bounds.eqField !== undefined && r[bounds.eqField] !== bounds.eqValue) {
                    return false;
                  }
                  if (rangeField) {
                    const v = r[rangeField];
                    // Behaviour 1 above: an absent field never matches a
                    // range bound, explicit and readable, not incidental.
                    if (typeof v !== "number") return false;
                    if (bounds.gte !== undefined && v < bounds.gte) return false;
                    if (bounds.lt !== undefined && v >= bounds.lt) return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                  if (!rangeField) return 0;
                  return (a[rangeField] as number) - (b[rangeField] as number);
                })
                .slice(0, n);
              lastRawBatch = result;
              return result;
            },
          }),
        };
      },
    }),
    patch,
    delete: del,
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { db, scheduler: { runAfter } } as any,
    patch,
    delete: del,
    runAfter,
    getTakeCalledWith: () => lastTakeArg,
    getLastRawBatch: () => lastRawBatch,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Verification A (structural): absent dismissedAt is excluded from the
// delete step's raw query batch -- asserted at the QUERY layer.
//
// KNOWN LIMITATION (127-VALIDATION.md "Known limitation", stated here per
// this plan's <context> instruction): because there is no `convex-test`
// harness, this can only be asserted against a hand-rolled mock query
// builder that REIMPLEMENTS the exclusion in JavaScript (see
// makeIdeationJanitorMockCtx's docstring above). A green result here shows
// that the HANDLER asks the index for the right range. It does NOT show
// that Convex's real index excludes `undefined` -- that property rests on
// the docs citation at `convex/controlVerbSwaps.ts:97-117` and on existing
// production call sites depending on it, not on this test.
// ---------------------------------------------------------------------------
describe("ideation janitor — Verification A (structural): absent dismissedAt excluded from delete-step batch", () => {
  it("control: a row with dismissedAt explicitly 0 under the same cutoff IS returned", async () => {
    const nowSec = 1_800_000_000;
    const { ctx, getLastRawBatch } = makeIdeationJanitorMockCtx([
      { _id: "zero-dismissed-at", severity: "medium", dismissed: true, dismissedAt: 0 },
    ]);

    await autoCloseAndPruneHandler(ctx, { step: "deleting" }, nowSec);

    expect(getLastRawBatch()).toHaveLength(1);
    expect(getLastRawBatch()[0]._id).toBe("zero-dismissed-at");
  });

  it("an undismissed row (dismissedAt absent) is NOT returned by the delete step's raw batch, even though it WOULD fall inside the range if dismissedAt were 0", async () => {
    const nowSec = 1_800_000_000;
    const { ctx, getLastRawBatch } = makeIdeationJanitorMockCtx([
      { _id: "never-dismissed", severity: "medium", dismissed: false, createdAt: nowSec - 400 * DAY_SEC },
    ]);

    await autoCloseAndPruneHandler(ctx, { step: "deleting" }, nowSec);

    expect(getLastRawBatch()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// R-01: the zero-row log assertion. At M=180d the auto-dismiss step matches
// zero rows until roughly 2026-11-16 -- for ~83 days THIS is the only signal
// distinguishing a correct-and-dormant janitor from a dead one. Not
// optional: proven to fail under a deliberate mutation (recorded in the
// SUMMARY for this plan, not encoded here, since the mutation is applied to
// convex/ideation.ts itself and reverted, not committed).
// ---------------------------------------------------------------------------
describe("ideation janitor — R-01: mandatory log line on a zero-row run", () => {
  it("logs a stable, greppable marker AND a rendered cutoff whose year is the CURRENT year, not 1970", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { ctx } = makeIdeationJanitorMockCtx([]);

    await autoCloseAndPruneHandler(ctx, {}, nowSec);

    expect(logSpy).toHaveBeenCalled();
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    const marker = lines.find((line) => line.includes("ideation") && line.includes("auto-close/prune"));
    expect(marker).toBeDefined();

    // A rendered ISO date, and specifically its year -- a seconds/
    // milliseconds unit bug renders this around 1970, which is the direct
    // signature of the defect this assertion exists to catch.
    const yearMatch = marker!.match(/(\d{4})-\d{2}-\d{2}T/);
    expect(yearMatch).not.toBeNull();
    const loggedYear = Number(yearMatch![1]);
    const currentYear = new Date(nowSec * 1000).getUTCFullYear();
    expect(loggedYear).toBeGreaterThanOrEqual(currentYear - 1);
    expect(loggedYear).toBeLessThanOrEqual(currentYear + 1);

    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Unit-scale control: a row created THIS INSTANT must not be swept by a
// seconds/milliseconds arithmetic error. Proven to fail under a deliberate
// mutation (recorded in the SUMMARY, not encoded here).
// ---------------------------------------------------------------------------
describe("ideation janitor — unit-scale control (seconds, not milliseconds)", () => {
  it("a finding created THIS INSTANT is NOT auto-dismissed", async () => {
    const nowSec = 1_800_000_000;
    const { ctx, patch } = makeIdeationJanitorMockCtx([
      { _id: "brand-new", severity: "medium", dismissed: false, createdAt: nowSec },
    ]);

    await autoCloseAndPruneHandler(ctx, { step: "dismissing" }, nowSec);

    expect(patch).not.toHaveBeenCalled();
  });

  it("control: a finding 181 days old IS auto-dismissed in the same run shape", async () => {
    const nowSec = 1_800_000_000;
    expect(181 * DAY_SEC).toBeGreaterThan(AUTO_DISMISS_AGE_SEC_TEST);
    const { ctx, patch } = makeIdeationJanitorMockCtx([
      { _id: "old-enough", severity: "medium", dismissed: false, createdAt: nowSec - 181 * DAY_SEC },
    ]);

    await autoCloseAndPruneHandler(ctx, { step: "dismissing" }, nowSec);

    expect(patch).toHaveBeenCalledWith("old-enough", { dismissed: true, dismissedAt: nowSec });
  });
});

// ---------------------------------------------------------------------------
// Verification B (carve-out): critical/high severity survives auto-dismiss;
// a same-batch medium row is dismissed and, once the grace period elapses,
// deleted. Plus the delete-step asymmetry case: a HUMAN-dismissed critical
// row has nothing left protecting it and must be deleted like any other
// closed row.
// ---------------------------------------------------------------------------
describe("ideation janitor — Verification B (carve-out): predicates", () => {
  it("shouldAutoDismiss excludes critical and high; includes medium and low. shouldDeleteDismissed is unconditionally true", () => {
    expect(shouldAutoDismiss({ severity: "critical" })).toBe(false);
    expect(shouldAutoDismiss({ severity: "high" })).toBe(false);
    expect(shouldAutoDismiss({ severity: "medium" })).toBe(true);
    expect(shouldAutoDismiss({ severity: "low" })).toBe(true);

    expect(shouldDeleteDismissed({ severity: "critical" })).toBe(true);
    expect(shouldDeleteDismissed({ severity: "high" })).toBe(true);
    expect(shouldDeleteDismissed({ severity: "medium" })).toBe(true);
  });
});

describe("ideation janitor — Verification B (carve-out): critical/high survive auto-dismiss while a same-batch medium row is dismissed and later deleted", () => {
  it("critical and high rows stay open through the dismissing step; the medium row is patched then, after the grace period, deleted", async () => {
    const nowSec = 1_800_000_000;
    const veryOld = nowSec - 400 * DAY_SEC;
    const rows: FakeRow[] = [
      { _id: "critical1", severity: "critical", dismissed: false, createdAt: veryOld },
      { _id: "high1", severity: "high", dismissed: false, createdAt: veryOld },
      // The control that proves the run did any work at all -- a
      // critical-and-high-only fixture would pass against a handler that
      // does nothing.
      { _id: "medium1", severity: "medium", dismissed: false, createdAt: veryOld },
    ];
    const { ctx, patch, delete: del } = makeIdeationJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(ctx, { step: "dismissing" }, nowSec);

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("medium1", { dismissed: true, dismissedAt: nowSec });

    const critRow = rows.find((r) => r._id === "critical1")!;
    const highRow = rows.find((r) => r._id === "high1")!;
    expect(critRow.dismissed).toBe(false);
    expect(critRow.dismissedAt).toBeUndefined();
    expect(highRow.dismissed).toBe(false);
    expect(highRow.dismissedAt).toBeUndefined();

    // Simulate the grace period elapsing (independently restated
    // DISMISSED_GRACE_SEC_TEST, plus one day of headroom), then run the
    // delete step against the SAME fixture (patch already mutated medium1
    // in place above).
    const laterSec = nowSec + DISMISSED_GRACE_SEC_TEST + DAY_SEC;
    await autoCloseAndPruneHandler(ctx, { step: "deleting" }, laterSec);

    expect(del).toHaveBeenCalledWith("medium1");
    expect(del).not.toHaveBeenCalledWith("critical1");
    expect(del).not.toHaveBeenCalledWith("high1");

    expect(rows.some((r) => r._id === "medium1")).toBe(false);
    expect(rows.some((r) => r._id === "critical1")).toBe(true);
    expect(rows.some((r) => r._id === "high1")).toBe(true);
  });
});

describe("ideation janitor — Verification B (carve-out): delete-step asymmetry — a human-dismissed critical row IS deleted", () => {
  it("a critical row a HUMAN dismissed long ago is deleted; an undismissed critical row in the same fixture survives", async () => {
    const nowSec = 1_800_000_000;
    const oldDismissedAt = nowSec - 400 * DAY_SEC;
    const rows: FakeRow[] = [
      {
        _id: "critical-human-dismissed",
        severity: "critical",
        dismissed: true,
        dismissedAt: oldDismissedAt,
        createdAt: oldDismissedAt - DAY_SEC,
      },
      // The pair that discriminates: without this row, a handler that
      // deletes every critical row regardless of dismissal state would
      // also pass.
      { _id: "critical-still-open", severity: "critical", dismissed: false, createdAt: oldDismissedAt },
    ];
    const { ctx, delete: del } = makeIdeationJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(ctx, { step: "deleting" }, nowSec);

    expect(del).toHaveBeenCalledWith("critical-human-dismissed");
    expect(del).not.toHaveBeenCalledWith("critical-still-open");
    expect(rows.some((r) => r._id === "critical-still-open")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Verification C: an entirely carved-out batch still advances the cursor
// (D-08) -- direct regression test for retentionCursor.ts's
// partitionBatchForPrune lastCursorValue behaviour, applied to this table.
// ---------------------------------------------------------------------------
describe("ideation janitor — Verification C: cursor advances on skip (all-carved-out batch)", () => {
  it("a FULL batch of entirely carved-out (critical) rows advances the cursor and does NOT reschedule with an unchanged cursor", async () => {
    const nowSec = 1_800_000_000;
    const veryOld = nowSec - 400 * DAY_SEC;
    const rows: FakeRow[] = Array.from({ length: IDEATION_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `critical-${i}`,
      severity: "critical",
      dismissed: false,
      createdAt: veryOld + i, // strictly increasing
    }));
    const { ctx, patch, runAfter } = makeIdeationJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(ctx, { step: "dismissing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(patch).not.toHaveBeenCalled();
    expect(result.actedCount).toBe(0);
    expect(result.rescheduled).toBe(true);
    expect(result.nextCursor).toBeGreaterThan(0);

    expect(runAfter).toHaveBeenCalledTimes(1);
    const [, , scheduledArgs] = runAfter.mock.calls[0] as [number, unknown, { cursor: number }];
    expect(scheduledArgs.cursor).toBeGreaterThan(0);
    expect(scheduledArgs.cursor).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Verification D: full batch reschedules, short batch stops, ceiling does
// zero work, and batchesDone carries across the dismissing -> deleting
// transition. Adapted from media.test.ts:636-713.
// ---------------------------------------------------------------------------
describe("ideation janitor — Verification D (batch): full batch reschedules the SAME step with batchesDone: 1", () => {
  it("a FULL dismissing batch reads .take(IDEATION_JANITOR_BATCH_SIZE) and reschedules with an advanced cursor and batchesDone: 1", async () => {
    const nowSec = 1_800_000_000;
    const veryOld = nowSec - 400 * DAY_SEC;
    const rows: FakeRow[] = Array.from({ length: IDEATION_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `medium-${i}`,
      severity: "medium",
      dismissed: false,
      createdAt: veryOld + i,
    }));
    const { ctx, runAfter, getTakeCalledWith } = makeIdeationJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(ctx, { step: "dismissing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(getTakeCalledWith()).toBe(IDEATION_JANITOR_BATCH_SIZE);
    expect(result.rescheduled).toBe(true);
    expect(result.step).toBe("dismissing");
    expect(runAfter).toHaveBeenCalledTimes(1);
    const [, , scheduledArgs] = runAfter.mock.calls[0] as [number, unknown, { step: string; cursor: number; batchesDone: number }];
    expect(scheduledArgs.step).toBe("dismissing");
    expect(scheduledArgs.cursor).toBeGreaterThan(0);
    expect(scheduledArgs.batchesDone).toBe(1);
  });
});

describe("ideation janitor — Verification D (batch): control — a short batch does NOT reschedule", () => {
  it("a SHORT deleting batch does not reschedule", async () => {
    const nowSec = 1_800_000_000;
    const rows: FakeRow[] = [
      { _id: "only-one", severity: "medium", dismissed: true, dismissedAt: nowSec - 400 * DAY_SEC },
    ];
    const { ctx, runAfter } = makeIdeationJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(ctx, { step: "deleting" }, nowSec);

    expect(result.rescheduled).toBe(false);
    expect(runAfter).not.toHaveBeenCalled();
  });
});

describe("ideation janitor — Verification D (batch): per-chain batch ceiling", () => {
  it("batchesDone already AT the ceiling: zero work, no reschedule", async () => {
    const nowSec = 1_800_000_000;
    const veryOld = nowSec - 400 * DAY_SEC;
    const rows: FakeRow[] = Array.from({ length: IDEATION_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `medium-${i}`,
      severity: "medium",
      dismissed: false,
      createdAt: veryOld + i,
    }));
    const { ctx, patch, runAfter } = makeIdeationJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(
      ctx,
      { step: "dismissing", cursor: 0, batchesDone: IDEATION_JANITOR_MAX_BATCHES },
      nowSec
    );

    expect(result.rescheduled).toBe(false);
    expect(runAfter).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
    expect(result.actedCount).toBe(0);
  });

  it("a FULL batch that reaches the ceiling on THIS invocation still does its own work but does not reschedule further", async () => {
    const nowSec = 1_800_000_000;
    const veryOld = nowSec - 400 * DAY_SEC;
    const rows: FakeRow[] = Array.from({ length: IDEATION_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `medium-${i}`,
      severity: "medium",
      dismissed: false,
      createdAt: veryOld + i,
    }));
    const { ctx, patch, runAfter } = makeIdeationJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(
      ctx,
      { step: "dismissing", cursor: 0, batchesDone: IDEATION_JANITOR_MAX_BATCHES - 1 },
      nowSec
    );

    // The work for this batch still happens -- an unbounded self-reschedule
    // is the risk, not doing the batch that's already in flight.
    expect(patch).toHaveBeenCalledTimes(IDEATION_JANITOR_BATCH_SIZE);
    expect(result.rescheduled).toBe(false);
    expect(runAfter).not.toHaveBeenCalled();
  });
});

describe("ideation janitor — Verification D (batch): dismissing -> deleting transition carries batchesDone forward", () => {
  it("a SHORT dismissing batch transitions to deleting with cursor: 0 and batchesDone: 1 (carried forward, never reset to 0)", async () => {
    const nowSec = 1_800_000_000;
    const rows: FakeRow[] = [
      { _id: "medium1", severity: "medium", dismissed: false, createdAt: nowSec - 400 * DAY_SEC },
    ];
    const { ctx, runAfter } = makeIdeationJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(ctx, { step: "dismissing" }, nowSec);

    expect(result.step).toBe("deleting");
    expect(result.rescheduled).toBe(true);
    expect(runAfter).toHaveBeenCalledTimes(1);
    const [, , scheduledArgs] = runAfter.mock.calls[0] as [number, unknown, { step: string; cursor: number; batchesDone: number }];
    expect(scheduledArgs).toMatchObject({ step: "deleting", cursor: 0, batchesDone: 1 });
  });
});

// This plan deliberately does NOT assert anything about the finding
// lifecycle's task-linking status value -- D-10 fences that gap out of the
// phase, and a test asserting current behaviour there would harden a gap
// the roadmap left open on purpose.
