import { describe, it, expect } from "vitest";
import { upsertAnswerSyncHandler, latestAnswerSyncHandler } from "./kg";

/**
 * Pure-logic mirrors of the `kg_summary` ingest dispatch + the upsertSummary
 * derivation (mirroring the repo's kits.test.ts style — no DB round-trip).
 */

// Mirrors the `case "kg_summary"` branch in runtimeIngest.ts.
const mapKgSummaryEvent = (d: any, fallbackTs: number) => ({
  entitiesByType: d.entitiesByType ?? d.entities_by_type ?? {},
  currentTripleCount:
    d.currentTripleCount ?? d.current_triple_count ?? d.currentTriples ?? 0,
  historicalTripleCount:
    d.historicalTripleCount ??
    d.historical_triple_count ??
    d.historicalTriples ??
    0,
  contradictionCount: d.contradictionCount ?? d.contradiction_count ?? 0,
  lastExtractionAt: d.lastExtractionAt ?? d.last_extraction_at ?? undefined,
  updatedAt: d.timestamp ?? fallbackTs,
});

// Mirrors the totalEntities derivation in convex/kg.ts upsertSummary.
const deriveTotalEntities = (entitiesByType: Record<string, number>) =>
  Object.values(entitiesByType).reduce((sum, n) => sum + n, 0);

describe("kg_summary event → upsertSummary mapping (Phase 74)", () => {
  it("maps the LIVE emitter shape (camelCase currentTripleCount etc.)", () => {
    const args = mapKgSummaryEvent(
      {
        entitiesByType: { person: 3, project: 2 },
        currentTripleCount: 10,
        historicalTripleCount: 25,
        contradictionCount: 1,
        lastExtractionAt: "2026-06-09T12:00:00+00:00",
        timestamp: 1700,
      },
      9999,
    );
    expect(args).toEqual({
      entitiesByType: { person: 3, project: 2 },
      currentTripleCount: 10,
      historicalTripleCount: 25,
      contradictionCount: 1,
      lastExtractionAt: "2026-06-09T12:00:00+00:00",
      updatedAt: 1700,
    });
  });

  it("accepts snake_case fallbacks defensively", () => {
    const args = mapKgSummaryEvent(
      {
        entities_by_type: { person: 1 },
        current_triple_count: 4,
        historical_triple_count: 8,
        contradiction_count: 2,
        last_extraction_at: "2026-01-01T00:00:00Z",
      },
      555,
    );
    expect(args.entitiesByType).toEqual({ person: 1 });
    expect(args.currentTripleCount).toBe(4);
    expect(args.historicalTripleCount).toBe(8);
    expect(args.contradictionCount).toBe(2);
    expect(args.lastExtractionAt).toBe("2026-01-01T00:00:00Z");
    expect(args.updatedAt).toBe(555);
  });

  it("defaults missing counts to 0 and entitiesByType to {}", () => {
    const args = mapKgSummaryEvent({}, 100);
    expect(args.entitiesByType).toEqual({});
    expect(args.currentTripleCount).toBe(0);
    expect(args.historicalTripleCount).toBe(0);
    expect(args.contradictionCount).toBe(0);
    expect(args.lastExtractionAt).toBeUndefined();
    expect(args.updatedAt).toBe(100);
  });

  it("stamps updatedAt from the event timestamp, falling back to now", () => {
    expect(mapKgSummaryEvent({ timestamp: 42 }, 9999).updatedAt).toBe(42);
    expect(mapKgSummaryEvent({}, 9999).updatedAt).toBe(9999);
  });
});

describe("upsertSummary — totalEntities derivation", () => {
  it("sums entitiesByType into a top-line total", () => {
    expect(deriveTotalEntities({ person: 3, project: 2, place: 5 })).toBe(10);
  });
  it("is 0 for an empty type map", () => {
    expect(deriveTotalEntities({})).toBe(0);
  });

  it.todo("should patch the single existing row on re-ingest (DB round-trip)");
  it.todo("should insert when no kgSummary row exists yet (DB round-trip)");
});

