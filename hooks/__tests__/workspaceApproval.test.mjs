import { describe, it, expect } from "vitest";

/**
 * D-12's mandatory mutation test — cases 1-4 of 115-VALIDATION.md's five-case table.
 * (Case 5, the integration control asserting an injected postSnapshot spy is never called, is
 * built in plan 115-08 — it needs the entry point, which does not exist yet.)
 *
 * Cases 1-4, plus the nested-mutation regression guard (case 2b) and additional malformed-input
 * coverage, are all implemented here against hooks/workspaceApproval.mjs's pure functions.
 */

import {
  stableStringify,
  canonicalReportHash,
  isDryRunApproved,
  buildApprovalMarkerContents,
} from "../workspaceApproval.mjs";

// ---------------------------------------------------------------------------
// Fixture: a realistic, NESTED dry-run report shaped like 115-07's output.
// Must be nested at least 2 levels deep — a flat fixture cannot catch the
// replacer-array defect this module was built to avoid.
// ---------------------------------------------------------------------------

function buildReportA() {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-12T12:00:00.000Z",
    snapshotId: "workspace-scan-2026-08-12",
    departmentCounts: {
      Work: 1200,
      Consulting: 340,
      Personal: 890,
      Unclassified: 5300,
    },
    totals: {
      dirs: 412,
      files: 21029,
      bytes: 9876543210,
      withheldFiles: 14,
    },
    unclassifiedRoots: [
      { rootId: "vault", dirCount: 88, fileCount: 3694, bytes: 123456789 },
      { rootId: "claude", dirCount: 210, fileCount: 12152, bytes: 987654321 },
    ],
    coverage: {
      coveredRoots: ["vault", "claude", "claude-alt", "codepulse", "astridr-repo"],
      scannedRootsComplete: true,
    },
    accessDerivationOk: true,
    sample: [
      {
        dirPath: "codepulse/src/pages",
        rootId: "codepulse",
        department: "Personal",
        access: "local-only",
        fileCount: 42,
        withheldCount: 0,
      },
      {
        dirPath: "astridr-repo/convex",
        rootId: "astridr-repo",
        department: "Personal",
        access: "astridr-reachable",
        fileCount: 18,
        withheldCount: 1,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// stableStringify — canonical serialization invariants
// ---------------------------------------------------------------------------

describe("stableStringify — canonical serialization", () => {
  it("sorts object keys at every nesting level, not just the top", () => {
    const a = { z: 1, a: { n: 2, m: 1 } };
    const b = { a: { m: 1, n: 2 }, z: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("preserves array element order — arrays are never sorted", () => {
    const withOrder = { list: [3, 1, 2] };
    const reordered = { list: [1, 2, 3] };
    expect(stableStringify(withOrder)).not.toBe(stableStringify(reordered));
  });

  it("a nested key not present at the top level still affects the output (the replacer-array regression guard)", () => {
    // This is the exact shape JSON.stringify(report, Object.keys(report).sort()) would drop:
    // `deep` is a key that only exists nested, never at the top level of the object.
    const a = { top: { deep: 1 } };
    const b = { top: { deep: 2 } };
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });

  it("omits undefined-valued object keys, matching JSON.stringify", () => {
    const withUndefined = { a: 1, b: undefined };
    const withoutKey = { a: 1 };
    expect(stableStringify(withUndefined)).toBe(stableStringify(withoutKey));
  });

  it("serializes NaN and Infinity as null, never throwing or producing non-JSON output", () => {
    expect(stableStringify({ a: NaN })).toBe('{"a":null}');
    expect(stableStringify({ a: Infinity })).toBe('{"a":null}');
    expect(stableStringify({ a: -Infinity })).toBe('{"a":null}');
  });
});

// ---------------------------------------------------------------------------
// D-12 mandatory mutation test — cases 1-4
// ---------------------------------------------------------------------------

describe("isDryRunApproved — D-12 mandatory mutation test (115-VALIDATION.md cases 1-4)", () => {
  const A = buildReportA();
  const hashA = canonicalReportHash(A);
  const approvalForA = buildApprovalMarkerContents(hashA, { approvedAt: "2026-08-12T13:00:00.000Z" });

  it("CASE 1 — BASELINE CONTROL (must PASS): a marker built for A approves A's own hash", () => {
    // This is the control that makes cases 2-4 meaningful. Without a passing case here, four
    // `false` results below are indistinguishable from a function that always returns false.
    // Do not delete this as "redundant" with the refusal cases — it is the thing that proves
    // they are refusals and not just permanent no-ops.
    expect(isDryRunApproved(hashA, approvalForA)).toBe(true);
  });

  it("CASE 2 — content drift at the top level refuses a stale approval", () => {
    const B = buildReportA();
    B.totals.withheldFiles = B.totals.withheldFiles + 1;
    const hashB = canonicalReportHash(B);
    expect(hashB).not.toBe(hashA);
    expect(isDryRunApproved(hashB, approvalForA)).toBe(false);
  });

  it("CASE 2b — content drift NESTED below the top level refuses a stale approval (replacer-array regression guard)", () => {
    const C1 = buildReportA();
    C1.departmentCounts.Consulting = C1.departmentCounts.Consulting + 1;
    const hashC1 = canonicalReportHash(C1);
    // Assert the HASHES differ explicitly — not only that the boolean below is false, which
    // would also be false if canonicalReportHash were broken in the opposite direction (e.g.
    // always returning a constant).
    expect(hashC1).not.toBe(hashA);
    expect(isDryRunApproved(hashC1, approvalForA)).toBe(false);

    const C2 = buildReportA();
    C2.sample[0].department = "Work";
    const hashC2 = canonicalReportHash(C2);
    expect(hashC2).not.toBe(hashA);
    expect(isDryRunApproved(hashC2, approvalForA)).toBe(false);
  });

  it("CASE 3 — marker absent (null) refuses", () => {
    expect(isDryRunApproved(hashA, null)).toBe(false);
  });

  it("CASE 3b — marker absent (undefined) refuses", () => {
    expect(isDryRunApproved(hashA, undefined)).toBe(false);
  });

  it("CASE 4 — marker corrupted (not hash-shaped) refuses", () => {
    expect(isDryRunApproved(hashA, "not-a-real-hash")).toBe(false);
  });

  it("CASE 4b — marker holds a valid-shaped but WRONG 64-char hex hash refuses", () => {
    const wrongHash = "b".repeat(64);
    expect(wrongHash).not.toBe(hashA);
    expect(isDryRunApproved(hashA, wrongHash)).toBe(false);
  });

  it("CASE 4c — marker is an empty string refuses", () => {
    expect(isDryRunApproved(hashA, "")).toBe(false);
  });

  it("CASE 4d — marker is whitespace-only refuses", () => {
    expect(isDryRunApproved(hashA, "   \n\t  ")).toBe(false);
  });

  it("a marker with extra trailing content on the hash line refuses (no substring/prefix match)", () => {
    expect(isDryRunApproved(hashA, hashA + "extra")).toBe(false);
  });

  it("a marker holding the hash plus a comment line still approves (buildApprovalMarkerContents round-trip)", () => {
    expect(isDryRunApproved(hashA, approvalForA)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Stability — the property that stops the gate refusing a report Larry legitimately approved
// ---------------------------------------------------------------------------

describe("canonicalReportHash — stability", () => {
  it("hashing the same report object twice returns the same value", () => {
    const A = buildReportA();
    expect(canonicalReportHash(A)).toBe(canonicalReportHash(A));
  });

  it("a structurally identical object built with keys inserted in a different order hashes identically", () => {
    const A = buildReportA();
    const reordered = {
      sample: A.sample,
      accessDerivationOk: A.accessDerivationOk,
      coverage: { scannedRootsComplete: A.coverage.scannedRootsComplete, coveredRoots: A.coverage.coveredRoots },
      unclassifiedRoots: A.unclassifiedRoots,
      totals: { withheldFiles: A.totals.withheldFiles, bytes: A.totals.bytes, files: A.totals.files, dirs: A.totals.dirs },
      departmentCounts: {
        Unclassified: A.departmentCounts.Unclassified,
        Personal: A.departmentCounts.Personal,
        Consulting: A.departmentCounts.Consulting,
        Work: A.departmentCounts.Work,
      },
      snapshotId: A.snapshotId,
      generatedAt: A.generatedAt,
      schemaVersion: A.schemaVersion,
    };
    expect(canonicalReportHash(reordered)).toBe(canonicalReportHash(A));
  });

  it("produces a 64-char lowercase hex digest", () => {
    const hash = canonicalReportHash(buildReportA());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// Malformed hash input — a broken caller must not be able to approve anything
// ---------------------------------------------------------------------------

describe("isDryRunApproved — malformed reportHash input never throws, always refuses", () => {
  const A = buildReportA();
  const approvalForA = buildApprovalMarkerContents(canonicalReportHash(A));

  it("null reportHash refuses", () => {
    expect(() => isDryRunApproved(null, approvalForA)).not.toThrow();
    expect(isDryRunApproved(null, approvalForA)).toBe(false);
  });

  it("undefined reportHash refuses", () => {
    expect(() => isDryRunApproved(undefined, approvalForA)).not.toThrow();
    expect(isDryRunApproved(undefined, approvalForA)).toBe(false);
  });

  it("a too-short reportHash refuses", () => {
    expect(() => isDryRunApproved("short", approvalForA)).not.toThrow();
    expect(isDryRunApproved("short", approvalForA)).toBe(false);
  });

  it("a numeric reportHash refuses", () => {
    expect(() => isDryRunApproved(12345, approvalForA)).not.toThrow();
    expect(isDryRunApproved(12345, approvalForA)).toBe(false);
  });

  it("every malformed-input case above returns a boolean, never throws — a throw would be a crash, not a refusal, and a nightly hidden-task launch swallows thrown output silently", () => {
    const malformed = [null, undefined, "short", 12345, {}, [], NaN];
    for (const bad of malformed) {
      expect(() => isDryRunApproved(bad, approvalForA)).not.toThrow();
      expect(isDryRunApproved(bad, approvalForA)).toBe(false);
    }
  });
});
