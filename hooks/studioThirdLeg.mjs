// OpenArt MCP placement + sidecar writer (Phase 118 plan 118-14, D-09's THIRD leg).
//
// WHY THIS FILE IS SO MUCH SMALLER THAN THE OTHER TWO LEGS, AND WHY THAT IS THE POINT:
// D-09 requires three genuinely different code shapes proven end to end. Leg 1
// (higgsfield) shells out to a CLI and parses its JSON stdout. Leg 2 (fal.ai,
// hooks/studioFal.mjs) is a from-scratch HTTP client that owns a queue submit, a
// bounded poll loop, a retry policy and an `Authorization` header. This leg has
// NONE of those four. Generation happens as an MCP tool call inside a Claude
// session — `mcp__openart__openart_generate_image` / `openart_generate_video`,
// completed via `openart_creation_wait(historyId)` — and there is no headless
// path to it, so a standalone .mjs cannot and must not try to drive it.
//
// What is left for code is exactly the back half: put the asset where the
// watcher will find it, and write the sidecar. That asymmetry IS the evidence
// D-09 wants. Legs 1 and 2 both had a PROGRAM turning a machine-readable
// generator response into a sidecar. Here the provenance arrives as a tool
// result in a conversation, and the sidecar must still come out structurally
// identical. `hooks/__tests__/studioThirdLeg.test.mjs` asserts that identity
// against leg 2's real output rather than against a hand-written expectation.
//
// IF SOMEONE LATER GIVES THIS MODULE ITS OWN fetch-BASED SUBMIT AND POLL LOOP,
// leg 3 has collapsed into leg 2 and D-09's intent is defeated even though its
// letter still reads as satisfied. That is recorded in
// .planning/phases/118-studio-media-gallery/118-D09-EVIDENCE.md § "LEG: third"
// so the collapse is detectable rather than arguable.
//
// NO PROVIDER CREDENTIAL EXISTS FOR THIS LEG. OpenArt auth is an OAuth session
// held by the MCP client; it is never an environment variable, never stored in
// Convex, and never read here. `resolveThirdLegConfig` therefore reads exactly
// one variable, MEDIA_VAULT_ROOT, and a test asserts it reads no *_KEY/_TOKEN/
// _SECRET of any kind — the control being that it DOES pick up MEDIA_VAULT_ROOT,
// so "reads nothing" cannot pass by the resolver simply being broken.
//
// House conventions this module joins (hooks/loom-emit.mjs, hooks/studioWatch.mjs,
// hooks/studioFal.mjs): no shebang, `node:` builtins only, an AbortController
// timeout on every fetch, injected `deps`, fail-loud exit codes.
//
// Exit codes: 0 ok · 2 configuration · 4 refusal.
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep, basename } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Matches hooks/studioWatch.mjs:30 and hooks/studioFal.mjs exactly. One default, not three. */
const DEFAULT_MEDIA_VAULT_ROOT = "C:\\Users\\mandr\\media-vault";

/** Only used when fetching an asset URL the MCP tool returned. There is no
 * generation timeout here because this module never waits on a generation. */
const REQUEST_TIMEOUT_MS = 60_000;

/** The provider string written into every sidecar this leg produces. Contract §3:
 * `provider` is the generation BACKEND, not the tool or the agent that drove it. */
export const PROVIDER = "openart";

/* ────────────────────────────────────────────────────────────────────────────
 * Config
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Resolve configuration. ONE variable, and deliberately no credential of any
 * kind — see the header. Unlike `resolveFalConfig` there is no key tier to
 * report on, because there is no key.
 */
