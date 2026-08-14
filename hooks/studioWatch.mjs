// Studio media vault watcher (Phase 118 Plans 07/08, D-02/D-05/D-06/D-07/D-08/D-13/D-15).
//
// Scan half (plan 118-07): walk media-vault/{gen,refs,styles}, derive each file's content
// identity, pair it with its sidecar, produce a candidate list. Ingest half (plan 118-08, this
// revision): encode a bounded webp thumbnail per candidate, upload it, POST the row through the
// bearer-gated /studio/ingest route, and reconcile trash\ against Convex's current row state.
//
// No shebang here (DEBT-05, matching hooks/scanner.mjs and hooks/ingestPost.mjs): Vite/
// Rolldown's SSR module transform used by hooks/__tests__/*.test.mjs hoists import statements
// above line 1, and a shebang left there breaks parsing with "Invalid Character `!`". This
// file is invoked via `node hooks/studioWatch.mjs`, never `./studioWatch.mjs`.
//
// Node built-ins only — zero third-party dependencies, matching the whole hooks/*.mjs family.
// ffmpeg is a system binary invoked via child_process, never a new npm dependency.
import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  createReadStream,
  unlinkSync,
  renameSync,
} from "node:fs";
import { join, resolve, sep, basename, extname, dirname } from "node:path";
import { createHash } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

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
 * Inverse of KIND_BY_DIR — used only when moving a file OUT of trash\ back to its originating
 * top-level directory (D-08 Restore). A file sitting in the flat trash\ directory carries no
 * directory-derived kind of its own any more; the hash-index row's `kind` field (fetched from
 * Convex in reconcileTrash, below) is the only place that information survives.
 */
const DIR_BY_KIND = { gen: "gen", ref: "refs", style: "styles" };

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

// ============================================================
// Plan 118-08, Task 1: bounded ffmpeg webp encoder (D-02)
// ============================================================

/**
 * D-02 hard cap, matching convex/media.ts's independent server-side backstop by name and value —
 * two checks exist because "a full-size upload is a bug, not a tuning issue" and a single
 * client-side guard is one bug away from a 7.1 GB database growing without bound.
 */
export const THUMB_MAX_BYTES = 200 * 1024;

/** Bounds the quality/scale search loop below — see THUMB_LADDER. */
export const THUMB_MAX_ATTEMPTS = 5;

/**
 * Quality/scale ladder the bounded search steps down through on repeated over-cap encodes —
 * index i is attempt i+1. Strictly decreasing quality at every rung, not just eventually lower,
 * so a stepping proof has something real to assert on rather than merely "it eventually
 * succeeded." Starts around quality 80 with the longest edge capped near 1024px per
 * 118-RESEARCH.md's Pitfall 3, stepping both down to a hard floor.
 */
const THUMB_LADDER = [
  { quality: 80, longestEdge: 1024 },
  { quality: 65, longestEdge: 900 },
  { quality: 50, longestEdge: 768 },
  { quality: 35, longestEdge: 512 },
  { quality: 20, longestEdge: 384 },
];

/**
 * Builds the ffmpeg argument ARRAY for one attempt — never a shell string (T-118-26):
 * vault filenames are generator- and operator-controlled and reach a native binary, so a shell
 * string built from one would be a command-injection surface. The caller (encodeThumbnail)
 * passes this array straight to the injected `runFfmpeg`, which must invoke ffmpeg the same way
 * (an argv array, never `shell: true`).
 *
 * Uses the modern libwebp `-quality 0-100` knob, never the older per-frame quality flag that
 * mjpeg-era code reaches for (118-RESEARCH.md's Pitfall 3): that older flag is silently ignored
 * by the libwebp encoder and gives no size guarantee either way — see the bounded search loop in
 * encodeThumbnail for how the actual cap is enforced.
 */
function buildFfmpegArgs(candidate, outPath, quality, longestEdge) {
  const scaleFilter = `scale='min(${longestEdge},iw)':-1`;
  if (candidate.mediaType === "video") {
    // Poster frame: select one representative frame, then scale + encode.
    return [
      "-y",
      "-i",
      candidate.absPath,
      "-vf",
      `thumbnail,${scaleFilter}`,
      "-frames:v",
      "1",
      "-c:v",
      "libwebp",
      "-quality",
      String(quality),
      outPath,
    ];
  }
  // Stills only — audio never reaches buildFfmpegArgs (encodeThumbnail returns early for it).
  return [
    "-y",
    "-i",
    candidate.absPath,
    "-vf",
    scaleFilter,
    "-c:v",
    "libwebp",
    "-quality",
    String(quality),
    outPath,
  ];
}

