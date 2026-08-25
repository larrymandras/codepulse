/**
 * convex/inbox.test.ts — SWEEP-01 (126-CONTEXT.md D-03/D-04): bound, index,
 * and both truncation-boundary guards for countHeldUnacked, plus a
 * regression guard proving listHeldUnackedHandler (the shared query
 * convex/inboxIngest.ts:174 depends on to feed focus_digest.py) stays
 * uncapped.
 *
 * This module had ZERO tests before this file — the Wave 0 gap named by
 * 126-VALIDATION.md.
 *
 * makeRecordingDb below is adapted from convex/alertsCountBounded.test.ts's
 * factory of the same name (that file does not export it, so this is a
 * fresh copy, not an import), records HOW the table was queried (index +
 * bound + limit), not just what rows came back — a surviving `.collect()`
 * still returns correct counts on a small fixture, so only the recorded
 * `limit` (null vs a number) distinguishes a bounded read from an unbounded
 * one.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  countHeldUnacked,
  listHeldUnackedHandler,
  autoCloseAndPruneHandler,
  INBOX_CLOSED_GRACE_SEC,
  INBOX_JANITOR_BATCH_SIZE,
  INBOX_JANITOR_MAX_BATCHES,
} from "./inbox";

const HELD_COUNT_SCAN_CAP = 2000;

interface IndexUse {
  table: string;
  index: string;
  bounds: Array<[string, string, unknown]>;
  limit: number | null;
}

function makeRecordingDb(rows: unknown[] = []) {
  const uses: IndexUse[] = [];
  return {
    uses,
    query(table: string) {
      const use: IndexUse = { table, index: "", bounds: [], limit: null };
      const chain = {
        withIndex(index: string, cb?: (q: unknown) => unknown) {
          use.index = index;
          if (cb) {
            const q: Record<string, (f: string, v: unknown) => unknown> = {};
            for (const op of ["eq", "gte", "gt", "lte", "lt"]) {
              q[op] = (field: string, value: unknown) => {
                use.bounds.push([op, field, value]);
                return q;
              };
            }
            cb(q);
          }
          return chain;
        },
        order() {
          return chain;
        },
        async take(n: number) {
          use.limit = n;
          uses.push(use);
          return rows.slice(0, n);
        },
        async collect() {
          // A surviving .collect() records a null limit — this is exactly
          // the shape the bound assertion below must fail on.
          uses.push(use);
          return rows;
        },
      };
      return chain;
    },
  };
}

/** n held rows; the first `ackedCount` of them carry ackedAt (excluded from
 * the unacked count), the rest are unacked (ackedAt undefined). */
function makeHeldRows(n: number, ackedCount = 0) {
  return Array.from({ length: n }, (_, i) => ({
    _id: `held-${i}`,
    itemType: "held",
    ackedAt: i < ackedCount ? 9999 : undefined,
  }));
}

