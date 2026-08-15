// fal.ai direct-API generation client (Phase 118 plan 118-13, D-09's SECOND leg).
//
// WHY THIS EXISTS AND WHY IT IS SHAPED THIS WAY: D-09 requires three genuinely
// different code shapes proven end to end. The first leg shells out to the
// Higgsfield CLI and parses its JSON stdout — a blocking call that does its own
// waiting. This leg is the opposite shape on purpose: an HTTP queue submit that
// returns immediately with a request id, a bounded poll loop this module owns,
// and a separate result fetch and byte download. If the sidecar contract only
// works when a CLI produces the file, the contract is CLI-shaped and D-09's
// proof is worthless. This module is how that gets tested rather than asserted.
//
// THE API CONTRACT BELOW WAS READ OFF fal.ai's OWN DOCUMENTATION on 2026-08-15
// (https://fal.ai/docs/documentation/model-apis/inference/queue), NOT from
// memory and NOT from the donor's comments. The two things most worth stating,
// because both are easy to get confidently wrong:
//
//   1. The auth header is `Authorization: Key <token>` — NOT `Bearer`. Every
//      other authenticated call in this repo uses Bearer, so the house habit is
//      the wrong answer here and would produce a 401 that looks like a bad key.
//   2. Submit returns `request_id`, `response_url`, `status_url`, `cancel_url`
//      and `queue_position`. We POLL and FETCH using the URLs the API hands
//      back, never URLs we rebuild from a template — reconstructing a URL is how
//      a version drift becomes a confident 404 against a job that is running
//      fine.
//
// ITS DONOR IS A STUB, NOT AN IMPLEMENTATION.
// `~/.claude/skills/mandras_made_skills/caught_on_camera/src/ai/veo.ts` supplied
// the `withRetry` shape, the `FAL_KEY` naming and the cost-accounting idea. Its
// HTTP calls do not exist: veo.ts:73 and :107 each throw an
// unimplemented-marker Error, and `_pollFalQueue` at :128 is a stub whose
// queue/poll cycle survives only as commented-out intent. Everything below is
// written from scratch. `hooks/__tests__/studioFal.test.mjs` greps THIS file for
// those two literal markers and requires zero hits, with veo.ts as the control
// proving the same patterns do find them where they exist.
//
// That is why the paragraph above paraphrases the markers instead of quoting
// them: the assertion is a whole-file grep, so quoting the literals here would
// fail it. Deliberate, not accidental — if you add either literal to a comment
// in this file, that test will go red and it is the test that is right.
//
// House conventions this module joins (hooks/loom-emit.mjs, hooks/studioWatch.mjs):
// no shebang, `node:` builtins only, an AbortController timeout on every fetch,
// three-tier env resolution, fail-loud exit codes.
//
// Exit codes: 0 ok · 2 configuration · 3 transport/server · 4 refusal.
import { existsSync, readFileSync, createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** fal.ai's queue host. Submit is POST `${FAL_QUEUE_BASE}/${modelId}`. */
const FAL_QUEUE_BASE = "https://queue.fal.run";

/** Matches hooks/studioWatch.mjs:30 exactly. One default, not two. */
const DEFAULT_MEDIA_VAULT_ROOT = "C:\\Users\\mandr\\media-vault";

/** Per-request abort timeout. Generation itself is bounded by the poll budget,
 * not by this — an individual HTTP call to the queue is always fast. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Poll bounds. BOTH apply: whichever is reached first ends the loop. An
 * attempt count alone cannot bound wall-clock once backoff grows, and a
 * wall-clock budget alone cannot bound request COUNT against a fast-failing
 * endpoint. T-118-41 is a financial DoS, so it gets two independent bounds. */
const DEFAULT_POLL = {
  maxAttempts: 60,
  budgetMs: 600_000,
  intervalMs: 5_000,
  maxIntervalMs: 15_000,
  backoffFactor: 1.5,
};

/** Retry bounds for TRANSIENT conditions only. See isTransient. */
const DEFAULT_RETRY = { maxAttempts: 3, baseDelayMs: 2_000, backoffFactor: 2 };

const USAGE = `studioFal.mjs — generate one asset through fal.ai's queue API

  node hooks/studioFal.mjs --model <modelId> --prompt "..." [--params '<json>'] [--out <path>]

  --model   fal.ai model id, e.g. fal-ai/flux/schnell. Read it off fal.ai's own
            model listing; never hand-construct one.
  --prompt  the prompt text, passed through to the model's \`prompt\` input.
  --params  OPTIONAL JSON object of extra model inputs, merged over { prompt }.
  --out     OPTIONAL absolute destination path. Must resolve inside the vault's
            gen\\ directory. Defaults to a generated name in gen\\.

Environment (resolved in this order — no default for the key at any tier):
  FAL_KEY           required. process.env, then <homedir>/.claude/skills/studio/.env
  MEDIA_VAULT_ROOT  optional, defaults to ${DEFAULT_MEDIA_VAULT_ROOT}
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Configuration
 * ──────────────────────────────────────────────────────────────────────────*/

/** Reads the shared studio env file. Never throws: an unreadable or absent file
 * is an empty tier, so a missing key is diagnosed by ONE code path (main's
 * exit-2) rather than by two that report it differently. */
function readEnvFile(homeDir) {
  const path = join(homeDir, ".claude", "skills", "studio", ".env");
  if (!existsSync(path)) return {};
  try {
    const out = {};
    for (const line of readFileSync(path, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Three-tier config resolution, matching hooks/loom-emit.mjs and
 * hooks/studioWatch.mjs in order and in file location:
 *
 *   1. process.env.FAL_KEY / MEDIA_VAULT_ROOT
 *   2. <homedir>/.claude/skills/studio/.env — the SAME file the watcher reads,
 *      built from os.homedir() as an ABSOLUTE path, never relative to
 *      import.meta.url or cwd, because this runs from arbitrary directories.
 *   3. For the vault root only, the documented default above.
 *
 * FAL_KEY has NO DEFAULT AT ANY TIER. Like studioWatch's resolveConfig, this
 * function does not ENFORCE presence — it reports what it found, and main()
 * turns an absent key into exit 2. Splitting it that way keeps the resolver
 * pure and testable while leaving exactly one place that can decide to run
 * unauthenticated (and it never does).
 *
 * The key is read here and is never printed by anything in this module.
 */
export function resolveFalConfig(env = process.env, deps = {}) {
  const { homeDir = homedir() } = deps;
  const fileEnv = readEnvFile(homeDir);
  return {
    falKey: env.FAL_KEY || fileEnv.FAL_KEY || undefined,
    vaultRoot: env.MEDIA_VAULT_ROOT || fileEnv.MEDIA_VAULT_ROOT || DEFAULT_MEDIA_VAULT_ROOT,
  };
}

/** The one place the auth header is built. `Key`, not `Bearer` — verified
 * against fal.ai's docs, see the module header. */
function authHeaders(falKey, extra = {}) {
  return { Authorization: `Key ${falKey}`, ...extra };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Errors and retry policy
 * ──────────────────────────────────────────────────────────────────────────*/

/** Carries the HTTP status so the retry policy can discriminate without parsing
 * a message string. A message-sniffing retry policy is one refactor away from
 * retrying an auth failure. */
export class FalHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "FalHttpError";
    this.status = status;
  }
}

/**
 * Retry ONLY transient conditions: a network-level failure (no status at all),
 * 429, or 5xx.
 *
 * A 401 IS NOT TRANSIENT and must never be retried. Retrying an auth failure
 * turns one clear, immediately-diagnosable error into three, invites a
 * rate-limit ban, and hides the real cause behind whatever the ban says
 * afterwards. The same holds for 4xx validation errors: the request is wrong
 * and will be exactly as wrong the next time. T-118-42.
 */
export function isTransient(err) {
  if (err instanceof FalHttpError) return err.status === 429 || err.status >= 500;
  return true; // network error / abort — no status was ever received
}

/**
 * Bounded retry wrapper, following veo.ts's `{maxAttempts, baseDelayMs,
 * backoffFactor}` shape (the one genuinely reusable thing in the donor).
 * Non-transient failures rethrow on the FIRST attempt — the bound is a ceiling
 * for transient errors, not a floor everything is dragged through.
 */
export async function withRetry(fn, opts = {}, deps = {}) {
  const { maxAttempts, baseDelayMs, backoffFactor } = { ...DEFAULT_RETRY, ...opts };
  const { sleep = defaultSleep } = deps;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err;
      if (attempt === maxAttempts) break;
      await sleep(baseDelayMs * backoffFactor ** (attempt - 1));
    }
  }
  throw lastErr;
}

function defaultSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Every outbound call goes through here, so the AbortController timeout and
 * the auth header cannot be forgotten on a new call site. */
async function falFetch(url, { falKey, method = "GET", body, fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = authHeaders(falKey, body ? { "Content-Type": "application/json" } : {});
    const resp = await fetchImpl(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!resp.ok) {
      // The body is included because fal's errors are informative, but it is
      // TRUNCATED and the request headers are NEVER echoed — the key lives in a
      // header, and an error path that dumps the request is the classic way a
      // credential reaches a log file (T-118-04).
      const text = await safeText(resp);
      throw new FalHttpError(resp.status, `${method} ${redactUrl(url)} -> HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch {
    return "<unreadable body>";
  }
}

