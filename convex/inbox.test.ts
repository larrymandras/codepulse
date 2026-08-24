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
import { countHeldUnacked, listHeldUnackedHandler } from "./inbox";

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
