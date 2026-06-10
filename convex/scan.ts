import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * HTTP action: POST /scan
 *
 * Environment scan endpoint. Receives a full inventory snapshot
 * and syncs it to the registry tables.
 */
export const scanEndpoint = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json();
    await ctx.runMutation(api.registry.syncInventory, { snapshot: body });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
