/**
 * Phase 197 (MISSION-05) — convex/missions.ts unit tests.
 *
 * Mirrors subagentJobs.test.ts's plain-vitest in-memory db mock (convex-test
 * is not installed in this repo), with one deliberate and important
 * difference: subagentJobs.test.ts re-declares a COPY of the handler
 * (`upsertLogic`) and asserts against the copy, so it cannot falsify the real
 * mutation. These tests drive the REAL registered mutations and queries
 * through `._handler` — the same original function Convex stores on the
 * registered object (node_modules/convex/dist/esm/server/impl/
 * registration_impl.js: `func._handler = handler`), which is also how
 * runtimeIngest.test.ts:1073-1094 drives the real httpAction. Deleting a
 * behaviour from convex/missions.ts therefore turns these red.
 *
 * The D-02 forbidden-field test reads the mutation's ACTUAL args validator via
 * `exportArgs()` (the same runtime API `npx convex deploy` reads to build its
 * manifest, precedent: controlVerbSwaps.test.ts:36-50) rather than grepping
 * the source — a source grep is satisfiable by renaming a comment, and this
 * repo's CLAUDE.md records three separate executors doing exactly that.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getFunctionName } from "convex/server";
import * as missions from "./missions";
import { api, internal } from "./_generated/api";
import {
  resolveMissionProjectionEvent,
  resolveMissionProjectionEventRow,
  runtimeIngest,
} from "./runtimeIngest";

type Doc = Record<string, any> & { _id: string };

/**
 * Index key columns, modelled after the real schema so `withIndex` returns
 * rows in INDEX order rather than insertion order (real Convex orders an
 * index scan by its key columns; a mock that returned insertion order would
 * make an ordering assertion vacuous — it would pass for any implementation
 * that happened to insert in order). The map is not free-floating: the
 * "index definitions match the schema" test below reads convex/schema.ts and
 * fails if either declaration changes shape, so the model cannot silently
 * drift from the authority it claims to mirror.
 */
const INDEX_KEYS: Record<string, string[]> = {
  by_missionId: ["missionId"],
  by_missionId_seq: ["missionId", "seq"],
  by_status: ["status", "startedAt"],
};

/** Captures a chained `q.eq("a", 1).eq("b", 2)` index range callback. */
function captureEqs(fn: (q: any) => any): Array<{ field: string; value: any }> {
  const captured: Array<{ field: string; value: any }> = [];
  const q: any = {
    eq: (field: string, value: any) => {
      captured.push({ field, value });
      return q;
    },
  };
  fn(q);
  return captured;
}

interface RecordedRead {
  table: string;
  index?: string;
  eqs: Array<{ field: string; value: any }>;
  op: "first" | "take" | "collect";
  limit?: number;
  order?: string;
}

function makeStore() {
  const tables: Record<string, Doc[]> = { missionRuns: [], missionRunEvents: [] };
  /** Every read the handlers actually issued. A bounded-read guard must assert
   * on the RECORDED QUERY, never on the returned rows — a surviving
   * `.collect()` returns identical results on a small fixture, so results
   * cannot discriminate (this repo's CLAUDE.md, and alertsCountBounded.test.ts
   * / bifrostListBounded.test.ts). */
  const reads: RecordedRead[] = [];
  let idCounter = 0;
  const nextId = () => `id_${++idCounter}`;

  function chain(
    tableName: string,
    indexName: string | undefined,
    eqs: Array<{ field: string; value: any }>,
    order?: string
  ) {
    const resolveRows = () => {
      let rows = (tables[tableName] ?? []).filter((r) =>
        eqs.every((e) => r[e.field] === e.value)
      );
      const keys = indexName ? INDEX_KEYS[indexName] : undefined;
      if (keys) {
        rows = [...rows].sort((a, b) => {
          for (const k of keys) {
            if (a[k] === b[k]) continue;
            return a[k] < b[k] ? -1 : 1;
          }
          return a._creationOrder - b._creationOrder;
        });
      } else {
        rows = [...rows].sort((a, b) => a._creationOrder - b._creationOrder);
      }
      if (order === "desc") rows.reverse();
      return rows;
    };

    return {
      order: (o: string) => chain(tableName, indexName, eqs, o),
      first: async () => {
        reads.push({ table: tableName, index: indexName, eqs, op: "first", order });
        return resolveRows()[0] ?? null;
      },
      take: async (n: number) => {
        reads.push({ table: tableName, index: indexName, eqs, op: "take", limit: n, order });
        return resolveRows().slice(0, n);
      },
      collect: async () => {
        reads.push({ table: tableName, index: indexName, eqs, op: "collect", order });
        return resolveRows();
      },
    };
  }

  const db = {
    query: (tableName: string) => ({
      withIndex: (indexName: string, indexFn?: (q: any) => any) =>
        chain(tableName, indexName, indexFn ? captureEqs(indexFn) : []),
      ...chain(tableName, undefined, []),
    }),
    insert: async (tableName: string, data: Record<string, any>) => {
      const doc = { ...data, _id: nextId(), _creationOrder: idCounter } as Doc;
      (tables[tableName] ??= []).push(doc);
      return doc._id;
    },
    patch: async (id: string, data: Record<string, any>) => {
      for (const rows of Object.values(tables)) {
        const idx = rows.findIndex((r) => r._id === id);
        if (idx !== -1) {
          Object.assign(rows[idx], data);
          return;
        }
      }
      throw new Error(`patch: no document ${id}`);
    },
  };

  return { tables, reads, ctx: { db } };
}

