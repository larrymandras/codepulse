/**
 * HTTP action: POST /forge-ingest
 *
 * Accepts job-state and workspace-sync payloads from the Forge daemon and
 * dispatches them to idempotent internal mutations.
 *
 * Auth: Bearer FORGE_INGEST_API_KEY (server-to-server only; never in browser).
 * httpActions have no Clerk identity — upserts are internalMutation (D-05).
 *
 * Wire envelope (P078):
 *   { type: "job",        hostId, job: ForgeIngestJob }
 *   { type: "workspaces", hostId, workspaces: ForgeIngestWorkspace[] }
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getCorsHeaders, validateForgeIngestAuth, unauthorizedResponse } from "./ingestAuth";

export const forgeIngest = httpAction(async (ctx, request) => {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(request),
    });
  }

  // Bearer token auth (D-03)
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

  const { type, hostId } = body ?? {};

  if (!type || !hostId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: type, hostId" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  if (type === "job") {
    const job = body.job;
    if (!job) {
      return new Response(
        JSON.stringify({ error: "Missing job payload" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
        }
      );
    }

    await ctx.runMutation(internal.forge.upsertJob, {
      forgeJobId:    job.forgeJobId,
      hostId:        hostId,
      agent:         job.agent,
      mode:          job.mode,
      prompt:        job.prompt ?? null,
      workspaceId:   job.workspaceId,
      status:        job.status,
      pid:           job.pid ?? null,
      exitCode:      job.exitCode ?? null,
      startedAt:     job.startedAt ?? null,
      finishedAt:    job.finishedAt ?? null,
      artifactCount: job.artifactCount ?? 0,
      model:         job.model ?? null,
      capabilities:  job.capabilities ?? "{}",
      createdAt:     job.createdAt,
      updatedAt:     job.updatedAt,
    });

  } else if (type === "workspaces") {
    const workspaces = body.workspaces;
    if (!Array.isArray(workspaces)) {
      return new Response(
        JSON.stringify({ error: "workspaces must be an array" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
        }
      );
    }

    await ctx.runMutation(internal.forge.upsertWorkspaces, {
      hostId,
      workspaces,
    });

  } else {
    return new Response(
      JSON.stringify({ error: `Unknown type: ${type}` }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
      }
    );
  }

  return new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(request) },
    }
  );
});
