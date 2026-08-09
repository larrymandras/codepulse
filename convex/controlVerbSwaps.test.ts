import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { record, listGlobal, listByScope } from "./controlVerbSwaps";
// isBrainSwap/SWAP_HISTORY_CAP moved to controlVerbSwapsFilters.ts (2026-08-07, bundling defect
// fix — see 108-REVIEW.md); controlVerbSwaps.ts no longer defines or re-exports either, so this
// test file imports them from their one remaining source, same as controlVerbSwaps.ts itself does.
import { isBrainSwap, SWAP_HISTORY_CAP } from "./controlVerbSwapsFilters";

// Tests for Phase 108 (TELE-02, D-13/D-14): controlVerbSwaps backend service

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip full-line comments (// or *-prefixed doc-comment lines) so a
 * docstring that legitimately mentions the words "mutation" or "record"
 * cannot pollute a source-level grep-style assertion. Copied verbatim from
 * activeEngine.test.ts. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

// Post-execution gap closure (adversarial verification, 2026-08-07): the
// original version of this block built a hand-typed plain-object literal and
// asserted properties against that SAME literal — it never touched `record`
// at all (the import above didn't even exist), so it would have passed
// unchanged even if record's real arg validators were deleted or rewritten.
// This version reads `record.exportArgs()` — a real Convex runtime API that
// serializes the mutation's ACTUAL `v.*` validator object to JSON — so a
// changed validator in controlVerbSwaps.ts makes these tests fail. Verified
// by mutation: temporarily changing `providerAffinity` from
// `v.optional(v.string())` to `v.string()` (required) flipped the first
// assertion below from pass to fail; reverted after confirming.
describe("record args shape (read from the live validator, not a hand-typed literal)", () => {
  /** `exportArgs` is a real but TypeScript-untyped runtime property that
   * Convex's internalMutation()/mutation() builders attach to the returned
   * function object (see node_modules/convex/dist/esm/server/impl/registration_impl.js,
   * internalMutationGeneric) specifically so the CLI can serialize a
   * function's validators for the deploy manifest. It isn't part of the
   * public `RegisteredMutation` TS type, hence the narrow `as` cast — this
   * reads the same object `npx convex deploy` reads, not a mock. */
  function recordArgFields(): Record<string, { fieldType: { type: string }; optional: boolean }> {
    const exportArgs = (record as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    return schema.value;
  }

  it("declares verb/path/channel/timestamp as required (non-optional)", () => {
    const fields = recordArgFields();
    expect(fields.verb.optional).toBe(false);
    expect(fields.path.optional).toBe(false);
    expect(fields.channel.optional).toBe(false);
    expect(fields.timestamp.optional).toBe(false);
  });

  it("declares target/resolved/providerAffinity/voiceId/reason/scope/sessionId as optional", () => {
    const fields = recordArgFields();
    for (const key of [
      "target",
      "resolved",
      "providerAffinity",
      "voiceId",
      "reason",
      "scope",
      "sessionId",
    ] as const) {
      expect(fields[key].optional).toBe(true);
    }
  });

  it("declares timestamp as a numeric field (matches v.float64())", () => {
    const fields = recordArgFields();
    expect(fields.timestamp.fieldType.type).toBe("number");
  });

  // 108-07 gap closure (second round, live proof): providerAffinity was
  // v.optional(v.string()), but astridr's swap_model.py always emits a real
  // list[str] on the success path — the mismatch silently refused every
  // successful swap. Reads the live validator (not a hand-typed literal),
  // so a future regression back to v.string() fails this test.
  it("declares providerAffinity as an array of strings (matches v.optional(v.array(v.string())), not a scalar)", () => {
    const fields = recordArgFields();
    expect(fields.providerAffinity.optional).toBe(true);
    expect(fields.providerAffinity.fieldType).toEqual({
      type: "array",
      value: { type: "string" },
    });
  });
});

describe("isBrainSwap — verb discriminator (pure helper)", () => {
  it("returns true for a swap_model row", () => {
    expect(isBrainSwap({ verb: "swap_model" })).toBe(true);
  });

  it("returns false for a swap_voice row", () => {
    expect(isBrainSwap({ verb: "swap_voice" })).toBe(false);
  });

  it("returns false for an unexpected verb value (defensive-boundary convention)", () => {
    expect(isBrainSwap({ verb: "something_else" })).toBe(false);
  });
});

// CR-01 guard: record must be an internalMutation, never a public mutation,
// and must be invoked ONLY through the internal. namespace from the ingest
// path. This is the same regression guard shape as activeEngine.test.ts's
// CR-01 block, for the same reason: a public `mutation` builder would let
// any holder of the shipped VITE_CONVEX_URL forge a "server-confirmed"
// swap-history row from browser devtools, which the D-15 GlobalSwapModal
// history section would then render as truth.
describe("CR-01 — record authorization boundary (source-level guard)", () => {
  const controlVerbSwapsPath = path.resolve(__dirname, "./controlVerbSwaps.ts");

  it("declares record with internalMutation, never with a public mutation builder", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/record\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("stays true even though the file's own docstrings mention the word 'mutation'", () => {
    // Sanity check on the stripping itself: the raw (unstripped) file DOES
    // contain the word "mutation" in prose — if it didn't, the negative
    // assertion above would be vacuous.
    const raw = readFileSync(controlVerbSwapsPath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });
});

describe("bounded read — listByScope never .collect()s", () => {
  const controlVerbSwapsPath = path.resolve(__dirname, "./controlVerbSwaps.ts");

  it("uses .take( and never .collect( on the append-only table", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/\.take\(/);
    expect(source).not.toMatch(/\.collect\(/);
  });

  it("imports SWAP_HISTORY_CAP from the shared filters module and uses it (not a duplicated literal) inside .take(", () => {
    // 2026-08-07 (bundling defect fix, 108-REVIEW.md): SWAP_HISTORY_CAP moved out of this file into
    // controlVerbSwapsFilters.ts (a pure module with no `_generated/server` import), so this file no
    // longer DECLARES the constant — it imports it. Asserting the import line (not a re-declaration)
    // is what keeps this test failing if a future edit reintroduces a hardcoded/duplicated literal.
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(
      /import\s*\{[^}]*SWAP_HISTORY_CAP[^}]*\}\s*from\s*["']\.\/controlVerbSwapsFilters["']/
    );
    expect(source).not.toMatch(/export const SWAP_HISTORY_CAP/);
    expect(source).toMatch(/\.take\(SWAP_HISTORY_CAP\)/);
  });

  it("SWAP_HISTORY_CAP constant equals 20, matching the modal-history sizing rationale", () => {
    expect(SWAP_HISTORY_CAP).toBe(20);
  });
});

// Post-execution gap closure (adversarial mutation-testing pass, 2026-08-07): a mutation
// replacing `.withIndex("by_scope", (q) => q.eq("scope", args.profileId))` with
// `.withIndex("by_timestamp")` — dropping the per-profile scope filter entirely, so every
// caller receives every profile's swap history — left all prior tests in this file passing.
// No test called listByScope, referenced "by_scope" outside a describe() label, or checked
// the .withIndex(...) argument.
//
// SOURCE-LEVEL GUARD ONLY — be honest about what this proves. This is a regex match against
// the source text of listByScope's body, defeatable by rewording (e.g. renaming the index
// while preserving its semantics, or restructuring the query builder call) without this test
// noticing. It does NOT prove per-profile isolation behaviorally — this repo has no
// convex-test harness to seed two profiles' rows and assert listByScope("personal") never
// returns a "business" row. That real behavioral proof is deferred to plan 108-07 Step 4(b),
// which reads listByScope for two profiles against the live self-hosted backend.
describe("listByScope — scope filter present (source-level guard, not behavioral proof)", () => {
  const controlVerbSwapsPath = path.resolve(__dirname, "./controlVerbSwaps.ts");

  it("scopes the read to args.profileId via the by_scope index (not by_timestamp or an unfiltered read)", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    // Sanity check on the slice itself: prove the text this test matches against is actually
    // present and non-empty, so the assertions below can't pass vacuously against an empty or
    // mismatched slice (same idiom as the CR-01 block's raw/stripped sanity check above).
    const listByScopeStart = source.indexOf("export const listByScope");
    expect(listByScopeStart).toBeGreaterThan(-1);
    const body = source.slice(listByScopeStart, listByScopeStart + 400);
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain(".withIndex(");

    expect(body).toMatch(/\.withIndex\(\s*"by_scope"/);
    expect(body).toMatch(/q\.eq\(\s*"scope"\s*,\s*args\.profileId\s*\)/);
  });
});

// Phase 109 (TELE-02, D-11): listGlobal is the new bounded query matching
// absent-scope (global) rows. D-11's own text says "reading the same
// by_scope index at scope: null" — implementing that literally returns zero
// rows forever, silently, because a stored global row's scope key is ABSENT,
// never present-with-null (runtimeIngest.ts's normalizeOptional strips null
// to undefined before storage; Convex's v.optional(...) rejects an explicit
// null outright). The mutation-proof block below is the guard against that
// exact regression reappearing.
describe("listGlobal — bounded query matching absent-scope (global) rows (Phase 109, D-11)", () => {
  const controlVerbSwapsPath = path.resolve(__dirname, "./controlVerbSwaps.ts");

  it("declares listGlobal as query({ args: {}, ... }) — a read, taking no arguments", () => {
    const exportArgs = (listGlobal as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    // Convex serializes an empty `args: {}` object validator as an "object"
    // fieldType with an empty `value` map — proves no argument crept in,
    // reading the LIVE validator object, not a hand-typed literal (same
    // idiom as the record-args-shape block above).
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.value)).toEqual([]);
  });

  it("does not widen listByScope's exported validator shape (unchanged signature)", () => {
    const exportArgs = (listByScope as unknown as { exportArgs: () => string }).exportArgs;
    const schema = JSON.parse(exportArgs());
    expect(Object.keys(schema.value)).toEqual(["profileId"]);
    expect(schema.value.profileId.optional).toBe(false);
  });

  it("matches on q.eq('scope', undefined), never q.eq('scope', null) (comment-stripped source)", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/q\.eq\(\s*"scope"\s*,\s*undefined\s*\)/);
    expect(source).not.toMatch(/q\.eq\(\s*"scope"\s*,\s*null\s*\)/);
  });

  it("is registered with query(, not internalMutation/mutation — record stays the file's only internalMutation( (CR-01 regression guard)", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/listGlobal\s*=\s*query\(/);
    const internalMutationMatches = source.match(/=\s*internalMutation\(/g) ?? [];
    expect(internalMutationMatches.length).toBe(1);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("takes SWAP_HISTORY_CAP and never .collect()s, in listGlobal's own body", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    const listGlobalStart = source.indexOf("export const listGlobal");
    expect(listGlobalStart).toBeGreaterThan(-1);
    const body = source.slice(listGlobalStart, listGlobalStart + 400);
    expect(body).toMatch(/\.take\(SWAP_HISTORY_CAP\)/);
    expect(source).not.toMatch(/\.collect\(\)/);
  });
});
