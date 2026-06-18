/**
 * Tests for convex/forgeFileIngest.ts — HTTP action behavior (Phase 82).
 *
 * Tests the bearer auth logic, body validation, and response shape by
 * exercising validateForgeIngestAuth() (pure, testable) and simulating
 * the forgeFileIngest handler's dispatch logic — mirroring forgeLogIngest.test.ts.
 *
 * SC#1: valid key + {type:'files', hostId, forgeJobId, files:[...]} → 200 {ok:true}
 * SC#1: bad/missing key → 401
 * SC#1: missing/malformed fields → 400
 * SC#3: retention pure helpers tested without Convex runtime
 * D-05: blob delete ordering — storage.delete BEFORE db.delete for image artifacts
 */

import { describe, it, expect, vi } from "vitest";
import { validateForgeIngestAuth } from "./ingestAuth";

// ---------------------------------------------------------------------------
// Auth gate tests (mirrors forgeLogIngest.test.ts — updated URLs to /forge-file-ingest)
// ---------------------------------------------------------------------------

describe("forgeFileIngest auth — validateForgeIngestAuth (SC#1)", () => {
  it("rejects request without Authorization header when key is set", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-file-ingest", { method: "POST" });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("rejects request with wrong API key", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-file-ingest", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("accepts request with correct API key", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-file-ingest", {
      method: "POST",
      headers: { Authorization: "Bearer forge-key-abc" },
    });
    expect(validateForgeIngestAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("fails closed when no FORGE_INGEST_API_KEY configured and no anon opt-in", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "");
    const req = new Request("http://localhost/forge-file-ingest", { method: "POST" });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("allows unauthenticated ingest only with explicit FORGE_INGEST_ALLOW_ANON=true", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "");
    vi.stubEnv("FORGE_INGEST_ALLOW_ANON", "true");
    const req = new Request("http://localhost/forge-file-ingest", { method: "POST" });
    expect(validateForgeIngestAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects malformed Bearer token (no Bearer prefix)", () => {
    vi.stubEnv("FORGE_INGEST_API_KEY", "forge-key-abc");
    const req = new Request("http://localhost/forge-file-ingest", {
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
    const req = new Request("http://localhost/forge-file-ingest", {
      method: "POST",
      // No Authorization header
    });
    expect(validateForgeIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });
});

// ---------------------------------------------------------------------------
// Body validation logic — mirrors forgeFileIngest handler dispatch
// ---------------------------------------------------------------------------

type DispatchResult =
  | { status: 200; body: { ok: true } }
  | { status: 400; body: { error: string } };

/**
 * Pure extraction of the forgeFileIngest body-validation and dispatch decision,
 * without requiring the Convex httpAction runtime.
 *
 * Key differences from forgeLogIngest:
 * - type === "files" (not "log")
 * - Required array is `files` (not `lines`)
 * - NO seq field — idempotency key is (hostId, forgeJobId, path), not seq
 */
function simulateForgeFileIngestDispatch(body: any): DispatchResult {
  if (!body || typeof body !== "object") {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, files" } };
  }

  const { type, hostId, forgeJobId, files } = body;

  if (type !== "files" || !hostId || !forgeJobId || !Array.isArray(files)) {
    return { status: 400, body: { error: "Missing required fields: type, hostId, forgeJobId, files" } };
  }

  return { status: 200, body: { ok: true } };
}

describe("forgeFileIngest body validation (SC#1)", () => {
  const samplePayload = {
    type:       "files",
    hostId:     "desktop-abc",
    forgeJobId: "01JXMQ00000000000000000001",
    files:      [{ path: "src/main.ts", kind: "text", sizeBytes: 1024 }],
  };

  it("returns 200 for valid files payload (SC#1)", () => {
    const result = simulateForgeFileIngestDispatch(samplePayload);
    expect(result.status).toBe(200);
    expect((result.body as any).ok).toBe(true);
  });

  it("returns 200 for valid payload with optional artifacts", () => {
    const result = simulateForgeFileIngestDispatch({
      ...samplePayload,
      artifacts: [{ path: "src/main.ts", kind: "text", sizeBytes: 1024, textContent: "hello" }],
    });
    expect(result.status).toBe(200);
    expect((result.body as any).ok).toBe(true);
  });

  it("returns 200 for empty files array (valid edge case)", () => {
    const result = simulateForgeFileIngestDispatch({
      ...samplePayload,
      files: [],
    });
    expect(result.status).toBe(200);
  });

  it("returns 400 when body is not an object (SC#1 malformed)", () => {
    const result = simulateForgeFileIngestDispatch("not-an-object");
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("returns 400 when type is not 'files' (SC#1 malformed)", () => {
    const result = simulateForgeFileIngestDispatch({
      ...samplePayload,
      type: "log",
    });
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("returns 400 when hostId is missing", () => {
    const result = simulateForgeFileIngestDispatch({
      ...samplePayload,
      hostId: undefined,
    });
    expect(result.status).toBe(400);
  });

  it("returns 400 when forgeJobId is missing", () => {
    const result = simulateForgeFileIngestDispatch({
      ...samplePayload,
      forgeJobId: undefined,
    });
    expect(result.status).toBe(400);
  });

  it("returns 400 when files is not an array", () => {
    const result = simulateForgeFileIngestDispatch({
      ...samplePayload,
      files: "not-an-array",
    });
    expect(result.status).toBe(400);
    expect((result.body as any).error).toContain("Missing required fields");
  });

  it("does NOT check for seq field (no seq in file envelope — Pitfall 6)", () => {
    // File idempotency key is (hostId, forgeJobId, path), NOT seq.
    // A payload without seq must still return 200.
    const result = simulateForgeFileIngestDispatch({
      type:       "files",
      hostId:     "desktop-abc",
      forgeJobId: "01JXMQ00000000000000000001",
      files:      [],
      // no seq field
    });
    expect(result.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Wire envelope shape — verifies the Phase 82 contract (SC#1)
// ---------------------------------------------------------------------------

describe("forgeFileIngest wire envelope — Phase 82 field contract", () => {
  it("files envelope has all 4 required fields (type, hostId, forgeJobId, files)", () => {
    const envelope = {
      type:       "files",
      hostId:     "desktop-abc",
      forgeJobId: "01JXMQ00000000000000000001",
      files:      [{ path: "README.md", kind: "text", sizeBytes: 256 }],
    };
    const requiredFields = ["type", "hostId", "forgeJobId", "files"];
    for (const field of requiredFields) {
      expect(envelope).toHaveProperty(field);
    }
  });

  it("type field is exactly 'files' (not 'log' or other types)", () => {
    const envelope = {
      type:       "files" as const,
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      files:      [],
    };
    expect(envelope.type).toBe("files");
  });

  it("files is an array (not a string, not an object)", () => {
    const envelope = {
      type:       "files",
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      files:      [{ path: "a.txt", kind: "text", sizeBytes: 10 }],
    };
    expect(Array.isArray(envelope.files)).toBe(true);
  });

  it("artifacts field is optional (not required for metadata-only push)", () => {
    // Without artifacts → still valid
    const withoutArtifacts = simulateForgeFileIngestDispatch({
      type:       "files",
      hostId:     "desktop-abc",
      forgeJobId: "job-1",
      files:      [],
    });
    expect(withoutArtifacts.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// DB round-trip stubs (integration tests deferred — no Convex runtime in unit test)
// ---------------------------------------------------------------------------

describe("forgeFileIngest — DB round-trip (integration)", () => {
  it.todo("valid key + {type:'files', hostId, forgeJobId, files:[...]} → 200 + forgeFiles row inserted (SC#1)");
  it.todo("bad/missing key → 401 (SC#1)");
  it.todo("missing fields → 400 (SC#1)");
  it.todo("repeat (hostId, forgeJobId, path) → upsert patch / 200 (idempotent)");
  it.todo("image artifact → storageId set, imageBase64 not persisted (D-02 / Pitfall 3)");
});

// ---------------------------------------------------------------------------
// Retention sweep — pure decision logic (SC#3, D-05)
//
// sweepForgeFileRecords enforces:
//   (1) TTL: delete records with createdAt < Date.now() - SEVEN_DAYS_MS
//   (2) Per-job byte cap: after TTL, drop oldest artifacts (by createdAt) for
//       any job whose total artifact bytes exceed ARTIFACT_BYTE_CAP_PER_JOB.
//
// These tests exercise the pure helper functions exported from forge.ts so we
// can verify the decision logic without a live Convex DB.
// ---------------------------------------------------------------------------

import {
  artifactByteSize,
  selectFileTtlDeletes,
  selectFileCapDeletes,
} from "./forge";

describe("retention sweep — pure helpers (SC#3 / D-05)", () => {
  // -------------------------------------------------------------------------
  // artifactByteSize — byte accounting
  // -------------------------------------------------------------------------

  describe("artifactByteSize", () => {
    it("returns textContent.length when textContent is present", () => {
      expect(artifactByteSize({ textContent: "hello", sizeBytes: 100 })).toBe(5);
    });

    it("returns sizeBytes when textContent is absent", () => {
      expect(artifactByteSize({ sizeBytes: 512_000 })).toBe(512_000);
    });

    it("returns textContent.length even when sizeBytes differs (textContent wins)", () => {
      expect(artifactByteSize({ textContent: "abc", sizeBytes: 999 })).toBe(3);
    });

    it("returns 0 for empty textContent", () => {
      expect(artifactByteSize({ textContent: "", sizeBytes: 100 })).toBe(0);
    });

    it("returns sizeBytes=0 when no textContent and sizeBytes is zero", () => {
      expect(artifactByteSize({ sizeBytes: 0 })).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // selectFileTtlDeletes — TTL pass (keyed on createdAt ISO string, not _creationTime)
  // -------------------------------------------------------------------------

  describe("selectFileTtlDeletes", () => {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const now = 1_700_000_000_000;

    const oldRecord = {
      _id: "id-old" as any,
      createdAt: new Date(now - SEVEN_DAYS_MS - 1).toISOString(), // 1ms past the TTL boundary
      sizeBytes: 100,
    };
    const borderRecord = {
      _id: "id-border" as any,
      createdAt: new Date(now - SEVEN_DAYS_MS).toISOString(),     // exactly at the boundary — survives
      sizeBytes: 100,
    };
    const newRecord = {
      _id: "id-new" as any,
      createdAt: new Date(now - 1_000).toISOString(),             // 1 second ago — clearly survives
      sizeBytes: 100,
    };

    it("selects records older than 7 days for deletion", () => {
      const toDelete = selectFileTtlDeletes([oldRecord, borderRecord, newRecord], now);
      expect(toDelete.map((r) => r._id)).toEqual(["id-old"]);
    });

    it("does not select records exactly at the TTL boundary", () => {
      const toDelete = selectFileTtlDeletes([borderRecord], now);
      expect(toDelete).toHaveLength(0);
    });

    it("does not select recent records", () => {
      const toDelete = selectFileTtlDeletes([newRecord], now);
      expect(toDelete).toHaveLength(0);
    });

    it("returns empty array for empty input", () => {
      expect(selectFileTtlDeletes([], now)).toEqual([]);
    });

    it("selects all records when all are past TTL", () => {
      const records = [
        { _id: "a" as any, createdAt: new Date(now - SEVEN_DAYS_MS - 100).toISOString(), sizeBytes: 10 },
        { _id: "b" as any, createdAt: new Date(now - SEVEN_DAYS_MS - 200).toISOString(), sizeBytes: 20 },
      ];
      const toDelete = selectFileTtlDeletes(records, now);
      expect(toDelete).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // selectFileCapDeletes — per-job byte-cap pass (drop-oldest by createdAt)
  // -------------------------------------------------------------------------

  describe("selectFileCapDeletes", () => {
    const now = 1_700_000_000_000;

    // Records ordered by createdAt ascending (oldest first), like sort output
    const makeRecord = (id: string, offsetMs: number, sizeBytes: number, textContent?: string) => ({
      _id: id as any,
      createdAt: new Date(now - offsetMs).toISOString(), // larger offset = older
      sizeBytes,
      textContent,
    });

    it("returns empty array when total bytes are at or below the cap", () => {
      const cap = 1_000_000;
      const records = [makeRecord("a", 2000, 400_000), makeRecord("b", 1000, 400_000)];
      expect(selectFileCapDeletes(records, cap)).toEqual([]);
    });

    it("drops oldest records first until total is at or below the cap", () => {
      const cap = 500;
      // Total: 300 + 300 + 300 = 900 > 500 → must drop oldest first
      const records = [
        makeRecord("old", 3000, 300),   // oldest
        makeRecord("mid", 2000, 300),
        makeRecord("new", 1000, 300),   // newest
      ];
      const toDelete = selectFileCapDeletes(records, cap);
      // Drop oldest (300) → remaining 600 > 500 → drop mid (300) → remaining 300 ≤ 500 → stop
      expect(toDelete.map((r) => r._id)).toEqual(["old", "mid"]);
    });

    it("always preserves the newest records (latest createdAt) when cap is tight", () => {
      const cap = 10;
      const records = [
        makeRecord("old", 2000, 8),  // oldest
        makeRecord("new", 1000, 8),  // newest — must survive
      ];
      const toDelete = selectFileCapDeletes(records, cap);
      expect(toDelete.map((r) => r._id)).toEqual(["old"]);
      expect(toDelete.find((r) => r._id === "new")).toBeUndefined();
    });

    it("uses artifactByteSize for textContent-based byte accounting", () => {
      const cap = 10;
      // textContent.length wins over sizeBytes
      const records = [
        makeRecord("old", 2000, 999, "hello world"), // textContent.length=11 > cap
        makeRecord("new", 1000, 5),                  // sizeBytes=5 ≤ cap
      ];
      // Total = 11 + 5 = 16 > 10; drop oldest (11 bytes) → remaining 5 ≤ 10 → stop
      const toDelete = selectFileCapDeletes(records, cap);
      expect(toDelete.map((r) => r._id)).toEqual(["old"]);
    });

    it("an under-cap job loses nothing (no-op)", () => {
      const cap = 1_000_000;
      const records = [makeRecord("only", 500, 500)];
      expect(selectFileCapDeletes(records, cap)).toEqual([]);
    });

    it("returns empty for empty input", () => {
      expect(selectFileCapDeletes([], 1_000_000)).toEqual([]);
    });

    it("per-job cap is independent — one job's overflow does not evict another job's records", () => {
      const cap = 100;
      const jobARecords = [makeRecord("a1", 2000, 80), makeRecord("a2", 1000, 80)]; // 160 > 100
      const jobBRecords = [makeRecord("b1", 500, 60)];                              // 60 ≤ 100

      const jobADeletes = selectFileCapDeletes(jobARecords, cap);
      const jobBDeletes = selectFileCapDeletes(jobBRecords, cap);

      expect(jobADeletes).toHaveLength(1); // drop oldest a1
      expect(jobBDeletes).toHaveLength(0); // no eviction from job B
    });
  });
});

// ---------------------------------------------------------------------------
// Retention sweep — blob delete ordering (D-05)
//
// For image artifacts (has storageId), the sweep MUST call storage.delete BEFORE
// db.delete. A text artifact (no storageId) is deleted without a storage.delete call.
// ---------------------------------------------------------------------------

describe("retention sweep — blob delete ordering (D-05)", () => {
  it("storage.delete called BEFORE db.delete for image artifacts", () => {
    // Simulate the sweep loop with a vi.fn() ordering capture
    const callOrder: string[] = [];

    const storageDeleteFn = vi.fn(async (_storageId: string) => {
      callOrder.push("storage.delete");
    });
    const dbDeleteFn = vi.fn(async (_id: string) => {
      callOrder.push("db.delete");
    });

    // Simulate the per-artifact sweep loop (mirrors sweepForgeFileRecords implementation)
    async function simulateSweep(artifacts: Array<{ _id: string; storageId?: string }>) {
      for (const artifact of artifacts) {
        if (artifact.storageId) {
          await storageDeleteFn(artifact.storageId); // blob FIRST (D-05)
        }
        await dbDeleteFn(artifact._id);             // then doc row
      }
    }

    const imageArtifact = { _id: "art-1", storageId: "storage-id-abc" };

    return simulateSweep([imageArtifact]).then(() => {
      expect(callOrder).toEqual(["storage.delete", "db.delete"]);
      expect(storageDeleteFn).toHaveBeenCalledWith("storage-id-abc");
      expect(dbDeleteFn).toHaveBeenCalledWith("art-1");
    });
  });

  it("text artifacts deleted without storage.delete (no storageId)", () => {
    const callOrder: string[] = [];

    const storageDeleteFn = vi.fn(async (_storageId: string) => {
      callOrder.push("storage.delete");
    });
    const dbDeleteFn = vi.fn(async (_id: string) => {
      callOrder.push("db.delete");
    });

    async function simulateSweep(artifacts: Array<{ _id: string; storageId?: string }>) {
      for (const artifact of artifacts) {
        if (artifact.storageId) {
          await storageDeleteFn(artifact.storageId);
        }
        await dbDeleteFn(artifact._id);
      }
    }

    const textArtifact = { _id: "art-text-1" }; // no storageId

    return simulateSweep([textArtifact]).then(() => {
      expect(callOrder).toEqual(["db.delete"]); // no "storage.delete"
      expect(storageDeleteFn).not.toHaveBeenCalled();
      expect(dbDeleteFn).toHaveBeenCalledWith("art-text-1");
    });
  });

  it("mixed: image artifact gets storage.delete before db.delete; text artifact gets only db.delete", () => {
    const callOrder: Array<{ op: string; id: string }> = [];

    async function simulateSweep(artifacts: Array<{ _id: string; storageId?: string }>) {
      for (const artifact of artifacts) {
        if (artifact.storageId) {
          callOrder.push({ op: "storage.delete", id: artifact.storageId });
        }
        callOrder.push({ op: "db.delete", id: artifact._id });
      }
    }

    const image = { _id: "img-1", storageId: "s3-blob-ref" };
    const text  = { _id: "txt-1" };

    return simulateSweep([image, text]).then(() => {
      expect(callOrder).toEqual([
        { op: "storage.delete", id: "s3-blob-ref" },
        { op: "db.delete",      id: "img-1" },
        { op: "db.delete",      id: "txt-1" },
      ]);
    });
  });
});
