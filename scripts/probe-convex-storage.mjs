// probe-convex-storage.mjs — D-01 control-paired Convex file-storage round-trip probe
// (Phase 118, plan 118-01, .planning/phases/118-studio-media-gallery/118-CONTEXT.md D-01).
//
// Answers one question with a live measurement, not a guess: does
// generateUploadUrl -> raw upload -> getUrl -> HTTP GET actually round-trip bytes on THIS
// self-hosted Convex backend? The result is paired with a known-null control (an already-orphaned
// `avatars.imageStorageId`, per CONTEXT.md's pre-flight table) so a PASS is discriminating rather
// than a probe that would print the same thing whether the mechanism works or not
// (2026-08-05 "control must be able to distinguish the claim" class of defect).
//
// This script drives ONLY already-deployed public functions on `convex/avatars.ts`
// (`list`, `getImageUrl`, `generateUploadUrl`) and Convex's own storage-upload endpoint. It never
// calls `avatars:saveImage`, so no existing `avatars` row is patched, and no existing blob is
// overwritten or deleted (T-118-12). It uploads exactly one small (4096-byte) synthetic blob and
// writes zero rows (T-118-11) — the uploaded blob is deliberately LEFT IN PLACE afterward as
// durable evidence that `/convex/data/storage/files` is no longer empty; this script never issues
// a delete.
//
// House conventions this joins (see hooks/loom-emit.mjs, hooks/ingestPost.mjs): no shebang
// (DEBT-05 — a shebang breaks the Vite/Rolldown SSR module transform used by this repo's `.mjs`
// test harness), env-var-first URL resolution with a hardcoded default, an AbortController +
// timeout wrapped around every fetch, and fail-LOUD exit-code discipline. Zero third-party
// dependencies: only `node:crypto` and the platform-global `fetch`.
//
// Exit codes: 0 PASS · 2 configuration (e.g. --help) · 3 transport/server error ·
//             4 refusal (no discriminating control available, or the round-trip did not verify)
//
// Usage:
//   node scripts/probe-convex-storage.mjs
//   CONVEX_SELFHOST_URL=http://127.0.0.1:1 node scripts/probe-convex-storage.mjs   (known-failure control)
//
// Never prints an Authorization header or any environment-variable VALUE — this backend's public
// functions require no credential (CLAUDE.md, "Self-Hosted Convex — Operational Rules", measured
// 2026-08-11), so this script sends none.

import { createHash } from "node:crypto";

const DEFAULT_BASE_URL = "http://127.0.0.1:3210";
const FALLBACK_ORIGIN = "http://127.0.0.1:3211"; // the site/HTTP-actions origin, per A2 (hooks/loom-emit.mjs:37-38)
const TIMEOUT_MS = 15_000;

const USAGE = `probe-convex-storage.mjs — D-01 control-paired Convex file-storage round-trip probe

  node scripts/probe-convex-storage.mjs

Environment:
  CONVEX_SELFHOST_URL   backend API base URL, defaults to ${DEFAULT_BASE_URL}

Exit codes: 0 PASS · 2 configuration · 3 transport/server · 4 refusal
`;

const baseUrl = (process.env.CONVEX_SELFHOST_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");

/** Every diagnostic names the base URL so a wrong target is visible at once. Never prints env-var VALUEs beyond this one, which is a target URL, not a secret. */
function die(code, message) {
  console.error(`probe-convex-storage: ${message} (base URL: ${baseUrl})`);
  process.exit(code);
}

class TransportError extends Error {}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw new TransportError(
      err.name === "AbortError"
        ? `timed out after ${TIMEOUT_MS}ms fetching ${url}`
        : `request to ${url} failed: ${err.message}`
    );
  } finally {
    clearTimeout(timer);
  }
}