/** Wall-clock bound on a single ffmpeg invocation — an unbounded external process on a nightly
 * scheduled task is how a watcher hangs silently. */
const FFMPEG_TIMEOUT_MS = 20_000;

/**
 * Real ffmpeg invocation, injectable as `deps.runFfmpeg` so unit tests never spawn the actual
 * binary. Bounded by `timeout` (spawnSync kills the process and reports a signal, not a hang);
 * `windowsHide` keeps a scheduled-task run from popping a console. Distinguishes "ffmpeg is not
 * on PATH at all" (`result.error.code === "ENOENT"`) from an ordinary non-zero exit, so
 * encodeThumbnail can refuse immediately instead of burning the whole quality ladder on a call
 * that can never succeed.
 */
function defaultRunFfmpeg(args, deps = {}) {
  const { spawnSyncImpl = spawnSync, timeoutMs = FFMPEG_TIMEOUT_MS } = deps;
  const result = spawnSyncImpl("ffmpeg", args, { timeout: timeoutMs, windowsHide: true });
  const stderr = result.stderr ? result.stderr.toString() : "";

  if (result.error) {
    return {
      ok: false,
      error: result.error.message,
      notFound: result.error.code === "ENOENT",
      stderr,
    };
  }
  if (result.signal) {
    return {
      ok: false,
      error: `ffmpeg killed by signal ${result.signal} (timeout after ${timeoutMs}ms)`,
      stderr,
    };
  }
  if (result.status !== 0) {
    return { ok: false, error: `ffmpeg exited ${result.status}: ${stderr.slice(0, 500)}`, stderr };
  }
  return { ok: true, stderr };
}

/**
 * Best-effort width/height extraction from ffmpeg's own stderr log (never a second `ffprobe`
 * process — ffmpeg already prints the output stream's dimensions). Looks only after the
 * "Output #0" marker so an input file's own dimensions (printed earlier in the same log) are
 * never mistaken for the encoded thumbnail's. Never throws; returns `{width: undefined, height:
 * undefined}` on any parse failure — these are optional wire-contract fields (convex/media.ts's
 * schema), so an absent value is always a safe, valid result.
 */
function parseOutputDimensions(stderr) {
  if (!stderr) return { width: undefined, height: undefined };
  const outputIdx = stderr.indexOf("Output #0");
  const searchSpace = outputIdx >= 0 ? stderr.slice(outputIdx) : stderr;
  const matches = [...searchSpace.matchAll(/(\d{2,5})x(\d{2,5})/g)];
  if (matches.length === 0) return { width: undefined, height: undefined };
  const [, w, h] = matches[matches.length - 1];
  const width = Number(w);
  const height = Number(h);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: undefined, height: undefined };
  }
  return { width, height };
}

/**
 * Produces a webp thumbnail of at most THUMB_MAX_BYTES, or refuses. D-02's own framing: "a
 * full-size upload is a bug, not a tuning issue" — so the loop below REFUSES at the floor rather
 * than shipping an oversized blob, and Task 2's ingestCandidate still ingests the row with no
 * thumbnail rather than dropping the candidate outright (dropping it would violate D-07's "a
 * file must never silently vanish" spirit, extended here to thumbnails).
 *
 * Audio candidates produce NO ffmpeg invocation at all — the UI-SPEC renders an AudioLines
 * placeholder for audio, and a fabricated waveform image would be inventing a signal that does
 * not exist.
 */
