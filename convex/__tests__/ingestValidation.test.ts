import { describe, it, expect } from "vitest";
import { validatePayload, type FieldSchema } from "../lib/validation";
import { validationErrorResponse } from "../ingestAuth";

/**
 * Tests for ingest schema validation (D-09, D-11).
 *
 * Validates the shared validatePayload helper and the structured
 * error response format returned by validationErrorResponse.
 */

const testSchema: Record<string, FieldSchema> = {
  name: { type: "string", required: true },
  count: { type: "number", required: true },
  tags: { type: "array", required: false },
  active: { type: "boolean", required: false },
  config: { type: "object", required: false },
};

describe("validatePayload (D-09)", () => {
  it("accepts valid payload with all required fields", () => {
    const errors = validatePayload(
      { name: "test", count: 42 },
      testSchema,
    );
    expect(errors).toEqual([]);
  });

  it("accepts valid payload with required + optional fields", () => {
    const errors = validatePayload(
      { name: "test", count: 42, tags: ["a", "b"], active: true, config: { x: 1 } },
      testSchema,
    );
    expect(errors).toEqual([]);
  });

  it("rejects missing required field", () => {
    const errors = validatePayload(
      { count: 42 },
      testSchema,
    );
    expect(errors).toEqual([{ field: "name", message: "required" }]);
  });

  it("rejects multiple missing required fields", () => {
    const errors = validatePayload(
      { tags: ["a"] },
      testSchema,
    );
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(["count", "name"]);
    expect(errors.every((e) => e.message === "required")).toBe(true);
  });

  it("rejects wrong field type (string instead of number)", () => {
    const errors = validatePayload(
      { name: "test", count: "not-a-number" },
      testSchema,
    );
    expect(errors).toEqual([
      { field: "count", message: "expected number, got string" },
    ]);
  });

  it("rejects wrong field type (number instead of string)", () => {
    const errors = validatePayload(
      { name: 123, count: 42 },
      testSchema,
    );
    expect(errors).toEqual([
      { field: "name", message: "expected string, got number" },
    ]);
  });

  it("rejects wrong field type (object instead of array)", () => {
    const errors = validatePayload(
      { name: "test", count: 42, tags: { not: "array" } },
      testSchema,
    );
    expect(errors).toEqual([
      { field: "tags", message: "expected array, got object" },
    ]);
  });

  it("rejects wrong field type (string instead of boolean)", () => {
    const errors = validatePayload(
      { name: "test", count: 42, active: "yes" },
      testSchema,
    );
    expect(errors).toEqual([
      { field: "active", message: "expected boolean, got string" },
    ]);
  });

  it("rejects extra/unknown fields", () => {
    const errors = validatePayload(
      { name: "test", count: 42, unknown1: "x", unknown2: 99 },
      testSchema,
    );
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(["unknown1", "unknown2"]);
    expect(errors.every((e) => e.message === "unexpected field")).toBe(true);
  });

  it("reports both missing fields and extra fields in one pass", () => {
    const errors = validatePayload(
      { count: 42, rogue: "field" },
      testSchema,
    );
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(["name", "rogue"]);
  });

  it("allows null for optional fields (treated as absent)", () => {
    const errors = validatePayload(
      { name: "test", count: 42, tags: null },
      testSchema,
    );
    expect(errors).toEqual([]);
  });

  it("rejects null for required fields", () => {
    const errors = validatePayload(
      { name: null, count: 42 },
      testSchema,
    );
    expect(errors).toEqual([{ field: "name", message: "required" }]);
  });

  it("correctly identifies arrays vs objects", () => {
    const errors = validatePayload(
      { name: "test", count: 42, config: [1, 2, 3] },
      testSchema,
    );
    expect(errors).toEqual([
      { field: "config", message: "expected object, got array" },
    ]);
  });
});

describe("validationErrorResponse (D-11)", () => {
  it("returns structured error format with 400 status", async () => {
    const details = [
      { field: "name", message: "required" },
      { field: "extra", message: "unexpected field" },
    ];
    const response = validationErrorResponse(details, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body).toEqual({
      error: "validation_error",
      details: [
        { field: "name", message: "required" },
        { field: "extra", message: "unexpected field" },
      ],
    });
  });

  it("includes CORS headers in response", () => {
    const response = validationErrorResponse(
      [{ field: "x", message: "required" }],
      { "Access-Control-Allow-Origin": "http://localhost:5173" },
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});
