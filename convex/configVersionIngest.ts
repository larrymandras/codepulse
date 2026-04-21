import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { corsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * Phase 80: Config Versioning ingest endpoint.
 *
 * Receives version snapshots from the Astridr backend whenever an agent
 * config is created, updated, cloned, imported, or rolled back.
 */
export const configVersionIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    const agentId = body.agentId as string;
    const config = body.config;
    const changeSummary = (body.changeSummary as string) ?? "Config changed";
    const changeType = (body.changeType as string) ?? "update";
    const author = (body.author as string) ?? "system";
    const parentVersion = body.parentVersion as number | undefined;

    if (!agentId || !config) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: agentId, config" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

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
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
