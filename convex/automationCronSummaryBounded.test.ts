/**
 * automation:cronSummary feeds the four stat cards on `/automation`. It used to
 * read the ENTIRE `cronExecutions` table on every subscription:
 *
 *     .withIndex("by_timestamp")                                // no range
 *     .filter((q) => q.gte(q.field("timestamp"), oneHourAgo))   // POST-read
 *     .collect()
 *
 * In Convex `.filter()` runs on rows ALREADY READ — it does not bound the index
 * scan — so the hour window was applied in JS after paying for the whole table.
 * Measured live 2026-08-26: 20 rows fall in the last hour, while an unbounded
 * probe over the same table died with `SystemTimeoutError: too many system
 * operations`. That is the ~9s cold resolve 126-03 observed and left with its
 * mechanism explicitly NOT established.
 *
 * This test locks the bound in by asserting on the RECORDED query — which index,
 * and whether a range bound was pushed into it — rather than on the returned
 * counts. A surviving unbounded read returns identical counts on a small fixture,
 * so the numbers cannot tell the two apart. Only the recorded bound can.
 */
import { describe, it, expect } from "vitest";
import { cronSummary } from "./automation";

interface IndexUse {
  table: string;
  index: string;
  bounds: Array<[string, string, unknown]>;
  usedPostReadFilter: boolean;
}

function makeRecordingDb(rows: any[]) {
  const uses: IndexUse[] = [];
  return {
    uses,
    query(table: string) {
      const use: IndexUse = { table, index: "", bounds: [], usedPostReadFilter: false };
      const chain: any = {
        withIndex(index: string, cb?: (q: any) => any) {
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
        filter(_fn: unknown) {
          // A post-read filter is exactly what this test exists to forbid.
          use.usedPostReadFilter = true;
          return chain;
        },
        order() {
          return chain;
        },
        async collect() {
          uses.push(use);
          return rows;
        },
        async take(_n: number) {
          uses.push(use);
          return rows;
        },
      };
      return chain;
    },
  };
}

const NOW_SEC = Math.floor(Date.now() / 1000);

function row(overrides: Partial<any> = {}) {
  return {
    _id: "c1",
    jobName: "watch:pulse",
    timestamp: NOW_SEC - 60,
    durationMs: 100,
    success: true,
    ...overrides,
  };
}

describe("automation:cronSummary — read must be bounded at the INDEX (SWEEP-01 class)", () => {
  it("pushes a gte range on `timestamp` into by_timestamp, and does NOT rely on a post-read filter", async () => {
    const db = makeRecordingDb([row()]);
    await (cronSummary as any)._handler({ db } as any, {});

    expect(db.uses).toHaveLength(1);
    const use = db.uses[0];

    expect(use.table).toBe("cronExecutions");
    expect(use.index).toBe("by_timestamp");

    // The bound must be pushed INTO the index, which is the whole point.
    const gte = use.bounds.find((b) => b[0] === "gte" && b[1] === "timestamp");
    expect(gte).toBeDefined();

    // And the old post-read filter must be gone. This is the assertion that
    // actually fails if someone reinstates `.filter((q) => q.gte(...))`.
    expect(use.usedPostReadFilter).toBe(false);
  });

  it("the range bound is ~1 hour back, not an arbitrary or absent cutoff", async () => {
    const db = makeRecordingDb([row()]);
    await (cronSummary as any)._handler({ db } as any, {});

    const gte = db.uses[0].bounds.find((b) => b[0] === "gte" && b[1] === "timestamp")!;
    const cutoff = gte[2] as number;

    // seconds, not milliseconds — a ms cutoff would put the window in 1970 and
    // silently match every row, which is the unbounded behaviour wearing a bound.
    const expected = Date.now() / 1000 - 3600;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5);
  });

  it("still computes the summary correctly over the rows it is given (control)", async () => {
    const db = makeRecordingDb([
      row({ _id: "a", success: true, durationMs: 100 }),
      row({ _id: "b", success: false, durationMs: 300 }),
    ]);
    const out: any = await (cronSummary as any)._handler({ db } as any, {});

    // Without this, a handler that read nothing at all would satisfy the
    // bound assertions above.
    expect(out.totalRuns).toBe(2);
    expect(out.failed).toBe(1);
    expect(out.succeeded).toBe(1);
    expect(out.avgDurationMs).toBe(200);
  });
});
