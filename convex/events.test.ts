import { describe, test, expect } from "vitest";
import { ingest, listRecent, LIST_RECENT_MAX_LIMIT } from "./events";

// ---------------------------------------------------------------------------
// Phase 107 Wave-0 — events.ingest shard contract.
//
// Proves, on the REAL registered mutation (via the repo's `._handler`
// convention — see aggregates.test.ts:25-33/536), that one `events.ingest`
// call draws exactly ONE shard and shares it across all three aggregate
// writes (one "events" bucket + two "sankey_edge" edges). This is the
// behavioral form of "drawn once per ingest and passed explicitly" — NOT a
// grep on the source text of events.ts (verification-discipline: assert the
// observable outcome, not a proxy).
//
// Tests 1 and 2 are RED until plan 107-03 lands the shard field on written
// aggregate rows. Test 3 (dedup) is unaffected by sharding and must be GREEN
// now.
//
// The fake ctx below is modeled on analyticsRollup.test.ts's makeStore(), but
// kept LOCAL to this file rather than shared — the two harnesses serve
// different callers and coupling them makes both harder to change.
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

function makeEventsStore() {
  const events: Row[] = [];
  const aggregates: Row[] = [];
  let nextId = 0;

  const tableOf = (name: string) => (name === "events" ? events : aggregates);

  const db = {
    query: (table: string) => ({
      // Phase 107 plan 07: honours the index constraints.
      //
      // This previously ignored both the index name and the filter callback,
      // so `first()` returned the table's first row whatever was asked for.
      // That was always wrong; it was merely harmless while the write path
      // used .collect() plus a JS .find(), which re-did the matching itself.
      // Once plan 107-07 narrowed the lookup to a point query, `first()` began
      // handing back an unrelated row and the ingest patched it instead of
      // inserting — so the bug surfaced as two failures here. Modelled on the
      // constraint-applying fakes this repo already uses in forge.test.ts,
      // swarmTasks.test.ts, subagentJobs.test.ts, warRoom.test.ts and
      // v6Mutations.test.ts.
      withIndex: (_name: string, fn?: (q: any) => any) => {
        const eqs: Record<string, unknown> = {};
        const ranges: { field: string; op: "lt" | "lte" | "gt" | "gte"; value: any }[] = [];
        if (typeof fn === "function") {
          const q: any = {
            eq: (field: string, value: unknown) => {
              eqs[field] = value;
              return q;
            },
            lt: (field: string, value: any) => (ranges.push({ field, op: "lt", value }), q),
            lte: (field: string, value: any) => (ranges.push({ field, op: "lte", value }), q),
            gt: (field: string, value: any) => (ranges.push({ field, op: "gt", value }), q),
            gte: (field: string, value: any) => (ranges.push({ field, op: "gte", value }), q),
          };
          fn(q);
        }
        const matches = (r: Row) =>
          Object.entries(eqs).every(([field, value]) => r[field] === value) &&
          ranges.every(({ field, op, value }) =>
            op === "lt"
              ? r[field] < value
              : op === "lte"
                ? r[field] <= value
                : op === "gt"
                  ? r[field] > value
                  : r[field] >= value
          );
        const scan = () => tableOf(table).filter(matches);
        return {
          collect: async () => scan(),
          first: async () => scan()[0] ?? null,
          unique: async () => {
            const rows = scan();
            if (rows.length > 1) throw new Error("unique() matched multiple rows");
            return rows[0] ?? null;
          },
          take: async (n: number) => scan().slice(0, n),
        };
      },
    }),
    insert: async (table: string, data: Row) => {
      const _id = String(nextId++);
      tableOf(table).push({ ...data, _id });
      return _id;
    },
    patch: async (id: string, data: Row) => {
      for (const t of [events, aggregates]) {
        const idx = t.findIndex((r) => r._id === id);
        if (idx >= 0) Object.assign(t[idx], data);
      }
    },
  };

  return { events, aggregates, db };
}

const AGGREGATE_SHARD_COUNT = 8;

