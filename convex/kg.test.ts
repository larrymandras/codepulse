import { describe, it, expect } from "vitest";

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
