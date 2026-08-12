import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { record, listRecent, MESSAGE_ROUTE_CAP } from "./messageRoutes";

// Tests for Phase 112 (TELE-03, D-13): messageRoutes backend service

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip full-line comments (// or *-prefixed doc-comment lines) so a
 * docstring that legitimately mentions the words "mutation" or "record"
 * cannot pollute a source-level grep-style assertion. Copied verbatim from
 * controlVerbSwaps.test.ts, which itself copied it from activeEngine.test.ts. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("record args shape (read from the live validator, not a hand-typed literal)", () => {
  function recordArgFields(): Record<string, { fieldType: { type: string }; optional: boolean }> {
    const exportArgs = (record as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    return schema.value;
  }

  it("declares channel/profile/timestamp as required (non-optional)", () => {
    const fields = recordArgFields();
    expect(fields.channel.optional).toBe(false);
    expect(fields.profile.optional).toBe(false);
    expect(fields.timestamp.optional).toBe(false);
  });

  it("declares sender/sessionId as optional", () => {
    const fields = recordArgFields();
    expect(fields.sender.optional).toBe(true);
    expect(fields.sessionId.optional).toBe(true);
  });

  it("declares timestamp as a numeric field (matches v.float64())", () => {
    const fields = recordArgFields();
    expect(fields.timestamp.fieldType.type).toBe("number");
  });
});

// CR-01 guard: record must be an internalMutation, never a public mutation.
// Same shape as controlVerbSwaps.test.ts / governorDecisions.test.ts.
describe("CR-01 — record authorization boundary (source-level guard)", () => {
  const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");

  it("declares record with internalMutation, never with a public mutation builder", () => {
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/record\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("stays true even though the file's own docstrings mention the word 'mutation'", () => {
    // Sanity check on the stripping itself: the raw (unstripped) file DOES
    // contain the word "mutation" in prose — if it didn't, the negative
    // assertion above would be vacuous.
    const raw = readFileSync(messageRoutesPath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });
});

describe("bounded read — listRecent never .collect()s", () => {
  const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");

  it("uses .take( and never .collect( on the append-only table", () => {
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/\.take\(/);
    expect(source).not.toMatch(/\.collect\(/);
  });

  it("declares MESSAGE_ROUTE_CAP IN THIS FILE (deliberate difference from governorDecisions — no filters module, per <decided_shapes>)", () => {
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/export const MESSAGE_ROUTE_CAP\s*=\s*50/);
    expect(source).toMatch(/\.take\(MESSAGE_ROUTE_CAP\)/);
  });

  it("MESSAGE_ROUTE_CAP constant equals 50", () => {
    expect(MESSAGE_ROUTE_CAP).toBe(50);
  });

  it("has no sibling messageRoutesFilters.ts module", () => {
    const filtersPath = path.resolve(__dirname, "./messageRoutesFilters.ts");
    expect(() => readFileSync(filtersPath, "utf-8")).toThrow();
  });
});

describe("listRecent — declared as query({ args: {}, ... }), takes no arguments", () => {
  it("has an empty args object validator (read from the live validator)", () => {
    const exportArgs = (listRecent as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.value)).toEqual([]);
  });

  it("is registered with query(, not internalMutation/mutation — record stays the file's only internalMutation( (CR-01 regression guard)", () => {
    const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");
    const source = stripCommentLines(readFileSync(messageRoutesPath, "utf-8"));
    expect(source).toMatch(/listRecent\s*=\s*query\(/);
    const internalMutationMatches = source.match(/=\s*internalMutation\(/g) ?? [];
    expect(internalMutationMatches.length).toBe(1);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });
});

// D-13 recorded in the file itself: routed but deliberately not surfaced in
// the UI this phase.
describe("D-13 — deliberate no-UI decision is recorded in the module", () => {
  it("the file source contains the string D-13", () => {
    const messageRoutesPath = path.resolve(__dirname, "./messageRoutes.ts");
    const raw = readFileSync(messageRoutesPath, "utf-8");
    expect(raw).toContain("D-13");
  });
});