describe("events.ingest — shard contract", () => {
  test("one ingest call writes three aggregate rows sharing one shard", async () => {
    const store = makeEventsStore();
    const ctx = { db: store.db };

    await (ingest as any)._handler(ctx, {
      sessionId: "s1",
      eventType: "tool_use",
      toolName: "Read",
      payload: {},
      timestamp: 1_700_000_000,
    });

    expect(store.events).toHaveLength(1);
    expect(store.aggregates).toHaveLength(3);

    const eventRows = store.aggregates.filter((r) => r.metric_type === "events");
    const sankeyRows = store.aggregates.filter((r) => r.metric_type === "sankey_edge");
    expect(eventRows).toHaveLength(1);
    expect(sankeyRows).toHaveLength(2);

    // All three rows must agree on ONE shard value — proves one draw was
    // made and passed down, not three independent draws. Do NOT settle for
    // asserting the source text of events.ts; assert the observable outcome.
    const shards = new Set(store.aggregates.map((r) => r.shard));
    expect(shards.size).toBe(1);
    const shard = [...shards][0];
    expect(Number.isInteger(shard)).toBe(true);
    expect(shard).toBeGreaterThanOrEqual(0);
    expect(shard).toBeLessThan(AGGREGATE_SHARD_COUNT);
  });

  test("shard varies across ingest calls", async () => {
    // Fresh store per call so each call's three rows can be inspected in
    // isolation before folding into the cross-call distinct-value check.
    const perCallShards: number[] = [];
    for (let i = 0; i < 20; i++) {
      const store = makeEventsStore();
      const ctx = { db: store.db };
      await (ingest as any)._handler(ctx, {
        sessionId: `s${i}`,
        eventType: "tool_use",
        toolName: "Read",
        payload: {},
        timestamp: 1_700_000_000,
      });

      const shards = new Set(store.aggregates.map((r) => r.shard));
      expect(shards.size).toBe(1);
      const shard = [...shards][0];
      expect(Number.isInteger(shard)).toBe(true);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(AGGREGATE_SHARD_COUNT);
      perCallShards.push(shard);
    }

    // A constant shard would pass the previous test and is exactly what this
    // catches. Flake risk is (1/8)^19 — effectively zero. Do NOT tighten this
    // into a distribution assertion, which would be genuinely flaky.
    const distinct = new Set(perCallShards);
    expect(distinct.size).toBeGreaterThan(1);
  });

  test("a deduplicated ingest writes no event and no aggregate rows", async () => {
    const store = makeEventsStore();
    const ctx = { db: store.db };
    const args = {
      sessionId: "s1",
      eventType: "tool_use",
      toolName: "Read",
      payload: {},
      timestamp: 1_700_000_000,
      idempotencyKey: "dedup-key",
    };

    await (ingest as any)._handler(ctx, args);
    await (ingest as any)._handler(ctx, args);

    // The second call short-circuited before any write — pins the ordering
    // constraint that the shard draw and the aggregate writes both sit AFTER
    // the dedup early return.
    expect(store.events).toHaveLength(1);
    expect(store.aggregates).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// events.listRecent read-cap clamp (Phase 107 follow-up).
//
// Convex enforces a 16,777,216-byte per-execution read cap. `events` rows carry
// payloads, so this query is bytes-bound, not row-bound: limit:1000 measured
// 13,492,918 bytes (80% of the cap) on live data, and 107-04 recorded that
// limit:5000 exceeds it and throws. The clamp turns an over-large ad-hoc
// request into a working read instead of a failure.
//
// Asserted on the observable — how many rows the take() actually asked for —
// rather than on the constant, so a future edit that raises the ceiling but
// forgets to apply it is caught.
// ---------------------------------------------------------------------------
describe("events.listRecent — read-cap clamp", () => {
  function makeTakeSpy() {
    const takeCalls: number[] = [];
    const db = {
      query: () => ({
        withIndex: () => ({
          order: () => ({
            filter: () => ({
              take: async (n: number) => {
                takeCalls.push(n);
                return [];
              },
            }),
          }),
        }),
      }),
    };
    return { takeCalls, ctx: { db } as any };
  }

  test("an over-large limit is clamped to LIST_RECENT_MAX_LIMIT", async () => {
    const { takeCalls, ctx } = makeTakeSpy();
    await (listRecent as any)._handler(ctx, { limit: 5000 });
    expect(takeCalls).toEqual([LIST_RECENT_MAX_LIMIT]);
    // 5000 is not merely "reduced" — it is the exact value 107-04 saw throw.
    expect(takeCalls[0]).toBeLessThan(5000);
  });

  test("a limit under the ceiling is passed through untouched", async () => {
    const { takeCalls, ctx } = makeTakeSpy();
    await (listRecent as any)._handler(ctx, { limit: 25 });
    expect(takeCalls).toEqual([25]);
  });

  test("the default (no limit supplied) is unchanged at 50", async () => {
    const { takeCalls, ctx } = makeTakeSpy();
    await (listRecent as any)._handler(ctx, {});
    expect(takeCalls).toEqual([50]);
  });
});
