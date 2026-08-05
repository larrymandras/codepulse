import { describe, test, expect } from "vitest";
import { ingest } from "./events";

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
      withIndex: (_name: string, _fn?: any) => ({
        collect: async () => tableOf(table).slice(),
        first: async () => tableOf(table)[0] ?? null,
      }),
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
