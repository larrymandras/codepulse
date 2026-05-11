import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  getCorsHeaders,
  validateIngestAuth,
  unauthorizedResponse,
} from "./ingestAuth";

/**
 * HTTP endpoint: GET /api/config/cost-guardrails
 *
 * Returns the current cost guardrail limits from agentConfigs.
 * Called by Astridr at boot time to load configurable limits.
 * Also handles OPTIONS for CORS preflight.
 */
export const costGuardrailConfig = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin");
  const corsBase = getCorsHeaders(origin);
  // Override allowed methods for this GET endpoint
  const headers: Record<string, string> = {
    ...corsBase,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  // Require auth — same Bearer token as ingest endpoints
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse(headers);
  }

  try {
    const result = await ctx.runQuery(api.forecasts.getCostGuardrails);

    const body = JSON.stringify({
      session_limit_usd: result.sessionLimitUsd,
      daily_limit_usd: result.dailyLimitUsd,
      hourly_limit_usd: result.hourlyLimitUsd,
    });

    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json", ...headers },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e.message ?? "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...headers } },
    );
  }
});
