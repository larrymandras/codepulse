// Studio media vault watcher — scan half (Phase 118 Plan 07, D-05/D-06/D-07/D-13).
//
// This module performs no network I/O, no ffmpeg, and no file mutation inside the vault —
// those arrive in plan 118-08. Its job stops at: walk media-vault/{gen,refs,styles}, derive
// each file's content identity, pair it with its sidecar, and produce a candidate list.
//
// No shebang here (DEBT-05, matching hooks/scanner.mjs and hooks/ingestPost.mjs): Vite/
// Rolldown's SSR module transform used by hooks/__tests__/*.test.mjs hoists import statements
// above line 1, and a shebang left there breaks parsing with "Invalid Character `!`". This
// file is invoked via `node hooks/studioWatch.mjs`, never `./studioWatch.mjs`.
//
// Node built-ins only — zero third-party dependencies, matching the whole hooks/*.mjs family.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  createReadStream,
} from "node:fs";
import { join, resolve, sep, basename, extname, dirname } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";

const DEFAULT_MEDIA_VAULT_ROOT = "C:\\Users\\mandr\\media-vault";

/**
 * Self-hosted Convex HTTP-ACTIONS port — a different port than the plain backend API (see
 * hooks/loom-emit.mjs for that exact rationale, which this module deliberately does not
 * restate the digits of here to keep this file's own port-hygiene check meaningful).
 * Defensive fallback only: 118-01's live D-01 proof found the URL Convex returns verbatim
 * (the tailnet hostname) directly reachable and this rewrite was never needed in practice.
 */
const DEFAULT_CODEPULSE_URL = "http://127.0.0.1:3211";

const CACHE_FILENAME = ".studio-watch-state.json";

/** Top-level vault directories the scan walks. NOT trash — plan 118-08 handles that one. */
const SCAN_DIRS = ["gen", "refs", "styles"];

/** kind derives from the top-level vault directory (<interfaces> block, 118-07-PLAN.md). */
const KIND_BY_DIR = { gen: "gen", refs: "ref", styles: "style" };

/**
 * mediaType extension ALLOWLIST — never a denylist (T-118-06/T-118-24). Anything not listed
 * here, including `.json` sidecars and the vault's own README.md, is not media and is skipped.
 */
const EXTENSION_ALLOWLIST = {
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
  video: [".mp4", ".mov", ".webm", ".mkv"],
  audio: [".mp3", ".wav", ".m4a", ".flac"],
};