/** Strips any query string before a URL reaches a log line. fal's own URLs
 * carry no credential, but a future signed result URL would, and a redactor
 * added after the fact is a redactor added too late. */
export function redactUrl(url) {
  const i = String(url).indexOf("?");
  return i === -1 ? String(url) : `${String(url).slice(0, i)}?<redacted>`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The queue cycle
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * POST the job to fal.ai's queue and return the handles it gives back.
 *
 * Returns `{requestId, statusUrl, responseUrl, cancelUrl, queuePosition}` using
 * the API's OWN urls. `statusUrl`/`responseUrl` fall back to the documented
 * template only when the response omits them, and that fallback is deliberately
 * the exception rather than the rule.
 */
export async function submitJob(modelId, input, config, deps = {}) {
  const { fetchImpl = fetch, timeoutMs } = deps;
  const url = `${FAL_QUEUE_BASE}/${modelId}`;
  const resp = await falFetch(url, {
    falKey: config.falKey,
    method: "POST",
    body: input,
    fetchImpl,
    timeoutMs,
  });
  const json = await resp.json();
  const requestId = json.request_id;
  if (!requestId) {
    throw new FalHttpError(resp.status ?? 200, `submit returned no request_id (keys: ${Object.keys(json).join(",")})`);
  }
  return {
    requestId,
    statusUrl: json.status_url || `${url}/requests/${requestId}/status`,
    responseUrl: json.response_url || `${url}/requests/${requestId}`,
    cancelUrl: json.cancel_url,
    queuePosition: json.queue_position,
  };
}

/**
 * Poll a queue request until a terminal status.
 *
 * Bounded on BOTH axes (see DEFAULT_POLL). Returns
 * `{ok:true, status:"COMPLETED", responseUrl, attempts}` or
 * `{ok:false, reason, attempts}` where reason is `POLL_TIMEOUT`,
 * `POLL_BUDGET_EXHAUSTED`, or the terminal failure status the API reported.
 *
 * It NEVER loops forever and it NEVER returns success on an exhausted budget —
 * a poll loop that gives up quietly and lets the caller "fetch the result"
 * produces a confusing 4xx far from the actual cause.
 */
export async function pollJob(statusUrl, config, deps = {}) {
  const {
    fetchImpl = fetch,
    sleep = defaultSleep,
    now = () => Date.now(),
    timeoutMs,
    poll = {},
  } = deps;
  const { maxAttempts, budgetMs, intervalMs, maxIntervalMs, backoffFactor } = { ...DEFAULT_POLL, ...poll };

  const startedAt = now();
  let delay = intervalMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const resp = await falFetch(statusUrl, { falKey: config.falKey, fetchImpl, timeoutMs });
    const json = await resp.json();
    const status = json.status;

    if (status === "COMPLETED") {
      return { ok: true, status, responseUrl: json.response_url, attempts: attempt };
    }
    if (status && status !== "IN_QUEUE" && status !== "IN_PROGRESS") {
      // Anything not documented as in-flight is terminal. Treating an unknown
      // status as in-flight would poll a dead job to the budget every time fal
      // adds a state.
      return { ok: false, reason: status, attempts: attempt };
    }

    if (attempt === maxAttempts) return { ok: false, reason: "POLL_TIMEOUT", attempts: attempt };
    if (now() - startedAt >= budgetMs) return { ok: false, reason: "POLL_BUDGET_EXHAUSTED", attempts: attempt };

    await sleep(delay);
    delay = Math.min(Math.round(delay * backoffFactor), maxIntervalMs);
  }

  /* c8 ignore next */
  return { ok: false, reason: "POLL_TIMEOUT", attempts: maxAttempts };
}

