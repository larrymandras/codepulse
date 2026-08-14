/**
 * studioHttp.ts — POST /studio/ingest and POST /studio/upload-url
 * (Phase 118 Studio, D-15).
 *
 * `hooks/studioWatch.mjs` (plan 118-08) is the only caller — a host script
 * that scans `media-vault\`, uploads a bounded webp thumbnail, and POSTs
 * the resulting row here. No CORS headers and no OPTIONS partner,
 * deliberately, matching the `/galdr`, `/loom/event` and `/workspace-ingest`
 * precedents in `convex/http.ts`: the browser never calls this route, it
 * reads the gallery through Convex subscriptions instead.
 */
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateStudioAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * The single header-construction site for this file — Content-Type only, no
 * CORS — so there is exactly one place to audit for a CORS regression
 * (mirrors `loomHttp.ts`'s and `workspaceHttp.ts`'s `jsonResponse`).
 */
function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((el) => typeof el === "string");
}

/**
 * Sanitises the optional `sidecar` object, field by field — never forwarded
 * verbatim (no `v.any()` anywhere in this route or the mutation it calls).
 * A malformed individual field is simply dropped, not a request refusal:
 * D-07 already treats provenance absence as a defined, safe state, so a
 * bad `prompt` type shouldn't fail the whole ingest.
 */
function sanitizeSidecar(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of ["prompt", "model", "provider", "style", "project", "params"] as const) {
    if (typeof r[field] === "string") out[field] = r[field];
  }
  if (isStringArray(r.tags)) out.tags = r.tags;
  return out;
}

/**
 * POST /studio/ingest — see `118-05-PLAN.md`'s `<interfaces>` block for the
 * full wire contract; `hooks/studioWatch.mjs` (118-08) is written against
 * it byte-for-byte.
 *
 * D-15 / T-118-01 / T-118-17: fail-closed auth is the FIRST executable
 * statement, before `request.json()` and before any `ctx.runMutation` — an
 * unauthenticated caller must not be able to probe which content hashes
 * already exist by comparing response shapes.
 */
export const studioIngestPostHandler = async (ctx: any, request: Request) => {
  if (!validateStudioAuth(request)) return unauthorizedResponse();

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "INVALID_JSON" }, 400);
  }

  if (typeof body?.contentHash !== "string" || body.contentHash === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "contentHash" }, 400);
  }
  if (typeof body?.filename !== "string" || body.filename === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "filename" }, 400);
  }
  if (typeof body?.absPath !== "string" || body.absPath === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "absPath" }, 400);
  }
  if (typeof body?.mediaType !== "string" || body.mediaType === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "mediaType" }, 400);
  }
  if (typeof body?.kind !== "string" || body.kind === "") {
    return jsonResponse({ error: "MISSING_FIELD", field: "kind" }, 400);
  }
  if (!isFiniteNumber(body?.sizeBytes)) {
    return jsonResponse({ error: "MISSING_FIELD", field: "sizeBytes" }, 400);
  }

  const result = await ctx.runMutation(internal.media.ingestMedia, {
    contentHash: body.contentHash,
    filename: body.filename,
    absPath: body.absPath,
    mediaType: body.mediaType,
    kind: body.kind,
    sizeBytes: body.sizeBytes,
    thumbBytes: isFiniteNumber(body.thumbBytes) ? body.thumbBytes : undefined,
    thumbStorageId: typeof body.thumbStorageId === "string" ? body.thumbStorageId : undefined,
    thumbRelPath: typeof body.thumbRelPath === "string" ? body.thumbRelPath : undefined,
    width: isFiniteNumber(body.width) ? body.width : undefined,
    height: isFiniteNumber(body.height) ? body.height : undefined,
    durationSec: isFiniteNumber(body.durationSec) ? body.durationSec : undefined,
    sidecar: sanitizeSidecar(body.sidecar),
  });

  if (!result?.ok) {
    // INVALID_ENUM and THUMB_TOO_LARGE are the only refusal shapes
    // ingestMedia returns (convex/media.ts's ingestMediaHandler) — both map
    // to 400, matching the wire contract's Responses list.
    const payload: Record<string, unknown> = { error: result?.error ?? "REFUSED" };
    if (result?.field) payload.field = result.field;
    return jsonResponse(payload, 400);
  }

  return jsonResponse({ ok: true, mediaId: result.mediaId, created: result.created }, 200);
};

export const studioIngestPost = httpAction(studioIngestPostHandler);

/**
 * POST /studio/upload-url — wraps `internal.media.generateThumbUploadUrl`.
 * Registered only because the live D-01 branch is `convex-storage`
 * (`118-D01-EVIDENCE.md`); on the `local-static-origin` branch this route
 * would not exist, since that fallback uploads nothing to Convex.
 *
 * Same auth-first structure as the ingest handler above; no body is read.
 */
export const studioUploadUrlPostHandler = async (ctx: any, request: Request) => {
  if (!validateStudioAuth(request)) return unauthorizedResponse();

  const uploadUrl = await ctx.runMutation(internal.media.generateThumbUploadUrl, {});
  return jsonResponse({ ok: true, uploadUrl }, 200);
};

export const studioUploadUrlPost = httpAction(studioUploadUrlPostHandler);
