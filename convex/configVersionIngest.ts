import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  getCorsHeaders,
  validateIngestAuth,
  unauthorizedResponse,
  checkBodySize,
  payloadTooLargeResponse,
  rateLimitResponse,
  validationErrorResponse,
} from "./ingestAuth";
import { ingestRateLimiter } from "./ingestRateLimit";
import { validatePayload, type FieldSchema } from "./lib/validation";

const configVersionSchema: Record<string, FieldSchema> = {
  agentId: { type: "string", required: true },
  config: { type: "object", required: true },
  changeSummary: { type: "string", required: false },
  changeType: { type: "string", required: false },
  author: { type: "string", required: false },
  parentVersion: { type: "number", required: false },
};

/**
 * Phase 80: Config Versioning ingest endpoint.
 *
 * Receives version snapshots from the Astridr backend whenever an agent
 * config is created, updated, cloned, imported, or rolled back.
 */
export const configVersionIngest = httpAction(async (ctx, request) => {
  const origin = request.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse(headers);
  }

  if (!checkBodySize(request)) {
    return payloadTooLargeResponse(headers);
  }

  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "anonymous";
  const rateCheck = await ingestRateLimiter.limit(ctx, "general", { key: apiKey });
  if (!rateCheck.ok) {
    return rateLimitResponse(headers, rateCheck.retryAfter);
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    // D-09/D-11: Strict schema validation
    const errors = validatePayload(body, configVersionSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    const agentId = body.agentId as string;
    const config = body.config;
    const changeSummary = (body.changeSummary as string) ?? "Config changed";
    const changeType = (body.changeType as string) ?? "update";
    const author = (body.author as string) ?? "system";
    const parentVersion = body.parentVersion as number | undefined;

    await ctx.runMutation(api.agentConfigVersions.createVersion, {
      agentId,
      config,
      changeSummary,
      changeType,
      author,
      parentVersion,
    });

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