/** GET the finished job's payload from the URL the queue handed back. */
export async function fetchResult(responseUrl, config, deps = {}) {
  const { fetchImpl = fetch, timeoutMs } = deps;
  const resp = await falFetch(responseUrl, { falKey: config.falKey, fetchImpl, timeoutMs });
  return resp.json();
}

/**
 * Pull the first asset URL out of a model-specific result payload.
 *
 * fal's result shape is per-model. The known shapes are enumerated rather than
 * guessed, and an unrecognised payload FAILS LOUD with its key list instead of
 * returning undefined — a silent undefined here surfaces later as an
 * incomprehensible download error.
 */
export function extractAssetUrl(result) {
  const candidates = [
    result?.images?.[0],
    result?.image,
    result?.video,
    result?.audio,
    result?.audio_file,
  ];
  for (const c of candidates) {
    if (c && typeof c.url === "string") return { url: c.url, contentType: c.content_type };
  }
  throw new Error(`fal result carried no recognised asset url (top-level keys: ${Object.keys(result ?? {}).join(",")})`);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Download
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Assert a destination path resolves INSIDE the vault's gen\ directory.
 *
 * The result URL and any filename derived from it are REMOTE-SUPPLIED (T-118-06).
 * A `../` in a remote filename is the whole attack, and `startsWith` on an
 * unresolved string is the classic broken version of this check — hence
 * `resolve()` on both sides and the trailing separator, so `gen-evil\` cannot
 * pass as a prefix of `gen\`.
 */
export function assertInsideGen(destPath, vaultRoot) {
  const genDir = resolve(vaultRoot, "gen");
  const dest = resolve(destPath);
  if (dest !== genDir && !dest.startsWith(genDir + sep)) {
    throw new Error(`refusing to write outside the vault's gen directory: ${dest} is not inside ${genDir}`);
  }
  return dest;
}