export async function encodeThumbnail(candidate, outPath, deps = {}) {
  const {
    runFfmpeg = defaultRunFfmpeg,
    statSyncImpl = statSync,
    unlinkSyncImpl = unlinkSync,
    warn = (msg) => console.error(msg),
  } = deps;

  if (candidate.mediaType === "audio") {
    return { ok: true, noThumbnail: true, attempts: 0 };
  }

  let lastBytes;
  for (let attempt = 0; attempt < THUMB_MAX_ATTEMPTS; attempt++) {
    const { quality, longestEdge } = THUMB_LADDER[attempt];
    const args = buildFfmpegArgs(candidate, outPath, quality, longestEdge);
    const runResult = runFfmpeg(args, deps);

    if (!runResult.ok) {
      if (runResult.notFound) {
        // ffmpeg itself is unreachable — every further attempt would fail identically. Refuse
        // immediately with a clear configuration error rather than burning the whole ladder
        // (and its timeout budget) on a call that cannot succeed; the row still gets ingested
        // with no thumbnail (Task 2), it is never silently skipped.
        warn(
          `[studioWatch] ffmpeg not found on PATH — cannot encode a thumbnail for ${candidate.absPath}. Install ffmpeg or fix PATH.`
        );
        return { ok: false, reason: "FFMPEG_NOT_FOUND", attempts: attempt + 1 };
      }
      warn(
        `[studioWatch] ffmpeg encode failed for ${candidate.absPath} (attempt ${attempt + 1}/${THUMB_MAX_ATTEMPTS}): ${runResult.error}`
      );
      continue;
    }

    let bytes;
    try {
      bytes = statSyncImpl(outPath).size;
    } catch (err) {
      warn(`[studioWatch] could not stat encoded thumbnail ${outPath}: ${err.message}`);
      continue;
    }
    lastBytes = bytes;

    if (bytes <= THUMB_MAX_BYTES) {
      const { width, height } = parseOutputDimensions(runResult.stderr);
      return {
        ok: true,
        noThumbnail: false,
        outPath,
        bytes,
        width,
        height,
        attempts: attempt + 1,
        quality,
      };
    }
    // Over cap this rung — step down and re-encode.
  }

  // Floor reached, still over cap (or every attempt otherwise failed to produce a usable file):
  // refuse rather than upload an oversized blob.
  try {
    unlinkSyncImpl(outPath);
  } catch {
    // Nothing to clean up if no attempt ever produced a file.
  }
  warn(
    `[studioWatch] thumbnail refused for ${candidate.absPath}: still over ${THUMB_MAX_BYTES} bytes after ${THUMB_MAX_ATTEMPTS} attempts`
  );
  return { ok: false, reason: "THUMB_OVER_CAP", bytes: lastBytes, attempts: THUMB_MAX_ATTEMPTS };
}

// ============================================================
// Plan 118-08, Task 2: thumbnail upload + bearer-authenticated ingest POST (D-15)
// ============================================================

/**
 * Shared bearer-authenticated JSON fetch, following hooks/ingestPost.mjs's AbortController +
 * timeout shape. Never throws — every failure path (network error, timeout, malformed response
 * body) resolves to `{ok: false, ...}` so callers can decide what a failure means for THEM
 * (uploadThumbnail treats a transport error differently than an HTTP error; ingestCandidate
 * treats 401 differently than any other non-2xx).
 */
