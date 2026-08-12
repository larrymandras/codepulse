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
// omits `.json .yml .yaml .toml .ini .cfg .conf .pem .key .crt .cer .p12 .pfx .ppk .sh
// .bash .zsh .ps1 .psm1 .bat .cmd .vbs .sql .db .sqlite .sqlite3 .log .csv .tsv .bak
// .keychain .kdbx`, every dotenv-style config file, and every extensionless file —
// re-adding any of those reopens a measured hole. This module must stay I/O-free so D-02's
// refusal stays mutation-testable.

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

// ---------------------------------------------------------------------------------------
// D-09: access derived from Ástríðr's compose bind mounts. Still zero I/O — these take an
// already-parsed compose document (a YAML-parser `load()` result), never a file path.
//
// `access` reflects DECLARED bind-mount coverage from docker-compose.yml, NOT a live
// reachability probe: a mount can exist while the container lacks read permission, or
// while a Docker/WSL hiccup has left the mount empty. No live probe is in scope, and the
// field name was deliberately chosen to avoid implying live readability — Phase 114 must
// not render it as liveness.
// ---------------------------------------------------------------------------------------

const COMPOSE_TOKEN_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*):-([^}]*)\}/g;
const COMPOSE_TOKEN_ANY_RE = /\$\{[^}]*\}/;

/**
 * Replace every `${NAME:-default}` token, in place, anywhere in the string, with its
 * literal default — never a live environment variable, and never a real dotenv file under
 * astridr-repo (this project's env-file-guard hook blocks that read anyway; this module
 * doesn't even try). A token can
 * be a prefix of the source, not the whole source (`${FORGE_REPO_PATH:-C:\...}\.claude\
 * skills`), so this is a global in-place replace, not a whole-string check. If a `${...}`
 * token WITHOUT a `:-default` remains afterward, the source is unresolvable: return null.
 */
export function substituteComposeDefaults(raw) {
  const substituted = String(raw).replace(COMPOSE_TOKEN_RE, (_match, _name, def) => def);
  if (COMPOSE_TOKEN_ANY_RE.test(substituted)) return null;
  return substituted;
}

// Resolve a `./`/`../` relative path against a base by plain string segment arithmetic —
// deliberately not `path.resolve`, to keep this pure and platform-stable. Preserves a
// leading drive letter (`C:`) when the base has one.
function resolveAgainstBase(relPath, base) {
  const normBase = normalizeRel(base);
  const isDriveAbs = /^[A-Za-z]:(\/|$)/.test(normBase);
  const baseSegs = normBase.split("/").filter(Boolean);
  const relSegs = relPath.split("/").filter((s) => s !== "" && s !== ".");

  const segs = [...baseSegs];
  for (const seg of relSegs) {
    if (seg === "..") segs.pop();
    else segs.push(seg);
  }

  return isDriveAbs ? `${segs[0]}/${segs.slice(1).join("/")}` : `/${segs.join("/")}`;
}

/**
 * Normalize one mount SOURCE to an absolute forward-slash host path, or null if it is
 * not a host path at all (a named volume or a container-internal posix path).
 */
export function resolveComposeSource(rawSource, opts = {}) {
  const { composeDir = "", homeDir = "", platform } = opts;

  const substituted = substituteComposeDefaults(rawSource);
  if (substituted === null) return null;

  let s = normalizeRel(substituted);
  if (!s) return null;

  if (/^[A-Za-z]:\//.test(s)) {
    // Windows drive-absolute — use as-is.
  } else if (s === "~" || s.startsWith("~/")) {
    // `~` expansion — this is what makes `.claude-alt` reachable; it appears only as
    // cli-gateway's `~/.claude-alt`.
    const home = normalizeRel(homeDir);
    s = s === "~" ? home : home + s.slice(1);
  } else if (s === "." || s === ".." || s.startsWith("./") || s.startsWith("../")) {
    s = resolveAgainstBase(s, composeDir);
  } else if (s.startsWith("/")) {
    // Leading `/` and NOT drive-absolute -> a container-internal posix path
    // (/var/run/docker.sock). Not a host path.
    return null;
  } else {
    // No recognized separator prefix at all -> a named volume (astridr-data,
    // supabase-db-data). Not a host path.
    return null;
  }

  s = s.replace(/\/+$/, "");
  return lowerIfWin32(s, platform);
}

/**
 * One `volumes:` list element -> resolved host source, or null.
 * Object form (`{ type, source, target }`): only `type === "bind"` carries a host source;
 * the live compose file has zero object-form entries (30 of 30 are strings), so this
 * branch is future-proofing.
 * String form `src:dst[:mode]`: substitute defaults FIRST (so a drive-letter colon inside
 * a substituted default is not mistaken for a `src:dst` separator), THEN split on `:`.
 * Drive-letter handling: a single-character first segment matching [A-Za-z] means the
 * source is `letter:secondSegment` (`C:\Users\...`), not the bare letter.
 */
export function parseComposeVolumeEntry(entry, opts) {
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    if (entry.type === "bind" && typeof entry.source === "string") {
      return resolveComposeSource(entry.source, opts);
    }
    return null;
  }

  if (typeof entry !== "string") return null;

  const substituted = substituteComposeDefaults(entry);
  if (substituted === null) return null;

  const parts = substituted.split(":");
  const source =
    parts.length > 1 && parts[0].length === 1 && /^[A-Za-z]$/.test(parts[0])
      ? `${parts[0]}:${parts[1]}`
      : parts[0];

  return resolveComposeSource(source, opts);
}

/**
 * Union every service's bind mounts from a parsed compose document into one Set of
 * resolved host paths. Does NOT hardcode any service name — a named subset would miss
 * `.claude-alt` and `.claude.json`, which appear only under `cli-gateway`, not
 * `astridr`.
 *
 * `ok` is false when `parsedCompose` is null/malformed OR when the resulting set is
 * EMPTY. An empty set from a file that plainly has mounts is a silent parse failure
 * whose exact signature is every directory reporting `access: local-only` — treating
 * empty as `ok: false` is what makes that visible via `accessDerivationOk` on the
 * snapshot meta, instead of silent.
 */
export function deriveMountedPaths(parsedCompose, opts) {
  if (
    !parsedCompose ||
    typeof parsedCompose !== "object" ||
    !parsedCompose.services ||
    typeof parsedCompose.services !== "object"
  ) {
    return { mounted: new Set(), ok: false };
  }

  const mounted = new Set();
  for (const service of Object.values(parsedCompose.services)) {
    const volumes = service && Array.isArray(service.volumes) ? service.volumes : [];
    for (const entry of volumes) {
      const resolved = parseComposeVolumeEntry(entry, opts);
      if (resolved) mounted.add(resolved);
    }
  }

  return { mounted, ok: mounted.size > 0 };
}

/**
 * Whether `absDirPath` is under one of `mountedSet`'s resolved mount roots.
 * Fails CLOSED: an empty/absent `mountedSet` returns "local-only" for everything.
 * Compares with a trailing-separator guard so a sibling-prefix directory
 * (`codepulse-old` next to a `codepulse` mount) is never mistaken for a descendant.
 */
export function resolveAccess(absDirPath, mountedSet, platform) {
  if (!mountedSet || !(mountedSet instanceof Set) || mountedSet.size === 0) {
    return "local-only";
  }

  const dir = lowerIfWin32(normalizeRel(absDirPath), platform);
  for (const mount of mountedSet) {
    if (dir === mount || dir.startsWith(`${mount}/`)) return "astridr-reachable";
  }
  return "local-only";
}
