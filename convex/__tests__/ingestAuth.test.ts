import { describe, it, expect, vi } from "vitest";
import { validateIngestAuth, validateGaldrAuth, parseAllowlist, getCorsHeaders, getCorsHeadersWithAllowlist } from "../ingestAuth";

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

  it("fails closed when no API key configured and no anon opt-in (CSO-95-01)", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    const req = new Request("http://localhost/ingest", { method: "POST" });
    expect(validateIngestAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("allows anon ingest only when ASTRIDR_INGEST_ALLOW_ANON=true (dev opt-in, CSO-95-01)", () => {
    vi.stubEnv("ASTRIDR_INGEST_API_KEY", "");
    vi.stubEnv("ASTRIDR_INGEST_ALLOW_ANON", "true");
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

  it("CORS headers include POST in allowed methods (dev fallback)", () => {
    const req = new Request("http://localhost/ingest");
    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
  });

  it("CORS headers include Authorization in allowed headers (dev fallback)", () => {
    const req = new Request("http://localhost/ingest");
    const headers = getCorsHeaders(req);
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});

describe("validateGaldrAuth", () => {
  it("rejects a request with no Authorization header when GALDR_API_KEY is set", () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const req = new Request("http://localhost/galdr/prompt?slug=x", { method: "GET" });
    expect(validateGaldrAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("rejects a request whose Bearer value is a different key", () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const req = new Request("http://localhost/galdr/prompt?slug=x", {
      method: "GET",
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(validateGaldrAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("accepts a request whose Bearer value matches GALDR_API_KEY", () => {
    vi.stubEnv("GALDR_API_KEY", "test-galdr-key");
    const req = new Request("http://localhost/galdr/prompt?slug=x", {
      method: "GET",
      headers: { Authorization: "Bearer test-galdr-key" },
    });
    expect(validateGaldrAuth(req)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("fails closed: GALDR_API_KEY unset and GALDR_ALLOW_ANON unset returns false", () => {
    vi.stubEnv("GALDR_API_KEY", "");
    const req = new Request("http://localhost/galdr/prompt?slug=x", { method: "GET" });
    expect(validateGaldrAuth(req)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns true only when GALDR_API_KEY is unset AND GALDR_ALLOW_ANON is exactly the string \"true\"", () => {
    vi.stubEnv("GALDR_API_KEY", "");
    vi.stubEnv("GALDR_ALLOW_ANON", "true");
    const req = new Request("http://localhost/galdr/prompt?slug=x", { method: "GET" });
    expect(validateGaldrAuth(req)).toBe(true);
    vi.unstubAllEnvs();

    // Negative control: the opt-in is exact-string only, not truthy-string.
    vi.stubEnv("GALDR_API_KEY", "");
    vi.stubEnv("GALDR_ALLOW_ANON", "1");
    const reqOne = new Request("http://localhost/galdr/prompt?slug=x", { method: "GET" });
    expect(validateGaldrAuth(reqOne)).toBe(false);
    vi.unstubAllEnvs();

    vi.stubEnv("GALDR_API_KEY", "");
    vi.stubEnv("GALDR_ALLOW_ANON", "TRUE");
    const reqUpper = new Request("http://localhost/galdr/prompt?slug=x", { method: "GET" });
    expect(validateGaldrAuth(reqUpper)).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("parseAllowlist + getCorsHeaders — CORS allowlist (OPS-01)", () => {
  it("parseAllowlist: comma-separated list returns Set with both entries", () => {
    const allowlist = parseAllowlist("https://example.com,http://localhost:5173");
    expect(allowlist).not.toBeNull();
    expect(allowlist?.has("https://example.com")).toBe(true);
    expect(allowlist?.has("http://localhost:5173")).toBe(true);
  });

  it("parseAllowlist: trims surrounding whitespace from each entry", () => {
    const allowlist = parseAllowlist("  https://example.com , http://localhost:5173  ");
    expect(allowlist?.has("https://example.com")).toBe(true);
    expect(allowlist?.has("http://localhost:5173")).toBe(true);
  });

  it("parseAllowlist: returns null when env var is undefined (dev fallback signal)", () => {
    expect(parseAllowlist(undefined)).toBeNull();
  });

  it("parseAllowlist: returns null when env var is empty string (dev fallback signal)", () => {
    expect(parseAllowlist("")).toBeNull();
  });

  it("getCorsHeadersWithAllowlist: echoes matched origin as ACAO", () => {
    const allowlist = parseAllowlist("https://example.com,http://localhost:5173");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "https://example.com" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
  });

  it("getCorsHeadersWithAllowlist: echoes second matched origin correctly", () => {
    const allowlist = parseAllowlist("https://example.com,http://localhost:5173");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "http://localhost:5173" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("getCorsHeadersWithAllowlist: omits ACAO when origin is not in allowlist (fail-closed)", () => {
    const allowlist = parseAllowlist("https://example.com");
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "https://evil.com" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("getCorsHeadersWithAllowlist: omits ACAO when request has no Origin header and allowlist is set", () => {
    const allowlist = parseAllowlist("https://example.com");
    const req = new Request("https://tidy-whale-981.convex.site/ingest");
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("getCorsHeadersWithAllowlist: returns permissive '*' when allowlist is null (dev fallback)", () => {
    const allowlist = parseAllowlist(undefined);
    const req = new Request("https://tidy-whale-981.convex.site/ingest", {
      headers: { Origin: "http://localhost:5173" },
    });
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("getCorsHeadersWithAllowlist: dev fallback still includes POST in allowed methods", () => {
    const allowlist = parseAllowlist(undefined);
    const req = new Request("https://tidy-whale-981.convex.site/ingest");
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
  });

  it("getCorsHeadersWithAllowlist: dev fallback still includes Authorization in allowed headers", () => {
    const allowlist = parseAllowlist(undefined);
    const req = new Request("https://tidy-whale-981.convex.site/ingest");
    const headers = getCorsHeadersWithAllowlist(req, allowlist);
    expect(headers["Access-Control-Allow-Headers"]).toContain("Authorization");
  });
});
