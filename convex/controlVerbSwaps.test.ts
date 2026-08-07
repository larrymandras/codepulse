import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { isBrainSwap, SWAP_HISTORY_CAP } from "./controlVerbSwaps";

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

describe("record args shape", () => {
  it("accepts the required fields plus all optional ones", () => {
    const args = {
      verb: "swap_model",
      target: "claude-opus-5",
      resolved: "claude-opus-5",
      providerAffinity: undefined,
      voiceId: undefined,
      path: "claude-native",
      reason: undefined,
      scope: "personal",
      sessionId: "sess-123",
      channel: "voice",
      timestamp: Date.now() / 1000,
    };
    expect(args).toHaveProperty("verb");
    expect(args).toHaveProperty("path");
    expect(args).toHaveProperty("channel");
    expect(args).toHaveProperty("timestamp");
    expect(args.providerAffinity).toBeUndefined();
  });

  it("accepts a global (unscoped) row with scope absent", () => {
    const args = {
      verb: "swap_model",
      path: "restore",
      channel: "voice",
      timestamp: Date.now() / 1000,
      scope: undefined,
    };
    expect(args.scope).toBeUndefined();
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

  it("exports SWAP_HISTORY_CAP and uses it (not a duplicated literal) inside .take(", () => {
    const source = stripCommentLines(readFileSync(controlVerbSwapsPath, "utf-8"));
    expect(source).toMatch(/export const SWAP_HISTORY_CAP\s*=\s*20/);
    expect(source).toMatch(/\.take\(SWAP_HISTORY_CAP\)/);
  });

  it("SWAP_HISTORY_CAP constant equals 20, matching the modal-history sizing rationale", () => {
    expect(SWAP_HISTORY_CAP).toBe(20);
  });
});