// ============================================================
// kgAnswerSync — single-row upsert (Phase 187 GLXY-01)
// ============================================================
//
// Unlike kgSummary above, these ARE DB round-trip tests — against a minimal
// fake `ctx.db` (mirrors convex/evalScores.ts's storeEvalScoreHandler
// precedent; convex-test is not installed in this repo, see
// convex/runtimeIngest.test.ts:9). upsertAnswerSyncHandler/latestAnswerSyncHandler
// are exported from convex/kg.ts specifically so they're testable this way.

function makeFakeKgAnswerSyncDb() {
  const rows: any[] = [];
  let nextId = 1;
  return {
    rows,
    query(_table: string) {
      return { first: async () => rows[0] ?? null };
    },
    patch: async (id: any, doc: any) => {
      const idx = rows.findIndex((r) => r._id === id);
      if (idx >= 0) rows[idx] = { ...rows[idx], ...doc };
    },
    insert: async (_table: string, doc: any) => {
      const id = `fake-id-${nextId++}`;
      rows.push({ _id: id, ...doc });
      return id;
    },
  };
}

describe("kgAnswerSync — answer sync single-row upsert (Phase 187 GLXY-01)", () => {
  it("inserts a new row when none exists (answer sync first upsert)", async () => {
    const db = makeFakeKgAnswerSyncDb();
    await upsertAnswerSyncHandler(
      { db },
      {
        turnId: "sess-1:1",
        sourceNodeIds: ["uuid-a"],
        primaryEntityName: "Larry",
        updatedAt: 1000,
      },
    );
    expect(db.rows.length).toBe(1);
    expect(db.rows[0].turnId).toBe("sess-1:1");
    expect(db.rows[0].sourceNodeIds).toEqual(["uuid-a"]);
    expect(db.rows[0].primaryEntityName).toBe("Larry");
    expect(db.rows[0].updatedAt).toBe(1000);
  });

  it("patches the SAME single row on a second upsert (answer sync latest-wins, no second row)", async () => {
    const db = makeFakeKgAnswerSyncDb();
    await upsertAnswerSyncHandler(
      { db },
      {
        turnId: "sess-1:1",
        sourceNodeIds: ["uuid-a"],
        primaryEntityName: "Larry",
        updatedAt: 1000,
      },
    );
    await upsertAnswerSyncHandler(
      { db },
      {
        turnId: "sess-1:2",
        sourceNodeIds: ["uuid-b", "uuid-c"],
        primaryEntityName: "Ástríðr",
        updatedAt: 2000,
      },
    );
    expect(db.rows.length).toBe(1); // still exactly one row — never accumulates
    expect(db.rows[0].turnId).toBe("sess-1:2");
    expect(db.rows[0].sourceNodeIds).toEqual(["uuid-b", "uuid-c"]);
    expect(db.rows[0].primaryEntityName).toBe("Ástríðr");
    expect(db.rows[0].updatedAt).toBe(2000);
  });

  it("latestAnswerSync returns null before any upsert (answer sync no-event state)", async () => {
    const db = makeFakeKgAnswerSyncDb();
    const latest = await latestAnswerSyncHandler({ db });
    expect(latest).toBeNull();
  });

  it("latestAnswerSync returns the latest doc after upserts (answer sync replay on open)", async () => {
    const db = makeFakeKgAnswerSyncDb();
    await upsertAnswerSyncHandler(
      { db },
      { turnId: "sess-1:1", sourceNodeIds: ["uuid-a"], updatedAt: 1000 },
    );
    await upsertAnswerSyncHandler(
      { db },
      {
        turnId: "sess-1:2",
        sourceNodeIds: ["uuid-b"],
        primaryEntityName: "Larry",
        updatedAt: 2000,
      },
    );
    const latest = await latestAnswerSyncHandler({ db });
    expect(latest.turnId).toBe("sess-1:2");
    expect(latest.sourceNodeIds).toEqual(["uuid-b"]);
    expect(latest.primaryEntityName).toBe("Larry");
  });

  it("primaryEntityName stays undefined when not provided (SC#2/name-lookup-degraded case)", async () => {
    const db = makeFakeKgAnswerSyncDb();
    await upsertAnswerSyncHandler(
      { db },
      { turnId: "sess-3:1", sourceNodeIds: ["uuid-z"], updatedAt: 3000 },
    );
    expect(db.rows[0].primaryEntityName).toBeUndefined();
  });
});