/** Drives a real registered Convex function's original handler. */
function run(fn: unknown, ctx: any, args: any) {
  return (fn as { _handler: (ctx: any, args: any) => Promise<any> })._handler(ctx, args);
}

const baseMission = {
  missionId: "m-1",
  status: "running",
  missionClass: "subscription-reaper",
};

// ---------------------------------------------------------------------------
// upsert
// ---------------------------------------------------------------------------

describe("missions.upsert", () => {
  it("inserts a new row on the first push for a missionId", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, startedAt: 1000 });

    expect(store.tables.missionRuns).toHaveLength(1);
    expect(store.tables.missionRuns[0].missionId).toBe("m-1");
    expect(store.tables.missionRuns[0].status).toBe("running");
    expect(store.tables.missionRuns[0].missionClass).toBe("subscription-reaper");
    expect(typeof store.tables.missionRuns[0].updatedAt).toBe("number");
  });

  it("patches the same row on a second push — no duplicate", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, startedAt: 1000 });
    await run(missions.upsert, store.ctx, { ...baseMission, status: "completed", finishedAt: 1100 });

    expect(store.tables.missionRuns).toHaveLength(1);
    expect(store.tables.missionRuns[0].status).toBe("completed");
    expect(store.tables.missionRuns[0].finishedAt).toBe(1100);
    // startedAt was absent on the second push and must survive.
    expect(store.tables.missionRuns[0].startedAt).toBe(1000);
  });

  it("two different missionIds produce two rows (control: the upsert is keyed, not global)", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, missionId: "m-a" });
    await run(missions.upsert, store.ctx, { ...baseMission, missionId: "m-b" });
    expect(store.tables.missionRuns).toHaveLength(2);
  });

  it("a partial token-tick push does NOT null previously-set fields (D-20 coalesce)", async () => {
    const store = makeStore();
    // Both pushes are NON-terminal, so this test isolates the coalesce and does
    // not silently depend on the terminal-monotonicity guard below.
    await run(missions.upsert, store.ctx, {
      ...baseMission,
      status: "running",
      totalCostUsd: 0.0528,
      contained: true,
      offeredEscapes: ["Bash"],
      startedAt: 1000,
    });
    // The shape a D-20 token tick actually pushes: identity + status + tokens.
    await run(missions.upsert, store.ctx, {
      missionId: "m-1",
      status: "running",
      missionClass: "subscription-reaper",
      promptTokens: 1234,
    });

    const row = store.tables.missionRuns[0];
    expect(row.status).toBe("running");
    expect(row.promptTokens).toBe(1234);
    expect(row.totalCostUsd).toBe(0.0528);
    expect(row.contained).toBe(true);
    expect(row.offeredEscapes).toEqual(["Bash"]);
    expect(row.startedAt).toBe(1000);
  });

  it("an explicit contained:false OVERWRITES a prior true — a real escape is not swallowed by the coalesce", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, contained: true });
    await run(missions.upsert, store.ctx, { ...baseMission, contained: false });
    expect(store.tables.missionRuns[0].contained).toBe(false);
  });
});

describe("missions.upsert — tri-state containment (D-04)", () => {
  it("undefined / false / true round-trip as THREE distinct stored values", async () => {
    const outcomes: Array<unknown> = [];
    for (const [id, contained] of [
      ["m-void", undefined],
      ["m-escaped", false],
      ["m-clean", true],
    ] as const) {
      const store = makeStore();
      await run(missions.upsert, store.ctx, { ...baseMission, missionId: id, contained });
      outcomes.push(store.tables.missionRuns[0].contained);
    }

    const [voidState, escaped, clean] = outcomes;
    expect(voidState).toBeUndefined();
    expect(escaped).toBe(false);
    expect(clean).toBe(true);
    // The load-bearing half: the three must not collapse into two. A plain
    // v.boolean() (or a `?? false` default anywhere on the path) would make
    // the VOID case equal the ESCAPED case and this set would size 2.
    expect(new Set(outcomes.map((o) => String(o))).size).toBe(3);
  });

  it("a VOID row is distinguishable from a contained row after a later partial push", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, missionId: "m-void" });
    await run(missions.upsert, store.ctx, {
      missionId: "m-void",
      status: "completed",
      missionClass: "subscription-reaper",
    });
    expect(store.tables.missionRuns[0].contained).toBeUndefined();
    expect("contained" in store.tables.missionRuns[0]).toBe(true); // stored as an explicit absent, not a missing key by accident
  });
});

