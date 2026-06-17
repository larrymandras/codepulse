/**
 * HTTP action: POST /forge-file-ingest
 *
 * Accepts file metadata + artifact content payloads from the Forge daemon and
 * dispatches them to the path-idempotent upsertFileEntries / upsertArtifacts
 * internalMutations.
 *
 * Auth: Bearer FORGE_INGEST_API_KEY — D-3: same shared key as /forge-ingest and
 * /forge-log-ingest, different URL gate. Auth utilities reused verbatim from ingestAuth.ts.
 * httpActions have no Clerk identity — writes are internalMutation (81-SPEC §3).
 *
 * Image blob handling (D-02 / ActionCtx-only):
 *   For each artifact with kind === "image" and imageBase64 present, the httpAction
 *   decodes base64 → Uint8Array → Blob → ctx.storage.store(blob) → storageId.
 *   The storageId is passed to upsertArtifacts; imageBase64 is NEVER written to
 *   the Convex doc (Pitfall 3 / T-82-06).
 *
 * Wire envelope (Phase 82 / FI-12):
 *   {
 *     type: "files",
 *     hostId: string,
 *     forgeJobId: string,
 *     files: Array<{ path, kind, sizeBytes }>,
 *     artifacts?: Array<{ path, kind, sizeBytes, textContent?, imageBase64? }>
 *   }
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";

export const forgeFileIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth (T-82-01: reuse validateForgeIngestAuth — same key, different gate)
  if (!validateForgeIngestAuth(request)) {
    return unauthorizedResponse();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  const { type, hostId, forgeJobId, files, artifacts } = body ?? {};

  // T-82-02: type + required fields validation; NO seq field (Pitfall 6 — path is idempotency key)
  if (type !== "files" || !hostId || !forgeJobId || !Array.isArray(files)) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: type, hostId, forgeJobId, files" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  // ---------------------------------------------------------------------------
  // D-02: Image blob handling — decode base64 in ActionCtx, store via ctx.storage,
  // pass storageId to internalMutation. NEVER write base64 to the doc (Pitfall 3 / T-82-06).
  // ---------------------------------------------------------------------------
  const artifactList: any[] = Array.isArray(artifacts) ? artifacts : [];
  const artifactsWithStorageIds: any[] = [];

  for (const artifact of artifactList) {
    if (artifact.kind === "image" && artifact.imageBase64) {
      let bytes: Uint8Array;
      try {
        // atob is available in the Convex V8 runtime (Web API).
        // Fallback: Buffer.from(artifact.imageBase64, "base64") for Node-compat (RESEARCH A2).
        if (typeof atob === "function") {
          bytes = Uint8Array.from(atob(artifact.imageBase64), (c) => c.charCodeAt(0));
        } else {
          // Node-compatible fallback (should not be needed in Convex V8, but defensive)
          const buf = Buffer.from(artifact.imageBase64, "base64");
          bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        }
        const blob = new Blob([bytes.buffer as ArrayBuffer]);
        const storageId = await ctx.storage.store(blob);
        // imageBase64 is intentionally dropped — never persisted (T-82-06)
        const { imageBase64: _dropped, ...rest } = artifact;
        artifactsWithStorageIds.push({ ...rest, storageId });
      } catch {
        // If blob decode/store fails, push the artifact without storageId (graceful degradation).
        // textContent is absent for images; artifact will appear as metadata-only fallback.
        const { imageBase64: _dropped, ...rest } = artifact;
        artifactsWithStorageIds.push({ ...rest });
      }
    } else {
      // Text artifact or metadata-only: pass through with textContent unchanged.
      // imageBase64 field is stripped if present for non-image kinds (defensive).
      const { imageBase64: _dropped, ...rest } = artifact;
      artifactsWithStorageIds.push(rest);
    }
  }

  // Dispatch file metadata rows.
  await ctx.runMutation(internal.forge.upsertFileEntries, {
    hostId,
    forgeJobId,
    files,
  });

  // Dispatch artifact content rows (with resolved storageIds for images).
  if (artifactsWithStorageIds.length > 0) {
    await ctx.runMutation(internal.forge.upsertArtifacts, {
      hostId,
      forgeJobId,
      artifacts: artifactsWithStorageIds,
    });
  }

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
});
