/**
 * profilesRemoveConfig.test.ts — Phase 109-10.
 *
 * Source-level structural tests, matching this directory's existing convention
 * (`activeEngine.test.ts` et al): there is no convex-test runtime harness wired up here, so these
 * assert on the shipped source with full-line comments stripped, which is what stops a docstring
 * that merely MENTIONS `.delete()` or `profileConfigs` from satisfying an assertion about code.
 *
 * What these guard, concretely: `removeConfig` must delete exactly one row, seeked by index, and
 * must never become a bulk delete — the self-hosted single-node instance cannot absorb mass deletes
 * (CLAUDE.md; the 2026-07-21/22 tombstone incident took the dashboard down for days).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripCommentLines(source: string): string {
  return source
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

const RAW = readFileSync(path.join(__dirname, "profiles.ts"), "utf8");
const SRC = stripCommentLines(RAW);

/** The `removeConfig` handler body only, so assertions cannot be satisfied by other exports. */
function removeConfigBody(): string {
  const start = SRC.indexOf("export const removeConfig");
  expect(start).toBeGreaterThan(-1);
  const after = SRC.slice(start);
  const next = after.indexOf("\nexport const ", 1);
  return next === -1 ? after : after.slice(0, next);
}

describe("profiles.removeConfig — exists and is reachable", () => {
  it("is exported as a mutation, not a query", () => {
    const body = removeConfigBody();
    expect(body).toContain("mutation({");
    expect(body).not.toContain("query({");
  });

  it("takes profileId, so a caller must name exactly which profile to remove", () => {
    expect(removeConfigBody()).toMatch(/profileId:\s*v\.string\(\)/);
  });
});

describe("profiles.removeConfig — deletes exactly one row, and only from profileConfigs", () => {
  it("seeks the row by the by_profileId index rather than scanning the table", () => {
    const body = removeConfigBody();
    expect(body).toContain('.query("profileConfigs")');
    expect(body).toContain('withIndex("by_profileId"');
  });

  it("resolves a single document with .first(), never .collect()", () => {
    const body = removeConfigBody();
    expect(body).toContain(".first()");
    // A .collect() here would be the shape a bulk delete takes.
    expect(body).not.toContain(".collect()");
  });

  it("calls ctx.db.delete exactly once, and never inside a loop", () => {
    const body = removeConfigBody();
    const deleteCalls = body.match(/ctx\.db\.delete\(/g) ?? [];
    expect(deleteCalls).toHaveLength(1);
    // CONTROL against the bulk-delete shape the operational rules forbid.
    expect(body).not.toMatch(/for\s*\(/);
    expect(body).not.toMatch(/\.map\([^)]*ctx\.db\.delete/);
    expect(body).not.toMatch(/Promise\.all/);
  });

  it("does not delete from any other table", () => {
    const body = removeConfigBody();
    const queriedTables = [...body.matchAll(/\.query\("([^"]+)"\)/g)].map((m) => m[1]);
    expect(queriedTables).toEqual(["profileConfigs"]);
  });
});

describe("profiles.removeConfig — auditable and idempotent", () => {
  it("writes a configChanges audit row so a removal is traceable to an actor", () => {
    const body = removeConfigBody();
    expect(body).toContain('ctx.db.insert("configChanges"');
    expect(body).toMatch(/changedBy:\s*args\.changedBy\s*\?\?\s*"dashboard"/);
  });

  it("sets newValue to null, never undefined — configChanges.newValue is required, so undefined fails validation and aborts the delete", () => {
    // This exact defect shipped and was caught only by running the mutation against the live
    // instance: Convex omits undefined-valued fields, `schema.ts:271` declares
    // `newValue: v.any()` (REQUIRED, unlike `oldValue: v.optional(v.any())`), so the insert threw
    // and the row was never deleted. Every structural test here passed while that was broken.
    const body = removeConfigBody();
    expect(body).toContain("newValue: null");
    expect(body).not.toMatch(/newValue:\s*undefined/);
  });

  it("returns { deleted: false } for an absent profile instead of throwing", () => {
    const body = removeConfigBody();
    expect(body).toContain("if (!existing) return { deleted: false }");
    expect(body).toContain("return { deleted: true }");
  });

  it("orders the audit insert BEFORE the delete, so the old value is still readable when captured", () => {
    const body = removeConfigBody();
    const auditAt = body.indexOf('ctx.db.insert("configChanges"');
    const deleteAt = body.indexOf("ctx.db.delete(");
    expect(auditAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(auditAt).toBeLessThan(deleteAt);
  });
});

describe("profiles.ts — the delete gap this closes was real", () => {
  it("profileConfigs now has exactly one delete path, where before it had none", () => {
    // Guards against a second, unaudited delete path being added later.
    const deleteCalls = SRC.match(/ctx\.db\.delete\(/g) ?? [];
    expect(deleteCalls).toHaveLength(1);
  });
});
