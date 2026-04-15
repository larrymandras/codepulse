import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { corsHeaders, validateIngestAuth, unauthorizedResponse } from "./ingestAuth";

/**
 * POST /preflight-ingest
 * Ingest a memoryPreflight record.
 */
export const preflightIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    // Validate required fields (T-63-04: reject if missing)
    if (!body.profileId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: profileId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await ctx.runMutation(api.v6Mutations.insertMemoryPreflight, {
      sessionId: body.sessionId as string | undefined,
      profileId: body.profileId as string,
      hitCount: (body.hitCount as number) ?? 0,
      missCount: (body.missCount as number) ?? 0,
      latencyMs: (body.latencyMs as number) ?? 0,
      topMemoryIds: body.topMemoryIds as string[] | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
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

/**
 * POST /dreaming-ingest
 * Dispatches by `type` field: "cycle" or "fact".
 */
export const dreamingIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.type) {
      return new Response(
        JSON.stringify({ error: "Missing required field: type" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (body.type === "cycle") {
      if (!body.runDate || !body.status) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for cycle: runDate, status" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      await ctx.runMutation(api.v6Mutations.insertDreamingCycle, {
        runDate: body.runDate as string,
        status: body.status as string,
        rawCount: (body.rawCount as number) ?? 0,
        candidateCount: (body.candidateCount as number) ?? 0,
        extractedCount: (body.extractedCount as number) ?? 0,
        dedupedCount: (body.dedupedCount as number) ?? 0,
        storedCount: (body.storedCount as number) ?? 0,
        durationMs: body.durationMs as number | undefined,
        costUsd: body.costUsd as number | undefined,
        isBackfill: body.isBackfill as boolean | undefined,
        timestamp: (body.timestamp as number) ?? Date.now(),
      });
    } else if (body.type === "fact") {
      if (!body.factText || !body.category) {
        return new Response(
          JSON.stringify({ error: "Missing required fields for fact: factText, category" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      await ctx.runMutation(api.v6Mutations.insertDreamingFact, {
        cycleId: body.cycleId as string | undefined,
        factText: body.factText as string,
        category: body.category as string,
        confidence: (body.confidence as number) ?? 1.0,
        sourceMemoryIds: body.sourceMemoryIds as string[] | undefined,
        timestamp: (body.timestamp as number) ?? Date.now(),
      });
    } else {
      return new Response(
        JSON.stringify({ error: `Unknown type: ${body.type}. Expected "cycle" or "fact".` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

/**
 * POST /advisor-ingest
 * Ingest an advisorEvents record.
 */
export const advisorIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.provider) {
      return new Response(
        JSON.stringify({ error: "Missing required field: provider" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await ctx.runMutation(api.v6Mutations.insertAdvisorEvent, {
      sessionId: body.sessionId as string | undefined,
      provider: body.provider as string,
      model: body.model as string | undefined,
      used: (body.used as boolean) ?? false,
      inputTokens: (body.inputTokens as number) ?? 0,
      outputTokens: (body.outputTokens as number) ?? 0,
      costUsd: (body.costUsd as number) ?? 0,
      standardCostUsd: (body.standardCostUsd as number) ?? 0,
      latencyMs: body.latencyMs as number | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
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

/**
 * POST /import-ingest
 * Ingest a conversationImports record.
 */
export const importIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.importId || !body.source || !body.status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: importId, source, status" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await ctx.runMutation(api.v6Mutations.insertConversationImport, {
      importId: body.importId as string,
      source: body.source as string,
      status: body.status as string,
      conversationCount: (body.conversationCount as number) ?? 0,
      memoriesCreated: body.memoriesCreated as number | undefined,
      errorMessage: body.errorMessage as string | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
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

/**
 * POST /startup-ingest
 * Ingest a startupEvents record.
 */
export const startupIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.phase) {
      return new Response(
        JSON.stringify({ error: "Missing required field: phase" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await ctx.runMutation(api.v6Mutations.insertStartupEvent, {
      phase: body.phase as string,
      duration: (body.duration as number) ?? 0,
      totalMs: (body.totalMs as number) ?? 0,
      subsystem: body.subsystem as string | undefined,
      order: body.order as number | undefined,
      timestamp: (body.timestamp as number) ?? Date.now(),
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

/**
 * POST /auth-alias-ingest
 * Ingest an authAliases record.
 */
export const authAliasIngest = httpAction(async (ctx, request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // CPHLTH-02: Require Bearer token auth on all ingest endpoints.
  if (!validateIngestAuth(request)) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.alias || !body.provider || !body.userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: alias, provider, userId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    await ctx.runMutation(api.v6Mutations.upsertAuthAlias, {
      alias: body.alias as string,
      provider: body.provider as string,
      userId: body.userId as string,
      createdAt: (body.createdAt as number) ?? Date.now(),
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