export function resolveThirdLegConfig(env = process.env) {
  return {
    vaultRoot: env.MEDIA_VAULT_ROOT || DEFAULT_MEDIA_VAULT_ROOT,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Path safety
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Assert a destination path resolves INSIDE the vault's gen\ directory.
 *
 * Identical rule to studioFal.mjs's `assertInsideGen`, and identical for the
 * same reason: the filename can originate from a remote asset URL the MCP tool
 * handed back (T-118-06), so `../` is the whole attack. `resolve()` on both
 * sides plus the trailing separator, so `gen-evil\` cannot pass as a prefix of
 * `gen\`. A `startsWith` on the unresolved strings is the classic broken form.
 */
export function assertInsideGen(destPath, vaultRoot) {
  const genDir = resolve(vaultRoot, "gen");
  const dest = resolve(destPath);
  if (dest !== genDir && !dest.startsWith(genDir + sep)) {
    throw new Error(
      `refusing to write outside the vault's gen directory: ${dest} is not inside ${genDir}`
    );
  }
  return dest;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The sidecar
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Build the sidecar body per docs/studio-sidecar-contract.md §3.
 *
 * `params` comes back ALREADY STRINGIFIED, exactly as leg 2's `generate` returns
 * it, because `sanitizeSidecar` keeps `params` only when `typeof === "string"`
 * and silently drops an object. Doing it here is what stops every caller from
 * having to remember the one rule in the contract that looks like it should
 * work the other way.
 *
 * Fields whose value is undefined/empty are OMITTED rather than written as
 * null — contract §3 says every field is optional and §4 says an absent field
 * is a defined state, whereas a null would be a wrong-typed field that
 * `sanitizeSidecar` drops individually anyway. Omitting is the honest encoding.
 */
export function buildSidecar({ prompt, model, params, style, project, tags } = {}) {
  const out = {};
  if (typeof prompt === "string" && prompt.length > 0) out.prompt = prompt;
  if (typeof model === "string" && model.length > 0) out.model = model;
  out.provider = PROVIDER;
  if (typeof style === "string" && style.length > 0) out.style = style;
  if (typeof project === "string" && project.length > 0) out.project = project;
  if (params !== undefined && params !== null) {
    // Accept either an object (stringify it) or an already-serialised string
    // (pass through) — the caller is a conversation, so both shapes turn up.
    out.params = typeof params === "string" ? params : JSON.stringify(params);
  }
  if (Array.isArray(tags) && tags.length > 0) out.tags = tags.map(String);
  return out;
}

/**
 * The sidecar path for a media file: the PRIMARY form from contract §2 — the
 * media file's FULL path plus `.json`, never the stem-only fallback. The
 * fallback exists for hand-placed files and a machine writer must not use it.
 */
export function sidecarPathFor(mediaPath) {
  return `${mediaPath}.json`;
}

/**
 * Write the sidecar next to its media file.
 *
 * Refuses outside gen\ before opening any handle, so a refusal performs zero
 * filesystem writes rather than merely throwing after a partial one.
 */
