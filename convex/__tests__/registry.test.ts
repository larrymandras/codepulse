/**
 * convex/registry.ts had ZERO behavioral test coverage before this file
 * (adversarial gate on 113-02, defect 4) — no test in the repo imported it,
 * so mutating either D-06 gate (`if (refusals.length > 0)`, formerly at
 * registry.ts:266/:454, now centralized once inside processSkillPruneHandler)
 * to `>= 0`, or inverting the 6-hour suppression predicate inside
 * recordSkillPruneRefusals, left the full 3983-test suite green.
 *
 * `convex-test` is deliberately NOT installed in this repo (see
 * `convex/reminders.test.ts:140`); the handler-extraction + fake-db pattern
 * this file follows mirrors `convex/__tests__/galdr.test.ts`, driving
 * `processSkillPruneHandler` (which wraps `recordSkillPruneRefusals`)
 * directly against an in-memory fake `ctx.db`.
 *
 * Every assertion here reads STORED ROWS out of the fake, never source text.
 */
import { describe, it, expect } from "vitest";
import { processSkillPruneHandler } from "../registry";

// ---------------------------------------------------------------------------
// makeFakeDb — table-aware, supports the subset of the Convex db surface
// processSkillPruneHandler / recordSkillPruneRefusals actually use:
// insert, delete, and query(...).withIndex(...).order("desc").take(n).
// Adapted from convex/__tests__/galdr.test.ts:37-122.
// ---------------------------------------------------------------------------

