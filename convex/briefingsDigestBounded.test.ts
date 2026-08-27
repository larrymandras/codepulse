/**
 * getDailyDigestDataInternal must bound every read AT THE INDEX (SWEEP-01 class).
 *
 * This one query feeds both digest consumers (`briefings.ts:404` and
 * `emailDigest.ts:213`) and carried three separate instances of the same defect:
 *
 *     .withIndex("by_status", q => q.eq("status", "completed"))   // no range
 *     .filter(q => q.gte(q.field("lastEventAt"), dayStart))       // POST-read
 *     .collect()
 *
 * In Convex `.filter()` runs on rows ALREADY READ — it does not bound the index
 * scan — so each window was applied in JS after paying for the whole slice.
 * Measured live 2026-08-27:
 *   (a) sessions        1,575 completed rows read to keep one day's worth. An
 *                       unbounded probe over this table returned
 *                       `SystemTimeoutError: too many system operations` — the
 *                       same signature the `automation.cronSummary` defect gave.
 *   (b) aggregates      half-bounded: gte was inside the index, lt was not.
 *   (c) anomalyEvents   40 rows today, but the read had NO range at all.
 *
 * The assertions below are on the RECORDED QUERY — which index, which bounds
 * were pushed into it, whether a post-read filter survived — and NOT on the
 * returned values. A surviving unbounded read returns identical digest numbers
 * on a small fixture, so the numbers cannot discriminate between the two. Only
 * the recorded bounds can. Same harness as
 * `automationCronSummaryBounded.test.ts` and `messageRoutesBounded.test.ts`.
 */
import { describe, it, expect } from "vitest";
import { getDailyDigestDataInternal } from "./briefings";

interface IndexUse {
  table: string;
  index: string;
  bounds: Array<[string, string, unknown]>;
  usedPostReadFilter: boolean;
  usedCollect: boolean;
  takeLimit: number | null;
}

function makeRecordingDb(rowsByTable: Record<string, any[]>) {
  const uses: IndexUse[] = [];
  return {
    uses,
    byTable(table: string) {
      return uses.find((u) => u.table === table)!;
    },
    query(table: string) {
      const use: IndexUse = {
        table,
        index: "",
        bounds: [],
        usedPostReadFilter: false,
        usedCollect: false,
        takeLimit: null,
      };
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
          use.usedPostReadFilter = true;
          return chain;
        },
        order() {
          return chain;
        },
        async collect() {
          use.usedCollect = true;
          uses.push(use);
          return rowsByTable[table] ?? [];
        },
        async take(n: number) {
          use.takeLimit = n;
          uses.push(use);
          return rowsByTable[table] ?? [];
        },
      };
      return chain;
    },
  };
}

const DAY_START = 1_787_700_000;
const DAY_END = DAY_START + 86400;

function runDigest(rows: Record<string, any[]> = {}) {
  const db = makeRecordingDb({
    sessions: [],
    aggregates: [],
    anomalyEvents: [],
    ideationFindings: [],
    ...rows,
  });
  return {
    db,
    result: (getDailyDigestDataInternal as any)._handler({ db } as any, {
      dayStart: DAY_START,
    }),
  };
}

/** Both bounds present on `field`, with the window's exact edges, and no
 * post-read filter left behind. */
function expectWindowedOnIndex(use: IndexUse, index: string, field: string) {
  expect(use.index).toBe(index);

  const gte = use.bounds.find((b) => b[0] === "gte" && b[1] === field);
  const lt = use.bounds.find((b) => b[0] === "lt" && b[1] === field);

  expect(gte, `no gte bound on ${field} inside ${index}`).toBeDefined();
  expect(lt, `no lt bound on ${field} inside ${index}`).toBeDefined();
  expect(gte![2]).toBe(DAY_START);
  expect(lt![2]).toBe(DAY_END);

  // The assertion that actually fails if someone reinstates the JS-side window.
  expect(use.usedPostReadFilter).toBe(false);
}