export async function writeSidecar(mediaPath, sidecar, config, deps = {}) {
  const { writeFileImpl = writeFile, mkdirImpl = mkdir } = deps;
  const dest = assertInsideGen(mediaPath, config.vaultRoot);
  const sidecarPath = sidecarPathFor(dest);
  await mkdirImpl(dirname(sidecarPath), { recursive: true });
  await writeFileImpl(sidecarPath, `${JSON.stringify(sidecar, null, 2)}\n`, "utf8");
  return sidecarPath;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Asset placement
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Stream an asset URL to disk. STREAMS — never buffers, because an OpenArt video
 * result can be hundreds of megabytes and `arrayBuffer()` would hold all of it
 * in memory (T-118-22).
 *
 * No auth header is sent: the URL the MCP tool returns is a CDN object, and this
 * leg has no credential to send in the first place.
 */
export async function downloadAsset(assetUrl, destPath, config, deps = {}) {
  const {
    fetchImpl = fetch,
    timeoutMs = REQUEST_TIMEOUT_MS,
    createWriteStreamImpl = createWriteStream,
    mkdirImpl = mkdir,
  } = deps;

  const dest = assertInsideGen(destPath, config.vaultRoot);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let resp;
  try {
    resp = await fetchImpl(assetUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    throw new Error(`GET ${redactUrl(assetUrl)} -> HTTP ${resp.status}`);
  }

  await mkdirImpl(dirname(dest), { recursive: true });
  const body = typeof resp.body?.pipe === "function" ? resp.body : Readable.fromWeb(resp.body);
  await pipeline(body, createWriteStreamImpl(dest));
  return dest;
}

/** Write already-in-hand bytes to disk. The MCP tool can return either a URL or
 * inline bytes, and the contract does not care which produced the file. */
export async function writeAssetBytes(bytes, destPath, config, deps = {}) {
  const { writeFileImpl = writeFile, mkdirImpl = mkdir } = deps;
  const dest = assertInsideGen(destPath, config.vaultRoot);
  await mkdirImpl(dirname(dest), { recursive: true });
  await writeFileImpl(dest, bytes);
  return dest;
}

/** Strip a query string so a future signed asset url cannot reach a log intact.
 * Same helper as studioFal.mjs; duplicated rather than imported so this module
 * has no dependency on leg 2 (importing it would be its own kind of collapse). */
export function redactUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return "[unparseable url]";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Composed flow
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Default destination name, contract §1's convention `{project}_{variant}_{attempt}_{ts}.{ext}`.
 * Kept SHORT on purpose: a long timestamped filename trips detectCredentialValue's
 * rule C, a documented false positive in convex/media.ts.
 */
export function defaultDestPath(vaultRoot, modelId, contentType, now) {
  const ext = (contentType || "image/png").split("/")[1]?.split("+")[0] || "png";
  const slug = String(modelId || "openart")
    .split("/")
    .pop()
    .replace(/[^A-Za-z0-9]+/g, "-")
    .slice(0, 12);
  const ts = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  return join(vaultRoot, "gen", `oa_${slug}_${ts}.${ext}`);
}

/**
 * Place one generated asset and its provenance.
 *
 * THE SIDECAR IS WRITTEN FIRST, and that ordering is load-bearing rather than
 * stylistic. Contract §6: a media file that lands in one watcher cycle and gains
 * its sidecar in the next ingests WITHOUT provenance forever, because the row was
 * already created on the first cycle and a duplicate content hash is a zero-write
 * no-op. A sidecar with no media yet is harmless in the other direction — `.json`
 * is not an ingested extension, so it is silently skipped until its media arrives.
 * The asymmetry is total, so there is exactly one safe order.
 */
export async function place({ assetUrl, bytes, destPath, provenance = {} }, config, deps = {}) {
  if (!assetUrl && !bytes) {
    throw new Error("place() needs either assetUrl or bytes — the MCP tool returns one or the other");
  }
  const dest = assertInsideGen(destPath, config.vaultRoot);

  const sidecar = buildSidecar(provenance);
  const sidecarPath = await writeSidecar(dest, sidecar, config, deps);

  const localPath = bytes
    ? await writeAssetBytes(bytes, dest, config, deps)
    : await downloadAsset(assetUrl, dest, config, deps);

  return { ok: true, localPath, sidecarPath, sidecar, filename: basename(localPath) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * CLI
 * ──────────────────────────────────────────────────────────────────────────*/

export function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") return { help: true };
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i].replace(/^--/, "");
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`flag --${name} needs a value`);
    out[name] = value;
  }
  return out;
}

const USAGE = `studioThirdLeg — place an OpenArt MCP result into the media vault with its sidecar.

  --url <assetUrl>     asset url returned by openart_creation_wait   (or --file)
  --model <id>         model id, read from openart_model_list        (required)
  --prompt <text>      the prompt as submitted                       (required)
  --params <json>      generation params, a JSON STRING              (optional)
  --project <name>     project grouping                             (optional)
  --out <path>         destination inside the vault's gen\\ directory (optional)

Generation itself is an MCP tool call and cannot be driven from here — this
places what that call produced. See docs/studio-sidecar-contract.md.`;

export async function main(argv = process.argv.slice(2), deps = {}) {
  const { env = process.env, log = console.log, errorLog = console.error, now = Date.now() } = deps;

  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    errorLog(String(err.message));
    return 2;
  }
  if (args.help) {
    log(USAGE);
    return 0;
  }

  const config = resolveThirdLegConfig(env);

  if (!args.url && !args.file) {
    errorLog("configuration: --url (or --file) is required — this leg places an asset it did not generate");
    return 2;
  }
  if (!args.model) {
    errorLog("configuration: --model is required, and must be an id read from openart_model_list, never hand-constructed");
    return 2;
  }
  if (!args.prompt) {
    errorLog("configuration: --prompt is required — provenance inferred from a filename is exactly what contract §5 forbids");
    return 2;
  }

  const destPath = args.out || defaultDestPath(config.vaultRoot, args.model, args.contentType, now);

  try {
    const result = await place(
      {
        assetUrl: args.url,
        destPath,
        provenance: {
          prompt: args.prompt,
          model: args.model,
          params: args.params,
          project: args.project,
          style: args.style,
        },
      },
      config,
      deps
    );
    log(JSON.stringify({ ok: true, localPath: result.localPath, sidecarPath: result.sidecarPath }, null, 2));
    return 0;
  } catch (err) {
    errorLog(String(err.message));
    return 4;
  }
}
