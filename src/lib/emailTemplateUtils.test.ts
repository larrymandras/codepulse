import { describe, it, expect } from "vitest";
import {
  variableSchemaToRows,
  rowsToVariableSchema,
  buildSampleVariables,
} from "./emailTemplateUtils";
import type { VariableDefinition } from "./emailTemplateUtils";

describe("variableSchemaToRows", () => {
  it("converts Record to VariableRow array", () => {
    const schema: Record<string, VariableDefinition> = {
      first_name: {
        type: "string",
        required: true,
        description: "First name",
        example: "John",
      },
    };
    const rows = variableSchemaToRows(schema);
    expect(rows).toEqual([
      { name: "first_name", type: "string", required: true, description: "First name", example: "John" },
    ]);
  });
});

describe("rowsToVariableSchema", () => {
  it("converts VariableRow array back to Record, stripping empty names", () => {
    const rows = [
      { name: "first_name", type: "string" as const, required: true, description: "First name", example: "John" },
      { name: "", type: "string" as const, required: false, description: "", example: "" },
    ];
    const schema = rowsToVariableSchema(rows);
    expect(schema).toEqual({
      first_name: { type: "string", required: true, description: "First name", example: "John" },
    });
    expect("" in schema).toBe(false);
  });

  it("trims whitespace from variable names", () => {
    const rows = [
      { name: "  last_name  ", type: "string" as const, required: false, description: "", example: "" },
    ];
    const schema = rowsToVariableSchema(rows);
    expect("last_name" in schema).toBe(true);
    expect("  last_name  " in schema).toBe(false);
  });
});

describe("variableSchemaToRows + rowsToVariableSchema round-trip", () => {
  it("round-trips without data loss", () => {
    const original: Record<string, VariableDefinition> = {
      first_name: { type: "string", required: true, description: "First name", example: "John" },
      count: { type: "number", required: false, description: "Count", example: "42" },
    };
    const rows = variableSchemaToRows(original);
    const result = rowsToVariableSchema(rows);
    expect(result).toEqual(original);
  });
});

describe("buildSampleVariables", () => {
  it("uses example field when present", () => {
    const schema: Record<string, VariableDefinition> = {
      first_name: { type: "string", required: true, description: "First name", example: "John" },
    };
    const sample = buildSampleVariables(schema);
    expect(sample.first_name).toBe("John");
  });

  it("falls back to [variable_name] when example is empty", () => {
    const schema: Record<string, VariableDefinition> = {
      company: { type: "string", required: false, description: "Company name", example: "" },
    };
    const sample = buildSampleVariables(schema);
    expect(sample.company).toBe("[company]");
  });

  it("returns empty object for empty schema", () => {
    const sample = buildSampleVariables({});
    expect(sample).toEqual({});
  });
});