async function bearerFetch(fetchImpl, url, { method = "GET", bearerKey, jsonBody, timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (bearerKey) headers["Authorization"] = `Bearer ${bearerKey}`;
    const init = { method, headers, signal: controller.signal };
    if (jsonBody !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(jsonBody);
    }
    const resp = await fetchImpl(url, init);
    let body = null;
    try {
      body = await resp.json();
    } catch {
      // Non-JSON or empty body — callers that need it check `body` for null themselves.
    }
    return { ok: resp.ok, status: resp.status, body };
  } catch (err) {
    return { ok: false, status: null, transportError: true, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Raw-bytes upload to a Convex-minted one-time-use storage URL — not bearer-authenticated (the
 * URL itself is the one-time signed capability), Content-Type is the real media mime type. */
async function rawUpload(fetchImpl, url, bytes, mimeType, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": mimeType },
      body: bytes,
      signal: controller.signal,
    });
    let body = null;
    try {
      body = await resp.json();
    } catch {
      // handled by the ok:true-with-no-storageId check in uploadThumbnail
    }
    return { ok: resp.ok, status: resp.status, body };
  } catch (err) {
    return { ok: false, status: null, transportError: true, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/** Rewrites `url`'s origin (scheme+host+port) to `fallbackBaseUrl`'s origin, preserving path and
 * query. Returns null on a malformed input rather than throwing. */
function rewriteOrigin(url, fallbackBaseUrl) {
  try {
    const u = new URL(url);
    const fallback = new URL(fallbackBaseUrl);
    u.protocol = fallback.protocol;
    u.host = fallback.host;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * D-01 resolved BRANCH: convex-storage (118-D01-EVIDENCE.md) — the ONLY live branch on this
 * deployment; studioHttp.ts registers no local-static-origin route to receive a
 * `thumbRelPath`-shaped upload, so that second branch is not implemented here. If D-01 is ever
 * revisited, its counterpart belongs in THIS function only, mirroring convex/media.ts's
 * resolveThumbnailUrl doc-comment ("if the local-static-origin branch is ever revisited, the
 * origin-join logic belongs HERE and only here").
 *
 * Two calls: mint (bearer-gated POST /studio/upload-url) then a raw-bytes upload to the URL
 * Convex returns. Per 118-D01-EVIDENCE.md, that URL is used VERBATIM first — the live proof
 * found it directly reachable — and is retried against the defensive fallback origin
 * (config.codepulseUrl's own origin) only on a TRANSPORT-level failure, never an HTTP error
 * status (an HTTP error means the URL was reachable and answered; retrying against a different
 * origin would not fix that).
 */
export async function uploadThumbnail(bytes, mimeType, config, deps = {}) {
  const { fetchImpl = fetch, warn = (msg) => console.error(msg), timeoutMs = 10_000 } = deps;

  const mint = await bearerFetch(fetchImpl, `${config.codepulseUrl}/studio/upload-url`, {
    method: "POST",
    bearerKey: config.studioApiKey,
    timeoutMs,
  });
  if (!mint.ok || typeof mint.body?.uploadUrl !== "string") {
    return { ok: false, reason: "UPLOAD_URL_MINT_FAILED", status: mint.status };
  }
  const uploadUrl = mint.body.uploadUrl;

  let attempt = await rawUpload(fetchImpl, uploadUrl, bytes, mimeType, timeoutMs);
  let originUsed = "verbatim";
  if (!attempt.ok && attempt.transportError) {
    const fallbackUrl = rewriteOrigin(uploadUrl, config.codepulseUrl);
    if (fallbackUrl && fallbackUrl !== uploadUrl) {
      warn(
        `[studioWatch] upload to the verbatim storage origin failed at the transport level (${attempt.error}); retrying against the fallback origin`
      );
      attempt = await rawUpload(fetchImpl, fallbackUrl, bytes, mimeType, timeoutMs);
      originUsed = "fallback";
    }
  }
  if (!attempt.ok || typeof attempt.body?.storageId !== "string") {
    return { ok: false, reason: "UPLOAD_FAILED", status: attempt.status };
  }
  return { ok: true, thumbStorageId: attempt.body.storageId, originUsed };
}

/**
 * POSTs one candidate's row through the bearer-gated /studio/ingest route (D-15). Never prints
 * STUDIO_API_KEY or any Authorization header value (T-118-04) — every diagnostic below names the
 * candidate path and the response shape, never the request headers.
 *
 * `thumb` is the (possibly null) result of encodeThumbnail/uploadThumbnail: only a thumbnail
 * that both encoded AND uploaded successfully contributes thumbBytes/thumbStorageId/width/height
 * to the body — a refused or unattempted thumbnail simply ingests the row without one (D-02/D-07
 * both prefer "present with a gap" over "silently absent").
 *
 * Response mapping (convex/studioHttp.ts's actual wire contract, 118-05-SUMMARY.md):
 *   200 {created:true}  -> "ingested"
 *   200 {created:false} -> "duplicate" (D-06 zero-write no-op — a SUCCESS, not a warning)
 *   400 {...}            -> "refused" (INVALID_ENUM / THUMB_TOO_LARGE / MISSING_FIELD / INVALID_JSON)
 *   401                  -> "unauthorized" (caller halts the whole run immediately)
 *   transport failure     -> "error"
 */
export async function ingestCandidate(candidate, thumb, config, deps = {}) {
  const { fetchImpl = fetch, timeoutMs = 10_000 } = deps;

  const body = {
    contentHash: candidate.contentHash,
    filename: candidate.filename,
    absPath: candidate.absPath,
    mediaType: candidate.mediaType,
    kind: candidate.kind,
    sizeBytes: candidate.sizeBytes,
  };
  if (thumb && thumb.ok && !thumb.noThumbnail && typeof thumb.thumbStorageId === "string") {
    body.thumbBytes = thumb.bytes;
    body.thumbStorageId = thumb.thumbStorageId;
    if (thumb.width !== undefined) body.width = thumb.width;
    if (thumb.height !== undefined) body.height = thumb.height;
  }
  if (candidate.sidecar) {
    body.sidecar = candidate.sidecar;
  }

  const result = await bearerFetch(fetchImpl, `${config.codepulseUrl}/studio/ingest`, {
    method: "POST",
    bearerKey: config.studioApiKey,
    jsonBody: body,
    timeoutMs,
  });

  if (result.status === 401) {
    return { outcome: "unauthorized" };
  }
  if (result.transportError) {
    return { outcome: "error", error: result.error };
  }
  if (!result.ok) {
    return { outcome: "refused", status: result.status, error: result.body?.error, field: result.body?.field };
  }
  return { outcome: result.body?.created ? "ingested" : "duplicate", mediaId: result.body?.mediaId };
}

// ============================================================
// Plan 118-08, Task 3: D-08 trash reconciliation
// ============================================================

/** True if `filename`'s extension is on the media allowlist (never a denylist, T-118-06/
 * T-118-24) — used only to decide which files inside trash\ are candidates for hashing: never a
 * sidecar .json, never a stray non-media file an operator dropped there. */
function isMediaFile(filename) {
  const ext = extname(filename).toLowerCase();
  return Object.values(EXTENSION_ALLOWLIST).some((exts) => exts.includes(ext));
}

/** Resolves `p` and asserts it lives inside `root` before any fs mutation may act on it
 * (T-118-06). Returns the resolved path, or null on a traversal attempt — refused, never
 * acted on. */
function resolveInsideRoot(p, root) {
  const resolved = resolve(p);
  const resolvedRoot = resolve(root);
  if (resolved === resolvedRoot || resolved.startsWith(resolvedRoot + sep)) {
    return resolved;
  }
  return null;
}

const MAX_COLLISION_SUFFIX = 1000;

/** Returns `destPath` unchanged if free, otherwise a numeric-suffixed sibling name
 * (`name (1).ext`, `name (2).ext`, ...) — a destination collision NEVER overwrites an unrelated
 * file (T-118-28). Returns null (refuse) if no free name is found within the bound. */
function uniqueDestination(destPath, existsSyncImpl) {
  if (!existsSyncImpl(destPath)) return destPath;
  const dir = dirname(destPath);
  const ext = extname(destPath);
  const stem = basename(destPath, ext);
  for (let i = 1; i <= MAX_COLLISION_SUFFIX; i++) {
    const candidate = join(dir, `${stem} (${i})${ext}`);
    if (!existsSyncImpl(candidate)) return candidate;
  }
  return null;
}

/** Locates an existing sidecar for `mediaAbsPath` using readSidecar's own precedence (primary
 * `<full path>.json` wins over the fallback `<stem>.json`), returning its path or null. Pure
 * path lookup — never parses the sidecar's contents, since a move doesn't need to. */
function findSidecarPath(mediaAbsPath, existsSyncImpl) {
  const primary = `${mediaAbsPath}.json`;
  if (existsSyncImpl(primary)) return primary;
  const stem = basename(mediaAbsPath, extname(mediaAbsPath));
  const fallback = join(dirname(mediaAbsPath), `${stem}.json`);
  if (existsSyncImpl(fallback)) return fallback;
  return null;
}

/**
 * Moves a media file (and its sidecar, if any) from `srcAbs` into `destDir`, never overwriting a
 * collision. Both the resolved source AND the resolved destination are asserted inside
 * `vaultRoot` BEFORE any fs call — a traversal attempt on either side is refused with zero fs
 * calls (T-118-06). A move failure logs and returns ok:false; it never throws, so one locked
 * file cannot stop the rest of a reconciliation pass.
 */
function moveMediaWithSidecar(srcAbs, destDir, vaultRoot, deps) {
  const {
    existsSyncImpl = existsSync,
    renameSyncImpl = renameSync,
    warn = (msg) => console.error(msg),
  } = deps;

  const resolvedSrc = resolveInsideRoot(srcAbs, vaultRoot);
  if (!resolvedSrc) {
    warn(`[studioWatch] refused to move a path outside the vault root: ${srcAbs}`);
    return { ok: false, reason: "OUTSIDE_ROOT" };
  }

  const destCandidate = resolveInsideRoot(join(destDir, basename(resolvedSrc)), vaultRoot);
  if (!destCandidate) {
    warn(`[studioWatch] refused to move ${resolvedSrc}: destination resolves outside the vault root`);
    return { ok: false, reason: "OUTSIDE_ROOT" };
  }

  const destPath = uniqueDestination(destCandidate, existsSyncImpl);
  if (!destPath) {
    warn(`[studioWatch] refused to move ${resolvedSrc}: no non-colliding destination name found`);
    return { ok: false, reason: "COLLISION_UNRESOLVED" };
  }

  const sidecarSrc = findSidecarPath(resolvedSrc, existsSyncImpl);

  try {
    renameSyncImpl(resolvedSrc, destPath);
  } catch (err) {
    warn(`[studioWatch] failed to move ${resolvedSrc} -> ${destPath}: ${err.message}`);
    return { ok: false, reason: "MOVE_FAILED" };
  }

  if (sidecarSrc) {
    const sidecarDest = uniqueDestination(`${destPath}.json`, existsSyncImpl);
    if (sidecarDest) {
      try {
        renameSyncImpl(sidecarSrc, sidecarDest);
      } catch (err) {
        warn(`[studioWatch] moved ${resolvedSrc} but failed to move its sidecar ${sidecarSrc}: ${err.message}`);
      }
    } else {
      warn(`[studioWatch] moved ${resolvedSrc} but could not find a non-colliding name for its sidecar ${sidecarSrc}`);
    }
  }

  return { ok: true, destPath };
}

/**
 * Deletes an orphaned trash\ file (and its sidecar) from disk — the host-side half of D-08's
 * 30-day janitor, per convex/media.ts's pruneTrashBatch docstring: "hooks/studioWatch.mjs
 * reconciles that on its own next cycle by deleting any trash\ file whose contentHash matches no
 * media row." The resolved path is asserted inside `vaultRoot` before any fs call, same guard as
 * moveMediaWithSidecar.
 */
function reclaimOrphan(trashAbs, vaultRoot, deps) {
  const {
    existsSyncImpl = existsSync,
    unlinkSyncImpl = unlinkSync,
    warn = (msg) => console.error(msg),
  } = deps;

  const resolved = resolveInsideRoot(trashAbs, vaultRoot);
  if (!resolved) {
    warn(`[studioWatch] refused to reclaim a path outside the vault root: ${trashAbs}`);
    return { ok: false, reason: "OUTSIDE_ROOT" };
  }

  const sidecarPath = findSidecarPath(resolved, existsSyncImpl);

  try {
    unlinkSyncImpl(resolved);
  } catch (err) {
    warn(`[studioWatch] failed to reclaim orphaned trash file ${resolved}: ${err.message}`);
    return { ok: false, reason: "UNLINK_FAILED" };
  }

  if (sidecarPath) {
    try {
      unlinkSyncImpl(sidecarPath);
    } catch (err) {
      warn(`[studioWatch] reclaimed ${resolved} but failed to remove its sidecar ${sidecarPath}: ${err.message}`);
    }
  }

  return { ok: true };
}

/**
 * Fetches the bearer-gated `{contentHash -> {deletedAt, kind}}` index from
 * GET /studio/media-hashes (convex/media.ts's getMediaHashIndex, plan 118-08's own addition to
 * studioHttp.ts — flagged prominently in 118-08-SUMMARY.md). ANY failure — transport error,
 * non-2xx, a malformed body, OR a `truncated: true` flag — resolves to `{ok: false, reason}`.
 * Never partially trusts a truncated result: a truncated active-row list could make a real,
 * still-live file look like an orphan (T-118-27, extended from "failed read" to "partial read").
 */
async function getMediaHashIndex(config, deps = {}) {
  const { fetchImpl = fetch, timeoutMs = 10_000 } = deps;
  const result = await bearerFetch(fetchImpl, `${config.codepulseUrl}/studio/media-hashes`, {
    method: "GET",
    bearerKey: config.studioApiKey,
    timeoutMs,
  });

  if (result.transportError) return { ok: false, reason: `TRANSPORT_ERROR:${result.error}` };
  if (!result.ok) return { ok: false, reason: `HTTP_${result.status}` };
  if (!result.body?.ok || !Array.isArray(result.body.rows)) {
    return { ok: false, reason: "MALFORMED_RESPONSE" };
  }
  if (result.body.truncated) return { ok: false, reason: "TRUNCATED" };

  const rowsByHash = new Map();
  for (const row of result.body.rows) {
    if (typeof row?.contentHash === "string") {
      rowsByHash.set(row.contentHash, { deletedAt: row.deletedAt, kind: row.kind });
    }
  }
  return { ok: true, rowsByHash };
}

/**
 * D-08's host-side reconciliation, called from runWatchCycle AFTER the ingest pass. Three rules,
 * each with a stay-put/no-action control case:
 *
 * 1. Move out — an active-directory candidate (gen\/refs\/styles\) whose row is now
 *    soft-deleted moves to trash\. The mutation already hid it from the grid with no host
 *    round-trip; this is reconciliation, not the delete itself.
 * 2. Move back — a trash\ file whose row's deletedAt has been cleared (Restore) moves back to
 *    the directory its row's `kind` implies.
 * 3. Reclaim orphans — a trash\ file matching no row at all is deleted from disk. This is the
 *    self-reconciling half of the 30-day janitor: NO second 30-day constant lives here (two
 *    independently maintained deadlines could drift; this rule cannot).
 *
 * Safety (T-118-27): if there is nothing to reconcile (no active candidates AND an empty trash\
 * directory) the row-index network call is skipped entirely — there is no file left for a bad
 * read to endanger. Otherwise, ANY read failure (including a truncated result) skips the ENTIRE
 * pass with zero fs mutations — an empty-but-successful read is the only thing that authorises
 * treating every trash\ file as an orphan; a failed or partial read must never be mistaken for
 * "I know of no rows."
 */
export async function reconcileTrash(vaultRoot, activeCandidates, config, deps = {}) {
  const { warn = (msg) => console.error(msg), hashFileImpl = hashFile } = deps;

  const trashDir = join(vaultRoot, "trash");
  const trashFiles = walk(trashDir, deps).filter((p) => isMediaFile(basename(p)));

  if (activeCandidates.length === 0 && trashFiles.length === 0) {
    return { skipped: true, reason: "NOTHING_TO_RECONCILE", moved: 0, movedBack: 0, reclaimed: 0 };
  }

  const indexResult = await getMediaHashIndex(config, deps);
  if (!indexResult.ok) {
    warn(
      `[studioWatch] trash reconciliation skipped this cycle: row index read failed (${indexResult.reason}) — treating it as "unknown," never as "everything is an orphan"`
    );
    return { skipped: true, reason: indexResult.reason, moved: 0, movedBack: 0, reclaimed: 0 };
  }
  const { rowsByHash } = indexResult;

  let moved = 0;
  let movedBack = 0;
  let reclaimed = 0;

  // Rule 1: move out.
  for (const candidate of activeCandidates) {
    const row = rowsByHash.get(candidate.contentHash);
    if (row && row.deletedAt) {
      const result = moveMediaWithSidecar(candidate.absPath, trashDir, vaultRoot, deps);
      if (result.ok) moved++;
    }
  }

  // Rules 2 and 3: every file currently in trash\ is either restored, left alone (still
  // deleted), or reclaimed as an orphan.
  for (const trashAbs of trashFiles) {
    let hash;
    try {
      hash = await hashFileImpl(trashAbs, deps);
    } catch (err) {
      warn(`[studioWatch] could not hash trash file, leaving it in place: ${trashAbs}: ${err.message}`);
      continue;
    }

    const row = rowsByHash.get(hash);
    if (!row) {
      // Rule 3: no row anywhere claims this hash — the janitor already deleted it server-side.
      const result = reclaimOrphan(trashAbs, vaultRoot, deps);
      if (result.ok) reclaimed++;
      continue;
    }

    if (!row.deletedAt) {
      // Rule 2: move back.
      const destDirName = DIR_BY_KIND[row.kind];
      if (!destDirName) {
        warn(
          `[studioWatch] trash file ${trashAbs} has an unrecognised kind "${row.kind}" on its row — leaving it in trash\\ rather than guessing a destination`
        );
        continue;
      }
      const result = moveMediaWithSidecar(trashAbs, join(vaultRoot, destDirName), vaultRoot, deps);
      if (result.ok) movedBack++;
    }
    // else: row.deletedAt still set — correctly still trashed, no action (control case).
  }

  return { skipped: false, moved, movedBack, reclaimed };
}

// ============================================================
// The full pipeline
// ============================================================

/**
 * Scans, encodes/uploads/ingests every candidate, then reconciles trash\ — everything main()
 * does except config resolution and the exit-2 gate, split out so tests can drive the whole
 * pipeline in-process with injected deps (fetchImpl/runFfmpeg/etc.) instead of spawning a
 * subprocess.
 *
 * Order matters for D-06: a candidate whose contentHash is unchanged from the cache AND was
 * ingested on a previous run skips the EXPENSIVE encode+upload step entirely — but still goes
 * through ingestCandidate every cycle, which is cheap and hits the server's contentHash dedup
 * fast path (a zero-write no-op, checked before any other field). That is deliberate: the cache
 * marker is a PERFORMANCE SHORTCUT ONLY (never identity) — the server's contentHash index is the
 * sole authority on whether a row exists, so a stale or deleted cache costs one redundant,
 * harmless re-POST per file, never a missed row.
 */
export async function runWatchCycle(config, deps = {}) {
  const {
    tmpDirImpl = tmpdir,
    readFileSyncImpl = readFileSync,
    unlinkSyncImpl = unlinkSync,
    warn = (msg) => console.error(msg),
  } = deps;

  const priorCache = loadCache(config.mediaVaultRoot, deps);
  const { candidates, cache: nextCache } = await scanVault(config.mediaVaultRoot, priorCache, deps);

  const totals = {
    scanned: 0,
    rehashed: 0,
    ingested: 0,
    duplicates: 0,
    refused: 0,
    thumbnailRefused: 0,
  };
  let haltedUnauthorized = false;

  for (const candidate of candidates) {
    totals.scanned++;

    const priorEntry = priorCache[candidate.absPath];
    if (
      !priorEntry ||
      priorEntry.mtimeMs !== candidate.mtimeMs ||
      priorEntry.sizeBytes !== candidate.sizeBytes
    ) {
      totals.rehashed++;
    }
    const wasIngested = priorEntry?.contentHash === candidate.contentHash && priorEntry?.ingested === true;

    let thumb = null;
    if (candidate.mediaType === "audio") {
      thumb = { ok: true, noThumbnail: true, attempts: 0 };
    } else if (!wasIngested) {
      const outPath = join(tmpDirImpl(), `studio-thumb-${candidate.contentHash}.webp`);
      thumb = await encodeThumbnail(candidate, outPath, deps);

      if (thumb.ok && !thumb.noThumbnail) {
        let bytes;
        try {
          bytes = readFileSyncImpl(outPath);
        } catch (err) {
          warn(`[studioWatch] could not read encoded thumbnail ${outPath}: ${err.message}`);
        }
        if (bytes) {
          const uploadResult = await uploadThumbnail(bytes, "image/webp", config, deps);
          try {
            unlinkSyncImpl(outPath);
          } catch {
            // Best-effort temp-file cleanup only.
          }
          if (uploadResult.ok) {
            thumb = { ...thumb, thumbStorageId: uploadResult.thumbStorageId };
          } else {
            warn(
              `[studioWatch] thumbnail upload failed for ${candidate.absPath} (${uploadResult.reason}); ingesting with no thumbnail`
            );
            thumb = { ok: false, reason: uploadResult.reason };
          }
        } else {
          thumb = { ok: false, reason: "THUMB_READ_FAILED" };
        }
      } else if (!thumb.ok) {
        totals.thumbnailRefused++;
      }
    }
    // wasIngested (non-audio) leaves thumb === null: ingestCandidate treats that identically to
    // a refused/failed thumbnail (no thumb fields sent), and the server's dedup check — which
    // runs FIRST, before any other field is even looked at — makes this a zero-write no-op.

    const result = await ingestCandidate(candidate, thumb, config, deps);

    if (result.outcome === "unauthorized") {
      warn(
        "[studioWatch] received 401 Unauthorized from POST /studio/ingest — STUDIO_API_KEY is misconfigured. Halting immediately rather than repeating the failure for every remaining candidate."
      );
      haltedUnauthorized = true;
      break;
    }

    if (result.outcome === "ingested") {
      totals.ingested++;
      nextCache[candidate.absPath].ingested = true;
    } else if (result.outcome === "duplicate") {
      totals.duplicates++;
      nextCache[candidate.absPath].ingested = true;
    } else {
      totals.refused++;
      warn(
        `[studioWatch] ingest refused for ${candidate.absPath}: ${result.error ?? result.outcome}${result.field ? ` (field: ${result.field})` : ""}`
      );
    }
  }

  saveCache(config.mediaVaultRoot, nextCache, deps);

  const reconcile = haltedUnauthorized
    ? { skipped: true, reason: "HALTED_UNAUTHORIZED", moved: 0, movedBack: 0, reclaimed: 0 }
    : await reconcileTrash(config.mediaVaultRoot, candidates, config, deps);

  return { candidateCount: candidates.length, totals, haltedUnauthorized, reconcile };
}

/**
 * Resolves config, enforces D-15's no-default-key rule, then runs the full pipeline.
 * Never prints STUDIO_API_KEY or any Authorization header value anywhere in this function or
 * anything it calls (T-118-04).
 *
 * Exit codes, matching hooks/loom-emit.mjs's table: 0 ok, 2 configuration (missing key, or a
 * 401 from the server mid-run — both mean the deployed key and the watcher's key disagree).
 *
 * `deps.exitImpl` (default `process.exit`) exists so tests can prove "the gate runs BEFORE any
 * network call" in-process, with a plain recording function, instead of spying on the real
 * `process.exit` — a real process.exit() call terminates the vitest worker outright, and this
 * repo's own existing tests already establish the alternative (spawnSync a subprocess) for
 * exactly that reason. Every call site below is immediately followed by `return` so this is
 * still correct even when `exitImpl` is a no-op that does not actually halt execution.
 */
export async function main(env = process.env, deps = {}) {
  const { exitImpl = process.exit } = deps;
  const config = resolveConfig(env, deps);

  if (!config.studioApiKey) {
    console.error(
      "studioWatch: STUDIO_API_KEY is not set. Set it in your environment or in " +
        "<homedir>/.claude/skills/studio/.env — a missing key is a configuration error, " +
        "never a silent unauthenticated POST."
    );
    exitImpl(2);
    return;
  }

  const { candidateCount, totals, haltedUnauthorized, reconcile } = await runWatchCycle(config, deps);

  console.log(`studioWatch: ${candidateCount} candidate(s) found in ${config.mediaVaultRoot}`);
  console.log(
    `studioWatch: scanned=${totals.scanned} rehashed=${totals.rehashed} ingested=${totals.ingested} ` +
      `duplicates=${totals.duplicates} refused=${totals.refused} thumbnailRefused=${totals.thumbnailRefused} ` +
      `trashMoved=${reconcile.moved} trashRestored=${reconcile.movedBack} trashReclaimed=${reconcile.reclaimed}`
  );

  if (haltedUnauthorized) {
    exitImpl(2);
    return;
  }
  exitImpl(0);
}

// Allow direct execution: node hooks/studioWatch.mjs
const isDirectRun =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").includes("studioWatch.mjs");
if (isDirectRun) {
  main();
}