describe("getDailyDigestDataInternal — (a) sessions", () => {
  it("pushes the whole day window into by_status, with no post-read filter", async () => {
    const { db, result } = runDigest();
    await result;
    expectWindowedOnIndex(db.byTable("sessions"), "by_status", "lastEventAt");
  });

  it("still pins the status equality — the range must NARROW the index, not replace its prefix", async () => {
    // by_status is ["status","lastEventAt"]; a range on the second field is
    // only meaningful once the first is fixed. Dropping the eq would silently
    // widen the read to every session of every status.
    const { db, result } = runDigest();
    await result;

    const eq = db
      .byTable("sessions")
      .bounds.find((b) => b[0] === "eq" && b[1] === "status");
    expect(eq).toBeDefined();
    expect(eq![2]).toBe("completed");
  });
});

describe("getDailyDigestDataInternal — (b) aggregates", () => {
  it("pushes BOTH edges of the window into by_type_period_bucket", async () => {
    // This read was already half-bounded: gte was inside the index, lt was a
    // post-read filter. Half a bound still reads every bucket after dayStart.
    const { db, result } = runDigest();
    await result;
    expectWindowedOnIndex(
      db.byTable("aggregates"),
      "by_type_period_bucket",
      "bucket_start"
    );
  });

  it("keeps both equality bounds that select the cost/hourly slice", async () => {
    const { db, result } = runDigest();
    await result;

    const bounds = db.byTable("aggregates").bounds;
    expect(bounds).toContainEqual(["eq", "metric_type", "cost"]);
    expect(bounds).toContainEqual(["eq", "period", "hourly"]);
  });
});

describe("getDailyDigestDataInternal — (c) anomalyEvents", () => {
  it("reads through a detectedAt index with the window pushed in", async () => {
    // by_severity is ["severity","detectedAt"] and by_metric_detected is
    // ["metric","detectedAt"] — detectedAt is SECOND in both, so neither can
    // bound a bare time range. Ranging per severity instead was rejected:
    // `severity` is v.string(), not a union, so a future third value would
    // silently vanish from the count. Hence a dedicated by_detectedAt index.
    const { db, result } = runDigest();
    await result;
    expectWindowedOnIndex(
      db.byTable("anomalyEvents"),
      "by_detectedAt",
      "detectedAt"
    );
  });
});

describe("getDailyDigestDataInternal — units", () => {
  it("bounds in epoch SECONDS, matching the column", async () => {
    // `detectedAt`/`lastEventAt`/`bucket_start` are epoch seconds
    // (schema.ts:1279 says so outright) and dayEnd = dayStart + 86400. A
    // millisecond bound would put the window in 1970 and match nothing, which
    // reads as "no activity today" rather than as a failure.
    const { db, result } = runDigest();
    await result;

    for (const table of ["sessions", "aggregates", "anomalyEvents"]) {
      for (const [, , value] of db.byTable(table).bounds) {
        if (typeof value === "number") {
          expect(value).toBeGreaterThan(1_000_000_000);
          expect(value).toBeLessThan(100_000_000_000);
        }
      }
    }
    expect(DAY_END - DAY_START).toBe(86400);
  });
});

describe("getDailyDigestDataInternal — still returns the digest (control)", () => {
  it("computes the same shape over the rows it is given", async () => {
    // Without this, a handler that read nothing at all would satisfy every
    // bound assertion above.
    const { result } = runDigest({
      sessions: [{ _id: "s1" }, { _id: "s2" }],
      aggregates: [{ value: 1.5 }, { value: 2.25 }],
      anomalyEvents: [{ _id: "a1" }, { _id: "a2" }, { _id: "a3" }],
      ideationFindings: [{ _id: "f1" }],
    });
    const out: any = await result;

    expect(out.completedSessions).toHaveLength(2);
    expect(out.totalCost).toBeCloseTo(3.75);
    expect(out.anomalyCount).toBe(3);
    expect(out.findings).toHaveLength(1);
  });

  it("leaves the ideationFindings read take-bounded at 20", async () => {
    const { db, result } = runDigest();
    await result;

    const use = db.byTable("ideationFindings");
    expect(use.takeLimit).toBe(20);
    expect(use.usedCollect).toBe(false);
  });
});
