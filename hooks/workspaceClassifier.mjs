// CodePulse Workspace Classifier (D-02, D-07, D-09, D-14).
//
// Pure classification: (path, config) -> { department, access, isSecret }. Zero I/O — no
// filesystem module of any kind, no YAML parser, no filesystem-touching path helpers. That
// purity is what makes D-12's dry-run gate meaningful (the classifier can be run against
// alternate rule sets with nothing but a config object) and what keeps this module
// unit-testable without a real disk or a real compose file. `hooks/workspaceScan.mjs`
// (115-07/08) owns all I/O and passes already-read/already-parsed data in.
//
// D-02 is deny-by-default, not a "does this look secret" regex, because the donor's
// enumerating secret-shaped pattern was measured against Larry's real tree and returned
// PUBLIC for all four of: `convex-selfhost/selfhosted.envfile` (holds INSTANCE_SECRET), `.claude.json`
// (holds an inline `Authorization: Bearer` token), `.mcp.json`, and `generate_admin_key.sh`.
// An enumerating regex fails OPEN on every shape nobody anticipated; an allowlist fails
// CLOSED. `config/workspace.json`'s `shareableAllowlist.default.extensions` deliberately
// omits `.json .yml .yaml .toml .ini .cfg .conf .env .envfile .pem .key .crt .cer .p12 .pfx
// .ppk .sh .bash .zsh .ps1 .psm1 .bat .cmd .vbs .sql .db .sqlite .sqlite3 .log .csv .tsv
// .bak .keychain .kdbx`, plus every extensionless file — re-adding any of those reopens a
// measured hole. This module must stay I/O-free so D-02's refusal stays mutation-testable.

import { DEPARTMENTS, UNCLASSIFIED } from "./workspaceConfig.mjs";

/**
 * Normalize a path/segment for comparison: backslashes -> forward slashes, collapse
 * doubled separators, strip a trailing separator. Every path entering any rule below goes
 * through this FIRST — the donor's rules use `/` literals while a Windows-joined path
 * produces `\`, so an un-normalized rule silently never matches.
 */
export function normalizeRel(p) {
  return String(p)
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "");
}

function lowerIfWin32(s, platform) {
  return (platform ?? process.platform) === "win32" ? String(s).toLowerCase() : String(s);
}

/** True when `name` (a single path segment, not a full path) is a configured exclude dir. */
export function isExcludedDir(name, config, platform) {
  const dirs = Array.isArray(config?.excludeDirs) ? config.excludeDirs : [];
  const candidate = lowerIfWin32(name, platform);
  return dirs.some((d) => lowerIfWin32(d, platform) === candidate);
}

/** True when `basename` is a configured exclude file. */
export function isExcludedFile(basename, config, platform) {
  const files = Array.isArray(config?.excludeFiles) ? config.excludeFiles : [];
  const candidate = lowerIfWin32(basename, platform);
  return files.some((f) => lowerIfWin32(f, platform) === candidate);
}

/**
 * The allowlist that applies to `rootId`. `byRoot[rootId]`, when present, REPLACES
 * `default` for that root entirely — it does not merge (config's own
 * `_byRootSemantics` field records this).
 */
export function allowlistForRoot(rootId, config) {
  const byRoot = config?.shareableAllowlist?.byRoot;
  if (byRoot && Object.prototype.hasOwnProperty.call(byRoot, rootId)) {
    return byRoot[rootId];
  }
  return config?.shareableAllowlist?.default;
}

/**
 * The D-02 core. Deny by default: a file is shareable only on an explicit allowlist
 * match for its root's extension list, and a dotfile is refused before extension
 * matching is even attempted (`requireNonDotBasename`) — that single rule is what fails
 * CLOSED on `.claude.json` and `.mcp.json`. No "does it look secret" test anywhere in
 * this function; the question is strictly "does it look shareable."
 */
export function isShareable(basename, rootId, config) {
  const allowlist = allowlistForRoot(rootId, config);
  if (!allowlist) return false;

  const base = String(basename);
  if (allowlist.requireNonDotBasename && base.startsWith(".")) return false;

  const lastDot = base.lastIndexOf(".");
  if (lastDot <= 0) return false; // no dot, or dot at index 0 (already handled above)

  const ext = base.slice(lastDot).toLowerCase();
  if (ext.length <= 1) return false; // trailing dot with nothing after it -> empty extension

  const extensions = Array.isArray(allowlist.extensions) ? allowlist.extensions : [];
  return extensions.includes(ext);
}

/**
 * Look up `rootId` in `config.roots`. Returns its declared department if and only if
 * that value is in the fixed DEPARTMENTS vocabulary; otherwise Unclassified (D-14). No
 * code path here can return a real department for a root that is not explicitly
 * declared with that value.
 */
export function resolveRootDepartment(rootId, config) {
  const roots = Array.isArray(config?.roots) ? config.roots : [];
  const root = roots.find((r) => r && r.id === rootId);
  if (root && DEPARTMENTS.includes(root.department)) return root.department;
  return UNCLASSIFIED;
}

/**
 * `{ department, isSecret }` for one file. `isSecret` is the explicit, single-sited
 * complement of `isShareable` — the structural expression of D-02's inversion.
 */
export function classifyFile({ rootId, relPath, basename }, config) {
  return {
    department: resolveRootDepartment(rootId, config),
    isSecret: !isShareable(basename, rootId, config),
  };
}
