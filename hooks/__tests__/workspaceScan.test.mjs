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
  classificationView,
  runWorkspaceScan,
} from "../workspaceScan.mjs";
import {
  canonicalReportHash,
  REPORT_RELPATH,
  APPROVAL_MARKER_RELPATH,
} from "../workspaceApproval.mjs";

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
// Suite 4b — D-06 regression: directory identity must not lose precision (2026-08-18).
//
// ROOT CAUSE of an intermittent Suite 4 failure. `fs.Stats.ino` is a JS double; on Windows the
// NTFS 64-bit FileId routinely exceeds Number.MAX_SAFE_INTEGER (measured: 11,692 of 11,700
// sampled directories, 99.9%), so low-order bits round away and directories created
// milliseconds apart COLLAPSE TO THE SAME NUMBER. The cycle guard then reads a real subtree as
// "we have been here" and silently prunes it — a truncated map, counted as a cycle.
//
// Measured under 8-way parallel load: 215 collisions with `number`, ZERO with
// `{ bigint: true }`; the walk truncated in 2 of 480 stress runs (cyclesSkipped=1, deep row
// missing). Every observed collision was between ADJACENT directories, the signature of
// sequential FileId allocation losing low bits.
//
// Suite 4 could only catch this ~0.4% of the time under load, so it is not a guard. This suite
// is DETERMINISTIC: the injected statSync returns inos that collide when the options argument
// is ignored (the old `statSync(p)` form) and are distinct when it is honoured. Reverting
// workspaceScan.mjs's dirIdentity to a numeric stat turns this RED every run.
// =========================================================================================
describe("Suite 4b — D-06: directory identity survives 64-bit inodes", () => {
  it("does not prune a real subtree whose inode collides only at double precision", () => {
    const dir = mkRoot();
    try {
      // Two nested real directories, each holding one shareable file.
      mkdirSync(join(dir, "alpha", "beta"), { recursive: true });
      writeFileSync(join(dir, "alpha", "note.md"), "a");
      writeFileSync(join(dir, "alpha", "beta", "note.md"), "b");

      const alpha = join(dir, "alpha");
      const beta = join(dir, "alpha", "beta");

      // Two distinct 64-bit FileIds that differ ONLY below 2^53, so they are indistinguishable
      // as doubles but distinct as BigInt — exactly the real-world adjacent-allocation case.
      const INO_ALPHA = 9851624188909056n;
      const INO_BETA = 9851624188909057n;
      expect(Number(INO_ALPHA)).toBe(Number(INO_BETA)); // the precision loss, asserted

      const fakeStat = (p, opts) => {
        const real = statSync(p, opts);
        const bigint = !!(opts && opts.bigint);
        if (p === alpha) return { ...real, dev: bigint ? 1n : 1, ino: bigint ? INO_ALPHA : Number(INO_ALPHA), isDirectory: () => true };
        if (p === beta) return { ...real, dev: bigint ? 1n : 1, ino: bigint ? INO_BETA : Number(INO_BETA), isDirectory: () => true };
        return real;
      };

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const result = walkRoot(root, config, { readdirSync, statSync: fakeStat, mountedSet: new Set() });
      const rollup = rollupRootResults([{ rootId: root.id, ...result }]);

      // beta is a REAL directory, not a cycle. Under the old numeric identity it was pruned.
      const betaRow = rollup.dirs.find((d) => d.dirPath === "alpha/beta");
      expect(betaRow).toBeDefined();
      expect(betaRow.fileCount).toBe(1);
      expect(result.cyclesSkipped).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CONTROL: a genuine repeat of the same identity IS still pruned as a cycle", () => {
    // Without this control the test above would pass against a walker with no cycle guard at
    // all — it would prove only that nothing is pruned, not that the RIGHT thing is pruned.
    const dir = mkRoot();
    try {
      mkdirSync(join(dir, "alpha", "beta"), { recursive: true });
      writeFileSync(join(dir, "alpha", "note.md"), "a");
      writeFileSync(join(dir, "alpha", "beta", "note.md"), "b");

      const alpha = join(dir, "alpha");
      const beta = join(dir, "alpha", "beta");
      const SAME = 9851624188909056n;

      const fakeStat = (p, opts) => {
        const real = statSync(p, opts);
        const bigint = !!(opts && opts.bigint);
        if (p === alpha || p === beta) {
          return { ...real, dev: bigint ? 1n : 1, ino: bigint ? SAME : Number(SAME), isDirectory: () => true };
        }
        return real;
      };

      const root = { id: "fixture", path: dir };
      const config = makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
      const result = walkRoot(root, config, { readdirSync, statSync: fakeStat, mountedSet: new Set() });
      const rollup = rollupRootResults([{ rootId: root.id, ...result }]);

      expect(rollup.dirs.find((d) => d.dirPath === "alpha/beta")).toBeUndefined();
      expect(result.cyclesSkipped).toBe(1);
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
      // Forwards opts so the walker's `{ bigint: true }` identity stat is not silently
      // downgraded to numeric precision by this wrapper (see workspaceScan.mjs dirIdentity).
      const wrappedStat = (p, opts) => {
        if (p === brokenAbs) throw new Error("ENOENT simulated");
        return statSync(p, opts);
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

  it("excludes generatedAt from the hash (two reports differing only there hash identically)", () => {
    const config = fixtureConfig([{ id: "r1", department: "Personal" }]);
    const rollup = fixtureRollup([fixtureRow()]);
    const base = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
    const laterTime = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 999999 });
    expect(canonicalReportHash(hashableView(base))).toBe(canonicalReportHash(hashableView(laterTime)));
  });

  // The D-12 hash is a CLASSIFICATION hash, not a file-inventory hash (rewritten
  // 2026-08-12). Both directions are asserted, because a hash that never changes
  // is as broken as one that always changes — and only the pair distinguishes
  // "stable across churn" from "stable because it hashes nothing".
  describe("classificationView — what must and must not invalidate an approval", () => {
    // makeConfig, NOT fixtureConfig: fixtureConfig declares no excludeDirs and no
    // allowlist, so every "removing an exclusion invalidates" style assertion would
    // mutate an empty array and pass vacuously.
    const config = makeConfig({ roots: [{ id: "r1", department: "Personal" }] });
    const rollup = fixtureRollup([fixtureRow()]);
    const base = buildDryRunReport({ config, rollup, mountedOk: true, generatedAt: 1000 });
    const h = (r) => canonicalReportHash(classificationView(r));

    it("GUARD: the fixture is non-degenerate, so the mutations below are real", () => {
      expect(base.classification.excludeDirs.length).toBeGreaterThan(0);
      expect(base.classification.excludeFiles.length).toBeGreaterThan(0);
      expect(base.classification.allowlistDefault.extensions.length).toBeGreaterThan(0);
      expect(base.rootSummary.length).toBeGreaterThan(0);
    });

    it("file CHURN does not invalidate: totals, per-root counts and bytes are excluded", () => {
      const churned = {
        ...base,
        totals: { ...base.totals, files: base.totals.files + 7, bytes: base.totals.bytes + 4096, withheldFiles: base.totals.withheldFiles + 1 },
        rootSummary: base.rootSummary.map((r) => ({ ...r, fileCount: r.fileCount + 7, bytes: r.bytes + 4096 })),
        departmentCounts: { ...base.departmentCounts, Personal: { dirs: 99, files: 999, bytes: 9999 } },
        sample: [],
      };
      expect(h(churned)).toBe(h(base));
    });

    it("a DEPARTMENT change invalidates", () => {
      const moved = { ...base, rootSummary: base.rootSummary.map((r) => ({ ...r, department: "Work" })) };
      expect(h(moved)).not.toBe(h(base));
    });

    it("WIDENING the allowlist invalidates — the change the old whole-report hash could not even see", () => {
      const widened = {
        ...base,
        classification: {
          ...base.classification,
          allowlistDefault: {
            ...base.classification.allowlistDefault,
            extensions: [...base.classification.allowlistDefault.extensions, ".env"].sort(),
          },
        },
      };
      expect(h(widened)).not.toBe(h(base));
    });

    it("dropping a directory EXCLUSION invalidates", () => {
      const fewer = {
        ...base,
        classification: { ...base.classification, excludeDirs: base.classification.excludeDirs.slice(1) },
      };
      expect(h(fewer)).not.toBe(h(base));
    });

    it("a root LOSING coverage invalidates", () => {
      const partial = {
        ...base,
        coverage: { ...base.coverage, coveredRoots: [], scannedRootsComplete: false },
      };
      expect(h(partial)).not.toBe(h(base));
    });

    it("a NEW root invalidates", () => {
      const added = {
        ...base,
        rootSummary: [...base.rootSummary, { rootId: "r2", department: "Unclassified", access: "local-only", covered: true, evidence: "", dirCount: 0, fileCount: 0, bytes: 0, withheldCount: 0 }],
      };
      expect(h(added)).not.toBe(h(base));
    });

    it("editing a root's EVIDENCE prose does not invalidate — the department is what was approved", () => {
      const reworded = {
        ...base,
        rootSummary: base.rootSummary.map((r) => ({ ...r, evidence: "totally different wording" })),
      };
      expect(h(reworded)).toBe(h(base));
    });

    it("localConfigStatus falling off the merged path invalidates (D-17 fail-closed)", () => {
      const degraded = { ...base, localConfigStatus: "absent" };
      expect(h(degraded)).not.toBe(h(base));
    });
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

// =========================================================================================
// runWorkspaceScan — D-12 case 5, the mandatory integration control (115-VALIDATION.md).
//
// "inject a deps.postSnapshot spy; run the real entry point with approval invalid -> spy
// NEVER called — refusal happens before fetch()." Cases 1-4 of the mandatory five-case table
// live in hooks/__tests__/workspaceApproval.test.mjs (plan 115-03); this is case 5.
//
// Real readdirSync/statSync run against a real mkdtempSync fixture tree (walkRoot is
// exercised for real, never mocked). Report/marker I/O (writeFileSync/existsSync/readFileSync
// at REPORT_RELPATH/APPROVAL_MARKER_RELPATH) is redirected to an in-memory fake disk so no
// test ever touches the real config/ directory on this host.
// =========================================================================================

/** A tiny in-memory key/value "disk" keyed by the exact relpath strings runWorkspaceScan
 * passes (REPORT_RELPATH / APPROVAL_MARKER_RELPATH) — never a real filesystem path. */
function makeFakeDisk() {
  const files = new Map();
  return {
    files,
    writeFileSync: (path, data) => {
      files.set(path, data);
    },
    existsSync: (path) => files.has(path),
    readFileSync: (path) => {
      if (!files.has(path)) {
        const err = new Error(`ENOENT: no such file, open '${path}'`);
        err.code = "ENOENT";
        throw err;
      }
      return files.get(path);
    },
  };
}

/** Wires a fixture config + injected postSnapshot spy into a runWorkspaceScan deps object.
 * readdirSync/statSync are the REAL node:fs functions (applied to the caller's real
 * mkdtempSync tree); everything else is the fake in-memory disk above. */
function makeRunDeps({ config, postSnapshot, now = () => 1000, logger }) {
  const disk = makeFakeDisk();
  return {
    disk,
    deps: {
      loadConfig: () => config,
      readdirSync,
      statSync,
      writeFileSync: disk.writeFileSync,
      existsSync: disk.existsSync,
      readFileSync: disk.readFileSync,
      postSnapshot,
      now,
      logger: logger ?? { log: () => {}, error: () => {} },
    },
  };
}

function makeFixtureConfig(dir) {
  return makeConfig({ roots: [{ id: "fixture", path: dir, department: "Personal" }] });
}

describe("runWorkspaceScan — D-12 case 5 integration control (115-VALIDATION.md)", () => {
  it("(a) CONTROL — a VALID approval reaches the POST exactly once. LOAD-BEARING: without this, every never-called assertion below is satisfiable by an entry point that never posts at all.", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (url, key, body) => {
        spyCalls.push({ url, key, body });
        return { ok: true, status: 200 };
      };
      const { deps } = makeRunDeps({ config, postSnapshot });

      const dryRunResult = await runWorkspaceScan({ mode: "dry-run" }, deps);
      expect(dryRunResult.status).toBe("dry-run");
      expect(spyCalls.length).toBe(0);

      const approveResult = await runWorkspaceScan({ mode: "approve" }, deps);
      expect(approveResult.status).toBe("approved");
      expect(approveResult.reportHash).toBe(dryRunResult.reportHash);

      const ingestResult = await runWorkspaceScan(
        { mode: "ingest", codepulseUrl: "http://example.invalid", ingestKey: "test-key" },
        deps
      );

      expect(spyCalls.length).toBe(1);
      expect(ingestResult.status).toBe("ingested");
      expect(ingestResult.exitCode).toBe(0);
      expect(spyCalls[0].url).toBe("http://example.invalid/workspace-ingest");
      expect(spyCalls[0].body.dryRunReportHash).toBe(dryRunResult.reportHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(b) CASE 5 — marker ABSENT: postSnapshot is NEVER called; status refused, exitCode 3", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (...args) => {
        spyCalls.push(args);
        return { ok: true, status: 200 };
      };
      const { deps } = makeRunDeps({ config, postSnapshot });

      // No dry-run, no approve — the marker never existed.
      const result = await runWorkspaceScan(
        { mode: "ingest", codepulseUrl: "http://example.invalid", ingestKey: "test-key" },
        deps
      );

      expect(spyCalls.length).toBe(0);
      expect(result.status).toBe("refused");
      expect(result.exitCode).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // CASE 5 was ONE test whose name described widening the allowlist while its body
  // merely added a file. Those are different events and, since the 2026-08-12 hash
  // rewrite, they have deliberately different outcomes — so it is now two tests.
  // Keeping them fused would have meant the "allowlist widened" scenario the name
  // promises was never actually exercised.

  it("(c1) CASE 5 — a file appearing after approval does NOT refuse: this is the nightly-run case, and refusing here would make D-05 impossible", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (...args) => {
        spyCalls.push(args);
        return { ok: true, status: 200 };
      };
      const { deps } = makeRunDeps({ config, postSnapshot });

      await runWorkspaceScan({ mode: "dry-run" }, deps);
      await runWorkspaceScan({ mode: "approve" }, deps);

      // Ordinary churn: a new visible file. On the real tree the file count moved
      // three times in as many consecutive walks, so over 24 hours this is certain.
      writeFileSync(join(dir, "NEW.md"), "added after approval");

      const result = await runWorkspaceScan(
        { mode: "ingest", codepulseUrl: "http://example.invalid", ingestKey: "test-key" },
        deps
      );

      expect(result.status).toBe("ingested");
      expect(spyCalls.length).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(c2) CASE 5 — the allowlist WIDENED after approval: postSnapshot is NEVER called. The scenario the old test named but never exercised.", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (...args) => {
        spyCalls.push(args);
        return { ok: true, status: 200 };
      };
      // The loader is injected, so widening the allowlist between approve and ingest
      // is exactly what a config edit does in production.
      let live = config;
      const { deps } = makeRunDeps({ config, postSnapshot });
      deps.loadConfig = () => live;

      await runWorkspaceScan({ mode: "dry-run" }, deps);
      await runWorkspaceScan({ mode: "approve" }, deps);

      live = {
        ...config,
        shareableAllowlist: {
          ...config.shareableAllowlist,
          default: {
            ...config.shareableAllowlist.default,
            extensions: [...config.shareableAllowlist.default.extensions, ".env"],
          },
        },
      };

      const result = await runWorkspaceScan(
        { mode: "ingest", codepulseUrl: "http://example.invalid", ingestKey: "test-key" },
        deps
      );

      expect(spyCalls.length).toBe(0);
      expect(result.status).toBe("refused");
      expect(result.exitCode).toBe(3);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(d) CASE 5 — marker CORRUPTED (not hash-shaped): postSnapshot is NEVER called", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (...args) => {
        spyCalls.push(args);
        return { ok: true, status: 200 };
      };
      const { disk, deps } = makeRunDeps({ config, postSnapshot });
      disk.writeFileSync(APPROVAL_MARKER_RELPATH, "not-a-hash\n");

      const result = await runWorkspaceScan(
        { mode: "ingest", codepulseUrl: "http://example.invalid", ingestKey: "test-key" },
        deps
      );

      expect(spyCalls.length).toBe(0);
      expect(result.status).toBe("refused");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(e) none of the refusal cases (b)/(c)/(d) throw or reject — a throw under the hidden nightly task would be swallowed and read as success", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const postSnapshot = async () => ({ ok: true, status: 200 });

      // (b) absent marker
      {
        const { deps } = makeRunDeps({ config, postSnapshot });
        await expect(
          runWorkspaceScan({ mode: "ingest", codepulseUrl: "http://x.invalid", ingestKey: "k" }, deps)
        ).resolves.toBeDefined();
      }
      // (d) corrupted marker
      {
        const { disk, deps } = makeRunDeps({ config, postSnapshot });
        disk.writeFileSync(APPROVAL_MARKER_RELPATH, "not-a-hash\n");
        await expect(
          runWorkspaceScan({ mode: "ingest", codepulseUrl: "http://x.invalid", ingestKey: "k" }, deps)
        ).resolves.toBeDefined();
      }
      // (c) stale marker
      {
        const driftFile = join(dir, "DRIFT_E.md");
        const { deps } = makeRunDeps({ config, postSnapshot });
        await runWorkspaceScan({ mode: "dry-run" }, deps);
        await runWorkspaceScan({ mode: "approve" }, deps);
        writeFileSync(driftFile, "x");
        await expect(
          runWorkspaceScan({ mode: "ingest", codepulseUrl: "http://x.invalid", ingestKey: "k" }, deps)
        ).resolves.toBeDefined();
        rmSync(driftFile);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(f) the refusal message leaks no absolute path, filename, or ingest key — fixed-string checks only", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "SECRET_FILENAME_MARKER.md"), "x");
      const config = makeFixtureConfig(dir);
      const postSnapshot = async () => ({ ok: true, status: 200 });
      const ingestKeySecret = "sk-super-secret-key-123";
      const errors = [];
      const logger = { log: () => {}, error: (msg) => errors.push(String(msg)) };
      const { deps } = makeRunDeps({ config, postSnapshot, logger });

      await runWorkspaceScan(
        { mode: "ingest", codepulseUrl: "http://x.invalid", ingestKey: ingestKeySecret },
        deps
      );

      const combined = errors.join("\n");
      expect(errors.length).toBeGreaterThan(0); // sanity: something was actually logged
      expect(combined.includes(dir)).toBe(false);
      expect(combined.includes(dir.replace(/\\/g, "/"))).toBe(false);
      expect(combined.includes("SECRET_FILENAME_MARKER.md")).toBe(false);
      expect(combined.includes(ingestKeySecret)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(g) --dry-run never posts even when a VALID marker is already present — proves the mode branch, not the gate, suppresses the post in dry-run", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (...args) => {
        spyCalls.push(args);
        return { ok: true, status: 200 };
      };
      const { deps } = makeRunDeps({ config, postSnapshot });

      await runWorkspaceScan({ mode: "dry-run" }, deps);
      await runWorkspaceScan({ mode: "approve" }, deps);

      const result = await runWorkspaceScan({ mode: "dry-run" }, deps);
      expect(spyCalls.length).toBe(0);
      expect(result.status).toBe("dry-run");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(h) --approve never posts; the marker is written with the CURRENT report's hash on its first line", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const spyCalls = [];
      const postSnapshot = async (...args) => {
        spyCalls.push(args);
        return { ok: true, status: 200 };
      };
      const { disk, deps } = makeRunDeps({ config, postSnapshot });

      const dryRunResult = await runWorkspaceScan({ mode: "dry-run" }, deps);
      const approveResult = await runWorkspaceScan({ mode: "approve" }, deps);

      expect(spyCalls.length).toBe(0);
      expect(approveResult.status).toBe("approved");
      const markerContents = disk.files.get(APPROVAL_MARKER_RELPATH);
      expect(markerContents).toBeDefined();
      expect(markerContents.split(/\r?\n/)[0].trim()).toBe(dryRunResult.reportHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(i) --approve refuses when no report exists on disk; no marker is written", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const postSnapshot = async () => ({ ok: true, status: 200 });
      const { disk, deps } = makeRunDeps({ config, postSnapshot });

      const result = await runWorkspaceScan({ mode: "approve" }, deps);
      expect(result.exitCode).not.toBe(0);
      expect(disk.files.has(APPROVAL_MARKER_RELPATH)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(j) reportHash is excluded from its own hash — re-hashing the written artifact off disk equals its own stored reportHash field", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);
      const postSnapshot = async () => ({ ok: true, status: 200 });
      const { disk, deps } = makeRunDeps({ config, postSnapshot });

      const dryRunResult = await runWorkspaceScan({ mode: "dry-run" }, deps);
      const written = JSON.parse(disk.files.get(REPORT_RELPATH));

      expect(written).toHaveProperty("reportHash", dryRunResult.reportHash);
      expect(canonicalReportHash(hashableView(written))).toBe(written.reportHash);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("(k) a failed POST is not reported as success, with a passing CONTROL (a succeeding spy yields exitCode 0) — the non-zero assertion is not satisfiable by an always-failing path", async () => {
    const dir = mkRoot();
    try {
      writeFileSync(join(dir, "README.md"), "hello");
      const config = makeFixtureConfig(dir);

      // Failing spy.
      {
        const failPost = async () => ({ ok: false, status: 500 });
        const { deps } = makeRunDeps({ config, postSnapshot: failPost });
        await runWorkspaceScan({ mode: "dry-run" }, deps);
        await runWorkspaceScan({ mode: "approve" }, deps);
        const result = await runWorkspaceScan(
          { mode: "ingest", codepulseUrl: "http://x.invalid", ingestKey: "k" },
          deps
        );
        expect(result.status).toBe("post-failed");
        expect(result.exitCode).toBe(4);
      }
      // CONTROL: succeeding spy on an equivalent fresh approval.
      {
        const okPost = async () => ({ ok: true, status: 200 });
        const { deps } = makeRunDeps({ config, postSnapshot: okPost });
        await runWorkspaceScan({ mode: "dry-run" }, deps);
        await runWorkspaceScan({ mode: "approve" }, deps);
        const result = await runWorkspaceScan(
          { mode: "ingest", codepulseUrl: "http://x.invalid", ingestKey: "k" },
          deps
        );
        expect(result.status).toBe("ingested");
        expect(result.exitCode).toBe(0);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