// Mirrors the `case "kg_answer_sync"` branch in runtimeIngest.ts (Phase 187 GLXY-01).
const mapKgAnswerSyncEvent = (d: any, fallbackTs: number) => ({
  turnId: d.turnId ?? "",
  sourceNodeIds: d.sourceNodeIds ?? d.source_node_ids ?? [],
  primaryEntityName: d.primaryEntityName ?? d.primary_entity_name ?? undefined,
  updatedAt: d.timestamp ?? fallbackTs,
});

describe("kg_answer_sync event -> upsertAnswerSync mapping (Phase 187 GLXY-01)", () => {
  it("maps the LIVE emitter shape (camelCase)", () => {
    const args = mapKgAnswerSyncEvent(
      {
        turnId: "sess-1:4",
        sourceNodeIds: ["uuid-a", "uuid-b"],
        primaryEntityName: "Larry",
        timestamp: 1700,
      },
      9999,
    );
    expect(args).toEqual({
      turnId: "sess-1:4",
      sourceNodeIds: ["uuid-a", "uuid-b"],
      primaryEntityName: "Larry",
      updatedAt: 1700,
    });
  });

  it("accepts the snake_case source_node_ids/primary_entity_name fallback", () => {
    const args = mapKgAnswerSyncEvent(
      {
        turnId: "sess-2:1",
        source_node_ids: ["uuid-c"],
        primary_entity_name: "Ástríðr",
      },
      555,
    );
    expect(args.sourceNodeIds).toEqual(["uuid-c"]);
    expect(args.primaryEntityName).toBe("Ástríðr");
    expect(args.updatedAt).toBe(555);
  });

  it("defaults turnId to empty string and sourceNodeIds to [] when absent (unknown/malformed payload dropped, V5)", () => {
    const args = mapKgAnswerSyncEvent({}, 100);
    expect(args.turnId).toBe("");
    expect(args.sourceNodeIds).toEqual([]);
    expect(args.primaryEntityName).toBeUndefined();
    expect(args.updatedAt).toBe(100);
  });

  it("stamps updatedAt from the event timestamp, falling back to now", () => {
    expect(mapKgAnswerSyncEvent({ timestamp: 42 }, 9999).updatedAt).toBe(42);
    expect(mapKgAnswerSyncEvent({}, 9999).updatedAt).toBe(9999);
  });

  it("ingest mapping -> upsertAnswerSyncHandler produces a single kgAnswerSync row with mapped values", async () => {
    const db = makeFakeKgAnswerSyncDb();
    const args = mapKgAnswerSyncEvent(
      {
        turnId: "sess-9:3",
        source_node_ids: ["uuid-x", "uuid-y"],
        primary_entity_name: "Project Ástríðr",
        timestamp: 4242,
        unexpectedExtraField: "should be dropped by the validated mutation",
      },
      9999,
    );
    await upsertAnswerSyncHandler({ db }, args);
    expect(db.rows.length).toBe(1);
    expect(db.rows[0]).toMatchObject({
      turnId: "sess-9:3",
      sourceNodeIds: ["uuid-x", "uuid-y"],
      primaryEntityName: "Project Ástríðr",
      updatedAt: 4242,
    });
    expect(db.rows[0].unexpectedExtraField).toBeUndefined();
  });
});