// ---------------------------------------------------------------------------
// appendEvent
// ---------------------------------------------------------------------------

async function seedMission(store: ReturnType<typeof makeStore>, missionId = "m-1") {
  await run(missions.upsert, store.ctx, { ...baseMission, missionId, startedAt: 1000 });
}

describe("missions.appendEvent", () => {
  it("inserts events and eventsForMission returns them ordered by seq", async () => {
    const store = makeStore();
    await seedMission(store);
    // Deliberately inserted OUT of seq order so the assertion tests ordering,
    // not insertion order.
    for (const seq of [3, 1, 2]) {
      await run(missions.appendEvent, store.ctx, {
        missionId: "m-1",
        seq,
        eventType: "tool_call",
        occurredAt: 1000 + seq,
      });
    }

    const rows = await run(missions.eventsForMission, store.ctx, { missionId: "m-1" });
    expect(rows.map((r: Doc) => r.seq)).toEqual([1, 2, 3]);
  });

  it("scopes to one mission — another mission's events are not returned", async () => {
    const store = makeStore();
    await seedMission(store, "m-1");
    await seedMission(store, "m-2");
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 1, eventType: "tool_call", occurredAt: 1001,
    });
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-2", seq: 1, eventType: "tool_call", occurredAt: 1002,
    });

    const rows = await run(missions.eventsForMission, store.ctx, { missionId: "m-1" });
    expect(rows).toHaveLength(1);
    expect(rows[0].missionId).toBe("m-1");
  });

  it("TWO calls with the same (missionId, seq) leave exactly ONE row (telemetry retry)", async () => {
    const store = makeStore();
    await seedMission(store);
    const evt = {
      missionId: "m-1",
      seq: 7,
      eventType: "tool_call",
      occurredAt: 1007,
      toolNames: ["Read"],
    };
    await run(missions.appendEvent, store.ctx, evt);
    await run(missions.appendEvent, store.ctx, evt);

    expect(store.tables.missionRunEvents).toHaveLength(1);
  });

  it("CONTROL: two calls at DIFFERENT seq leave exactly TWO rows — the dedup discriminates, it does not swallow every insert", async () => {
    const store = makeStore();
    await seedMission(store);
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 7, eventType: "tool_call", occurredAt: 1007,
    });
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 8, eventType: "tool_call", occurredAt: 1008,
    });

    expect(store.tables.missionRunEvents).toHaveLength(2);
  });

  it("CONTROL: the same seq under a DIFFERENT missionId is a distinct event, not a duplicate", async () => {
    const store = makeStore();
    await seedMission(store, "m-1");
    await seedMission(store, "m-2");
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 7, eventType: "tool_call", occurredAt: 1007,
    });
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-2", seq: 7, eventType: "tool_call", occurredAt: 1007,
    });

    expect(store.tables.missionRunEvents).toHaveLength(2);
  });

  it("moves the parent row's lastEventAt on a genuine insert", async () => {
    const store = makeStore();
    await seedMission(store);
    expect(store.tables.missionRuns[0].lastEventAt).toBeUndefined();

    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 1, eventType: "tool_call", occurredAt: 1500,
    });
    expect(store.tables.missionRuns[0].lastEventAt).toBe(1500);
  });

  it("the IGNORED duplicate does NOT move lastEventAt — a delivery retry cannot make a stalled mission look alive", async () => {
    const store = makeStore();
    await seedMission(store);
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 1, eventType: "tool_call", occurredAt: 1500,
    });
    // A retry of the SAME (missionId, seq) whose occurredAt has drifted later.
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 1, eventType: "tool_call", occurredAt: 9999,
    });

    expect(store.tables.missionRunEvents).toHaveLength(1);
    expect(store.tables.missionRuns[0].lastEventAt).toBe(1500);
  });

  it("an event for a mission row that does not exist yet still stores the event and does not throw", async () => {
    const store = makeStore();
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-orphan", seq: 1, eventType: "tool_call", occurredAt: 1500,
    });
    expect(store.tables.missionRunEvents).toHaveLength(1);
    expect(store.tables.missionRuns).toHaveLength(0);
  });

  it("reads the (missionId, seq) index before writing — the dedup is an index lookup, not a scan", async () => {
    const store = makeStore();
    await seedMission(store);
    store.reads.length = 0;
    await run(missions.appendEvent, store.ctx, {
      missionId: "m-1", seq: 4, eventType: "tool_call", occurredAt: 1004,
    });

    const dedupRead = store.reads.find((r) => r.table === "missionRunEvents");
    expect(dedupRead).toBeDefined();
    expect(dedupRead!.index).toBe("by_missionId_seq");
    expect(dedupRead!.eqs.map((e) => e.field)).toEqual(["missionId", "seq"]);
    expect(dedupRead!.op).toBe("first");
    // CONTROL: nothing in this file's read path collects a whole table.
    expect(store.reads.some((r) => r.op === "collect")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// queries
// ---------------------------------------------------------------------------

describe("missions.byId", () => {
  it("returns the row for a missionId and null for one that does not exist", async () => {
    const store = makeStore();
    await seedMission(store, "m-a");
    await seedMission(store, "m-b");

    const hit = await run(missions.byId, store.ctx, { missionId: "m-a" });
    expect(hit?.missionId).toBe("m-a");

    const miss = await run(missions.byId, store.ctx, { missionId: "nope" });
    expect(miss).toBeNull();
  });
});

describe("missions.listRecent", () => {
  it("returns at most `limit` rows and bounds the READ, not just the result", async () => {
    const store = makeStore();
    for (let i = 0; i < 12; i++) await seedMission(store, `m-${i}`);
    store.reads.length = 0;

    const rows = await run(missions.listRecent, store.ctx, { limit: 5 });
    expect(rows).toHaveLength(5);

    const read = store.reads.find((r) => r.table === "missionRuns");
    expect(read).toBeDefined();
    expect(read!.op).toBe("take");
    expect(read!.limit).toBe(5);
    // The load-bearing half: a surviving `.collect()` would return the same 5
    // rows after a JS slice, so only the recorded read discriminates.
    expect(store.reads.some((r) => r.op === "collect")).toBe(false);
  });

  it("falls back to the exported DEFAULT_RECENT_LIMIT, not a literal duplicated in this test", async () => {
    const store = makeStore();
    await seedMission(store);
    store.reads.length = 0;
    await run(missions.listRecent, store.ctx, {});

    expect(store.reads[0].limit).toBe(missions.DEFAULT_RECENT_LIMIT);
  });

  it("returns newest-first", async () => {
    const store = makeStore();
    await seedMission(store, "m-old");
    await seedMission(store, "m-new");
    const rows = await run(missions.listRecent, store.ctx, {});
    expect(rows[0].missionId).toBe("m-new");
  });
});

describe("missions.eventsForMission", () => {
  it("bounds its read with take() and defaults to the exported DEFAULT_EVENTS_LIMIT", async () => {
    const store = makeStore();
    await seedMission(store);
    for (let i = 1; i <= 6; i++) {
      await run(missions.appendEvent, store.ctx, {
        missionId: "m-1", seq: i, eventType: "tool_call", occurredAt: 1000 + i,
      });
    }
    store.reads.length = 0;

    const limited = await run(missions.eventsForMission, store.ctx, { missionId: "m-1", limit: 2 });
    expect(limited).toHaveLength(2);
    expect(store.reads[0].op).toBe("take");
    expect(store.reads[0].limit).toBe(2);
    expect(store.reads[0].index).toBe("by_missionId_seq");

    store.reads.length = 0;
    await run(missions.eventsForMission, store.ctx, { missionId: "m-1" });
    expect(store.reads[0].limit).toBe(missions.DEFAULT_EVENTS_LIMIT);
  });
});


/** The four terminal statuses, read off the module under test rather than
 * re-typed here, so a change to the real set drives these cases. */
const TERMINAL_FIXTURE = missions.TERMINAL_STATUSES.map((s) => [s] as const);

// ---------------------------------------------------------------------------
// F2 — terminal state is monotonic
// ---------------------------------------------------------------------------

describe("missions.upsert — terminal state is monotonic (F2)", () => {
  it("a late RUNNING tick after `completed` is ignored WHOLE — status, cost and containment all survive", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, {
      ...baseMission,
      status: "completed",
      finishedAt: 1100,
      totalCostUsd: 0.0528,
      promptTokens: 9000,
      contained: true,
    });

    const outcome = await run(missions.upsert, store.ctx, {
      missionId: "m-1",
      status: "running",
      missionClass: "subscription-reaper",
      promptTokens: 1234,
    });

    const row = store.tables.missionRuns[0];
    // The assertion the previous version of the coalesce test was missing.
    expect(row.status).toBe("completed");
    // The tick's RUNNING totals are lower than the terminal ones by
    // construction, so applying them would regress the numbers too.
    expect(row.promptTokens).toBe(9000);
    expect(row.totalCostUsd).toBe(0.0528);
    expect(row.contained).toBe(true);
    expect(row.finishedAt).toBe(1100);
    expect(outcome).toBe("ignored_stale_after_terminal");
  });

  it.each(TERMINAL_FIXTURE)(
    "a non-terminal push after %s is ignored",
    async (terminalStatus) => {
      const store = makeStore();
      await run(missions.upsert, store.ctx, { ...baseMission, status: terminalStatus });
      await run(missions.upsert, store.ctx, { ...baseMission, status: "running" });
      expect(store.tables.missionRuns[0].status).toBe(terminalStatus);
    }
  );

  it("CONTROL: terminal -> terminal IS allowed — a corrected completed -> failed is a real late correction, not a regression", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, status: "completed" });
    const outcome = await run(missions.upsert, store.ctx, {
      ...baseMission,
      status: "failed",
      finishedAt: 1200,
    });
    expect(store.tables.missionRuns[0].status).toBe("failed");
    expect(store.tables.missionRuns[0].finishedAt).toBe(1200);
    expect(outcome).toBe("patched");
  });

  it("CONTROL: every non-terminal transition still lands, so the guard discriminates rather than freezing the row", async () => {
    const store = makeStore();
    await run(missions.upsert, store.ctx, { ...baseMission, status: "queued" });
    for (const next of ["running", "awaiting_approval", "running", "completed"]) {
      await run(missions.upsert, store.ctx, { ...baseMission, status: next });
      expect(store.tables.missionRuns[0].status).toBe(next);
    }
  });

  it("the terminal set is exactly the four non-live statuses of the Postgres CHECK constraint", () => {
    // Derived from the authority rather than re-typed: the seven statuses the
    // migration allows, minus the three the boot sweep treats as still live
    // (`supabase/migrations/20260824210500_create_missions.sql:22-23,52`).
    const ALL = [
      "queued",
      "running",
      "awaiting_approval",
      "completed",
      "failed",
      "expired",
      "cancelled",
    ];
    const LIVE = ["queued", "running", "awaiting_approval"];
    expect([...missions.TERMINAL_STATUSES].sort()).toEqual(
      ALL.filter((s) => !LIVE.includes(s)).sort()
    );
    // CONTROL: the two sets are not trivially equal.
    expect(missions.TERMINAL_STATUSES).not.toContain("running");
  });
});

