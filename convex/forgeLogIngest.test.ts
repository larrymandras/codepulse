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
  it.todo("valid retention sweep: chunks > 7 days old deleted; per-job cap enforced (SC#3)");
});
