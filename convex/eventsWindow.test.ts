import { describe, test, expect } from "vitest";
import { listRecentRuntimeWindow } from "./events";

// ---------------------------------------------------------------------------
// Phase 125 plan 02 — listRecentRuntimeWindow (D-05/D-17).
//
// Proves, on the REAL registered query (via the repo's `._handler` convention
// — see events.test.ts:226,234,240), that BOTH of its bounds hold
// independently: the 60s time window and the 500-row cap. Neither assertion
// alone would catch the shape this plan exists to avoid — a query that looks
// bounded because ONE constraint happens to hold while the other is silently
// absent (this is exactly how the superseded PATTERNS.md draft looked bounded
// while ending in .collect()).
//
// The fake store below is modelled on events.test.ts's makeEventsStore(), but
// is LOCAL to this file (that file's harness serves `ingest`'s point-lookup
// shape, not a range-bound-index + order + filter + take chain) and adds two
// things that harness does not have: it RECORDS which index name was passed
// to withIndex, and it implements order("desc")/filter(...)/take(n) as real
// operations rather than a no-op passthrough.
// ---------------------------------------------------------------------------

// `data` mirrors the real runtime_events schema field (v.any(), can carry a whole
// tool-argument payload) so case (c)'s projection assertion has something to
// actually catch: every seeded row below carries one, so a mapper that starts
// spreading the whole row (mutation proof 3) leaks a `data` key that the
// Object.keys check can observe. Without this, an all-projection-safe fixture
// would let that mutation pass silently.
type Row = { _id: string; eventType: string; timestamp: number; archived?: boolean; data: unknown };

function makeRuntimeEventsStore() {
  const rows: Row[] = [];
  let nextId = 0;
  let calledIndexName: string | null = null;

  function seed(row: Omit<Row, "_id">) {
    const _id = `re_${nextId++}`;
    rows.push({ _id, ...row });
    return _id;
  }

  // Minimal fake `q` object for the .filter((q) => q.neq(q.field("archived"), true))
  // idiom: field() returns a descriptor, neq() returns a predicate descriptor, and
  // the descriptor is evaluated per-row by the store rather than by Convex.
  function evalFilter(desc: any, row: Row): boolean {
    if (!desc) return true;
    if (desc.__op === "neq") return (row as any)[desc.field] !== desc.value;
    throw new Error(`unsupported filter op in fake store: ${desc.__op}`);
  }

  const db = {
    query: (table: string) => {
      if (table !== "runtime_events") {
        throw new Error(`fake store only serves "runtime_events", got "${table}"`);
      }
      return {
        withIndex: (indexName: string, fn?: (q: any) => any) => {
          calledIndexName = indexName;
          const ranges: { field: string; op: "lt" | "lte" | "gt" | "gte"; value: any }[] = [];
          if (typeof fn === "function") {
            const q: any = {
              lt: (field: string, value: any) => (ranges.push({ field, op: "lt", value }), q),
              lte: (field: string, value: any) => (ranges.push({ field, op: "lte", value }), q),
              gt: (field: string, value: any) => (ranges.push({ field, op: "gt", value }), q),
              gte: (field: string, value: any) => (ranges.push({ field, op: "gte", value }), q),
            };
            fn(q);
          }
          const matchesRange = (r: Row) =>
            ranges.every(({ field, op, value }) => {
              const v = (r as any)[field];
              return op === "lt" ? v < value : op === "lte" ? v <= value : op === "gt" ? v > value : v >= value;
            });

          return {
            order: (direction: "asc" | "desc") => ({
              filter: (filterFn: (q: any) => any) => {
                const q: any = {
                  field: (name: string) => ({ __field: name, field: name }),
                  neq: (fieldDesc: any, value: any) => ({ __op: "neq", field: fieldDesc.field, value }),
                };
                const filterDesc = filterFn(q);
                const matched = rows.filter((r) => matchesRange(r) && evalFilter(filterDesc, r));
                matched.sort((a, b) => (direction === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp));
                return {
                  take: async (n: number) => matched.slice(0, n),
                  // Real Convex semantics: unbounded -- returns everything the
                  // range/filter matched, with no row cap. Present so mutation
                  // proof (2) (.take(MAX_ROWS) -> .collect()) demonstrates the
                  // actual behavioral defect (600 rows, untruncated) rather than
                  // a TypeError that would mask it.
                  collect: async () => matched,
                };
              },
            }),
          };
        },
      };
    },
  };

  return { db, seed, getCalledIndexName: () => calledIndexName };
}

async function callHandler(store: ReturnType<typeof makeRuntimeEventsStore>, args: any = {}) {
  const ctx = { db: store.db };
  return (listRecentRuntimeWindow as any)._handler(ctx, args);
}

// Fixed "now" for deterministic seeding — matches the handler's own
// `Date.now() / 1000` convention (fractional seconds).
const NOW = 1_700_000_000;
const realDateNow = Date.now;

// NOTE: must `await fn()` inside `try` before `finally` restores Date.now --
// an async `fn` only runs synchronously up to its first `await`, so a bare
// `return fn()` lets `finally` restore the real clock before a SECOND
// sequential call inside `fn` (test (f)'s baseline/override pair) ever reads
// Date.now(). Caught by test (f) going RED with an empty result for its
// second call before this fix.
async function withFrozenNow<T>(fn: () => T | Promise<T>): Promise<T> {
  Date.now = () => NOW * 1000;
  try {
    return await fn();
  } finally {
    Date.now = realDateNow;
  }
}