// ---------------------------------------------------------------------------
// F3 — a caller-supplied limit cannot widen the read
// ---------------------------------------------------------------------------

describe("missions.listRecent / eventsForMission — the limit is clamped (F3)", () => {
  async function recordListRecent(limit: unknown) {
    const store = makeStore();
    await seedMission(store);
    store.reads.length = 0;
    await run(missions.listRecent, store.ctx, { limit });
    return store.reads[0].limit;
  }

  it("an oversized limit is clamped to MAX_RECENT_LIMIT, not honoured", async () => {
    expect(await recordListRecent(1_000_000)).toBe(missions.MAX_RECENT_LIMIT);
    // CONTROL: a limit UNDER the ceiling is honoured verbatim, so the clamp is
    // a clamp and not a constant.
    expect(await recordListRecent(7)).toBe(7);
  });

  it("zero, negative and fractional limits are coerced to a finite positive integer", async () => {
    expect(await recordListRecent(0)).toBe(1);
    expect(await recordListRecent(-5)).toBe(1);
    expect(await recordListRecent(2.7)).toBe(2);
  });

  it("non-finite limits fall back to the default rather than reaching take()", async () => {
    expect(await recordListRecent(Number.NaN)).toBe(missions.DEFAULT_RECENT_LIMIT);
    expect(await recordListRecent(Number.POSITIVE_INFINITY)).toBe(missions.DEFAULT_RECENT_LIMIT);
  });

  it("every recorded limit is a finite positive integer no larger than the ceiling", async () => {
    for (const requested of [undefined, 0, -5, 2.7, 7, 1_000_000, Number.NaN, Number.POSITIVE_INFINITY]) {
      const recorded = await recordListRecent(requested);
      expect(Number.isInteger(recorded)).toBe(true);
      expect(recorded).toBeGreaterThan(0);
      expect(recorded).toBeLessThanOrEqual(missions.MAX_RECENT_LIMIT);
    }
  });

  it("eventsForMission clamps to MAX_EVENTS_LIMIT the same way", async () => {
    const store = makeStore();
    await seedMission(store);
    store.reads.length = 0;
    await run(missions.eventsForMission, store.ctx, { missionId: "m-1", limit: 1_000_000 });
    expect(store.reads[0].limit).toBe(missions.MAX_EVENTS_LIMIT);

    store.reads.length = 0;
    await run(missions.eventsForMission, store.ctx, { missionId: "m-1", limit: -3 });
    expect(store.reads[0].limit).toBe(1);
  });

  it("the ceilings are at least the defaults — otherwise the default itself would be clamped away", () => {
    expect(missions.MAX_RECENT_LIMIT).toBeGreaterThanOrEqual(missions.DEFAULT_RECENT_LIMIT);
    expect(missions.MAX_EVENTS_LIMIT).toBeGreaterThanOrEqual(missions.DEFAULT_EVENTS_LIMIT);
  });
});

