import { describe, it, expect, vi } from "vitest";
import { validateIngestAuth, corsHeaders } from "../ingestAuth";

/**
 * Behavioral integration tests for ingest authentication (CPHLTH-02).
 *
 * Tests use real Request objects to verify validateIngestAuth() enforces
 * Bearer token auth correctly under all four conditions.
 */
describe("ingestAuth (CPHLTH-02)", () => {
  it("rejects request without Authorization header", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const req = new Request("http://localhost/ingest", { method: "POST" });
    expect(validateIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("rejects request with wrong API key", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const req = new Request("http://localhost/ingest", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(validateIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("accepts request with correct API key", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const req = new Request("http://localhost/ingest", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });
    expect(validateIngestAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("skips auth when no API key configured (dev mode)", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = new Request("http://localhost/ingest", { method: "POST" });
    expect(validateIngestAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects malformed Bearer token (no Bearer prefix)", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "test-key");
    const req = new Request("http://localhost/ingest", {
      method: "POST",
      headers: { Authorization: "test-key" }, // Missing "Bearer " prefix
    });
    expect(validateIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("CORS headers include POST in allowed methods", () => {
    expect(corsHeaders["Access-Control-Allow-Methods"]).toContain("POST");
  });

  it("CORS headers include Authorization in allowed headers", () => {
    expect(corsHeaders["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});
