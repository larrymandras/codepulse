import { describe, it, expect } from "vitest";
import {
  checkBodySize,
  payloadTooLargeResponse,
  rateLimitResponse,
  validationErrorResponse,
} from "../ingestAuth";

/**
 * Unit tests for ingest middleware helpers (D-08, D-11, AUTH-03).
 */
describe("checkBodySize (D-08)", () => {
  it("allows body under 1MB", () => {
    const req = new Request("http://x", {
      headers: { "Content-Length": "500000" },
    });
    expect(checkBodySize(req)).toBe(true);
  });

  it("rejects body over 1MB", () => {
    const req = new Request("http://x", {
      headers: { "Content-Length": "2000000" },
    });
    expect(checkBodySize(req)).toBe(false);
  });

  it("allows when Content-Length absent", () => {
    const req = new Request("http://x");
    expect(checkBodySize(req)).toBe(true);
  });
});

describe("response helpers", () => {
  it("payloadTooLargeResponse returns 413", () => {
    const r = payloadTooLargeResponse({});
    expect(r.status).toBe(413);
  });

  it("rateLimitResponse returns 429 with retryAfterMs", async () => {
    const r = rateLimitResponse({}, 5000);
    expect(r.status).toBe(429);
    const body = await r.json();
    expect(body.retryAfterMs).toBe(5000);
  });

  it("validationErrorResponse returns 400 with structured error per D-11", async () => {
    const r = validationErrorResponse(
      [{ field: "x", message: "expected string" }],
      {}
    );
    expect(r.status).toBe(400);
    const body = await r.json();
    expect(body.error).toBe("validation_error");
    expect(body.details).toHaveLength(1);
    expect(body.details[0].field).toBe("x");
  });
});
