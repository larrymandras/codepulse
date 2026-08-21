/**
 * alerts:countBySeverity runs on EVERY route once the shell subscribes to it
 * (D-13, 124-CONTEXT.md), so an unbounded `.collect()` here is an app-wide
 * DoS risk: a Convex system-operation timeout on this query unmounts the
 * React tree everywhere, not on one widget.
 *
 * This test locks the bound in: it asserts on the RECORDED query the handler
 * issued (index + limit), not merely on the counts it returns, because a
 * surviving `.collect()` still returns correct counts on a small table —
 * only the recorded `limit` (null vs a number) distinguishes a bounded read
 * from an unbounded one. It also locks in the truncation flag added
 * alongside the bound, on both sides of the cap boundary.
 */
import { describe, it, expect } from "vitest";
import { countBySeverity } from "./alerts";

const ALERT_COUNT_SCAN_CAP = 2000;

interface IndexUse {
  table: string;
  index: string;
  bounds: Array<[string, string, unknown]>;
  limit: number | null;
}

/**
 * Fake ctx.db that records HOW the table was queried, not just what came
 * back. Adapted from convex/heroStats.test.ts's makeRecordingDb (that file
 * does not export it, so this is a copy, not an import).
 */
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

async function runCountBySeverity(rows: unknown[] = []) {
  const db = makeRecordingDb(rows);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (countBySeverity as any)._handler({ db }, {});
  return { db, result };
}

function makeRows(n: number, severity = "warning") {
  return Array.from({ length: n }, (_, i) => ({
    _id: `row-${i}`,
    severity,
    status: "active",
    acknowledged: false,
  }));
}

describe("alerts:countBySeverity — query cost guard (D-13)", () => {
  it("reads the alerts table via by_acknowledged with an eq(acknowledged, false) bound and a bounded, non-null limit", async () => {
    const { db } = await runCountBySeverity();

    expect(db.uses).toHaveLength(1);
    const use = db.uses[0];
    expect(use.table).toBe("alerts");
    expect(use.index).toBe("by_acknowledged");

    const ackBound = use.bounds.find(([op, field]) => op === "eq" && field === "acknowledged");
    expect(ackBound).toBeDefined();
    expect(ackBound![2]).toBe(false);

    // The regression this test exists to catch: a surviving .collect() would
    // record limit === null here.
    expect(use.limit).not.toBeNull();
    expect(typeof use.limit).toBe("number");
    expect(use.limit).toBeGreaterThanOrEqual(1000);
  });

  it("counts correctly and reports truncated: false for 3 rows (critical, warning, resolved-error)", async () => {
    const rows = [
      { _id: "a", severity: "critical", status: "active", acknowledged: false },
      { _id: "b", severity: "warning", status: "active", acknowledged: false },
      // Unacknowledged but resolved — must be excluded from counts (existing
      // business rule, untouched by this plan).
      { _id: "c", severity: "error", status: "resolved", acknowledged: false },
    ];
    const { result } = await runCountBySeverity(rows);

    expect(result).toEqual({
      info: 0,
      warning: 1,
      error: 0,
      critical: 1,
      truncated: false,
    });
  });

  it("reports truncated: true when exactly ALERT_COUNT_SCAN_CAP rows are returned", async () => {
    const rows = makeRows(ALERT_COUNT_SCAN_CAP);
    const { result } = await runCountBySeverity(rows);

    expect(result.truncated).toBe(true);
    expect(result.warning).toBe(ALERT_COUNT_SCAN_CAP);
  });

  it("reports truncated: false when ALERT_COUNT_SCAN_CAP - 1 rows are returned (boundary, other side)", async () => {
    const rows = makeRows(ALERT_COUNT_SCAN_CAP - 1);
    const { result } = await runCountBySeverity(rows);

    expect(result.truncated).toBe(false);
    expect(result.warning).toBe(ALERT_COUNT_SCAN_CAP - 1);
  });

  it("excludes a status: resolved row from the counts even though it is unacknowledged", async () => {
    const rows = [
      { _id: "a", severity: "critical", status: "resolved", acknowledged: false },
      { _id: "b", severity: "critical", status: "active", acknowledged: false },
    ];
    const { result } = await runCountBySeverity(rows);

    expect(result.critical).toBe(1);
    expect(result.truncated).toBe(false);
  });
});
