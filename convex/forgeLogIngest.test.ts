/**
 * Tests for convex/forgeLogIngest.ts — HTTP action behavior (Phase 81).
 *
 * Tests the bearer auth logic, body validation, and response shape by
 * exercising validateForgeIngestAuth() (pure, testable) and simulating
 * the forgeLogIngest handler's dispatch logic — mirroring forgeIngest.test.ts.
 *
 * SC#1: valid key + {type:'log', hostId, forgeJobId, lines, seq} → 200 {ok:true}
 * SC#1: bad/missing key → 401
 * SC#1: missing/malformed fields → 400
 */

import { describe, it, expect, vi } from "vitest";
import { validateForgeIngestAuth } from "./ingestAuth";

// ---------------------------------------------------------------------------
// Auth gate tests (mirrors forgeIngest.test.ts — updated URLs to /forge-log-ingest)
// ---------------------------------------------------------------------------

describe("forgeLogIngest auth — validateForgeIngestAuth (SC#1)", () => {
  it("rejects request without Authorization header when key is set", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-log-ingest", { method: "POST" });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("rejects request with wrong API key", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-log-ingest", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("accepts request with correct API key", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-log-ingest", {
      method: "POST",
      headers: { Authorization: "Bearer forge-key-abc" },
    });
    expect(validateForgeIngestAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("fails closed when no FORGE_INGEST_API_KEY configured and no anon opt-in", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "");
    const req = new Request("http://localhost/forge-log-ingest", { method: "POST" });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("allows unauthenticated ingest only with explicit FORGE_INGEST_ALLOW_ANON=true", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "");
    vi.stubEnv("FORGE_INGEST_ALLOW_ANON", "true");
    const req = new Request("http://localhost/forge-log-ingest", { method: "POST" });
    expect(validateForgeIngestAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects malformed Bearer token (no Bearer prefix)", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-log-ingest", {
      method: "POST",
      headers: { Authorization: "forge-key-abc" }, // Missing "Bearer " prefix
    });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("does not share its gate with the Astridr key", () => {
    // ASTRIDR key set, FORGE key absent, no anon opt-in → forge auth must NOT
    // borrow the Astridr key; it fails closed on its own gate.
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "astridr-key");
    vi.stubEnv("FORGE_INGEST_API_KEY", "");
    const req = new Request("http://localhost/forge-log-ingest", {
      method: "POST",
      // No Authorization header
    });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// Body validation logic — mirrors forgeLogIngest handler dispatch
// ---------------------------------------------------------------------------

type DispatchResult =
  | { status: 200; body: { ok: true } }
  | { status: 400; body: { error: string } };

/**
 * Pure extraction of the forgeLogIngest body-validation and dispatch decision,
 * without requiring the Convex httpAction runtime.
 */
function simulateForgeLogIngestDispatch(body: any): DispatchResult {
  if (!body || typeof body !== "object") {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, lines, seq" } };
  }

  const { type, hostId, forgeJobId, lines, seq } = body;

  if (type !== "log" || !hostId || !forgeJobId || !Array.isArray(lines) || seq == null) {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, lines, seq" } };
  }

  return { status: 200, body: { ok: true } };
}

describe("forgeLogIngest body validation (SC#1)", () => {
  const samplePayload = {
    type:       "log",
    hostId:     "desktop-abc",
    forgeJobId: "01JXMQ00000000000000000001",
    lines:      ["[INFO] Starting job", "[INFO] Running step 1"],
    seq:        0,
  };

  it("returns 200 for valid log payload (SC#1)", () => {
    const result = simulateForgeLogIngestDispatch(samplePayload);
    expect(result.status).toBe(200);
    expect((result.body as any).ok).toBe(true);
  });

  it("returns 200 for valid payload with optional sentAt", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      sentAt: "2024-06-01T12:00:00.000Z",
    });
    expect(result.status).toBe(200);
    expect((result.body as any).ok).toBe(true);
  });

  it("returns 200 for empty lines array (valid edge case)", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      lines: [],
    });
    expect(result.status).toBe(200);
  });

  it("returns 400 when body is not an object (SC#1 malformed)", () => {
    const result = simulateForgeLogIngestDispatch("not-an-object");
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("returns 400 when type is not 'log' (SC#1 malformed)", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      type: "job",
    });
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("returns 400 when hostId is missing", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      hostId: undefined,
    });
    expect(result.status).toBe(400);
  });

  it("returns 400 when forgeJobId is missing", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      forgeJobId: undefined,
    });
    expect(result.status).toBe(400);
  });

  it("returns 400 when lines is not an array", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      lines: "not-an-array",
    });
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("returns 400 when seq is null (D-1 REQUIRED)", () => {
    const result = simulateForgeLogIngestDispatch({
      ...samplePayload,
      seq: null,
    });
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("returns 400 when seq is undefined (D-1 REQUIRED)", () => {
    const result = simulateForgeLogIngestDispatch({
      type:       "log",
      hostId:     "desktop-abc",
      forgeJobId: "01JXMQ00000000000000000001",
      lines:      [],
      // seq omitted
    });
    expect(result.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Wire envelope shape — verifies the Phase 81 contract (SC#1)
// ---------------------------------------------------------------------------

describe("forgeLogIngest wire envelope — Phase 81 field contract", () => {
  it("log envelope has all 5 required fields (type, hostId, forgeJobId, lines, seq)", () => {
    const envelope = {
      type:       "log",
      hostId:     "desktop-abc",
      forgeJobId: "01JXMQ00000000000000000001",
      lines:      ["line one"],
      seq:        0,
    };
    const requiredFields = ["type", "hostId", "forgeJobId", "lines", "seq"];
    for (const field of requiredFields) {
      expect(envelope).toHaveProperty(field);
    }
  });

  it("type field is exactly 'log' (not 'job' or other types)", () => {
    const envelope = {
      type:       "log" as const,
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      lines:      [],
      seq:        1,
    };
    expect(envelope.type).toBe("log");
  });

  it("seq is a number (D-1 monotonic ordering + idempotency)", () => {
    const envelopes = [
      { seq: 0 },
      { seq: 1 },
      { seq: 42 },
    ];
    for (const e of envelopes) {
      expect(typeof e.seq).toBe("number");
    }
  });

  it("seq=0 is a valid first chunk (not falsy-coerced to missing)", () => {
    // seq==null check correctly rejects null/undefined but NOT 0.
    const result = simulateForgeLogIngestDispatch({
      type:       "log",
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      lines:      ["first line"],
      seq:        0,
    });
    expect(result.status).toBe(200);
  });

  it("sentAt is optional (not required by D-1 contract)", () => {
    // Without sentAt → still valid
    const withoutSentAt = simulateForgeLogIngestDispatch({
      type:       "log",
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      lines:      [],
      seq:        1,
    });
    expect(withoutSentAt.status).toBe(200);

    // With sentAt → also valid
    const withSentAt = simulateForgeLogIngestDispatch({
      type:       "log",
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      lines:      [],
      seq:        1,
      sentAt:     "2024-06-01T12:00:00.000Z",
    });
    expect(withSentAt.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DB round-trip stubs (integration tests deferred — no Convex runtime in unit test)
// ---------------------------------------------------------------------------

describe("forgeLogIngest — DB round-trip (integration)", () => {
  it.todo("valid key + {type:'log', hostId, forgeJobId, lines, seq} → 200 + forgeLogChunks row inserted (SC#1)");
  it.todo("bad/missing key → 401 (SC#1)");
  it.todo("missing fields → 400 (SC#1)");
  it.todo("repeat (hostId, forgeJobId, seq) → no-op / 200 (D-1 idempotent) (SC#1)");
});

// ---------------------------------------------------------------------------
// Retention sweep — pure decision logic (SC#3, D-2)
//
// sweepForgeLogChunks enforces:
//   (1) TTL: delete chunks with _creationTime < Date.now() - SEVEN_DAYS_MS
//   (2) Per-job byte cap: after TTL, drop oldest chunks (ascending seq) for any
//       job whose total line bytes exceed LOG_BYTE_CAP_PER_JOB (~1 MB).
//
// These tests exercise the pure helper functions exported from forge.ts so we
// can verify the decision logic without a live Convex DB.
// ---------------------------------------------------------------------------

import {
  chunkByteSize,
  selectTtlDeletes,
  selectCapDeletes,
} from "./forge";

describe("retention sweep — pure helpers (SC#3 / D-2)", () => {
  // -------------------------------------------------------------------------
  // chunkByteSize — byte accounting (sum of line.length across chunk.lines)
  // -------------------------------------------------------------------------

  describe("chunkByteSize", () => {
    it("returns 0 for empty lines array", () => {
      expect(chunkByteSize({ lines: [] })).toBe(0);
    });

    it("returns total character count across all lines", () => {
      expect(chunkByteSize({ lines: ["abc", "de"] })).toBe(5); // 3 + 2
    });

    it("handles a single line", () => {
      expect(chunkByteSize({ lines: ["hello world"] })).toBe(11);
    });
  });

  // -------------------------------------------------------------------------
  // selectTtlDeletes — TTL pass
  // -------------------------------------------------------------------------

  describe("selectTtlDeletes", () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = 1_700_000_000_000;

    const oldChunk = {
      _id: "id-old" as any,
      _creationTime: now - SEVEN_DAYS_MS - 1,  // 1ms past the TTL boundary
      lines: ["old line"],
    };
    const borderChunk = {
      _id: "id-border" as any,
      _creationTime: now - SEVEN_DAYS_MS,       // exactly at the boundary — survives
      lines: ["border line"],
    };
    const newChunk = {
      _id: "id-new" as any,
      _creationTime: now - 1_000,               // 1 second ago — clearly survives
      lines: ["new line"],
    };

    it("selects chunks older than 7 days for deletion", () => {
      const toDelete = selectTtlDeletes([oldChunk, borderChunk, newChunk], now);
      expect(toDelete.map((c) => c._id)).toEqual(["id-old"]);
    });

    it("does not select chunks exactly at the TTL boundary", () => {
      const toDelete = selectTtlDeletes([borderChunk], now);
      expect(toDelete).toHaveLength(0);
    });

    it("does not select recent chunks", () => {
      const toDelete = selectTtlDeletes([newChunk], now);
      expect(toDelete).toHaveLength(0);
    });

    it("returns empty array for empty input", () => {
      expect(selectTtlDeletes([], now)).toEqual([]);
    });

    it("selects all chunks when all are past TTL", () => {
      const chunks = [
        { _id: "a" as any, _creationTime: now - SEVEN_DAYS_MS - 100, lines: ["x"] },
        { _id: "b" as any, _creationTime: now - SEVEN_DAYS_MS - 200, lines: ["y"] },
      ];
      const toDelete = selectTtlDeletes(chunks, now);
      expect(toDelete).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // selectCapDeletes — per-job byte-cap pass (drop-oldest)
  // -------------------------------------------------------------------------

  describe("selectCapDeletes", () => {
    // Chunks ordered by seq ascending (oldest first) — as returned by listJobLogs
    const makeChunk = (id: string, seq: number, lineBytes: number) => ({
      _id: id as any,
      seq,
      lines: ["x".repeat(lineBytes)],
    });

    it("returns empty array when total bytes are at or below the cap", () => {
      const cap = 1_000_000;
      const chunks = [makeChunk("a", 0, 400_000), makeChunk("b", 1, 400_000)];
      expect(selectCapDeletes(chunks, cap)).toEqual([]);
    });

    it("drops oldest chunks first until total is at or below the cap", () => {
      const cap = 500;
      // Total: 300 + 300 + 300 = 900 > 500 → must drop oldest first
      // Drop chunk at seq=0 (300 bytes) → remaining: 600 > 500 → drop seq=1 (300 bytes)
      // → remaining: 300 ≤ 500 → stop
      const chunks = [
        makeChunk("seq0", 0, 300),
        makeChunk("seq1", 1, 300),
        makeChunk("seq2", 2, 300),
      ];
      const toDelete = selectCapDeletes(chunks, cap);
      expect(toDelete.map((c) => c._id)).toEqual(["seq0", "seq1"]);
    });

    it("always preserves the newest chunks (highest seq) when cap is tight", () => {
      const cap = 10;
      // Even if only one chunk fits, the newest (seq=5) must survive
      const chunks = [
        makeChunk("a", 0, 8),
        makeChunk("b", 5, 8),
      ];
      const toDelete = selectCapDeletes(chunks, cap);
      // total = 16 > 10; drop oldest (seq=0, 8 bytes) → remaining 8 ≤ 10 → stop
      // seq=5 chunk MUST survive
      expect(toDelete.map((c) => c._id)).toEqual(["a"]);
      expect(toDelete.find((c) => c._id === "b")).toBeUndefined();
    });

    it("an under-cap job loses nothing (no-op)", () => {
      const cap = 1_000_000;
      const chunks = [makeChunk("only", 0, 500)];
      expect(selectCapDeletes(chunks, cap)).toEqual([]);
    });

    it("returns empty for empty input", () => {
      expect(selectCapDeletes([], 1_000_000)).toEqual([]);
    });

    it("per-job cap is independent — one job's overflow does not evict another job's chunks", () => {
      // Simulate two jobs: job-A is over cap, job-B is under. We call selectCapDeletes
      // separately per job — job-B chunks array should return no deletes.
      const cap = 100;
      const jobAChunks = [makeChunk("a1", 0, 80), makeChunk("a2", 1, 80)];  // 160 > 100
      const jobBChunks = [makeChunk("b1", 0, 60)];                          // 60 ≤ 100

      const jobADeletes = selectCapDeletes(jobAChunks, cap);
      const jobBDeletes = selectCapDeletes(jobBChunks, cap);

      expect(jobADeletes).toHaveLength(1);  // drop oldest a1
      expect(jobBDeletes).toHaveLength(0);  // no eviction from job B
    });
  });
});