/** POST to /api/query or /api/mutation with the {path,args,format} envelope this backend's HTTP API expects. */
async function callConvex(kind, path, args) {
  const url = `${baseUrl}/api/${kind}`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TransportError(`non-JSON response from ${kind} ${path}: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return { httpStatus: res.status, json };
}

/** Rewrite a URL's origin to the local site/HTTP-actions origin, per A2's documented fallback. */
function rewriteToFallbackOrigin(urlString) {
  const rewritten = new URL(urlString);
  const fallback = new URL(FALLBACK_ORIGIN);
  rewritten.protocol = fallback.protocol;
  rewritten.hostname = fallback.hostname;
  rewritten.port = fallback.port;
  return rewritten.toString();
}

/** One raw POST attempt against a Convex-owned storage URL. Never throws — transport failures are captured in the returned record so the caller can decide whether to retry. */
async function attemptUpload(url, body) {
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "image/webp" },
      body,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Non-JSON response body is itself a finding — recorded via `raw` below.
    }
    return { url, httpStatus: res.status, ok: res.ok, storageId: json?.storageId, raw: text.slice(0, 300), transportError: null };
  } catch (err) {
    return { url, httpStatus: null, ok: false, storageId: undefined, raw: null, transportError: err.message };
  }
}

/** One raw GET attempt against a Convex-owned blob URL. Same never-throws shape as attemptUpload. */
async function attemptGet(url) {
  try {
    const res = await fetchWithTimeout(url, { method: "GET" });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      url,
      httpStatus: res.status,
      ok: res.ok,
      contentLength: res.headers.get("content-length"),
      byteCount: buf.length,
      transportError: null,
    };
  } catch (err) {
    return { url, httpStatus: null, ok: false, contentLength: null, byteCount: 0, transportError: err.message };
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(USAGE);
    // Non-zero on purpose: this is also this script's fast known-failure control (no network
    // call, cannot hang) alongside the unreachable-CONVEX_SELFHOST_URL control documented above.
    process.exit(2);
  }

  console.log(`probe-convex-storage: target ${baseUrl}`);

  // --- Step 1: Control-A acquisition. MUST run before any write. ---
  const listResult = await callConvex("query", "avatars:list", {});
  if (listResult.json.status !== "success") {
    die(3, `avatars:list failed: ${JSON.stringify(listResult.json)}`);
  }
  const rows = listResult.json.value;
  const orphanRow = rows.find((r) => typeof r.imageStorageId === "string" && r.imageStorageId.length > 0);
  if (!orphanRow) {
    die(
      4,
      "no avatars row carries a non-empty imageStorageId — the null-control is unavailable, so " +
        "this run cannot discriminate a working round-trip from a broken one. Refusing rather " +
        "than fabricating a control ID."
    );
  }
  const CONTROL_ORPHAN_ID = orphanRow.imageStorageId;

  // --- Step 2: Control-A assertion. ---
  const controlQuery = await callConvex("query", "avatars:getImageUrl", { storageId: CONTROL_ORPHAN_ID });
  const controlSucceeded = controlQuery.json.status === "success";
  const CONTROL_RESULT = controlSucceeded ? controlQuery.json.value : `ERROR: ${JSON.stringify(controlQuery.json)}`;
  const controlIsNull = controlSucceeded && controlQuery.json.value === null;
  if (!controlIsNull) {
    console.log(
      `NOTE: control result was NOT null (${JSON.stringify(CONTROL_RESULT)}) — the orphaned-ID ` +
        "premise has changed since CONTEXT.md's pre-flight measurement; this run's discrimination " +
        "argument must be restated in the evidence file, not assumed."
    );
  }

  // --- Step 3: Mint. ---
  const mintResult = await callConvex("mutation", "avatars:generateUploadUrl", {});
  if (mintResult.json.status !== "success") {
    die(3, `avatars:generateUploadUrl failed: ${JSON.stringify(mintResult.json)}`);
  }
  const mintedUrl = mintResult.json.value;
  let mintedUrlObj;
  try {
    mintedUrlObj = new URL(mintedUrl);
  } catch {
    die(3, `generateUploadUrl returned an unparsable URL: ${mintedUrl}`);
  }
  const MINTED_UPLOAD_URL_ORIGIN = mintedUrlObj.origin;

  // --- Step 4: Upload. Deterministic 4096-byte payload; content is irrelevant, only that its
  //     length is known and non-zero. ---
  const seed = createHash("sha256").update("codepulse-118-d01-probe-payload").digest(); // 32 bytes
  const payload = Buffer.concat(Array.from({ length: 128 }, () => seed)); // 128 * 32 = 4096 bytes

  const uploadAttempts = [];
  let uploadResult = null;
  let workingOrigin = null;

  const attempt1 = await attemptUpload(mintedUrl, payload);
  uploadAttempts.push(attempt1);
  if (attempt1.ok) {
    uploadResult = attempt1;
    workingOrigin = MINTED_UPLOAD_URL_ORIGIN;
  } else if (mintedUrlObj.hostname !== "127.0.0.1" && attempt1.transportError) {
    // A2: verbatim attempt failed at the transport layer (DNS/connect/TLS) — retry once with
    // only the origin rewritten to the local site/HTTP-actions origin.
    const fallbackUrl = rewriteToFallbackOrigin(mintedUrl);
    const attempt2 = await attemptUpload(fallbackUrl, payload);
    uploadAttempts.push(attempt2);
    if (attempt2.ok) {
      uploadResult = attempt2;
      workingOrigin = FALLBACK_ORIGIN;
    }
  }

  const UPLOAD_STATUS = uploadResult ? uploadResult.httpStatus : (attempt1.transportError ? "TRANSPORT_ERROR" : attempt1.httpStatus);
  const NEW_STORAGE_ID = uploadResult?.storageId;

  // --- Step 5: Read back. ---
  let GETURL_RESULT = null;
  let getUrlObj = null;
  if (NEW_STORAGE_ID) {
    const getUrlQuery = await callConvex("query", "avatars:getImageUrl", { storageId: NEW_STORAGE_ID });
    GETURL_RESULT = getUrlQuery.json.status === "success" ? getUrlQuery.json.value : `ERROR: ${JSON.stringify(getUrlQuery.json)}`;
    if (typeof GETURL_RESULT === "string") {
      try {
        getUrlObj = new URL(GETURL_RESULT);
      } catch {
        // leave getUrlObj null; recorded as a finding below via GET_STATUS staying null
      }
    }
  }

  // --- Step 6: Fetch the bytes. ---
  let GET_STATUS = null;
  let GET_BYTES = 0;
  let contentLengthHeader = null;
  if (getUrlObj) {
    const getAttempts = [];
    const getAttempt1 = await attemptGet(GETURL_RESULT);
    getAttempts.push(getAttempt1);
    let finalGet = getAttempt1;
    if (!getAttempt1.ok && getUrlObj.hostname !== "127.0.0.1" && getAttempt1.transportError) {
      const fallbackGetUrl = rewriteToFallbackOrigin(GETURL_RESULT);
      const getAttempt2 = await attemptGet(fallbackGetUrl);
      getAttempts.push(getAttempt2);
      if (getAttempt2.ok) {
        finalGet = getAttempt2;
        workingOrigin = FALLBACK_ORIGIN;
      }
    }
    GET_STATUS = finalGet.transportError ? "TRANSPORT_ERROR" : finalGet.httpStatus;
    GET_BYTES = finalGet.byteCount;
    contentLengthHeader = finalGet.contentLength;
  }

  // --- Step 7: Verdict. ---
  const uploadOk = UPLOAD_STATUS >= 200 && UPLOAD_STATUS < 300;
  const getOk = GET_STATUS === 200;
  const bytesOk = GET_BYTES > 0;
  const PASS = controlIsNull && uploadOk && getOk && bytesOk;

  console.log("");
  console.log("=== VERDICT BLOCK ===");
  console.log(`CONTROL_ORPHAN_ID: ${CONTROL_ORPHAN_ID}`);
  console.log(`CONTROL_RESULT: ${JSON.stringify(CONTROL_RESULT)}`);
  console.log(`MINTED_UPLOAD_URL_ORIGIN: ${MINTED_UPLOAD_URL_ORIGIN}`);
  console.log(`UPLOAD_STATUS: ${UPLOAD_STATUS}`);
  console.log(`NEW_STORAGE_ID: ${NEW_STORAGE_ID ?? "(none)"}`);
  console.log(`GETURL_RESULT: ${JSON.stringify(GETURL_RESULT)}`);
  console.log(`GET_STATUS: ${GET_STATUS}`);
  console.log(`GET_CONTENT_LENGTH_HEADER: ${contentLengthHeader}`);
  console.log(`GET_BYTES: ${GET_BYTES}`);
  console.log(`WORKING_ORIGIN: ${workingOrigin ?? "(none — round-trip did not complete)"}`);
  console.log(`UPLOAD_ATTEMPTS: ${JSON.stringify(uploadAttempts)}`);

  if (PASS) {
    console.log("VERDICT: PASS");
    process.exit(0);
  }

  const reasons = [];
  if (!controlIsNull) reasons.push("control did not resolve null");
  if (!uploadOk) reasons.push(`upload status was ${UPLOAD_STATUS}, not 2xx`);
  if (!getOk) reasons.push(`GET status was ${GET_STATUS}, not 200`);
  if (!bytesOk) reasons.push("received byte count was not greater than zero");
  console.log(`VERDICT: FAIL — ${reasons.join("; ")}`);
  process.exit(4);
}

main().catch((err) => {
  if (err instanceof TransportError) {
    die(3, err.message);
  }
  die(3, `unexpected error: ${err.message}`);
});
