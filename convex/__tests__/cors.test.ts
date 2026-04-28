import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit tests for CORS origin lockdown (D-12, D-13, AUTH-05).
 *
 * Uses dynamic imports with vi.resetModules/vi.stubEnv so each test
 * gets a fresh module with its own env var snapshot.
 */
describe("getCorsHeaders (D-12, D-13)", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns no ACAO header for server-to-server (no Origin)", async () => {
    const { getCorsHeaders } = await import("../ingestAuth");
    const h = getCorsHeaders(undefined);
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(h["Access-Control-Allow-Methods"]).toContain("POST");
    expect(h["Access-Control-Allow-Headers"]).toContain("Authorization");
  });

  it("allows localhost:5173 dev origin", async () => {
    const { getCorsHeaders } = await import("../ingestAuth");
    const h = getCorsHeaders("http://localhost:5173");
    expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
  });

  it("allows configured production origin", async () => {
    vi.stubEnv("CODEPULSE_ALLOWED_ORIGIN", "https://codepulse.example.com");
    const { getCorsHeaders } = await import("../ingestAuth");
    const h = getCorsHeaders("https://codepulse.example.com");
    expect(h["Access-Control-Allow-Origin"]).toBe("https://codepulse.example.com");
  });

  it("returns null for non-allowlisted origin (D-13)", async () => {
    vi.stubEnv("CODEPULSE_ALLOWED_ORIGIN", "https://codepulse.example.com");
    const { getCorsHeaders } = await import("../ingestAuth");
    const h = getCorsHeaders("https://evil.com");
    expect(h["Access-Control-Allow-Origin"]).toBe("null");
  });

  it("returns null when CODEPULSE_ALLOWED_ORIGIN unset and browser Origin present (D-13 no wildcard)", async () => {
    vi.stubEnv("CODEPULSE_ALLOWED_ORIGIN", "");
    const { getCorsHeaders } = await import("../ingestAuth");
    const h = getCorsHeaders("https://some-site.com");
    expect(h["Access-Control-Allow-Origin"]).toBe("null");
  });

  it("includes Vary: Origin when Origin is present", async () => {
    const { getCorsHeaders } = await import("../ingestAuth");
    const h = getCorsHeaders("http://localhost:5173");
    expect(h["Vary"]).toBe("Origin");
  });
});
