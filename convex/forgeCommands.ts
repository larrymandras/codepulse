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
import { MAX_ACK_REPORT_BYTES, isValidSupportedTypesShape } from "./forge";

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

  const { hostId, supportedTypes } = body ?? {};
  if (!hostId) {
    return new Response(
      JSON.stringify({ error: "Missing required field: hostId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
  // D-P10-12: guard placed here, in the httpAction, BEFORE ctx.runMutation is
  // called — claimAndUpsertHost's own arg validator throws on a malformed
  // shape, but that throw does not become an HTTP 4xx (it 500s). See
  // isValidSupportedTypesShape's doc comment in forge.ts.
  if (!isValidSupportedTypesShape(supportedTypes)) {
    return new Response(
      JSON.stringify({ error: "Invalid supportedTypes: expected an array of strings" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  const result = await ctx.runMutation(internal.forge.claimAndUpsertHost, {
    hostId,
    now: Date.now(),
    supportedTypes,
  });

  // D-P6-12: downloadUrl is resolved here, attached to the response object only —
  // it is never written back to the forgeCommands row (ctx.db.patch/insert),
  // matching forgeFileIngest.ts's "never persist derived/ephemeral capabilities"
  // convention (T-82-06).
  const commands = await Promise.all(
    result.map(async (cmd: any) => {
      if (cmd.commandType === "intake" && cmd.intakePayload?.storageId) {
        const downloadUrl = await ctx.storage.getUrl(cmd.intakePayload.storageId);
        return { ...cmd, downloadUrl };
      }
      return cmd;
    })
  );

  return new Response(
    JSON.stringify({ commands }),
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

  const { commandId, status, report } = body ?? {};
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
  // WR-02 (phase-06 review): only done/failed are ackable — anything else
  // would corrupt the queued|executing|done|failed|expired state machine
  // (e.g. status:"expired" makes the row terminal without the blob delete
  // firing; status:"queued" re-queues an executed command). 400 here gives
  // the daemon a diagnostic instead of a validator 500; ackCommand's own
  // v.union(v.literal(...)) validator is the defense-in-depth layer.
  if (status !== "done" && status !== "failed") {
    return new Response(
      JSON.stringify({ error: `Invalid status: expected "done" or "failed", got ${JSON.stringify(status)}` }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }
  // WR-03 (phase-06 review): reject a pathologically large report at the
  // door with a diagnostic 400 (the daemon should retry with a smaller or no
  // report). ackCommand's capAckReport is the defense-in-depth layer that
  // guarantees an ack that does reach the mutation can never fail on report
  // size — the blob delete and terminal patch must always commit.
  if (report !== undefined && report !== null) {
    let reportBytes: number;
    try {
      reportBytes = JSON.stringify(report).length;
    } catch {
      reportBytes = Number.POSITIVE_INFINITY;
    }
    if (reportBytes > MAX_ACK_REPORT_BYTES) {
      return new Response(
        JSON.stringify({ error: `Report too large: ${reportBytes} bytes exceeds the ${MAX_ACK_REPORT_BYTES}-byte cap` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
        }
      );
    }
  }

  await ctx.runMutation(internal.forge.ackCommand, {
    commandId,
    status,
    resolvedForgeJobId: body.forgeJobId ?? null,
    error:              body.error ?? null,
    now:                Date.now(),
    report:             report ?? null,
  });

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
});
