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

const hrSchema: Record<string, FieldSchema> = {
  type: { type: "string", required: true },
  requestId: { type: "string", required: false },
  agentName: { type: "string", required: false },
  agentId: { type: "string", required: false },
  catalogEntryId: { type: "string", required: false },
  tier: { type: "string", required: false },
  budgetFraction: { type: "number", required: false },
  status: { type: "string", required: false },
  configSnapshot: { type: "object", required: false },
  requestedAt: { type: "number", required: false },
  decidedAt: { type: "number", required: false },
  decidedBy: { type: "string", required: false },
};

export const hrIngest = httpAction(async (ctx, request) => {
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
    const errors = validatePayload(body, hrSchema);
    if (errors.length > 0) return validationErrorResponse(errors, headers);

    const eventType = body.type as string;

    if (eventType === "agent_approval_requested" || eventType === "agent_approval_decided") {
      await ctx.runMutation(api.approvalQueue.upsert, {
        requestId: body.requestId as string,
        agentName: body.agentName as string,
        agentId: body.agentId as string,
        catalogEntryId: body.catalogEntryId as string | undefined,
        tier: body.tier as string,
        budgetFraction: body.budgetFraction as number | undefined,
        status: body.status as string,
        configSnapshot: body.configSnapshot,
        requestedAt: body.requestedAt as number,
        decidedAt: body.decidedAt as number | undefined,
        decidedBy: body.decidedBy as string | undefined,
      });
    }

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