// ---------------------------------------------------------------------------
// F1 — the two writes are NOT public
// ---------------------------------------------------------------------------

describe("F1 — upsert and appendEvent are internal, not public", () => {
  it("both writes carry isInternal and NOT isPublic", () => {
    for (const [name, fn] of [
      ["upsert", missions.upsert],
      ["appendEvent", missions.appendEvent],
    ] as const) {
      const f = fn as unknown as { isInternal?: boolean; isPublic?: boolean; isMutation?: boolean };
      expect(f.isMutation, `${name} must still be a mutation`).toBe(true);
      expect(f.isInternal, `${name} must be internalMutation`).toBe(true);
      expect(f.isPublic, `${name} must NOT be public`).toBeUndefined();
    }
  });

  it("CONTROL: the three READ functions ARE public, so the flags above are a real reading and not the only value this probe can return", () => {
    for (const [name, fn] of [
      ["byId", missions.byId],
      ["listRecent", missions.listRecent],
      ["eventsForMission", missions.eventsForMission],
    ] as const) {
      const f = fn as unknown as { isInternal?: boolean; isPublic?: boolean; isQuery?: boolean };
      expect(f.isQuery, `${name} must be a query`).toBe(true);
      expect(f.isPublic, `${name} is D-05 ungated and stays public`).toBe(true);
      expect(f.isInternal, `${name} must not be internal`).toBeUndefined();
    }
  });

  it("no PUBLIC api reference is generated for either write — the generated api surface exposes reads only", () => {
    // convex/_generated/api.d.ts builds `api` from
    // FilterApi<typeof fullApi, FunctionReference<any, "public">>, so an
    // internalMutation is absent from `api.missions.*` BY TYPE. `api` is a
    // runtime proxy that answers to any name, so the type surface is the real
    // authority here and tsc is the enforcement: reverting either function to
    // `mutation(` makes runtimeIngest.ts's `internal.missions.*` call sites
    // fail to compile, and reverting the CALL SITES to `api.missions.*` fails
    // to compile against the internal declaration. This test pins the runtime
    // half that tsc cannot see.
    const generated = readFileSync(resolve(process.cwd(), "convex/missions.ts"), "utf-8");
    const declarations = generated.match(/^export const (\w+) = (\w+)\(/gm) ?? [];
    expect(declarations).toContain("export const upsert = internalMutation(");
    expect(declarations).toContain("export const appendEvent = internalMutation(");
    // CONTROL: the same read finds the public queries, so a regex that matched
    // nothing would be caught instead of passing vacuously.
    expect(declarations).toContain("export const byId = query(");
    expect(declarations).not.toContain("export const upsert = mutation(");
  });

  it("runtimeIngest reaches both writes through internal.*, never api.*", () => {
    const ingest = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
    const calls = ingest.match(/ctx\.runMutation\((api|internal)\.missions\.(\w+)/g) ?? [];
    expect(calls.length).toBe(2); // control: the probe found the call sites at all
    for (const call of calls) expect(call).toContain("internal.missions.");
    expect(ingest).not.toContain("ctx.runMutation(api.missions.");
  });
});

// ---------------------------------------------------------------------------
// D-02 field boundary — read from the live args validators, not the source text
// ---------------------------------------------------------------------------

/** The six Postgres columns D-02 forbids, plus the three result-bearing names
 * 197-02-PLAN's `<interfaces>` block adds. */
const FORBIDDEN_ARG_NAMES = [
  "brief",
  "draftResult",
  "executeResult",
  "workingDir",
  "sessionId",
  "chatId",
  "resultText",
  "output",
  "taskSnippet",
];

function argKeys(fn: unknown): string[] {
  const exportArgs = (fn as { exportArgs: () => string }).exportArgs;
  return Object.keys(JSON.parse(exportArgs()).value);
}

describe("D-02 field boundary — the projection cannot carry mission content", () => {
  it("CONTROL: the args validators are readable and non-empty (a probe that read nothing would pass every assertion below vacuously)", () => {
    const upsertKeys = argKeys(missions.upsert);
    const appendKeys = argKeys(missions.appendEvent);

    expect(upsertKeys.length).toBeGreaterThan(0);
    expect(upsertKeys).toContain("missionId");
    expect(appendKeys.length).toBeGreaterThan(0);
    expect(appendKeys).toContain("missionId");
    expect(appendKeys).toContain("seq");
  });

  it("upsert declares NO forbidden argument", () => {
    const keys = argKeys(missions.upsert);
    for (const forbidden of FORBIDDEN_ARG_NAMES) {
      expect(keys, `upsert must not accept "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("appendEvent declares NO forbidden argument", () => {
    const keys = argKeys(missions.appendEvent);
    for (const forbidden of FORBIDDEN_ARG_NAMES) {
      expect(keys, `appendEvent must not accept "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("contained is declared OPTIONAL on both mutations — a required boolean would collapse the VOID state", () => {
    const upsertArgs = JSON.parse((missions.upsert as any).exportArgs()).value;
    const appendArgs = JSON.parse((missions.appendEvent as any).exportArgs()).value;
    expect(upsertArgs.contained.optional).toBe(true);
    expect(upsertArgs.contained.fieldType.type).toBe("boolean");
    expect(appendArgs.contained.optional).toBe(true);
    expect(appendArgs.contained.fieldType.type).toBe("boolean");
    // CONTROL: a genuinely required field reads false, so `optional: true`
    // above is a real reading and not the only value this probe can return.
    expect(upsertArgs.missionId.optional).toBe(false);
  });
});

describe("schema index declarations back the mock's index model", () => {
  it("declares by_missionId and by_missionId_seq with exactly the key columns INDEX_KEYS assumes", () => {
    const schema = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf-8");
    for (const [name, keys] of Object.entries(INDEX_KEYS)) {
      const declaration = `.index("${name}", [${keys.map((k) => `"${k}"`).join(", ")}])`;
      expect(schema, `schema.ts must declare ${declaration}`).toContain(declaration);
    }
    // CONTROL: a declaration this repo does NOT have must be absent, so
    // `toContain` is not trivially satisfied by the file merely being large.
    expect(schema).not.toContain('.index("by_missionId_seq", ["seq", "missionId"])');
  });
});

// ---------------------------------------------------------------------------
// Ingest rejection — an unroutable event mutates nothing, observably
// ---------------------------------------------------------------------------

describe("resolveMissionProjectionEvent / resolveMissionProjectionEventRow — the identifier rule", () => {
  it("rejects an absent, empty or non-string missionId", () => {
    expect(resolveMissionProjectionEvent({ status: "running" })).toBeNull();
    expect(resolveMissionProjectionEvent({ mission_id: "", status: "running" })).toBeNull();
    expect(resolveMissionProjectionEvent({ mission_id: 42, status: "running" })).toBeNull();
    expect(resolveMissionProjectionEvent({ missionId: null })).toBeNull();
  });

  it("CONTROL: a well-formed payload resolves, so the rejections above are about the identifier and not a resolver that refuses everything", () => {
    const resolved = resolveMissionProjectionEvent({
      mission_id: "m-1",
      status: "running",
      mission_class: "subscription-reaper",
      prompt_tokens: 10,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.missionId).toBe("m-1");
    expect(resolved!.missionClass).toBe("subscription-reaper");
    expect(resolved!.promptTokens).toBe(10);
  });

  it("never forwards a key outside the wire contract — a telemetry-injected session_id cannot ride along", () => {
    const resolved = resolveMissionProjectionEvent({
      mission_id: "m-1",
      status: "running",
      mission_class: "subscription-reaper",
      // ConvexHandler.send() injects this into every payload after the
      // emitter builds it; D-02 forbids it reaching the projection.
      session_id: "sess-should-not-land",
      brief: "cancel my subscriptions",
      execute_result: "{...}",
    });
    expect(resolved).not.toBeNull();
    for (const forbidden of ["session_id", "sessionId", "brief", "execute_result", "executeResult"]) {
      expect(Object.keys(resolved!)).not.toContain(forbidden);
    }
    expect(JSON.stringify(resolved)).not.toContain("sess-should-not-land");
    expect(JSON.stringify(resolved)).not.toContain("cancel my subscriptions");
  });

  it("preserves tri-state contained through the resolver — absent stays absent", () => {
    const voidRun = resolveMissionProjectionEvent({ mission_id: "m", status: "s", mission_class: "c" });
    const escaped = resolveMissionProjectionEvent({ mission_id: "m", status: "s", mission_class: "c", contained: false });
    const clean = resolveMissionProjectionEvent({ mission_id: "m", status: "s", mission_class: "c", contained: true });
    expect(voidRun!.contained).toBeUndefined();
    expect(escaped!.contained).toBe(false);
    expect(clean!.contained).toBe(true);
  });

  it("rejects an event with a missing or non-numeric seq — seq is half the dedup identity", () => {
    const ok = { mission_id: "m-1", event_type: "tool_call", occurred_at: 1000 };
    expect(resolveMissionProjectionEventRow({ ...ok, seq: 1 }, 999)).not.toBeNull(); // control
    expect(resolveMissionProjectionEventRow(ok, 999)).toBeNull();
    expect(resolveMissionProjectionEventRow({ ...ok, seq: "1" }, 999)).toBeNull();
    expect(resolveMissionProjectionEventRow({ ...ok, seq: NaN }, 999)).toBeNull();
    expect(resolveMissionProjectionEventRow({ ...ok, seq: 1, mission_id: "" }, 999)).toBeNull();
  });
});

function ingestRequest(events: any[]) {
  return new Request("http://localhost/runtime-ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer test-key" },
    body: JSON.stringify({ events }),
  });
}

/**
 * A ctx whose runMutation routes the two mission functions into the REAL
 * handlers against the in-memory store, so the assertion "nothing was written"
 * is made against actual table contents rather than a mock call count.
 * Everything else (events.insertEvent) is a no-op.
 */
function makeIngestCtx(store: ReturnType<typeof makeStore>) {
  const runMutation = vi.fn(async (ref: any, args: any) => {
    const name = getFunctionName(ref);
    if (name === getFunctionName(internal.missions.upsert)) return run(missions.upsert, store.ctx, args);
    if (name === getFunctionName(internal.missions.appendEvent))
      return run(missions.appendEvent, store.ctx, args);
    return undefined;
  });
  return { runMutation };
}

describe("runtimeIngest mission cases — an unroutable event mutates nothing and is counted", () => {
  it.each([
    ["missionId absent", {}],
    ["missionId empty string", { mission_id: "" }],
    ["missionId non-string", { mission_id: 1234 }],
  ])("mission_projection with %s: writes no row, increments `skipped`, and warns", async (_label, badData) => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = makeStore();
    const ctx = makeIngestCtx(store);

    const res = await (runtimeIngest as any)._handler(
      ctx,
      ingestRequest([{ eventType: "mission_projection", data: { ...badData, status: "completed" } }])
    );
    const body = JSON.parse(await res.text());

    expect(res.status).toBe(200);
    expect(body.skipped).toBe(1);
    expect(body.dropped).toBe(0);
    expect(store.tables.missionRuns).toHaveLength(0);
    expect(store.tables.missionRunEvents).toHaveLength(0);
    // Only the always-run events.insertEvent landed.
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.map((c) => c.join(" ")).join("\n")).toContain("mission_projection");

    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("mission_projection_event with a missing seq: writes no row, increments `skipped`, and warns", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = makeStore();
    const ctx = makeIngestCtx(store);

    const res = await (runtimeIngest as any)._handler(
      ctx,
      ingestRequest([
        { eventType: "mission_projection_event", data: { mission_id: "m-1", event_type: "tool_call" } },
      ])
    );
    const body = JSON.parse(await res.text());

    expect(body.skipped).toBe(1);
    expect(store.tables.missionRunEvents).toHaveLength(0);
    expect(ctx.runMutation).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls.map((c) => c.join(" ")).join("\n")).toContain("mission_projection_event");

    warn.mockRestore();
    vi.unstubAllEnvs();
  });

  it("CONTROL: a well-formed pair lands a row and an event, with skipped 0 — the counter is real, not hardcoded to fire", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const store = makeStore();
    const ctx = makeIngestCtx(store);

    const res = await (runtimeIngest as any)._handler(
      ctx,
      ingestRequest([
        {
          eventType: "mission_projection",
          data: {
            mission_id: "m-live",
            status: "running",
            mission_class: "subscription-reaper",
            started_at: 1000,
            prompt_tokens: 500,
            session_id: "sess-should-not-land",
          },
        },
        {
          eventType: "mission_projection_event",
          data: {
            mission_id: "m-live",
            seq: 1,
            event_type: "tool_call",
            occurred_at: 1005,
            tool_names: ["Read"],
            contained: true,
          },
        },
      ])
    );
    const body = JSON.parse(await res.text());

    expect(res.status).toBe(200);
    expect(body.skipped).toBe(0);
    expect(body.dropped).toBe(0);
    expect(store.tables.missionRuns).toHaveLength(1);
    expect(store.tables.missionRunEvents).toHaveLength(1);
    expect(store.tables.missionRuns[0].promptTokens).toBe(500);
    expect(store.tables.missionRuns[0].lastEventAt).toBe(1005);
    expect(store.tables.missionRunEvents[0].toolNames).toEqual(["Read"]);
    // D-02 at the wire: the injected session_id never reached the row.
    expect(JSON.stringify(store.tables.missionRuns[0])).not.toContain("sess-should-not-land");

    vi.unstubAllEnvs();
  });

  it("a re-POSTed identical event (telemetry retry) leaves one row and does not move lastEventAt", async () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const store = makeStore();
    const ctx = makeIngestCtx(store);
    const batch = [
      {
        eventType: "mission_projection",
        data: { mission_id: "m-r", status: "running", mission_class: "subscription-reaper" },
      },
      {
        eventType: "mission_projection_event",
        data: { mission_id: "m-r", seq: 1, event_type: "tool_call", occurred_at: 1005 },
      },
    ];

    await (runtimeIngest as any)._handler(ctx, ingestRequest(batch));
    await (runtimeIngest as any)._handler(ctx, ingestRequest(batch));

    expect(store.tables.missionRunEvents).toHaveLength(1);
    expect(store.tables.missionRuns).toHaveLength(1);
    expect(store.tables.missionRuns[0].lastEventAt).toBe(1005);

    vi.unstubAllEnvs();
  });
});