/**
 * Stream the asset bytes to disk. STREAMS — never buffers. A video result can
 * be hundreds of megabytes and `await resp.arrayBuffer()` would hold all of it
 * in memory (T-118-22). The path check runs BEFORE any handle is opened, so a
 * refusal performs zero filesystem writes.
 */
export async function downloadResult(resultUrl, destPath, config, deps = {}) {
  const {
    fetchImpl = fetch,
    timeoutMs,
    createWriteStreamImpl = createWriteStream,
    mkdirImpl = mkdir,
  } = deps;

  const dest = assertInsideGen(destPath, config.vaultRoot);

  // The asset URL is a CDN url, not a queue endpoint — it takes no auth header.
  // Sending one would leak the key to a third-party host for no benefit.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetchImpl(resultUrl, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    throw new FalHttpError(resp.status, `GET ${redactUrl(resultUrl)} -> HTTP ${resp.status}`);
  }

  await mkdirImpl(dirname(dest), { recursive: true });
  const body = typeof resp.body?.pipe === "function" ? resp.body : Readable.fromWeb(resp.body);
  await pipeline(body, createWriteStreamImpl(dest));
  return dest;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Composed flow
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * The whole leg: submit → poll → fetch result → download bytes.
 *
 * Returns exactly what /studio-generate needs to write the sidecar per
 * docs/studio-sidecar-contract.md §3 — note `params` comes back ALREADY
 * STRINGIFIED, because `sanitizeSidecar` keeps `params` only when it is already
 * a string and silently drops an object. Returning the string is what stops the
 * caller from having to remember that.
 */
