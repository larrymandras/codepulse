import { describe, it } from "vitest";
// These imports will resolve after Plan 01 creates the file.
// For Wave 0, create the test file with tests that will FAIL (RED) until Plan 01 implements.
// Plan 01 Task 1 already has these exact behaviors defined — this pre-creates the test file.

describe("variableSchemaToRows", () => {
  it.todo("converts Record to VariableRow array");
});

describe("rowsToVariableSchema", () => {
  it.todo("converts VariableRow array back to Record, stripping empty names");
  it.todo("trims whitespace from variable names");
});

describe("variableSchemaToRows + rowsToVariableSchema round-trip", () => {
  it.todo("round-trips without data loss");
});

describe("buildSampleVariables", () => {
  it.todo("uses example field when present");
  it.todo("falls back to [variable_name] when example is empty");
  it.todo("returns empty object for empty schema");
});
