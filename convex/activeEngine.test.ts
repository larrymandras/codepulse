import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { deduplicateByProfile } from "./activeEngine";

// Tests for Phase 103 (BSC-01, D-14): activeEngine backend service

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Strip full-line comments (// or *-prefixed doc-comment lines) so a
 * docstring that legitimately mentions the words "mutation" or
 * "recordRouting" cannot pollute a source-level grep-style assertion. */
function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("recordRouting args shape", () => {
  it("accepts all required fields plus optional selectionPath/expiresAt", () => {
    const args = {
      profileId: "personal",
      model: "claude-opus-5",
      mode: "pinned",
      selectionPath: "codepulse-default",
      expiresAt: undefined,
      timestamp: Date.now() / 1000,
    };
    expect(args).toHaveProperty("profileId");
    expect(args).toHaveProperty("model");
    expect(args).toHaveProperty("mode");
    expect(args).toHaveProperty("timestamp");
    expect(args.expiresAt).toBeUndefined();
  });
});

describe("deduplicateByProfile — latestByProfile logic", () => {
  it("keeps exactly one row per profile, the newest, given two profiles in descending-timestamp order", () => {
    // Rows ordered newest-first (as returned by by_timestamp desc)
    const rows = [
      { profileId: "personal", timestamp: 200, model: "claude-opus-5", mode: "pinned" },
      { profileId: "business", timestamp: 150, model: "gpt-5", mode: "inherited" },
      { profileId: "personal", timestamp: 100, model: "claude-sonnet-5", mode: "session" },
    ];
    const result = deduplicateByProfile(rows);
    expect(result).toHaveLength(2);
    const personal = result.find((r) => r.profileId === "personal");
    expect(personal!.timestamp).toBe(200);
    expect(personal!.model).toBe("claude-opus-5");
  });

  it("returns one row when a single profile has three snapshots", () => {
    const rows = [
      { profileId: "consulting", timestamp: 300, model: "claude-opus-5", mode: "pinned" },
      { profileId: "consulting", timestamp: 200, model: "gpt-5", mode: "session" },
      { profileId: "consulting", timestamp: 100, model: "claude-sonnet-5", mode: "inherited" },
    ];
    const result = deduplicateByProfile(rows);
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(300);
  });

  it("returns an empty array (never undefined) given an empty input", () => {
    const result = deduplicateByProfile([]);
    expect(result).toEqual([]);
    expect(result).not.toBeUndefined();
    expect(result).toHaveLength(0);
  });

  it("returns two profiles with two distinct model values — the Mixed-brains badge precondition", () => {
    const rows = [
      { profileId: "personal", timestamp: 200, model: "claude-opus-5", mode: "pinned" },
      { profileId: "business", timestamp: 190, model: "gpt-5", mode: "inherited" },
    ];
    const result = deduplicateByProfile(rows);
    expect(result).toHaveLength(2);
    const models = new Set(result.map((r) => r.model));
    expect(models.size).toBe(2);
    expect(models.has("claude-opus-5")).toBe(true);
    expect(models.has("gpt-5")).toBe(true);
  });
});

// CR-01 guard: recordRouting must be an internalMutation, never a public
// mutation, and must be invoked ONLY through the internal. namespace from
// the ingest path. This is the regression guard for the defect fixed in
// 103-10 — a public `mutation` builder let any holder of the shipped
// VITE_CONVEX_URL forge a "server-confirmed" active-engine row from browser
// devtools, which BrainHeaderBadge would then render with its
// isConfirmedLive trust-signal pulse dot (see 103-REVIEW.md CR-01).
describe("CR-01 — recordRouting authorization boundary (source-level guard)", () => {
  const activeEnginePath = path.resolve(__dirname, "./activeEngine.ts");
  const runtimeIngestPath = path.resolve(__dirname, "./runtimeIngest.ts");

  it("declares recordRouting with internalMutation, never with a public mutation builder", () => {
    const source = stripCommentLines(readFileSync(activeEnginePath, "utf-8"));
    expect(source).toMatch(/recordRouting\s*=\s*internalMutation\(/);
    expect(source).not.toMatch(/=\s*mutation\(/);
  });

  it("stays true even though the file's own docstrings mention the word 'mutation'", () => {
    // Sanity check on the stripping itself: the raw (unstripped) file DOES
    // contain the word "mutation" in prose — if it didn't, the negative
    // assertion above would be vacuous.
    const raw = readFileSync(activeEnginePath, "utf-8");
    expect(raw).toMatch(/mutation/i);
  });

  it("invokes recordRouting only through the internal. namespace from runtimeIngest.ts, never through api.", () => {
    const source = readFileSync(runtimeIngestPath, "utf-8");
    expect(source).toContain("internal.activeEngine.recordRouting");
    expect(source).not.toContain("api.activeEngine.recordRouting");
  });
});

// ── UAT 2026-07-29 (103-UAT.md test 2): the ingest path must not manufacture a reading ────────
//
// A source-level guard for the same reason the CR-01 block above is one: the defect is about what
// this file's own case is ALLOWED to write, and the behavior lives inside an httpAction this repo
// has no convex-test harness for. The predicate itself is behaviorally tested in
// activeEngineFilters.test.ts; this only pins that the model_routing case actually applies it and
// no longer substitutes the sentinel, so the guard cannot be quietly removed later.

describe("UAT test 2 — model_routing never stores an unresolved sentinel (source-level guard)", () => {
  const runtimeIngestPath = path.resolve(__dirname, "./runtimeIngest.ts");

  it("applies isUnresolvedRouting in the model_routing case", () => {
    const source = stripCommentLines(readFileSync(runtimeIngestPath, "utf-8"));
    expect(source).toContain("isUnresolvedRouting");
    expect(source).toMatch(/import\s*\{[^}]*isUnresolvedRouting[^}]*\}\s*from\s*"\.\/activeEngineFilters"/);
  });

  it("no longer coalesces the recordRouting profileId/model to the literal \"unknown\"", () => {
    const source = stripCommentLines(readFileSync(runtimeIngestPath, "utf-8"));
    // Scoped to the model_routing case body ONLY. Other cases (profile_config, session ids)
    // legitimately coalesce to "unknown" for display-only fields against different tables —
    // asserting on the whole file would fail on their correct usage, not on this defect.
    const caseStart = source.indexOf('case "model_routing"');
    const caseBody = source.slice(caseStart, caseStart + 900);
    // The two exact expressions that produced the production sentinel row.
    expect(caseBody).not.toContain('d.profileId ?? d.profile_id ?? "unknown"');
    expect(caseBody).not.toMatch(/model:\s*d\.model\s*\?\?\s*"unknown"/);
  });

  it("still guards the batch by skipping rather than throwing (WR-06/168-06 lesson)", () => {
    const source = stripCommentLines(readFileSync(runtimeIngestPath, "utf-8"));
    const caseStart = source.indexOf('case "model_routing"');
    expect(caseStart).toBeGreaterThan(-1);
    const caseBody = source.slice(caseStart, caseStart + 900);
    expect(caseBody).toMatch(/if\s*\(isUnresolvedRouting\([\s\S]*?\)\)\s*\{\s*break;/);
    expect(caseBody).not.toMatch(/throw\s+new/);
  });
});