function seedBoundarySet(store: ReturnType<typeof makeRuntimeEventsStore>) {
  // Every row carries a `data` payload -- see the Row type comment above for why.
  const inWindowNow = store.seed({ eventType: "command_execution", timestamp: NOW, data: { pid: 1 } });
  const inWindow10 = store.seed({ eventType: "run.blocks", timestamp: NOW - 10, data: { blocks: [] } });
  const inWindow59_5 = store.seed({ eventType: "docker_status", timestamp: NOW - 59.5, data: { status: "up" } });
  const outWindow60_5 = store.seed({ eventType: "docker_status", timestamp: NOW - 60.5, data: { status: "up" } });
  const outWindowHour = store.seed({ eventType: "health_check", timestamp: NOW - 3600, data: { ok: true } });
  const archivedInWindow = store.seed({
    eventType: "run.error",
    timestamp: NOW - 5,
    archived: true,
    data: { error: "x" },
  });
  const bogusFuture = store.seed({ eventType: "job_lifecycle", timestamp: NOW + 600, data: { jobId: "j1" } });
  return {
    inWindowNow,
    inWindow10,
    inWindow59_5,
    outWindow60_5,
    outWindowHour,
    archivedInWindow,
    bogusFuture,
  };
}

describe("listRecentRuntimeWindow — bounds, projection, and refusal to widen", () => {
  test("(a) time bound: returns exactly the in-window, non-archived rows", async () => {
    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      const ids = seedBoundarySet(store);
      const result = await callHandler(store);
      const returnedIds = result.rows.map((r: any) => r._id);

      expect(returnedIds).toContain(ids.inWindowNow);
      expect(returnedIds).toContain(ids.inWindow10);
      expect(returnedIds).toContain(ids.inWindow59_5);

      // Each excluded row asserted individually so a failure names which
      // bound broke, not just "the set was wrong".
      expect(returnedIds).not.toContain(ids.outWindow60_5);
      expect(returnedIds).not.toContain(ids.outWindowHour);
      expect(returnedIds).not.toContain(ids.bogusFuture);
      expect(returnedIds).not.toContain(ids.archivedInWindow);

      expect(result.rows).toHaveLength(3);
    });
  });

  test("(b) index: withIndex was called with the literal string by_timestamp", async () => {
    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      seedBoundarySet(store);
      await callHandler(store);
      expect(store.getCalledIndexName()).toBe("by_timestamp");
    });
  });

  test("(c) projection: every returned row has exactly _id, eventType, timestamp", async () => {
    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      seedBoundarySet(store);
      const result = await callHandler(store);
      expect(result.rows.length).toBeGreaterThan(0);
      for (const row of result.rows) {
        expect(Object.keys(row).sort()).toEqual(["_id", "eventType", "timestamp"]);
      }
    });
  });

  test("(d) row cap: 600 rows all inside the window are capped to exactly 500, truncated true", async () => {
    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      for (let i = 0; i < 600; i++) {
        store.seed({ eventType: "command_execution", timestamp: NOW - i * 0.05, data: { i } }); // all within 60s
      }
      const result = await callHandler(store);
      expect(result.rows).toHaveLength(500);
      expect(result.truncated).toBe(true);
    });
  });

  test("(e) row cap control: the small boundary seed does not report truncated", async () => {
    // This is (d)'s control: a query that always reported truncated:true would
    // pass (d) and fail here.
    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      seedBoundarySet(store);
      const result = await callHandler(store);
      expect(result.truncated).toBe(false);
    });
  });

  test("(f) refuses to widen: declared args have no windowSeconds, and a caller-supplied override is ignored", async () => {
    // Read the registered query's ACTUAL args validator via exportArgs() -- a real
    // but TypeScript-untyped runtime property Convex's query() builder attaches to
    // the returned function object -- rather than grepping source text. Same idiom
    // as governorDecisions.test.ts / controlVerbSwaps.test.ts's record-args-shape
    // blocks: never a hand-typed literal asserted against itself.
    const exportArgs = (listRecentRuntimeWindow as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    const argKeys = Object.keys(schema.value ?? {});
    expect(argKeys).not.toContain("windowSeconds");
    expect(argKeys.some((k) => /window/i.test(k))).toBe(false);
    expect(argKeys).toHaveLength(0);

    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      seedBoundarySet(store);
      const baseline = await callHandler(store, {});
      // A caller passing an oversized windowSeconds must get an IDENTICAL result
      // to the {} call -- asserting only that the default is 60 would not prove
      // a caller cannot override it.
      const withBogusArg = await callHandler(store, { windowSeconds: 100000 } as any);
      expect(withBogusArg.rows.map((r: any) => r._id)).toEqual(baseline.rows.map((r: any) => r._id));
      expect(withBogusArg.truncated).toBe(baseline.truncated);
    });
  });

  test("(g) ordering: results are newest-first", async () => {
    await withFrozenNow(async () => {
      const store = makeRuntimeEventsStore();
      seedBoundarySet(store);
      const result = await callHandler(store);
      const timestamps = result.rows.map((r: any) => r.timestamp);
      const sorted = [...timestamps].sort((a, b) => b - a);
      expect(timestamps).toEqual(sorted);
    });
  });
});

// ---------------------------------------------------------------------------
// Mutation proofs (recorded verbatim in the plan's SUMMARY, run SEPARATELY —
// each reverted before the next is attempted, per the plan's explicit
// instruction that running them together lets one bound mask the other's
// absence). These `test.skip` blocks exist so the mutated variant of the
// assertion logic is preserved in the file for future reference; the actual
// RED/GREEN runs were performed by hand-editing convex/events.ts and are
// transcribed in 125-02-SUMMARY.md.
// ---------------------------------------------------------------------------
