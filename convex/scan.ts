import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  getCorsHeaders,
  validateIngestAuth,
  unauthorizedResponse,
  checkBodySize,
  payloadTooLargeResponse,
  rateLimitResponse,
} from "./ingestAuth";
import { ingestRateLimiter } from "./ingestRateLimit";

/**
 * HTTP action: POST /scan
 *
 * Environment scan endpoint. Receives a full inventory snapshot
 * and syncs it to the registry tables.
 */
export const scanEndpoint = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse(headers);
  }

  // D-08: Reject oversized payloads before parsing.
  if (!checkBodySize(request)) {
    return payloadTooLargeResponse(headers);
  }

  // D-06/D-07: Rate limit per API key.
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "anonymous";
  const rateCheck = await ingestRateLimiter.limit(ctx, "general", { key: apiKey });
  if (!rateCheck.ok) {
    return rateLimitResponse(headers, rateCheck.retryAfter);
  }

  try {
    const body = await request.json();
    await ctx.runMutation(api.registry.syncInventory, { snapshot: body });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...headers },
    });
  }
});
