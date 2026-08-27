/**
 * messageRoutes:channelSummary feeds the Message Routing section on /settings.
 *
 * It aggregates a 14-day window over an append-only table, which is exactly the
 * shape that invites the SWEEP-01 defect:
 *
 *     .withIndex("by_timestamp")                            // no range
 *     .filter((q) => q.gte(q.field("timestamp"), cutoff))   // POST-read
 *     .collect()
 *
 * In Convex `.filter()` runs on rows ALREADY READ — it does not bound the index
 * scan — so the window would be applied in JS after paying for the whole table.
 * That is the live defect fixed in `automation.cronSummary` and still open at
 * `convex/briefings.ts:181-190`; this test exists so the message-route axis
 * never joins that list.
 *
 * The assertions are on the RECORDED QUERY — which index, whether a range bound
 * was pushed into it, whether a post-read filter was used — and NOT on the
 * returned aggregates. A surviving unbounded read returns identical aggregates
 * on a small fixture, so the numbers cannot discriminate between the two. Only
 * the recorded bound can. (Recording-db harness copied from
 * `automationCronSummaryBounded.test.ts`, this repo's guard pattern.)
 */
import { describe, it, expect } from "vitest";
import {
  channelSummary,
  MESSAGE_ROUTE_SUMMARY_CAP,
  MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS,
  MESSAGE_ROUTE_CLOCK_SKEW_SECONDS,
} from "./messageRoutes";

interface IndexUse {
  table: string;
  index: string;
  bounds: Array<[string, string, unknown]>;
  usedPostReadFilter: boolean;
  takeLimit: number | null;
  usedCollect: boolean;
}

