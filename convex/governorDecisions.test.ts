import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { record, listRecent } from "./governorDecisions";
import { GOVERNOR_DECISION_CAP } from "./governorDecisionsFilters";

// Tests for Phase 112 (TELE-03, D-04): governorDecisions backend service

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

// Reads record.exportArgs() — a real Convex runtime API that serializes the
// mutation's ACTUAL v.* validator object to JSON — so a changed validator in
// governorDecisions.ts makes these tests fail. Same idiom as
// controlVerbSwaps.test.ts's record-args-shape block: never a hand-typed
// literal asserted against itself.
describe("record args shape (read from the live validator, not a hand-typed literal)", () => {
  /** See controlVerbSwaps.test.ts's recordArgFields for why the `as` cast is
   * necessary: exportArgs is a real but TypeScript-untyped runtime property
   * Convex's internalMutation()/mutation() builders attach to the returned
   * function object. */
  function recordArgFields(): Record<string, { fieldType: { type: string }; optional: boolean }> {
    const exportArgs = (record as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    return schema.value;
  }

  it("declares emitter/priority/spoke/timestamp as required (non-optional)", () => {
    const fields = recordArgFields();
    expect(fields.emitter.optional).toBe(false);
    expect(fields.priority.optional).toBe(false);
    expect(fields.spoke.optional).toBe(false);
    expect(fields.timestamp.optional).toBe(false);
  });

  // The one field plan 04's D-14 null-normalization depends on: heldReason
  // must stay optional so an absent/null held_reason on a "spoke" decision
  // does not make the resolver refuse the whole event.
  it("declares heldReason as optional", () => {
    const fields = recordArgFields();
    expect(fields.heldReason.optional).toBe(true);
  });

  it("declares spoke as a boolean field (matches v.boolean())", () => {
    const fields = recordArgFields();
    expect(fields.spoke.fieldType.type).toBe("boolean");
  });

  it("declares timestamp as a numeric field (matches v.float64())", () => {
    const fields = recordArgFields();
    expect(fields.timestamp.fieldType.type).toBe("number");
  });
});

// CR-01 guard: record must be an internalMutation, never a public mutation,
// and must be invoked ONLY through the internal. namespace from the ingest
// path. Same regression-guard shape as controlVerbSwaps.test.ts's CR-01
// block, for the same reason: a public `mutation` builder would let any
// holder of the shipped VITE_CONVEX_URL forge a "server-confirmed" governor
// decision from browser devtools, which plan 05's surface would then render
// as truth.
describe("CR-01 — record authorization boundary (source-level guard)", () => {
  const governorDecisionsPath = path.resolve(__dirname, "./governorDecisions.ts");

  it("declares record with internalMutation, never with a public mutation builder", () => {
    const source = stripCommentLines(readFileSync(governorDecisionsPath, "utf-8"));
    expect(source).toMatch(/record\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("stays true even though the file's own docstrings mention the word 'mutation'", () => {
    // Sanity check on the stripping itself: the raw (unstripped) file DOES
    // contain the word "mutation" in prose — if it didn't, the negative
    // assertion above would be vacuous.
    const raw = readFileSync(governorDecisionsPath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });
});

describe("bounded read — listRecent never .collect()s", () => {
  const governorDecisionsPath = path.resolve(__dirname, "./governorDecisions.ts");

  it("uses .take( and never .collect( on the append-only table", () => {
    const source = stripCommentLines(readFileSync(governorDecisionsPath, "utf-8"));
    expect(source).toMatch(/\.take\(/);
    expect(source).not.toMatch(/\.collect\(/);
  });

  it("imports GOVERNOR_DECISION_CAP from the shared filters module and uses it (not a duplicated literal) inside .take(", () => {
    const source = stripCommentLines(readFileSync(governorDecisionsPath, "utf-8"));
    expect(source).toMatch(
      /import\s*\{[^}]*GOVERNOR_DECISION_CAP[^}]*\}\s*from\s*["']\.\/governorDecisionsFilters["']/
    );
    expect(source).not.toMatch(/export const GOVERNOR_DECISION_CAP/);
    expect(source).toMatch(/\.take\(GOVERNOR_DECISION_CAP\)/);
  });

  it("GOVERNOR_DECISION_CAP constant equals 50, matching the full-width-section sizing rationale", () => {
    expect(GOVERNOR_DECISION_CAP).toBe(50);
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
    const governorDecisionsPath = path.resolve(__dirname, "./governorDecisions.ts");
    const source = stripCommentLines(readFileSync(governorDecisionsPath, "utf-8"));
    expect(source).toMatch(/listRecent\s*=\s*query\(/);
    const internalMutationMatches = source.match(/=\s*internalMutation\(/g) ?? [];
    expect(internalMutationMatches.length).toBe(1);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });
});

// governorDecisionsFilters.ts must stay dependency-free so a browser module
// can import GOVERNOR_DECISION_CAP without pulling in the Convex server
// runtime (T-112-03).
describe("governorDecisionsFilters.ts — dependency-free (T-112-03)", () => {
  it("contains zero import statements", () => {
    const filtersPath = path.resolve(__dirname, "./governorDecisionsFilters.ts");
    const source = readFileSync(filtersPath, "utf-8");
    expect(source).not.toMatch(/^\s*import\s/m);
  });
});
