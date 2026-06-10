import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { getCorsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

export const hrIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...getCorsHeaders(request) } }
      );
    }

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
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    });
  }
});