function makeRecordingDb(rows: any[]) {
  const uses: IndexUse[] = [];
  return {
    uses,
    query(table: string) {
      const use: IndexUse = {
        table,
        index: "",
        bounds: [],
        usedPostReadFilter: false,
        takeLimit: null,
        usedCollect: false,
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
          // A post-read filter is exactly what this test exists to forbid.
          use.usedPostReadFilter = true;
          return chain;
        },
        order() {
          return chain;
        },
        async collect() {
          use.usedCollect = true;
          uses.push(use);
          return rows;
        },
        async take(n: number) {
          use.takeLimit = n;
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
    _id: "m1",
    channel: "telegram",
    profile: "personal",
    sender: "5550101234",
    sessionId: "291d96b5-f068-4e4a-aa46-1953df4b8925",
    timestamp: NOW_SEC - 60,
    ...overrides,
  };
}

describe("messageRoutes:channelSummary — read must be bounded at the INDEX (SWEEP-01 class)", () => {
  it("pushes a gte range on `timestamp` into by_timestamp, and does NOT rely on a post-read filter", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    expect(db.uses).toHaveLength(1);
    const use = db.uses[0];

    expect(use.table).toBe("messageRoutes");
    expect(use.index).toBe("by_timestamp");

    // The bound must be pushed INTO the index, which is the whole point.
    const gte = use.bounds.find((b) => b[0] === "gte" && b[1] === "timestamp");
    expect(gte).toBeDefined();

    // And a post-read filter must never appear. This is the assertion that
    // actually fails if someone "adds a window" with `.filter((q) => q.gte(...))`.
    expect(use.usedPostReadFilter).toBe(false);
  });

  it("bounds the row count too — .take(MESSAGE_ROUTE_SUMMARY_CAP), never .collect()", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    const use = db.uses[0];
    expect(use.usedCollect).toBe(false);
    expect(use.takeLimit).toBe(MESSAGE_ROUTE_SUMMARY_CAP);
  });

  it("the range bound is the 14-day window back, in SECONDS not milliseconds", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    const gte = db.uses[0].bounds.find(
      (b) => b[0] === "gte" && b[1] === "timestamp"
    )!;
    const cutoff = gte[2] as number;

    // `messageRoutes.timestamp` is epoch SECONDS (schema.ts:2337; the sibling
    // GovernorDecisionLog multiplies by 1000 to render). A millisecond cutoff
    // would put the window in 1970 and silently match every row — the
    // unbounded behaviour wearing a bound.
    const expected =
      Date.now() / 1000 - MESSAGE_ROUTE_SUMMARY_WINDOW_DAYS * 86400;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5);

    // Explicit seconds-vs-ms control: the cutoff must be a plausible epoch
    // SECONDS value for "about now", not an epoch-millis magnitude.
    expect(cutoff).toBeGreaterThan(1_600_000_000);
    expect(cutoff).toBeLessThan(100_000_000_000);
  });

  // ----------------------------------------------------------------
  // Upper bound. A lower-bound-only range on a DESCENDING scan lets any row
  // with a future or epoch-MILLISECOND timestamp sort ahead of every real row
  // and stay there permanently — it is always newer than the cutoff, so it
  // never falls out of the window. `runtimeIngest.ts:630` takes the timestamp
  // straight from the payload (`evt.timestamp ?? now`) behind nothing stronger
  // than `v.float64()`, so an emitter that sends millis — the exact confusion
  // this repo already has a standing lesson about — poisons the aggregate:
  // the junk row occupies the top of the scan, inflates `total`, and clamps
  // into the newest daily bucket. Enough of them evict all real activity from
  // the cap. `events.ts:203` already carries this bound for this exact reason
  // ("Upper bound excludes any future/ms-scale junk rows").
  // ----------------------------------------------------------------
  it("also pushes an lte upper bound into the index, excluding future and ms-scale junk rows", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    const lte = db.uses[0].bounds.find(
      (b) => b[0] === "lte" && b[1] === "timestamp"
    );
    expect(lte).toBeDefined();
  });

  it("the upper bound allows a bounded clock skew rather than cutting off at exactly now", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    const lte = db.uses[0].bounds.find(
      (b) => b[0] === "lte" && b[1] === "timestamp"
    )!;
    const ceiling = lte[2] as number;

    const expected = Date.now() / 1000 + MESSAGE_ROUTE_CLOCK_SKEW_SECONDS;
    expect(Math.abs(ceiling - expected)).toBeLessThan(5);

    // The skew must be a real allowance, not zero — a row stamped a few
    // seconds ahead by a skewed emitter clock is legitimate traffic.
    expect(MESSAGE_ROUTE_CLOCK_SKEW_SECONDS).toBeGreaterThan(0);
  });

  it("an epoch-MILLISECOND timestamp falls outside the upper bound", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    const lte = db.uses[0].bounds.find(
      (b) => b[0] === "lte" && b[1] === "timestamp"
    )!;
    const ceiling = lte[2] as number;

    // This is the whole point of the bound: a row stamped in millis is ~1000x
    // the seconds value and must not be readable.
    const msScaleTimestamp = Date.now();
    expect(msScaleTimestamp).toBeGreaterThan(ceiling);
  });

  it("the two bounds bracket a real row (control — bounds that excluded everything would also pass the assertions above)", async () => {
    const db = makeRecordingDb([row()]);
    await (channelSummary as any)._handler({ db } as any, {});

    const bounds = db.uses[0].bounds;
    const lo = bounds.find((b) => b[0] === "gte")![2] as number;
    const hi = bounds.find((b) => b[0] === "lte")![2] as number;
    const legitimate = Math.floor(Date.now() / 1000) - 60;

    expect(lo).toBeLessThan(hi);
    expect(legitimate).toBeGreaterThan(lo);
    expect(legitimate).toBeLessThan(hi);
  });

  it("still aggregates over the rows it is given (control — a handler that read nothing would satisfy the bounds above)", async () => {
    const db = makeRecordingDb([
      row({ _id: "a", channel: "telegram" }),
      row({ _id: "b", channel: "whatsapp", sender: "99887766554433@lid" }),
    ]);
    const out: any = await (channelSummary as any)._handler({ db } as any, {});

    expect(out.total).toBe(2);
    expect(out.channels.map((c: any) => c.channel).sort()).toEqual([
      "telegram",
      "whatsapp",
    ]);
  });
});
