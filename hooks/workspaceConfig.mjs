// CodePulse Workspace Config Loader (D-08, D-17)
// Merges the tracked classification rules (config/workspace.json) with the gitignored
// local root list (config/workspace.local.json), local winning on collision, and fails
// CLOSED to tracked-roots-only on any local read/parse/version failure.
//
// No shebang here — same reason as hooks/scanner.mjs: this file is never invoked as
// `./workspaceConfig.mjs` anywhere in the repo, only imported (by hooks/workspaceScan.mjs,
// 115-08/09) or run directly via `node hooks/workspaceConfig.mjs`, and Vite/Rolldown's SSR
// transform (used by this file's own test file) hoists imports above line 1 — a shebang
// there breaks parsing.

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export const DEPARTMENTS = ["Work", "Consulting", "Personal", "Unclassified"];
export const UNCLASSIFIED = "Unclassified";
export const CONFIG_SCHEMA_VERSION = 1;

function normalizePath(p) {
  return String(p).replace(/\\/g, "/").replace(/\/+$/, "");
}

function normalizeRoot(root) {
  const department =
    root && DEPARTMENTS.includes(root.department) ? root.department : UNCLASSIFIED;
  return {
    ...root,
    path: normalizePath(root && root.path != null ? root.path : ""),
    department,
  };
}

/**
 * Merge the tracked rules config with the local (gitignored) root list.
 * PURE — no I/O. This is the unit under test; `loadWorkspaceConfig` is the only I/O wrapper.
 *
 * @param {object} tracked - Parsed config/workspace.json. Must be valid: absent/malformed/
 *   wrong schemaVersion THROWS. The tracked file is a repo artifact; its absence is a build
 *   defect, not a runtime condition — this is the one place a throw is correct (D-17).
 * @param {object|null} local - Parsed config/workspace.local.json, or null if absent/
 *   malformed/unreadable. D-17's fail-closed path: null (or a schemaVersion mismatch)
 *   returns the tracked config UNCHANGED (tracked roots only) — never "scan everything
 *   unclassified", never a throw.
 * @returns {object} The merged config plus a `localConfigStatus` field:
 *   "absent" | "version-mismatch" | "merged".
 */
export function mergeWorkspaceConfig(tracked, local) {
  if (!tracked || typeof tracked !== "object" || tracked.schemaVersion !== CONFIG_SCHEMA_VERSION) {
    throw new Error(
      "workspaceConfig: tracked config is missing, malformed, or has an unsupported schemaVersion — this is a repo build defect, not a runtime condition"
    );
  }

  const trackedRoots = Array.isArray(tracked.roots) ? tracked.roots.map(normalizeRoot) : [];

  if (!local || typeof local !== "object") {
    return { ...tracked, roots: trackedRoots, localConfigStatus: "absent" };
  }
  if (local.schemaVersion !== tracked.schemaVersion) {
    return { ...tracked, roots: trackedRoots, localConfigStatus: "version-mismatch" };
  }

  const localRoots = Array.isArray(local.roots) ? local.roots.map(normalizeRoot) : [];

  // Merge roots by id — local wins on collision (replaces, does not duplicate); a local
  // root with a new id is appended.
  const mergedRootsById = new Map(trackedRoots.map((r) => [r.id, r]));
  for (const r of localRoots) {
    mergedRootsById.set(r.id, r);
  }

  // Merge at the key level, local winning on collision (D-17), then force the
  // already-merged `roots` array over whatever either side had.
  return {
    ...tracked,
    ...local,
    roots: Array.from(mergedRootsById.values()),
    localConfigStatus: "merged",
  };
}

/**
 * I/O wrapper: reads config/workspace.json (repo-relative) and config/workspace.local.json,
 * then returns mergeWorkspaceConfig's result. The tracked read is unguarded (a missing/
 * malformed tracked file throws, matching mergeWorkspaceConfig's contract). The local read
 * is wrapped in existsSync + try/catch — on ANY failure, `null` is passed to
 * mergeWorkspaceConfig, which is D-17's fail-closed path.
 *
 * @param {object} [deps] - Injectable overrides for testability only (same shape/intent as
 *   hooks/scanner.mjs's `deps` param — every real call site omits it and gets identical
 *   behavior to before this parameter existed).
 */
export function loadWorkspaceConfig(deps = {}) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const {
    repoRoot = join(__dirname, ".."),
    readFileSync: readFile = readFileSync,
    existsSync: exists = existsSync,
  } = deps;

  const trackedPath = join(repoRoot, "config", "workspace.json");
  const tracked = JSON.parse(readFile(trackedPath, "utf-8"));

  let local = null;
  const localPath = join(repoRoot, "config", "workspace.local.json");
  if (exists(localPath)) {
    try {
      local = JSON.parse(readFile(localPath, "utf-8"));
    } catch {
      local = null;
    }
  }

  return mergeWorkspaceConfig(tracked, local);
}

// Allow direct execution for manual sanity checks: node hooks/workspaceConfig.mjs
const isDirectRun =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("workspaceConfig.mjs");

if (isDirectRun) {
  const config = loadWorkspaceConfig();
  console.log(
    `[workspaceConfig] status=${config.localConfigStatus} roots=${config.roots.length}`
  );
}
