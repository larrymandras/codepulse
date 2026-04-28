/**
 * Shared payload validation for ingest HTTP endpoints.
 *
 * D-09: Strict validation — reject wrong types, missing required fields, AND extra/unknown fields.
 * D-11: Validation errors return structured JSON: { error: "validation_error", details: [...] }.
 */

/** Schema definition for a single field. */
export interface FieldSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
}

/**
 * Validate a parsed JSON body against a strict schema.
 *
 * Checks:
 * 1. Extra/unknown fields (D-09: reject unknown fields)
 * 2. Required fields present and non-null
 * 3. Field types match expected types
 *
 * Returns an array of errors. Empty array means valid.
 */
export function validatePayload(
  body: Record<string, unknown>,
  schema: Record<string, FieldSchema>
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  const allowedKeys = new Set(Object.keys(schema));

  // Check for extra/unknown fields (D-09: strict — reject unknown)
  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      errors.push({ field: key, message: "unexpected field" });
    }
  }

  // Check required fields and types
  for (const [field, { type, required }] of Object.entries(schema)) {
    const value = body[field];

    if (required && (value === undefined || value === null)) {
      errors.push({ field, message: "required" });
    } else if (value !== undefined && value !== null) {
      const actual = Array.isArray(value) ? "array" : typeof value;
      if (type === "array" && !Array.isArray(value)) {
        errors.push({ field, message: `expected array, got ${actual}` });
      } else if (type !== "array" && actual !== type) {
        errors.push({ field, message: `expected ${type}, got ${actual}` });
      }
    }
  }

  return errors;
}
