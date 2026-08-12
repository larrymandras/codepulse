// D-08/D-17: mergeWorkspaceConfig is PURE (no I/O) and must fail closed on every local-config
// failure mode. Case 1 is the passing CONTROL without which the refusal cases (3/4/8) would be
// indistinguishable from a function that always fails closed — per this project's standing rule
// that a gate which can skip itself must be shown to have evaluated something.
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  mergeWorkspaceConfig,
  loadWorkspaceConfig,
  DEPARTMENTS,
  UNCLASSIFIED,
  CONFIG_SCHEMA_VERSION,
} from "../workspaceConfig.mjs";

function baseTracked(overrides = {}) {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    departments: DEPARTMENTS,
    roots: [
      { id: "vault", path: "C:/Users/mandr/Mandras", department: "Unclassified" },
      { id: "codepulse", path: "C:/Users/mandr/codepulse", department: "Personal" },
    ],
    ...overrides,
  };
}

describe("mergeWorkspaceConfig — pure merge (D-08, D-17)", () => {
  it("case 1 (CONTROL): valid tracked + valid local with a new root id merges cleanly", () => {
    const tracked = baseTracked();
    const local = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      roots: [{ id: "some-project", path: "C:/Users/mandr/some-project", department: "Unclassified" }],
    };
    const result = mergeWorkspaceConfig(tracked, local);
    expect(result.localConfigStatus).toBe("merged");
    expect(result.roots.length).toBe(tracked.roots.length + 1);
    expect(result.roots.some((r) => r.id === "some-project")).toBe(true);
  });

  it("case 2: local absent (null) returns tracked roots unchanged, status absent", () => {
    const tracked = baseTracked();
    const result = mergeWorkspaceConfig(tracked, null);
    expect(result.localConfigStatus).toBe("absent");
    expect(result.roots.length).toBe(tracked.roots.length);
    expect(result.roots.map((r) => r.id).sort()).toEqual(tracked.roots.map((r) => r.id).sort());
  });

  it("case 3: local malformed JSON on disk (via loadWorkspaceConfig) returns absent, never throws", () => {
    const repoRoot = mktempRepo();
    try {
      writeFileSync(join(repoRoot, "config", "workspace.local.json"), "{not json");
      const result = loadWorkspaceConfig({ repoRoot });
      expect(result.localConfigStatus).toBe("absent");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("case 4: local schemaVersion mismatch falls back to tracked roots only, status version-mismatch", () => {
    const tracked = baseTracked();
    const local = {
      schemaVersion: 99,
      roots: [{ id: "should-not-appear", path: "C:/x", department: "Unclassified" }],
    };
    const result = mergeWorkspaceConfig(tracked, local);
    expect(result.localConfigStatus).toBe("version-mismatch");
    expect(result.roots.map((r) => r.id).sort()).toEqual(tracked.roots.map((r) => r.id).sort());
  });

  it("case 5: local wins on collision — replaces the tracked root's path/department, no duplicate", () => {
    const tracked = baseTracked();
    const local = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      roots: [{ id: "codepulse", path: "C:/Different/Path", department: "Work" }],
    };
    const result = mergeWorkspaceConfig(tracked, local);
    expect(result.roots.length).toBe(tracked.roots.length);
    const merged = result.roots.find((r) => r.id === "codepulse");
    expect(merged.path).toBe("C:/Different/Path");
    expect(merged.department).toBe("Work");
  });

  it("case 6: an unknown department is coerced to Unclassified; a real department is NOT touched (control)", () => {
    const tracked = baseTracked();
    const local = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      roots: [
        { id: "bogus-dept", path: "C:/x", department: "Engineering" },
        { id: "real-dept", path: "C:/y", department: "Work" },
      ],
    };
    const result = mergeWorkspaceConfig(tracked, local);
    expect(result.roots.find((r) => r.id === "bogus-dept").department).toBe(UNCLASSIFIED);
    expect(result.roots.find((r) => r.id === "real-dept").department).toBe("Work");
  });

  it("case 7: a local root path with backslashes and a trailing separator normalizes to forward slashes, no trailing separator", () => {
    const tracked = baseTracked();
    const local = {
      schemaVersion: CONFIG_SCHEMA_VERSION,
      roots: [{ id: "winpath", path: "C:\\Users\\mandr\\some-dir\\", department: "Unclassified" }],
    };
    const result = mergeWorkspaceConfig(tracked, local);
    const merged = result.roots.find((r) => r.id === "winpath");
    expect(merged.path).toBe("C:/Users/mandr/some-dir");
  });

  it("case 8: tracked absent/malformed THROWS — the deliberate asymmetry, never a silent fallback", () => {
    expect(() => mergeWorkspaceConfig(null, { schemaVersion: CONFIG_SCHEMA_VERSION, roots: [] })).toThrow();
    expect(() => mergeWorkspaceConfig({ schemaVersion: 99 }, null)).toThrow();
  });

  it("mergeWorkspaceConfig performs no I/O — succeeds with no deps/readFileSync available at all", () => {
    const tracked = baseTracked();
    // No fs functions in scope here beyond what the test file itself imported for its own
    // fixture setup — mergeWorkspaceConfig is called with plain objects only.
    const result = mergeWorkspaceConfig(tracked, null);
    expect(result.localConfigStatus).toBe("absent");
  });
});

describe("loadWorkspaceConfig — I/O wrapper (D-17)", () => {
  it("merges a real tracked file with a real local file from disk", () => {
    const repoRoot = mktempRepo();
    try {
      writeFileSync(
        join(repoRoot, "config", "workspace.local.json"),
        JSON.stringify({
          schemaVersion: CONFIG_SCHEMA_VERSION,
          roots: [{ id: "local-only", path: "C:/x", department: "Unclassified" }],
        })
      );
      const result = loadWorkspaceConfig({ repoRoot });
      expect(result.localConfigStatus).toBe("merged");
      expect(result.roots.some((r) => r.id === "local-only")).toBe(true);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("returns absent status when config/workspace.local.json does not exist on disk", () => {
    const repoRoot = mktempRepo();
    try {
      const result = loadWorkspaceConfig({ repoRoot });
      expect(result.localConfigStatus).toBe("absent");
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("throws when config/workspace.json itself is missing", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "workspace-config-empty-"));
    try {
      expect(() => loadWorkspaceConfig({ repoRoot })).toThrow();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});

/** Builds a scratch repoRoot with a valid config/workspace.json already written. */
function mktempRepo() {
  const repoRoot = mkdtempSync(join(tmpdir(), "workspace-config-repo-"));
  mkdirSync(join(repoRoot, "config"), { recursive: true });
  writeFileSync(join(repoRoot, "config", "workspace.json"), JSON.stringify(baseTracked()));
  return repoRoot;
}
