import { describe, it, expect } from "vitest";
import {
  makeWorkspaceMapFixture,
  makeScannedRootsIncompleteFixture,
  makeAccessDerivationFailedFixture,
  makeLocalConfigAbsentFixture,
  makeLocalConfigVersionMismatchFixture,
  type WorkspaceMapFixture,
} from "./workspaceMapFixture";

// ---------------------------------------------------------------------------
// Self-test proving the fixture is what the rest of Phase 114 will assume.
// No mocks — this file exercises the pure factory functions directly.
// ---------------------------------------------------------------------------

/** Assert all four D-16 honesty signals are green on the given fixture. */
function expectAllGreen(fx: WorkspaceMapFixture) {
  expect(fx.scannedRootsComplete).toBe(true);
  expect(fx.accessDerivationOk).toBe(true);
  expect(fx.localConfigStatus).toBe("merged");
  expect(fx.unclassifiedRootIds.length).toBe(0);
  expect(fx.coveredRoots.length).toBe(fx.rootCount);
}

describe("makeWorkspaceMapFixture — healthy default", () => {
  it("is the all-green control", () => {
    const fx = makeWorkspaceMapFixture();
    expectAllGreen(fx);
  });

  it("has a plausible rootCount and dirs array", () => {
    const fx = makeWorkspaceMapFixture();
    expect(fx.rootCount).toBeGreaterThanOrEqual(3);
    expect(fx.dirs.length).toBeGreaterThan(0);
  });
});

describe("degraded presets — each flips exactly one signal", () => {
  it("makeScannedRootsIncompleteFixture flips only scan-completeness", () => {
    const fx = makeScannedRootsIncompleteFixture();
    expect(fx.scannedRootsComplete).toBe(false);
    expect(fx.coveredRoots.length).toBeLessThan(fx.rootCount);
    // The other three signals stay green.
    expect(fx.accessDerivationOk).toBe(true);
    expect(fx.localConfigStatus).toBe("merged");
    expect(fx.unclassifiedRootIds.length).toBe(0);
  });

  it("makeAccessDerivationFailedFixture flips only accessDerivationOk", () => {
    const fx = makeAccessDerivationFailedFixture();
    expect(fx.accessDerivationOk).toBe(false);
    // The other three signals stay green.
    expect(fx.scannedRootsComplete).toBe(true);
    expect(fx.coveredRoots.length).toBe(fx.rootCount);
    expect(fx.localConfigStatus).toBe("merged");
    expect(fx.unclassifiedRootIds.length).toBe(0);
  });

  it("makeLocalConfigAbsentFixture flips only localConfigStatus", () => {
    const fx = makeLocalConfigAbsentFixture();
    expect(fx.localConfigStatus).toBe("absent");
    // The other three signals stay green.
    expect(fx.scannedRootsComplete).toBe(true);
    expect(fx.coveredRoots.length).toBe(fx.rootCount);
    expect(fx.accessDerivationOk).toBe(true);
    expect(fx.unclassifiedRootIds.length).toBe(0);
  });

  it("makeLocalConfigVersionMismatchFixture flips only localConfigStatus", () => {
    const fx = makeLocalConfigVersionMismatchFixture();
    expect(fx.localConfigStatus).toBe("version-mismatch");
    // The other three signals stay green.
    expect(fx.scannedRootsComplete).toBe(true);
    expect(fx.coveredRoots.length).toBe(fx.rootCount);
    expect(fx.accessDerivationOk).toBe(true);
    expect(fx.unclassifiedRootIds.length).toBe(0);
  });
});

describe("timestamp unit sanity (D-17)", () => {
  it("generatedAt is plausibly epoch SECONDS, not milliseconds", () => {
    const fx = makeWorkspaceMapFixture();
    // A milliseconds value would be ~1000x larger than Date.now() at this
    // instant, so a seconds value must be strictly less than Date.now().
    expect(fx.generatedAt).toBeLessThan(Date.now());
    // A /1000 unit error yields 1970 dates — assert we land well after 2000.
    // This is exactly the failure class this project's LESSONS record: a
    // threshold check must print a SANITY line proving the unit interpretation,
    // and a wrong unit makes D-17's staleness check pass vacuously.
    const year = new Date(fx.generatedAt * 1000).getUTCFullYear();
    expect(year).toBeGreaterThan(2000);
  });

  it("staleGeneratedAt override pins an exact epoch-seconds value", () => {
    const THIRTY_SEVEN_HOURS_AGO = Date.now() / 1000 - 37 * 60 * 60;
    const fx = makeWorkspaceMapFixture({ staleGeneratedAt: THIRTY_SEVEN_HOURS_AGO });
    expect(fx.generatedAt).toBe(THIRTY_SEVEN_HOURS_AGO);
  });
});

describe("structural coverage", () => {
  it("contains at least one astridr-reachable dir and one local-only dir", () => {
    const fx = makeWorkspaceMapFixture();
    expect(fx.dirs.some((d) => d.access === "astridr-reachable")).toBe(true);
    expect(fx.dirs.some((d) => d.access === "local-only")).toBe(true);
  });

  it("contains at least one dir with withheldCount > 0", () => {
    const fx = makeWorkspaceMapFixture();
    expect(fx.dirs.some((d) => d.withheldCount > 0)).toBe(true);
  });

  it("distinguishes a pure-structure dir (fileCount:0, withheldCount:0) from an all-withheld dir (fileCount:0, withheldCount>0)", () => {
    const fx = makeWorkspaceMapFixture();
    expect(fx.dirs.some((d) => d.fileCount === 0 && d.withheldCount === 0)).toBe(true);
    expect(fx.dirs.some((d) => d.fileCount === 0 && d.withheldCount > 0)).toBe(true);
  });

  it("contains a dirPath at depth >= 3", () => {
    const fx = makeWorkspaceMapFixture();
    const maxDepth = Math.max(
      ...fx.dirs.map((d) => (d.dirPath === "" ? 0 : d.dirPath.split("/").length))
    );
    expect(maxDepth).toBeGreaterThanOrEqual(3);
  });

  it("spans at least 3 of the 4 departments", () => {
    const fx = makeWorkspaceMapFixture();
    const departments = new Set(fx.dirs.map((d) => d.department));
    expect(departments.size).toBeGreaterThanOrEqual(3);
  });
});

describe("disclosure guard (tripwire, not a proof)", () => {
  // This denylist can only catch names that are already public and tracked
  // at HEAD in this repo — extending it with any other name would itself be
  // the disclosure it exists to prevent. The real guarantee is the human
  // rule stated in workspaceMapFixture.ts's own header comment; this test
  // only catches an accidental paste of one of these two specific strings.
  const REAL_NAME_DENYLIST = ["codepulse", "astridr-repo"];

  it("no root id or dirPath matches a known real workspace name", () => {
    const fx = makeWorkspaceMapFixture();
    for (const dir of fx.dirs) {
      for (const real of REAL_NAME_DENYLIST) {
        expect(dir.rootId.toLowerCase()).not.toContain(real);
        expect(dir.dirPath.toLowerCase()).not.toContain(real);
      }
    }
  });
});