async function runCountHeldUnacked(rows: unknown[] = [], args: Record<string, unknown> = {}) {
  const db = makeRecordingDb(rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (countHeldUnacked as any)._handler({ db }, args);
  return { db, result };
}

describe("inbox:countHeldUnacked — query cost guard (SWEEP-01, D-03/D-04)", () => {
  it("reads the inbox table via by_itemType with an eq(itemType, held) bound and a bounded, non-null limit", async () => {
    const { db } = await runCountHeldUnacked();

    expect(db.uses).toHaveLength(1);
    const use = db.uses[0];
    expect(use.table).toBe("inbox");
    expect(use.index).toBe("by_itemType");

    const itemTypeBound = use.bounds.find(([op, field]) => op === "eq" && field === "itemType");
    expect(itemTypeBound).toBeDefined();
    expect(itemTypeBound![2]).toBe("held");

    // The regression this test exists to catch: a surviving .collect() would
    // record limit === null here (i.e. .take() never ran).
    expect(use.limit).not.toBeNull();
    expect(typeof use.limit).toBe("number");
    expect(use.limit).toBe(HELD_COUNT_SCAN_CAP + 1);
  });

  it("reports truncated: true and a floor count when CAP+1 held rows are seeded (boundary, over side)", async () => {
    const rows = makeHeldRows(HELD_COUNT_SCAN_CAP + 1);
    const { result } = await runCountHeldUnacked(rows);

    expect(result.truncated).toBe(true);
    // count is a FLOOR: only the newest CAP rows of the CAP+1-row take are
    // counted, per the code comment on countHeldUnackedHandler.
    expect(result.count).toBe(HELD_COUNT_SCAN_CAP);
  });

  it("reports truncated: false when CAP-1 held rows are seeded — the CONTROL for the CAP+1 test above (boundary, under side)", async () => {
    // This is the control that could have come out the other way: a
    // constant-`true` truncated implementation passes the CAP+1 test but
    // fails this one, which is the whole point of asserting both sides.
    const rows = makeHeldRows(HELD_COUNT_SCAN_CAP - 1);
    const { result } = await runCountHeldUnacked(rows);

    expect(result.truncated).toBe(false);
    expect(result.count).toBe(HELD_COUNT_SCAN_CAP - 1);
  });

  it("count excludes rows carrying ackedAt and equals the unacked count when not truncated", async () => {
    const rows = makeHeldRows(10, 4); // 4 acked, 6 unacked
    const { result } = await runCountHeldUnacked(rows);

    expect(result.truncated).toBe(false);
    expect(result.count).toBe(6);
  });

  it("reports truncated: false and count: CAP at exactly HELD_COUNT_SCAN_CAP rows (not the alerts.ts length===CAP false-positive boundary)", async () => {
    const rows = makeHeldRows(HELD_COUNT_SCAN_CAP);
    const { result } = await runCountHeldUnacked(rows);

    expect(result.truncated).toBe(false);
    expect(result.count).toBe(HELD_COUNT_SCAN_CAP);
  });

  it("returns count: 0, truncated: false when there are no held rows", async () => {
    const { result } = await runCountHeldUnacked([]);

    expect(result).toEqual({ count: 0, truncated: false });
  });

  it("passing a cap-shaped argument ({ limit: 999999 }) changes nothing — args: {} carries no client-supplied cap", async () => {
    const rows = makeHeldRows(50, 10);
    const { result: withNoArgs } = await runCountHeldUnacked(rows, {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { result: withBogusArg } = await runCountHeldUnacked(rows, { limit: 999999 } as any);

    expect(withBogusArg).toEqual(withNoArgs);
  });
});

describe("inbox:listHeldUnackedHandler regression guard — must stay UNCAPPED (D-03)", () => {
  // convex/inboxIngest.ts:174's inboxReadHeldUnacked httpAction calls
  // listHeldUnacked directly to feed focus_digest.py, which needs the TRUE
  // unbounded unacked-held set across all profiles. If this test ever starts
  // returning HELD_COUNT_SCAN_CAP (2000) instead of the full seeded count,
  // someone has capped the shared query and silently broken focus_digest.py.
  it("returns every unacked held row for a fixture strictly LARGER than HELD_COUNT_SCAN_CAP", async () => {
    const fixtureSize = HELD_COUNT_SCAN_CAP + 250; // 2250 — crosses the boundary, not under it
    const rows = makeHeldRows(fixtureSize);
    const db = {
      query(_table: string) {
        return {
          withIndex(_index: string, cb?: (q: unknown) => unknown) {
            let filtered = rows;
            if (cb) {
              const conditions: Array<[string, unknown]> = [];
              (cb as (q: { eq: (f: string, v: unknown) => void }) => void)({
                eq: (f: string, v: unknown) => {
                  conditions.push([f, v]);
                },
              });
              filtered = rows.filter((r) => conditions.every(([f, v]) => (r as any)[f] === v));
            }
            return { collect: async () => filtered };
          },
        };
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await listHeldUnackedHandler({ db } as any);
    expect(result).toHaveLength(fixtureSize);
  });
});

// ============================================================
// Phase 127 Plan 04 (JANITOR-01) — autoCloseAndPruneHandler tests:
// Verifications A, B, C, D, the R-02 regression guard, and a unit-scale
// control. Fixture and helpers below are adapted from
// convex/media.test.ts:513-560's makeJanitorMockCtx (D-08 janitor), widened
// for inbox's TWO-field by_closedAt index (["closedAt", "createdAt"]) and
// its two-step closing/deleting chain. See 127-VALIDATION.md's per-task -t
// selector map and its "Known limitation — Verification A proves less than
// it appears to" section, restated inline below where it is load-bearing.
// ============================================================

const NOW = 1_800_000_000; // arbitrary fixed epoch SECONDS (matches inbox's Date.now()/1000 unit)
const DAY_SEC = 24 * 60 * 60;
const FOUR_HUNDRED_DAYS_SEC = 400 * DAY_SEC; // past both M (30d) and M+G (44d) by a wide margin

/**
 * makeInboxJanitorMockCtx — adapted from media.test.ts:513-560's
 * makeJanitorMockCtx for inbox's two-field by_closedAt index and its two
 * distinct query shapes:
 *   - closing step:  q.eq("closedAt", undefined).gte("createdAt", c).lt("createdAt", cutoff)
 *   - deleting step: q.gte("closedAt", c).lt("closedAt", cutoff)
 *
 * Threads the REAL eq/gte/lt bounds the handler passes into withIndex
 * through a real filter over a MUTABLE in-memory "table" (patch/delete
 * actually mutate it, so a later query in the same test sees prior writes —
 * a real DB would too). Reimplements the two index behaviors the handler
 * depends on as explicit, readable lines: (a) eq("closedAt", undefined)
 * matches only rows where the field is genuinely absent; (b) a numeric
 * gte/lt range on closedAt matches only rows whose closedAt IS a number,
 * never an absent one. A mock that just handed back a pre-decided array
 * could never turn red under plan 127-07's mutation-testing control, which
 * is the whole reason this fixture threads real bounds through a real
 * filter (media.test.ts's own stated rationale, media.test.ts:502-511).
 */
function makeInboxJanitorMockCtx(rows: any[]) {
  const table: any[] = rows.map((r) => ({ ...r }));
  const patches: Array<{ id: any; arg: Record<string, unknown> }> = [];
  const deletes: any[] = [];
  const takeCalls: number[] = [];
  const takeResults: any[][] = [];
  const runAfterCalls: Array<{ delayMs: number; fnRef: any; args: any }> = [];

  const db = {
    query: (_table: string) => ({
      withIndex: (_indexName: string, cb: (q: any) => any) => {
        const bounds: {
          eqClosedAtUndefined?: boolean;
          gteCreatedAt?: number;
          ltCreatedAt?: number;
          gteClosedAt?: number;
          ltClosedAt?: number;
        } = {};
        const q = {
          eq: (field: string, value: any) => {
            if (field === "closedAt" && value === undefined) {
              bounds.eqClosedAtUndefined = true;
            }
            return q;
          },
          gte: (field: string, value: number) => {
            if (field === "createdAt") bounds.gteCreatedAt = value;
            if (field === "closedAt") bounds.gteClosedAt = value;
            return q;
          },
          lt: (field: string, value: number) => {
            if (field === "createdAt") bounds.ltCreatedAt = value;
            if (field === "closedAt") bounds.ltClosedAt = value;
            return q;
          },
        };
        cb(q);
        return {
          order: (_dir: string) => ({
            take: async (n: number) => {
              takeCalls.push(n);
              let filtered = table.slice();

              // (a) .eq("closedAt", undefined) — matches ONLY rows where the
              // field is genuinely absent (the closing step's shape).
              if (bounds.eqClosedAtUndefined) {
                filtered = filtered.filter((r) => r.closedAt === undefined);
              }

              // (b) a numeric gte/lt range on closedAt matches ONLY rows
              // whose closedAt IS a number — an absent closedAt can never
              // satisfy a numeric range. This is the structural exclusion
              // Verification A asserts on (the deleting step's shape).
              if (bounds.gteClosedAt !== undefined || bounds.ltClosedAt !== undefined) {
                filtered = filtered.filter(
                  (r) =>
                    typeof r.closedAt === "number" &&
                    (bounds.gteClosedAt === undefined || r.closedAt >= bounds.gteClosedAt!) &&
                    (bounds.ltClosedAt === undefined || r.closedAt < bounds.ltClosedAt!)
                );
              }

              if (bounds.gteCreatedAt !== undefined) {
                filtered = filtered.filter((r) => r.createdAt >= bounds.gteCreatedAt!);
              }
              if (bounds.ltCreatedAt !== undefined) {
                filtered = filtered.filter((r) => r.createdAt < bounds.ltCreatedAt!);
              }

              const sortField = bounds.eqClosedAtUndefined ? "createdAt" : "closedAt";
              const result = filtered.sort((a, b) => a[sortField] - b[sortField]).slice(0, n);
              takeResults.push(result);
              return result;
            },
          }),
        };
      },
    }),
    patch: async (id: any, arg: Record<string, unknown>) => {
      patches.push({ id, arg });
      const row = table.find((r) => r._id === id);
      if (row) Object.assign(row, arg);
    },
    delete: async (id: any) => {
      deletes.push(id);
      const idx = table.findIndex((r) => r._id === id);
      if (idx >= 0) table.splice(idx, 1);
    },
  };

  const runAfter = async (delayMs: number, fnRef: any, args: any) => {
    runAfterCalls.push({ delayMs, fnRef, args });
    return "scheduled-id";
  };

  return {
    ctx: { db, scheduler: { runAfter } } as any,
    table,
    patches,
    deletes,
    takeCalls,
    takeResults,
    runAfterCalls,
    getRow: (id: any) => table.find((r) => r._id === id),
    rowExists: (id: any) => table.some((r) => r._id === id),
  };
}

/**
 * runChainToConvergence — repeatedly invokes autoCloseAndPruneHandler,
 * feeding each reschedule's ACTUAL scheduled args (captured from the mock's
 * ctx.scheduler.runAfter call — the ground truth for what the next real
 * invocation would receive) back in as the next call's args, until a call
 * reports rescheduled: false. Deliberately does NOT trust the handler's OWN
 * return value for the next step: `result.step` is the step that JUST ran,
 * not necessarily the next one (a short closing batch transitions to
 * "deleting" while still reporting step: "closing" on that same call) — only
 * the scheduled args know the real next step.
 */
async function runChainToConvergence(
  mock: ReturnType<typeof makeInboxJanitorMockCtx>,
  nowSec: number
) {
  let args: { step?: "closing" | "deleting"; cursor?: number; batchesDone?: number } = {};
  const results: any[] = [];
  let iterations = 0;
  while (iterations < 1000) {
    iterations++;
    const result = await autoCloseAndPruneHandler(mock.ctx, args, nowSec);
    results.push(result);
    if (!result.rescheduled) break;
    const lastScheduled = mock.runAfterCalls[mock.runAfterCalls.length - 1];
    args = lastScheduled.args;
  }
  return results;
}

/**
 * driveJanitorLifecycle — Verification B's "closed AND deleted, in the SAME
 * run" fixtures need two separate handler drives at two separate points in
 * time, not one: a row the closing step stamps at `nowSec` cannot ALSO be
 * past INBOX_CLOSED_GRACE_SEC in the SAME instant (grace is 14 days; the
 * inter-batch reschedule delay is 3 SECONDS) — a single nowSec value can
 * only ever exercise one of the two steps meaningfully per row. Phase 1
 * drives the chain at `nowSec` (closes eligible rows). Phase 2 drives it
 * again at `nowSec + INBOX_CLOSED_GRACE_SEC + 1`, simulating the grace
 * period having elapsed by the time of a LATER real invocation — which then
 * deletes whatever phase 1 closed. Both phases run against the SAME mutable
 * table/fixture, so "the same run" here means "the same test", not "the
 * same literal nowSec" (which the real 14-day grace window makes impossible
 * to exercise both effects under, regardless of implementation).
 */
async function driveJanitorLifecycle(
  mock: ReturnType<typeof makeInboxJanitorMockCtx>,
  nowSec: number
) {
  const closePhase = await runChainToConvergence(mock, nowSec);
  const deletePhase = await runChainToConvergence(mock, nowSec + INBOX_CLOSED_GRACE_SEC + 1);
  return { closePhase, deletePhase };
}

describe("inbox janitor: Verification A — structural absent-closedAt exclusion (delete-step index range)", () => {
  // What this DOES NOT prove (127-VALIDATION.md "Known limitation"): this
  // repo has no convex-test runtime harness, so "the database-level index
  // range excludes undefined" here means a hand-rolled mock
  // (makeInboxJanitorMockCtx above) that reimplements Convex's
  // undefined-exclusion in JavaScript. A green test below demonstrates that
  // the HANDLER asks the by_closedAt index for the right range — it does
  // NOT demonstrate that Convex's real index excludes `undefined` from that
  // range. That property rests on the docs citation at
  // convex/controlVerbSwaps.ts:105-109 and on two production call sites
  // already depending on it (media.ts:733-736 independently re-derives the
  // same ordering), not on this test. Do not let a green result here imply
  // more than it proves.
  it("a row with closedAt ABSENT is never returned by the delete step's raw query batch (structural)", async () => {
    const nowSec = NOW;
    // Positioned so it WOULD fall inside the delete step's [0, cutoff)
    // range if its closedAt were 0.
    const rows = [
      { _id: "absent-1", itemType: "card", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, closedAt: undefined },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(mock.ctx, { step: "deleting", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.takeResults).toHaveLength(1);
    expect(mock.takeResults[0]).toHaveLength(0);
  });

  it("control (structural): a row with closedAt EXPLICITLY 0 under the same cutoff IS returned — proves the probe discriminates absence from zero", async () => {
    const nowSec = NOW;
    const rows = [
      { _id: "zero-1", itemType: "card", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, closedAt: 0 },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(mock.ctx, { step: "deleting", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.takeResults).toHaveLength(1);
    expect(mock.takeResults[0]).toHaveLength(1);
    expect(mock.takeResults[0][0]._id).toBe("zero-1");
  });
});

describe("inbox janitor: R-02 regression guard — closing step never patches ackedAt", () => {
  it("every recorded db.patch call names ONLY closedAt, and no patched row's ackedAt value changes (never patches ackedAt)", async () => {
    const nowSec = NOW;
    const rows = [
      { _id: "r1", itemType: "card", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
      { _id: "r2", itemType: "card", priority: "high", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: 12345 },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(mock.ctx, { step: "closing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.patches.length).toBeGreaterThan(0);
    for (const { arg } of mock.patches) {
      expect(Object.keys(arg)).toEqual(["closedAt"]);
    }
    expect(mock.getRow("r1").ackedAt).toBeUndefined();
    expect(mock.getRow("r2").ackedAt).toBe(12345);
  });

  it("source-level: the janitor region of convex/inbox.ts (Phase 127 section to EOF) contains zero ackedAt: occurrences, paired with a closedAt: control that IS found (never patches ackedAt)", () => {
    const source = readFileSync(resolve(process.cwd(), "convex/inbox.ts"), "utf-8");
    // 127-04-PLAN.md names "the autoCloseAndPruneHandler declaration" as the
    // start marker, but that function is declared AFTER runClosingStep
    // (which contains the one live `{ closedAt: nowSec }` patch call this
    // guard exists to find) — starting there would make the closedAt:
    // control itself read zero, indistinguishable from a broken pattern.
    // Anchored instead at the Phase 127 section's own start comment, which
    // covers runClosingStep + runDeletingStep + autoCloseAndPruneHandler +
    // the internalMutation wrapper — the entire new region this plan tests.
    const startMarker = "Phase 127 (JANITOR-01, R-02) — ack-aware auto-close + prune janitor";
    const startIdx = source.indexOf(startMarker);
    expect(startIdx).toBeGreaterThanOrEqual(0);
    const janitorRegion = source.slice(startIdx);

    expect(janitorRegion.match(/ackedAt:/g)).toBeNull();
    expect(janitorRegion.match(/closedAt:/g)?.length ?? 0).toBeGreaterThan(0);
  });
});

describe("inbox janitor: unit-scale control — seconds, not milliseconds", () => {
  // INBOX_AUTOCLOSE_AGE_SEC is deliberately re-derived here (30 * 24 * 60 *
  // 60), NOT imported — media.test.ts's THIRTY_DAYS_MS discipline — so this
  // is a real check on the constant's value/unit, not a restatement of
  // whatever inbox.ts currently says.
  const TEST_AUTOCLOSE_AGE_SEC = 30 * 24 * 60 * 60;

  it("a row created THIS INSTANT is NOT auto-closed", async () => {
    const nowSec = NOW;
    const rows = [{ _id: "fresh-1", itemType: "card", priority: "normal", createdAt: nowSec, ackedAt: undefined }];
    const mock = makeInboxJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(mock.ctx, { step: "closing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.getRow("fresh-1").closedAt).toBeUndefined();
  });

  it("a row created just past the auto-close age IS auto-closed — catches a ms/sec unit-scale defect", async () => {
    const nowSec = NOW;
    const rows = [
      { _id: "old-1", itemType: "card", priority: "normal", createdAt: nowSec - TEST_AUTOCLOSE_AGE_SEC - 1, ackedAt: undefined },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(mock.ctx, { step: "closing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.getRow("old-1").closedAt).toBe(nowSec);
  });
});

describe("inbox janitor: carve-out — held excluded unconditionally, unacked card closed+deleted (D-03, paired same run)", () => {
  it("a held row survives BOTH steps while a same-age unacked card row is closed then deleted, in the same fixture", async () => {
    const nowSec = NOW;
    const rows = [
      { _id: "held-1", itemType: "held", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
      { _id: "card-1", itemType: "card", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await driveJanitorLifecycle(mock, nowSec);

    const held = mock.getRow("held-1");
    expect(held).toBeDefined();
    expect(held.closedAt).toBeUndefined();
    expect(held.ackedAt).toBeUndefined();
    expect(mock.rowExists("held-1")).toBe(true);

    // The pairing is what makes this discriminate — a held-only fixture
    // would pass against a handler that does nothing at all.
    expect(mock.rowExists("card-1")).toBe(false);
    expect(mock.deletes).toContain("card-1");
  });
});

describe("inbox janitor: carve-out — money blocks SILENT closure, a same-batch non-money card is the control (D-03)", () => {
  it("an unacked money card stays untouched while a same-batch unacked non-money card IS closed and deleted", async () => {
    const nowSec = NOW;
    const rows = [
      { _id: "money-unacked", itemType: "card", priority: "money", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
      { _id: "normal-unacked", itemType: "card", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await driveJanitorLifecycle(mock, nowSec);

    const moneyRow = mock.getRow("money-unacked");
    expect(moneyRow).toBeDefined();
    expect(moneyRow.closedAt).toBeUndefined();
    expect(mock.rowExists("money-unacked")).toBe(true);

    expect(mock.rowExists("normal-unacked")).toBe(false);
    expect(mock.deletes).toContain("normal-unacked");
  });
});

describe("inbox janitor: carve-out — money's D-03 asymmetry: a human-acked money card IS closed and deleted", () => {
  it("a human-acked money card is closed+deleted while a same-batch still-unacked money card stays untouched", async () => {
    const nowSec = NOW;
    const rows = [
      {
        _id: "money-acked",
        itemType: "card",
        priority: "money",
        createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC,
        ackedAt: nowSec - FOUR_HUNDRED_DAYS_SEC + 10, // human genuinely acked it
      },
      { _id: "money-still-unacked", itemType: "card", priority: "money", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await driveJanitorLifecycle(mock, nowSec);

    // Acking flips the outcome — once a human genuinely acks a money item
    // it is ordinary closed data and ages out on the normal grace window.
    expect(mock.rowExists("money-acked")).toBe(false);
    expect(mock.deletes).toContain("money-acked");

    const stillUnacked = mock.getRow("money-still-unacked");
    expect(stillUnacked).toBeDefined();
    expect(stillUnacked.closedAt).toBeUndefined();
    expect(mock.rowExists("money-still-unacked")).toBe(true);
  });
});

describe("inbox janitor: carve-out — held excluded even when acked (unconditional, D-03/D-11)", () => {
  it("a held row WITH ackedAt set, 400 days old, is still untouched by both steps", async () => {
    const nowSec = NOW;
    const rows = [
      {
        _id: "held-acked",
        itemType: "held",
        priority: "normal",
        createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC,
        ackedAt: nowSec - FOUR_HUNDRED_DAYS_SEC + 10,
      },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await driveJanitorLifecycle(mock, nowSec);

    const row = mock.getRow("held-acked");
    expect(row).toBeDefined();
    expect(row.closedAt).toBeUndefined();
    expect(mock.rowExists("held-acked")).toBe(true);
    expect(mock.patches.find((p) => p.id === "held-acked")).toBeUndefined();
  });
});

describe("inbox janitor: carve-out - shouldDeleteClosed's held guard, covered INDEPENDENTLY of shouldAutoClose (127-07 flip 4)", () => {
  // WHY THIS EXISTS. Plan 127-07's mutation-testing control deleted the
  // `itemType !== "held"` guard from shouldDeleteClosed and ALL 24 tests in
  // this file stayed green. The guard was real, deliberate defense-in-depth
  // (see its docstring in inbox.ts) and had zero coverage: every other held
  // fixture here leaves closedAt undefined - the "held excluded even when
  // acked" test above even ASSERTS it stays undefined - so the delete step's
  // index range never returned a held row, and shouldDeleteClosed was never
  // reached with one.
  //
  // That made the guard invisible to the suite and therefore deletable by a
  // future reader as apparently-dead code. It is not dead: it is what keeps
  // the two steps independently correct if shouldAutoClose is ever edited to
  // let a held row acquire closedAt. held is what focus_digest.py consumes.
  //
  // The fixture below is the one shape no other test in this file builds: a
  // held row that ALREADY carries closedAt, past the grace window.
  it("a held row that already carries closedAt past the grace window survives the delete step, while an identical non-held row is deleted", async () => {
    const nowSec = NOW;
    const closedLongAgo = nowSec - FOUR_HUNDRED_DAYS_SEC;
    const rows = [
      { _id: "held-preclosed", itemType: "held", priority: "normal", createdAt: closedLongAgo, ackedAt: undefined, closedAt: closedLongAgo },
      { _id: "card-preclosed", itemType: "card", priority: "normal", createdAt: closedLongAgo, ackedAt: undefined, closedAt: closedLongAgo },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    await autoCloseAndPruneHandler(mock.ctx, { step: "deleting", cursor: 0, batchesDone: 0 }, nowSec);

    // (1) BOTH rows are returned by the by_closedAt range. This is the half
    // that makes the test discriminating: if the query itself excluded held,
    // the survival assertion below would pass with the guard deleted, which
    // is exactly the false pass this test exists to prevent.
    expect(mock.takeResults).toHaveLength(1);
    expect(mock.takeResults[0].map((r: any) => r._id).sort()).toEqual([
      "card-preclosed",
      "held-preclosed",
    ]);

    // (2) Only shouldDeleteClosed separates them.
    expect(mock.rowExists("held-preclosed")).toBe(true);
    expect(mock.deletes).not.toContain("held-preclosed");

    // (3) The paired control - without it, a handler that deletes nothing at
    // all would pass (1) and (2).
    expect(mock.rowExists("card-preclosed")).toBe(false);
    expect(mock.deletes).toContain("card-preclosed");
  });
});

describe("inbox janitor: cursor advances on skip — an all-excluded batch still advances (D-08, Verification C)", () => {
  // held is ~2.7% of the unacked population in production, so an
  // all-skipped batch is normal operation, not a rare edge case — a stalled
  // cursor here would burn the entire per-chain batch budget on zero
  // progress, every single invocation, forever.
  it("a FULL batch of entirely held rows: zero patches, cursor strictly advances, and does NOT reschedule with an unchanged cursor", async () => {
    const nowSec = NOW;
    const baseCreatedAt = nowSec - FOUR_HUNDRED_DAYS_SEC;
    const rows = Array.from({ length: INBOX_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `held-${i}`,
      itemType: "held",
      priority: "normal",
      createdAt: baseCreatedAt + i,
      ackedAt: undefined,
    }));
    const mock = makeInboxJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(mock.ctx, { step: "closing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.patches).toHaveLength(0);
    expect(result.nextCursor).toBeGreaterThan(0);
    expect(mock.runAfterCalls).toHaveLength(1);
    const scheduledArgs = mock.runAfterCalls[0].args;
    // The negative case the defect actually produces: must NOT reschedule
    // with an unchanged cursor.
    expect(scheduledArgs.cursor).not.toBe(0);
    expect(scheduledArgs.cursor).toBe(result.nextCursor);
  });
});

describe("inbox janitor: batch bound and reschedule (Verification D, adapted from media.test.ts:636-667)", () => {
  it("a FULL closing batch reads .take(INBOX_JANITOR_BATCH_SIZE) and reschedules with a strictly-advanced cursor, batchesDone: 1", async () => {
    const nowSec = NOW;
    const baseCreatedAt = nowSec - FOUR_HUNDRED_DAYS_SEC;
    const rows = Array.from({ length: INBOX_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `card-${i}`,
      itemType: "card",
      priority: "normal",
      createdAt: baseCreatedAt + i,
      ackedAt: undefined,
    }));
    const mock = makeInboxJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(mock.ctx, { step: "closing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(mock.takeCalls).toEqual([INBOX_JANITOR_BATCH_SIZE]);
    expect(result.rescheduled).toBe(true);
    expect(mock.runAfterCalls).toHaveLength(1);
    const scheduledArgs = mock.runAfterCalls[0].args;
    expect(scheduledArgs.cursor).toBeGreaterThan(0);
    expect(scheduledArgs.batchesDone).toBe(1);
    expect(scheduledArgs.step).toBe("closing");
  });

  it("control: a SHORT batch in the delete step does NOT reschedule", async () => {
    const nowSec = NOW;
    const rows = [
      {
        _id: "closed-1",
        itemType: "card",
        priority: "normal",
        createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC,
        closedAt: nowSec - INBOX_CLOSED_GRACE_SEC - 10,
      },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(mock.ctx, { step: "deleting", cursor: 0, batchesDone: 0 }, nowSec);

    expect(result.rescheduled).toBe(false);
    expect(mock.runAfterCalls).toHaveLength(0);
  });
});

describe("inbox janitor: per-chain batch ceiling (Verification D, T-118-19 analog)", () => {
  it("batchesDone already AT INBOX_JANITOR_MAX_BATCHES: zero reads, zero patches/deletes, no reschedule", async () => {
    const nowSec = NOW;
    const rows = Array.from({ length: INBOX_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `card-${i}`,
      itemType: "card",
      priority: "normal",
      createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC + i,
      ackedAt: undefined,
    }));
    const mock = makeInboxJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(
      mock.ctx,
      { step: "closing", cursor: 0, batchesDone: INBOX_JANITOR_MAX_BATCHES },
      nowSec
    );

    expect(mock.takeCalls).toHaveLength(0);
    expect(mock.patches).toHaveLength(0);
    expect(mock.deletes).toHaveLength(0);
    expect(result.rescheduled).toBe(false);
    expect(mock.runAfterCalls).toHaveLength(0);
  });

  it("a FULL batch that reaches the ceiling on THIS invocation still does its own work but does not reschedule further", async () => {
    const nowSec = NOW;
    const rows = Array.from({ length: INBOX_JANITOR_BATCH_SIZE }, (_, i) => ({
      _id: `card-${i}`,
      itemType: "card",
      priority: "normal",
      createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC + i,
      ackedAt: undefined,
    }));
    const mock = makeInboxJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(
      mock.ctx,
      { step: "closing", cursor: 0, batchesDone: INBOX_JANITOR_MAX_BATCHES - 1 },
      nowSec
    );

    expect(mock.patches).toHaveLength(INBOX_JANITOR_BATCH_SIZE);
    expect(result.rescheduled).toBe(false);
    expect(mock.runAfterCalls).toHaveLength(0);
  });
});

describe("inbox janitor: batch transition — closing to deleting carries batchesDone, resets cursor (Verification D)", () => {
  it("a SHORT closing batch transitions to deleting with cursor: 0 and batchesDone CARRIED (not reset)", async () => {
    const nowSec = NOW;
    const rows = [
      { _id: "card-1", itemType: "card", priority: "normal", createdAt: nowSec - FOUR_HUNDRED_DAYS_SEC, ackedAt: undefined },
    ];
    const mock = makeInboxJanitorMockCtx(rows);

    const result = await autoCloseAndPruneHandler(mock.ctx, { step: "closing", cursor: 0, batchesDone: 0 }, nowSec);

    expect(result.rescheduled).toBe(true);
    expect(mock.runAfterCalls).toHaveLength(1);
    const scheduledArgs = mock.runAfterCalls[0].args;
    // Literal values, not just truthy checks — a reset here would silently
    // give the deleting step a fresh full budget, doubling the disclosed
    // worst case (INBOX_JANITOR_MAX_BATCHES per step instead of per chain).
    expect(scheduledArgs).toMatchObject({ step: "deleting", cursor: 0, batchesDone: 1 });
  });
});
