/**
 * Tests for convex/telemetryDispositions.ts's GROUP_B_DISPOSITIONS record
 * (Phase 112, TELE-03, D-10/D-11).
 *
 * Mirrors convex/retention.test.ts's mechanism for the same reason: source-level
 * parsing of runtimeIngest.ts's dispatch switch and schema.ts's table set, rather
 * than importing generated Convex artefacts, keeps this test free of the Convex
 * codegen/runtime (matching the precedent in runtimeIngest.test.ts and
 * activeEngine.test.ts).
 *
 * Three layers, each catching a distinct mutation class (see Task 3 of
 * 112-06-PLAN.md for the mutation-proof run log):
 *
 *   Layer 1 - harness liveness ("guard the guard"). Both source parsers are
 *   proven to have found a plausible non-empty set, with a known-present and a
 *   known-absent control, BEFORE anything downstream is asserted. A regex that
 *   silently stops matching turns every assertion below into a vacuous pass -
 *   retention.test.ts:29-36 documents the identical rationale for its own
 *   schema-table parser.
 *
 *   Layer 2 - per-kind specific assertions, cross-checked against reality. The
 *   canonical seven kinds are declared independently of the const under test and
 *   asserted equal to it (both directions), then each kind gets its own
 *   explicitly-named assertion block - never a loop over the object's own keys,
 *   because a loop cannot notice something absent from the object
 *   (retention.test.ts:57-71 records the identical 2026-08-07 adversarial
 *   finding for its own controlVerbSwaps entry). Then every "routed" kind is
 *   cross-checked against a real `case "<kind>":` in runtimeIngest.ts AND a real
 *   table in schema.ts; every "generic-table-by-design" kind is cross-checked to
 *   have NO case in runtimeIngest.ts.
 *
 *   Layer 3 - source-text reason/date assertions (D-11). Reads
 *   telemetryDispositions.ts's own source and asserts the measurement date and
 *   the D-12 deferral are recorded, and that the D-03 scope caveat is enforced
 *   rather than trusted: no reason string may claim a silent kind lacks any
 *   emitter, was not emitted, or does not fire.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GROUP_B_DISPOSITIONS } from "./telemetryDispositions";

const ingestSource = readFileSync(resolve(process.cwd(), "convex/runtimeIngest.ts"), "utf-8");
const schemaSource = readFileSync(resolve(process.cwd(), "convex/schema.ts"), "utf-8");
const dispositionsSource = readFileSync(
  resolve(process.cwd(), "convex/telemetryDispositions.ts"),
  "utf-8"
);

/** Every `case "<kind>":` label in runtimeIngest.ts's dispatch switch. There is
 * exactly one `switch` in this file (over `evt.eventType`), so a whole-file scan
 * cannot pick up a case label from an unrelated switch. */
const dispatchedCases = new Set(
  Array.from(ingestSource.matchAll(/case "([a-zA-Z0-9_.]+)":/g)).map((m) => m[1])
);

/** Every `someTable: defineTable({` declared in schema.ts - identical regex to
 * retention.test.ts's, so both tests see the same table set. */
const schemaTables = new Set(
  Array.from(schemaSource.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*defineTable\(/gm)).map(
    (m) => m[1]
  )
);

// The canonical seven Group B kinds, declared here independently of the const
// under test - Layer 2's set-equality assertion is meaningless if this list is
// merely a copy of GROUP_B_DISPOSITIONS' own keys.
const CANONICAL_GROUP_B_KINDS = [
  "governor_decision",
  "control_verb_swap",
  "message_routed",
  "prompt_assembly",
  "structured_output_exhausted",
  "vision.capture",
  "control_verb_focus",
] as const;

describe("GROUP_B_DISPOSITIONS - Layer 1: harness liveness (guard the guard)", () => {
  it("parsed a plausible non-empty set of dispatch cases out of runtimeIngest.ts", () => {
    // Without this, a regex that stops matching would make every downstream
    // routed/generic cross-check pass vacuously.
    expect(dispatchedCases.size).toBeGreaterThan(20);
    expect(dispatchedCases.has("llm_call")).toBe(true);
    expect(dispatchedCases.has("definitely_not_a_real_kind_9x7q2")).toBe(false);
  });

  it("parsed a plausible non-empty set of tables out of schema.ts", () => {
    expect(schemaTables.size).toBeGreaterThan(20);
    expect(schemaTables.has("alerts")).toBe(true);
  });
});

