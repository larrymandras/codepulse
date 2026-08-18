// ---------------------------------------------------------------------------
// Fake ctx for exercising real Convex mutation/query handlers via `._handler`
// (the raw function Convex's mutation()/query() wrappers expose — see
// convex/modelPricing.test.ts's header comment; this repo has no convex-test).
// Supports just enough of ctx.db to drive computeHourly/backfillTokenSplit and
// friends: withIndex(eq/gte/gt/lte/lt), filter(neq), collect(), first(),
// take(), paginate(), and insert(). db.patch/db.delete THROW — several call
// paths built on this harness (the token-split backfill, the daily rollup
// backfill) must be insert-only (D-04 / CLAUDE.md self-hosted rules), so any
// accidental call fails the test loudly instead of silently no-op'ing.
//
// Extracted out of convex/aggregates.test.ts (Phase 121, 121-01 Task 1) into
// this plain `convex/lib/` helper module — no vitest import, no describe/test,
// no Convex query/mutation/internalMutation registration — so it can also be
// imported from convex/llm.test.ts without re-executing aggregates.test.ts's
// own describe blocks (importing one .test.ts from another would do exactly
// that).
// ---------------------------------------------------------------------------

export type FakeDoc = Record<string, any>;

export function makeAggregatesCtx(
  opts: {
    llmMetrics?: FakeDoc[];
    aggregates?: FakeDoc[];
    agentConfigs?: FakeDoc[];
    modelPricing?: FakeDoc[];
    // Phase 105 (D-04/D-06): fixtures for the tool usage buckets and the
    // tail-appended tool-policy alert evaluator. Optional and additive —
    // every pre-Phase-105 test omits these and gets an empty table, which
    // the real evaluateToolPolicyAlerts handler treats as "no events this
    // hour" (skippedNoEvents, no writes, no scheduler call).
    toolExecutions?: FakeDoc[];
    costBudgets?: FakeDoc[];
    toolPolicyEvents?: FakeDoc[];
    alerts?: FakeDoc[];
  } = {}
) {
  const tables: Record<string, FakeDoc[]> = {
    llmMetrics: [...(opts.llmMetrics ?? [])],
    aggregates: [...(opts.aggregates ?? [])],
    agentConfigs: [...(opts.agentConfigs ?? [])],
    modelPricing: [...(opts.modelPricing ?? [])],
    toolExecutions: [...(opts.toolExecutions ?? [])],
    costBudgets: [...(opts.costBudgets ?? [])],
    toolPolicyEvents: [...(opts.toolPolicyEvents ?? [])],
    alerts: [...(opts.alerts ?? [])],
  };
  let nextId = 1;
  const schedulerCalls: Array<{ delay: number; args: unknown }> = [];
  // Per-ctx paginate counter — each test builds a fresh ctx and invokes one
  // handler, so this scopes to a single function invocation the way Convex's own
  // limit does. See the throw in paginate() below.
  let paginateCalls = 0;
  const patchCalls: unknown[] = [];
  const deleteCalls: unknown[] = [];
  // Phase 121 (121-01 Task 1): records every table name passed to
  // ctx.db.query(), in call order, so a later plan can prove a handler reads
  // `aggregates` and never reads `llmMetrics` (or vice versa). Pushed
  // unconditionally, before any fixture lookup, so a query against a table
  // with no fixture is still recorded.
  const queriedTables: string[] = [];

  function query(table: string) {
    queriedTables.push(table);
    const rows = tables[table] ?? (tables[table] = []);
    const predicates: Array<(r: FakeDoc) => boolean> = [];
    let dir: "asc" | "desc" = "asc";

    const chain = {
      withIndex(_index: string, cb?: (q: any) => any) {
        if (cb) {
          const q: any = {};
          for (const op of ["eq", "gte", "gt", "lte", "lt"] as const) {
            q[op] = (field: string, value: unknown) => {
              predicates.push((r) => {
                const v = r[field];
                if (op === "eq") return v === value;
                if (op === "gte") return v >= (value as number);
                if (op === "gt") return v > (value as number);
                if (op === "lte") return v <= (value as number);
                return v < (value as number);
              });
              return q;
            };
          }
          cb(q);
        }
        return chain;
      },
      filter(cb: (q: any) => any) {
        const q = {
          field: (name: string) => ({ __field: name }),
          neq: (ref: { __field: string }, value: unknown) => {
            predicates.push((r) => r[ref.__field] !== value);
            return true;
          },
        };
        cb(q);
        return chain;
      },
      order(direction: "asc" | "desc") {
        dir = direction;
        return chain;
      },
      async collect() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        return dir === "desc" ? [...filtered].reverse() : filtered;
      },
      async first() {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered[0] ?? null;
      },
      // Bounded read used by fetchLlmRowsForWindow — same filter/order semantics
      // as collect(), capped at `n`. Unlike paginate() there is no per-invocation
      // limit on this in Convex, which is exactly why it is the right shape for a
      // helper called once per hour inside a loop.
      async take(n: number) {
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const ordered = dir === "desc" ? [...filtered].reverse() : filtered;
        return ordered.slice(0, n);
      },
      async paginate({ numItems, cursor }: { numItems: number; cursor: string | null }) {
        // Convex allows exactly ONE paginated query per function invocation and
        // throws on the second. This mock previously allowed unlimited calls,
        // which let two real multi-paginate bugs (backfillTokenSplit's per-hour
        // cursor loop, and computeHourly's latent one) pass 34 green tests and
        // then fail on the first live invocation at Phase 104's deploy gate.
        // Enforce the real constraint so the suite can catch it. (2026-07-31)
        paginateCalls++;
        if (paginateCalls > 1) {
          throw new Error(
            "This query or mutation function ran multiple paginated queries. Convex only supports a single paginated query in each function."
          );
        }
        const filtered = rows.filter((r) => predicates.every((p) => p(r)));
        const start = cursor ? Number(cursor) : 0;
        const page = filtered.slice(start, start + numItems);
        const isDone = start + numItems >= filtered.length;
        return { page, isDone, continueCursor: String(start + numItems) };
      },
    };
    return chain;
  }

  const db = {
    query,
    async insert(table: string, doc: FakeDoc) {
      const row = { ...doc, _id: `${table}_${nextId}`, _creationTime: nextId };
      nextId++;
      (tables[table] ?? (tables[table] = [])).push(row);
      return row._id;
    },
    patch(...args: unknown[]) {
      patchCalls.push(args);
      throw new Error("db.patch must not be called — the token-split path is insert-only");
    },
    delete(...args: unknown[]) {
      deleteCalls.push(args);
      throw new Error("db.delete must not be called — the token-split path is insert-only");
    },
  };

  const scheduler = {
    async runAfter(delay: number, _fn: unknown, args: unknown) {
      schedulerCalls.push({ delay, args });
    },
  };

  return { ctx: { db, scheduler }, tables, patchCalls, deleteCalls, schedulerCalls, queriedTables };
}
