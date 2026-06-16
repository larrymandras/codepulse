/**
 * HTTP action: POST /forge-log-ingest
 *
 * Accepts append-only log chunk payloads from the Forge daemon and dispatches
 * them to the seq-idempotent appendLogChunk internalMutation.
 *
 * Auth: Bearer FORGE_INGEST_API_KEY — D-3: same shared key as /forge-ingest,
 * different URL gate. Auth utilities reused verbatim from ingestAuth.ts.
 * httpActions have no Clerk identity — writes are internalMutation (81-SPEC §3).
 *
 * Wire envelope (Phase 81 / FI-09):
 *   { type: "log", hostId: string, forgeJobId: string, lines: string[], seq: number, sentAt?: string }
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";

export const forgeLogIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth (D-3: reuse validateForgeIngestAuth — same key, different gate)
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

  const { type, hostId, forgeJobId, lines, seq } = body ?? {};

  if (type !== "log" || !hostId || !forgeJobId || !Array.isArray(lines) || seq == null) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: type, hostId, forgeJobId, lines, seq" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  await ctx.runMutation(internal.forge.appendLogChunk, {
    hostId,
    forgeJobId,
    lines,
    seq,
    sentAt: body.sentAt ?? undefined,
  });

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
});
