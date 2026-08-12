// Fixture tests proving D-01 (structural read-incapability), D-03 (secret omission), D-13
// (directory-only granularity), D-06 (excludeDirs pruning / no depth cap), coverage honesty,
// and the D-12 dry-run report's determinism + mandated contents.
//
// Real mkdtempSync trees throughout — fs is never mocked. Every fixture is cleaned up in a
// `finally` block with rmSync({ recursive: true, force: true }).
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  walkRoot,
  rollupRootResults,
  loadMountedSet,
  buildSnapshot,
  buildDryRunReport,
  hashableView,
} from "../workspaceScan.mjs";
import { canonicalReportHash } from "../workspaceApproval.mjs";

const DEFAULT_EXTENSIONS = [".md", ".markdown", ".tsx", ".ts", ".txt"];

function makeConfig({ roots = [], excludeDirs = ["node_modules", ".git"] } = {}) {
  return {
    schemaVersion: 1,
    snapshotId: "fixture-workspace",
    excludeDirs,
    excludeFiles: [".DS_Store"],
    shareableAllowlist: {
      default: { requireNonDotBasename: true, extensions: DEFAULT_EXTENSIONS },
      byRoot: {},
    },
    roots,
    localConfigStatus: "merged",
  };
}

function mkRoot(prefix = "workspace-scan-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

function walkAndRollup(root, config, mountedSet = new Set()) {
  const result = walkRoot(root, config, { readdirSync, statSync, mountedSet });
  const rollup = rollupRootResults([{ rootId: root.id, ...result }]);
  return { result, rollup };
}

// =========================================================================================
// Suite 1 — D-03: no secret filename appears in the payload, with a both-directions control.
// =========================================================================================
describe("Suite 1 — D-03: secret filenames never appear in the payload", () => {
  it("withholds three real credential-shaped basenames from the snapshot and counts them, never mixing with the two visible files", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      writeFileSync(join(dir, "App.tsx"), "export default function App() {}");
      writeFileSync(join(dir, "selfhosted.envfile"), "INSTANCE_SECRET=x");
      writeFileSync(join(dir, ".mcp.json"), "{}");
      writeFileSync(join(dir, "generate_admin_key.sh"), "#!/bin/sh");

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);
      const snapshot = buildSnapshot({
        config,
        rollup,
        mountedOk: false,
        dryRunReportHash: "0".repeat(64),
        generatedAt: 1000,
      });
      const serialized = JSON.stringify(snapshot);

      expect(serialized.includes("selfhosted.envfile")).toBe(false);
      expect(serialized.includes(".mcp.json")).toBe(false);
      expect(serialized.includes("generate_admin_key.sh")).toBe(false);

      const row = rollup.dirs.find((d) => d.rootId === "fixture" && d.dirPath === "");
      expect(row.withheldCount).toBe(3);
      expect(row.fileCount).toBe(2);
      // CONTROL: the split is real — not "everything withheld" or "everything visible".
      expect(row.withheldCount).not.toBe(5);
      expect(row.fileCount).not.toBe(5);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CONTROL: zero secret files yields withheldCount 0 / fileCount 2 — the counter is driven by classification, not a constant", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      writeFileSync(join(dir, "App.tsx"), "export default function App() {}");
      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);
      const row = rollup.dirs.find((d) => d.dirPath === "");
      expect(row.withheldCount).toBe(0);
      expect(row.fileCount).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 2 — D-13: no filename AT ALL, secret or visible, appears in the payload.
// =========================================================================================
describe("Suite 2 — D-13: no filename appears in the payload at all, secret or visible", () => {
  it("a VISIBLE basename does not appear in the serialized snapshot either — visible files are counts, not nodes", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      writeFileSync(join(dir, "selfhosted.envfile"), "INSTANCE_SECRET=x");
      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);
      const snapshot = buildSnapshot({
        config,
        rollup,
        mountedOk: false,
        dryRunReportHash: "0".repeat(64),
        generatedAt: 1000,
      });
      const serialized = JSON.stringify(snapshot);
      expect(serialized.includes("README.md")).toBe(false);
      expect(serialized.includes("selfhosted.envfile")).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 3 — Pitfall 1: the size aggregate excludes withheld bytes and is INVARIANT under
// adding/removing a secret file.
// =========================================================================================
describe("Suite 3 — Pitfall 1: totalSize excludes withheld bytes and is invariant", () => {
  it("totalSize equals the visible file's size exactly and stays unchanged after the secret file is deleted", () => {
    const dir = mkRoot();
    try {
      const visibleContent = "A".repeat(777);
      writeFileSync(join(dir, "README.md"), visibleContent);
      writeFileSync(join(dir, "selfhosted.envfile"), Buffer.alloc(4096, 1));

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });

      const { rollup: rollup1 } = walkAndRollup(root, config);
      const row1 = rollup1.dirs.find((d) => d.dirPath === "");
      expect(row1.totalSize).toBe(777);
      expect(row1.totalSize).not.toBe(777 + 4096);

      rmSync(join(dir, "selfhosted.envfile"));
      const { rollup: rollup2 } = walkAndRollup(root, config);
      const row2 = rollup2.dirs.find((d) => d.dirPath === "");
      // INVARIANT: a changing total is exactly Pitfall 1's leak signature.
      expect(row2.totalSize).toBe(777);
      expect(row2.fileCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 4 — D-06: excludeDirs pruning and no numeric depth cap.
// =========================================================================================
describe("Suite 4 — D-06: excludeDirs pruning and no numeric depth cap", () => {
  it("prunes node_modules entirely while still descending 11 levels deep under a non-excluded tree", () => {
    const dir = mkRoot();
    try {
      mkdirSync(join(dir, "node_modules", "deep", "deeper"), { recursive: true });
      writeFileSync(join(dir, "node_modules", "deep", "deeper", "x.md"), "should never be walked");

      const deepSegments = ["real", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
      const deepPath = join(dir, ...deepSegments);
      mkdirSync(deepPath, { recursive: true });
      writeFileSync(join(deepPath, "note.md"), "eleven levels deep");

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);

      expect(rollup.dirs.some((d) => d.dirPath.startsWith("node_modules"))).toBe(false);

      const deepRelPath = deepSegments.join("/");
      const deepRow = rollup.dirs.find((d) => d.dirPath === deepRelPath);
      expect(deepRow).toBeDefined();
      expect(deepRow.fileCount).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 5 — Coverage honesty, with a passing control.
// =========================================================================================
describe("Suite 5 — coverage honesty", () => {
  it("a missing root is absent from coveredRoots; scannedRootsComplete=false; the EXISTING root's rows are still present", () => {
    const existingDir = mkRoot();
    const missingDir = join(tmpdir(), `workspace-scan-does-not-exist-${Date.now()}`);
    try {
      writeFileSync(join(existingDir, "README.md"), "hi");
      const existingRoot = { id: "exists", path: existingDir };
      const missingRoot = { id: "missing", path: missingDir };
      const config = makeConfig({
        roots: [
          { id: "exists", path: existingDir, department: "Personal" },
          { id: "missing", path: missingDir, department: "Personal" },
        ],
      });

      const existingResult = walkRoot(existingRoot, config, { readdirSync, statSync, mountedSet: new Set() });
      const missingResult = walkRoot(missingRoot, config, { readdirSync, statSync, mountedSet: new Set() });
      const rollup = rollupRootResults([
        { rootId: "exists", ...existingResult },
        { rootId: "missing", ...missingResult },
      ]);

      expect(rollup.coveredRoots).toEqual(["exists"]);
      expect(rollup.coveredRoots).not.toContain("missing");
      expect(rollup.scannedRootsComplete).toBe(false);

      const existingRow = rollup.dirs.find((d) => d.rootId === "exists" && d.dirPath === "");
      expect(existingRow).toBeDefined();
      expect(existingRow.fileCount).toBe(1);

      expect(missingResult.rows).toEqual([]);
      expect(missingResult.covered).toBe(false);
    } finally {
      rmSync(existingDir, { recursive: true, force: true });
    }
  });

  it("CONTROL: when every declared root exists, scannedRootsComplete is true", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hi");
      const root = { id: "exists", path: dir };
      const config = makeConfig({ roots: [{ id: "exists", path: dir, department: "Personal" }] });
      const result = walkRoot(root, config, { readdirSync, statSync, mountedSet: new Set() });
      const rollup = rollupRootResults([{ rootId: "exists", ...result }]);
      expect(rollup.scannedRootsComplete).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 6 — a readdirSync throw mid-walk does not lose earlier/sibling rows.
// =========================================================================================
describe("Suite 6 — a readdirSync throw mid-walk does not lose sibling rows", () => {
  it("throws only for one subdirectory; the sibling's row is present, covered=false, walkRoot itself never throws", () => {
    const dir = mkRoot();
    try {
      mkdirSync(join(dir, "broken"));
      writeFileSync(join(dir, "broken", "hidden.md"), "never seen");
      mkdirSync(join(dir, "healthy"));
      writeFileSync(join(dir, "healthy", "seen.md"), "fine");

      const brokenAbs = join(dir, "broken");
      const wrappedReaddir = (p, opts) => {
        if (p === brokenAbs) throw new Error("EACCES simulated");
        return readdirSync(p, opts);
      };

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });

      let result;
      expect(() => {
        result = walkRoot(root, config, { readdirSync: wrappedReaddir, statSync, mountedSet: new Set() });
      }).not.toThrow();

      expect(result.covered).toBe(false);
      const healthyRow = result.rows.find((r) => r.dirPath === "healthy");
      expect(healthyRow).toBeDefined();
      expect(healthyRow.fileCount).toBe(1);
      const brokenRow = result.rows.find((r) => r.dirPath === "broken");
      expect(brokenRow).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 7 — a statSync throw on one file is counted, not fatal.
// =========================================================================================
describe("Suite 7 — a statSync throw on one file is counted, not fatal", () => {
  it("statFailures=1, the sibling file is still counted, the throwing file is neither visible nor withheld", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "ok.md"), "fine");
      writeFileSync(join(dir, "broken.md"), "boom");

      const brokenAbs = join(dir, "broken.md");
      const wrappedStat = (p) => {
        if (p === brokenAbs) throw new Error("ENOENT simulated");
        return statSync(p);
      };

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const result = walkRoot(root, config, { readdirSync, statSync: wrappedStat, mountedSet: new Set() });

      expect(result.statFailures).toBe(1);
      const row = result.rows.find((r) => r.dirPath === "");
      expect(row.fileCount).toBe(1); // only ok.md
      expect(row.withheldCount).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 8 — path separator normalization (Pitfall 5).
// =========================================================================================
describe("Suite 8 — path separator normalization", () => {
  it("every emitted dirPath contains no backslash, even several levels deep", () => {
    const dir = mkRoot();
    try {
      mkdirSync(join(dir, "alpha", "beta"), { recursive: true });
      writeFileSync(join(dir, "alpha", "beta", "note.md"), "x");
      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);
      for (const row of rollup.dirs) {
        expect(row.dirPath.includes(String.fromCharCode(92))).toBe(false);
      }
      expect(rollup.dirs.some((d) => d.dirPath === "alpha/beta")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 9 — epoch SECONDS, not milliseconds.
// =========================================================================================
describe("Suite 9 — epoch seconds, not milliseconds", () => {
  it("latestMtime for a just-written file is within a few seconds of now and well under 1e12", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "fresh.md"), "just written");
      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);
      const row = rollup.dirs.find((d) => d.dirPath === "");
      const nowSec = Math.floor(Date.now() / 1000);
      expect(row.latestMtime).toBeLessThan(1e12);
      expect(Math.abs(row.latestMtime - nowSec)).toBeLessThan(10);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 10 — loadMountedSet fails closed, with a passing control.
// =========================================================================================
describe("Suite 10 — loadMountedSet fails closed", () => {
  it("nonexistent composeFile -> ok:false, empty set, no throw", () => {
    const config = { composeFile: join(tmpdir(), `definitely-does-not-exist-${Date.now()}.yml`) };
    const result = loadMountedSet(config);
    expect(result.ok).toBe(false);
    expect(result.mounted.size).toBe(0);
  });

  it("malformed YAML -> ok:false, no throw", () => {
    const dir = mkRoot();
    try {
      const composeFile = join(dir, "bad-compose.yml");
      writeFileSync(composeFile, "{not: yaml: ][");
      expect(() => loadMountedSet({ composeFile })).not.toThrow();
      const result = loadMountedSet({ composeFile });
      expect(result.ok).toBe(false);
      expect(result.mounted.size).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CONTROL: a small valid compose file with one bind mount -> ok:true, set contains the mount", () => {
    const dir = mkRoot();
    const mountSourceDir = mkRoot("workspace-scan-mount-");
    try {
      const composeFile = join(dir, "docker-compose.yml");
      const mountSourceForward = mountSourceDir.replace(/\\/g, "/");
      writeFileSync(
        composeFile,
        `services:\n  app:\n    volumes:\n      - ${mountSourceForward}:/app/data\n`
      );
      const result = loadMountedSet({ composeFile });
      expect(result.ok).toBe(true);
      expect(result.mounted.size).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(mountSourceDir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 11 — access is applied (computed, not constant).
// =========================================================================================
describe("Suite 11 — access is applied", () => {
  it("resolveAccess reflects the mountedSet: astridr-reachable when mounted, local-only when empty", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "x");
      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });

      const mountedNormalized = dir.replace(/\\/g, "/").toLowerCase();
      const { rollup: rollupReachable } = walkAndRollup(root, config, new Set([mountedNormalized]));
      const rowReachable = rollupReachable.dirs.find((d) => d.dirPath === "");
      expect(rowReachable.access).toBe("astridr-reachable");

      const { rollup: rollupLocal } = walkAndRollup(root, config, new Set());
      const rowLocal = rollupLocal.dirs.find((d) => d.dirPath === "");
      expect(rowLocal.access).toBe("local-only");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// =========================================================================================
// Suite 12 — a REAL filesystem cycle terminates and is bounded, with a control.
//
// `mklink /J` (a Windows junction) works from an UNELEVATED shell — verified live in this
// environment before writing this test (only `mklink /D` symlinks need elevation/Developer
// Mode). This constructs an actual on-disk directory cycle: dir -> sub -> loop(junction back
// to dir) -> sub -> loop -> ... and runs the real walkRoot against it with real
// readdirSync/statSync (never injected fakes) — the whole point is exercising what the OS
// actually reports for a reparse point on this system, not a synthetic stand-in for it.
// =========================================================================================
describe("Suite 12 — a real filesystem cycle (Windows junction) terminates and is bounded", () => {
  it("walkRoot terminates against a real on-disk junction loop, counts it, and still finds the sibling shareable file (control)", () => {
    const dir = mkRoot("workspace-scan-cycle-");
    try {
      const sub = join(dir, "sub");
      mkdirSync(sub);
      writeFileSync(join(sub, "note.md"), "shareable file that must survive the cycle");

      const linkPath = join(sub, "loop");
      execSync(`cmd /c mklink /J "${linkPath}" "${dir}"`, { encoding: "utf-8", windowsHide: true });

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });

      const start = Date.now();
      const result = walkRoot(root, config, { readdirSync, statSync, mountedSet: new Set() });
      const elapsedMs = Date.now() - start;

      // TERMINATION: the call above returned at all (no hang) and did so fast — a walk that
      // actually looped forever would time out this whole test (default vitest timeout), not
      // merely run slowly.
      expect(elapsedMs).toBeLessThan(5000);
      expect(result.covered).toBe(true);
      expect(result.cyclesSkipped).toBeGreaterThanOrEqual(1);

      // CONTROL: the real subdirectory's file is still present. Without this, "terminated
      // with cyclesSkipped>=1" is indistinguishable from a walk that bailed out of the whole
      // root at the first sign of a reparse point rather than genuinely descending into `sub`
      // and only refusing to re-enter the loop.
      const subRow = result.rows.find((r) => r.dirPath === "sub");
      expect(subRow).toBeDefined();
      expect(subRow.fileCount).toBe(1);
      expect(subRow.withheldCount).toBe(0);
    } finally {
      // Verified separately (throwaway probe, not part of this suite): plain recursive
      // rmSync on the tree root does NOT follow the junction into its target — it completes
      // in ~1ms rather than hanging or deleting the target's contents twice. No special
      // junction-first removal step is required.
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15000);
});

// =========================================================================================
// buildDryRunReport (D-12) — mandated contents, determinism, no-absolute-path, warnings.
// Pure-function tests: hand-constructed config/rollup fixtures, no filesystem needed.
// =========================================================================================

function fixtureConfig(roots, overrides = {}) {
  return {
    schemaVersion: 1,
    snapshotId: "fixture-workspace",
    roots,
    localConfigStatus: "merged",
    ...overrides,
  };
}

function fixtureRow(overrides = {}) {
  return {
    rootId: "r1",
    dirPath: "",
    department: "Personal",
    access: "astridr-reachable",
    fileCount: 5,
    totalSize: 5000,
    latestMtime: 1000,
    withheldCount: 0,
    ...overrides,
  };
}

function fixtureRollup(rows, overrides = {}) {
  let totalFiles = 0;
  let totalWithheldFiles = 0;
  let totalBytes = 0;
  for (const row of rows) {
    totalFiles += row.fileCount;
    totalWithheldFiles += row.withheldCount;
    totalBytes += row.totalSize;
  }
  return {
    dirs: rows,
    totalDirs: rows.length,
    totalFiles,
    totalWithheldFiles,
    totalBytes,
    coveredRoots: ["r1"],
    scannedRootsComplete: true,
    statFailures: 0,
    cyclesSkipped: 0,
    ...overrides,
  };
}

describe("buildDryRunReport — D-12 mandated contents", () => {
  it("carries all four D-12-mandated contents by key presence", () => {
    const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
    const rollup = fixtureRollup([fixtureRow()]);
    const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
    expect(report).toHaveProperty("departmentCounts");
    expect(report.totals).toHaveProperty("withheldFiles");
    expect(report).toHaveProperty("unclassifiedRoots");
    expect(report).toHaveProperty("sample");
  });

  it("is deterministic: two calls on the same rollup produce the same canonical hash", () => {
    const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
    const rollup = fixtureRollup([fixtureRow(), fixtureRow({ dirPath: "sub", fileCount: 2, totalSize: 200 })]);
    const r1 = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
    const r2 = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
    expect(canonicalReportHash(hashableView(r1))).toBe(canonicalReportHash(hashableView(r2)));
  });

  it("excludes generatedAt from the hash (two reports differing only there hash identically), while a content change (totals.withheldFiles) hashes differently", () => {
    const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
    const rollup = fixtureRollup([fixtureRow()]);
    const base = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
    const laterTime = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 999999 });
    expect(canonicalReportHash(hashableView(base))).toBe(canonicalReportHash(hashableView(laterTime)));

    const mutated = { ...base, totals: { ...base.totals, withheldFiles: base.totals.withheldFiles + 1 } };
    expect(canonicalReportHash(hashableView(base))).not.toBe(canonicalReportHash(hashableView(mutated)));
  });

  it("emits no absolute host path — a fixture with a real tmp-dir root only ever surfaces rootId", () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hi");
      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const { rollup } = walkAndRollup(root, config);
      const report = buildDryRunReport({ config, rollup, mountedOk: false, generatedAt: 1000 });
      const serialized = JSON.stringify(report);
      // Fixed-string checks, both separator forms — never a hand-escaped backslash regex.
      expect(serialized.includes(dir)).toBe(false);
      expect(serialized.includes(dir.replace(/\\/g, "/"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  describe("warnings — one per condition, each with the CONTROL (a clean rollup yields none)", () => {
    it("CONTROL: a fully clean rollup yields an empty warnings array", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rollup = fixtureRollup([fixtureRow()]);
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings).toEqual([]);
    });

    it("scannedRootsComplete=false fires a warning", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rollup = fixtureRollup([fixtureRow()], { scannedRootsComplete: false });
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it("mountedOk=false (accessDerivationOk) fires a warning", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rollup = fixtureRollup([fixtureRow()]);
      const report = buildDryRunReport({ config, rollup, mountedOk: false, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it("statFailures > 0 fires a warning", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rollup = fixtureRollup([fixtureRow()], { statFailures: 1 });
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it("cyclesSkipped > 0 fires a warning", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rollup = fixtureRollup([fixtureRow()], { cyclesSkipped: 1 });
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it('localConfigStatus !== "merged" fires a warning', () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }], { localConfigStatus: "absent" });
      const rollup = fixtureRollup([fixtureRow()]);
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    });

    it("totals.dirs exceeding the 5000 threshold fires a warning", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rows = [];
      for (let i = 0; i < 5001; i++) {
        rows.push(fixtureRow({ dirPath: `d${i}`, fileCount: 0, totalSize: 0 }));
      }
      const rollup = fixtureRollup(rows);
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    }, 20000);

    it("RESEARCH Pitfall 4 signature: accessDerivationOk true with zero astridr-reachable dirs fires a warning", () => {
      const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
      const rollup = fixtureRollup([fixtureRow({ access: "local-only" })]);
      const report = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
      expect(report.warnings.length).toBeGreaterThan(0);
    });
  });
});