export async function generate({ modelId, prompt, params = {}, destPath }, config, deps = {}) {
  const input = { prompt, ...params };

  const submitted = await withRetry(() => submitJob(modelId, input, config, deps), deps.retry, deps);

  const polled = await pollJob(submitted.statusUrl, config, deps);
  if (!polled.ok) {
    return { ok: false, reason: polled.reason, requestId: submitted.requestId, attempts: polled.attempts };
  }

  const result = await withRetry(
    () => fetchResult(polled.responseUrl || submitted.responseUrl, config, deps),
    deps.retry,
    deps
  );
  const asset = extractAssetUrl(result);
  const finalPath = await downloadResult(asset.url, destPath, config, deps);

  return {
    ok: true,
    requestId: submitted.requestId,
    attempts: polled.attempts,
    localPath: finalPath,
    contentType: asset.contentType,
    // The sidecar block, contract §3. `provider` is the generation BACKEND.
    sidecar: {
      prompt,
      model: modelId,
      provider: "fal",
      params: JSON.stringify(input),
    },
  };
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

/** Default destination name, following the contract §1 filename convention
 * `{project}_{variant}_{attempt}_{ts}.{ext}`. Kept SHORT on purpose: a long
 * timestamped filename trips detectCredentialValue's rule C, which is a
 * documented false positive in convex/media.ts. */
export function defaultDestPath(vaultRoot, modelId, contentType, now) {
  const ext = (contentType || "image/png").split("/")[1]?.split("+")[0] || "png";
  const slug = modelId.split("/").pop().replace(/[^A-Za-z0-9]+/g, "-").slice(0, 12);
  const ts = new Date(now).toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  return join(vaultRoot, "gen", `fal_${slug}_${ts}.${ext}`);
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const {
    env = process.env,
    log = console.log,
    errorLog = console.error,
    exit = process.exit,
    now = () => Date.now(),
  } = deps;

  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    errorLog(`studioFal: ${err.message}`);
    return exit(2);
  }
  if (args.help) {
    log(USAGE);
    return exit(0);
  }

  const config = resolveFalConfig(env, deps);

  // THE UNAUTHENTICATED-REQUEST GUARD. This returns BEFORE any fetch is
  // constructed, which is why the test asserts fetchImpl call count 0 rather
  // than asserting on the exit code alone — an exit-2 that happens after a
  // request has already gone out is not the same guard.
  if (!config.falKey) {
    errorLog(
      "studioFal: FAL_KEY is not set. Set it in your environment or in " +
        "<homedir>/.claude/skills/studio/.env — a missing key is a configuration error, " +
        "never an unauthenticated request."
    );
    return exit(2);
  }
  if (!args.model) {
    errorLog("studioFal: --model is required. Read the id off fal.ai's model listing; never hand-construct one.");
    return exit(2);
  }
  if (!args.prompt) {
    errorLog("studioFal: --prompt is required.");
    return exit(2);
  }

  let params = {};
  if (args.params) {
    try {
      params = JSON.parse(args.params);
    } catch (err) {
      errorLog(`studioFal: --params is not valid JSON: ${err.message}`);
      return exit(2);
    }
  }

  const destPath = args.out || defaultDestPath(config.vaultRoot, args.model, undefined, now());

  let outcome;
  try {
    outcome = await generate({ modelId: args.model, prompt: args.prompt, params, destPath }, config, deps);
  } catch (err) {
    // err.message may embed a truncated response body but never a header, so
    // the key cannot reach this line. Asserted by the secret-hygiene test.
    errorLog(`studioFal: ${err.message}`);
    return exit(err instanceof FalHttpError && err.status === 401 ? 2 : 3);
  }

  if (!outcome.ok) {
    errorLog(`studioFal: generation did not complete (${outcome.reason}) after ${outcome.attempts} poll attempts`);
    return exit(3);
  }

  log(JSON.stringify({ ok: true, localPath: outcome.localPath, sidecar: outcome.sidecar }, null, 2));
  return exit(0);
}

// Only run as a CLI when invoked directly, never on import from a test.
if (process.argv[1] && process.argv[1].endsWith("studioFal.mjs")) {
  main();
}
