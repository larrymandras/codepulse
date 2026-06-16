/**
 * HTTP actions: POST /forge-commands-claim and POST /forge-commands-ack
 *
 * Daemon-facing bearer-authed endpoints for the Forge command bridge (Phase 80).
 *
 * Auth: Bearer FORGE_INGEST_API_KEY — reuses the existing server-to-server key (D-14).
 *       Never exposed in the browser. Same fail-closed bearer check as /forge-ingest.
 *
 * /forge-commands-claim  — daemon polls this to atomically claim queued commands
 *                          and update host liveness (claimAndUpsertHost internalMutation).
 * /forge-commands-ack    — daemon posts the outcome of a claimed command
 *                          (ackCommand internalMutation).
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";

// ---------------------------------------------------------------------------
// POST /forge-commands-claim
// ---------------------------------------------------------------------------

export const forgeCommandsClaim = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth (D-14: reuses FORGE_INGEST_API_KEY)
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

  const { hostId } = body ?? {};
  if (!hostId) {
    return new Response(
      JSON.stringify({ error: "Missing required field: hostId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  const result = await ctx.runMutation(internal.forge.claimAndUpsertHost, {
    hostId,
    now: Date.now(),
  });

  return new Response(
    JSON.stringify({ commands: result }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
});

// ---------------------------------------------------------------------------
// POST /forge-commands-ack
// ---------------------------------------------------------------------------

export const forgeCommandsAck = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth (D-14: reuses FORGE_INGEST_API_KEY)
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

  const { commandId, status } = body ?? {};
  if (!commandId) {
    return new Response(
      JSON.stringify({ error: "Missing required field: commandId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
  if (!status) {
    return new Response(
      JSON.stringify({ error: "Missing required field: status" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  await ctx.runMutation(internal.forge.ackCommand, {
    commandId,
    status,
    resolvedForgeJobId: body.forgeJobId ?? null,
    error:              body.error ?? null,
    now:                Date.now(),
  });

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
});