describe("GROUP_B_DISPOSITIONS - Layer 2: per-kind assertions, cross-checked against reality", () => {
  it("the recorded keys are exactly the seven canonical Group B kinds - no missing kind, no extra kind", () => {
    // Mutation A target: deleting an entry (or adding an undisposed one) is
    // caught here, in both directions, independent of any per-kind block below.
    const recordedKeys = Object.keys(GROUP_B_DISPOSITIONS).sort();
    const canonical = [...CANONICAL_GROUP_B_KINDS].sort();
    expect(recordedKeys).toEqual(canonical);
  });

  it("governor_decision: routed to governorDecisions", () => {
    expect(GROUP_B_DISPOSITIONS.governor_decision).toBeDefined();
    expect(GROUP_B_DISPOSITIONS.governor_decision.disposition).toBe("routed");
    expect(GROUP_B_DISPOSITIONS.governor_decision.table).toBe("governorDecisions");
  });

  it("control_verb_swap: routed to controlVerbSwaps", () => {
    expect(GROUP_B_DISPOSITIONS.control_verb_swap).toBeDefined();
    expect(GROUP_B_DISPOSITIONS.control_verb_swap.disposition).toBe("routed");
    expect(GROUP_B_DISPOSITIONS.control_verb_swap.table).toBe("controlVerbSwaps");
  });

  it("message_routed: routed to messageRoutes", () => {
    expect(GROUP_B_DISPOSITIONS.message_routed).toBeDefined();
    expect(GROUP_B_DISPOSITIONS.message_routed.disposition).toBe("routed");
    expect(GROUP_B_DISPOSITIONS.message_routed.table).toBe("messageRoutes");
  });

  it("prompt_assembly: generic-table-by-design", () => {
    expect(GROUP_B_DISPOSITIONS.prompt_assembly).toBeDefined();
    expect(GROUP_B_DISPOSITIONS.prompt_assembly.disposition).toBe("generic-table-by-design");
  });

  it("structured_output_exhausted: generic-table-by-design", () => {
    expect(GROUP_B_DISPOSITIONS.structured_output_exhausted).toBeDefined();
    expect(GROUP_B_DISPOSITIONS.structured_output_exhausted.disposition).toBe(
      "generic-table-by-design"
    );
  });

  it("vision.capture: generic-table-by-design", () => {
    expect(GROUP_B_DISPOSITIONS["vision.capture"]).toBeDefined();
    expect(GROUP_B_DISPOSITIONS["vision.capture"].disposition).toBe("generic-table-by-design");
  });

  it("control_verb_focus: generic-table-by-design", () => {
    expect(GROUP_B_DISPOSITIONS.control_verb_focus).toBeDefined();
    expect(GROUP_B_DISPOSITIONS.control_verb_focus.disposition).toBe("generic-table-by-design");
  });

  it("every routed kind has a matching case in runtimeIngest.ts AND its named table is a real schema.ts table", () => {
    // Mutation C target: routing a kind in code without updating the record (or
    // vice versa) fails here.
    for (const [kind, entry] of Object.entries(GROUP_B_DISPOSITIONS)) {
      if (entry.disposition !== "routed") continue;
      expect(dispatchedCases.has(kind), `${kind} must have a case in runtimeIngest.ts`).toBe(
        true
      );
      expect(entry.table, `${kind} routed entry must name a table`).toBeDefined();
      expect(
        schemaTables.has(entry.table!),
        `${kind}'s table "${entry.table}" must be a real schema.ts table`
      ).toBe(true);
    }
  });

  it("every generic-table-by-design kind has NO case in runtimeIngest.ts - catches someone routing a kind without updating the record", () => {
    for (const [kind, entry] of Object.entries(GROUP_B_DISPOSITIONS)) {
      if (entry.disposition !== "generic-table-by-design") continue;
      expect(
        dispatchedCases.has(kind),
        `${kind} is recorded generic-table-by-design but has a live case in runtimeIngest.ts`
      ).toBe(false);
    }
  });
});

describe("GROUP_B_DISPOSITIONS - Layer 3: source-text reason/date assertions (D-11)", () => {
  it("the file records the measurement date and the D-12 deferral in place, not only in planning docs", () => {
    expect(dispositionsSource).toContain("2026-08-12");
    expect(dispositionsSource).toContain("D-12");
  });

  it("D-03's scope caveat is enforced, not trusted: no reason string claims a silent kind lacks an emitter, was not emitted, or does not fire", () => {
    // Mutation B target: rewriting a generic-by-design reason to overstate the
    // evidence fails here.
    expect(dispositionsSource).not.toContain("never emitted");
    expect(dispositionsSource).not.toContain("never fires");
    expect(dispositionsSource).not.toContain("no emitter");
  });

  it("every entry's measured date is a real ISO date string", () => {
    for (const [kind, entry] of Object.entries(GROUP_B_DISPOSITIONS)) {
      expect(entry.measured, `${kind}.measured`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every generic-table-by-design entry's reason cites the 14-day-window scope caveat", () => {
    for (const [kind, entry] of Object.entries(GROUP_B_DISPOSITIONS)) {
      if (entry.disposition !== "generic-table-by-design") continue;
      expect(entry.reason, `${kind}.reason`).toContain("no row in the 14-day window");
    }
  });
});
