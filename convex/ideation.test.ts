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
import { autoCloseAndPruneHandler } from "./ideation";

// Independent restatements of the janitor's age thresholds -- NOT imported
// from ideation.ts -- so these tests are a real check on the threshold
// values rather than a tautological restatement of whatever the constants
// currently say. Mirrors media.test.ts's THIRTY_DAYS_MS discipline
// (media.test.ts:572).
const DAY_SEC = 24 * 60 * 60;
const AUTO_DISMISS_AGE_SEC_TEST = 180 * DAY_SEC;

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