function makeFakeDb() {
  let idCounter = 0;
  let creationCounter = 0;
  const tables = new Map<string, Map<string, any>>();

  function tableMap(name: string): Map<string, any> {
    let m = tables.get(name);
    if (!m) {
      m = new Map();
      tables.set(name, m);
    }
    return m;
  }

  function findAnyTable(id: string): Map<string, any> | null {
    for (const m of tables.values()) {
      if (m.has(id)) return m;
    }
    return null;
  }

  function makeResult(rows: any[]): {
    collect: () => Promise<any[]>;
    first: () => Promise<any | null>;
    take: (n: number) => Promise<any[]>;
    order: (direction: "asc" | "desc") => ReturnType<typeof makeResult>;
  } {
    return {
      collect: async () => rows,
      first: async () => rows[0] ?? null,
      take: async (n: number) => rows.slice(0, n),
      order(direction: "asc" | "desc") {
        const sorted = [...rows].sort((a, b) =>
          direction === "desc"
            ? b._creationTime - a._creationTime
            : a._creationTime - b._creationTime
        );
        return makeResult(sorted);
      },
    };
  }

  // Tracks every table name a .query(...) call is issued against. The D-06
  // gate mutation (`refusals.length > 0` -> `>= 0`) writes zero rows either
  // way — recordSkillPruneRefusals' own for-loop is a no-op on an empty
  // `refusals` array, so a stored-row count alone cannot distinguish the two
  // code paths. What DOES differ observably is that recordSkillPruneRefusals
  // unconditionally issues one bounded `alerts` read (the suppression-window
  // lookup) before that loop even runs — so a mutated gate that calls the
  // writer on every healthy scan issues an extra read the correct gate never
  // does. That extra read is exactly the resource cost D-06/T-113-07 exist to
  // avoid on the self-hosted, memory-pressured backend (CLAUDE.md).
  const queryCalls: string[] = [];

  return {
    tables,
    queryCalls,
    async insert(table: string, doc: Record<string, unknown>) {
      const id = `id_${idCounter++}`;
      const _creationTime = creationCounter++;
      tableMap(table).set(id, { _id: id, _creationTime, ...doc });
      return id;
    },
    async get(id: string) {
      const m = findAnyTable(id);
      return m ? m.get(id) : null;
    },
    async patch(id: string, patch: Record<string, unknown>) {
      const m = findAnyTable(id);
      if (m) m.set(id, { ...m.get(id), ...patch });
    },
    async delete(id: string) {
      const m = findAnyTable(id);
      if (m) m.delete(id);
    },
    query(table: string) {
      queryCalls.push(table);
      const list = () => Array.from(tableMap(table).values());
      return {
        collect: async () => list(),
        first: async () => list()[0] ?? null,
        withIndex(_indexName: string, cb?: (q: any) => any) {
          let filtered = list();
          if (cb) {
            const conditions: Array<[string, any]> = [];
            const qProxy = {
              eq(field: string, value: any) {
                conditions.push([field, value]);
                return qProxy;
              },
            };
            cb(qProxy);
            filtered = filtered.filter((r) =>
              conditions.every(([f, v]) => r[f] === v)
            );
          }
          return makeResult(filtered);
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Harness liveness — MUST run first, same discipline as galdr.test.ts:129-141.
// ---------------------------------------------------------------------------

describe("makeFakeDb harness liveness", () => {
  it("is table-aware and supports withIndex().order().take()", async () => {
    const db = makeFakeDb();
    await db.insert("alerts", { source: "skill-prune-guard", createdAt: 1 });
    await db.insert("alerts", { source: "other-source", createdAt: 2 });
    await db.insert("configChanges", { configKey: "skill:x" });

    const alerts = await db.query("alerts").collect();
    const configChanges = await db.query("configChanges").collect();
    expect(alerts).toHaveLength(2);
    expect(configChanges).toHaveLength(1);

    const filtered = await db
      .query("alerts")
      .withIndex("by_source", (q: any) => q.eq("source", "skill-prune-guard"))
      .order("desc")
      .take(20);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].source).toBe("skill-prune-guard");
  });
});

// ---------------------------------------------------------------------------
// D-06 — a healthy scan writes zero alert rows. Mutation target: the
// `if (refusals.length > 0)` gate inside processSkillPruneHandler (formerly
// duplicated at registry.ts:266 and :454).
// ---------------------------------------------------------------------------

describe("processSkillPruneHandler — D-06 healthy scan writes zero alert rows", () => {
  it("a fully-covered healthy scan (every existing origin declared, incoming matching) writes no alerts and prunes nothing", async () => {
    const db = makeFakeDb();
    const ctx = { db };
    const existing = [
      { _id: "s1", name: "deploy", origin: "claude-code" },
      { _id: "s2", name: "plugin-a", origin: "claude-code:plugin" },
    ];
    const incoming = [
      { name: "deploy", origin: "claude-code" },
      { name: "plugin-a", origin: "claude-code:plugin" },
    ];

    const result = await processSkillPruneHandler(
      ctx,
      existing,
      incoming,
      ["claude-code", "claude-code:plugin"], // fully declared
      true,
      "scanner",
      1000
    );

    expect(result.refusalCount).toBe(0);
    expect(result.prunedCount).toBe(0);
    // queryCalls captured BEFORE the .collect() probe below, so it reflects
    // only what processSkillPruneHandler itself issued.
    expect(db.queryCalls.filter((t) => t === "alerts")).toHaveLength(0);
    const alerts = await db.query("alerts").collect();
    expect(alerts).toEqual([]);
  });

  it("a legacy (no manifest) scan with nothing stale writes no alerts and issues no alerts-table read", async () => {
    const db = makeFakeDb();
    const ctx = { db };
    const existing = [{ _id: "s1", name: "deploy", origin: "claude-code" }];
    const incoming = [{ name: "deploy", origin: "claude-code" }];

    const result = await processSkillPruneHandler(
      ctx,
      existing,
      incoming,
      undefined,
      undefined,
      "scanner",
      1000
    );

    expect(result.refusalCount).toBe(0);
    expect(db.queryCalls.filter((t) => t === "alerts")).toHaveLength(0);
    const alerts = await db.query("alerts").collect();
    expect(alerts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D-05 — a guarded scan writes exactly one alert row with the full
// documented payload.
// ---------------------------------------------------------------------------

describe("processSkillPruneHandler — D-05 guarded scan writes one alert row with the full documented payload", () => {
  it("writes exactly one alert row: severity warning, source skill-prune-guard, status active, acknowledged false, and the documented details shape", async () => {
    const db = makeFakeDb();
    const ctx = { db };
    const existing = [
      { _id: "s1", name: "deploy", origin: "claude-code" },
      { _id: "s2", name: "plugin-a", origin: "claude-code:plugin" },
    ];
    const incoming = [
      { name: "deploy", origin: "claude-code" },
      // Decoy: puts claude-code:plugin into the incoming-origins set so the
      // additive/legacy baseline actually prunes plugin-a, making the
      // strict path's protection of it an observable refusal.
      { name: "plugin-decoy", origin: "claude-code:plugin" },
    ];

    const result = await processSkillPruneHandler(
      ctx,
      existing,
      incoming,
      ["claude-code"], // claude-code:plugin NOT declared
      true,
      "scanner",
      1000
    );

    expect(result.refusalCount).toBe(1);
    const alerts = await db.query("alerts").collect();
    expect(alerts).toHaveLength(1);
    const alert = alerts[0];
    expect(alert.severity).toBe("warning");
    expect(alert.source).toBe("skill-prune-guard");
    expect(alert.status).toBe("active");
    expect(alert.acknowledged).toBe(false);
    expect(typeof alert.message).toBe("string");
    expect(alert.details).toEqual({
      origin: "claude-code:plugin",
      protectedCount: 1,
      sampleNames: ["plugin-a"],
      changedBy: "scanner",
      declaredOrigins: ["claude-code"],
    });
  });

  it("uses the changedBy value passed through for each call site (capability_sync)", async () => {
    const db = makeFakeDb();
    const ctx = { db };
    const existing = [{ _id: "s2", name: "plugin-a", origin: "claude-code:plugin" }];
    const incoming = [{ name: "plugin-decoy", origin: "claude-code:plugin" }];

    await processSkillPruneHandler(ctx, existing, incoming, [], true, "capability_sync", 1000);

    const alerts = await db.query("alerts").collect();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].details.changedBy).toBe("capability_sync");
  });
});

// ---------------------------------------------------------------------------
// T-113-07 — 6-hour suppression window. Mutation target: the
// `a.createdAt > now - SUPPRESSION_WINDOW_SECONDS` predicate inside
// recordSkillPruneRefusals.
// ---------------------------------------------------------------------------

describe("processSkillPruneHandler — 6-hour suppression window (T-113-07)", () => {
  const SIX_HOURS = 6 * 60 * 60;
  const existing = [
    { _id: "s1", name: "deploy", origin: "claude-code" },
    { _id: "s2", name: "plugin-a", origin: "claude-code:plugin" },
  ];
  const incoming = [
    { name: "deploy", origin: "claude-code" },
    { name: "plugin-decoy", origin: "claude-code:plugin" },
  ];

  it("suppresses a second refusal for the same origin inside the window, then writes a new row once the window has elapsed", async () => {
    const db = makeFakeDb();
    const ctx = { db };

    // t=1000: first refusal, writes one alert.
    await processSkillPruneHandler(ctx, existing, incoming, ["claude-code"], true, "scanner", 1000);
    expect(await db.query("alerts").collect()).toHaveLength(1);

    // t=1000+1h: well inside the 6h window — suppressed, no new row.
    await processSkillPruneHandler(
      ctx,
      existing,
      incoming,
      ["claude-code"],
      true,
      "scanner",
      1000 + 60 * 60
    );
    expect(await db.query("alerts").collect()).toHaveLength(1);

    // t=1000+6h+1s: just past the window — NOT suppressed, writes a second row.
    await processSkillPruneHandler(
      ctx,
      existing,
      incoming,
      ["claude-code"],
      true,
      "scanner",
      1000 + SIX_HOURS + 1
    );
    expect(await db.query("alerts").collect()).toHaveLength(2);
  });

  it("does not suppress a refusal for a DIFFERENT origin inside the same window", async () => {
    const db = makeFakeDb();
    const ctx = { db };

    await processSkillPruneHandler(ctx, existing, incoming, ["claude-code"], true, "scanner", 1000);
    expect(await db.query("alerts").collect()).toHaveLength(1);

    const existingWithProject = [
      ...existing,
      { _id: "s3", name: "proj-a", origin: "claude-code:project:abc" },
    ];
    const incomingWithProjectDecoy = [
      ...incoming,
      { name: "proj-decoy", origin: "claude-code:project:abc" },
    ];

    // Same window, but a different protected origin — must not be suppressed
    // by the claude-code:plugin alert already on file.
    await processSkillPruneHandler(
      ctx,
      existingWithProject,
      incomingWithProjectDecoy,
      ["claude-code"],
      true,
      "scanner",
      1000 + 60 * 60
    );
    const alerts = await db.query("alerts").collect();
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a: any) => a.details.origin).sort()).toEqual([
      "claude-code:plugin",
      "claude-code:project:abc",
    ]);
  });
});