function readEnvFile(deps = {}) {
  const {
    existsSyncImpl = existsSync,
    readFileSyncImpl = readFileSync,
    homeDir = homedir(),
  } = deps;
  // Skill-local env file, following hooks/loom-emit.mjs's exact tier-2 convention
  // (<homedir>/.claude/skills/<name>/.env, built as an ABSOLUTE path — never relative to
  // import.meta.url or cwd, because this script runs from arbitrary directories/scheduled
  // tasks). "studio" names the skill family this watcher's credentials belong to (D-11's
  // /studio-generate wrapper and this watcher share the same STUDIO_API_KEY).
  const path = join(homeDir, ".claude", "skills", "studio", ".env");
  if (!existsSyncImpl(path)) return {};
  try {
    const out = {};
    for (const line of readFileSyncImpl(path, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Three-tier config resolution, matching hooks/loom-emit.mjs's order exactly:
 *   1. env (process.env by default; the parameter exists so tests can inject a fixture object)
 *   2. <homedir>/.claude/skills/studio/.env
 *   3. a hardcoded default — URL only, per loom-emit.mjs's rule that there is never a default
 *      for a credential.
 *
 * STUDIO_API_KEY has NO default at any tier and this function does not enforce its presence —
 * it is a pure resolver. main() is where a missing key becomes a configuration error (exit
 * code 2, never a silent unauthenticated POST) so plan 118-08's ingest pipeline and this
 * plan's scan-only main() share one enforcement point without duplicating the check.
 */
export function resolveConfig(env = process.env, deps = {}) {
  const fileEnv = readEnvFile(deps);

  const mediaVaultRoot =
    env.MEDIA_VAULT_ROOT || fileEnv.MEDIA_VAULT_ROOT || DEFAULT_MEDIA_VAULT_ROOT;

  const codepulseUrl = (
    env.CODEPULSE_URL ||
    fileEnv.CODEPULSE_URL ||
    DEFAULT_CODEPULSE_URL
  ).replace(/\/+$/, "");

  const studioApiKey = env.STUDIO_API_KEY || fileEnv.STUDIO_API_KEY || undefined;

  return { mediaVaultRoot, codepulseUrl, studioApiKey };
}

/**
 * Classifies a candidate by its top-level vault directory and file extension. Returns null
 * for anything that is not media — including `.json` sidecars, the vault's own README.md, and
 * the watcher's own cache file — so scanVault can skip it outright.
 *
 * ALLOWLIST, never a denylist (T-118-06/T-118-24): an unrecognised extension is treated as
 * "not media", not ingested speculatively.
 */
export function classifyFile(relPath) {
  const parts = relPath.split(/[\\/]/).filter(Boolean);
  if (parts.length < 2) return null; // must live inside a top-level vault subdirectory

  const kind = KIND_BY_DIR[parts[0]];
  if (!kind) return null;

  const filename = parts[parts.length - 1];
  const ext = extname(filename).toLowerCase();
  for (const [mediaType, exts] of Object.entries(EXTENSION_ALLOWLIST)) {
    if (exts.includes(ext)) return { kind, mediaType };
  }
  return null;
}

/**
 * Streams `absPath` through crypto.createHash("sha256") and returns lowercase hex.
 *
 * Per hooks/idempotency.mjs's governing rule (D-05, restated here because that module's own
 * key is built from event metadata, not file bytes): nothing path-derived, process-derived or
 * time-derived may enter this value — only the file's bytes. Streamed via createReadStream,
 * NEVER readFileSync, so hashing a large video does not read the whole file into memory
 * (T-118-22).
 */
export function hashFile(absPath, deps = {}) {
  const { createReadStreamImpl = createReadStream } = deps;
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStreamImpl(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Resolves the sidecar for a media file per the naming contract documented in
 * media-vault/README.md: primary form `<full path>.json`, fallback `<stem>.json` in the same
 * directory, primary wins when both exist.
 *
 * NEVER THROWS (D-07): a missing sidecar is "absent"; a sidecar that exists but does not parse
 * as JSON, or parses to something other than a plain object (e.g. an array, null, a string),
 * is "malformed" and a warning naming the path is written to stderr — both leave the media
 * file fully present in the candidate list. D-07's own rationale: a file vanishing from a
 * directory you are looking at is the failure mode with no diagnostic; this function exists so
 * that never happens here.
 */
export function readSidecar(mediaAbsPath, deps = {}) {
  const {
    existsSyncImpl = existsSync,
    readFileSyncImpl = readFileSync,
    warn = (msg) => console.error(msg),
  } = deps;

  const primaryPath = `${mediaAbsPath}.json`;
  const stem = basename(mediaAbsPath, extname(mediaAbsPath));
  const fallbackPath = join(dirname(mediaAbsPath), `${stem}.json`);

  let candidatePath = null;
  if (existsSyncImpl(primaryPath)) {
    candidatePath = primaryPath;
  } else if (existsSyncImpl(fallbackPath)) {
    candidatePath = fallbackPath;
  }

  if (!candidatePath) {
    return { sidecar: null, sidecarStatus: "absent" };
  }

  try {
    const raw = readFileSyncImpl(candidatePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      warn(`[studioWatch] malformed sidecar (not a JSON object): ${candidatePath}`);
      return { sidecar: null, sidecarStatus: "malformed" };
    }
    return { sidecar: parsed, sidecarStatus: "present" };
  } catch (err) {
    warn(`[studioWatch] malformed sidecar (${err.message}): ${candidatePath}`);
    return { sidecar: null, sidecarStatus: "malformed" };
  }
}

/**
 * Loads the mtime-gated re-hash cache at `<root>/.studio-watch-state.json`, mapping
 * absPath -> { mtimeMs, sizeBytes, contentHash }.
 *
 * THIS IS A PERFORMANCE CACHE, NOT A SOURCE OF IDENTITY (D-05/D-06). Its one job is to let
 * scanVault skip re-hashing a file whose mtimeMs AND sizeBytes both still match what was last
 * recorded — mtime may gate WHETHER to re-hash, it may never enter the identity itself.
 * Deleting this file must change nothing about scanVault's output except runtime: every hash
 * is re-derived from bytes on a cold scan and must match the warm scan's values exactly.
 * Corrupt or absent cache -> start from empty; this function never throws.
 */
export function loadCache(root, deps = {}) {
  const { existsSyncImpl = existsSync, readFileSyncImpl = readFileSync } = deps;
  const cachePath = join(root, CACHE_FILENAME);
  if (!existsSyncImpl(cachePath)) return {};
  try {
    const parsed = JSON.parse(readFileSyncImpl(cachePath, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

/** Never throws — a failed cache write only costs the next scan its warm-scan shortcut. */
export function saveCache(root, cache, deps = {}) {
  const { writeFileSyncImpl = writeFileSync, warn = (msg) => console.error(msg) } = deps;
  const cachePath = join(root, CACHE_FILENAME);
  try {
    writeFileSyncImpl(cachePath, JSON.stringify(cache), "utf-8");
  } catch (err) {
    warn(`[studioWatch] failed to save cache: ${err.message}`);
  }
}

/**
 * Recursively lists file paths under `dirAbs`. Symlinks are never followed (T-118-06) — the
 * resolved-path containment check in scanVault is defense in depth, not the only guard.
 */
function walk(dirAbs, deps = {}) {
  const { readdirSyncImpl = readdirSync } = deps;
  let entries;
  try {
    entries = readdirSyncImpl(dirAbs, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const entryAbs = join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(entryAbs, deps));
    } else if (entry.isFile()) {
      files.push(entryAbs);
    }
  }
  return files;
}

/**
 * Walks gen/, refs/, styles/ (NOT trash — plan 118-08 handles that directory separately),
 * classifies each file, hashes new/changed media (skipping via the mtime cache where safe),
 * pairs each with its sidecar, and returns `{ candidates, cache }`.
 *
 * Pure with respect to the network — plan 118-08 layers ingest on top without re-testing the
 * scan. T-118-06: every candidate's resolved absolute path is asserted to still live under the
 * resolved vault root before being included, refusing anything a symlink tried to walk outside
 * it.
 */
export async function scanVault(root, cache = {}, deps = {}) {
  const { statSyncImpl = statSync, hashFileImpl = hashFile, readSidecarImpl = readSidecar } = deps;

  const resolvedRoot = resolve(root);
  const nextCache = {};
  const candidates = [];

  for (const topDir of SCAN_DIRS) {
    const files = walk(join(root, topDir), deps);

    for (const absPath of files) {
      const resolvedPath = resolve(absPath);
      if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + sep)) {
        continue; // T-118-06: resolved outside the vault root — refuse
      }

      const relPath = resolvedPath.slice(resolvedRoot.length + 1);
      const classification = classifyFile(relPath);
      if (!classification) continue; // not media

      const { kind, mediaType } = classification;
      const stat = statSyncImpl(absPath);
      const mtimeMs = stat.mtimeMs;
      const sizeBytes = stat.size;

      const cached = cache[absPath];
      const contentHash =
        cached && cached.mtimeMs === mtimeMs && cached.sizeBytes === sizeBytes
          ? cached.contentHash
          : await hashFileImpl(absPath, deps);

      nextCache[absPath] = { mtimeMs, sizeBytes, contentHash };

      const { sidecar, sidecarStatus } = readSidecarImpl(absPath, deps);

      candidates.push({
        absPath,
        filename: basename(absPath),
        relPath,
        kind,
        mediaType,
        sizeBytes,
        mtimeMs,
        contentHash,
        sidecar,
        sidecarStatus,
      });
    }
  }

  return { candidates, cache: nextCache };
}

/**
 * Scans the vault and prints a one-line-per-candidate summary plus totals, then exits 0.
 * Plan 118-08 replaces the printing with the ingest pipeline. Never prints STUDIO_API_KEY or
 * any other secret (T-118-04) — resolveConfig's result is used only to check presence here.
 *
 * Exit codes, matching hooks/loom-emit.mjs's table: 0 ok, 2 configuration.
 */
export async function main(env = process.env) {
  const config = resolveConfig(env);

  if (!config.studioApiKey) {
    console.error(
      "studioWatch: STUDIO_API_KEY is not set. Set it in your environment or in " +
        "<homedir>/.claude/skills/studio/.env — a missing key is a configuration error, " +
        "never a silent unauthenticated POST."
    );
    process.exit(2);
  }

  const cache = loadCache(config.mediaVaultRoot);
  const { candidates, cache: nextCache } = await scanVault(config.mediaVaultRoot, cache);
  saveCache(config.mediaVaultRoot, nextCache);

  for (const c of candidates) {
    console.log(`${c.kind}\t${c.mediaType}\t${c.sidecarStatus}\t${c.relPath}\t${c.contentHash}`);
  }
  console.log(`studioWatch: ${candidates.length} candidate(s) found in ${config.mediaVaultRoot}`);
  process.exit(0);
}

// Allow direct execution: node hooks/studioWatch.mjs
const isDirectRun =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("studioWatch.mjs");
if (isDirectRun) {
  main();
}
